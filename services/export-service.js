const { AppError } = require('../utils/errors');
const { EXPORT_STATUS, EXPORT_EVENT_TYPES, LOT_STATUS } = require('../config/constants');
const webhookService = require('./webhook-service');

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

  const exportRecord = await prisma.$transaction(async (tx) => {
    const created = await tx.export.create({
      data: {
        exporterId,
        cooperativeId: payload.cooperativeId || null,
        status: EXPORT_STATUS.DECLARED
      }
    });

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
        payload: { lotIds: payload.lotIds }
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
  const exportRecord = await prisma.export.findUnique({ where: { id: exportId } });
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
