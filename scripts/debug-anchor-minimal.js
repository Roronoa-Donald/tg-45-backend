const { ethers } = require('ethers');
const blockchainService = require('../services/blockchain-service');

async function run() {
  const rpcUrl = process.env.POLYGON_RPC_URL;
  const pk = process.env.WALLET_PRIVATE_KEY;
  const confirms = Number(process.env.WALLET_CONFIRMATIONS || 1);
  if (!rpcUrl || !pk) {
    console.error('Missing POLYGON_RPC_URL or WALLET_PRIVATE_KEY in env');
    process.exit(2);
  }
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);
  const blockchain = { enabled: true, provider, wallet, confirmations: confirms };

  try {
    console.log('wallet address:', wallet.address);
    const proof = await blockchainService.anchorProof(blockchain, {
      lotId: 'debug-2',
      lotCode: 'DEBUG2',
      actorId: 'debug-user',
      requestId: 'debug-req'
    });
    console.log('anchor result:', proof);
  } catch (err) {
    console.error('debug anchor failed', err);
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
