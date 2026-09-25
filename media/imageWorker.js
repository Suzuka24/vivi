'use strict';
let initialized=false;

function transferableBuffer(view){
  return view.byteOffset===0&&view.byteLength===view.buffer.byteLength?view.buffer:view.buffer.slice(view.byteOffset,view.byteOffset+view.byteLength);
}

self.onmessage=async({data:message})=>{
  try{
    if(message.type==='init'){
      initialized=true;self.postMessage({type:'ready'});return;
    }
    if(message.type!=='decode'||!initialized)return;
    const decodeStarted=performance.now(),result=message.result,payload=result.payload;
    const {raw:sourceRaw}=await self.ViviDisplay.decodeRawPayload(result);
    const scale=Number(result.bscale??1),zero=Number(result.bzero??0),blank=result.blank,calibrated=scale!==1||zero!==0||blank!=null;
    const raw=calibrated?Float64Array.from(sourceRaw,value=>blank!=null&&String(value)===String(blank)?NaN:Number(value)*scale+zero):sourceRaw;
    const decodeMs=performance.now()-decodeStarted,baseLimits=[result.low,result.high];let low=result.low,high=result.high,bitmap=null,pixels=null,paintMs=0;
    if(message.paint){
      const paintStarted=performance.now(),args=message.args;
      [low,high]=args.cuts==='manual'?[args.low,args.high]:self.ViviDisplay.autoLimits(raw,result.channels,args.cuts);
      const context=self.ViviDisplay.stretchContext(raw,result.channels,args.stretch,low,high);
      pixels=self.ViviDisplay.renderPixels(raw,result.width,result.height,result.channels,{...args,low,high,stretchContext:context},message.lut);
      if(typeof OffscreenCanvas!=='undefined'){
        const surface=new OffscreenCanvas(result.width,result.height);surface.getContext('2d').putImageData(new ImageData(pixels,result.width,result.height),0,0);
        bitmap=surface.transferToImageBitmap();pixels=null;
      }
      paintMs=performance.now()-paintStarted;
    }
    const rawBuffer=transferableBuffer(raw),payloadBuffer=payload,transfers=[rawBuffer];
    if(payloadBuffer!==rawBuffer)transfers.push(payloadBuffer);
    if(bitmap)transfers.push(bitmap);else if(pixels)transfers.push(pixels.buffer);
    self.postMessage({type:'decoded',id:message.id,payload:payloadBuffer,rawBuffer,rawType:raw.constructor.name,rawLength:raw.length,
      baseLimits,low,high,bitmap,pixels:pixels?.buffer||null,decodeMs,paintMs},transfers);
  }catch(error){self.postMessage({type:'error',id:message.id,message:error?.message||String(error),stack:error?.stack||''});}
};
