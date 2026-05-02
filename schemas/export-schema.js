const { z } = require('zod');

const exportDeclarationSchema = z.object({
  lotIds: z.array(z.string().uuid()).min(1),
  cooperativeId: z.string().uuid().optional()
});

const exportStatusSchema = z.object({
  status: z.string().min(3),
  note: z.string().optional()
});

module.exports = {
  exportDeclarationSchema,
  exportStatusSchema
};
