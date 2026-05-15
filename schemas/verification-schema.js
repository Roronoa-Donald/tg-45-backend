const { z } = require('zod');

const statusUpdateSchema = z.object({
  status: z.enum(['registered', 'validated', 'certified', 'rejected', 'shipped', 'exported']),
  reason: z.string().optional(),
  gps: z.object({ lat: z.number(), lng: z.number() }).optional()
});

const proofSchema = z.object({
  signature: z.string().min(8),
  payloadHash: z.string().min(8)
});

const certificationSchema = z.object({
  signature: z.string().min(8).optional(),
  gps: z.object({ lat: z.number(), lng: z.number() }).optional()
});

const batchVerifySchema = z.object({
  lotIds: z.array(z.string().uuid()).min(1),
  status: z.enum(['registered', 'validated', 'certified', 'rejected', 'shipped', 'exported'])
});

const querySchema = z.object({
  status: z.string().optional(),
  lotCode: z.string().optional(), // VE-006: Support recherche par lotCode
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
