'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {uniqueFrameLabel} = require('../src/frameLabels');

test('repeated Frame titles receive the next unused suffix', () => {
  assert.equal(uniqueFrameLabel('stack.tif', []), 'stack.tif');
  assert.equal(uniqueFrameLabel('stack.tif', ['stack.tif']), 'stack.tif (2)');
  assert.equal(uniqueFrameLabel('stack.tif', ['stack.tif', 'stack.tif (2)']), 'stack.tif (3)');
  assert.equal(uniqueFrameLabel('other.tif', ['stack.tif']), 'other.tif');
});
