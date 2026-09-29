'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {consumeDoubleBuffered}=require('../media/display');

const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

async function* transferredFrames(total,milliseconds,events=[]){
  for(let frame=0;frame<total;frame++){
    events.push(`transfer-start-${frame}`);
    await delay(milliseconds);
    events.push(`transfer-end-${frame}`);
    yield frame;
  }
}

async function consumeSerial(source,consume){
  for await(const item of source)await consume(item);
}

test('double buffering reads the next frame while the current frame is decoded',async()=>{
  const events=[],decoded=[];let active=0,maxActive=0;
  await consumeDoubleBuffered(transferredFrames(3,20,events),async frame=>{
    active++;maxActive=Math.max(maxActive,active);events.push(`decode-start-${frame}`);
    await delay(30);
    decoded.push(frame);events.push(`decode-end-${frame}`);active--;
  });
  assert.deepEqual(decoded,[0,1,2]);
  assert.equal(maxActive,1);
  assert.ok(events.indexOf('transfer-start-1')<events.indexOf('decode-end-0'));
  assert.ok(events.indexOf('transfer-start-2')<events.indexOf('decode-end-1'));
});

test('double buffering shortens the transfer plus decode critical path',async()=>{
  const total=6,stageDelay=25;
  const serialStarted=performance.now();
  await consumeSerial(transferredFrames(total,stageDelay),()=>delay(stageDelay));
  const serialMs=performance.now()-serialStarted;
  const bufferedStarted=performance.now();
  await consumeDoubleBuffered(transferredFrames(total,stageDelay),()=>delay(stageDelay));
  const bufferedMs=performance.now()-bufferedStarted;
  assert.ok(bufferedMs<serialMs*.8,`expected double buffering (${bufferedMs.toFixed(1)} ms) to beat serial loading (${serialMs.toFixed(1)} ms)`);
});
