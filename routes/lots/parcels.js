const { lotParcelLinkSchema } = require('../../schemas/parcel-schema');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES } = require('../../config/constants');
const { AppError } = require('../../utils/errors');
const parcelService = require('../../services/parcel-service');
const auditService = require('../../services/audit-service');

function canAccessLot(user, lot) {
  if ([USER_ROLES.ADMIN, USER_ROLES.COMPLIANCE].includes(user.role)) {
    return true;
  }
  if (user.role === USER_ROLES.FARMER && lot.ownerId === user.sub) {
    return true;
  }
  if (user.role === USER_ROLES.COOPERATIVE && lot.cooperativeId === user.cooperativeId) {
    return true;
  }
  return false;
}

module.exports = async function lotParcelRoutes(app) {
  app.post('/:id/parcels', {
    preHandler: [authenticate, requireRole([USER_ROLES.FARMER, USER_ROLES.COOPERATIVE, USER_ROLES.ADMIN, USER_ROLES.COMPLIANCE])]
  }, async (request) => {
    const payload = parseOrThrow(lotParcelLinkSchema, request.body);
    const lot = await app.prisma.lot.findUnique({ where: { id: request.params.id } });
    if (!lot) {
      throw new AppError('not_found', 'Lot not found', 404);
    }
    if (!canAccessLot(request.user, lot)) {
      throw new AppError('forbidden', 'Forbidden', 403);
    }

    const link = await parcelService.linkLotParcel(
      app.prisma,
      request.params.id,
      payload.parcelId,
      payload.sharePct
    );

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'link_lot_parcel',
      targetType: 'lot',
      targetId: lot.id,
      requestId: request.id,
      details: { parcelId: payload.parcelId }
    });

    return successEnvelope(link);
  });

  app.get('/:id/parcels', {
    preHandler: [authenticate]
  }, async (request) => {
    const lot = await app.prisma.lot.findUnique({ where: { id: request.params.id } });
    if (!lot) {
      throw new AppError('not_found', 'Lot not found', 404);
    }
    if (!canAccessLot(request.user, lot)) {
      throw new AppError('forbidden', 'Forbidden', 403);
    }

    const parcels = await parcelService.listLotParcels(app.prisma, request.params.id);
    return successEnvelope(parcels);
  });

  app.delete('/:id/parcels/:parcelId', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN, USER_ROLES.COMPLIANCE, USER_ROLES.FARMER, USER_ROLES.COOPERATIVE])]
  }, async (request) => {
    const lot = await app.prisma.lot.findUnique({ where: { id: request.params.id } });
    if (!lot) {
      throw new AppError('not_found', 'Lot not found', 404);
    }
    if (!canAccessLot(request.user, lot)) {
      throw new AppError('forbidden', 'Forbidden', 403);
    }

    const result = await parcelService.unlinkLotParcel(
      app.prisma,
      request.params.id,
      request.params.parcelId
    );

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'unlink_lot_parcel',
      targetType: 'lot',
      targetId: lot.id,
      requestId: request.id,
      details: { parcelId: request.params.parcelId }
    });

    return successEnvelope(result);
  });
};
