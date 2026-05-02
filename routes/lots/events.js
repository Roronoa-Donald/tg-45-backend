const { successEnvelope } = require('../../utils/response');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { USER_ROLES } = require('../../config/constants');

module.exports = async function lotEventsRoutes(app) {
  app.get('/:id/events', {
    preHandler: [authenticate, requireRole([USER_ROLES.COOPERATIVE, USER_ROLES.VERIFIER, USER_ROLES.EXPORTER, USER_ROLES.ADMIN])]
  }, async (request) => {
    const events = await app.prisma.lotEvent.findMany({
      where: { lotId: request.params.id },
      orderBy: { occurredAt: 'asc' }
    });

    return successEnvelope(events);
  });
};
