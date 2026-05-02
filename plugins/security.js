const helmet = require('@fastify/helmet');
const cors = require('@fastify/cors');
const fp = require('fastify-plugin');
const env = require('../config/env');

async function securityPlugin(app) {
  await app.register(helmet);
  // If CORS origin is wildcard in env, allow reflect-origin so credentials can still be used.
  const corsOptions = {
    credentials: true,
  };

  if (env.corsOrigin && env.corsOrigin !== '*') {
    corsOptions.origin = env.corsOrigin;
  } else {
    // reflect the request origin (allows credentials) when wildcard is configured
    corsOptions.origin = (origin, cb) => {
      cb(null, true);
    };
  }

  await app.register(cors, corsOptions);
}

module.exports = fp(securityPlugin);
