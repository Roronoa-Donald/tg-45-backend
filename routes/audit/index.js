const { successEnvelope } = require('../../utils/response');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { USER_ROLES } = require('../../config/constants');
const auditService = require('../../services/audit-service');

module.exports = async function auditRoutes(app) {
  app.get('/', {
    preHandler: [authenticate, requireRole([USER_ROLES.SUPPORT, USER_ROLES.ADMIN])]
  }, async (request) => {
    const result = await auditService.list(app.prisma, request.query || {});
    return successEnvelope(result.items, result.meta);
  });
};
