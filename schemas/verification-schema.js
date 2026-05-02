const { z } = require('zod');

const statusUpdateSchema = z.object({
  status: z.string().min(3),
  reason: z.string().optional()
});

const proofSchema = z.object({
  signature: z.string().min(8),
  payloadHash: z.string().min(8)
});

const certificationSchema = z.object({
  signature: z.string().min(8).optional()
});

const batchVerifySchema = z.object({
  lotIds: z.array(z.string().uuid()).min(1),
  status: z.string().min(3)
});

const querySchema = z.object({
  status: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional()
});

module.exports = {
  statusUpdateSchema,
  proofSchema,
  certificationSchema,
  batchVerifySchema,
  querySchema
};
