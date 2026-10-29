'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { applyGeometryAction, createGeometryState, isGeometryIdentity, sourceHeaderResult } = require('../src/geometryState');

test('matching flips restore source geometry', () => {
  let state = applyGeometryAction(createGeometryState(), 'flipHorizontal');
  assert.equal(isGeometryIdentity(state), false);
  state = applyGeometryAction(state, 'flipHorizontal');
  assert.equal(isGeometryIdentity(state), true);
});

test('opposite quarter turns restore source geometry', () => {
  let state = applyGeometryAction(createGeometryState(), 'rotateLeft');
  assert.equal(isGeometryIdentity(state), false);
  state = applyGeometryAction(state, 'rotateRight');
  assert.equal(isGeometryIdentity(state), true);
});

test('arbitrary rotation remains a resampled source transform', () => {
  const state = applyGeometryAction(createGeometryState(), 'rotate', { angle: 12.5 });
  assert.equal(isGeometryIdentity(state), false);
  assert.equal(isGeometryIdentity(applyGeometryAction(state, 'rotate', { angle: -12.5 })), false);
  assert.equal(isGeometryIdentity(applyGeometryAction(createGeometryState(), 'rotate', { angle: 360 })), true);
});

test('source Header warning follows the net geometry instead of transform history', () => {
  const header = { available: true, hdus: [{ index: 0, name: 'PRIMARY', text: 'SIMPLE = T' }] };
  const flipped = applyGeometryAction(createGeometryState(), 'flipVertical');
  const warning = sourceHeaderResult(header, true, flipped);
  assert.equal(warning.sourceHeader, true);
  assert.match(warning.wcsWarning, /WCS/);
  const restored = applyGeometryAction(flipped, 'flipVertical');
  const clean = sourceHeaderResult(header, true, restored);
  assert.equal(clean.sourceHeader, true);
  assert.equal(clean.wcsWarning, '');
});
