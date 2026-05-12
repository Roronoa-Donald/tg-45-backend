const { ethers } = require('ethers');

function buildProofHash(payload) {
  const message = JSON.stringify(payload);
  return ethers.keccak256(ethers.toUtf8Bytes(message));
}

async function anchorProof(blockchain, payload) {
  const proofHash = buildProofHash(payload);
  if (!blockchain || !blockchain.enabled) {
    // eslint-disable-next-line no-console
    console.info('anchorProof skipped: blockchain disabled', {
      lotId: payload.lotId,
      lotCode: payload.lotCode,
      actorId: payload.actorId,
      requestId: payload.requestId
    });
    return { proofHash, txHash: null };
  }
  try {
    const context = {
      lotId: payload.lotId,
      lotCode: payload.lotCode,
      actorId: payload.actorId,
      requestId: payload.requestId,
      proofHash
    };

    // eslint-disable-next-line no-console
    console.info('anchorProof start', context);

    if (!blockchain.provider || !blockchain.wallet) {
      // eslint-disable-next-line no-console
      console.error('anchorProof missing provider or wallet', {
        ...context,
        hasProvider: Boolean(blockchain.provider),
        hasWallet: Boolean(blockchain.wallet)
      });
      return { proofHash, txHash: null };
    }

    try {
      const network = await blockchain.provider.getNetwork();
      // eslint-disable-next-line no-console
      console.info('anchorProof network', {
        ...context,
        chainId: Number(network.chainId),
        name: network.name
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('anchorProof network error', {
        ...context,
        message: err && err.message ? err.message : err,
        code: err && err.code ? err.code : undefined
      });
    }

    try {
      const balance = await blockchain.provider.getBalance(blockchain.wallet.address);
      const nonce = await blockchain.provider.getTransactionCount(blockchain.wallet.address, 'latest');
      // eslint-disable-next-line no-console
      console.info('anchorProof wallet', {
        ...context,
        wallet: blockchain.wallet.address,
        balance: ethers.formatEther(balance),
        nonce
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('anchorProof wallet error', {
        ...context,
        message: err && err.message ? err.message : err,
        code: err && err.code ? err.code : undefined
      });
    }

    // Put the proofHash in the transaction data field and send a minimal tx
    // to our own address so the network records the proofHash on-chain.
    const txResponse = await blockchain.wallet.sendTransaction({
      to: blockchain.wallet.address,
      data: proofHash,
      value: 0
    });

    // eslint-disable-next-line no-console
    console.info('anchorProof tx sent', {
      ...context,
      txHash: txResponse.hash
    });

    // wait for configured confirmations (may be 0/1 in dev)
    const confirms = blockchain.confirmations || 1;
    const receipt = await txResponse.wait(confirms);

    // eslint-disable-next-line no-console
    console.info('anchorProof tx confirmed', {
      ...context,
      txHash: txResponse.hash,
      status: receipt && receipt.status !== undefined ? receipt.status : null,
      blockNumber: receipt && receipt.blockNumber !== undefined ? receipt.blockNumber : null
    });

    return { proofHash, txHash: txResponse.hash };
  } catch (err) {
    // In case of any broadcasting error, return proofHash but no txHash
    // so the rest of the app can proceed while we surface the error in logs.
    // eslint-disable-next-line no-console
    console.error('anchorProof broadcast failed:', {
      lotId: payload.lotId,
      lotCode: payload.lotCode,
      actorId: payload.actorId,
      requestId: payload.requestId,
      proofHash,
      message: err && err.message ? err.message : err,
      code: err && err.code ? err.code : undefined,
      reason: err && err.reason ? err.reason : undefined,
      rpcCode: err && err.code ? err.code : undefined,
      rpcData: err && err.data ? err.data : undefined
    });
    return { proofHash, txHash: null };
  }
}

module.exports = { buildProofHash, anchorProof };
