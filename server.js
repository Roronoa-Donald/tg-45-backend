const { buildApp } = require('./app');
const env = require('./config/env');

async function start() {
  const app = buildApp();

  try {
    await app.listen({ port: env.port, host: env.host });
    app.log.info(`server listening on ${env.host}:${env.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
