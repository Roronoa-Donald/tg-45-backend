const crypto = require('crypto');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { apiKeyCreateSchema, webhookSchema } = require('../../schemas/partner-schema');
const { parseOrThrow, jsonSchema } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES } = require('../../config/constants');
const partnerService = require('../../services/partner-service');

async function apiKeyAuth(app, request) {
  const key = request.headers['x-api-key'];
  const record = await partnerService.verifyApiKey(app.prisma, key);
  request.partner = record;
}

module.exports = async function partnerRoutes(app) {
  app.post('/api-keys', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN])],
  }, async (request) => {
    const payload = parseOrThrow(apiKeyCreateSchema, request.body);
    const result = await partnerService.createApiKey(app.prisma, payload);
    return successEnvelope({ id: result.record.id, apiKey: result.apiKey });
  });

  app.post('/webhooks', {
    preHandler: [(request) => apiKeyAuth(app, request)],
  }, async (request) => {
    const payload = parseOrThrow(webhookSchema, request.body);
    const webhook = await app.prisma.webhookSubscription.create({
      data: {
        apiKeyId: request.partner.id,
        url: payload.url,
        secret: crypto.randomBytes(16).toString('hex')
      }
    });

    return successEnvelope({ id: webhook.id });
  });

  app.get('/exports', {
    preHandler: [(request) => apiKeyAuth(app, request)]
  }, async (request) => {
    const where = request.partner.cooperativeId
      ? { cooperativeId: request.partner.cooperativeId }
      : {};
    const exports = await app.prisma.export.findMany({ where, include: { events: true } });
    return successEnvelope(exports);
  });
};
