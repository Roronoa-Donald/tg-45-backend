const crypto = require('crypto');
const { AppError } = require('../utils/errors');
const repo = require('../repositories/idempotency-repository');

function hashPayload(payload) {
  const input = JSON.stringify(payload || {});
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function begin(prisma, key, route, userId, payload) {
  const existing = await repo.findByKey(prisma, key);
  if (existing) {
    if (existing.status === 'completed') {
      return { replay: true, response: existing.response };
    }
    throw new AppError('idempotency_in_progress', 'Idempotency key already in progress', 409);
  }

  await repo.createKey(prisma, {
    key,
    route,
    userId,
    requestHash: hashPayload(payload),
    status: 'pending'
  });

  return { replay: false };
}

async function complete(prisma, key, response) {
  return repo.markCompleted(prisma, key, response);
}

module.exports = { begin, complete };
