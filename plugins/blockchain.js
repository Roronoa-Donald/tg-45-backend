const { ethers } = require('ethers');
const fp = require('fastify-plugin');
const env = require('../config/env');

module.exports = fp(async function blockchainPlugin(app) {
  const enabled = Boolean(env.polygon.rpcUrl && env.polygon.walletPrivateKey);
  let provider = null;
  let wallet = null;

  if (enabled) {
    provider = new ethers.JsonRpcProvider(env.polygon.rpcUrl);
    wallet = new ethers.Wallet(env.polygon.walletPrivateKey, provider);
    const rpcHost = (() => {
      try {
        return new URL(env.polygon.rpcUrl).host;
      } catch {
        return 'unknown';
      }
    })();
    app.log.info({ rpcHost, wallet: wallet.address }, 'blockchain enabled');
  } else {
    app.log.warn({ hasRpc: Boolean(env.polygon.rpcUrl), hasKey: Boolean(env.polygon.walletPrivateKey) }, 'blockchain disabled');
  }

  app.decorate('blockchain', {
    enabled,
    provider,
    wallet,
    confirmations: env.polygon.confirmations
  });
});
