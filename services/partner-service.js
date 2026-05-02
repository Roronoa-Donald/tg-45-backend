const crypto = require('crypto');
const { AppError } = require('../utils/errors');

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateKey() {
  return crypto.randomBytes(24).toString('hex');
}

async function createApiKey(prisma, payload) {
  const plain = generateKey();
  const record = await prisma.apiKey.create({
    data: {
      partnerName: payload.partnerName,
      apiKeyHash: hashKey(plain),
      cooperativeId: payload.cooperativeId || null
    }
  });

  return { record, apiKey: plain };
}

async function verifyApiKey(prisma, plainKey) {
  if (!plainKey) {
    throw new AppError('unauthorized', 'Missing API key', 401);
  }

  const hash = hashKey(plainKey);
  const record = await prisma.apiKey.findFirst({ where: { apiKeyHash: hash, status: 'active' } });
  if (!record) {
    throw new AppError('unauthorized', 'Invalid API key', 401);
  }

  return record;
}

module.exports = {
  createApiKey,
  verifyApiKey
};
