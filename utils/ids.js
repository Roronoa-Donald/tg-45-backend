const { randomUUID } = require('crypto');
const { customAlphabet } = require('nanoid');

const lotCodeAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const lotCode = customAlphabet(lotCodeAlphabet, 10);

function newId() {
  return randomUUID();
}

function newLotCode() {
  return lotCode();
}

module.exports = { newId, newLotCode };
