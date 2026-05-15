const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES } = require('../../config/constants');
const reputationService = require('../../services/reputation-service');

module.exports = async function reputationRoutes(app) {
  /**
   * GET /reputation/score
   * Obtenir le score de réputation d'un utilisateur
   */
  app.get('/score', {
    preHandler: [authenticate]
  }, async (request) => {
    const userId = request.query.userId || request.user.sub;

    // Seul l'utilisateur lui-même, le ministère et l'admin peuvent voir un score
    if (userId !== request.user.sub &&
        !request.user.role.match(/ministry|admin/)) {
      throw new Error('Unauthorized');
    }

    const score = await reputationService.getScore(app.prisma, userId);
    return successEnvelope(score);
  });

  /**
   * GET /reputation/history
   * Obtenir l'historique des événements de réputation
   */
  app.get('/history', {
    preHandler: [authenticate]
  }, async (request) => {
    const userId = request.query.userId || request.user.sub;
    const limit = parseInt(request.query.limit) || 50;

    // Seul l'utilisateur lui-même, le ministère et l'admin peuvent voir l'historique
    if (userId !== request.user.sub &&
        !request.user.role.match(/ministry|admin/)) {
      throw new Error('Unauthorized');
    }

    const history = await reputationService.getHistory(app.prisma, userId, limit);
    return successEnvelope(history);
  });

  /**
   * GET /reputation/critical
   * Obtenir la liste des utilisateurs avec un score critique
   * Réservé au ministère et aux admins
   */
  app.get('/critical', {
    preHandler: [authenticate, requireRole([USER_ROLES.MINISTRY, USER_ROLES.ADMIN])]
  }, async (request) => {
    const criticalUsers = await reputationService.getCriticalUsers(app.prisma);
    return successEnvelope({ users: criticalUsers });
  });

  /**
   * GET /reputation/statistics
   * Obtenir des statistiques globales sur la réputation
   * Réservé au ministère et aux admins
   */
  app.get('/statistics', {
    preHandler: [authenticate, requireRole([USER_ROLES.MINISTRY, USER_ROLES.ADMIN])]
  }, async (request) => {
    const stats = await reputationService.getStatistics(app.prisma);
    return successEnvelope(stats);
  });
};
