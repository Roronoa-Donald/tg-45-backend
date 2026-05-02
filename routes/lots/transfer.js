const { lotTransferSchema } = require('../../schemas/lot-schema');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow, jsonSchema } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES } = require('../../config/constants');
const lotService = require('../../services/lot-service');
const auditService = require('../../services/audit-service');

module.exports = async function lotTransferRoutes(app) {
  app.post('/:id/transfer', {
    preHandler: [authenticate, requireRole([USER_ROLES.COOPERATIVE, USER_ROLES.EXPORTER])],
  }, async (request) => {
    const payload = parseOrThrow(lotTransferSchema, request.body);
    const lot = await lotService.transferLot(
      app.prisma,
      request.params.id,
      payload.newOwnerId,
      request.user.sub
    );

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'transfer_lot',
      targetType: 'lot',
      targetId: lot.id,
      requestId: request.id,
      details: { newOwnerId: payload.newOwnerId }
    });

    return successEnvelope(lot);
  });
};
