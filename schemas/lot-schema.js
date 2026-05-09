const { z } = require('zod');

const lotRegisterSchema = z.object({
  product: z.string().min(2),
  variety: z.string().optional(),
  hsCode: z.string().min(2).optional(),
  originCountry: z.string().min(2).max(3).optional(),
  originRegion: z.string().min(2).optional(),
  weightKg: z.number().nonnegative().default(0),
  harvestDate: z.string().datetime().optional(),
  productionStartDate: z.string().datetime().optional(),
  productionEndDate: z.string().datetime().optional(),
  gpsOriginLat: z.number(),
  gpsOriginLng: z.number(),
  gpsPrecisionM: z.number().int().positive(),
  cooperativeId: z.string().uuid().optional(),
  title: z.string().optional(),
  draftId: z.string().optional(),
  scaleImageUrl: z.string().url().optional(),
  coopProofImageUrl: z.string().url().optional()
});

const lotQuerySchema = z.object({
  status: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional()
});

const lotTransferSchema = z.object({
  newOwnerId: z.string().uuid()
});

const lotDetailsSchema = z.object({
  weightKg: z.number().positive()
});

module.exports = {
  lotRegisterSchema,
  lotQuerySchema,
  lotTransferSchema,
  lotDetailsSchema
};
