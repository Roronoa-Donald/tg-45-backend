const { z } = require('zod');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { USER_ROLES } = require('../../config/constants');
const { AppError } = require('../../utils/errors');
const parcelValidationService = require('../../services/parcel-validation-service');
const auditService = require('../../services/audit-service');

const addPhotoSchema = z.object({
  url: z.string().url(),
  gpsLat: z.number(),
  gpsLng: z.number(),
  takenAt: z.string().datetime().optional()
});

const validateSchema = z.object({
  approve: z.boolean(),
  reason: z.string().optional()
});

module.exports = async function parcelValidationRoutes(app) {
  app.get('/pending', {
    preHandler: [authenticate, requireRole([USER_ROLES.VERIFIER])]
  }, async (request) => {
    const pagination = parsePagination(request.query || {});
    const { total, items } = await parcelValidationService.getPendingParcels(
      app.prisma,
      request.user.sub,
      pagination
    );
    return successEnvelope(items, buildMeta(pagination.page, pagination.pageSize, total));
  });

  app.post('/:validationId/photos', {
    preHandler: [authenticate, requireRole([USER_ROLES.VERIFIER])]
  }, async (request) => {
    const payload = parseOrThrow(addPhotoSchema, request.body);
    const photo = await parcelValidationService.addValidationPhoto(
      app.prisma,
      request.params.validationId,
      request.user.sub,
      payload
    );

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'add_parcel_validation_photo',
      targetType: 'parcel_validation',
      targetId: request.params.validationId,
      requestId: request.id,
      details: { photoId: photo.id, isInsideParcel: photo.isInsideParcel }
    });

    return successEnvelope(photo);
  });

  app.post('/:validationId/validate', {
    preHandler: [authenticate, requireRole([USER_ROLES.VERIFIER])]
  }, async (request) => {
    const payload = parseOrThrow(validateSchema, request.body);
    const validation = await parcelValidationService.validateParcel(
      app.prisma,
      request.params.validationId,
      request.user.sub,
      payload.approve,
      payload.reason
    );

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: payload.approve ? 'validate_parcel' : 'reject_parcel',
      targetType: 'parcel_validation',
      targetId: request.params.validationId,
      requestId: request.id,
      details: { status: validation.status, reason: payload.reason }
    });

    return successEnvelope(validation);
  });

  app.get('/:parcelId/history', {
    preHandler: [authenticate, requireRole([USER_ROLES.VERIFIER, USER_ROLES.COOPERATIVE, USER_ROLES.MINISTRY, USER_ROLES.FARMER])]
  }, async (request) => {
    // Verify user has access to this parcel
    const parcel = await app.prisma.parcel.findUnique({
      where: { id: request.params.parcelId },
      select: { id: true, ownerId: true, cooperativeId: true }
    });

    if (!parcel) {
      throw new AppError('not_found', 'Parcel not found', 404);
    }

    // Ministry can view all parcels
    // Verifier can view all parcels (they may need to verify any parcel)
    // Cooperative can only view parcels belonging to their cooperative or their farmers
    // Farmer can only view their own parcels
    const userRole = request.user.role;
    const userId = request.user.sub;
    const userCooperativeId = request.user.cooperativeId;

    if (userRole === USER_ROLES.FARMER && parcel.ownerId !== userId) {
      throw new AppError('forbidden', 'Cannot view this parcel history', 403);
    }

    if (userRole === USER_ROLES.COOPERATIVE) {
      // Cooperative can view parcels of their cooperative or their farmers
      if (parcel.cooperativeId !== userCooperativeId) {
        // Check if parcel owner belongs to the cooperative
        const owner = await app.prisma.user.findUnique({
          where: { id: parcel.ownerId },
          select: { cooperativeId: true }
        });
        if (!owner || owner.cooperativeId !== userCooperativeId) {
          throw new AppError('forbidden', 'Cannot view this parcel history', 403);
        }
      }
    }

    const history = await parcelValidationService.getValidationHistory(
      app.prisma,
      request.params.parcelId
    );
    return successEnvelope(history);
  });
};
