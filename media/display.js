'use strict';
(function(){

let zfpLoading;
async function zfpDecoder(){
  if(!globalThis.ViviZfp){
    if(!zfpLoading)zfpLoading=new Promise((resolve,reject)=>{
      if(typeof document==='undefined'||!globalThis.ViviZfpScriptUrl){reject(new Error('ZFP preview decoder is unavailable'));return;}
      const script=document.createElement('script');script.src=globalThis.ViviZfpScriptUrl;
      script.nonce=globalThis.ViviNonce;script.onload=resolve;script.onerror=()=>reject(new Error('Unable to load ZFP preview decoder'));
      document.head.append(script);
    });
    await zfpLoading;
  }
  await globalThis.ViviZfp.isLoaded;
  return globalThis.ViviZfp;
}

function decodeBlocks(bytes,result){
  const {method,blockSize,limitBytes}=result.lossy;
  const bits=Number(method.slice(5)),width=result.width,height=result.height;
  if(![8,12,16].includes(bits)||blockSize!==64||![4,8].includes(limitBytes))throw new Error('Invalid block preview format');
  const count=width*height,columns=Math.ceil(width/blockSize),rows=Math.ceil(height/blockSize),headerBytes=columns*rows*2*limitBytes;
  const pixelBytes=bits===12?Math.ceil(count/2)*3:count*bits/8;
  if(bytes.byteLength!==headerBytes+pixelBytes)throw new Error('Block preview length mismatch');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const raw=limitBytes===4?new Float32Array(count):new Float64Array(count);
  const levels=(1<<bits)-1;
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const meta=(row*columns+column)*2*limitBytes;
    const low=limitBytes===4?view.getFloat32(meta,true):view.getFloat64(meta,true);
    const high=limitBytes===4?view.getFloat32(meta+limitBytes,true):view.getFloat64(meta+limitBytes,true);
    for(let y=row*blockSize;y<Math.min(height,(row+1)*blockSize);y++)
      for(let x=column*blockSize;x<Math.min(width,(column+1)*blockSize);x++){
        const i=y*width+x,offset=headerBytes;
        let q;
        if(bits===8)q=bytes[offset+i];
        else if(bits===16)q=view.getUint16(offset+i*2,true);
        else{const pair=offset+Math.floor(i/2)*3;q=i%2?((bytes[pair+1]>>4)|(bytes[pair+2]<<4)):(bytes[pair]|((bytes[pair+1]&15)<<8));}
        raw[i]=low+q*(high-low)/levels;
      }
  }
  return raw;
}

async function decodeRawPayload(result) {
  if (!(result.payload instanceof ArrayBuffer)) throw new Error('Missing binary image payload');
  let bytes = new Uint8Array(result.payload);
  if (result.codec === 'zlib') {
    if (typeof DecompressionStream === 'undefined') throw new Error('This Webview cannot decompress image data');
    bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  } else if (result.codec === 'zstd') {
    if (!globalThis.fzstd?.decompress) throw new Error('Zstandard preview decoder is unavailable');
    bytes = globalThis.fzstd.decompress(bytes);
  } else if (result.codec !== 'none') throw new Error(`Unsupported image codec: ${result.codec}`);
  if (bytes.byteLength !== result.byteLength) throw new Error('Image payload length mismatch');
  if (result.shuffle) {
    const width = result.shuffle, count = bytes.length / width;
    if (!Number.isInteger(count)) throw new Error('Invalid image byte shuffle');
    const restored = new Uint8Array(bytes.length);
    for (let part = 0; part < width; part++)
      for (let pixel = 0; pixel < count; pixel++) restored[pixel * width + part] = bytes[part * count + pixel];
    bytes = restored;
  }
  if(result.lossy?.method==='zfp'){
    const decoder=await zfpDecoder(),buffer=decoder.createBuffer();
    try{
      const decoded=decoder.decompress(buffer,bytes),raw=decoded.data;
      if(raw.length!==result.width*result.height*result.channels||
         !(raw instanceof Float32Array||raw instanceof Float64Array))throw new Error('ZFP preview shape or type mismatch');
      return {raw,sourceBytes:new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength)};
    }finally{decoder.freeBuffer(buffer);}
  }
  if(result.lossy?.method?.startsWith('block')){
    const raw=decodeBlocks(bytes,result);
    return {raw,sourceBytes:new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength)};
  }
  if(result.lossy?.method==='bfloat16'){
    const count=result.width*result.height*result.channels;
    if(bytes.byteLength!==count*2)throw new Error('BFloat16 preview length mismatch');
    const input=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),bits=new Uint32Array(count);
    for(let i=0;i<count;i++)bits[i]=input.getUint16(i*2,true)<<16;
    const raw=new Float32Array(bits.buffer);
    return {raw,sourceBytes:new Uint8Array(raw.buffer)};
  }
  const sourceBytes = bytes;
  const match = /^([<>=|])([uifb])(1|2|4|8)$/.exec(result.dtype);
  if (!match) throw new Error(`Unsupported image dtype: ${result.dtype}`);
  const [, order, kind, sizeText] = match, size = Number(sizeText);
  if (bytes.byteLength % size) throw new Error('Image dtype length mismatch');
  const littleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
  if (size > 1 && ((order === '>' && littleEndian) || (order === '<' && !littleEndian))) {
    bytes = bytes.slice();
    for (let offset = 0; offset < bytes.length; offset += size)
      for (let left = 0, right = size - 1; left < right; left++, right--)
        [bytes[offset + left], bytes[offset + right]] = [bytes[offset + right], bytes[offset + left]];
  }
  const types = {u1:Uint8Array,i1:Int8Array,b1:Uint8Array,u2:Uint16Array,i2:Int16Array,
    u4:Uint32Array,i4:Int32Array,u8:BigUint64Array,i8:BigInt64Array,f4:Float32Array,f8:Float64Array};
  const key = kind + sizeText;
  let raw;
  if (key === 'f2') {
    const bits = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    raw = Float32Array.from(bits, value => {
      const sign = value & 0x8000 ? -1 : 1, exponent = (value >> 10) & 31, fraction = value & 1023;
      return exponent === 31 ? (fraction ? NaN : sign * Infinity) :
        sign * (exponent ? (1 + fraction / 1024) * 2 ** (exponent - 15) : fraction / 1024 * 2 ** -14);
    });
  } else {
    const Type = types[key];
    if (!Type) throw new Error(`Unsupported image dtype: ${result.dtype}`);
    raw = new Type(bytes.buffer, bytes.byteOffset, bytes.byteLength / size);
  }
  if (raw.length !== result.width * result.height * result.channels) throw new Error('Image shape does not match payload');
  return {raw,sourceBytes};
}

