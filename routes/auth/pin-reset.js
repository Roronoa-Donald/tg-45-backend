const { resetPinSchema } = require('../../schemas/auth-schema');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow, jsonSchema } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES } = require('../../config/constants');
const env = require('../../config/env');
const authService = require('../../services/auth-service');
const auditService = require('../../services/audit-service');

module.exports = async function pinResetRoute(app) {
  app.post('/pin-reset', {
    preHandler: [authenticate, requireRole([USER_ROLES.SUPPORT, USER_ROLES.ADMIN])],
  }, async (request) => {
    const payload = parseOrThrow(resetPinSchema, request.body);
    const user = await authService.resetPin(
      app.prisma,
      payload.userId,
      payload.newPin,
      env.bcryptSaltRounds
    );

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'reset_pin',
      targetType: 'user',
      targetId: user.id,
      requestId: request.id,
      details: {}
    });

    return successEnvelope({ id: user.id, status: 'reset' });
  });
};
