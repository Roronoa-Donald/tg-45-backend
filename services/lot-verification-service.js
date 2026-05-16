const { AppError } = require('../utils/errors');
const parcelValidationService = require('./parcel-validation-service');

const VOTE_THRESHOLD = 0.51;
const VERIFIERS_PER_LOT = 3;
const SPOT_CHECK_PROBABILITY = 0.15;
const VOTE_DEADLINE_HOURS = 48;
const ESCALATION_DEADLINE_HOURS = 72;

async function getRandomVerifiers(prisma, count, excludeIds = []) {
  const verifiers = await prisma.user.findMany({
    where: {
      role: 'verifier',
      status: { in: ['approved', 'active'] }, // Accept both approved and active verifiers
      id: { notIn: excludeIds }
    },
    select: { id: true }
  });

  if (verifiers.length === 0) {
    return [];
  }

  const shuffled = verifiers.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length)).map(v => v.id);
}

async function assignVerifiersToLot(prisma, lotId) {
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: {
      parcels: { include: { parcel: true } },
      verifications: true,
      owner: { select: { id: true } }
    }
  });

  if (!lot) {
    throw new AppError('not_found', 'Lot not found', 404);
  }

  if (lot.verifications.length > 0) {
    return lot.verifications;
  }

  // MODE DEMO: Auto-certifier instantanément
  if (process.env.DEMO_MODE === 'true') {
    await prisma.$transaction(async (tx) => {
      await tx.lot.update({
        where: { id: lotId },
        data: {
          verificationStatus: 'demo_certified',
          autoValidated: true,
          status: 'certified'
        }
      });

      await tx.lotEvent.create({
        data: {
          lotId,
          eventType: 'demo_auto_certified',
          metadata: {
            reason: 'Mode démo - certification instantanée'
          }
        }
      });

      // Créer certification automatique
      await tx.lotCertification.create({
        data: {
          lotId,
          verifierId: null,
          signature: null,
          certifiedAt: new Date()
        }
      });

      // Reputation +5 pour le farmer
      const reputationService = require('./reputation-service');
      await reputationService.recordEvent(
        tx,
        lot.owner.id,
        reputationService.EVENT_TYPES.LOT_CERTIFIED,
        lotId,
        'Lot certifié (mode démo)'
      );
    });

    console.log(`[DEMO MODE] Lot ${lotId} auto-certifié instantanément`);
    return [];
  }

  const allParcelsValid = await checkAllParcelsValid(prisma, lot.parcels);

  if (allParcelsValid) {
    const isSpotCheck = Math.random() < SPOT_CHECK_PROBABILITY;

    if (isSpotCheck) {
      // Spot-check: doit passer par vote 51%
      const verifierIds = await getRandomVerifiers(prisma, VERIFIERS_PER_LOT);
      const voteDeadline = new Date(Date.now() + VOTE_DEADLINE_HOURS * 60 * 60 * 1000);

      await prisma.lot.update({
        where: { id: lotId },
        data: {
          verificationStatus: 'spot_check_pending',
          autoValidated: false,
          spotCheck: true,
          voteDeadline
        }
      });

      const verifications = await Promise.all(
        verifierIds.map(verifierId =>
          prisma.lotVerification.create({
            data: { lotId, verifierId, vote: null }
          })
        )
      );

      return verifications;
    }

    // Auto-validation: passe directement à certified
    await prisma.$transaction(async (tx) => {
      await tx.lot.update({
        where: { id: lotId },
        data: {
          verificationStatus: 'auto_validated',
          autoValidated: true,
          spotCheck: false,
          status: 'certified' // Directement certifié
        }
      });

      await tx.lotEvent.create({
        data: {
          lotId,
          eventType: 'auto_validated',
          metadata: {
            reason: 'Parcelle validée < 30 jours, auto-certification'
          }
        }
      });

      // Créer certification automatique
      await tx.lotCertification.create({
        data: {
          lotId,
          verifierId: null,
          signature: null,
          certifiedAt: new Date()
        }
      });

      // Reputation +5 pour le farmer
      const lotWithOwner = await tx.lot.findUnique({
        where: { id: lotId },
        select: { ownerId: true }
      });

      const reputationService = require('./reputation-service');
      await reputationService.recordEvent(
        tx,
        lotWithOwner.ownerId,
        reputationService.EVENT_TYPES.LOT_CERTIFIED,
        lotId,
        'Lot auto-certifié (parcelle validée)'
      );
    });

    return [];
  }

  const verifierIds = await getRandomVerifiers(prisma, VERIFIERS_PER_LOT);
  const voteDeadline = new Date(Date.now() + VOTE_DEADLINE_HOURS * 60 * 60 * 1000);

  await prisma.lot.update({
    where: { id: lotId },
    data: {
      verificationStatus: 'pending_vote',
      voteDeadline
    }
  });

  const verifications = await Promise.all(
    verifierIds.map(verifierId =>
      prisma.lotVerification.create({
        data: { lotId, verifierId, vote: null }
      })
    )
  );

  return verifications;
}

