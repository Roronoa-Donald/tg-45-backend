require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const { ethers } = require('ethers');
const blockchainService = require('../services/blockchain-service');

const prisma = new PrismaClient();

async function run(lotCode) {
  if (!lotCode) {
    console.error('Usage: node reanchor-lot.js <LOT_CODE>');
    process.exit(2);
  }

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
    const lot = await prisma.lot.findFirst({ where: { lotCode } });
    if (!lot) {
      console.error('Lot not found', lotCode);
      process.exit(3);
    }
    console.log('Found lot id:', lot.id, 'code:', lot.lotCode);

    const proof = await blockchainService.anchorProof(blockchain, {
      lotId: lot.id,
      lotCode: lot.lotCode,
      actorId: 'reanchor-script',
      requestId: `reanchor-${Date.now()}`
    });

    console.log('anchor result:', proof);

    await prisma.lot.update({ where: { id: lot.id }, data: { blockchainTxHash: proof.txHash, blockchainProofHash: proof.proofHash } });

    console.log('Lot updated with txHash and proofHash');
  } catch (err) {
    console.error('reanchor failed', err);
  } finally {
    await prisma.$disconnect();
  }
}

run(process.argv[2]).then(() => process.exit(0)).catch(() => process.exit(1));
