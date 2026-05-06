const bcrypt = require('bcrypt');
const { AppError } = require('../utils/errors');
const { USER_ROLES } = require('../config/constants');
const userRepository = require('../repositories/user-repository');

async function login(prisma, identifier, secret) {
  const user = await userRepository.findByIdentifier(prisma, identifier);
  if (!user) {
    throw new AppError('invalid_credentials', 'Invalid credentials', 401);
  }

  if (user.status === 'pending') {
    throw new AppError('pending_approval', "Votre compte est en attente d'approbation, veuillez patienter.", 403);
  }

  if (user.status === 'rejected') {
    throw new AppError('account_rejected', "Votre inscription a été refusée par le ministère. Veuillez contacter l'administration.", 403);
  }

  if (user.status !== 'active') {
    throw new AppError('account_disabled', 'Account disabled', 403);
  }

  const hash = user.pinHash || user.passwordHash;
  if (!hash) {
    throw new AppError('invalid_credentials', 'Invalid credentials', 401);
  }

  const match = await bcrypt.compare(secret, hash);
  if (!match) {
    throw new AppError('invalid_credentials', 'Invalid credentials', 401);
  }

  return user;
}

async function onboardUser(prisma, payload, bcryptRounds) {
  const allowedRoles = [
    USER_ROLES.COOPERATIVE,
    USER_ROLES.EXPORTER,
    USER_ROLES.VERIFIER
  ];

  if (!allowedRoles.includes(payload.role)) {
    throw new AppError('invalid_role', 'Role not allowed for onboarding', 400);
  }

  const hash = await bcrypt.hash(payload.secret, bcryptRounds);

  return userRepository.createUser(prisma, {
    role: payload.role,
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    pinHash: hash,
    cooperativeId: payload.cooperativeId
  });
}

async function resetPin(prisma, userId, newPin, bcryptRounds) {
  const user = await userRepository.findById(prisma, userId);
  if (!user) {
    throw new AppError('not_found', 'User not found', 404);
  }

  const hash = await bcrypt.hash(newPin, bcryptRounds);
  return userRepository.updateUserPin(prisma, userId, hash);
}

module.exports = {
  login,
  onboardUser,
  resetPin
};
