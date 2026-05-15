module.exports = async function authRoutes(app) {
  await app.register(require('./login'));
  await app.register(require('./register'));
  await app.register(require('./onboard'));
  await app.register(require('./pin-reset'));
  await app.register(require('./profile'));
};
