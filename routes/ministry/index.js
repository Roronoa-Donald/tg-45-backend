const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES, LOT_STATUS } = require('../../config/constants');
const { AppError } = require('../../utils/errors');
const auditService = require('../../services/audit-service');

module.exports = async function ministryRoutes(app) {
  // 1. Dashboard KPIs
  app.get('/kpis', {
    preHandler: [authenticate, requireRole([USER_ROLES.MINISTRY])]
  }, async (request) => {
    // Total lots certified
    const certifiedLotsCount = await app.prisma.lot.count({
      where: { status: { in: [LOT_STATUS.CERTIFIED, LOT_STATUS.EXPORTED, LOT_STATUS.SHIPPED] } }
    });

    // Total weight certified
    const certifiedLots = await app.prisma.lot.findMany({
      where: { status: { in: [LOT_STATUS.CERTIFIED, LOT_STATUS.EXPORTED, LOT_STATUS.SHIPPED] } },
      select: { weightKg: true }
    });
    const totalWeightKg = certifiedLots.reduce((acc, lot) => acc + Number(lot.weightKg), 0);

    // Total lots exported/shipped
    const exportedLotsCount = await app.prisma.lot.count({
      where: { status: { in: [LOT_STATUS.EXPORTED, LOT_STATUS.SHIPPED] } }
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
        role: { in: [USER_ROLES.COOPERATIVE, USER_ROLES.VERIFIER, USER_ROLES.EXPORTER] },
        status: 'pending'
      },
      orderBy: { createdAt: 'desc' }
    });
    return successEnvelope(pendingUsers);
  });

  // 3. Approve a user
  app.post('/approve-user/:id', {
    preHandler: [authenticate, requireRole([USER_ROLES.MINISTRY])]
  }, async (request) => {
    const { id } = request.params;
    
    const user = await app.prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError('not_found', 'User not found', 404);

    const updated = await app.prisma.user.update({
      where: { id },
      data: { status: 'active' }
    });

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'approve_actor',
      targetType: 'user',
      targetId: id,
      requestId: request.id
    });

    return successEnvelope(updated);
  });
};
