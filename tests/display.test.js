'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {autoLimits,renderPixels,transformRaw,transformBox,preloadFrameOrder}=require('../media/display');

test('raw pixels can be recolored repeatedly without changing their values',()=>{
  const raw=new Float32Array([0,1,2,3]);
  const first=renderPixels(raw,2,2,1,{low:0,high:3});
  const adjusted=renderPixels(raw,2,2,1,{low:1,high:2});
  assert.deepEqual([...first.filter((_,index)=>index%4===0)],[0,85,170,255]);
  assert.deepEqual([...adjusted.filter((_,index)=>index%4===0)],[0,0,255,255]);
  assert.deepEqual([...raw],[0,1,2,3]);
  assert.deepEqual(autoLimits(raw,1,'minmax'),[0,3]);
});

test('in-place preview transforms preserve the raw values and box geometry',()=>{
  const raw=new Float32Array([1,2,3,4,5,6]);
  const rotated=transformRaw(raw,3,2,1,'rotateRight');
  assert.equal(rotated.width,2);assert.equal(rotated.height,3);
  assert.deepEqual([...rotated.raw],[4,1,5,2,6,3]);
  assert.deepEqual(transformBox([1,0,3,2],3,2,'rotateRight'),[0,1,2,3]);
  assert.deepEqual([...raw],[1,2,3,4,5,6]);
});

test('large FITS cubes queue every slice starting near the active slice',()=>{
  const large=preloadFrameOrder(4200,95,256*256*4);
  assert.equal(large.length,4200);
  assert.deepEqual(large.slice(0,5),[95,96,94,97,93]);
  assert.ok(large.every(frame=>frame>=0&&frame<4200));
  assert.equal(preloadFrameOrder(101,50,795*795*4).length,101);
});
