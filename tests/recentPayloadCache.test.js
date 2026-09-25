'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {RecentPayloadCache,sameSource}=require('../media/recentPayloadCache');

const source=(path='/data/image.tif',mtimeMs=1)=>({path,size:42,mtimeMs,ctimeMs:1,ino:7});

test('source identity includes file metadata',()=>{
  assert.equal(sameSource(source(),source()),true);
  assert.equal(sameSource(source(),source('/data/other.tif')),false);
  assert.equal(sameSource(source(),source('/data/image.tif',2)),false);
});

test('cache keeps the three most recently opened payloads',()=>{
  const cache=new RecentPayloadCache();
  cache.remember(source('/a'),{payload:'a'},10);
  cache.remember(source('/b'),{payload:'b'},10);
  cache.remember(source('/c'),{payload:'c'},10);
  cache.remember(source('/d'),{payload:'d'},10);
  assert.equal(cache.get(source('/a')),null);
  assert.deepEqual(cache.get(source('/b')),{payload:'b'});
  assert.deepEqual(cache.get(source('/d')),{payload:'d'});
  assert.equal(cache.size,3);
});

test('updating display state does not extend an entry lifetime or change its order',()=>{
  const cache=new RecentPayloadCache();
  cache.remember(source('/a'),{value:1},10,Date.now()-1000);
  cache.remember(source('/b'),{value:2},10);
  assert.equal(cache.update(source('/a'),{value:3}),true);
  cache.remember(source('/c'),{value:4},10);
  cache.remember(source('/d'),{value:5},10);
  assert.equal(cache.get(source('/a')),null);
  assert.deepEqual(cache.get(source('/b')),{value:2});
});

test('zero seconds disables the cache',()=>{
  const cache=new RecentPayloadCache();
  cache.remember(source(),{payload:'data'},0);
  assert.equal(cache.get(source()),null);
});
