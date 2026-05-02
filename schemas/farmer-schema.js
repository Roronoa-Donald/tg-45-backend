const { z } = require('zod');

const farmerProfileSchema = z.object({
  farmName: z.string().min(2).optional(),
  location: z.string().min(2).optional(),
  language: z.string().min(2).optional()
});

module.exports = { farmerProfileSchema };
