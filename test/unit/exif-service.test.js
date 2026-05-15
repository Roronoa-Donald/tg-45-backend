const { test } = require('node:test');
const assert = require('node:assert');
const exifService = require('../../services/exif-service');

test('exifService - extractExif should return null for invalid input', async () => {
  const result = await exifService.extractExif(null);
  assert.strictEqual(result, null);
});

test('exifService - isGpsInsideParcel should validate point in polygon', () => {
  const geometry = {
    type: 'Polygon',
    coordinates: [[
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0]
    ]]
  };

  // Point inside
  const inside = exifService.isGpsInsideParcel(5, 5, geometry);
  assert.strictEqual(inside, true);

  // Point outside
  const outside = exifService.isGpsInsideParcel(15, 15, geometry);
  assert.strictEqual(outside, false);

  // Point on edge (considered outside by ray-casting)
  const edge = exifService.isGpsInsideParcel(0, 5, geometry);
  assert.strictEqual(edge, false);
});

test('exifService - validateGpsInPolygon should reject missing GPS', () => {
  const result = exifService.validateGpsInPolygon(null, { type: 'Polygon' });
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.reason, 'No GPS data in photo');
});

test('exifService - validateGpsInPolygon should accept non-polygon parcels', () => {
  const result = exifService.validateGpsInPolygon(
    { lat: 5, lng: 5 },
    { type: 'Point', coordinates: [5, 5] }
  );
  assert.strictEqual(result.valid, true);
});

test('exifService - validatePhotoRecency should reject old photos', () => {
  const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
  const result = exifService.validatePhotoRecency(oldDate, 7);
  assert.strictEqual(result.valid, false);
  assert.ok(result.reason.includes('days old'));
});

test('exifService - validatePhotoRecency should accept recent photos', () => {
  const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
  const result = exifService.validatePhotoRecency(recentDate, 7);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.daysOld, 2);
});

test('exifService - validatePhotoRecency should reject future dates', () => {
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
  const result = exifService.validatePhotoRecency(futureDate, 7);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.reason, 'Photo date is in the future');
});

test('exifService - validatePhotoRecency should reject missing date', () => {
  const result = exifService.validatePhotoRecency(null, 7);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.reason, 'No date in photo metadata');
});
