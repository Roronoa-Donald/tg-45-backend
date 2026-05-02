const { cooperativeMemberSchema } = require('../../schemas/cooperative-schema');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow, jsonSchema } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES } = require('../../config/constants');
const cooperativeService = require('../../services/cooperative-service');
const auditService = require('../../services/audit-service');

module.exports = async function cooperativeMemberRoutes(app) {
  app.post('/:id/members', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN, USER_ROLES.COOPERATIVE])],
  }, async (request) => {
    const payload = parseOrThrow(cooperativeMemberSchema, request.body);
    const membership = await cooperativeService.addMember(
      app.prisma,
      request.params.id,
      payload.userId,
      payload.role
    );

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'add_member',
      targetType: 'cooperative',
      targetId: request.params.id,
      requestId: request.id,
      details: { userId: payload.userId }
    });

    return successEnvelope(membership);
  });

  app.delete('/:id/members/:userId', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN, USER_ROLES.COOPERATIVE])]
  }, async (request) => {
    const membership = await cooperativeService.removeMember(
      app.prisma,
      request.params.id,
      request.params.userId
    );

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'remove_member',
      targetType: 'cooperative',
      targetId: request.params.id,
      requestId: request.id,
      details: { userId: request.params.userId }
    });

    return successEnvelope(membership);
  });
};
