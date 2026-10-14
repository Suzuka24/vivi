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

test('mouse points snap to pixels while specified geometry retains decimals', () => {
  assert.deepEqual(roi.pixelPoint([2.49, 8.6], 32, 24), [2, 9]);
  assert.deepEqual(roi.pixelPoint([99, -5], 32, 24), [31, 0]);
  assert.deepEqual(roi.specifiedRect(1.25, 2.5, 10.5, 4.75, 32, 24), [[1.25, 2.5], [11.75, 7.25]]);
  assert.deepEqual(roi.specifiedRect(5.5, 6, 3, 2, 32, 24, {centered:true}), [[4, 5], [7, 7]]);
  assert.deepEqual(roi.specifiedVertices('1.25, 2.5\n3.5, 4.75\n5,6', 'polygon', 32, 24), [[1.25,2.5],[3.5,4.75],[5,6]]);
  assert.throws(()=>roi.specifiedRect(30, 0, 4, 2, 32, 24), /fit inside/);
  assert.throws(()=>roi.specifiedVertices('1,2\n3,4', 'polygon', 32, 24), /at least 3/);
  const curve=roi.smoothPoints([[0,0],[4,8],[8,0]]);
  assert.deepEqual(curve[0],[0,0]);
  assert.deepEqual(curve.at(-1),[8,0]);
  assert.ok(curve.length>3);
});

test('line endpoint editing uses the same 45-degree Shift constraint as drawing', () => {
  const constrained=(points,handle,pointer)=>roi.constrainLineEndpoint(points,handle,pointer,true).map(point=>roi.pixelPoint(point,100,100));
  assert.deepEqual(constrained([[10,10],[20,20]],1,[31,13]),[[10,10],[31,10]]);
  assert.deepEqual(constrained([[10,10],[20,20]],0,[17,35]),[[20,35],[20,20]]);
  const diagonal=constrained([[10,10],[20,20]],1,[30,27])[1];
  assert.equal(diagonal[0],diagonal[1]);
  const reverse=constrained([[10,10],[20,20]],0,[2,3])[0];
  assert.equal(reverse[0],reverse[1]);
  assert.deepEqual(roi.constrainLineEndpoint([[10,10],[20,20]],1,[31,13],false),[[10,10],[31,13]]);
});
