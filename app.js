const crypto = require('crypto');
const fastify = require('fastify');
const env = require('./config/env');
const { AppError } = require('./utils/errors');
const { errorEnvelope } = require('./utils/response');

function buildApp() {
  const app = fastify({
    logger: {
      level: env.logLevel,
      transport:
        env.nodeEnv === 'development'
          ? {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'SYS:standard' }
            }
          : undefined
    },
    genReqId: () => crypto.randomUUID()
  });

  app.addHook('onRequest', (request, reply, done) => {
    reply.header('x-request-id', request.id);
    done();
  });

  app.decorate('requireRole', (roles) => {
    return async (request) => {
      const userRole = request.user && request.user.role;
      if (!userRole || !roles.includes(userRole)) {
        throw new AppError('forbidden', 'Forbidden', 403);
      }
    };
  });

  app.register(require('./plugins/security'));
  app.register(require('./plugins/multipart'));
  app.register(require('./plugins/rate-limit'));
  app.register(require('./plugins/swagger'));
  app.register(require('./plugins/prisma'));
  app.register(require('./plugins/auth'));
  app.register(require('./plugins/storage'));
  app.register(require('./plugins/blockchain'));

  app.register(require('./routes/health'));
  app.register(require('./routes'));

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof AppError) {
      reply
        .code(err.statusCode)
        .send(errorEnvelope(err.code, err.message, err.details, request.id));
      return;
    }

    if (err.validation) {
      reply
        .code(400)
        .send(errorEnvelope('validation_error', 'Validation error', err.validation, request.id));
      return;
    }

    request.log.error(err);
    reply
      .code(err.statusCode || 500)
      .send(errorEnvelope('internal_error', 'Internal server error', undefined, request.id));
  });

  return app;
}

module.exports = { buildApp };
