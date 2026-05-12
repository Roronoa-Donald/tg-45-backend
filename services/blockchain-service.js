const { ethers } = require('ethers');

function buildProofHash(payload) {
  const message = JSON.stringify(payload);
  return ethers.keccak256(ethers.toUtf8Bytes(message));
}

async function anchorProof(blockchain, payload) {
  const proofHash = buildProofHash(payload);
  if (!blockchain || !blockchain.enabled) {
    return { proofHash, txHash: null };
  }
  try {
    // Put the proofHash in the transaction data field and send a minimal tx
    // to our own address so the network records the proofHash on-chain.
    const txResponse = await blockchain.wallet.sendTransaction({
      to: blockchain.wallet.address,
      data: proofHash,
      value: 0
    });

    // wait for configured confirmations (may be 0/1 in dev)
    const confirms = blockchain.confirmations || 1;
    await txResponse.wait(confirms);

    return { proofHash, txHash: txResponse.hash };
  } catch (err) {
    // In case of any broadcasting error, return proofHash but no txHash
    // so the rest of the app can proceed while we surface the error in logs.
    // eslint-disable-next-line no-console
    console.error('anchorProof broadcast failed:', {
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
