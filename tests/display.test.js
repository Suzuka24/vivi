'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {autoLimits,imageJAutoLimits,imageJResetLimits,stretchContext,stretchIntensity,renderPixels,transformRaw,transformBox,preloadFrameOrder,selectedStackFrameIndices,reorderedEntries,sliceDisplayRange}=require('../media/display');

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

test('stack preload visits the active frame first and then adjacent frames',()=>{
  const large=preloadFrameOrder(4200,95,256*256*4);
  assert.equal(large.length,4200);
  assert.deepEqual(large.slice(0,5),[95,96,94,97,93]);
  assert.ok(large.every(frame=>frame>=0&&frame<4200));
  assert.equal(preloadFrameOrder(101,50,795*795*4).length,101);
});

test('stack-wide B&C selects only the current stack along the chosen higher-dimensional axis',()=>{
  assert.deepEqual(selectedStackFrameIndices([], [90,90], undefined, 0),[0]);
  assert.deepEqual(selectedStackFrameIndices([0],[5,90,90],0,2),[0,1,2,3,4]);
  assert.deepEqual(selectedStackFrameIndices([0,1],[2,3,90,90],1,4),[3,4,5]);
  assert.deepEqual(selectedStackFrameIndices([0,1],[2,3,90,90],0,4),[1,4]);
});

test('minmax scans every pixel in large slices and preserves constant ranges',()=>{
  const raw=new Float32Array(600001).fill(12);
  raw[599999]=-7;raw[599997]=91;
  assert.deepEqual(autoLimits(raw,1,'minmax'),[-7,91]);
  assert.deepEqual(autoLimits(new Uint16Array([42,42,42]),1,'minmax'),[42,42]);
});

test('ImageJ auto uses every histogram pixel and ignores dominant background bins',()=>{
  const raw=new Uint8Array(9006);raw.fill(0,0,9000);raw.set([10,10,10,200,200,200],9000);
  const first=imageJAutoLimits(raw,1,0,'byte');
  assert.deepEqual(first,{limits:[10,200],autoThreshold:5000});
  assert.deepEqual(imageJAutoLimits(raw,1,first.autoThreshold,'byte'),{limits:null,autoThreshold:2500});
});

test('ImageJ reset uses the type range for byte images and exact values for float images',()=>{
  assert.deepEqual(imageJResetLimits(new Uint8Array([12,90]),1,'byte'),[0,255]);
  assert.deepEqual(imageJResetLimits(new Float32Array([-2.5,8.25]),1,'float'),[-2.5,8.25]);
  assert.deepEqual(imageJResetLimits(new Uint8Array([1,2,3,4,5,6]),3,'byte'),[0,255]);
});

test('stretch changes display intensity after the raw minimum and maximum window',()=>{
  const raw=new Float32Array([0,25,100]),context=stretchContext(raw,1,'sqrt',0,100);
  assert.deepEqual([...raw],[0,25,100]);
  assert.deepEqual([0,.25,1].map(value=>stretchIntensity(value,context)),[0,.5,1]);
  const rendered=renderPixels(raw,3,1,1,{low:0,high:100,stretch:'sqrt'});
  assert.deepEqual([...rendered.filter((_,index)=>index%4===0)],[0,127,255]);
});

test('stretch operations share normalized names and retain raw threshold values',()=>{
  const raw=new Float32Array([-1,0,1,2]);
  for(const stretch of ['linear','log','power','sqrt','square','asinh','sinh','exp','abs','histeq']){
    const rendered=renderPixels(raw,4,1,1,{low:0,high:2,stretch});
    assert.equal(rendered.length,16,stretch);
  }
  const threshold=renderPixels(raw,4,1,1,{low:0,high:1,stretch:'sqrt',threshold:true});
  assert.deepEqual([...threshold.filter((_,index)=>index%4===0)],[0,255,255,0]);
  const absolute=renderPixels(new Float32Array([-2,-1,0,1,2]),5,1,1,{low:-2,high:2,stretch:'abs'});
  assert.deepEqual([...absolute.filter((_,index)=>index%4===0)],[255,127,0,127,255]);
});

test('frame reorder actions move the active entry without changing frame identity',()=>{
  const entries=[[1,'a'],[2,'b'],[3,'c']];
  assert.deepEqual(reorderedEntries(entries,2,'up').map(([id])=>id),[2,1,3]);
  assert.deepEqual(reorderedEntries(entries,2,'down').map(([id])=>id),[1,3,2]);
  assert.deepEqual(reorderedEntries(entries,2,'first').map(([id])=>id),[2,1,3]);
  assert.deepEqual(reorderedEntries(entries,2,'last').map(([id])=>id),[1,3,2]);
  assert.deepEqual(entries.map(([id])=>id),[1,2,3]);
});

test('Adjust slider bounds follow the current stack slice',()=>{
  const histograms=new Map([
    ['7:0:0',{min:10,max:20}],
    ['7:0:1',{min:100,max:250}]
  ]);
  assert.deepEqual(sliceDisplayRange(histograms,new Map(),7,0,0,0,1),[10,20]);
  assert.deepEqual(sliceDisplayRange(histograms,new Map(),7,0,1,0,1),[100,250]);
});
