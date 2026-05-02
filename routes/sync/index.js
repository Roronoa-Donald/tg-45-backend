const { syncBatchSchema } = require('../../schemas/sync-schema');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow, jsonSchema } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES } = require('../../config/constants');
const syncService = require('../../services/sync-service');

module.exports = async function syncRoutes(app) {
  app.post('/batch', {
    preHandler: [authenticate, requireRole([USER_ROLES.FARMER, USER_ROLES.COOPERATIVE])],
  }, async (request) => {
    const payload = parseOrThrow(syncBatchSchema, request.body);
    const results = await syncService.enqueueBatch(app.prisma, request.user.sub, payload.actions);
    return successEnvelope(results);
  });

  app.get('/status', {
    preHandler: [authenticate]
  }, async (request) => {
    const queue = await syncService.listQueue(app.prisma, request.user.sub);
    return successEnvelope(queue);
  });
};
