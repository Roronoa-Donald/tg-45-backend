const { USER_ROLES } = require('../../config/constants');

async function routes(app) {
  const { authenticate } = app;
  const disputeService = require('../../services/dispute-service');

  // Create a dispute
  app.post(
    '/',
    {
      preHandler: [
        authenticate,
        app.requireRole([
          USER_ROLES.COOPERATIVE,
          USER_ROLES.EXPORTER,
          USER_ROLES.VERIFIER,
          USER_ROLES.MINISTRY,
        ]),
      ],
    },
    async (request) => {
      const { lotId, reportedAgainst, reason, evidence } = request.body;

      const dispute = await disputeService.createDispute(app.prisma, {
        lotId,
        reportedBy: request.user.sub,
        reportedAgainst,
        reason,
        evidence,
      });

      return { data: dispute };
    }
  );

  // List disputes
  app.get(
    '/',
    {
      preHandler: [
        authenticate,
        app.requireRole([
          USER_ROLES.COOPERATIVE,
          USER_ROLES.VERIFIER,
          USER_ROLES.EXPORTER,
          USER_ROLES.MINISTRY,
          USER_ROLES.ADMIN,
        ]),
      ],
    },
    async (request) => {
      const filters = {};

      // Non-ministry users only see disputes they're involved in
      if (request.user.role !== USER_ROLES.MINISTRY && request.user.role !== USER_ROLES.ADMIN) {
        // Show disputes where user is reporter OR accused
        // We'll need to modify the query to handle OR logic
        const disputesAsReporter = await disputeService.getDisputes(app.prisma, {
          reportedBy: request.user.sub,
          status: request.query.status,
          lotId: request.query.lotId,
        });

        const disputesAsAccused = await disputeService.getDisputes(app.prisma, {
          reportedAgainst: request.user.sub,
          status: request.query.status,
          lotId: request.query.lotId,
        });

        // Merge and deduplicate
        const allDisputes = [...disputesAsReporter, ...disputesAsAccused];
        const uniqueDisputes = Array.from(
          new Map(allDisputes.map(d => [d.id, d])).values()
        );

        return {
          data: {
            items: uniqueDisputes,
            total: uniqueDisputes.length,
          },
        };
      }

      // Ministry/Admin can see all disputes
      if (request.query.status) filters.status = request.query.status;
      if (request.query.lotId) filters.lotId = request.query.lotId;
      if (request.query.reportedBy) filters.reportedBy = request.query.reportedBy;
      if (request.query.reportedAgainst) filters.reportedAgainst = request.query.reportedAgainst;

      const disputes = await disputeService.getDisputes(app.prisma, filters);
      return {
        data: {
          items: disputes,
          total: disputes.length,
        },
      };
    }
  );

  // Get dispute details
  app.get(
    '/:id',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const dispute = await disputeService.getDisputeById(app.prisma, request.params.id);

      // Check access: must be involved in dispute or be ministry/admin
      const isInvolved =
        dispute.reportedBy === request.user.sub ||
        dispute.reportedAgainst === request.user.sub ||
        request.user.role === USER_ROLES.MINISTRY ||
        request.user.role === USER_ROLES.ADMIN;

      if (!isInvolved) {
        const { AppError } = require('../../utils/errors');
        throw new AppError('forbidden', 'Vous n\'avez pas accès à ce litige', 403);
      }

      return { data: dispute };
    }
  );

  // Update dispute status (Ministry/Admin only)
  app.put(
    '/:id/status',
    {
      preHandler: [
        authenticate,
        app.requireRole([USER_ROLES.MINISTRY, USER_ROLES.ADMIN]),
      ],
    },
    async (request) => {
      const { status, resolution } = request.body;

      const dispute = await disputeService.updateDisputeStatus(
        app.prisma,
        request.params.id,
        status,
        request.user.sub,
        resolution
      );

      return { data: dispute };
    }
  );

  // Get dispute statistics (Ministry/Admin only)
  app.get(
    '/stats/overview',
    {
      preHandler: [
        authenticate,
        app.requireRole([USER_ROLES.MINISTRY, USER_ROLES.ADMIN]),
      ],
    },
    async () => {
      const stats = await disputeService.getStatistics(app.prisma);
      return { data: stats };
    }
  );

  // Add note to dispute (Ministry/Admin only)
  app.post(
    '/:id/notes',
    {
      preHandler: [
        authenticate,
        app.requireRole([USER_ROLES.MINISTRY, USER_ROLES.ADMIN]),
      ],
    },
    async (request) => {
      const { note } = request.body;

      const event = await disputeService.addNote(
        app.prisma,
        request.params.id,
        request.user.sub,
        note
      );

      return { data: event };
    }
  );

  // Add evidence to dispute (reporter or accused)
  app.post(
    '/:id/evidence',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const { evidenceType, evidenceUrl, description, metadata } = request.body;

      const dispute = await disputeService.getDisputeById(app.prisma, request.params.id);

      // Check access: must be reporter or accused
      const canAddEvidence =
        dispute.reportedBy === request.user.sub ||
        dispute.reportedAgainst === request.user.sub;

      if (!canAddEvidence) {
        const { AppError } = require('../../utils/errors');
        throw new AppError('forbidden', 'Seuls les parties peuvent ajouter des preuves', 403);
      }

      const event = await disputeService.addEvidence(
        app.prisma,
        request.params.id,
        request.user.sub,
        { evidenceType, evidenceUrl, description, metadata }
      );

      return { data: event };
    }
  );

  // Assign investigator to dispute (Ministry/Admin only)
  app.post(
    '/:id/assign',
    {
      preHandler: [
        authenticate,
        app.requireRole([USER_ROLES.MINISTRY, USER_ROLES.ADMIN]),
      ],
    },
    async (request) => {
      const { investigatorId } = request.body;

      const dispute = await disputeService.assignInvestigator(
        app.prisma,
        request.params.id,
        investigatorId
      );

      return { data: dispute };
    }
  );

  // Get dispute timeline
  app.get(
    '/:id/timeline',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const dispute = await disputeService.getDisputeById(app.prisma, request.params.id);

      // Check access: must be involved in dispute or be ministry/admin
      const isInvolved =
        dispute.reportedBy === request.user.sub ||
        dispute.reportedAgainst === request.user.sub ||
        request.user.role === USER_ROLES.MINISTRY ||
        request.user.role === USER_ROLES.ADMIN;

      if (!isInvolved) {
        const { AppError } = require('../../utils/errors');
        throw new AppError('forbidden', 'Vous n\'avez pas accès à ce litige', 403);
      }

      const timeline = await disputeService.getDisputeTimeline(app.prisma, request.params.id);

      return { data: timeline };
    }
  );
}

module.exports = routes;
