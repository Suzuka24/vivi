'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {HttpPayloadTransport,packStackPayload,packStackRecord} = require('../src/httpTransport');

test('HTTP payload transport preserves bytes and tokens are single-use', async t => {
  const transport=new HttpPayloadTransport();t.after(()=>transport.dispose());
  transport.setExternalBase(await transport.listen());
  const source=Buffer.from(Array.from({length:4097},(_,index)=>index%251));
  const descriptor=transport.offer(source,7);
  const response=await fetch(descriptor.url);
  assert.equal(response.headers.get('content-length'),String(source.byteLength));
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),source);
  assert.equal((await fetch(descriptor.url)).status,404);
  transport.complete(descriptor.token);
});

test('cancelling a Frame invalidates its pending HTTP payload', async t => {
  const transport=new HttpPayloadTransport();t.after(()=>transport.dispose());
  transport.setExternalBase(await transport.listen());
  const descriptor=transport.offer(Buffer.alloc(1024,3),11);
  transport.cancelFrame(11);
  assert.equal((await fetch(descriptor.url)).status,404);
});

test('cancelling a Frame closes an active continuous response', async t => {
  const transport=new HttpPayloadTransport();t.after(()=>transport.dispose());
  transport.setExternalBase(await transport.listen());
  let resolveAbort;
  const aborted=new Promise(resolve=>{resolveAbort=resolve;});
  const descriptor=transport.offer(Buffer.alloc(32*1024*1024,5),19,resolveAbort);
  let request;
  const response=await new Promise((resolve,reject)=>{request=http.get(descriptor.url,resolve);request.once('error',reject);});
  response.pause();
  const entry=[...transport.entries.values()][0];
  transport.cancelFrame(19);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(entry.response.destroyed,true);
  response.destroy();request.destroy();
  await Promise.race([aborted,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Server did not observe the closed response.')),1000);timer.unref?.();})]);
});

test('stack payload container preserves frame metadata and bytes', () => {
  const events=[
    {frame:0,total:2,result:{width:2,dtype:'<u2',payload:Uint8Array.from([1,2,3]).buffer}},
    {frame:1,total:2,result:{width:2,dtype:'<u2',payload:Uint8Array.from([4,5]).buffer}}
  ];
  const packed=Buffer.concat(packStackPayload(events)),headerLength=packed.readUInt32LE(0),manifest=JSON.parse(packed.subarray(4,4+headerLength));
  const data=packed.subarray(4+headerLength);
  assert.deepEqual(manifest.map(item=>[item.frame,item.total,item.result.dtype,item.offset,item.byteLength]),[[0,2,'<u2',0,3],[1,2,'<u2',3,2]]);
  assert.deepEqual([...data],[1,2,3,4,5]);
});

test('live stack transport streams records without a combined payload allocation', async t => {
  const transport=new HttpPayloadTransport();t.after(()=>transport.dispose());
  transport.setExternalBase(await transport.listen());
  const stream=transport.offerStream(23),request=fetch(stream.descriptor.url);
  await stream.ready;
  const records=[
    {frame:0,total:2,result:{dtype:'<f4',payload:Uint8Array.from([1,2,3]).buffer}},
    {frame:1,total:2,result:{dtype:'<f4',payload:Uint8Array.from([4,5]).buffer}}
  ];
  for(const record of records)await stream.write(packStackRecord(record));
  stream.end();
  const response=await request,wire=Buffer.from(await response.arrayBuffer());let offset=0;
  for(const expected of records){
    const length=wire.readUInt32LE(offset);offset+=4;
    const header=JSON.parse(wire.subarray(offset,offset+length));offset+=length;
    assert.equal(header.frame,expected.frame);assert.equal(header.total,2);assert.equal(header.result.dtype,'<f4');
    assert.deepEqual([...wire.subarray(offset,offset+header.payloadLength)],[...new Uint8Array(expected.result.payload)]);offset+=header.payloadLength;
  }
  assert.equal(offset,wire.byteLength);transport.complete(stream.descriptor.token);
});
