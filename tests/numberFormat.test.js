'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {formatNumber} = require('../media/numberFormat');

test('numeric displays use the same eight-character limit without dropping useful precision', () => {
  for (const value of [0, -0, 0.00117908, 0.36260009, 3.22e-12, -3.22e-12, 123456789, -123456789]) {
    const text = formatNumber(value);
    assert.ok(text.length <= 8, `${value}: ${text}`);
    assert.ok(Number.isFinite(Number(text)));
  }
  assert.equal(formatNumber(3.22e-12), '3.22e-12');
  assert.equal(formatNumber(0.00117908), '0.001179');
  assert.equal(formatNumber(0), '0');
});
