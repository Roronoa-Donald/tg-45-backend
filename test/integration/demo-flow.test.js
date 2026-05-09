const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');

const authPlugin = require('../../plugins/auth');
const lotRoutes = require('../../routes/lots');
const verificationRoutes = require('../../routes/verification');
const publicRoutes = require('../../routes/public');

function createMemoryPrisma() {
  const state = {
    lots: [],
    events: [],
    certifications: [],
    idempotencyKeys: [],
    auditLogs: [],
  };

  const prisma = {
    lot: {
      create: async ({ data }) => {
        const record = {
          id: `lot-${state.lots.length + 1}`,
          events: [],
          images: [],
          certification: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        state.lots.unshift(record);
        return record;
      },
      findUnique: async ({ where, include }) => {
        const record = state.lots.find((lot) => lot.id === where.id);
        if (!record) {
          return null;
        }
        return hydrateLot(record, include);
      },
      findFirst: async ({ where, include }) => {
        const record = state.lots.find((lot) => lot.lotCode === where.lotCode);
        if (!record) {
          return null;
        }
        return hydrateLot(record, include);
      },
      findMany: async ({ where, skip = 0, take = state.lots.length }) => {
        const items = state.lots.filter((lot) => {
          if (where?.status && lot.status !== where.status) {
            return false;
          }

          if (where?.ownerId && lot.ownerId !== where.ownerId) {
            return false;
          }

          return true;
        });

        return items.slice(skip, skip + take);
      },
      count: async ({ where }) => {
        return state.lots.filter((lot) => {
          if (where?.status && lot.status !== where.status) {
            return false;
          }

          if (where?.ownerId && lot.ownerId !== where.ownerId) {
            return false;
          }

          return true;
        }).length;
      },
      update: async ({ where, data }) => {
        const record = state.lots.find((lot) => lot.id === where.id);
        if (!record) {
          throw new Error('Lot not found');
        }

        Object.assign(record, data, { updatedAt: new Date() });
        return record;
      },
    },
    lotEvent: {
      create: async ({ data }) => {
        const record = {
          id: `event-${state.events.length + 1}`,
          occurredAt: new Date(),
          ...data,
        };
        state.events.push(record);

        const lot = state.lots.find((entry) => entry.id === data.lotId);
        if (lot) {
          lot.events = lot.events || [];
          lot.events.push(record);
        }

        return record;
      },
    },
    lotCertification: {
      findUnique: async ({ where }) => state.certifications.find((item) => item.lotId === where.lotId) || null,
      create: async ({ data }) => {
        const record = { id: `cert-${state.certifications.length + 1}`, ...data };
        state.certifications.push(record);
        const lot = state.lots.find((entry) => entry.id === data.lotId);
        if (lot) {
          lot.certification = record;
        }
        return record;
      },
    },
    idempotencyKey: {
      findUnique: async ({ where }) => state.idempotencyKeys.find((item) => item.key === where.key) || null,
      upsert: async ({ where, create }) => {
        const existing = state.idempotencyKeys.find((item) => item.key === where.key);
        if (existing) {
          return existing;
        }
        const record = { id: `idem-${state.idempotencyKeys.length + 1}`, ...create };
        state.idempotencyKeys.push(record);
        return record;
      },
      update: async ({ where, data }) => {
        const record = state.idempotencyKeys.find((item) => item.key === where.key);
        if (!record) {
          throw new Error('Idempotency key not found');
        }
        Object.assign(record, data);
        return record;
      }
    },
    auditLog: {
      create: async ({ data }) => {
        const record = { id: `audit-${state.auditLogs.length + 1}`, ...data };
        state.auditLogs.push(record);
        return record;
      }
    },
    $transaction: async (fn) => fn(prisma),
    $queryRaw: async () => 1,
  };

  function hydrateLot(record, include = {}) {
    return {
      ...record,
      events: include?.events ? [...(record.events || [])].sort((left, right) => new Date(left.occurredAt) - new Date(right.occurredAt)) : record.events || [],
      images: include?.images ? record.images || [] : record.images || [],
      certification: include?.certification ? record.certification || null : record.certification || null,
    };
  }

  return { prisma, state };
}

function createToken(app, payload) {
  return app.jwt.sign(payload, { expiresIn: '1h' });
}

async function createApp() {
  const app = Fastify();
  const { prisma } = createMemoryPrisma();

  app.decorate('prisma', prisma);
  app.decorate('blockchain', { enabled: false });

  await app.register(authPlugin);
  await app.register(lotRoutes, { prefix: '/lots' });
  await app.register(verificationRoutes, { prefix: '/verification' });
  await app.register(publicRoutes, { prefix: '/public' });

  return app;
}

test('demo flow supports register, transfer and public verification', async () => {
  const app = await createApp();
  const farmerId = '11111111-1111-4111-8111-111111111111';
  const cooperativeId = '22222222-2222-4222-8222-222222222222';
  const processorId = '33333333-3333-4333-8333-333333333333';

  const farmerToken = createToken(app, {
    sub: farmerId,
    role: 'farmer',
    cooperativeId,
  });
  const cooperativeToken = createToken(app, {
    sub: cooperativeId,
    role: 'cooperative',
    cooperativeId,
  });

  const registerResponse = await app.inject({
    method: 'POST',
    url: '/lots/register',
    headers: {
      authorization: `Bearer ${farmerToken}`,
      'idempotency-key': 'demo-register-1',
    },
    payload: {
      product: 'Cacao',
      variety: 'Forastero',
      weightKg: 120,
      harvestDate: '2026-05-01T00:00:00.000Z',
      gpsOriginLat: 6.901,
      gpsOriginLng: 0.629,
      gpsPrecisionM: 24,
      cooperativeId,
      draftId: 'draft-1',
      title: 'LOT-DEMO-001',
    },
  });

  assert.equal(registerResponse.statusCode, 200);
  const registeredLot = registerResponse.json().data;
  assert.equal(registeredLot.product, 'Cacao');

  const transferResponse = await app.inject({
    method: 'POST',
    url: `/lots/${registeredLot.id}/transfer`,
    headers: {
      authorization: `Bearer ${cooperativeToken}`,
    },
    payload: {
      newOwnerId: processorId,
    },
  });

  assert.equal(transferResponse.statusCode, 200);
  assert.equal(transferResponse.json().data.ownerId, processorId);

  const listFarmerLots = await app.inject({
    method: 'GET',
    url: '/lots?page=1&pageSize=10',
    headers: {
      authorization: `Bearer ${farmerToken}`,
    },
  });

  assert.equal(listFarmerLots.statusCode, 200);
  assert.equal(listFarmerLots.json().data.length, 0);

  const publicVerify = await app.inject({
    method: 'GET',
    url: `/public/verify/${registeredLot.lotCode}`,
  });

  assert.equal(publicVerify.statusCode, 200);
  const publicBody = publicVerify.json().data;
  assert.equal(publicBody.lotCode, registeredLot.lotCode);
  assert.ok(publicBody.events.length >= 2);

  await app.close();
});

test('verifier can list all lots while farmer sees only own lots', async () => {
  const app = await createApp();
  const farmerId = '44444444-4444-4444-8444-444444444444';
  const verifierId = '55555555-5555-4555-8555-555555555555';
  const cooperativeId = '66666666-6666-4666-8666-666666666666';
  const farmerToken = createToken(app, { sub: farmerId, role: 'farmer', cooperativeId });
  const verifierToken = createToken(app, { sub: verifierId, role: 'verifier' });

  await app.inject({
    method: 'POST',
    url: '/lots/register',
    headers: {
      authorization: `Bearer ${farmerToken}`,
      'idempotency-key': 'demo-register-2',
    },
    payload: {
      product: 'Cacao',
      variety: 'Forastero',
      weightKg: 120,
      harvestDate: '2026-05-01T00:00:00.000Z',
      gpsOriginLat: 6.901,
      gpsOriginLng: 0.629,
      gpsPrecisionM: 24,
      cooperativeId,
      draftId: 'draft-2',
      title: 'LOT-DEMO-002',
    },
  });

  const farmerList = await app.inject({
    method: 'GET',
    url: '/lots?page=1&pageSize=10',
    headers: { authorization: `Bearer ${farmerToken}` },
  });

  const verifierList = await app.inject({
    method: 'GET',
    url: '/lots?page=1&pageSize=10',
    headers: { authorization: `Bearer ${verifierToken}` },
  });

  assert.equal(farmerList.statusCode, 200);
  assert.equal(verifierList.statusCode, 200);
  assert.equal(farmerList.json().data.length, 1);
  assert.equal(verifierList.json().data.length, 1);

  await app.close();
});