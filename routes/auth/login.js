const { loginSchema } = require('../../schemas/auth-schema');
const { parseOrThrow } = require('../../utils/schema');
const { successEnvelope } = require('../../utils/response');
const authService = require('../../services/auth-service');
const env = require('../../config/env');

module.exports = async function loginRoute(app) {
  app.post('/login', {
  }, async (request) => {
    const payload = parseOrThrow(loginSchema, request.body);
    const user = await authService.login(app.prisma, payload.identifier, payload.secret);

    const token = app.jwt.sign({
      sub: user.id,
      role: user.role,
      cooperativeId: user.cooperativeId
    }, { expiresIn: env.jwtExpiresIn });

    return successEnvelope({ token, role: user.role });
  });
};
