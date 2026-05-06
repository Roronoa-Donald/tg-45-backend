const { cooperativeCreateSchema } = require('../../schemas/cooperative-schema');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow, jsonSchema } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES } = require('../../config/constants');
const cooperativeService = require('../../services/cooperative-service');
const auditService = require('../../services/audit-service');

module.exports = async function cooperativeRoutes(app) {
  app.get('/', {
    preHandler: [authenticate]
  }, async () => {
    const cooperatives = await app.prisma.cooperative.findMany({
      orderBy: { name: 'asc' }
    });
    return successEnvelope(cooperatives);
  });

  app.post('/', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN])],
  }, async (request) => {
    const payload = parseOrThrow(cooperativeCreateSchema, request.body);
    const cooperative = await cooperativeService.create(app.prisma, payload);

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'create_cooperative',
      targetType: 'cooperative',
      targetId: cooperative.id,
      requestId: request.id,
      details: { name: cooperative.name }
    });

    return successEnvelope(cooperative);
  });

  app.get('/:id/members', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN, USER_ROLES.COOPERATIVE])]
  }, async (request) => {
    const members = await cooperativeService.listMembers(app.prisma, request.params.id);
    return successEnvelope(members);
  });

  await app.register(require('./members'));
  await app.register(require('./farmers'));
  await app.register(require('./exports'));
};