const sampleNumber = (raw, index) => Number(raw[index]);
function displayPixelValue(raw,index,channels){
  if(channels<=1)return sampleNumber(raw,index);
  const used=Math.min(3,channels);let value=0;
  for(let channel=0;channel<used;channel++)value+=sampleNumber(raw,index+channel);
  return value/used;
}

function histogramCdf(counts){
  const cdf=Float64Array.from(counts);
  let sum=0,cdfMinimum=0,seen=false;
  for(let index=0;index<cdf.length;index++){sum+=cdf[index];if(!seen&&cdf[index]){cdfMinimum=sum;seen=true;}cdf[index]=sum;}
  const denominator=sum-cdfMinimum;
  if(sum)for(let index=0;index<cdf.length;index++)cdf[index]=denominator>0?Math.max(0,(cdf[index]-cdfMinimum)/denominator):0;
  return cdf;
}

function stretchContext(raw,channels=1,stretch='linear',low=0,high=1){
  let cdf=null;
  if(stretch==='histeq'&&high>low){
    const histogram=new Uint32Array(256),range=high-low;
    for(let index=0;index<raw.length;index++){
      const value=sampleNumber(raw,index);if(!Number.isFinite(value)||value<low||value>high)continue;
      histogram[Math.max(0,Math.min(255,Math.floor((value-low)/range*255)))]++;
    }
    cdf=histogramCdf(histogram);
  }
  return {stretch,cdf,zero:high>low?(0-low)/(high-low):0};
}

function stretchContextFromHistogram(counts,stretch='linear',zero=0){
  return {stretch,cdf:stretch==='histeq'&&counts?.length?histogramCdf(counts):null,zero};
}

function stretchIntensity(value,context){
  if(!Number.isFinite(value))return value;
  let normalized=Math.max(0,Math.min(1,value));
  const stretch=context?.stretch||'linear',cdf=context?.cdf;
  if(stretch==='log')normalized=Math.log1p(1000*normalized)/Math.log1p(1000);
  else if(stretch==='power')normalized=(Math.pow(1000,normalized)-1)/999;
  else if(stretch==='sqrt')normalized=Math.sqrt(normalized);
  else if(stretch==='asinh')normalized=Math.asinh(10*normalized)/Math.asinh(10);
  else if(stretch==='square'||stretch==='squared')normalized*=normalized;
  else if(stretch==='sinh')normalized=Math.sinh(3*normalized)/Math.sinh(3);
  else if(stretch==='exp')normalized=Math.expm1(normalized)/Math.expm1(1);
  else if(stretch==='abs'){
    const zero=context?.zero??0,left=Math.abs(zero),right=Math.abs(1-zero),minimum=zero>=0&&zero<=1?0:Math.min(left,right),maximum=Math.max(left,right);
    normalized=maximum>minimum?(Math.abs(normalized-zero)-minimum)/(maximum-minimum):0;
  }
  else if(stretch==='histeq'&&cdf)normalized=cdf[Math.max(0,Math.min(cdf.length-1,Math.round(normalized*(cdf.length-1))))];
  return Math.max(0,Math.min(1,normalized));
}

