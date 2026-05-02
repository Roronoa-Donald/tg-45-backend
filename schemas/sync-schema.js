const { z } = require('zod');

const syncActionSchema = z.object({
  actionType: z.string().min(2),
  clientRequestId: z.string().min(4),
  payload: z.any()
});

const syncBatchSchema = z.object({
  actions: z.array(syncActionSchema).min(1)
});

module.exports = {
  syncBatchSchema
};
