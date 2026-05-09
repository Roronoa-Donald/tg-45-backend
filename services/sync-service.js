const syncRepo = require('../repositories/sync-queue-repository');
const lotService = require('./lot-service');
const verificationService = require('./verification-service');
const parcelService = require('./parcel-service');
const ddrService = require('./eudr-ddr-service');

/**
 * Process a single sync action immediately.
 * Maps actionType → service call. Falls back to queue if unknown.
 */
async function processAction(prisma, blockchain, userId, action) {
  const { actionType, payload, clientRequestId } = action;

  try {
    let result = null;

    switch (actionType) {
      case 'registerLot':
        result = await lotService.registerLot(prisma, payload, userId, blockchain, clientRequestId);
        break;

      case 'updateVerificationStatus':
        result = await verificationService.assignStatus(
          prisma,
          payload.lotId || payload.id,
          payload.status,
          userId,
          payload.reason,
          payload.gps
        );
        break;

      case 'certifyLot':
        result = await verificationService.certify(
          prisma,
          payload.lotId || payload.id,
          userId,
          payload.certificateHash || payload.signature || `cert-${Date.now()}`,
          payload.gps
        );
        break;

      case 'transferLot':
        result = await lotService.transferLot(
          prisma,
          payload.lotId || payload.id,
          payload.newOwnerId,
          userId
        );
        break;

      case 'createParcel':
        result = await parcelService.createParcel(prisma, payload, userId);
        break;

      case 'updateParcel':
        result = await parcelService.updateParcel(prisma, payload.id, payload);
        break;

      case 'linkLotParcel':
        result = await parcelService.linkLotParcel(
          prisma,
          payload.lotId,
          payload.parcelId,
          payload.sharePct
        );
        break;

      case 'createEudrDdr':
        result = await ddrService.createDueDiligence(prisma, payload, userId);
        break;

      case 'updateEudrDdr':
        result = await ddrService.updateDueDiligence(prisma, payload.id, payload);
        break;

      default:
        // Unknown action: store in queue for manual processing
        await syncRepo.enqueue(prisma, {
          userId,
          actionType,
          payload,
          status: 'pending',
          clientRequestId
        });
        return { clientRequestId, status: 'queued', message: `Unknown action type: ${actionType}` };
    }

    // Log successful processing in the sync queue for audit trail
    await syncRepo.enqueue(prisma, {
      userId,
      actionType,
      payload,
      status: 'completed',
      clientRequestId
    });

    return { clientRequestId, status: 'completed', result };
  } catch (err) {
    // Log the failure in the sync queue
    await syncRepo.enqueue(prisma, {
      userId,
      actionType,
      payload,
      status: 'failed',
      clientRequestId
    });

    return {
      clientRequestId,
      status: 'failed',
      error: err.message || 'Unknown error'
    };
  }
}

/**
 * Process a batch of sync actions immediately instead of just queuing.
 * Each action is processed inline and the result is returned.
 */
async function enqueueBatch(prisma, userId, actions, blockchain) {
  const results = [];

  for (const action of actions) {
    const result = await processAction(prisma, blockchain, userId, action);
    results.push(result);
  }

  return results;
}

async function listQueue(prisma, userId) {
  return syncRepo.listByUser(prisma, userId);
}

module.exports = {
  enqueueBatch,
  processAction,
  listQueue
};
