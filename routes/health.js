const env = require('../config/env');
const { successEnvelope } = require('../utils/response');

module.exports = async function healthRoutes(app) {
  app.get('/health', {
    config: {
      rateLimit: {
        max: env.rateLimits.public
      }
    }
  }, async () => {
    return successEnvelope({ status: 'ok' });
  });

  app.get('/ready', async () => {
    if (app.prisma) {
      await app.prisma.$queryRaw`SELECT 1`;
    }
    return successEnvelope({ status: 'ready' });
  });
};
