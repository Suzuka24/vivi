'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const zlib=require('node:zlib');
const {Backend}=require('../src/backend');
const {decodeRawPayload,autoLimits,renderPixels}=require('../media/display');

function payload(values,dtype,compress=false){
  const original=new Uint8Array(values.buffer.slice(values.byteOffset,values.byteOffset+values.byteLength));
  const width=values.BYTES_PER_ELEMENT;
  const shuffled=new Uint8Array(original.length);
  for(let part=0;part<width;part++)for(let index=0;index<values.length;index++)shuffled[part*values.length+index]=original[index*width+part];
  const wire=compress?zlib.deflateSync(shuffled):original;
  return {payload:wire.buffer.slice(wire.byteOffset,wire.byteOffset+wire.byteLength),dtype,
    codec:compress?'zlib':'none',shuffle:compress?width:0,byteLength:original.length,
    width:values.length,height:1,channels:1};
}

test('raw and compressed transports preserve uint8, uint16, float32, float64 and int64 bytes',async()=>{
  const cases=[[new Uint8Array([0,10,255]),'|u1'],[new Uint16Array([0,256,65535]),'<u2'],
    [new Float32Array([0,-0,0.125,NaN,Infinity]),'<f4'],
    [new Float64Array([0,Math.PI,Number.MIN_VALUE,Infinity]),'<f8'],
    [new BigInt64Array([0n,9007199254740993n]),'<i8']];
  for(const [values,dtype] of cases)for(const compress of [false,true]){
    const {raw,sourceBytes}=await decodeRawPayload(payload(values,dtype,compress));
    assert.equal(raw.constructor,values.constructor);
    assert.deepEqual([...new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength)],
      [...new Uint8Array(values.buffer,values.byteOffset,values.byteLength)]);
    assert.deepEqual([...sourceBytes],[...new Uint8Array(values.buffer,values.byteOffset,values.byteLength)]);
  }
});

test('big-endian uint16 preserves wire bytes and paints decoded values',async()=>{
  const wire=new Uint8Array([0,1,1,0,255,255]);
  const {raw,sourceBytes}=await decodeRawPayload({payload:wire.buffer,dtype:'>u2',codec:'none',shuffle:0,
    byteLength:wire.length,width:3,height:1,channels:1});
  assert.deepEqual([...raw],[1,256,65535]);
  assert.deepEqual([...sourceBytes],[...wire]);
  assert.deepEqual(autoLimits(raw,1,'minmax'),[1,65535]);
  assert.equal(renderPixels(raw,3,1,1,{low:1,high:65535})[8],255);
});

test('backend framing accepts fragmented binary with newline bytes and adjacent JSON',()=>{
  const backend=Object.create(Backend.prototype);
  backend.headerParts=[];backend.headerBytes=0;backend.binaryMessage=null;backend.dead=false;
  const received=[];backend.complete=message=>received.push(message);
  const header=Buffer.from(JSON.stringify({id:1,result:{dtype:'|u1'},binaryLength:4})+'\n');
  backend.consume(header.subarray(0,7));backend.consume(header.subarray(7));
  backend.consume(Buffer.from([1,10]));
  assert.equal(received.length,0);
  backend.consume(Buffer.concat([Buffer.from([0,255]),Buffer.from('{"id":2,"result":{"ok":true}}\n')]));
  assert.equal(received.length,2);
  assert.deepEqual([...new Uint8Array(received[0].result.payload)],[1,10,0,255]);
  assert.equal(received[1].result.ok,true);
});
