async function findByIdentifier(prisma, identifier) {
  return prisma.user.findFirst({
    where: {
      OR: [{ phone: identifier }, { email: identifier }]
    }
  });
}

async function findById(prisma, userId) {
  return prisma.user.findUnique({ where: { id: userId } });
}

async function createUser(prisma, data) {
  return prisma.user.create({ data });
}

async function updateUserPin(prisma, userId, pinHash) {
  return prisma.user.update({
    where: { id: userId },
    data: { pinHash }
  });
}

async function updateUserStatus(prisma, userId, status) {
  return prisma.user.update({
    where: { id: userId },
    data: { status }
  });
}

module.exports = {
  findByIdentifier,
  findById,
  createUser,
  updateUserPin,
  updateUserStatus
};
