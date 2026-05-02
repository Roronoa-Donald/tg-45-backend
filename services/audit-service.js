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

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize
    })
  ]);

  return { items, meta: buildMeta(page, pageSize, total) };
}

module.exports = { log, list };
