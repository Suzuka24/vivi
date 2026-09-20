'use strict';
(function(){

function autoLimits(raw, channels, mode) {
  const values=[];
  const stride=Math.max(1,Math.floor(raw.length/channels/262144));
  for(let i=0;i<raw.length;i+=stride*channels){
    const value=channels>1?(raw[i]+raw[i+1]+raw[i+2])/3:raw[i];
    if(Number.isFinite(value))values.push(value);
  }
  if(!values.length)return [0,1];
  values.sort((a,b)=>a-b);
  if(values.length===1)return [values[0],values[0]+Math.max(1,Math.abs(values[0])*1e-6)];
  const pick=p=>{const index=p*(values.length-1),lo=Math.floor(index),t=index-lo;return values[lo]*(1-t)+values[Math.min(values.length-1,lo+1)]*t;};
  let low,high;
  if(mode==='minmax'){low=values[0];high=values.at(-1);}
  else if(mode==='zscale'){
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
  const stretchValue=value=>{
    let x=Math.max(0,Math.min(1,(value-low)/range));
    if(stretch==='log')x=Math.log1p(1000*x)/Math.log1p(1000);
    else if(stretch==='sqrt'||stretch==='power')x=Math.sqrt(x);
    else if(stretch==='asinh')x=Math.asinh(10*x)/Math.asinh(10);
    else if(stretch==='squared')x*=x;
    else if(stretch==='sinh')x=Math.sinh(3*x)/Math.sinh(3);
    return invert?1-x:x;
  };
  let equalize=null;
  if(stretch==='histeq'){
    const histogram=new Uint32Array(256);
    for(let i=0;i<raw.length;i+=channels){const value=raw[i];if(Number.isFinite(value))histogram[Math.max(0,Math.min(255,Math.floor((value-low)/range*255)))]++;}
    let sum=0;equalize=Float64Array.from(histogram,count=>{sum+=count;return sum;});
    if(sum)for(let i=0;i<256;i++)equalize[i]/=sum;
  }
  for(let pixel=0;pixel<width*height;pixel++){
    const source=pixel*channels,target=pixel*4;
    let valid=true;
    for(let channel=0;channel<Math.min(3,channels);channel++)valid&&=Number.isFinite(raw[source+channel]);
    if(!valid){output[target+3]=255;continue;}
    if(threshold){const value=channels>1?(raw[source]+raw[source+1]+raw[source+2])/3:raw[source],index=value>=low&&value<=high?255:0;for(let channel=0;channel<3;channel++)output[target+channel]=lut?lut[index][channel]:index;}
    else if(channels>1){for(let channel=0;channel<3;channel++)output[target+channel]=Math.floor(stretchValue(raw[source+channel])*255);}
    else{
      let intensity=stretchValue(raw[source]);
      if(equalize)intensity=invert?1-equalize[Math.round(Math.max(0,Math.min(1,(raw[source]-low)/range))*255)]:equalize[Math.round(Math.max(0,Math.min(1,(raw[source]-low)/range))*255)];
      const index=Math.max(0,Math.min(255,lut?Math.round(intensity*255):Math.floor(intensity*255)));
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

if(typeof module!=='undefined')module.exports={autoLimits,renderPixels,transformRaw,transformBox};
if(typeof window!=='undefined')window.ViviDisplay={autoLimits,renderPixels,transformRaw,transformBox};
})();
