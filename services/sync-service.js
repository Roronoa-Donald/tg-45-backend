const syncRepo = require('../repositories/sync-queue-repository');

async function enqueueBatch(prisma, userId, actions) {
  const results = [];
  for (const action of actions) {
    const record = await syncRepo.enqueue(prisma, {
      userId,
      actionType: action.actionType,
      payload: action.payload,
      status: 'pending',
      clientRequestId: action.clientRequestId
    });

    results.push({
      clientRequestId: action.clientRequestId,
      status: record.status
    });
  }

  return results;
}

async function listQueue(prisma, userId) {
  return syncRepo.listByUser(prisma, userId);
}

module.exports = {
  enqueueBatch,
  listQueue
};