function imageJAutoLimitsFromPixels(visit,previousThreshold=0,kind='float'){
  const autoThreshold=previousThreshold<10?5000:previousThreshold/2;
  let minimum=Infinity,maximum=-Infinity,pixelCount=0;
  visit(value=>{
    if(!Number.isFinite(value))return;
    minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);pixelCount++;
  });
  if(!pixelCount)return {limits:null,autoThreshold};
  const histogram=new Uint32Array(256),histMin=kind==='byte'?0:minimum;
  const binSize=kind==='byte'?1:kind==='short'?(maximum-minimum+1)/256:(maximum-minimum)/256;
  if(!(binSize>0))return {limits:null,autoThreshold};
  visit(value=>{
    if(!Number.isFinite(value))return;
    histogram[Math.max(0,Math.min(255,Math.floor((value-histMin)/binSize)))]++;
  });
  const limit=Math.floor(pixelCount/10),threshold=Math.floor(pixelCount/autoThreshold);
  let hmin=0;while(hmin<255&&(histogram[hmin]>limit||histogram[hmin]<=threshold))hmin++;
  let hmax=255;while(hmax>0&&(histogram[hmax]>limit||histogram[hmax]<=threshold))hmax--;
  if(hmax<hmin)return {limits:null,autoThreshold};
  let low=histMin+hmin*binSize,high=histMin+hmax*binSize;
  if(low===high){low=minimum;high=maximum;}
  return {limits:[low,high],autoThreshold};
}

function imageJAutoLimits(raw,channels,previousThreshold=0,kind='float'){
  return imageJAutoLimitsFromPixels(consume=>{
    for(let i=0;i<raw.length;i+=channels){
      let value=displayPixelValue(raw,i,channels);
      if(channels>1)value=Math.floor(value+0.5);
      consume(value);
    }
  },previousThreshold,kind);
}

function imageJResetLimits(raw,channels,kind='float'){
  return channels>1||kind==='byte'?[0,255]:autoLimits(raw,channels,'minmax');
}

function autoLimits(raw, channels, mode) {
  if(mode==='minmax'){
    let low=Infinity,high=-Infinity;
    for(let i=0;i<raw.length;i+=channels){
      const value=displayPixelValue(raw,i,channels);
      if(Number.isFinite(value)){low=Math.min(low,value);high=Math.max(high,value);}
    }
    return Number.isFinite(low)?[low,high]:[0,1];
  }
  const values=[];
  const stride=Math.max(1,Math.floor(raw.length/channels/262144));
  for(let i=0;i<raw.length;i+=stride*channels){
    const value=displayPixelValue(raw,i,channels);
    if(Number.isFinite(value))values.push(value);
  }
  if(!values.length)return [0,1];
  values.sort((a,b)=>a-b);
  if(values.length===1)return [values[0],values[0]+Math.max(1,Math.abs(values[0])*1e-6)];
  const pick=p=>{const index=p*(values.length-1),lo=Math.floor(index),t=index-lo;return values[lo]*(1-t)+values[Math.min(values.length-1,lo+1)]*t;};
  let low,high;
  if(mode==='zscale'){
    const first=Math.floor(values.length*.25),last=Math.ceil(values.length*.75),slope=(values[last]-values[first])/Math.max(1,last-first),middle=pick(.5);
    low=Math.max(values[0],middle-slope*values.length/4);high=Math.min(values.at(-1),middle+slope*values.length/4);
  }else{
    const coverage={p90:90,p95:95,p99:99,p999:99.9,percentile:99}[mode]??99;
    low=pick((100-coverage)/200);high=pick((100+coverage)/200);
  }
  return high>low?[low,high]:[low,low+Math.max(1,Math.abs(low)*1e-6)];
}

