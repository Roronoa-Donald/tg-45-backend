const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES } = require('../../config/constants');
const { AppError } = require('../../utils/errors');
const auditService = require('../../services/audit-service');

module.exports = async function cooperativeFarmersRoutes(app) {
  // Get pending farmers for this cooperative
  app.get('/:id/farmers/pending', {
    preHandler: [authenticate, requireRole([USER_ROLES.COOPERATIVE])]
  }, async (request) => {
    const { id } = request.params;
    
    // Ensure cooperative can only query its own pending farmers
    if (request.user.cooperativeId !== id) {
      throw new AppError('forbidden', 'You can only access your own cooperative data', 403);
    }

    const pendingFarmers = await app.prisma.user.findMany({
      where: {
        cooperativeId: id,
        role: USER_ROLES.FARMER,
        status: 'pending'
      },
      include: {
        farmerProfile: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return successEnvelope(pendingFarmers.map(user => ({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      farmName: user.farmerProfile?.farmName,
      location: user.farmerProfile?.location,
      createdAt: user.createdAt
    })));
  });

  // Approve a pending farmer
  app.put('/:id/farmers/:farmerId/approve', {
    preHandler: [authenticate, requireRole([USER_ROLES.COOPERATIVE])]
  }, async (request) => {
    const { id, farmerId } = request.params;
    
    if (request.user.cooperativeId !== id) {
      throw new AppError('forbidden', 'You can only approve farmers for your own cooperative', 403);
    }

    const farmer = await app.prisma.user.findFirst({
      where: {
        id: farmerId,
        cooperativeId: id,
        role: USER_ROLES.FARMER,
        status: 'pending'
      }
    });

    if (!farmer) {
      throw new AppError('not_found', 'Pending farmer not found for this cooperative', 404);
    }

    const updated = await app.prisma.user.update({
      where: { id: farmerId },
      data: { status: 'active' }
    });

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'approve_farmer',
      targetType: 'user',
      targetId: farmerId,
      requestId: request.id,
      details: { cooperativeId: id }
    });

    return successEnvelope(updated);
  });
};