async function checkAllParcelsValid(prisma, lotParcels) {
  if (!lotParcels || lotParcels.length === 0) {
    return false;
  }

  for (const lp of lotParcels) {
    const isValid = await parcelValidationService.isParcelValid(prisma, lp.parcelId);
    if (!isValid) {
      return false;
    }
  }

  return true;
}

async function getPendingLots(prisma, verifierId, pagination = { skip: 0, pageSize: 20 }) {
  const where = {
    verifications: {
      some: {
        verifierId,
        vote: { equals: null }
      }
    }
  };

  const [total, items] = await Promise.all([
    prisma.lot.count({ where }),
    prisma.lot.findMany({
      where,
      skip: pagination.skip,
      take: pagination.pageSize,
      orderBy: { createdAt: 'asc' },
      include: {
        owner: { select: { id: true, name: true, phone: true } },
        cooperative: { select: { id: true, name: true } },
        parcels: {
          include: {
            parcel: {
              select: { id: true, name: true, validationStatus: true, validUntil: true, geometry: true, geometryType: true }
            }
          }
        },
        images: { select: { id: true, url: true, isPrimary: true } },
        verifications: {
          where: { verifierId },
          select: { id: true, vote: true }
        }
      }
    })
  ]);

  return { total, items };
}

async function getAutoValidatedLots(prisma, verifierId, pagination = { skip: 0, pageSize: 20 }) {
  const where = {
    verificationStatus: 'auto_validated',
    autoValidated: true
  };

  const [total, items] = await Promise.all([
    prisma.lot.count({ where }),
    prisma.lot.findMany({
      where,
      skip: pagination.skip,
      take: pagination.pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, name: true, phone: true } },
        cooperative: { select: { id: true, name: true } },
        parcels: {
          include: {
            parcel: {
              select: { id: true, name: true, validationStatus: true, validUntil: true, geometry: true, geometryType: true }
            }
          }
        },
        images: { select: { id: true, url: true, isPrimary: true } }
      }
    })
  ]);

  return { total, items };
}

async function getSpotCheckLots(prisma, verifierId, pagination = { skip: 0, pageSize: 20 }) {
  const where = {
    spotCheck: true,
    verifications: {
      some: {
        verifierId,
        vote: { equals: null }
      }
    }
  };

  const [total, items] = await Promise.all([
    prisma.lot.count({ where }),
    prisma.lot.findMany({
      where,
      skip: pagination.skip,
      take: pagination.pageSize,
      orderBy: { createdAt: 'asc' },
      include: {
        owner: { select: { id: true, name: true, phone: true } },
        cooperative: { select: { id: true, name: true } },
        parcels: {
          include: {
            parcel: {
              select: { id: true, name: true, validationStatus: true, validUntil: true, geometry: true, geometryType: true }
            }
          }
        },
        images: { select: { id: true, url: true, isPrimary: true } },
        verifications: {
          where: { verifierId },
          select: { id: true, vote: true }
        }
      }
    })
  ]);

  return { total, items };
}

async function voteLot(prisma, lotId, verifierId, vote, reason) {
  const verification = await prisma.lotVerification.findUnique({
    where: { lotId_verifierId: { lotId, verifierId } }
  });

  if (!verification) {
    throw new AppError('not_assigned', 'You are not assigned to verify this lot', 403);
  }

  if (verification.vote !== null) {
    throw new AppError('already_voted', 'You have already voted on this lot', 400);
  }

  if (!['approve', 'reject'].includes(vote)) {
    throw new AppError('invalid_vote', 'Vote must be approve or reject', 400);
  }

  await prisma.lotVerification.update({
    where: { id: verification.id },
    data: { vote, reason }
  });

  await checkAndFinalizeVote(prisma, lotId);

  return { success: true };
}

