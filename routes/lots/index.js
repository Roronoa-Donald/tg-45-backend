const { lotRegisterSchema, lotQuerySchema } = require('../../schemas/lot-schema');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { USER_ROLES } = require('../../config/constants');
const idempotencyService = require('../../services/idempotency-service');
const lotService = require('../../services/lot-service');

module.exports = async function lotRoutes(app) {
  app.post('/register', {
    preHandler: [authenticate, requireRole([USER_ROLES.FARMER])],
  }, async (request) => {
    const payload = parseOrThrow(lotRegisterSchema, request.body);
    const key = request.headers['idempotency-key'];

    if (key) {
      const result = await idempotencyService.begin(
        app.prisma,
        key,
        'POST /lots/register',
        request.user.sub,
        payload
      );
      if (result.replay) {
        return result.response;
      }
    }

    const lot = await lotService.registerLot(
      app.prisma,
      payload,
      request.user.sub,
      app.blockchain,
      request.id
    );

    const response = successEnvelope(lot);

    if (key) {
      await idempotencyService.complete(app.prisma, key, response);
    }

    return response;
  });

  app.get('/', {
    preHandler: [authenticate],
  }, async (request) => {
    const pagination = parsePagination(request.query || {});
    const ownerId = request.user.role === 'farmer' ? request.user.sub : undefined;
    const { total, items } = await lotService.listLots(
      app.prisma, 
      { ...request.query, ownerId },
      pagination
    );
    return successEnvelope(items, buildMeta(pagination.page, pagination.pageSize, total));
  });

  app.get('/:id', {
    preHandler: [authenticate]
  }, async (request) => {
    const lot = await lotService.getLot(app.prisma, request.params.id);
    return successEnvelope(lot);
  });

  await app.register(require('./images'));
  await app.register(require('./events'));
  await app.register(require('./transfer'));
};
