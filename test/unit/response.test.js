const test = require('node:test');
const assert = require('node:assert/strict');
const { successEnvelope, errorEnvelope } = require('../../utils/response');

test('successEnvelope returns data and meta', () => {
  const result = successEnvelope({ ok: true }, { page: 1 });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { ok: true });
  assert.deepEqual(result.meta, { page: 1 });
});

test('errorEnvelope returns error shape', () => {
  const result = errorEnvelope('bad_request', 'Invalid', { field: 'x' }, 'req-1');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'bad_request');
  assert.equal(result.error.message, 'Invalid');
  assert.equal(result.error.requestId, 'req-1');
  assert.deepEqual(result.error.details, { field: 'x' });
});
