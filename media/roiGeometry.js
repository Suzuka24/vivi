'use strict';
// Geometry shared by the ImageJ-style selection tools and their regression tests.
const normalize = ([x0,y0,x1,y1]) => [Math.min(x0,x1),Math.min(y0,y1),Math.max(x0,x1),Math.max(y0,y1)];
function createRect(anchor,pointer,{shift=false,center=false}={}){
  let dx=pointer[0]-anchor[0],dy=pointer[1]-anchor[1];
  if(shift){const side=Math.max(Math.abs(dx),Math.abs(dy));dx=Math.sign(dx||1)*side;dy=Math.sign(dy||1)*side;}
  return center?normalize([anchor[0]-Math.abs(dx),anchor[1]-Math.abs(dy),anchor[0]+Math.abs(dx),anchor[1]+Math.abs(dy)]):normalize([anchor[0],anchor[1],anchor[0]+dx,anchor[1]+dy]);
}
function handles(rect){const [x0,y0,x1,y1]=normalize(rect),xm=(x0+x1)/2,ym=(y0+y1)/2;return [[x0,y0],[xm,y0],[x1,y0],[x1,ym],[x1,y1],[xm,y1],[x0,y1],[x0,ym]];}
function resizeRect(rect,handle,pointer,{shift=false,center=false,aspect=false}={}){
  const [a,b,c,d]=normalize(rect),cx=(a+c)/2,cy=(b+d)/2,ratio=Math.max(1e-9,(c-a)/Math.max(1e-9,d-b));
  let x0=a,y0=b,x1=c,y1=d;
  const left=[0,6,7].includes(handle),right=[2,3,4].includes(handle),top=[0,1,2].includes(handle),bottom=[4,5,6].includes(handle);
  if(left)x0=pointer[0];if(right)x1=pointer[0];if(top)y0=pointer[1];if(bottom)y1=pointer[1];
  if(center){if(left||right){const half=Math.abs(pointer[0]-cx);x0=cx-half;x1=cx+half;}if(top||bottom){const half=Math.abs(pointer[1]-cy);y0=cy-half;y1=cy+half;}}
  if(shift||aspect){
    const width=Math.max(1,Math.abs(x1-x0)),height=Math.max(1,Math.abs(y1-y0));
    let newWidth=width,newHeight=height;
    if(top||bottom){newWidth=(left||right)?width:height*(shift?1:ratio);newHeight=shift?newWidth:height;}
    else{newHeight=width/(shift?1:ratio);}
    if(shift&&left&&top||shift&&right&&bottom){const side=Math.max(width,height);newWidth=side;newHeight=side;}
    if(center){x0=cx-newWidth/2;x1=cx+newWidth/2;y0=cy-newHeight/2;y1=cy+newHeight/2;}
    else{
      if(left)x0=x1-newWidth;else if(right)x1=x0+newWidth;else{x0=cx-newWidth/2;x1=cx+newWidth/2;}
      if(top)y0=y1-newHeight;else if(bottom)y1=y0+newHeight;else{y0=cy-newHeight/2;y1=cy+newHeight/2;}
    }
  }
  const result=normalize([x0,y0,x1,y1]);
  if(result[2]-result[0]<1)result[2]=result[0]+1;
  if(result[3]-result[1]<1)result[3]=result[1]+1;
  return result;
}
function moveRect(rect,dx,dy,width,height,{shift=false}={}){
  if(shift){if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0;}
  const [x0,y0,x1,y1]=normalize(rect),w=x1-x0,h=y1-y0;
  const nx=Math.max(0,Math.min(width-w,x0+dx)),ny=Math.max(0,Math.min(height-h,y0+dy));
  return [nx,ny,nx+w,ny+h];
}
function pixelPoint(point,width,height){return [Math.max(0,Math.min(width-1,Math.round(point[0]))),Math.max(0,Math.min(height-1,Math.round(point[1])))];}
function specifiedRect(x,y,width,height,imageWidth,imageHeight,{centered=false}={}){
  if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)throw new Error('Enter finite X, Y and positive width and height.');
  if(centered){x-=width/2;y-=height/2;}
  if(x<0||y<0||x+width>imageWidth||y+height>imageHeight)throw new Error('Selection must fit inside the image.');
  return [[x,y],[x+width,y+height]];
}
function specifiedVertices(text,type,imageWidth,imageHeight){
  const lines=text.trim().split(/\r?\n/).filter(Boolean);
  const points=lines.map(line=>{const fields=line.trim().split(/[\s,;]+/).map(Number);if(fields.length!==2||!fields.every(Number.isFinite))throw new Error('Enter one X, Y pair per line.');return fields;});
  const minimum=['polygon','freehand'].includes(type)?3:type==='angle'?3:2;
  if(points.length<minimum||(type==='angle'&&points.length!==3))throw new Error(`This selection needs ${type==='angle'?'exactly': 'at least'} ${minimum} points.`);
  if(points.some(([x,y])=>x<0||x>=imageWidth||y<0||y>=imageHeight))throw new Error('Vertices must fit inside the image.');
  return points;
}
function smoothPoints(points,closed=false){
  if(points.length<3)return points.map(point=>[...point]);
  const sample=points.length>256?points.filter((_,index)=>index%Math.ceil(points.length/256)===0):points;
  const result=[],n=sample.length,segments=closed?n:n-1;
  for(let i=0;i<segments;i++){
    const p0=sample[closed?(i-1+n)%n:Math.max(0,i-1)],p1=sample[i],p2=sample[(i+1)%n],p3=sample[closed?(i+2)%n:Math.min(n-1,i+2)];
    for(let j=0;j<4;j++){const t=j/4,t2=t*t,t3=t2*t;result.push([0,1].map(k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3)));}
  }
  if(!closed)result.push([...sample.at(-1)]);
  return result;
}
const geometry={normalize,createRect,handles,resizeRect,moveRect,pixelPoint,specifiedRect,specifiedVertices,smoothPoints};
if(typeof module!=='undefined')module.exports=geometry;
if(typeof window!=='undefined')window.ViviRoiGeometry=geometry;
