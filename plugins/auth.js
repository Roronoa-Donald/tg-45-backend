const jwt = require('@fastify/jwt');
const fp = require('fastify-plugin');
const env = require('../config/env');
const { AppError } = require('../utils/errors');

async function authPlugin(app) {
  await app.register(jwt, {
    secret: env.jwtSecret
  });

  app.decorate('authenticate', async (request) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      throw new AppError('unauthorized', 'Unauthorized', 401);
    }
  });
}

module.exports = fp(authPlugin);
