const { z } = require('zod');

const exportDeclarationSchema = z.object({
  lotIds: z.array(z.string().uuid()).min(1),
  cooperativeId: z.string().uuid().optional(),
  ddId: z.string().uuid().optional()
});

const exportStatusSchema = z.object({
  status: z.string().min(3),
  note: z.string().optional()
});

const cooperativeExportSchema = z.object({
  exporterId: z.string().uuid(),
  ddId: z.string().uuid().optional(),
  lots: z.array(z.object({
    id: z.string().uuid(),
    weightKg: z.number().positive().optional()
  })).min(1)
});

module.exports = {
  exportDeclarationSchema,
  exportStatusSchema,
  cooperativeExportSchema
};
