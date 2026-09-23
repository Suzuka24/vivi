'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {CooperativeTransferScheduler}=require('../src/transferScheduler');

test('responsive transfer splits binary payloads and preserves every byte',async()=>{
  const scheduler=new CooperativeTransferScheduler(4,0),messages=[];
  const payload=Uint8Array.from([0,1,2,3,4,5,6,7,8,9]).buffer;
  await scheduler.post(async message=>messages.push(message),{type:'result',id:9,result:{width:5,payload}});
  assert.equal(messages.length,3);
  assert.deepEqual(messages.map(message=>message.chunk.byteLength),[4,4,2]);
  assert.equal(messages[0].message.result.width,5);
  assert.equal(messages[0].message.result.payload,undefined);
  assert.deepEqual(messages.flatMap(message=>[...new Uint8Array(message.chunk)]),[0,1,2,3,4,5,6,7,8,9]);
});

test('concurrent responsive transfers share one fair queue',async()=>{
  const scheduler=new CooperativeTransferScheduler(2,0),order=[];
  const send=label=>scheduler.post(async message=>order.push(`${label}${message.index}`),
    {type:'result',result:{payload:new Uint8Array(6).buffer}});
  await Promise.all([send('a'),send('b')]);
  assert.deepEqual(order,['a0','b0','a1','b1','a2','b2']);
});
