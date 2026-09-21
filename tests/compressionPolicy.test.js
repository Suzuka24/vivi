'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {previewCompressionOptions}=require('../src/compressionPolicy');

test('lossy file threshold and lossless stage are independent',()=>{
  const base={minMiB:128,method:'zfp',tolerance:1e-4};
  const large=255356172,small=128*1048576;
  assert.deepEqual(previewCompressionOptions({...base,lossless:false,lossy:false},large),{compress:false,losslessMethod:'none'});
  assert.deepEqual(previewCompressionOptions({...base,lossless:true,lossy:false},large),{compress:true,losslessMethod:'zstd1-shuffle'});
  assert.deepEqual(previewCompressionOptions({...base,lossless:false,lossy:true},large),
    {compress:false,losslessMethod:'none',lossyMethod:'zfp',lossyTolerance:1e-4});
  assert.deepEqual(previewCompressionOptions({...base,lossless:true,lossy:true},large),
    {compress:true,losslessMethod:'zstd1-shuffle',lossyMethod:'zfp',lossyTolerance:1e-4});
  assert.deepEqual(previewCompressionOptions({...base,lossless:true,lossy:true},small),{compress:true,losslessMethod:'zstd1-shuffle'});
  assert.deepEqual(previewCompressionOptions({...base,lossless:true,lossy:true},0),{compress:true,losslessMethod:'zstd1-shuffle'});
});
