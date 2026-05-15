const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES, LOT_STATUS } = require('../../config/constants');
const { AppError } = require('../../utils/errors');
const auditService = require('../../services/audit-service');
const reputationService = require('../../services/reputation-service');

module.exports = async function ministryRoutes(app) {
  // 1. Dashboard KPIs
  app.get('/kpis', {
    preHandler: [authenticate, requireRole([USER_ROLES.MINISTRY])]
  }, async (request) => {
    // Total lots certified (status starts with 'certified')
    const certifiedLotsCount = await app.prisma.lot.count({
      where: { status: { startsWith: 'certified' } }
    });

    // Total weight certified
    const certifiedLots = await app.prisma.lot.findMany({
      where: { status: { startsWith: 'certified' } },
      select: { weightKg: true }
    });
    const totalWeightKg = certifiedLots.reduce((acc, lot) => acc + Number(lot.weightKg), 0);

    // Total lots exported/shipped (status contains 'shipped', 'exported', or 'delivered')
    const exportedLotsCount = await app.prisma.lot.count({
      where: {
        OR: [
          { status: { contains: 'shipped' } },
          { status: { contains: 'exported' } },
          { status: { contains: 'delivered' } }
        ]
      }
    });

    // Rejections (by validators or cooperatives)
    const rejectedLotsCount = await app.prisma.lot.count({
      where: { status: LOT_STATUS.REJECTED }
    });

    // Active cooperatives count
    const activeCoopsCount = await app.prisma.user.count({
      where: { role: USER_ROLES.COOPERATIVE, status: 'active' }
    });

    return successEnvelope({
      certifiedLotsCount,
      totalWeightTonnes: totalWeightKg / 1000,
      exportedLotsCount,
      rejectedLotsCount,
      activeCoopsCount
    });
  });

  // 2. Get pending registrations
  app.get('/pending-approvals', {
    preHandler: [authenticate, requireRole([USER_ROLES.MINISTRY])]
  }, async (request) => {
    const pendingUsers = await app.prisma.user.findMany({
      where: {
        role: { in: [USER_ROLES.COOPERATIVE, USER_ROLES.VERIFIER, USER_ROLES.EXPORTER, USER_ROLES.COMPLIANCE] },
        status: 'pending_approval'
      },
      orderBy: { createdAt: 'desc' }
    });
    return successEnvelope({ users: pendingUsers, total: pendingUsers.length });
  });

  // 3. Approve a user
  app.post('/approve-user/:id', {
    preHandler: [authenticate, requireRole([USER_ROLES.MINISTRY])]
  }, async (request) => {
    const { id } = request.params;

    const user = await app.prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError('not_found', 'Utilisateur non trouvé', 404);

    if (user.status !== 'pending_approval') {
      throw new AppError('invalid_state', 'Cet utilisateur n\'est pas en attente d\'approbation', 400);
    }

    const updated = await app.prisma.user.update({
      where: { id },
      data: { status: 'active', loginAttempts: 0, approvalReason: null }
    });

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'approve_actor',
      targetType: 'user',
      targetId: id,
      requestId: request.id,
      details: { role: user.role, email: user.email }
    });

    return successEnvelope(updated);
  });

  // 4. Reject a user
  app.post('/reject-user/:id', {
    preHandler: [authenticate, requireRole([USER_ROLES.MINISTRY])]
  }, async (request) => {
    const { id } = request.params;
    const { reason } = request.body || {};

    const user = await app.prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError('not_found', 'Utilisateur non trouvé', 404);

    if (user.status !== 'pending_approval') {
      throw new AppError('invalid_state', 'Cet utilisateur n\'est pas en attente d\'approbation', 400);
    }

    const updated = await app.prisma.user.update({
      where: { id },
      data: {
        status: 'rejected',
        approvalReason: reason || 'Inscription refusée par le ministère',
        loginAttempts: 0
      }
    });

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'reject_actor',
      targetType: 'user',
      targetId: id,
      requestId: request.id,
      details: { reason: reason || 'Refusé par le ministère', role: user.role, email: user.email }
    });

    return successEnvelope(updated);
  });

  // 5. Get users with critical reputation scores
  app.get('/reputation/critical', {
    preHandler: [authenticate, requireRole([USER_ROLES.MINISTRY, USER_ROLES.ADMIN])]
  }, async () => {
    const criticalUsers = await reputationService.getCriticalUsers(app.prisma);
    return successEnvelope(criticalUsers);
  });

  // 6. Get reputation statistics
  app.get('/reputation/statistics', {
    preHandler: [authenticate, requireRole([USER_ROLES.MINISTRY, USER_ROLES.ADMIN])]
  }, async () => {
    const stats = await reputationService.getStatistics(app.prisma);
    return successEnvelope(stats);
  });

  // 7. Get reputation history for a specific user
  app.get('/reputation/user/:userId', {
    preHandler: [authenticate, requireRole([USER_ROLES.MINISTRY, USER_ROLES.ADMIN])]
  }, async (request) => {
    const { userId } = request.params;
    const limit = request.query.limit ? parseInt(request.query.limit) : 50;
    const history = await reputationService.getHistory(app.prisma, userId, limit);
    return successEnvelope(history);
  });
};
