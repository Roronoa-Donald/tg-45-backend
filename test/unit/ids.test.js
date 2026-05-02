const test = require('node:test');
const assert = require('node:assert/strict');
const { newId, newLotCode } = require('../../utils/ids');

test('newId returns a UUID-like string', () => {
  const id = newId();
  assert.equal(typeof id, 'string');
  assert.ok(id.length >= 32);
});

test('newLotCode returns uppercase code', () => {
  const code = newLotCode();
  assert.equal(typeof code, 'string');
  assert.equal(code.length, 10);
  assert.equal(code, code.toUpperCase());
});
