const fp = require('fastify-plugin');
const multipart = require('@fastify/multipart');

module.exports = fp(async function multipartPlugin(app) {
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }
  });
});
