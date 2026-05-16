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

  // DEPRECATED: Auto-validated lots now pass directly to 'certified' status
  // This endpoint is kept for backward compatibility but will return empty results
  app.get('/auto-validated', {
    preHandler: [authenticate, requireRole([USER_ROLES.VERIFIER])]
  }, async (request) => {
    // Return empty array since auto-validated lots are now directly certified
    return successEnvelope([], buildMeta(1, 20, 0));
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

  // Get verification status of a specific lot
  app.get('/:lotId/status', {
    preHandler: [authenticate]
  }, async (request) => {
    const lot = await app.prisma.lot.findUnique({
      where: { id: request.params.lotId },
      select: {
        id: true,
        lotCode: true,
        status: true,
        verificationStatus: true,
        autoValidated: true,
        spotCheck: true,
        voteDeadline: true,
        escalatedAt: true,
        verifications: {
          select: {
            id: true,
            vote: true,
            createdAt: true
            // Ne pas inclure verifierId ni verifier pour masquer les noms
          }
        }
      }
    });

    if (!lot) {
      throw new AppError('not_found', 'Lot not found', 404);
    }

    const totalVotes = lot.verifications.length;
    const completedVotes = lot.verifications.filter(v => v.vote !== null).length;
    const approveVotes = lot.verifications.filter(v => v.vote === 'approve').length;
    const rejectVotes = lot.verifications.filter(v => v.vote === 'reject').length;
    const pendingVotes = lot.verifications.filter(v => v.vote === null).length;
    const thresholdNeeded = Math.ceil(totalVotes * 0.51);

    return successEnvelope({
      lot: {
        id: lot.id,
        lotCode: lot.lotCode,
        status: lot.status,
        verificationStatus: lot.verificationStatus,
        autoValidated: lot.autoValidated,
        spotCheck: lot.spotCheck,
        voteDeadline: lot.voteDeadline,
        escalatedAt: lot.escalatedAt
      },
      verificationProgress: {
        totalVotes,
        completedVotes,
        approveVotes,
        rejectVotes,
        pendingVotes,
        thresholdNeeded,
        approvalRatio: totalVotes > 0 ? Math.round((approveVotes / totalVotes) * 100) : 0,
        approvalPercentage: totalVotes > 0 ? (approveVotes / totalVotes * 100).toFixed(1) + '%' : '0%',
        status: completedVotes === totalVotes
          ? (approveVotes >= thresholdNeeded ? 'approved' : 'rejected')
          : 'pending'
      }
    });
  });
};
