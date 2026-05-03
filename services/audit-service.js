const { parsePagination, buildMeta } = require('../utils/pagination');

async function log(prisma, payload) {
  return prisma.auditLog.create({
    data: {
      actorId: payload.actorId,
      action: payload.action,
      targetType: payload.targetType,
      targetId: payload.targetId,
      requestId: payload.requestId,
      details: payload.details || {}
    }
  });
}

async function list(prisma, query) {
  const { page, pageSize, skip } = parsePagination(query);
  const where = {};

  if (query.actorId) {
    where.actorId = query.actorId;
  }

  if (query.action) {
    where.action = query.action;
  }

  if (query.date) {
    const startOfDay = new Date(query.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(query.date);
    endOfDay.setHours(23, 59, 59, 999);
    where.createdAt = { gte: startOfDay, lte: endOfDay };
  }

  if (query.role || query.search) {
    where.actor = {};
    if (query.role) {
      where.actor.role = query.role;
    }
    if (query.search) {
      where.actor.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } }
      ];
    }
  }

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        actor: {
          select: { name: true, email: true, role: true }
        }
      }
    })
  ]);

  return { items, meta: buildMeta(page, pageSize, total) };
}

module.exports = { log, list };
