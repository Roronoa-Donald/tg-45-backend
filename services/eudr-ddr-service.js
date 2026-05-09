const { AppError } = require('../utils/errors');
const { EUDR_STATUS, LOT_EVENT_TYPES, EXPORT_EVENT_TYPES } = require('../config/constants');

async function ensureTarget(prisma, payload) {
  if (payload.lotId) {
    const lot = await prisma.lot.findUnique({ where: { id: payload.lotId } });
    if (!lot) {
      throw new AppError('not_found', 'Lot not found', 404);
    }
    return { lot };
  }

  if (payload.exportId) {
    const exportRecord = await prisma.export.findUnique({ where: { id: payload.exportId } });
    if (!exportRecord) {
      throw new AppError('not_found', 'Export not found', 404);
    }
    return { exportRecord };
  }

  throw new AppError('invalid_target', 'Lot or export required', 400);
}

async function createDueDiligence(prisma, payload, actorId) {
  const { lot, exportRecord } = await ensureTarget(prisma, payload);

  const existing = await prisma.eudrDueDiligence.findFirst({
    where: {
      lotId: payload.lotId || undefined,
      exportId: payload.exportId || undefined
    }
  });
  if (existing) {
    throw new AppError('conflict', 'Due diligence already exists', 409);
  }

  const dd = await prisma.eudrDueDiligence.create({
    data: {
      lotId: payload.lotId || null,
      exportId: payload.exportId || null,
      status: EUDR_STATUS.DRAFT,
      riskLevel: payload.riskLevel || null,
      assessmentSummary: payload.assessmentSummary || null,
      mitigationSummary: payload.mitigationSummary || null,
      createdBy: actorId
    }
  });

  if (lot) {
    await prisma.lot.update({
      where: { id: lot.id },
      data: { eudrStatus: EUDR_STATUS.DRAFT }
    });
    await prisma.lotEvent.create({
      data: {
        lotId: lot.id,
        actorId,
        eventType: LOT_EVENT_TYPES.EUDR_DDR_CREATED,
        metadata: { ddId: dd.id }
      }
    });
  }

  if (exportRecord) {
    await prisma.export.update({
      where: { id: exportRecord.id },
      data: { eudrStatus: EUDR_STATUS.DRAFT }
    });
    await prisma.exportEvent.create({
      data: {
        exportId: exportRecord.id,
        eventType: EXPORT_EVENT_TYPES.EUDR_STATUS_UPDATE,
        payload: { ddId: dd.id, status: EUDR_STATUS.DRAFT }
      }
    });
  }

  return dd;
}

async function updateDueDiligence(prisma, ddId, payload) {
  const dd = await prisma.eudrDueDiligence.findUnique({ where: { id: ddId } });
  if (!dd) {
    throw new AppError('not_found', 'Due diligence not found', 404);
  }
  if (dd.status === EUDR_STATUS.SUBMITTED) {
    throw new AppError('invalid_status', 'Due diligence already submitted', 400);
  }

  return prisma.eudrDueDiligence.update({
    where: { id: ddId },
    data: {
      riskLevel: payload.riskLevel ?? undefined,
      assessmentSummary: payload.assessmentSummary ?? undefined,
      mitigationSummary: payload.mitigationSummary ?? undefined
    }
  });
}

async function approveDueDiligence(prisma, ddId, actorId, approved) {
  const dd = await prisma.eudrDueDiligence.findUnique({ where: { id: ddId } });
  if (!dd) {
    throw new AppError('not_found', 'Due diligence not found', 404);
  }

  const nextStatus = approved ? EUDR_STATUS.APPROVED : EUDR_STATUS.REJECTED;
  const updated = await prisma.eudrDueDiligence.update({
    where: { id: ddId },
    data: {
      status: nextStatus,
      approvedBy: actorId,
      approvedAt: new Date()
    }
  });

  if (dd.lotId) {
    await prisma.lot.update({
      where: { id: dd.lotId },
      data: { eudrStatus: nextStatus }
    });
    await prisma.lotEvent.create({
      data: {
        lotId: dd.lotId,
        actorId,
        eventType: LOT_EVENT_TYPES.EUDR_DDR_APPROVED,
        metadata: { ddId: dd.id, status: nextStatus }
      }
    });
  }

  if (dd.exportId) {
    await prisma.export.update({
      where: { id: dd.exportId },
      data: { eudrStatus: nextStatus }
    });
    await prisma.exportEvent.create({
      data: {
        exportId: dd.exportId,
        eventType: EXPORT_EVENT_TYPES.EUDR_STATUS_UPDATE,
        payload: { ddId: dd.id, status: nextStatus }
      }
    });
  }

  return updated;
}

async function markSubmitted(prisma, ddId, actorId, declarationRef) {
  const dd = await prisma.eudrDueDiligence.findUnique({ where: { id: ddId } });
  if (!dd) {
    throw new AppError('not_found', 'Due diligence not found', 404);
  }
  if (dd.status !== EUDR_STATUS.APPROVED) {
    throw new AppError('invalid_status', 'Due diligence must be approved before submission', 400);
  }

  const updated = await prisma.eudrDueDiligence.update({
    where: { id: ddId },
    data: {
      status: EUDR_STATUS.SUBMITTED,
      declarationRef: declarationRef || dd.declarationRef
    }
  });

  if (dd.lotId) {
    await prisma.lot.update({
      where: { id: dd.lotId },
      data: { eudrStatus: EUDR_STATUS.SUBMITTED }
    });
    await prisma.lotEvent.create({
      data: {
        lotId: dd.lotId,
        actorId,
        eventType: LOT_EVENT_TYPES.EUDR_DDR_SUBMITTED,
        metadata: { ddId: dd.id, declarationRef }
      }
    });
  }

  if (dd.exportId) {
    await prisma.export.update({
      where: { id: dd.exportId },
      data: { eudrStatus: EUDR_STATUS.SUBMITTED }
    });
    await prisma.exportEvent.create({
      data: {
        exportId: dd.exportId,
        eventType: EXPORT_EVENT_TYPES.EUDR_DDR_SUBMITTED,
        payload: { ddId: dd.id, declarationRef }
      }
    });
  }

  return updated;
}

module.exports = {
  createDueDiligence,
  updateDueDiligence,
  approveDueDiligence,
  markSubmitted
};
