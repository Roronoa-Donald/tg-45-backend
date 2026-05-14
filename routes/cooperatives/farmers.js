const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES } = require('../../config/constants');
const { AppError } = require('../../utils/errors');
const { parseOrThrow } = require('../../utils/schema');
const { z } = require('zod');
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

    const pendingMemberships = await app.prisma.cooperativeMember.findMany({
      where: {
        cooperativeId: id,
        role: 'pending'
      },
      include: {
        user: {
          include: { farmerProfile: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return successEnvelope(pendingMemberships.map(m => ({
      id: m.user.id,
      name: m.user.name,
      phone: m.user.phone,
      email: m.user.email,
      farmName: m.user.farmerProfile?.farmName,
      location: m.user.farmerProfile?.location,
      createdAt: m.createdAt
    })));
  });

  // Approve a pending farmer (accept-join)
  app.put('/:id/farmers/:farmerId/accept-join', {
    preHandler: [authenticate, requireRole([USER_ROLES.COOPERATIVE])]
  }, async (request) => {
    const { id, farmerId } = request.params;
    
    if (request.user.cooperativeId !== id) {
      throw new AppError('forbidden', 'You can only approve farmers for your own cooperative', 403);
    }

    const membership = await app.prisma.cooperativeMember.findUnique({
      where: {
        cooperativeId_userId: { cooperativeId: id, userId: farmerId }
      }
    });

    if (!membership || membership.role !== 'pending') {
      throw new AppError('not_found', 'Pending join request not found', 404);
    }

    // Update membership role and also link user's cooperativeId
    // CO-009: Also link farmer's existing orphan lots to the cooperative
    await app.prisma.$transaction([
      app.prisma.cooperativeMember.update({
        where: { id: membership.id },
        data: { role: 'active' }
      }),
      app.prisma.user.update({
        where: { id: farmerId },
        data: { cooperativeId: id }
      }),
      app.prisma.lot.updateMany({
        where: { ownerId: farmerId, cooperativeId: null },
        data: { cooperativeId: id }
      })
    ]);

    await auditService.log(app.prisma, {
      actorId: request.user.sub,
      action: 'approve_farmer_join',
      targetType: 'user',
      targetId: farmerId,
      requestId: request.id,
      details: { cooperativeId: id }
    });

    return successEnvelope({ success: true });
  });

  // Farmer sends a join request to a cooperative
  app.post('/:id/join-request', {
    preHandler: [authenticate, requireRole([USER_ROLES.FARMER])]
  }, async (request) => {
    const params = parseOrThrow(z.object({ id: z.string().uuid() }), request.params);
    const { id } = params;
    const farmerId = request.user.sub;

    if (!farmerId || !z.string().uuid().safeParse(farmerId).success) {
      throw new AppError('invalid_user', 'Utilisateur invalide', 400);
    }

    if (request.user.cooperativeId && request.user.cooperativeId !== id) {
      throw new AppError('already_in_cooperative', 'Vous appartenez deja a une cooperative', 400, {
        cooperativeId: request.user.cooperativeId
      });
    }

    const coop = await app.prisma.cooperative.findUnique({ where: { id } });
    if (!coop) throw new AppError('not_found', 'Cooperative not found', 404);

    const existing = await app.prisma.cooperativeMember.findUnique({
      where: { cooperativeId_userId: { cooperativeId: id, userId: farmerId } }
    });

    if (existing) {
      throw new AppError('already_exists', 'Join request already sent or active', 400);
    }

    let membership;
    try {
      membership = await app.prisma.cooperativeMember.create({
        data: {
          cooperativeId: id,
          userId: farmerId,
          role: 'pending'
        }
      });
    } catch (err) {
      if (err && err.code === 'P2002') {
        throw new AppError('already_exists', 'Join request already sent or active', 400);
      }
      if (err && err.code === 'P2003') {
        throw new AppError('invalid_reference', 'Cooperative ou utilisateur invalide', 400);
      }
      throw err;
    }

    await auditService.log(app.prisma, {
      actorId: farmerId,
      action: 'request_join_cooperative',
      targetType: 'cooperative',
      targetId: id,
      requestId: request.id
    });

    return successEnvelope(membership);
  });
};
