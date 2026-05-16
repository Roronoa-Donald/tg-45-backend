const { lotRegisterSchema, lotQuerySchema, lotDetailsSchema } = require('../../schemas/lot-schema');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { USER_ROLES, LOT_STATUS, LOT_EVENT_TYPES } = require('../../config/constants');
const { AppError } = require('../../utils/errors');
const idempotencyService = require('../../services/idempotency-service');
const lotService = require('../../services/lot-service');
const auditService = require('../../services/audit-service');

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
    const query = { ...request.query };

    // Farmers only see their own lots
    if (request.user.role === USER_ROLES.FARMER) {
      query.ownerId = request.user.sub;
    }

    // Cooperatives see lots from their farmers
    if (request.user.role === USER_ROLES.COOPERATIVE) {
      query.cooperativeId = request.user.cooperativeId;
    }

    const { total, items } = await lotService.listLots(
      app.prisma,
      query,
      pagination
    );
    return successEnvelope(items, buildMeta(pagination.page, pagination.pageSize, total));
  });

  app.get('/:id', {
    preHandler: [authenticate]
  }, async (request) => {
    const lot = await lotService.getLot(app.prisma, request.params.id);

    // Ajouter progression de vérification (sans révéler les noms des verificateurs)
    if (lot.verifications && lot.verifications.length > 0) {
      const totalVotes = lot.verifications.length;
      const completedVotes = lot.verifications.filter(v => v.vote !== null).length;
      const approveVotes = lot.verifications.filter(v => v.vote === 'approve').length;
      const rejectVotes = lot.verifications.filter(v => v.vote === 'reject').length;

      lot.verificationProgress = {
        totalVotes,
        completedVotes,
        approveVotes,
        rejectVotes,
        pendingVotes: totalVotes - completedVotes,
        approvalRatio: totalVotes > 0 ? Math.round((approveVotes / totalVotes) * 100) : 0,
        thresholdNeeded: Math.ceil(totalVotes * 0.51),
        status: completedVotes === totalVotes
          ? (approveVotes >= Math.ceil(totalVotes * 0.51) ? 'approved' : 'rejected')
          : 'pending'
      };

      // Supprimer les détails des verifications pour ne garder que la progression
      delete lot.verifications;
    } else {
      lot.verificationProgress = null;
    }

    return successEnvelope(lot);
  });

  app.put('/:id/details', {
    preHandler: [authenticate, requireRole([USER_ROLES.COOPERATIVE])]
  }, async (request) => {
    const payload = parseOrThrow(lotDetailsSchema, request.body);
    const lot = await app.prisma.lot.findUnique({ where: { id: request.params.id } });

    if (!lot || lot.cooperativeId !== request.user.cooperativeId) {
      throw new AppError('not_found', 'Lot not found', 404);
    }

    if (lot.status !== LOT_STATUS.REGISTERED) {
      throw new AppError('invalid_status', 'Lot is not eligible for weighing', 400);
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const updateData = { weightKg: payload.weightKg };
      if (payload.coopProofImageUrl) {
        updateData.coopProofImageUrl = payload.coopProofImageUrl;
      }

      const updatedLot = await tx.lot.update({
        where: { id: lot.id },
        data: updateData
      });

      await tx.lotEvent.create({
        data: {
          lotId: lot.id,
          actorId: request.user.sub,
          eventType: LOT_EVENT_TYPES.UPDATE,
          metadata: { weightKg: payload.weightKg, coopProofImageUrl: payload.coopProofImageUrl }
        }
      });

      return updatedLot;
    });

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'update_lot_weight',
      targetType: 'lot',
      targetId: lot.id,
      requestId: request.id,
      details: { weightKg: payload.weightKg }
    });

    return successEnvelope(updated);
  });

  await app.register(require('./images'));
  await app.register(require('./events'));
  await app.register(require('./transfer'));
  await app.register(require('./parcels'));
  await app.register(require('./verification'), { prefix: '/verification' });
  await app.register(require('./history'), { prefix: '/history' });
};
