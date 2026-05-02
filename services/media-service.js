const crypto = require('crypto');
const { AppError } = require('../utils/errors');

async function uploadLotImage(storage, buffer) {
  if (!storage || !storage.enabled) {
    throw new AppError('storage_unavailable', 'Media storage not configured', 503);
  }

  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const result = await storage.uploadBuffer(buffer, { folder: 'lots' });

  return {
    url: result.secure_url || result.url,
    publicId: result.public_id,
    checksum
  };
}

module.exports = { uploadLotImage };
