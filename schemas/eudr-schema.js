const { z } = require('zod');

const ddrCreateSchema = z.object({
  lotId: z.string().uuid().optional(),
  exportId: z.string().uuid().optional(),
  riskLevel: z.enum(['low', 'standard', 'high']).optional(),
  assessmentSummary: z.string().min(5).optional(),
  mitigationSummary: z.string().min(5).optional()
}).refine((data) => Boolean(data.lotId || data.exportId), {
  message: 'lot_or_export_required',
  path: ['lotId']
}).refine((data) => !(data.lotId && data.exportId), {
  message: 'only_one_target_allowed',
  path: ['exportId']
});

const ddrUpdateSchema = z.object({
  riskLevel: z.enum(['low', 'standard', 'high']).optional(),
  assessmentSummary: z.string().min(5).optional(),
  mitigationSummary: z.string().min(5).optional()
});

const ddrApproveSchema = z.object({
  approved: z.boolean().default(true),
  note: z.string().optional()
});

const deforestationCheckSchema = z.object({
  parcelId: z.string().uuid(),
  source: z.string().min(2),
  checkDate: z.string().datetime(),
  result: z.enum(['pass', 'fail', 'unknown']),
  confidence: z.number().min(0).max(100).optional(),
  evidenceUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional()
});

const legalityCheckSchema = z.object({
  ddId: z.string().uuid(),
  checkType: z.string().min(2),
  status: z.enum(['pass', 'fail', 'unknown']),
  evidenceUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional()
});

const declarationGenerateSchema = z.object({
  ddId: z.string().uuid()
});

const declarationSubmitSchema = z.object({
  ddId: z.string().uuid(),
  referenceNo: z.string().min(4)
});

const documentCreateSchema = z.object({
  docType: z.string().min(2),
  url: z.string().url(),
  checksum: z.string().optional(),
  issuedAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional()
});

module.exports = {
  ddrCreateSchema,
  ddrUpdateSchema,
  ddrApproveSchema,
  deforestationCheckSchema,
  legalityCheckSchema,
  declarationGenerateSchema,
  declarationSubmitSchema,
  documentCreateSchema
};
