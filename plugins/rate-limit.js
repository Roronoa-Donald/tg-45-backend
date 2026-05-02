const rateLimit = require('@fastify/rate-limit');
const env = require('../config/env');

module.exports = async function rateLimitPlugin(app) {
  await app.register(rateLimit, {
    max: env.rateLimits.internal,
    timeWindow: '1 minute'
  });
};
