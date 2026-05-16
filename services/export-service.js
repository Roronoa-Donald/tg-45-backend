const { AppError } = require('../utils/errors');
const { EXPORT_STATUS, EXPORT_EVENT_TYPES, LOT_STATUS, EUDR_STATUS } = require('../config/constants');
const webhookService = require('./webhook-service');
const reputationService = require('./reputation-service');

async function notifyWebhooks(prisma, payload) {
  const hooks = await prisma.webhookSubscription.findMany({ where: { status: 'active' } });
  if (!hooks.length) {
    return;
  }

  await Promise.all(
    hooks.map((hook) => webhookService.sendWithRetry(hook.url, payload, hook.secret))
  );
}

async function declareExport(prisma, exporterId, payload) {
  let dd = null;
  if (payload.ddId) {
    dd = await prisma.eudrDueDiligence.findUnique({ where: { id: payload.ddId } });
    if (!dd) {
      throw new AppError('not_found', 'Due diligence not found', 404);
    }
    if (dd.exportId) {
      throw new AppError('conflict', 'Due diligence already linked to export', 409);
    }
    if (![EUDR_STATUS.APPROVED, EUDR_STATUS.SUBMITTED].includes(dd.status)) {
      throw new AppError('eudr_not_ready', 'Export due diligence not approved', 400, {
        ddId: dd.id,
        status: dd.status
      });
    }
  }

  const lots = await prisma.lot.findMany({
    where: { id: { in: payload.lotIds } }
  });

  if (lots.length !== payload.lotIds.length) {
    throw new AppError('not_found', 'Lot not found', 404);
  }

  const invalid = lots.find((lot) => {
    const baseStatus = lot.status.split(';')[0];
    return baseStatus !== LOT_STATUS.CERTIFIED;
  });
  if (invalid) {
    throw new AppError('invalid_lot_status', 'Only certified lots can be exported', 400);
  }

  const notEudrReady = lots.find((lot) => ![EUDR_STATUS.APPROVED, EUDR_STATUS.SUBMITTED].includes(lot.eudrStatus));
  if (notEudrReady && process.env.DEMO_MODE !== 'true') {
    throw new AppError('eudr_not_ready', 'Lot EUDR dossier not approved', 400, {
      lotId: notEudrReady.id,
      eudrStatus: notEudrReady.eudrStatus
    });
  }

  const exportRecord = await prisma.$transaction(async (tx) => {
    const created = await tx.export.create({
      data: {
        exporterId,
        cooperativeId: payload.cooperativeId || null,
        status: EXPORT_STATUS.DECLARED
      }
    });

    if (dd) {
      await tx.eudrDueDiligence.update({
        where: { id: dd.id },
        data: { exportId: created.id }
      });

      await tx.export.update({
        where: { id: created.id },
        data: { eudrStatus: dd.status }
      });

      await tx.exportEvent.create({
        data: {
          exportId: created.id,
          eventType: EXPORT_EVENT_TYPES.EUDR_STATUS_UPDATE,
          payload: { ddId: dd.id, status: dd.status }
        }
      });
    }

    await tx.exportLot.createMany({
      data: payload.lotIds.map((lotId) => ({
        exportId: created.id,
        lotId
      }))
    });

    await tx.lot.updateMany({
      where: { id: { in: payload.lotIds } },
      data: { status: 'certified;shipped' }
    });

    await tx.exportEvent.create({
      data: {
        exportId: created.id,
        eventType: EXPORT_EVENT_TYPES.CREATED,
        payload: { lotIds: payload.lotIds, ddId: payload.ddId || null }
      }
    });

    return created;
  });

  await notifyWebhooks(prisma, {
    type: EXPORT_EVENT_TYPES.CREATED,
    exportId: exportRecord.id,
    lotIds: payload.lotIds
  });

  return exportRecord;
}

async function generateManifest(prisma, exportId) {
  const exportRecord = await prisma.export.findUnique({
    where: { id: exportId },
    include: { lots: { include: { lot: true } } }
  });

  if (!exportRecord) {
    throw new AppError('not_found', 'Export not found', 404);
  }

  const manifest = {
    exportId: exportRecord.id,
    lotCodes: exportRecord.lots.map((item) => item.lot.lotCode),
    createdAt: exportRecord.createdAt
  };

  const manifestUrl = `manifest://${exportRecord.id}`;

  await prisma.export.update({
    where: { id: exportId },
    data: { manifestUrl }
  });

  return { manifestUrl, manifest };
}

async function updateStatus(prisma, exportId, status, payload) {
  const exportRecord = await prisma.export.findUnique({
    where: { id: exportId },
    include: {
      lots: {
        include: {
          lot: {
            select: {
              id: true,
              lotCode: true,
              ownerId: true,
            }
          }
        }
      }
    }
  });

  if (!exportRecord) {
    throw new AppError('not_found', 'Export not found', 404);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.export.update({
      where: { id: exportId },
      data: { status }
    });

    await tx.exportEvent.create({
      data: {
        exportId,
        eventType: EXPORT_EVENT_TYPES.STATUS_UPDATE,
        payload
      }
    });

    // Si l'export est rejeté, pénaliser la réputation des propriétaires des lots
    if (status === 'rejected' && exportRecord.lots && exportRecord.lots.length > 0) {
      for (const exportLot of exportRecord.lots) {
        await reputationService.recordEvent(
          tx,
          exportLot.lot.ownerId,
          reputationService.EVENT_TYPES.LOT_REJECTED_BY_EXPORTER,
          exportLot.lot.id,
          payload.note || 'Export rejeté par l\'exportateur'
        );
      }
    }

    return record;
  });

  await notifyWebhooks(prisma, {
    type: EXPORT_EVENT_TYPES.STATUS_UPDATE,
    exportId,
    status,
    note: payload.note
  });

  return updated;
}

async function getExport(prisma, exportId) {
  const exportRecord = await prisma.export.findUnique({
    where: { id: exportId },
    include: { lots: { include: { lot: true } }, events: true }
  });

  if (!exportRecord) {
    throw new AppError('not_found', 'Export not found', 404);
  }

  return exportRecord;
}

module.exports = {
  declareExport,
  generateManifest,
  updateStatus,
  getExport
};
