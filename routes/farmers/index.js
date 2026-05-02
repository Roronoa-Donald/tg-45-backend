const { farmerProfileSchema } = require('../../schemas/farmer-schema');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { parseOrThrow, jsonSchema } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES } = require('../../config/constants');
const farmerService = require('../../services/farmer-service');
const auditService = require('../../services/audit-service');

module.exports = async function farmerRoutes(app) {
  app.get('/profile', {
    preHandler: [authenticate, requireRole([USER_ROLES.FARMER])]
  }, async (request) => {
    const profile = await farmerService.getProfile(app.prisma, request.user.sub);
    return successEnvelope(profile);
  });

  app.put('/profile', {
    preHandler: [authenticate, requireRole([USER_ROLES.FARMER])],
  }, async (request) => {
    const payload = parseOrThrow(farmerProfileSchema, request.body);
    const profile = await farmerService.upsertProfile(app.prisma, request.user.sub, payload);

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'update_farmer_profile',
      targetType: 'farmer_profile',
      targetId: profile.id,
      requestId: request.id,
      details: {}
    });

    return successEnvelope(profile);
  });
};
