const { v2: cloudinary } = require('cloudinary');
const env = require('../config/env');
const { AppError } = require('../utils/errors');

module.exports = async function storagePlugin(app) {
  const enabled =
    env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret;

  if (enabled) {
    cloudinary.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret
    });
  }

  async function uploadBuffer(buffer, options = {}) {
    if (!enabled) {
      throw new AppError('storage_unavailable', 'Cloudinary not configured', 503);
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });

      stream.end(buffer);
    });
  }

  app.decorate('storage', { enabled, uploadBuffer });
};
