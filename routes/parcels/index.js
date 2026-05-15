const { parcelCreateSchema, parcelUpdateSchema } = require('../../schemas/parcel-schema');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { USER_ROLES } = require('../../config/constants');
const { AppError } = require('../../utils/errors');
const parcelService = require('../../services/parcel-service');
const parcelValidationService = require('../../services/parcel-validation-service');
const auditService = require('../../services/audit-service');

function canAccessParcel(user, parcel) {
  if ([USER_ROLES.ADMIN, USER_ROLES.COMPLIANCE].includes(user.role)) {
    return true;
  }
  if (user.role === USER_ROLES.FARMER && parcel.ownerId === user.sub) {
    return true;
  }
  if (user.role === USER_ROLES.COOPERATIVE && parcel.cooperativeId === user.cooperativeId) {
    return true;
  }
  return false;
}

module.exports = async function parcelRoutes(app) {
  app.post('/', {
    preHandler: [authenticate, requireRole([USER_ROLES.FARMER, USER_ROLES.COOPERATIVE, USER_ROLES.ADMIN, USER_ROLES.COMPLIANCE])]
  }, async (request) => {
    const payload = parseOrThrow(parcelCreateSchema, request.body);
    let ownerId = request.user.sub;
    let cooperativeId = payload.cooperativeId || null;

    if (request.user.role === USER_ROLES.COOPERATIVE) {
      if (!request.user.cooperativeId) {
        throw new AppError('missing_cooperative', 'Cooperative missing', 400);
      }
      if (!payload.ownerId) {
        throw new AppError('owner_required', 'ownerId required for cooperative parcels', 400);
      }

      const membership = await app.prisma.cooperativeMember.findFirst({
        where: {
          cooperativeId: request.user.cooperativeId,
          userId: payload.ownerId,
          role: 'active'
        },
        include: {
          user: { select: { role: true } }
        }
      });

      if (!membership || membership.user.role !== USER_ROLES.FARMER) {
        throw new AppError('forbidden', 'Farmer not in cooperative', 403);
      }

      ownerId = payload.ownerId;
      cooperativeId = request.user.cooperativeId;
    } else if (payload.ownerId) {
      if ([USER_ROLES.ADMIN, USER_ROLES.COMPLIANCE].includes(request.user.role)) {
        ownerId = payload.ownerId;
      } else if (payload.ownerId !== request.user.sub) {
        throw new AppError('forbidden', 'Forbidden', 403);
      }
    }

    const parcel = await parcelService.createParcel(
      app.prisma,
      { ...payload, ownerId, cooperativeId },
      request.user.sub
    );

    // Auto-assign a verifier for terrain validation
    try {
      await parcelValidationService.assignVerifierToParcel(app.prisma, parcel.id);
    } catch (err) {
      console.warn('Could not assign verifier to parcel:', err.message);
    }

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'create_parcel',
      targetType: 'parcel',
      targetId: parcel.id,
      requestId: request.id
    });

    return successEnvelope(parcel);
  });

  app.get('/', {
    preHandler: [authenticate]
  }, async (request) => {
    const pagination = parsePagination(request.query || {});
    const where = {};

    if (request.user.role === USER_ROLES.FARMER) {
      where.ownerId = request.user.sub;
    }
    if (request.user.role === USER_ROLES.COOPERATIVE) {
      where.cooperativeId = request.user.cooperativeId;
    }

    const { total, items } = await parcelService.listParcels(app.prisma, where, pagination);
    return successEnvelope(items, buildMeta(pagination.page, pagination.pageSize, total));
  });

  app.get('/:id', {
    preHandler: [authenticate]
  }, async (request) => {
    const parcel = await parcelService.getParcel(app.prisma, request.params.id);
    if (!canAccessParcel(request.user, parcel)) {
      throw new AppError('forbidden', 'Forbidden', 403);
    }
    return successEnvelope(parcel);
  });

  app.put('/:id', {
    preHandler: [authenticate]
  }, async (request) => {
    const payload = parseOrThrow(parcelUpdateSchema, request.body);
    const parcel = await parcelService.getParcel(app.prisma, request.params.id);
    if (!canAccessParcel(request.user, parcel)) {
      throw new AppError('forbidden', 'Forbidden', 403);
    }

    const updated = await parcelService.updateParcel(app.prisma, request.params.id, payload);

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'update_parcel',
      targetType: 'parcel',
      targetId: updated.id,
      requestId: request.id
    });

    return successEnvelope(updated);
  });

  // Register validation sub-routes
  await app.register(require('./validation'), { prefix: '/validation' });
};
