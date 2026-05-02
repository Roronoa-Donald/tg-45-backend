const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const healthRoutes = require('../../routes/health');

test('GET /health returns success envelope', async () => {
  const app = Fastify();
  app.decorate('prisma', { $queryRaw: async () => 1 });
  await app.register(healthRoutes);

  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);

  const body = res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'ok');

  await app.close();
});

test('GET /ready checks prisma and returns ready', async () => {
  let queried = false;
  const app = Fastify();
  app.decorate('prisma', {
    $queryRaw: async () => {
      queried = true;
      return 1;
    }
  });
  await app.register(healthRoutes);

  const res = await app.inject({ method: 'GET', url: '/ready' });
  assert.equal(res.statusCode, 200);

  const body = res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'ready');
  assert.equal(queried, true);

  await app.close();
});