function renderPixels(raw,width,height,channels,settings,lut=null){
  const {low,high,stretch='linear',invert=false,threshold=false}=settings;
  const output=new Uint8ClampedArray(width*height*4),range=Math.max(Number.MIN_VALUE,high-low);
  const context=settings.stretchContext||stretchContext(raw,channels,stretch,low,high);
  const intensity=value=>{const x=stretchIntensity((value-low)/range,context);return invert?1-x:x;};
  for(let pixel=0;pixel<width*height;pixel++){
    const source=pixel*channels,target=pixel*4;
    let valid=true;
    for(let channel=0;channel<Math.min(3,channels);channel++)valid&&=Number.isFinite(sampleNumber(raw,source+channel));
    if(!valid){output[target+3]=255;continue;}
    if(threshold){const value=displayPixelValue(raw,source,channels),index=value>=low&&value<=high?255:0;for(let channel=0;channel<3;channel++)output[target+channel]=lut?lut[index][channel]:index;}
    else if(channels>1){for(let channel=0;channel<3;channel++)output[target+channel]=Math.floor(intensity(sampleNumber(raw,source+channel))*255);}
    else{
      const mapped=intensity(sampleNumber(raw,source));
      const index=Math.max(0,Math.min(255,lut?Math.round(mapped*255):Math.floor(mapped*255)));
      for(let channel=0;channel<3;channel++)output[target+channel]=lut?lut[index][channel]:index;
    }
    output[target+3]=255;
  }
  return output;
}

function transformRaw(raw,width,height,channels,action){
  const rotated=action==='rotateLeft'||action==='rotateRight',nextWidth=rotated?height:width,nextHeight=rotated?width:height;
  const output=new raw.constructor(raw.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let nx=x,ny=y;
    if(action==='flipHorizontal')nx=width-1-x;
    else if(action==='flipVertical')ny=height-1-y;
    else if(action==='rotate180'){nx=width-1-x;ny=height-1-y;}
    else if(action==='rotateLeft'){nx=y;ny=width-1-x;}
    else if(action==='rotateRight'){nx=height-1-y;ny=x;}
    const from=(y*width+x)*channels,to=(ny*nextWidth+nx)*channels;
    for(let channel=0;channel<channels;channel++)output[to+channel]=raw[from+channel];
  }
  return {raw:output,width:nextWidth,height:nextHeight};
}

function transformBox(box,width,height,action){
  const [x0,y0,x1,y1]=box;
  if(action==='flipHorizontal')return [width-x1,y0,width-x0,y1];
  if(action==='flipVertical')return [x0,height-y1,x1,height-y0];
  if(action==='rotate180')return [width-x1,height-y1,width-x0,height-y0];
  if(action==='rotateLeft')return [y0,width-x1,y1,width-x0];
  if(action==='rotateRight')return [height-y1,x0,height-y0,x1];
  return [...box];
}

function preloadFrameOrder(total,active,estimate){
  const order=[];
  for(let distance=0;order.length<total&&distance<total;distance++){
    if(active+distance<total)order.push(active+distance);
    if(distance&&active-distance>=0&&order.length<total)order.push(active-distance);
  }
  return order;
}

function selectedStackFrameIndices(extra,shape,selectedAxis,flatFrame){
  if(!extra?.length)return [flatFrame];
  const index=extra.includes(selectedAxis)?extra.indexOf(selectedAxis):extra.length-1;
  const axis=extra[index],stride=extra.slice(index+1).reduce((product,item)=>product*shape[item],1);
  const length=shape[axis],position=Math.floor(flatFrame/stride)%length,base=flatFrame-position*stride;
  return Array.from({length},(_,next)=>base+next*stride);
}

function reorderedEntries(entries,activeId,action){
  const output=[...entries],index=output.findIndex(([id])=>id===activeId);
  if(index<0||output.length<2)return output;
  const destination=action==='up'?Math.max(0,index-1):action==='down'?Math.min(output.length-1,index+1):action==='first'?0:action==='last'?output.length-1:index;
  if(destination===index)return output;
  const [entry]=output.splice(index,1);output.splice(destination,0,entry);return output;
}

function sliceDisplayRange(histograms,bounds,frameId,datasetId,slice,low,high){
  const key=`${frameId}:${datasetId}:${slice}`,histogram=histograms.get(key),saved=bounds.get(key);
  return [histogram?.min??saved?.[0]??low,histogram?.max??saved?.[1]??high];
}

if(typeof module!=='undefined')module.exports={decodeRawPayload,autoLimits,imageJAutoLimits,imageJAutoLimitsFromPixels,imageJResetLimits,stretchContext,stretchContextFromHistogram,stretchIntensity,renderPixels,transformRaw,transformBox,preloadFrameOrder,selectedStackFrameIndices,reorderedEntries,sliceDisplayRange};
if(typeof window!=='undefined')window.ViviDisplay={decodeRawPayload,autoLimits,imageJAutoLimits,imageJAutoLimitsFromPixels,imageJResetLimits,stretchContext,stretchContextFromHistogram,stretchIntensity,renderPixels,transformRaw,transformBox,preloadFrameOrder,selectedStackFrameIndices,reorderedEntries,sliceDisplayRange};
})();
