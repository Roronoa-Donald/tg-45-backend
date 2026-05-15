const { AppError } = require('../utils/errors');

const DISPUTE_STATUS = {
  OPEN: 'ouvert',
  INVESTIGATING: 'en_investigation',
  RESOLVED: 'resolu',
  CLOSED: 'clos',
};

/**
 * Create a new dispute case
 */
async function createDispute(prisma, data) {
  const { lotId, reportedBy, reportedAgainst, reason, evidence } = data;

  // Verify that the lot exists
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) {
    throw new AppError('not_found', 'Lot introuvable', 404);
  }

  // Verify that users exist
  const reporter = await prisma.user.findUnique({ where: { id: reportedBy } });
  if (!reporter) {
    throw new AppError('not_found', 'Rapporteur introuvable', 404);
  }

  const accused = await prisma.user.findUnique({ where: { id: reportedAgainst } });
  if (!accused) {
    throw new AppError('not_found', 'Utilisateur accusé introuvable', 404);
  }

  // Cannot report oneself
  if (reportedBy === reportedAgainst) {
    throw new AppError('invalid_dispute', 'Vous ne pouvez pas signaler un litige contre vous-même', 400);
  }

  const dispute = await prisma.disputeCase.create({
    data: {
      lotId,
      reportedBy,
      reportedAgainst,
      reason,
      evidence: evidence || null,
      status: DISPUTE_STATUS.OPEN,
    },
    include: {
      lot: {
        select: {
          id: true,
          lotCode: true,
          product: true,
          weightKg: true,
        },
      },
      reporter: { select: { id: true, name: true, role: true } },
      accused: { select: { id: true, name: true, role: true } },
    },
  });

  return dispute;
}

/**
 * Update dispute status
 */
async function updateDisputeStatus(prisma, disputeId, status, resolvedBy = null, resolution = null) {
  const validStatuses = Object.values(DISPUTE_STATUS);
  if (!validStatuses.includes(status)) {
    throw new AppError(
      'invalid_status',
      `Le statut doit être l'un de: ${validStatuses.join(', ')}`,
      400
    );
  }

  // Verify dispute exists
  const existing = await prisma.disputeCase.findUnique({
    where: { id: disputeId },
  });

  if (!existing) {
    throw new AppError('not_found', 'Litige introuvable', 404);
  }

  const updateData = { status };

  if (status === DISPUTE_STATUS.RESOLVED || status === DISPUTE_STATUS.CLOSED) {
    updateData.resolvedAt = new Date();
    if (resolvedBy) updateData.resolvedBy = resolvedBy;
    if (resolution) updateData.resolution = resolution;
  }

  const dispute = await prisma.disputeCase.update({
    where: { id: disputeId },
    data: updateData,
    include: {
      lot: {
        select: {
          id: true,
          lotCode: true,
          product: true,
          weightKg: true,
        },
      },
      reporter: { select: { id: true, name: true, role: true } },
      accused: { select: { id: true, name: true, role: true } },
      resolver: { select: { id: true, name: true, role: true } },
    },
  });

  // If dispute proven, impact reputation
  if (status === DISPUTE_STATUS.RESOLVED && resolution && resolution.toLowerCase().includes('prouvé')) {
    const reputationService = require('./reputation-service');
    await reputationService.recordEvent(
      prisma,
      dispute.reportedAgainst,
      reputationService.EVENT_TYPES.DISPUTE_PROVEN,
      dispute.lotId,
      `Litige prouvé: ${dispute.reason.substring(0, 100)}`
    );
  }

  return dispute;
}

/**
 * Get disputes with filters
 */
async function getDisputes(prisma, filters = {}) {
  const { status, reportedBy, reportedAgainst, lotId } = filters;

  const where = {};
  if (status) where.status = status;
  if (reportedBy) where.reportedBy = reportedBy;
  if (reportedAgainst) where.reportedAgainst = reportedAgainst;
  if (lotId) where.lotId = lotId;

  return prisma.disputeCase.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      lot: {
        select: {
          id: true,
          lotCode: true,
          product: true,
          weightKg: true,
          status: true,
        },
      },
      reporter: { select: { id: true, name: true, role: true } },
      accused: { select: { id: true, name: true, role: true } },
      resolver: { select: { id: true, name: true, role: true } },
    },
  });
}

/**
 * Get dispute by ID
 */
async function getDisputeById(prisma, disputeId) {
  const dispute = await prisma.disputeCase.findUnique({
    where: { id: disputeId },
    include: {
      lot: {
        include: {
          owner: { select: { id: true, name: true, role: true } },
          cooperative: { select: { id: true, name: true } },
          images: {
            select: { id: true, url: true, isPrimary: true },
            take: 5,
          },
        },
      },
      reporter: {
        select: {
          id: true,
          name: true,
          role: true,
          email: true,
          phone: true,
        },
      },
      accused: {
        select: {
          id: true,
          name: true,
          role: true,
          email: true,
          phone: true,
        },
      },
      resolver: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  if (!dispute) {
    throw new AppError('not_found', 'Litige introuvable', 404);
  }

  return dispute;
}

/**
 * Get dispute statistics
 */
async function getStatistics(prisma) {
  const total = await prisma.disputeCase.count();
  const open = await prisma.disputeCase.count({
    where: { status: DISPUTE_STATUS.OPEN },
  });
  const investigating = await prisma.disputeCase.count({
    where: { status: DISPUTE_STATUS.INVESTIGATING },
  });
  const resolved = await prisma.disputeCase.count({
    where: { status: DISPUTE_STATUS.RESOLVED },
  });
  const closed = await prisma.disputeCase.count({
    where: { status: DISPUTE_STATUS.CLOSED },
  });

  const recentDisputes = await prisma.disputeCase.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
  });

  return {
    total,
    byStatus: {
      open,
      investigating,
      resolved,
      closed,
    },
    recentLast7Days: recentDisputes,
  };
}

/**
 * Add comment/note to dispute (optional enhancement)
 */
async function addNote(prisma, disputeId, userId, note) {
  // This would require a DisputeNote table - implement if needed
  // For now, we can add to resolution field or use a simple update
  const dispute = await getDisputeById(prisma, disputeId);

  const timestamp = new Date().toISOString();
  const noteText = `[${timestamp}] Note de ${userId}: ${note}`;

  const currentResolution = dispute.resolution || '';
  const newResolution = currentResolution
    ? `${currentResolution}\n\n${noteText}`
    : noteText;

  return prisma.disputeCase.update({
    where: { id: disputeId },
    data: { resolution: newResolution },
  });
}

module.exports = {
  DISPUTE_STATUS,
  createDispute,
  updateDisputeStatus,
  getDisputes,
  getDisputeById,
  getStatistics,
  addNote,
};
