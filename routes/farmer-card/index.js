const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { USER_ROLES } = require('../../config/constants');
const farmerCardService = require('../../services/farmer-card-service');
const { AppError } = require('../../utils/errors');
const { successEnvelope } = require('../../utils/response');

async function routes(app) {

  // Générer une carte QR pour soi-même (farmer)
  app.post('/generate', {
    preHandler: [authenticate, requireRole([USER_ROLES.FARMER])]
  }, async (request) => {
    const result = await farmerCardService.generateFarmerQR(
      app.prisma,
      request.user.sub
    );
    return successEnvelope(result);
  });

  // Régénérer (cooperative/admin peut le faire pour un farmer)
  app.post('/regenerate/:userId', {
    preHandler: [authenticate, requireRole([USER_ROLES.COOPERATIVE, USER_ROLES.ADMIN, USER_ROLES.MINISTRY])]
  }, async (request) => {
    const result = await farmerCardService.regenerateFarmerQR(
      app.prisma,
      request.params.userId
    );
    return successEnvelope(result);
  });

  // Révoquer un QR code
  app.delete('/revoke/:userId', {
    preHandler: [authenticate, requireRole([USER_ROLES.COOPERATIVE, USER_ROLES.ADMIN, USER_ROLES.MINISTRY])]
  }, async (request) => {
    const result = await farmerCardService.revokeFarmerQR(
      app.prisma,
      request.params.userId
    );
    return successEnvelope(result);
  });

  // Vérifier un QR code scanné (nécessite auth pour éviter abus)
  app.post('/verify', {
    preHandler: [authenticate]
  }, async (request) => {
    const { token } = request.body;

    if (!token) {
      throw new AppError('missing_token', 'Token is required', 400);
    }

    const farmer = await farmerCardService.verifyFarmerQR(app.prisma, token);
    return successEnvelope(farmer);
  });

  // Scanner et se connecter avec QR (pas besoin d'auth - endpoint public)
  app.post('/login-with-qr', async (request) => {
    const { token } = request.body;

    if (!token) {
      throw new AppError('missing_token', 'Token is required', 400);
    }

    const farmer = await farmerCardService.verifyFarmerQR(app.prisma, token);

    // Générer un JWT pour la session
    const jwtToken = app.jwt.sign({
      sub: farmer.id,
      role: farmer.role,
      cooperativeId: farmer.cooperativeId,
    });

    return successEnvelope({
      token: jwtToken,
      user: farmer,
    });
  });
}

module.exports = routes;
