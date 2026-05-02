const { AppError } = require('../utils/errors');

async function upsertProfile(prisma, userId, payload) {
  return prisma.farmerProfile.upsert({
    where: { userId },
    update: payload,
    create: {
      userId,
      ...payload
    }
  });
}

async function getProfile(prisma, userId) {
  const profile = await prisma.farmerProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new AppError('not_found', 'Profile not found', 404);
  }
  return profile;
}

module.exports = {
  upsertProfile,
  getProfile
};
