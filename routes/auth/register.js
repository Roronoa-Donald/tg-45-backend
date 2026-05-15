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

    const allowedRoles = [USER_ROLES.FARMER, USER_ROLES.COOPERATIVE, USER_ROLES.VERIFIER, USER_ROLES.EXPORTER, USER_ROLES.COMPLIANCE];
    const role = payload.role || USER_ROLES.FARMER;

    if (!allowedRoles.includes(role)) {
      throw new AppError('invalid_role', `Rôle non autorisé: ${role}`, 400);
    }

    const hash = await bcrypt.hash(payload.secret, env.bcryptSaltRounds);

    // Farmers are auto-approved, others require ministry approval
    const status = role === USER_ROLES.FARMER ? 'active' : 'pending_approval';

    const user = await userRepository.createUser(app.prisma, {
      role,
      name: payload.name,
      phone: payload.phone || null,
      email: payload.email || null,
      [role === USER_ROLES.FARMER ? 'passwordHash' : 'pinHash']: hash,
      status,
      cooperativeId: payload.cooperativeId || null
    });

    // create or upsert farmer profile if farmer
    if (role === USER_ROLES.FARMER) {
      await app.prisma.farmerProfile.upsert({
        where: { userId: user.id },
        update: { farmName: payload.farmName || `${payload.name} Farm`, location: payload.location || null, language: payload.language || 'fr' },
        create: { userId: user.id, farmName: payload.farmName || `${payload.name} Farm`, location: payload.location || null, language: payload.language || 'fr' }
      });
    }

    return successEnvelope({
      id: user.id,
      role: user.role,
      status: user.status,
      message: status === 'pending_approval' ? 'Inscription en attente d\'approbation du ministère' : 'Inscription réussie'
    });
  });
};
