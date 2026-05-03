const { v2: cloudinary } = require('cloudinary');
const fp = require('fastify-plugin');
const env = require('../config/env');
const { AppError } = require('../utils/errors');

async function storagePlugin(app) {
  const isCloudinaryConfigured =
    env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret;
    
  const enabled = isCloudinaryConfigured || env.nodeEnv !== 'production';

  if (isCloudinaryConfigured) {
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

    if (!isCloudinaryConfigured && env.nodeEnv !== 'production') {
      // Return a beautiful mock image of cocoa beans for local development
      return {
        secure_url: 'https://images.unsplash.com/photo-1587049352847-4d4b1ed74dd4?auto=format&fit=crop&q=80&w=800',
        url: 'https://images.unsplash.com/photo-1587049352847-4d4b1ed74dd4?auto=format&fit=crop&q=80&w=800',
        public_id: `mock_image_${Date.now()}`
      };
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
        if (err) {
          if (env.nodeEnv !== 'production') {
            app.log.warn(`Cloudinary upload failed: ${err.message}. Falling back to mock image.`);
            return resolve({
              secure_url: 'https://images.unsplash.com/photo-1587049352847-4d4b1ed74dd4?auto=format&fit=crop&q=80&w=800',
              url: 'https://images.unsplash.com/photo-1587049352847-4d4b1ed74dd4?auto=format&fit=crop&q=80&w=800',
              public_id: `mock_image_${Date.now()}`
            });
          }
          return reject(err);
        }
        resolve(result);
      });

      stream.end(buffer);
    });
  }

  async function uploadAudio(buffer, options = {}) {
    if (!enabled) {
      throw new AppError('storage_unavailable', 'Cloudinary not configured', 503);
    }

    if (!isCloudinaryConfigured && env.nodeEnv !== 'production') {
      return {
        secure_url: 'https://mock.cloudinary.com/audio/mock_audio.webm',
        url: 'http://mock.cloudinary.com/audio/mock_audio.webm',
        public_id: `mock_audio_${Date.now()}`
      };
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ ...options, resource_type: 'video' }, (err, result) => {
        if (err) {
          if (env.nodeEnv !== 'production') {
            app.log.warn(`Cloudinary audio upload failed: ${err.message}. Falling back to mock audio.`);
            return resolve({
              secure_url: 'https://mock.cloudinary.com/audio/mock_audio.webm',
              url: 'http://mock.cloudinary.com/audio/mock_audio.webm',
              public_id: `mock_audio_${Date.now()}`
            });
          }
          return reject(err);
        }
        resolve(result);
      });

      stream.end(buffer);
    });
  }

  app.decorate('storage', { enabled, uploadBuffer, uploadAudio });
}

module.exports = fp(storagePlugin);
