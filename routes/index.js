module.exports = async function registerRoutes(app) {
  await app.register(require('./auth'), { prefix: '/auth' });
  await app.register(require('./cooperatives'), { prefix: '/cooperatives' });
  await app.register(require('./farmers'), { prefix: '/farmers' });
  await app.register(require('./lots'), { prefix: '/lots' });
  await app.register(require('./verification'), { prefix: '/verification' });
  await app.register(require('./audit'), { prefix: '/audit' });
  await app.register(require('./export'), { prefix: '/exports' });
  await app.register(require('./public'), { prefix: '/public' });
  await app.register(require('./partners'), { prefix: '/partners' });
  await app.register(require('./sync'), { prefix: '/sync' });
  await app.register(require('./admin'), { prefix: '/admin' });
  await app.register(require('./ministry'), { prefix: '/ministry' });
  await app.register(require('./audio-collector'), { prefix: '/audio-collector' });
};
