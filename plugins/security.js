const helmet = require('@fastify/helmet');
const cors = require('@fastify/cors');
const fp = require('fastify-plugin');
const env = require('../config/env');

async function securityPlugin(app) {
  await app.register(helmet);
  await app.register(cors, {
    origin: env.corsOrigin,
    credentials: true
  });
}

module.exports = fp(securityPlugin);
