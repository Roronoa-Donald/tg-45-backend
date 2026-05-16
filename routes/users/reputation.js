const { authenticate } = require('../../utils/auth-hooks');
const reputationService = require('../../services/reputation-service');

async function routes(app) {
  // Get user reputation score
  app.get(
    '/:userId/reputation',
    {
      preHandler: [authenticate]
    },
    async (request) => {
      const { userId } = request.params;

      // Users can view their own reputation, ministry/admin can view all
      const canView =
        request.user.sub === userId ||
        request.user.role === 'ministry' ||
        request.user.role === 'admin';

      if (!canView) {
        const { AppError } = require('../../utils/errors');
        throw new AppError('forbidden', 'Vous ne pouvez pas voir cette reputation', 403);
      }

      const reputation = await reputationService.getReputation(app.prisma, userId);

      return { data: reputation };
    }
  );

  // Get user reputation history
  app.get(
    '/:userId/reputation/history',
    {
      preHandler: [authenticate]
    },
    async (request) => {
      const { userId } = request.params;

      // Users can view their own history, ministry/admin can view all
      const canView =
        request.user.sub === userId ||
        request.user.role === 'ministry' ||
        request.user.role === 'admin';

      if (!canView) {
        const { AppError } = require('../../utils/errors');
        throw new AppError('forbidden', 'Vous ne pouvez pas voir cet historique', 403);
      }

      const page = parseInt(request.query.page || '1', 10);
      const pageSize = parseInt(request.query.pageSize || '20', 10);

      const history = await reputationService.getReputationHistory(
        app.prisma,
        userId,
        { page, pageSize }
      );

      return {
        data: history.events,
        meta: {
          page,
          pageSize,
          total: history.total
        }
      };
    }
  );

  // Get reputation leaderboard (public - top performers)
  app.get(
    '/leaderboard',
    {
      preHandler: [authenticate]
    },
    async (request) => {
      const limit = parseInt(request.query.limit || '10', 10);
      const role = request.query.role; // Optional: filter by role

      const leaderboard = await reputationService.getLeaderboard(
        app.prisma,
        limit,
        role
      );

      return { data: leaderboard };
    }
  );
}

module.exports = routes;
