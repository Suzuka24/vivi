const test = require('node:test');
const assert = require('node:assert/strict');
const roi = require('../media/roiGeometry');

test('rectangle modifiers and eight editable handles', () => {
  assert.deepEqual(roi.createRect([10, 10], [20, 15]), [10, 10, 20, 15]);
  assert.deepEqual(roi.createRect([10, 10], [20, 15], {shift:true}), [10, 10, 20, 20]);
  assert.deepEqual(roi.createRect([10, 10], [20, 15], {center:true}), [0, 5, 20, 15]);
  assert.deepEqual(roi.handles([10, 10, 20, 20]), [[10,10],[15,10],[20,10],[20,15],[20,20],[15,20],[10,20],[10,15]]);
  assert.deepEqual(roi.resizeRect([10,10,20,20],4,[25,25]), [10,10,25,25]);
  assert.deepEqual(roi.moveRect([10,10,20,20],100,0,40,40), [30,10,40,20]);
});
