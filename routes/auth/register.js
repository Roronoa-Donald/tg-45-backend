const bcrypt = require('bcrypt');
const { registerSchema } = require('../../schemas/auth-schema');
const { parseOrThrow } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const { USER_ROLES } = require('../../config/constants');
const { AppError } = require('../../utils/errors');
const env = require('../../config/env');
const userRepository = require('../../repositories/user-repository');

module.exports = async function registerRoute(app) {
  app.post('/register', {
  }, async (request) => {
    const payload = parseOrThrow(registerSchema, request.body);

    if (payload.role && payload.role !== USER_ROLES.FARMER) {
      throw new AppError('forbidden', 'Only farmer self-registration allowed', 403);
    }

    const hash = await bcrypt.hash(payload.secret, env.bcryptSaltRounds);

    const user = await userRepository.createUser(app.prisma, {
      role: USER_ROLES.FARMER,
      name: payload.name,
      phone: payload.phone || null,
      email: payload.email || null,
      passwordHash: hash,
      status: 'active'
    });

    // create or upsert farmer profile
    await app.prisma.farmerProfile.upsert({
      where: { userId: user.id },
      update: { farmName: payload.farmName || `${payload.name} Farm`, location: payload.location || null, language: payload.language || 'fr' },
      create: { userId: user.id, farmName: payload.farmName || `${payload.name} Farm`, location: payload.location || null, language: payload.language || 'fr' }
    });

    return successEnvelope({ id: user.id, role: user.role });
  });
};
