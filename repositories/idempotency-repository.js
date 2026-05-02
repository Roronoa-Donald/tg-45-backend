async function findByKey(prisma, key) {
  return prisma.idempotencyKey.findUnique({ where: { key } });
}

async function createKey(prisma, data) {
  try {
    return prisma.idempotencyKey.upsert({
      where: { key: data.key },
      update: {}, // Don't update if exists
      create: data
    });
  } catch (error) {
    // Handle race condition: P2002 means another request created it
    if (error.code === 'P2002') {
      return prisma.idempotencyKey.findUnique({
        where: { key: data.key }
      });
    }
    throw error;
  }
}

async function markCompleted(prisma, key, response) {
  return prisma.idempotencyKey.update({
    where: { key },
    data: {
      status: 'completed',
      response
    }
  });
}

module.exports = {
  findByKey,
  createKey,
  markCompleted
};
