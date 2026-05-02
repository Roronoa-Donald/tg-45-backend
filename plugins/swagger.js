const swagger = require('@fastify/swagger');
const swaggerUi = require('@fastify/swagger-ui');

module.exports = async function swaggerPlugin(app) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'TG45 API',
        version: '0.1.0'
      }
    }
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs'
  });
};
