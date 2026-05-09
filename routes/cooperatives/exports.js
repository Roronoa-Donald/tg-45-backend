const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES, LOT_STATUS, EUDR_STATUS, EXPORT_EVENT_TYPES } = require('../../config/constants');
const { AppError } = require('../../utils/errors');
const { cooperativeExportSchema } = require('../../schemas/export-schema');
const auditService = require('../../services/audit-service');

module.exports = async function cooperativeExportsRoutes(app) {
  // Get active exporters for the dropdown
  app.get('/exporters', {
    preHandler: [authenticate, requireRole([USER_ROLES.COOPERATIVE])]
  }, async () => {
    const exporters = await app.prisma.user.findMany({
      where: {
        role: USER_ROLES.EXPORTER,
        status: 'active'
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });
    return successEnvelope(exporters);
  });

  // Create an export
  app.post('/:id/exports', {
    preHandler: [authenticate, requireRole([USER_ROLES.COOPERATIVE])]
  }, async (request) => {
    const { id } = request.params;
    
    if (request.user.cooperativeId !== id) {
      throw new AppError('forbidden', 'You can only export for your own cooperative', 403);
    }

    const { exporterId, lots, ddId } = parseOrThrow(cooperativeExportSchema, request.body);

    // Verify exporter is active
    const exporter = await app.prisma.user.findFirst({
      where: { id: exporterId, role: USER_ROLES.EXPORTER, status: 'active' }
    });

    if (!exporter) {
      throw new AppError('not_found', 'Exporter not found or inactive', 404);
    }

    const exportRecord = await app.prisma.$transaction(async (tx) => {
      // 1. Create the Export record
      const exp = await tx.export.create({
        data: {
          exporterId,
          cooperativeId: id,
          status: 'declared'
        }
      });

      if (ddId) {
        const dd = await tx.eudrDueDiligence.findUnique({ where: { id: ddId } });
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

        await tx.eudrDueDiligence.update({
          where: { id: ddId },
          data: { exportId: exp.id }
        });

        await tx.export.update({
          where: { id: exp.id },
          data: { eudrStatus: dd.status }
        });

        await tx.exportEvent.create({
          data: {
            exportId: exp.id,
            eventType: EXPORT_EVENT_TYPES.EUDR_STATUS_UPDATE,
            payload: { ddId, status: dd.status }
          }
        });
      }

      // 2. Process each lot
      for (const lotInput of lots) {
        const lot = await tx.lot.findFirst({
          where: {
            id: lotInput.id,
            cooperativeId: id,
            status: LOT_STATUS.CERTIFIED
          }
        });

        if (!lot) {
          throw new AppError('invalid_lot', `Lot ${lotInput.id} is not certified or does not belong to your cooperative`, 400);
        }

        if (![EUDR_STATUS.APPROVED, EUDR_STATUS.SUBMITTED].includes(lot.eudrStatus)) {
          throw new AppError('eudr_not_ready', 'Lot EUDR dossier not approved', 400, {
            lotId: lot.id,
            eudrStatus: lot.eudrStatus
          });
        }

        // Update weight if provided
        if (typeof lotInput.weightKg === 'number' && lotInput.weightKg !== lot.weightKg) {
          await tx.lot.update({
            where: { id: lot.id },
            data: { weightKg: lotInput.weightKg }
          });
        }

        // Update lot status to exported
        await tx.lot.update({
          where: { id: lot.id },
          data: { status: 'certified;exported' } // double-badge format
        });

        // Link lot to export
        await tx.exportLot.create({
          data: {
            exportId: exp.id,
            lotId: lot.id
          }
        });

        // Audit Log for Lot
        await tx.lotEvent.create({
          data: {
            lotId: lot.id,
            actorId: request.user.sub,
            eventType: 'export_lot',
            metadata: { exportId: exp.id, exporterId, newWeightKg: lotInput.weightKg }
          }
        });
      }

      return exp;
    });

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'create_export',
      targetType: 'export',
      targetId: exportRecord.id,
      requestId: request.id,
      details: { cooperativeId: id, exporterId, lotCount: lots.length }
    });

    return successEnvelope(exportRecord);
  });
};
