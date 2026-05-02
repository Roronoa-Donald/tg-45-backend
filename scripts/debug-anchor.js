const env = require('../config/env');
const { ethers } = require('ethers');
const blockchainService = require('../services/blockchain-service');

async function run() {
  const enabled = Boolean(env.polygon.rpcUrl && env.polygon.walletPrivateKey);
  console.log('blockchain enabled:', enabled);
  if (!enabled) return;

  const provider = new ethers.JsonRpcProvider(env.polygon.rpcUrl);
  const wallet = new ethers.Wallet(env.polygon.walletPrivateKey, provider);
  const blockchain = { enabled: true, provider, wallet, confirmations: env.polygon.confirmations };

  try {
    console.log('wallet address:', wallet.address);
    const proof = await blockchainService.anchorProof(blockchain, {
      lotId: 'debug-1',
      lotCode: 'DEBUG1',
      actorId: 'debug-user',
      requestId: 'debug-req'
    });
    console.log('anchor result:', proof);
  } catch (err) {
    console.error('debug anchor failed', err);
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
