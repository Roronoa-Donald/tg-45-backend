const { z } = require('zod');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { USER_ROLES } = require('../../config/constants');
const lotVerificationService = require('../../services/lot-verification-service');
const auditService = require('../../services/audit-service');

const voteSchema = z.object({
  vote: z.enum(['approve', 'reject']),
  reason: z.string().optional()
});

const contestSchema = z.object({
  reason: z.string().min(10)
});

module.exports = async function lotVerificationRoutes(app) {
  app.get('/pending', {
    preHandler: [authenticate, requireRole([USER_ROLES.VERIFIER])]
  }, async (request) => {
    const pagination = parsePagination(request.query || {});
    const { total, items } = await lotVerificationService.getPendingLots(
      app.prisma,
      request.user.sub,
      pagination
    );
    return successEnvelope(items, buildMeta(pagination.page, pagination.pageSize, total));
  });

  app.get('/auto-validated', {
    preHandler: [authenticate, requireRole([USER_ROLES.VERIFIER])]
  }, async (request) => {
    const pagination = parsePagination(request.query || {});
    const { total, items } = await lotVerificationService.getAutoValidatedLots(
      app.prisma,
      request.user.sub,
      pagination
    );
    return successEnvelope(items, buildMeta(pagination.page, pagination.pageSize, total));
  });

  app.get('/spot-check', {
    preHandler: [authenticate, requireRole([USER_ROLES.VERIFIER])]
  }, async (request) => {
    const pagination = parsePagination(request.query || {});
    const { total, items } = await lotVerificationService.getSpotCheckLots(
      app.prisma,
      request.user.sub,
      pagination
    );
    return successEnvelope(items, buildMeta(pagination.page, pagination.pageSize, total));
  });

  app.post('/:lotId/vote', {
    preHandler: [authenticate, requireRole([USER_ROLES.VERIFIER])]
  }, async (request) => {
    const payload = parseOrThrow(voteSchema, request.body);
    const result = await lotVerificationService.voteLot(
      app.prisma,
      request.params.lotId,
      request.user.sub,
      payload.vote,
      payload.reason
    );

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: `vote_lot_${payload.vote}`,
      targetType: 'lot',
      targetId: request.params.lotId,
      requestId: request.id,
      details: { vote: payload.vote, reason: payload.reason }
    });

    return successEnvelope(result);
  });

  app.post('/:lotId/contest', {
    preHandler: [authenticate, requireRole([USER_ROLES.VERIFIER])]
  }, async (request) => {
    const payload = parseOrThrow(contestSchema, request.body);
    const result = await lotVerificationService.contestAutoValidation(
      app.prisma,
      request.params.lotId,
      request.user.sub,
      payload.reason
    );

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'contest_auto_validation',
      targetType: 'lot',
      targetId: request.params.lotId,
      requestId: request.id,
      details: { reason: payload.reason }
    });

    return successEnvelope(result);
  });
};
