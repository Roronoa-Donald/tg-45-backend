const { ethers } = require('ethers');
const env = require('../config/env');

module.exports = async function blockchainPlugin(app) {
  const enabled = Boolean(env.polygon.rpcUrl && env.polygon.walletPrivateKey);
  let provider = null;
  let wallet = null;

  if (enabled) {
    provider = new ethers.JsonRpcProvider(env.polygon.rpcUrl);
    wallet = new ethers.Wallet(env.polygon.walletPrivateKey, provider);
  }

  app.decorate('blockchain', {
    enabled,
    provider,
    wallet,
    confirmations: env.polygon.confirmations
  });
};
