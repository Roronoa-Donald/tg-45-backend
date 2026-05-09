const { z } = require('zod');

const geometrySchema = z.object({
  type: z.enum(['Point', 'Polygon']),
  coordinates: z.any()
});

const baseParcelSchema = z.object({
  name: z.string().min(2).optional(),
  cooperativeId: z.string().uuid().optional(),
  countryCode: z.string().min(2).max(3).optional(),
  region: z.string().min(2).optional(),
  district: z.string().min(2).optional(),
  locality: z.string().min(2).optional(),
  geometryType: z.enum(['point', 'polygon']),
  geometry: geometrySchema,
  areaHa: z.number().positive().optional()
});

const parcelCreateSchema = baseParcelSchema.refine((data) => {
  const isPoint = data.geometryType === 'point' && data.geometry.type === 'Point';
  const isPolygon = data.geometryType === 'polygon' && data.geometry.type === 'Polygon';
  return isPoint || isPolygon;
}, {
  message: 'geometry_type_mismatch',
  path: ['geometry']
});

const parcelUpdateSchema = baseParcelSchema.partial().refine((data) => {
  if (!data.geometryType || !data.geometry) {
    return true;
  }
  const isPoint = data.geometryType === 'point' && data.geometry.type === 'Point';
  const isPolygon = data.geometryType === 'polygon' && data.geometry.type === 'Polygon';
  return isPoint || isPolygon;
}, {
  message: 'geometry_type_mismatch',
  path: ['geometry']
});

const lotParcelLinkSchema = z.object({
  parcelId: z.string().uuid(),
  sharePct: z.number().positive().max(100).optional()
});

module.exports = {
  parcelCreateSchema,
  parcelUpdateSchema,
  lotParcelLinkSchema
};