async function checkAndFinalizeVote(prisma, lotId) {
  await prisma.$transaction(async (tx) => {
    const lot = await tx.lot.findUnique({
      where: { id: lotId },
      include: {
        verifications: true,
        owner: { select: { id: true } }
      }
    });

    if (!lot || lot.verificationStatus === 'validated' || lot.verificationStatus === 'rejected') {
      return;
    }

    const completedVotes = lot.verifications.filter(v => v.vote !== null);
    const totalVerifiers = lot.verifications.length;

    if (completedVotes.length < totalVerifiers) {
      return;
    }

    const approveCount = completedVotes.filter(v => v.vote === 'approve').length;
    const approvalRatio = approveCount / totalVerifiers;

    const isApproved = approvalRatio >= VOTE_THRESHOLD;
    const newVerificationStatus = isApproved ? 'validated' : 'rejected';
    const newLotStatus = isApproved ? 'certified' : 'rejected';

    await tx.lot.update({
      where: { id: lotId },
      data: {
        verificationStatus: newVerificationStatus,
        status: newLotStatus
      }
    });

    await tx.lotEvent.create({
      data: {
        lotId,
        eventType: isApproved ? 'vote_approved' : 'vote_rejected',
        metadata: {
          approveCount,
          totalVerifiers,
          approvalRatio: `${(approvalRatio * 100).toFixed(1)}%`
        }
      }
    });

    // Si approuvé, créer automatiquement la certification
    if (isApproved) {
      await tx.lotCertification.create({
        data: {
          lotId,
          verifierId: null, // Certification automatique par vote 51%
          signature: null,
          certifiedAt: new Date()
        }
      });

      await tx.lotEvent.create({
        data: {
          lotId,
          eventType: 'auto_certified',
          metadata: {
            reason: 'Certification automatique après vote 51%',
            approvalRatio: `${(approvalRatio * 100).toFixed(1)}%`
          }
        }
      });

      // Enregistrer événement reputation pour le farmer
      const reputationService = require('./reputation-service');
      await reputationService.recordEvent(
        tx,
        lot.owner.id,
        reputationService.EVENT_TYPES.LOT_CERTIFIED,
        lot.id,
        'Lot certifié par vote 51%'
      );
    }
  });
}

async function contestAutoValidation(prisma, lotId, verifierId, reason) {
  const lot = await prisma.lot.findUnique({
    where: { id: lotId }
  });

  if (!lot) {
    throw new AppError('not_found', 'Lot not found', 404);
  }

  if (lot.verificationStatus !== 'auto_validated') {
    throw new AppError('invalid_status', 'Lot is not auto-validated', 400);
  }

  const verifierIds = await getRandomVerifiers(prisma, VERIFIERS_PER_LOT, [verifierId]);
  verifierIds.push(verifierId);

  const voteDeadline = new Date(Date.now() + VOTE_DEADLINE_HOURS * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.lot.update({
      where: { id: lotId },
      data: {
        verificationStatus: 'pending_vote',
        autoValidated: false,
        voteDeadline
      }
    });

    await Promise.all(
      verifierIds.map(vId =>
        tx.lotVerification.upsert({
          where: { lotId_verifierId: { lotId, verifierId: vId } },
          create: {
            lotId,
            verifierId: vId,
            vote: vId === verifierId ? 'reject' : null,
            reason: vId === verifierId ? reason : null
          },
          update: {
            vote: vId === verifierId ? 'reject' : null,
            reason: vId === verifierId ? reason : null
          }
        })
      )
    );
  });

  return { success: true, message: 'Lot sent to 51% vote' };
}

async function processExpiredVotes(prisma) {
  const now = new Date();
  const reminderTime = new Date(now.getTime() - VOTE_DEADLINE_HOURS * 60 * 60 * 1000);
  const escalationTime = new Date(now.getTime() - ESCALATION_DEADLINE_HOURS * 60 * 60 * 1000);

  const lotsNeedingReminder = await prisma.lot.findMany({
    where: {
      verificationStatus: 'pending_vote',
      voteDeadline: { lte: reminderTime, gt: escalationTime }
    },
    include: {
      verifications: {
        where: { vote: null },
        include: { verifier: { select: { id: true, email: true, name: true } } }
      }
    }
  });

  const lotsNeedingEscalation = await prisma.lot.findMany({
    where: {
      verificationStatus: 'pending_vote',
      voteDeadline: { lte: escalationTime }
    }
  });

  return {
    needsReminder: lotsNeedingReminder,
    needsEscalation: lotsNeedingEscalation
  };
}

module.exports = {
  assignVerifiersToLot,
  getPendingLots,
  getAutoValidatedLots,
  getSpotCheckLots,
  voteLot,
  contestAutoValidation,
  processExpiredVotes,
  checkAndFinalizeVote
};
