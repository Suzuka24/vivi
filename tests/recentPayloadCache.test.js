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

test('recent payload is single-use and a new item replaces the old item',()=>{
  const cache=new RecentPayloadCache();
  cache.remember(source('/a'),{payload:'a'},10);
  cache.remember(source('/b'),{payload:'b'},10);
  assert.equal(cache.take(source('/a')),null);
  assert.deepEqual(cache.take(source('/b')),{payload:'b'});
  assert.equal(cache.take(source('/b')),null);
});

test('zero seconds disables the cache',()=>{
  const cache=new RecentPayloadCache();
  cache.remember(source(),{payload:'data'},0);
  assert.equal(cache.take(source()),null);
});
