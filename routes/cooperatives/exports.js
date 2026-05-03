const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES, LOT_STATUS } = require('../../config/constants');
const { AppError } = require('../../utils/errors');
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

    const { exporterId, lots } = request.body; // lots is array of { id, weightKg }

    if (!exporterId || !lots || lots.length === 0) {
      throw new AppError('bad_request', 'Missing exporterId or lots payload', 400);
    }

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

        // Update weight if provided
        if (lotInput.weightKg && lotInput.weightKg !== lot.weightKg) {
          await tx.lot.update({
            where: { id: lot.id },
            data: { weightKg: lotInput.weightKg }
          });
        }

        // Update lot status to exported
        await tx.lot.update({
          where: { id: lot.id },
          data: { status: 'exported' } // exported status
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
