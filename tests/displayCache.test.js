'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {transformRaw,transformBox}=require('../media/display');

function cacheFunctions(overrides={}){
  const source=fs.readFileSync(path.join(__dirname,'../media/viewer.js'),'utf8');
  const start=source.indexOf('async function recolorEntry('),end=source.indexOf('async function decodePreview(',start);
  assert.ok(start>=0&&end>start);
  const context={
    document:{createElement:()=>({width:0,height:0,getContext:()=>({putImageData(){}})})},
    ImageData:class {constructor(data,width,height){Object.assign(this,{data,width,height});}},
    renderPixels:()=>new Uint8ClampedArray(16),
    lutTable:async()=>null,
    autoLimits:()=>[0,1],
    overviewCache:new Map(),fileFrames:new Map(),
    $:()=>({value:'1'}),draw(){},showError(error){throw error;},
    setTimeout,activeFileFrame:1,preview:null,previewBox:null,
    ...overrides
  };
  return {...vm.runInNewContext(`${source.slice(start,end)};({recolorEntry,scheduleCachedRecolor})`,context),context};
}

function cachedEntry(frame){
  return {raw:new Float32Array([0,1,2,3]),channels:1,sourceFrame:frame,sourceDataset:0,
    image:{width:2,height:2},colorKey:'old',result:{width:2,height:2,box:[0,0,2,2]}};
}

test('B&C paints a replacement canvas before swapping the cached image',async()=>{
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const {recolorEntry}=cacheFunctions({lutTable:()=>gate});
  const entry=cachedEntry(0),before=entry.image;
  const repaint=recolorEntry(entry,{cuts:'manual',low:1,high:2,cmap:'red'});
  assert.equal(entry.image,before);
  release(null);
  await repaint;
  assert.notEqual(entry.image,before);
  assert.equal(entry.result.low,1);
  assert.equal(entry.result.high,2);
});

test('a display change repaints all loaded slices and overview before navigation',async()=>{
  const {scheduleCachedRecolor,context}=cacheFunctions();
  const first=cachedEntry(0),last=cachedEntry(2),overview=cachedEntry(1);
  const state={frameCache:new Map([['0:full',first],['2:full',last]]),metadata:{datasets:[{id:0}]},datasetId:0,
    plane:1,cuts:'manual',low:1,high:2,cmap:'gray',stretch:'linear'};
  context.fileFrames.set(1,state);
  context.overviewCache.set('1:overview',overview);
  const oldImages=[first.image,overview.image,last.image];
  scheduleCachedRecolor(1,state);
  await new Promise((resolve,reject)=>{
    const deadline=Date.now()+1000;
    const check=()=>oldImages.every((image,index)=>image!==[first,overview,last][index].image)
      ?resolve():Date.now()>deadline?reject(new Error('Cached slices were not repainted')):setTimeout(check,5);
    check();
  });
  for(const entry of [first,overview,last])assert.equal(entry.result.low,1);
});

test('flip and quarter-turn retain drawable canvases for cached stack slices',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../media/viewer.js'),'utf8');
  const start=source.indexOf('function transformCachedImage('),end=source.indexOf('function selectFileFrame(',start);
  assert.ok(start>=0&&end>start);
  const context={document:{createElement:()=>({width:0,height:0,getContext:()=>({translate(){},scale(){},rotate(){},drawImage(){}})})},
    transformRaw,transformBox,overviewCache:new Map(),cacheKey:(frame,box)=>`${frame}:${box}`,activeFileFrame:1};
  const {transformCachedState}=vm.runInNewContext(`${source.slice(start,end)};({transformCachedState})`,context);
  const entry={raw:new Uint8Array([1,2,3,4,5,6]),channels:1,sourceFrame:0,result:{width:3,height:2,box:[0,0,3,2]},image:{width:3,height:2}};
  const state={frameCache:new Map([['0:old',entry]]),preview:entry.image,previewBox:[0,0,3,2]};
  assert.equal(transformCachedState(1,state,'rotateRight',{width:3,height:2}),true);
  assert.ok(entry.image);
  assert.equal(entry.image.width,2);
  assert.equal(entry.image.height,3);
  assert.equal(state.preview,entry.image);
  assert.deepEqual([...entry.raw],[4,1,5,2,6,3]);
  assert.equal(transformCachedState(1,state,'flipHorizontal',{width:2,height:3}),true);
  assert.ok(entry.image);
  assert.deepEqual([...entry.raw],[1,4,2,5,3,6]);
});
