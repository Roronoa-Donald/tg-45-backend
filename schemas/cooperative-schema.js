const { z } = require('zod');

const cooperativeCreateSchema = z.object({
  name: z.string().min(2),
  region: z.string().optional()
});

const cooperativeMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.string().optional()
});

module.exports = {
  cooperativeCreateSchema,
  cooperativeMemberSchema
};
