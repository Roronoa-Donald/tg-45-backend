const dotenv = require('dotenv');

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.NODE_ENV === 'production' ? '0.0.0.0' : (process.env.HOST || '0.0.0.0'),
  port: Number(process.env.PORT || 4000),
  logLevel: process.env.LOG_LEVEL || 'info',
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || ''
  },
  polygon: {
    rpcUrl: process.env.POLYGON_RPC_URL || '',
    walletPrivateKey: process.env.WALLET_PRIVATE_KEY || '',
    confirmations: Number(process.env.WALLET_CONFIRMATIONS || 1)
  },
  rateLimits: {
    public: Number(process.env.PUBLIC_RATE_LIMIT || 60),
    internal: Number(process.env.INTERNAL_RATE_LIMIT || 240)
  },
  webhook: {
    maxRetries: Number(process.env.WEBHOOK_MAX_RETRIES || 5),
    retryDelayMs: Number(process.env.WEBHOOK_RETRY_DELAY_MS || 5000)
  }
};

module.exports = env;
