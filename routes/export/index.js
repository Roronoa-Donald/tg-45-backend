const { exportDeclarationSchema, exportStatusSchema } = require('../../schemas/export-schema');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow, jsonSchema } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES } = require('../../config/constants');
const exportService = require('../../services/export-service');
const auditService = require('../../services/audit-service');

module.exports = async function exportRoutes(app) {
  app.post('/', {
    preHandler: [authenticate, requireRole([USER_ROLES.EXPORTER])],
  }, async (request) => {
    const payload = parseOrThrow(exportDeclarationSchema, request.body);
    const exportRecord = await exportService.declareExport(app.prisma, request.user.sub, payload);

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'declare_export',
      targetType: 'export',
      targetId: exportRecord.id,
      requestId: request.id,
      details: { lotIds: payload.lotIds }
    });

    return successEnvelope(exportRecord);
  });

  app.post('/:id/manifest', {
    preHandler: [authenticate, requireRole([USER_ROLES.EXPORTER])]
  }, async (request) => {
    const result = await exportService.generateManifest(app.prisma, request.params.id);
    return successEnvelope(result);
  });

  app.post('/:id/status', {
    preHandler: [authenticate, requireRole([USER_ROLES.EXPORTER, USER_ROLES.COOPERATIVE])]
  }, async (request) => {
    const payload = parseOrThrow(exportStatusSchema, request.body);
    const exportRecord = await exportService.updateStatus(app.prisma, request.params.id, payload.status, payload);
    return successEnvelope(exportRecord);
  });

  app.get('/:id', {
    preHandler: [authenticate, requireRole([USER_ROLES.EXPORTER, USER_ROLES.COOPERATIVE])]
  }, async (request) => {
    const exportRecord = await exportService.getExport(app.prisma, request.params.id);
    return successEnvelope(exportRecord);
  });
};
