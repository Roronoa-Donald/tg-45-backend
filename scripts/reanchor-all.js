require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const { ethers } = require('ethers');
const blockchainService = require('../services/blockchain-service');

const prisma = new PrismaClient();

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
    const lots = await prisma.lot.findMany({ where: { blockchainTxHash: null } });
    console.log(`Found ${lots.length} lots needing anchoring.`);

    for (const lot of lots) {
      console.log(`\nReanchoring lot id: ${lot.id}, code: ${lot.lotCode}`);
      
      const proof = await blockchainService.anchorProof(blockchain, {
        lotId: lot.id,
        lotCode: lot.lotCode,
        actorId: 'reanchor-script',
        requestId: `reanchor-${Date.now()}`
      });

      console.log('anchor result:', proof);

      if (proof.txHash) {
        await prisma.lot.update({ 
          where: { id: lot.id }, 
          data: { blockchainTxHash: proof.txHash, blockchainProofHash: proof.proofHash } 
        });
        console.log('✅ Lot updated with txHash');
      } else {
        console.error('❌ Failed to anchor lot', lot.lotCode);
      }
      
      // Delay to avoid RPC rate limit
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\nDone reanchoring.');
  } catch (err) {
    console.error('reanchor failed', err);
  } finally {
    await prisma.$disconnect();
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
