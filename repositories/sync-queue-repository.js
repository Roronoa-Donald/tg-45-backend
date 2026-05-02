async function enqueue(prisma, data) {
  return prisma.syncQueue.create({ data });
}

async function listByUser(prisma, userId) {
  return prisma.syncQueue.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
}

async function updateStatus(prisma, id, status, lastError) {
  return prisma.syncQueue.update({
    where: { id },
    data: { status, lastError }
  });
}

module.exports = {
  enqueue,
  listByUser,
  updateStatus
};
