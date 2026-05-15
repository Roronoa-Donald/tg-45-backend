const QRCode = require('qrcode');
const crypto = require('crypto');
const { AppError } = require('../utils/errors');

/**
 * Génère un token unique pour un agriculteur
 */
function generateFarmerToken(userId) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `FARMER-${userId}-${timestamp}-${random}`;
}

/**
 * Génère un QR code pour un agriculteur
 */
async function generateFarmerQR(prisma, userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      cooperativeId: true,
      status: true
    }
  });

  if (!user) {
    throw new AppError('not_found', 'User not found', 404);
  }

  if (user.role !== 'farmer') {
    throw new AppError('invalid_role', 'User is not a farmer', 400);
  }

  if (user.status !== 'active') {
    throw new AppError('inactive_user', 'Farmer account is not active', 403);
  }

  // Générer un token unique
  const token = generateFarmerToken(userId);

  // Sauvegarder le token dans la base
  await prisma.user.update({
    where: { id: userId },
    data: { farmerQrToken: token }
  });

  // Données encodées dans le QR
  const qrData = {
    type: 'FARMER_CARD',
    token,
    userId: user.id,
    name: user.name,
    phone: user.phone,
    cooperativeId: user.cooperativeId,
    generatedAt: new Date().toISOString(),
  };

  // Générer le QR code en Data URL
  const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 300,
    margin: 1,
  });

  return {
    token,
    qrCodeDataUrl,
    qrData,
  };
}

/**
 * Vérifie un token QR et retourne l'utilisateur
 */
async function verifyFarmerQR(prisma, token) {
  if (!token || typeof token !== 'string') {
    throw new AppError('invalid_token', 'Token is required and must be a string', 400);
  }

  const user = await prisma.user.findFirst({
    where: { farmerQrToken: token },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      status: true,
      cooperativeId: true,
      cooperative: { select: { id: true, name: true } }
    }
  });

  if (!user) {
    throw new AppError('invalid_qr', 'Invalid or expired QR token', 401);
  }

  if (user.status !== 'active') {
    throw new AppError('inactive_account', 'Farmer account is not active', 403);
  }

  return user;
}

/**
 * Regénère un QR code (invalide l'ancien)
 */
async function regenerateFarmerQR(prisma, userId) {
  return generateFarmerQR(prisma, userId);
}

/**
 * Révoque un QR code (supprime le token)
 */
async function revokeFarmerQR(prisma, userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { farmerQrToken: null }
  });

  return { success: true, message: 'QR code revoked' };
}

module.exports = {
  generateFarmerQR,
  verifyFarmerQR,
  regenerateFarmerQR,
  revokeFarmerQR,
};
