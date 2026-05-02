const { z } = require('zod');

const apiKeyCreateSchema = z.object({
  partnerName: z.string().min(2),
  cooperativeId: z.string().uuid().optional()
});

const webhookSchema = z.object({
  url: z.string().url()
});

module.exports = {
  apiKeyCreateSchema,
  webhookSchema
};
