const { statusUpdateSchema, proofSchema, certificationSchema, batchVerifySchema, querySchema } = require('../../schemas/verification-schema');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow, jsonSchema } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { USER_ROLES } = require('../../config/constants');
const verificationService = require('../../services/verification-service');
const auditService = require('../../services/audit-service');

module.exports = async function verificationRoutes(app) {
  app.post('/:id/status', {
    preHandler: [authenticate, requireRole([USER_ROLES.VERIFIER, USER_ROLES.COOPERATIVE])],
  }, async (request) => {
    const payload = parseOrThrow(statusUpdateSchema, request.body);
    const lot = await verificationService.assignStatus(
      app.prisma,
      request.params.id,
      payload.status,
      request.user.sub,
      payload.reason,
      payload.gps
    );

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'verify_status',
      targetType: 'lot',
      targetId: lot.id,
      requestId: request.id,
      details: { status: payload.status }
    });

    return successEnvelope(lot);
  });

  app.post('/:id/proof', {
    preHandler: [authenticate, requireRole([USER_ROLES.VERIFIER])],
  }, async (request) => {
    const payload = parseOrThrow(proofSchema, request.body);
    const result = await verificationService.submitProof(
      app.prisma,
      request.params.id,
      request.user.sub,
      payload
    );

    return successEnvelope(result);
  });

  app.post('/:id/certify', {
    preHandler: [authenticate, requireRole([USER_ROLES.VERIFIER])],
  }, async (request) => {
    const payload = parseOrThrow(certificationSchema, request.body);
    const certification = await verificationService.certify(
      app.prisma,
      request.params.id,
      request.user.sub,
      payload.signature,
      payload.gps
    );

    return successEnvelope(certification);
  });

  app.post('/batch', {
    preHandler: [authenticate, requireRole([USER_ROLES.VERIFIER])],
  }, async (request) => {
    const payload = parseOrThrow(batchVerifySchema, request.body);
    const results = await verificationService.batchVerify(
      app.prisma,
      payload.lotIds,
      payload.status,
      request.user.sub
    );
    return successEnvelope(results);
  });

  app.get('/lots', {
    preHandler: [authenticate, requireRole([USER_ROLES.VERIFIER])],
  }, async (request) => {
    const pagination = parsePagination(request.query || {});
    const { total, items } = await verificationService.queryLots(app.prisma, request.query || {}, pagination);
    return successEnvelope(items, buildMeta(pagination.page, pagination.pageSize, total));
  });
};
