const { onboardSchema } = require('../../schemas/auth-schema');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow, jsonSchema } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES } = require('../../config/constants');
const env = require('../../config/env');
const authService = require('../../services/auth-service');
const auditService = require('../../services/audit-service');

module.exports = async function onboardRoute(app) {
  app.post('/onboard', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN])],
  }, async (request) => {
    const payload = parseOrThrow(onboardSchema, request.body);
    const user = await authService.onboardUser(app.prisma, payload, env.bcryptSaltRounds);

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'onboard_user',
      targetType: 'user',
      targetId: user.id,
      requestId: request.id,
      details: { role: user.role }
    });

    return successEnvelope({ id: user.id, role: user.role });
  });
};
