const bcrypt = require('bcrypt');
const { AppError } = require('../utils/errors');
const { USER_ROLES } = require('../config/constants');
const userRepository = require('../repositories/user-repository');

async function login(prisma, identifier, secret) {
  const user = await userRepository.findByIdentifier(prisma, identifier);
  if (!user) {
    throw new AppError('invalid_credentials', 'Identifiants invalides', 401);
  }

  // Check if user is in pending_approval state
  if (user.status === 'pending_approval') {
    // Return special response for modal display
    throw new AppError('pending_approval', 'pending_approval', 403, {
      status: 'pending_approval',
      message: "Votre compte est en attente d'approbation par le ministère.",
      reason: user.approvalReason || null
    });
  }

  if (user.status === 'rejected') {
    throw new AppError('account_rejected', 'account_rejected', 403, {
      status: 'rejected',
      message: "Votre inscription a été refusée par le ministère.",
      reason: user.approvalReason || null
    });
  }

  if (user.status !== 'active') {
    throw new AppError('account_disabled', 'Compte désactivé', 403);
  }

  const hash = user.pinHash || user.passwordHash;
  if (!hash) {
    throw new AppError('invalid_credentials', 'Identifiants invalides', 401);
  }

  const match = await bcrypt.compare(secret, hash);
  if (!match) {
    // Increment login attempts
    const newAttempts = (user.loginAttempts || 0) + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: newAttempts }
    });

    // Check if max attempts reached
    if (newAttempts >= 3) {
      throw new AppError('max_attempts', 'Trop de tentatives échouées. Compte verrouillé temporairement.', 429);
    }

    throw new AppError('invalid_credentials', `Identifiants invalides (${newAttempts}/3)`, 401);
  }

  // Reset login attempts on successful auth
  if (user.loginAttempts > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0 }
    });
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
