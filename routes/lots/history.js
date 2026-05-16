const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { successEnvelope } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { USER_ROLES } = require('../../config/constants');

module.exports = async function lotHistoryRoutes(app) {
  // Get all lots history for current user (based on role)
  app.get('/', {
    preHandler: [authenticate]
  }, async (request) => {
    const pagination = parsePagination(request.query || {});
    const where = {};

    // Filter based on role
    if (request.user.role === USER_ROLES.FARMER) {
      where.ownerId = request.user.sub;
    } else if (request.user.role === USER_ROLES.COOPERATIVE) {
      where.OR = [
        { cooperativeId: request.user.cooperativeId },
        { owner: { cooperativeId: request.user.cooperativeId } }
      ];
    } else if (request.user.role === USER_ROLES.VERIFIER) {
      // Verifier can see lots they've been assigned to
      where.verifications = {
        some: { verifierId: request.user.sub }
      };
    }

    // Support status filter
    if (request.query.status) {
      where.status = request.query.status;
    }

    // Support verificationStatus filter
    if (request.query.verificationStatus) {
      where.verificationStatus = request.query.verificationStatus;
    }

    // Support lotCode search
    if (request.query.lotCode) {
      where.lotCode = {
        contains: request.query.lotCode,
        mode: 'insensitive'
      };
    }

    const [total, items] = await Promise.all([
      app.prisma.lot.count({ where }),
      app.prisma.lot.findMany({
        where,
        skip: pagination.skip,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, name: true, phone: true } },
          cooperative: { select: { id: true, name: true } },
          parcels: {
            include: {
              parcel: {
                select: { id: true, name: true, validationStatus: true, validUntil: true, areaHa: true }
              }
            }
          },
          images: { select: { id: true, url: true, isPrimary: true } },
          verifications: {
            select: {
              id: true,
              verifierId: true,
              vote: true,
              createdAt: true,
              verifier: { select: { id: true, name: true } }
            }
          }
        }
      })
    ]);

    return successEnvelope(items, buildMeta(pagination.page, pagination.pageSize, total));
  });

  // Get statistics for current user's lots
  app.get('/stats', {
    preHandler: [authenticate]
  }, async (request) => {
    const where = {};

    if (request.user.role === USER_ROLES.FARMER) {
      where.ownerId = request.user.sub;
    } else if (request.user.role === USER_ROLES.COOPERATIVE) {
      where.OR = [
        { cooperativeId: request.user.cooperativeId },
        { owner: { cooperativeId: request.user.cooperativeId } }
      ];
    } else if (request.user.role === USER_ROLES.VERIFIER) {
      where.verifications = {
        some: { verifierId: request.user.sub }
      };
    }

    const [
      total,
      registered,
      validated,
      certified,
      rejected,
      exported,
      shipped,
      pendingVote,
      autoValidated,
      spotCheck
    ] = await Promise.all([
      app.prisma.lot.count({ where }),
      app.prisma.lot.count({ where: { ...where, status: 'registered' } }),
      app.prisma.lot.count({ where: { ...where, status: 'validated' } }),
      app.prisma.lot.count({ where: { ...where, status: { startsWith: 'certified' } } }),
      app.prisma.lot.count({ where: { ...where, status: 'rejected' } }),
      app.prisma.lot.count({ where: { ...where, status: { contains: 'exported' } } }),
      app.prisma.lot.count({ where: { ...where, status: { contains: 'shipped' } } }),
      app.prisma.lot.count({ where: { ...where, verificationStatus: 'pending_vote' } }),
      app.prisma.lot.count({ where: { ...where, verificationStatus: 'auto_validated' } }),
      app.prisma.lot.count({ where: { ...where, spotCheck: true } })
    ]);

    return successEnvelope({
      total,
      byStatus: {
        registered,
        validated,
        certified,
        rejected,
        exported,
        shipped
      },
      byVerificationStatus: {
        pendingVote,
        autoValidated,
        spotCheck
      }
    });
  });
};
