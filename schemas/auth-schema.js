const { z } = require('zod');

const loginSchema = z.object({
  identifier: z.string().min(3),
  secret: z.string().min(4)
});

const onboardSchema = z.object({
  role: z.string().min(3),
  name: z.string().min(2),
  phone: z.string().min(6).optional(),
  email: z.string().email().optional(),
  secret: z.string().min(4),
  cooperativeId: z.string().uuid().optional()
});

const registerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(6).optional(),
  email: z.string().email().optional(),
  secret: z.string().min(4),
  role: z.enum(['farmer', 'cooperative', 'verifier', 'exporter', 'compliance']).optional(),
  cooperativeId: z.string().uuid().optional(),
  farmName: z.string().optional(),
  location: z.string().optional(),
  language: z.string().optional()
});

const resetPinSchema = z.object({
  userId: z.string().uuid(),
  newPin: z.string().min(4)
});

module.exports = {
  loginSchema,
  onboardSchema,
  resetPinSchema,
  registerSchema
};
