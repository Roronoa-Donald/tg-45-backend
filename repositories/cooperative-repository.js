async function createCooperative(prisma, data) {
  return prisma.cooperative.create({ data });
}

async function addMember(prisma, cooperativeId, userId, role) {
  return prisma.cooperativeMember.create({
    data: {
      cooperativeId,
      userId,
      role
    }
  });
}

async function removeMember(prisma, cooperativeId, userId) {
  return prisma.cooperativeMember.delete({
    where: { cooperativeId_userId: { cooperativeId, userId } }
  });
}

async function getMembers(prisma, cooperativeId) {
  return prisma.cooperativeMember.findMany({
    where: { cooperativeId },
    include: { user: true }
  });
}

module.exports = {
  createCooperative,
  addMember,
  removeMember,
  getMembers
};
