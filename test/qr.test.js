'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

require('../qr');

test('dependency-free QR encoder creates a square matrix', () => {
  const matrix = globalThis.MonaQr.makeMatrix('00020101021238570010A000000727');
  assert.ok(matrix.length >= 21);
  assert.equal(matrix.length, matrix[0].length);
  assert.equal(matrix[0][0], true);
});
