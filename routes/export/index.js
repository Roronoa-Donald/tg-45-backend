const { exportDeclarationSchema, exportStatusSchema } = require('../../schemas/export-schema');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow, jsonSchema } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES, LOT_STATUS } = require('../../config/constants');
const { AppError } = require('../../utils/errors');
const exportService = require('../../services/export-service');
const auditService = require('../../services/audit-service');

module.exports = async function exportRoutes(app) {
  // 1. Get incoming exports for an exporter
  app.get('/incoming', {
    preHandler: [authenticate, requireRole([USER_ROLES.EXPORTER])]
  }, async (request) => {
    const exports = await app.prisma.export.findMany({
      where: {
        exporterId: request.user.sub
      },
      include: {
        cooperative: true,
        lots: {
          include: {
            lot: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return successEnvelope(exports);
  });

  // 2. Accept an export
  app.post('/:id/accept', {
    preHandler: [authenticate, requireRole([USER_ROLES.EXPORTER])]
  }, async (request) => {
    const { id } = request.params;
    const { gps } = request.body || {}; // Exporter sends GPS to close the loop

    const exp = await app.prisma.export.findFirst({
      where: { id, exporterId: request.user.sub, status: 'declared' },
      include: { lots: true }
    });

    if (!exp) throw new AppError('not_found', 'Export not found or already processed', 404);

    const updatedExp = await app.prisma.$transaction(async (tx) => {
      // Mark export as delivered
      const updated = await tx.export.update({
        where: { id },
        data: { status: 'delivered' }
      });

      // Update all associated lots
      for (const el of exp.lots) {
        await tx.lot.update({
          where: { id: el.lotId },
          data: { status: LOT_STATUS.SHIPPED } // or 'delivered' / final state
        });

        // Add GPS event to traceability map
        await tx.lotEvent.create({
          data: {
            lotId: el.lotId,
            actorId: request.user.sub,
            eventType: 'export_accepted',
            metadata: {
              exportId: id,
              gps: gps || null
            }
          }
        });
      }
      return updated;
    });

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'accept_export',
      targetType: 'export',
      targetId: id,
      requestId: request.id
    });

    return successEnvelope(updatedExp);
  });

  // 3. Reject an export
  app.post('/:id/reject', {
    preHandler: [authenticate, requireRole([USER_ROLES.EXPORTER])]
  }, async (request) => {
    const { id } = request.params;
    const { reason } = request.body || {};

    const exp = await app.prisma.export.findFirst({
      where: { id, exporterId: request.user.sub, status: 'declared' },
      include: { lots: true }
    });

    if (!exp) throw new AppError('not_found', 'Export not found or already processed', 404);

    const updatedExp = await app.prisma.$transaction(async (tx) => {
      const updated = await tx.export.update({
        where: { id },
        data: { status: 'rejected' }
      });

      for (const el of exp.lots) {
        // Revert lot status to certified so cooperative can re-export
        await tx.lot.update({
          where: { id: el.lotId },
          data: { status: LOT_STATUS.CERTIFIED } 
        });

        await tx.lotEvent.create({
          data: {
            lotId: el.lotId,
            actorId: request.user.sub,
            eventType: 'export_rejected',
            metadata: { exportId: id, reason }
          }
        });
      }
      return updated;
    });

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'reject_export',
      targetType: 'export',
      targetId: id,
      requestId: request.id,
      details: { reason }
    });

    return successEnvelope(updatedExp);
  });

  // Keep the GET /:id just in case
  app.get('/:id', {
    preHandler: [authenticate, requireRole([USER_ROLES.EXPORTER, USER_ROLES.COOPERATIVE])]
  }, async (request) => {
    const exportRecord = await app.prisma.export.findUnique({
      where: { id: request.params.id },
      include: { lots: { include: { lot: true } }, cooperative: true }
    });
    return successEnvelope(exportRecord);
  });
};
