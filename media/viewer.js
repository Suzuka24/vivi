'use strict';
const vscode = acquireVsCodeApi();
const $ = id => document.getElementById(id);
const formatValue = window.ViviNumberFormat.formatNumber;
const {autoLimits,renderPixels,transformRaw,transformBox,preloadFrameOrder} = window.ViviDisplay;
const escapeHtml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const roiGeometry = window.ViviRoiGeometry;
const lutOptions=[['gray','Grays'],['fire','Fire'],['ice','Ice'],['spectrum','Spectrum'],['rgb332','3-3-2 RGB'],['red','Red'],['green','Green'],['blue','Blue'],['cyan','Cyan'],['magenta','Magenta'],['yellow','Yellow'],['redgreen','Red/Green'],['heat','Heat'],['cool','Cool'],['sepia','Sepia'],['viridis','Viridis'],['plasma','Plasma'],['magma','Magma'],['inferno','Inferno'],['turbo','Turbo']];
lutOptions.push(...[["ij-isocontour","Isocontour"],["ij-gem-16","Gem 16"],["ij-cmy","Cmy"],["ij-cells","Cells"],["ij-neon-blue","Neon Blue"],["ij-cti_ras","Cti Ras"],["ij-hue_ramps_08","Hue Ramps 08"],["ij-neon-red","Neon Red"],["ij-hue_ramps_16","Hue Ramps 16"],["ij-amber","Amber"],["ij-split_blackwhite_warmmetal","Split Blackwhite Warmmetal"],["ij-5_ramps","5 Ramps"],["ij-split_bluered_warmmetal","Split Bluered Warmmetal"],["ij-auxctq","Auxctq"],["ij-003-ice","003 Ice"],["ij-6_shades","6 Shades"],["ij-002-spectrum","002 Spectrum"],["ij-thal_16","Thal 16"],["ij-split_blackwhite_ge","Split Blackwhite Ge"],["ij-split_blackblue_redwhite","Split Blackblue Redwhite"],["ij-cmy-magneta","Cmy Magneta"],["ij-rgb-blue","Rgb Blue"],["ij-gem-256","Gem 256"],["ij-heart","Heart"],["ij-royal","Royal"],["ij-16_colors","16 Colors"],["ij-warhol","Warhol"],["ij-001-fire","001 Fire"],["ij-siemens","Siemens"],["ij-topography","Topography"],["ij-32_colors","32 Colors"],["ij-cold","Cold"],["ij-cool","Cool"],["ij-smart","Smart"],["ij-004-phase","004 Phase"],["ij-blue_orange_icb","Blue Orange Icb"],["ij-cmy-yellow","Cmy Yellow"],["ij-blue_orange","Blue Orange"],["ij-invert_gray","Invert Gray"],["ij-iman","Iman"],["ij-brgbcmyw","Brgbcmyw"],["ij-rgb-red","Rgb Red"],["ij-log_up","Log Up"],["ij-cmy-cyan","Cmy Cyan"],["ij-neon-magenta","Neon Magenta"],["ij-brain","Brain"],["ij-6_reserved_colors","6 Reserved Colors"],["ij-log_down","Log Down"],["ij-cequal","Cequal"],["ij-vivid","Vivid"],["ij-mixed","Mixed"],["ij-sepia","Sepia"],["ij-edges","Edges"],["ij-thallium","Thallium"],["ij-system_lut","System Lut"],["ij-unionjack","Unionjack"],["ij-16_ramps","16 Ramps"],["ij-gold","Gold"],["ij-hue","Hue"],["ij-pastel","Pastel"],["ij-000-gray","000 Gray"],["ij-rgb-green","Rgb Green"],["ij-neon-green","Neon Green"],["ij-gyr_centre","Gyr Centre"],["ij-16_equal","16 Equal"],["ij-20_colors","20 Colors"],["ij-005-random","005 Random"],["ij-thal_256","Thal 256"]]);
lutOptions.sort((a,b)=>a[1].localeCompare(b[1],undefined,{numeric:true,sensitivity:'base'}));
const canvas = $('canvas'), ctx = canvas.getContext('2d');
let sliceAxis = null, errorUntil = 0, errorTimer, transferVisible = true;
let orthogonal = null, orthogonalTimer, orthogonalTicket = 0;
let metadata, dataset, scale = 1, cx = 0, cy = 0, preview, previewBox;
const fileFrames = new Map();
let activeFileFrame = null, frameCache = new Map(), tileMode = false, toolVariant = '';
const toolVariants={roi:'roi',oval:'oval',line:'line'};
const frameLocks = new Set(), lockGroups = {bc:['cuts','low','high','stretch'],color:['cmap','invert','threshold'],view:['cx','cy'],scale:['scale'],slice:['plane']};
let tileRefreshTimer, sidebarTimer, layoutColumns=0, layoutRows=0;
let keyboardShortcuts={fit:'f',pan:'p',roi:'r',oval:'o',line:'l',measure:'m',clear:'escape',undoTransform:'z'};
let roi = null, line = null, selection = null, annotations = [], overlays = [], roiManager = [], vertices = [], drag = null, serial = 0, revision = 0, renderedRevision = -1;
const selectionDefaults={stroke:'#72ebc4',strokeWidth:1.5};
let renderRunning = false, renderWanted = false, renderTimer, pixelTimer, pixelRunning = false;
let playing = false, playbackTimer, analysisRunning = false, blinking = false, blinkTimer;
const pending = new Map();
let cacheSignature = '', cacheGeneration = 0, cacheBytes = 0, preloadRunning = false, preloadRestartWanted = false, preloadTimer, activePng = '';
let sliceHoldTimer, sliceRepeatTimer;
const overviewCache = new Map(), transferHistograms = new Map(), displayBounds = new Map();
const lutTables = new Map();
let overviewBytes = 0, overviewRunning = false;
const fullBox = () => [0, 0, dataset.width, dataset.height];
const fullPreview = () => Math.max(dataset.width, dataset.height) <= metadata.maxSize;
const cacheKey = (frame, box) => `${frame}:${box.join(',')}`;
const overviewKey = (signature, frame) => `${signature}:${frame}`;
const visibleFrameIds = () => [...fileFrames].filter(([,state])=>state.visible!==false).map(([id])=>id);
function tileGeometry(w,h){const ids=visibleFrameIds(),cols=layoutColumns||Math.max(1,layoutRows?Math.ceil(ids.length/layoutRows):Math.ceil(Math.sqrt(ids.length))),rows=Math.max(layoutRows||0,Math.ceil(ids.length/cols),1);return {ids,cols,rows,tw:w/cols,th:h/rows};}
function tilePictureRatio(state,d,picture,w,tw,th){
  const baseRatio=Math.min((tw-16)/d.width,(th-34)/d.height);
  if(!state.tilePreview)return Math.min((tw-16)/picture.width,(th-34)/picture.height);
  const normalScale=Math.min(w/d.width,size().h/d.height)*.96;
  return baseRatio*(state.scale??baseRatio)/normalScale*d.width/picture.width;
}
function sidebarState(){
  if(!dataset)return null;
  return {active:activeFileFrame,activeLabel:metadata.label||metadata.path.split(/[\\/]/).pop(),frames:[...fileFrames].map(([id,state])=>({id,label:state.metadata.label||state.metadata.path.split(/[\\/]/).pop(),visible:state.visible!==false,locked:!!state.lockMember})),
    datasets:metadata.datasets.map(d=>({id:d.id,name:d.name})),datasetId:dataset.id,slice:Number($('frame').value),total:dataset.frames,fps:Number($('fps').value)||5,playing,blinking,tile:tileMode,columns:layoutColumns,rows:layoutRows,locks:[...frameLocks],
    cuts:$('cuts').value,low:$('low').value,high:$('high').value,rangeMin:(displayBounds.get(`${activeFileFrame}:${dataset.id}`)||[])[0]??Number($('low').value),rangeMax:(displayBounds.get(`${activeFileFrame}:${dataset.id}`)||[])[1]??Number($('high').value),stretch:$('stretch').value,cmap:$('cmap').value,luts:lutOptions,invert:$('invert').checked,threshold:$('threshold').checked,bcVisible:transferVisible};
}
function publishSidebar(delay=20){clearTimeout(sidebarTimer);sidebarTimer=setTimeout(()=>{const state=sidebarState();if(state)vscode.postMessage({type:'sidebarState',state});},delay);}
function request(op, args, prefetch = false, fileFrame = activeFileFrame) {
  return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});vscode.postMessage({type:'request',id,op,args,prefetch,fileFrame});});
}
function base() { return {dataset:dataset.id,frame:Number($('frame').value)-1}; }
function size() { return {w:canvas.clientWidth,h:canvas.clientHeight}; }
function tileViewport(){
  const {w,h}=size(),{ids,cols,tw,th}=tileGeometry(w,h),index=ids.indexOf(activeFileFrame);
  if(index<0||!dataset)return null;
  const left=(index%cols)*tw,top=Math.floor(index/cols)*th;
  const state=fileFrames.get(activeFileFrame),picture=state?.tilePreview||preview;
  const pixelsPerImage=picture?tilePictureRatio(state,dataset,picture,w,tw,th)*picture.width/dataset.width:Math.min((tw-16)/dataset.width,(th-34)/dataset.height);
  return {left,top,tw,th,pixelsPerImage};
}
function transform(x,y) {const tile=tileMode?tileViewport():null;if(tile)return [tile.left+tile.tw/2+(x-cx)*tile.pixelsPerImage,tile.top+22+(tile.th-26)/2+(y-cy)*tile.pixelsPerImage];const {w,h}=size();return [(x-cx)*scale+w/2,(y-cy)*scale+h/2]; }
function position(e) {
  const rect=canvas.getBoundingClientRect(),{w,h}=size(),tile=tileMode?tileViewport():null;
  if(tile)return [(e.clientX-rect.left-tile.left-tile.tw/2)/tile.pixelsPerImage+cx,(e.clientY-rect.top-tile.top-22-(tile.th-26)/2)/tile.pixelsPerImage+cy];
  return [(e.clientX-rect.left-w/2)/scale+cx,(e.clientY-rect.top-h/2)/scale+cy];
}
function bounded(p) { return [Math.max(0,Math.min(dataset.width-1,p[0])),Math.max(0,Math.min(dataset.height-1,p[1]))]; }
function visibleBox() {
  const {w,h}=size();
  return [Math.max(0,Math.floor(cx-w/2/scale)),Math.max(0,Math.floor(cy-h/2/scale)),Math.min(dataset.width,Math.ceil(cx+w/2/scale)),Math.min(dataset.height,Math.ceil(cy+h/2/scale))];
}
function clampCenter() { cx=Math.max(0,Math.min(dataset.width,cx));cy=Math.max(0,Math.min(dataset.height,cy)); }
function draw() {
  const {w,h}=size(),dpr=window.devicePixelRatio||1;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;
  if(tileMode){
    const {ids,cols,tw,th}=tileGeometry(w,h);
    ids.forEach((id,index)=>{
      const state=fileFrames.get(id),picture=state.tilePreview||(id===activeFileFrame?preview:state.preview);
      const x=(index%cols)*tw,y=Math.floor(index/cols)*th;
      ctx.fillStyle='#11151b';ctx.fillRect(x+2,y+2,tw-4,th-4);
      if(picture){const d=state.metadata.datasets.find(item=>item.id===(state.datasetId??state.metadata.datasets[0].id));const ratio=tilePictureRatio(state,d,picture,w,tw,th);const pw=picture.width*ratio,ph=picture.height*ratio,centerX=state.tilePreview?(state.cx??d.width/2)/d.width*picture.width:picture.width/2,centerY=state.tilePreview?(state.cy??d.height/2)/d.height*picture.height:picture.height/2;ctx.save();ctx.beginPath();ctx.rect(x+3,y+22,tw-6,th-25);ctx.clip();ctx.drawImage(picture,x+tw/2-centerX*ratio,y+22+(th-26)/2-centerY*ratio,pw,ph);ctx.restore();}
      ctx.strokeStyle=id===activeFileFrame?'#72d4b5':'#7b899450';ctx.lineWidth=id===activeFileFrame?2:1;ctx.strokeRect(x+1,y+1,tw-2,th-2);
      ctx.fillStyle='#d9e2e9';ctx.font='11px sans-serif';ctx.fillText(`${id}: ${state.metadata.label||state.metadata.path.split(/[\\/]/).pop()}`,x+8,y+16,tw-14);
    });
    const active=tileViewport();if(active){ctx.save();ctx.beginPath();ctx.rect(active.left+3,active.top+22,active.tw-6,active.th-25);ctx.clip();}
  }
  if(!tileMode){const frame=Number($('frame').value)-1;
  const overview=overviewCache.get(overviewKey(cacheSignature,frame));
  if(overview)drawEntry(overview);
  for(const [key,entry] of frameCache)if(key.startsWith(`${frame}:`))drawEntry(entry);
  if(!overview&&!frameCache.size&&preview&&previewBox)drawEntry({image:preview,result:{box:previewBox}});
  }
  for(const item of overlays)drawOverlay(item);
  ctx.strokeStyle=selection?.stroke||'#72ebc4';ctx.lineWidth=selection?.strokeWidth||1.5;ctx.setLineDash([5,3]);
  if(selection){
    ctx.beginPath();const pts=selection.points;
    if(selection.type==='roi'&&pts.length>=2){const a=transform(...pts[0]),b=transform(...pts[1]),x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),rw=Math.abs(b[0]-a[0]),rh=Math.abs(b[1]-a[1]);if(selection.variant==='rounded')ctx.roundRect(x,y,rw,rh,Math.min(rw,rh)*.15);else ctx.rect(x,y,rw,rh);}
    else if(selection.type==='oval'&&pts.length>=2){const a=transform(...pts[0]),b=transform(...pts[1]);ctx.ellipse((a[0]+b[0])/2,(a[1]+b[1])/2,Math.max(.5,Math.abs(b[0]-a[0])/2),Math.max(.5,Math.abs(b[1]-a[1])/2),0,0,Math.PI*2);}
    else if(pts.length){const a=transform(...pts[0]);ctx.moveTo(...a);for(const point of pts.slice(1))ctx.lineTo(...transform(...point));if(['roi','polygon','freehand'].includes(selection.type))ctx.closePath();}
    ctx.stroke();
    if(selection.type==='text'){const at=transform(...pts[0]);ctx.fillStyle='#72ebc4';ctx.font='16px sans-serif';ctx.fillText(selection.text||'',at[0],at[1]);}
    if(selection.type==='line'&&selection.variant==='arrow'&&pts.length>=2){const tip=transform(...pts.at(-1)),from=transform(...pts.at(-2)),angle=Math.atan2(tip[1]-from[1],tip[0]-from[0]);ctx.beginPath();for(const d of [-.5,.5]){ctx.moveTo(...tip);ctx.lineTo(tip[0]-12*Math.cos(angle+d),tip[1]-12*Math.sin(angle+d));}ctx.stroke();}
    ctx.setLineDash([]);
    const anchors=['roi','oval'].includes(selection.type)?roiGeometry.handles(selectionRect()):selection.type==='freehand'?[pts[0],pts.at(-1)]:pts;
    ctx.lineWidth=1;for(const point of anchors){const [hx,hy]=transform(...point);ctx.fillStyle='#f7f7f7';ctx.fillRect(hx-3.5,hy-3.5,7,7);ctx.strokeStyle='#26313a';ctx.strokeRect(hx-3.5,hy-3.5,7,7);}
  }else if(roi){const a=transform(roi[0],roi[1]),b=transform(roi[2],roi[3]);ctx.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);}
  if(line&&!selection){const a=transform(line[0],line[1]),b=transform(line[2],line[3]);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}
  ctx.fillStyle='#72ebc4';ctx.font='16px sans-serif';for(const note of annotations){const at=transform(...note.point);ctx.fillText(note.text,at[0],at[1]);}
  if(orthogonal&&!tileMode){const [x,y]=transform(orthogonal.x+.5,orthogonal.y+.5);ctx.save();ctx.strokeStyle='#f4cf65';ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();ctx.restore();drawOrthogonalViews();if(orthogonal.sections&&orthogonal.colorKey!==orthogonalColorKey()&&!orthogonal.colorPending){orthogonal.colorPending=true;queueMicrotask(()=>{if(orthogonal){orthogonal.colorPending=false;colorOrthogonal().catch(showError);}});}}
  ctx.setLineDash([]);if(tileMode&&tileViewport())ctx.restore();if(document.activeElement!==$('zoom'))$('zoom').value=`${formatValue(scale*100)}%`;
}
function orthogonalKey(){
  if(!orthogonal||!dataset)return '';
  const flat=Number($('frame').value)-1, coordinates=[];
  for(let index=0;index<sliceAxes().length;index++)coordinates.push(Math.floor(flat/axisStride(index))%dataset.shape[sliceAxes()[index]]);
  coordinates[axisIndex()]=0;
  return `${activeFileFrame}:${dataset.id}:${orthogonal.axis}:${coordinates.join(',')}:${orthogonal.x}:${orthogonal.y}`;
}
function orthogonalColorKey(){return ['low','high','stretch','cmap'].map(key=>$(key).value).concat($('invert').checked,$('threshold').checked).join(':');}
async function colorOrthogonal(){
  const view=orthogonal;if(!view?.sections)return;
  const ticket=++view.colorTicket,key=orthogonalColorKey(),lut=view.sections.channels>1&&!$('threshold').checked?null:await lutTable($('cmap').value);
  if(view!==orthogonal||ticket!==view.colorTicket)return;
  const settings={low:Number($('low').value),high:Number($('high').value),stretch:$('stretch').value,invert:$('invert').checked,threshold:$('threshold').checked};
  const images={};
  for(const name of ['xz','yz']){
    const section=view.sections[name],surface=document.createElement('canvas');surface.width=section.width;surface.height=section.height;
    surface.getContext('2d').putImageData(new ImageData(renderPixels(section.raw,section.width,section.height,view.sections.channels,settings,lut),section.width,section.height),0,0);
    images[name]=surface;
  }
  view.images=images;view.colorKey=key;drawOrthogonalViews();
}
function orthogonalRect(name,canvas){
  const width=name==='xz'?dataset.width:dataset.height, height=orthogonal.depth,w=canvas.clientWidth,h=canvas.clientHeight;
  const ratio=Math.min(w/width,h/height);return {left:(w-width*ratio)/2,top:(h-height*ratio)/2,ratio,width,height};
}
function drawOrthogonalViews(){
  if(!orthogonal)return;
  for(const name of ['yz','xz']){
    const canvas=$(name==='yz'?'orthYZCanvas':'orthXZCanvas'),g=canvas.getContext('2d'),w=canvas.clientWidth,h=canvas.clientHeight,dpr=window.devicePixelRatio||1;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
    const r=orthogonalRect(name,canvas);if(orthogonal.images?.[name]){g.imageSmoothingEnabled=false;g.drawImage(orthogonal.images[name],r.left,r.top,r.width*r.ratio,r.height*r.ratio);}
    const px=name==='xz'?orthogonal.x:orthogonal.y;
    g.save();g.strokeStyle='#f4cf65';g.lineWidth=1;g.setLineDash([4,3]);g.beginPath();g.moveTo(r.left+(px+.5)*r.ratio,r.top);g.lineTo(r.left+(px+.5)*r.ratio,r.top+r.height*r.ratio);g.moveTo(r.left,r.top+(orthogonal.z+.5)*r.ratio);g.lineTo(r.left+r.width*r.ratio,r.top+(orthogonal.z+.5)*r.ratio);g.stroke();g.restore();
  }
}
function refreshOrthogonal(delay=70){
  if(!orthogonal)return;
  const view=orthogonal,key=orthogonalKey();if(view.sectionKey===key)return;
  clearTimeout(orthogonalTimer);orthogonalTimer=setTimeout(async()=>{
    const ticket=++orthogonalTicket,args={...base(),axis:view.axis,x:view.x,y:view.y};
    try{const result=await request('orthogonal',args);if(view!==orthogonal||ticket!==orthogonalTicket||key!==orthogonalKey())return;
      const decode=(encoded,width,height)=>{const bytes=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));return {raw:new Float32Array(bytes.buffer),width,height};};
      view.sections={channels:result.channels,xz:decode(result.xz.raw,result.xz.width,result.xz.height),yz:decode(result.yz.raw,result.yz.width,result.yz.height)};
      view.sectionKey=key;view.colorKey='';await colorOrthogonal();
    }catch(error){if(view===orthogonal&&ticket===orthogonalTicket)showError(error);}
  },delay);
}
function disableOrthogonal(refit=false){
  if(!orthogonal)return;orthogonal=null;orthogonalTicket++;clearTimeout(orthogonalTimer);
  $('stage').classList.remove('orthogonal');$('orthYZ').hidden=true;$('orthXZ').hidden=true;$('stackOrthogonal').setAttribute('aria-pressed','false');
  if(refit)requestAnimationFrame(()=>{if(dataset)fit();});
}
function toggleOrthogonal(){
  if(orthogonal){disableOrthogonal(true);return;}
  if(!dataset||tileMode||dataset.frames<2||!sliceAxes().length){showError(new Error('Orthogonal Views requires one stack Frame in Single display mode.'));return;}
  orthogonal={axis:sliceAxes()[axisIndex()],x:Math.floor(dataset.width/2),y:Math.floor(dataset.height/2),z:slicePosition()-1,depth:dataset.shape[sliceAxes()[axisIndex()]],sectionKey:'',colorKey:'',colorTicket:0};
  $('stage').classList.add('orthogonal');$('orthYZ').hidden=false;$('orthXZ').hidden=false;$('stackOrthogonal').setAttribute('aria-pressed','true');
  requestAnimationFrame(()=>{fit();refreshOrthogonal(0);});
}
function orthogonalPoint(name,event){
  const view=orthogonal;if(!view)return;
  if(name==='xy'){const [x,y]=bounded(position(event));view.x=Math.floor(x);view.y=Math.floor(y);}
  else {const canvas=$(name==='xz'?'orthXZCanvas':'orthYZCanvas'),rect=canvas.getBoundingClientRect(),r=orthogonalRect(name,canvas),along=Math.max(0,Math.min(r.width-1,Math.floor((event.clientX-rect.left-r.left)/r.ratio))),z=Math.max(0,Math.min(view.depth-1,Math.floor((event.clientY-rect.top-r.top)/r.ratio)));
    if(name==='xz')view.x=along;else view.y=along;
    if(z!==view.z){view.z=z;setAxisSlice(z+1);frameLabel();commitFrameChange('slice');scheduleRender(0);}
  }
  draw();refreshOrthogonal();
}
function drawOverlay(item){
  const points=item.points;if(!points?.length)return;
  ctx.save();ctx.strokeStyle=item.stroke||'#f6bc65';ctx.lineWidth=item.strokeWidth||1.5;ctx.setLineDash([]);ctx.beginPath();
  if(['roi','oval'].includes(item.type)&&points.length>=2){const [x0,y0,x1,y1]=roiGeometry.normalize([...points[0],...points[1]]),a=transform(x0,y0),b=transform(x1,y1);
    if(item.type==='oval')ctx.ellipse((a[0]+b[0])/2,(a[1]+b[1])/2,Math.max(.5,(b[0]-a[0])/2),Math.max(.5,(b[1]-a[1])/2),0,0,Math.PI*2);
    else if(item.variant==='rounded')ctx.roundRect(a[0],a[1],b[0]-a[0],b[1]-a[1],Math.min(b[0]-a[0],b[1]-a[1])*.15);
    else ctx.rect(a[0],a[1],b[0]-a[0],b[1]-a[1]);
  }else{ctx.moveTo(...transform(...points[0]));for(const point of points.slice(1))ctx.lineTo(...transform(...point));if(['polygon','freehand'].includes(item.type))ctx.closePath();}
  ctx.stroke();ctx.restore();
}
function drawEntry(entry){if(!entry.image)return;const box=entry.result.box,[x,y]=transform(box[0],box[1]);ctx.drawImage(entry.image,x,y,(box[2]-box[0])*scale,(box[3]-box[1])*scale);}
function scheduleRender(delay=75) {
  if(!dataset)return;
  clearTimeout(playbackTimer);
  revision++;renderWanted=true;clearTimeout(renderTimer);renderTimer=setTimeout(render,delay);draw();
}
function renderArgs(frame) {
  return {dataset:dataset.id,frame,box:fullPreview()?fullBox():visibleBox(),size:metadata.maxSize,raw:true,cuts:$('cuts').value,low:Number($('low').value),high:Number($('high').value),stretch:$('stretch').value,cmap:$('cmap').value,invert:$('invert').checked,threshold:$('threshold').checked,thresholdLow:Number($('low').value),thresholdHigh:Number($('high').value)};
}
function signatureOf(args) {
  return `${activeFileFrame}:${args.dataset}:${args.size}`;
}
function ensureCache(signature) {
  if (signature === cacheSignature) return;
  frameCache.clear(); cacheBytes = 0; cacheSignature = signature; cacheGeneration++;
  clearTimeout(preloadTimer); updateCacheStatus();
}
function updateCacheStatus() {
  const count=new Set([...frameCache.keys()].map(key=>key.split(':')[0])).size;
  $('cacheStatus').textContent=dataset?.frames>512?`${count} nearby cached`:dataset?.frames>1?`${count}/${dataset.frames} ready`:'';
}
async function lutTable(name){
  if(name==='gray')return null;
  if(!lutTables.has(name))lutTables.set(name,request('lutPreview',{cmap:name}).then(result=>result.rgb).catch(error=>{lutTables.delete(name);throw error;}));
  return lutTables.get(name);
}
async function recolorEntry(entry,args){
  if(!entry.raw)return;
  const limits=args.cuts==='manual'?[args.low,args.high]:args.cuts===entry.baseMode?entry.baseLimits:autoLimits(entry.raw,entry.channels,args.cuts);
  const [low,high]=limits;
  const lut=entry.channels>1&&!args.threshold?null:await lutTable(args.cmap);
  const pixels=renderPixels(entry.raw,entry.result.width,entry.result.height,entry.channels,{...args,low,high},lut);
  const image=entry.image||document.createElement('canvas');image.width=entry.result.width;image.height=entry.result.height;
  image.getContext('2d').putImageData(new ImageData(pixels,image.width,image.height),0,0);
  entry.image=image;entry.result.low=low;entry.result.high=high;
}
async function decodePreview(result,args,paint=true) {
  if(result.raw){
    const binary=atob(result.raw),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    const raw=result.dtype==='float64'?new Float64Array(bytes.buffer):new Float32Array(bytes.buffer);
    delete result.raw;
    const entry={image:null,raw,channels:result.channels,result,sourceFrame:args.frame,sourceDataset:args.dataset,baseMode:args.cuts,baseLimits:[result.low,result.high],bytes:raw.byteLength};
    if(paint)await recolorEntry(entry,args);
    return entry;
  }
  const image=new Image();image.src='data:image/png;base64,'+result.png;await image.decode();
  return {image,result,bytes:image.width*image.height*4+result.png.length*.75};
}
function showPreview(entry, ticket) {
  if (ticket !== revision) return;
  preview = entry.image; previewBox = entry.result.box; activePng = entry.result.png||'';
  renderedRevision = ticket; $('empty').hidden = true; clearExpiredError();
  if ($('cuts').value !== 'manual') {
    $('low').value = entry.result.low; $('high').value = entry.result.high;
    $('cuts').value='manual';
    commitFrameChange('bc');
  }
  $('busy').textContent = ''; draw();drawTransferCurve();
  loadTransferHistogram();publishSidebar();
}
function scheduleOverview() {
  if(fullPreview()||overviewRunning||renderRunning||renderWanted)return;
  const frame=Number($('frame').value)-1,signature=cacheSignature,key=overviewKey(signature,frame);
  if(overviewCache.has(key))return;
  overviewRunning=true;
  const args={...renderArgs(frame),box:fullBox()};
  request('render',args,true).then(result=>decodePreview(result,args)).then(entry=>{
    if(cacheSignature!==signature)return;
    overviewCache.set(key,entry);overviewBytes+=entry.bytes;
    while(overviewBytes>128*1024*1024&&overviewCache.size>1){const oldest=overviewCache.keys().next().value;overviewBytes-=overviewCache.get(oldest).bytes;overviewCache.delete(oldest);}
    draw();
  }).catch(()=>{}).finally(()=>{overviewRunning=false;if(dataset&&!renderRunning&&!renderWanted)schedulePreload();});
}
function schedulePlayback() {
  if (playing && !renderWanted) playbackTimer = setTimeout(() => changeFrame(1,true), 1000/Math.max(1,Math.min(30,Number($('fps').value)||5)));
}
function schedulePreload() {
  if (!dataset)return;
  scheduleOverview();
  if(dataset.frames<2)return;
  if (preloadRunning) { preloadRestartWanted = true; return; }
  clearTimeout(preloadTimer); preloadTimer = setTimeout(preloadFrames, 180);
}
async function preloadFrames() {
  if (preloadRunning || renderRunning || renderWanted || !dataset || dataset.frames < 2) return;
  preloadRunning = true;
  const generation = cacheGeneration, signature = cacheSignature, active = Number($('frame').value)-1;
  const limit = Math.max(32,Number(metadata.preloadMaxMiB)||768)*1024*1024;
  const estimate = Math.min(dataset.width,metadata.maxSize)*Math.min(dataset.height,metadata.maxSize)*4;
  // Large FITS cubes can contain thousands of slices. Bound background SSH traffic,
  // while continuing to preload every slice of ordinary-sized stacks.
  const order=preloadFrameOrder(dataset.frames,active,estimate);
  try {
    for (const frame of order) {
      if (generation !== cacheGeneration || renderRunning || renderWanted) break;
      const args = renderArgs(frame),key=cacheKey(frame,args.box);
      if (frameCache.has(key)) continue;
      if (signatureOf(args) !== signature) break;
      if (cacheBytes + estimate > limit) break;
      try {
        const entry = await decodePreview(await request('render',args,true),args,false);
        if (generation !== cacheGeneration) break;
        frameCache.set(key,entry); cacheBytes += entry.bytes; updateCacheStatus();
      } catch { break; }
    }
  } finally {
    preloadRunning = false;
    if (preloadRestartWanted) { preloadRestartWanted = false; schedulePreload(); }
  }
}
async function render() {
  if(renderRunning||!renderWanted||!dataset)return;
  renderWanted=false;const ticket=revision, frame=Number($('frame').value)-1;
  const args=renderArgs(frame), signature=signatureOf(args);
  ensureCache(signature);
  const key=cacheKey(frame,args.box),cached=frameCache.get(key);
  if(cached){
    try{
      for(const [entryKey,entry] of frameCache)if(entryKey.startsWith(`${frame}:`))await recolorEntry(entry,args);
      const overview=overviewCache.get(overviewKey(signature,frame));if(overview)await recolorEntry(overview,args);
      showPreview(cached,ticket);schedulePlayback();schedulePreload();
    }
    catch(error){showError(error);}
    return;
  }
  renderRunning=true;
  if (!preview) $('busy').textContent='Loading…';
  try {
    const entry=await decodePreview(await request('render',args),args);
    if (cacheSignature === signature) {frameCache.set(key,entry);cacheBytes += entry.bytes;updateCacheStatus();trimFrameCache();}
    showPreview(entry,ticket);
  } catch(error){showError(error);stopPlay();}
  finally{renderRunning=false;if(renderWanted)render();else{schedulePlayback();schedulePreload();}}
}
function trimFrameCache(){
  const limit=Math.max(32,Number(metadata.preloadMaxMiB)||768)*1024*1024;
  while(cacheBytes>limit&&frameCache.size>1){const oldest=frameCache.keys().next().value;cacheBytes-=frameCache.get(oldest).bytes;frameCache.delete(oldest);}
}
function clearExpiredError(){if(Date.now()>=errorUntil)$('error').textContent='';}
function showError(error){$('error').textContent=error.message;errorUntil=Date.now()+2500;clearTimeout(errorTimer);errorTimer=setTimeout(clearExpiredError,2600);$('busy').textContent='Error';}
function fit(){if(!dataset)return;const {w,h}=size();scale=Math.min(w/dataset.width,h/dataset.height)*.96;cx=dataset.width/2;cy=dataset.height/2;commitFrameChange('view');commitFrameChange('scale');scheduleRender(0);}
const zoomLevels=[1/72,1/48,1/32,1/24,1/16,1/12,1/8,1/6,1/4,1/3,1/2,.75,1,1.5,2,3,4,6,8,12,16,24,32];
function zoom(direction,anchor=null){
  if(!dataset)return;
  const old=scale,epsilon=1e-9;
  const next=direction>0?zoomLevels.find(value=>value>old+epsilon):[...zoomLevels].reverse().find(value=>value<old-epsilon);
  if(!next)return;
  scale=next;
  if(anchor){cx=anchor[0]-(anchor[0]-cx)*old/scale;cy=anchor[1]-(anchor[1]-cy)*old/scale;}
  clampCenter();commitFrameChange('scale');if(anchor)commitFrameChange('view');scheduleRender();
}
function stopPlay(){playing=false;clearTimeout(playbackTimer);$('playIcon').setAttribute('href','#i-play');$('play').title='Play frames';syncViewerToolbar();publishSidebar();}
function frameLabel(){
  let n=Number($('frame').value)-1;
  const coordinates=[];
  for(const axis of [...dataset.extra].reverse()){
    const length=dataset.shape[axis];
    coordinates.unshift(`${dataset.axes?.[axis]||`D${axis}`} ${n%length+1}`);
    n=Math.floor(n/length);
  }
  $('frameCount').textContent=`/ ${dataset.frames}${coordinates.length>1?' · '+coordinates.join(' '):''}`;
  const sourceName=metadata.sliceLabels?.[Number($('frame').value)-1]||'';
  $('sliceName').textContent=sourceName;$('sliceName').title=sourceName;
  syncViewerToolbar();
  if(orthogonal){orthogonal.z=slicePosition()-1;drawOrthogonalViews();refreshOrthogonal();}
  publishSidebar();
}
function sliceAxes(){return dataset?.extra||[];}
function axisIndex(){const axes=sliceAxes();return axes.includes(sliceAxis)?axes.indexOf(sliceAxis):Math.max(0,axes.length-1);}
function axisStride(index){return sliceAxes().slice(index+1).reduce((product,axis)=>product*dataset.shape[axis],1);}
function slicePosition(){const index=axisIndex(),axis=sliceAxes()[index];return axis===undefined?Number($('frame').value):Math.floor((Number($('frame').value)-1)/axisStride(index))%dataset.shape[axis]+1;}
function setAxisSlice(value){const index=axisIndex(),axis=sliceAxes()[index];if(axis===undefined){$('frame').value=value;return;}const stride=axisStride(index),length=dataset.shape[axis],flat=Number($('frame').value)-1,current=Math.floor(flat/stride)%length,next=Math.max(0,Math.min(length-1,Math.round(value)-1));$('frame').value=flat+(next-current)*stride+1;}
function syncViewerToolbar(){
  if(!dataset)return;
  $('tool-slices').hidden=dataset.frames<2;
  const select=$('viewerDataset');
  if(select){if(select.options.length!==metadata.datasets.length||[...select.options].some((option,index)=>Number(option.value)!==metadata.datasets[index].id)){select.replaceChildren();for(const item of metadata.datasets){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}}select.value=String(dataset.id);}
  const axis=$('viewerAxis'),axes=sliceAxes();axis.hidden=axes.length<2;
  if(!axis.hidden){if(axis.options.length!==axes.length||[...axis.options].some((option,index)=>Number(option.value)!==[...axes].reverse()[index])){axis.replaceChildren();for(const index of [...axes].reverse()){const option=document.createElement('option');option.value=index;option.textContent=`Axis ${dataset.shape.length-index} · ${dataset.axes?.[index]||'D'} (${dataset.shape[index]})`;axis.append(option);}}axis.value=String(axes[axisIndex()]);}
  const length=axes.length?dataset.shape[axes[axisIndex()]]:dataset.frames,position=slicePosition();
  $('viewerSliceRange').max=String(length);$('viewerSliceRange').value=position;$('viewerSliceRange').disabled=length<2;
  $('viewerSliceNumber').max=String(length);$('viewerSliceNumber').value=position;
  $('viewerSliceCount').textContent=`/ ${length}`;
  for(const id of ['viewerSlicePrev','viewerSliceNext','viewerSlicePlay'])$(id).disabled=length<2;
  $('viewerSlicePlay').textContent=playing?'Ⅱ':'▶';
  if(document.activeElement!==$('viewerSliceFps'))$('viewerSliceFps').value=$('fps').value;
  const dtype=String(dataset.dtype||''),bits=Number(dtype.match(/\d+/)?.[0])||8,channels=String(dataset.axes||'').endsWith('S')?dataset.shape.at(-1):1;
  const bytes=dataset.width*dataset.height*channels*bits/8,sizeLabel=bytes<1048576?`${formatValue(bytes/1024)}KB`:`${formatValue(bytes/1048576)}MB`;
  $('imageSummary').textContent=`${dataset.width}×${dataset.height} (${dataset.width}×${dataset.height}); ${channels===3?'RGB':bits+'-bit'}; ${sizeLabel}`;
  drawTransferCurve();
}
function changeFrame(delta, automatic=false){if(!dataset)return;const total=sliceAxes().length?dataset.shape[sliceAxes()[axisIndex()]]:dataset.frames;let position=slicePosition()-1+delta;if(automatic)position=(position+total)%total;else position=Math.max(0,Math.min(total-1,position));setAxisSlice(position+1);frameLabel();$('pixel').textContent='';commitFrameChange('slice');scheduleRender(0);}
function loadTransferHistogram(){
  if(!dataset)return;
  const key=`${activeFileFrame}:${dataset.id}:${Number($('frame').value)-1}`;
  if(transferHistograms.has(key))return;
  transferHistograms.set(key,null);
  const boundKey=`${activeFileFrame}:${dataset.id}`;
  request('histogram',{...base(),bins:128},true).then(result=>{transferHistograms.set(key,result);if(!displayBounds.has(boundKey)&&Number.isFinite(result.min)&&Number.isFinite(result.max)&&result.max>result.min)displayBounds.set(boundKey,[result.min,result.max]);if(key===`${activeFileFrame}:${dataset?.id}:${Number($('frame').value)-1}`){drawTransferCurve();publishSidebar();}}).catch(()=>transferHistograms.delete(key));
}
function drawTransferCurve(){
  const canvas=$('transferCurve'),g=canvas.getContext('2d'),w=canvas.width,h=canvas.height,low=Number($('low').value),high=Number($('high').value);if(!Number.isFinite(low)||!Number.isFinite(high))return;
  const histogram=transferHistograms.get(`${activeFileFrame}:${dataset?.id}:${Number($('frame').value)-1}`);
  const bounds=displayBounds.get(`${activeFileFrame}:${dataset?.id}`),span=Math.max(Number.MIN_VALUE,high-low),start=bounds?.[0]??histogram?.min??low,end=bounds?.[1]??histogram?.max??high,extent=Math.max(Number.MIN_VALUE,end-start),x=value=>Math.max(0,Math.min(w,(value-start)/extent*w));
  g.fillStyle='#1a2028';g.fillRect(0,0,w,h);
  if(histogram){const peak=Math.max(1,...histogram.counts);g.fillStyle='#55626d';for(let i=0;i<histogram.counts.length;i++){const height=Math.min(h-4,histogram.counts[i]/peak*(h-4));g.fillRect(i*w/histogram.counts.length,h-height,Math.max(1,w/histogram.counts.length),height);}}
  const y=value=>h-Math.max(0,Math.min(1,(value-low)/span))*h;
  g.strokeStyle='#586673';g.strokeRect(.5,.5,w-1,h-1);g.strokeStyle='#72d4b5';g.lineWidth=2;g.beginPath();g.moveTo(0,y(start));if(low>start&&low<end)g.lineTo(x(low),h);if(high>start&&high<end)g.lineTo(x(high),0);g.lineTo(w,y(end));g.stroke();
  g.fillStyle='#d5e4e7';for(const value of [low,high]){const px=x(value);g.fillRect(Math.max(0,Math.min(w-1,px)),h-5,1,5);}
  $('transferLow').textContent=formatValue(low);$('transferHigh').textContent=formatValue(high);
}
function selectDataset(){disableOrthogonal();dataset=metadata.datasets.find(d=>d.id===Number($('dataset').value));sliceAxis=dataset.extra?.at(-1)??null;$('frame').value=1;$('frame').max=dataset.frames;frameLabel();$('play').disabled=dataset.frames<2;roi=null;line=null;selection=null;annotations=[];overlays=[];roiManager=[];vertices=[];preview=null;activePng='';stopPlay();$('metadata').textContent=`${dataset.width} × ${dataset.height}\n${dataset.dtype} · ${metadata.kind}\nShape: ${dataset.shape.join(' × ')}\nAxes: ${dataset.axes||'FITS (..., Y, X)'}`;fit();}
function saveFileFrame() {
  if (!activeFileFrame || !fileFrames.has(activeFileFrame)) return;
  Object.assign(fileFrames.get(activeFileFrame), {metadata,datasetId:dataset?.id,plane:Number($('frame').value),sliceAxis,scale,cx,cy,preview,previewBox,activePng,frameCache,cacheSignature,cacheBytes,
    cuts:$('cuts').value,low:$('low').value,high:$('high').value,stretch:$('stretch').value,cmap:$('cmap').value,invert:$('invert').checked,threshold:$('threshold').checked,roi,line,selection,annotations,overlays,roiManager,calibration});
}
function scheduleTileRefresh(delay=80){if(!tileMode)return;clearTimeout(tileRefreshTimer);tileRefreshTimer=setTimeout(refreshTilePreviews,delay);}
function refreshTilePreviews(){
  if(!tileMode)return;
  saveFileFrame();
  for(const [id,state] of fileFrames){
    if(state.visible===false)continue;
    const d=state.metadata.datasets.find(item=>item.id===(state.datasetId??state.metadata.datasets[0].id));
    if(!d)continue;
    const args={dataset:d.id,frame:Math.max(0,Math.min(d.frames-1,(state.plane||1)-1)),box:[0,0,d.width,d.height],size:Math.min(1024,state.metadata.maxSize),raw:true,cuts:state.cuts||'percentile',low:Number(state.low??0),high:Number(state.high??1),stretch:state.stretch||'linear',cmap:state.cmap||'gray',invert:!!state.invert,threshold:!!state.threshold,thresholdLow:Number(state.low??0),thresholdHigh:Number(state.high??1)};
    const signature=JSON.stringify(args);
    if(signature===state.tileSignature)continue;
    state.tileSignature=signature;
    const generation=(state.tileGeneration||0)+1;state.tileGeneration=generation;
    const cached=state.frameCache?.get(cacheKey(args.frame,args.box))||state.tileEntry;
    const reusable=cached&&cached.sourceFrame===args.frame&&cached.sourceDataset===args.dataset&&cached.result.box.join(',')===args.box.join(',');
    const source=reusable?Promise.resolve(cached):request('render',args,true,id).then(result=>decodePreview(result,args,false));
    source.then(async entry=>{if(fileFrames.get(id)!==state||state.tileGeneration!==generation)return;await recolorEntry(entry,args);state.tileEntry=entry;state.tilePreview=entry.image;draw();}).catch(()=>{if(state.tileGeneration===generation)state.tileSignature='';});
  }
}
function commitFrameChange(group){
  if(!activeFileFrame||!fileFrames.has(activeFileFrame))return;
  saveFileFrame();
  publishSidebar();
  if(!frameLocks.has(group)||!fileFrames.get(activeFileFrame)?.lockMember){
    if(['bc','color','slice'].includes(group))scheduleTileRefresh();else if(tileMode)draw();
    return;
  }
  if(group==='bc'&&$('cuts').value!=='manual')return;
  const active=fileFrames.get(activeFileFrame),keys=lockGroups[group];
  for(const [id,state] of fileFrames){
    if(id===activeFileFrame||!state.lockMember)continue;
    for(const key of keys)state[key]=active[key];
    if(group==='slice'){
      const d=state.metadata.datasets.find(item=>item.id===(state.datasetId??state.metadata.datasets[0].id));
      state.plane=Math.max(1,Math.min(d.frames,active.plane));
    }
    if(group==='bc'||group==='color'||group==='slice')state.tileSignature='';
  }
  if(['bc','color','slice'].includes(group))scheduleTileRefresh();else if(tileMode)draw();
}
function setFrameLock(group,enabled){
  if(enabled)frameLocks.add(group);else frameLocks.delete(group);
  if(enabled&&group==='bc'&&$('cuts').value!=='manual')$('cuts').value='manual';
  if(enabled)commitFrameChange(group);
  frameList();
}
function setFrameLockMember(id,enabled){
  const state=fileFrames.get(id);if(!state)return;
  const wasActive=id===activeFileFrame;
  if(enabled&&!state.lockMember){
    if(wasActive){
      saveFileFrame();
      const other=[...fileFrames].find(([key,item])=>key!==id&&item.lockMember)?.[0]||[...fileFrames.keys()].find(key=>key!==id);
      if(other)selectFileFrame(other);
    }
    const source=[...fileFrames].find(([other,item])=>other!==id&&item.lockMember)?.[1];
    if(source)for(const group of frameLocks)for(const key of lockGroups[group])state[key]=source[key];
    if(source){state.frameCache?.clear();state.cacheSignature='';state.cacheBytes=0;state.tileSignature='';}
  }
  state.lockMember=enabled;
  if(wasActive&&activeFileFrame!==id)selectFileFrame(id);
  frameList();if(tileMode)scheduleTileRefresh(0);
}
function frameList() {
  const box=$('fileFrames'); box.replaceChildren();
  for(const [id,state] of fileFrames){
    const option=document.createElement('option'); option.value=id; option.textContent=`${id}: ${state.metadata.label||state.metadata.path.split(/[\\/]/).pop()}`; box.append(option);
  }
  box.value=String(activeFileFrame);
  $('filePosition').textContent=`${[...fileFrames.keys()].indexOf(activeFileFrame)+1}/${fileFrames.size}`;
  $('closeFileFrame').disabled=false;
  $('tile').classList.toggle('selected',tileMode);
  $('lockView').classList.toggle('selected',frameLocks.size>0);
  $('lockView').title=frameLocks.size?`Locked: ${[...frameLocks].join(', ')}. Click to unlock all.`:'Lock all Frame parameters';
  for(const input of document.querySelectorAll('[data-frame-lock]'))input.checked=frameLocks.has(input.dataset.frameLock);
  publishSidebar();
}
function transformCachedState(id,state,action,oldDataset){
  if(!oldDataset||!['flipHorizontal','flipVertical','rotateLeft','rotateRight','rotate180'].includes(action))return false;
  const transformed=new Set();
  const update=entry=>{
    if(!entry?.raw||transformed.has(entry))return;
    transformed.add(entry);
    const result=transformRaw(entry.raw,entry.result.width,entry.result.height,entry.channels,action);
    entry.raw=result.raw;entry.result.box=transformBox(entry.result.box,oldDataset.width,oldDataset.height,action);
    entry.result.width=result.width;entry.result.height=result.height;entry.image=null;
  };
  const next=new Map();
  for(const entry of state.frameCache?.values()||[]){update(entry);next.set(cacheKey(entry.sourceFrame,entry.result.box),entry);}
  state.frameCache=next;
  update(state.tileEntry);
  for(const [key,entry] of overviewCache)if(key.startsWith(`${id}:`))update(entry);
  state.preview=null;state.previewBox=null;state.tilePreview=null;state.tileSignature='';
  return transformed.size>0;
}
function selectFileFrame(id) {
  id=Number(id); if(!fileFrames.has(id)||id===activeFileFrame)return;
  disableOrthogonal();
  const oldId=activeFileFrame;
  saveFileFrame(); stopPlay(); stopSliceHold(); clearTimeout(renderTimer); clearTimeout(preloadTimer); revision++; cacheGeneration++;
  activeFileFrame=id;
  const state=fileFrames.get(id); metadata=state.metadata;
  if($('editUndo'))$('editUndo').disabled=!metadata.canUndo;
  if($('editRedo'))$('editRedo').disabled=!metadata.canRedo;
  $('filename').textContent=metadata.label||metadata.path.split(/[\\/]/).pop(); $('filename').title=metadata.path;
  $('warning').textContent=metadata.warning; $('dataset').replaceChildren();
  for(const d of metadata.datasets){const option=document.createElement('option');option.value=d.id;option.textContent=d.name;$('dataset').append(option);}
  $('dataset').value=String(state.datasetId??metadata.datasets[0].id);
  dataset=metadata.datasets.find(d=>d.id===Number($('dataset').value));sliceAxis=state.sliceAxis??dataset.extra?.at(-1)??null;
  $('frame').value=state.plane||1; $('frame').max=dataset.frames; frameLabel(); $('play').disabled=dataset.frames<2;
  scale=state.scale??1; cx=state.cx??dataset.width/2; cy=state.cy??dataset.height/2;
  preview=state.preview||null; previewBox=state.previewBox||null; activePng=state.activePng||'';
  frameCache=state.frameCache||new Map(); cacheSignature=state.cacheSignature||''; cacheBytes=state.cacheBytes||0;
  roi=state.roi||null; line=state.line||null; selection=state.selection||null;annotations=state.annotations||[];overlays=state.overlays||[];roiManager=state.roiManager||[];vertices=[];
  calibration=state.calibration||{factor:1,unit:'px'};
  for(const key of ['cuts','low','high','stretch','cmap']) $(key).value=state[key]??(key==='cuts'?'percentile':key==='stretch'?'linear':key==='cmap'?'gray':key==='low'?'0':'1');
  $('invert').checked=!!state.invert; $('threshold').checked=!!state.threshold;
  $('frame').value=Math.max(1,Math.min(dataset.frames,Number($('frame').value)));frameLabel();clampCenter();
  $('metadata').textContent=`${dataset.width} × ${dataset.height}\n${dataset.dtype} · ${metadata.kind}\nShape: ${dataset.shape.join(' × ')}\nAxes: ${dataset.axes||'FITS (..., Y, X)'}`;
  $('empty').hidden=!!preview; clearExpiredError(); $('busy').textContent='';
  frameList(); updateCacheStatus();
  if(!state.preview&&!state.scale){const {w,h}=size();scale=Math.min(w/dataset.width,h/dataset.height)*.96;if(!frameLocks.has('view')){cx=dataset.width/2;cy=dataset.height/2;}saveFileFrame();}
  draw();scheduleRender(0);
  if(tileMode)scheduleTileRefresh();
  vscode.postMessage({type:'activeFrame',frameId:id});
}
function moveFileFrame(delta){const ids=visibleFrameIds(),at=ids.indexOf(activeFileFrame),next=ids[(at+delta+ids.length)%ids.length];if(next)selectFileFrame(next);}
function closeFileFrame(id=activeFileFrame){
  id=Number(id);if(!fileFrames.has(id))return;
  if(fileFrames.size===1){vscode.postMessage({type:'closeFrame',frameId:id});return;}
  if(id===activeFileFrame){const next=visibleFrameIds().find(value=>value!==id)||[...fileFrames.keys()].find(value=>value!==id);fileFrames.get(next).visible=true;selectFileFrame(next);}
  fileFrames.delete(id);vscode.postMessage({type:'closeFrame',frameId:id});frameList();draw();
}
function chart(values){const c=$('chart'),g=c.getContext('2d'),w=c.width,h=c.height;g.clearRect(0,0,w,h);const good=values.filter(Number.isFinite);c.classList.toggle('has-data',!!good.length);if(!good.length)return;let min=Math.min(...good),max=Math.max(...good);if(max===min)max=min+1;g.strokeStyle='#72d4b5';g.lineWidth=1;g.beginPath();let pen=false;values.forEach((v,i)=>{if(!Number.isFinite(v)){pen=false;return;}const x=8+i/Math.max(1,values.length-1)*(w-16),y=h-8-(v-min)/(max-min)*(h-16);if(pen)g.lineTo(x,y);else g.moveTo(x,y);pen=true;});g.stroke();}
const measurementHistory=[];
let measurementFields=new Set(["Area","Mean","Std","Min","Max","Sum"]);
let calibration={factor:1,unit:"px"};
async function analyze(op){if(!dataset||analysisRunning)return;if(op==='measure'&&selection?.type==='angle'&&selection.points.length===3){const [a,b,c]=selection.points,u=[a[0]-b[0],a[1]-b[1]],v=[c[0]-b[0],c[1]-b[1]],cos=(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v));$('analysis').textContent=`Angle: ${formatValue(Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI)}°`;chart([]);$('analysisPane').hidden=false;return;}if(op==='profile'&&!line){showError(new Error('Choose Line [L] and draw a line first.'));return;}stopPlay();analysisRunning=true;$('busy').textContent='Analyzing…';const args={...base(),box:roi||undefined,points:line,selection};try{const r=await request(op,args);clearExpiredError();if(op==='measure'){measurementHistory.push({...r,label:metadata.label||metadata.path.split(/[\\/]/).pop(),slice:Number($('frame').value)});$('analysis').textContent=`Frame: ${r.frame+1} · Dataset: ${r.dataset}\nROI: ${r.box.join(', ')}\nArea: ${formatValue(r.area*calibration.factor*calibration.factor)} ${calibration.unit}²\nFinite pixels: ${formatValue(r.count)}\nMean: ${formatValue(r.mean)}\nStd (population): ${formatValue(r.std)}\nMin: ${formatValue(r.min)}\nMax: ${formatValue(r.max)}\nSum: ${formatValue(r.sum)}`.split('\n').filter(line=>!['Area','Mean','Std','Min','Max','Sum'].some(field=>line.startsWith(field+':')&&!measurementFields.has(field))).join('\n');chart([]);}else if(op==='histogram'){$('analysis').textContent=`Histogram · ${formatValue(r.samples)} samples\n${r.sampled?'Sampled; stride '+formatValue(r.step):'All pixels'}\nX: ${formatValue(r.edges[0])} … ${formatValue(r.edges.at(-1))}\nY: count per bin`;chart(r.counts);}else{$('analysis').textContent=`Profile · ${formatValue(r.values.length)} points\nLength: ${formatValue(r.distance.at(-1))} px\nX: distance · Y: raw value\nNearest-neighbor samples`;chart(r.values);}$('analysisPane').hidden=false;$('busy').textContent='';}catch(error){showError(error);}finally{analysisRunning=false;}}
canvas.addEventListener('wheel',e=>{e.preventDefault();if(orthogonal){changeFrame(e.deltaY>0?1:-1);return;}if(dataset)zoom(e.deltaY<0?1:-1,position(e));},{passive:false});
function showPopup(menu,event,items){event.preventDefault();menu.replaceChildren();for(const [label,run] of items){const button=document.createElement('button');button.textContent=label;button.disabled=!run;if(run)button.onclick=()=>{menu.hidden=true;run();};menu.append(button);}menu.hidden=false;menu.style.left=Math.min(event.clientX,window.innerWidth-menu.offsetWidth-6)+'px';menu.style.top=Math.min(event.clientY,window.innerHeight-menu.offsetHeight-6)+'px';}
canvas.oncontextmenu=e=>{if(e.altKey||!dataset)return;if($('tool').value==='zoom'){e.preventDefault();zoom(-1,position(e));return;}const point=position(e);const selected=selection&&vertices.length===0&&!e.shiftKey&&(hitSelectionHandle(e)>=0||insideSelection(point));
  const items=selected?[
    ['ROI Properties…',()=>openSelectionDialog(true)],['Specify…',()=>openSelectionDialog(false)],
    ['ROI Defaults…',openRoiDefaults],['Add to Overlay',addSelectionToOverlay],['Add to ROI Manager',addSelectionToManager],
    ['Duplicate Image…',openDuplicateDialog],
    ['Fit Spline',['polygon','freehand','line'].includes(selection.type)?fitSelectionSpline:null],['Create Mask',createSelectionMask],['Measure',()=>analyze('measure')]
  ]:[['Rename…',()=>vscode.postMessage({type:'imageAction',action:'rename',frameId:activeFileFrame})],['Duplicate…',openDuplicateDialog],['Original Scale',()=>$('actual').click()],['Fit to Window',()=>$('fit').click()],['Brightness/Contrast…',openBCDialog],['Measure',()=>analyze('measure')],['Clear Selection',()=>$('clear').click()],['Monitor Memory…',()=>vscode.postMessage({type:'imageAction',action:'memory',frameId:activeFileFrame})]];
  showPopup($('imageContextMenu'),e,items);
};
function selectionBounds(points,type=selection?.type){
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const extra=['roi','oval'].includes(type)?0:1;
  const x0=Math.max(0,Math.floor(Math.min(...xs))),y0=Math.max(0,Math.floor(Math.min(...ys)));
  return [x0,y0,Math.max(x0+1,Math.min(dataset.width,Math.ceil(Math.max(...xs))+extra)),Math.max(y0+1,Math.min(dataset.height,Math.ceil(Math.max(...ys))+extra))];
}
function rectPoints(rect){return [[rect[0],rect[1]],[rect[2],rect[3]]];}
function selectionRect(){return selection&&['roi','oval'].includes(selection.type)?roiGeometry.normalize([...selection.points[0],...selection.points[1]]):null;}
function hitSelectionHandle(e){
  if(!selection)return -1;
  const rect=selectionRect(),points=rect?roiGeometry.handles(rect):selection.type==='freehand'?[selection.points[0],selection.points.at(-1)]:selection.points;
  const canvasRect=canvas.getBoundingClientRect(),sx=e.clientX-canvasRect.left,sy=e.clientY-canvasRect.top;
  return points.findIndex(point=>{const [x,y]=transform(...point);return Math.abs(x-sx)<=6&&Math.abs(y-sy)<=6;});
}
function insideSelection(point){
  if(!selection)return false;
  const rect=selectionRect();
  if(rect){const [x0,y0,x1,y1]=rect;if(point[0]<x0||point[0]>x1||point[1]<y0||point[1]>y1)return false;if(selection.type==='roi')return true;return Math.pow((point[0]-(x0+x1)/2)/Math.max(.5,(x1-x0)/2),2)+Math.pow((point[1]-(y0+y1)/2)/Math.max(.5,(y1-y0)/2),2)<=1;}
  const pts=selection.points;
  if(selection.type==='line'||selection.type==='angle')return pts.slice(1).some((b,i)=>{const a=pts[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy)<6/scale;});
  let hit=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++)if((pts[i][1]>point[1])!==(pts[j][1]>point[1])&&point[0]<(pts[j][0]-pts[i][0])*(point[1]-pts[i][1])/(pts[j][1]-pts[i][1])+pts[i][0])hit=!hit;return hit;
}
function refreshSelection(){if(!selection)return;roi=selectionBounds(selection.points);line=selection.type==='line'?[...selection.points[0],...selection.points.at(-1)]:null;$('region').textContent=`${selection.type} · ${roi.join(', ')}`;draw();}
function dragEditedSelection(e,point){
  const original=drag.original,center=!!(e.ctrlKey||e.metaKey),shift=e.shiftKey;
  if(drag.tool==='editHandle'){
    if(['roi','oval'].includes(original.type))selection.points=rectPoints(roiGeometry.resizeRect(drag.rect,drag.handle,point,{shift,center,aspect:e.altKey}));
    else{selection.points=original.points.map(p=>[...p]);selection.points[drag.handle]=point;}
  }else{
    let dx=point[0]-drag.point[0],dy=point[1]-drag.point[1];
    if(['roi','oval'].includes(original.type))selection.points=rectPoints(roiGeometry.moveRect(drag.rect,dx,dy,dataset.width,dataset.height,{shift}));
    else{if(shift){if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0;}selection.points=original.points.map(p=>[Math.max(0,Math.min(dataset.width-1,p[0]+dx)),Math.max(0,Math.min(dataset.height-1,p[1]+dy))]);}
  }
  selection.points=selection.points.map(p=>roiGeometry.pixelPoint(p,dataset.width,dataset.height));
  refreshSelection();
}
function finishSelection(type,points){
  if(points.length<2)return;
  selection={type,variant:toolVariant,points:points.map(p=>[...p]),...selectionDefaults};
  roi=selectionBounds(points); line=type==='line'?[...points[0],...points.at(-1)]:null;
  $('region').textContent=`${type} · ${roi.join(', ')}`;
  vertices=[];draw();
}
canvas.onpointerdown=e=>{
  if(!dataset)return;canvas.focus();
  if(orthogonal&&e.button===0){canvas.setPointerCapture(e.pointerId);drag={tool:'orthogonal'};orthogonalPoint('xy',e);return;}
  if(tileMode){const rect=canvas.getBoundingClientRect(),{ids,cols,rows}=tileGeometry(rect.width,rect.height),col=Math.floor((e.clientX-rect.left)/(rect.width/cols)),row=Math.floor((e.clientY-rect.top)/(rect.height/rows)),id=ids[row*cols+col];if(!id)return;if(id!==activeFileFrame){selectFileFrame(id);draw();return;}}
  if(e.button===2&&!e.altKey)return;
  stopPlay();const raw=bounded(position(e)),tool=e.button===2?'contrast':e.button===1?'pan':$('tool').value;
  const point=['roi','oval','polygon','freehand','line','angle'].includes(tool)?roiGeometry.pixelPoint(raw,dataset.width,dataset.height):raw;
  if(e.button===0&&selection&&['roi','oval','polygon','freehand','line','angle'].includes(tool)){
    const handle=hitSelectionHandle(e);
    if(handle>=0||insideSelection(point)){
      canvas.setPointerCapture(e.pointerId);
      drag={tool:handle>=0?'editHandle':'editMove',handle,point,screen:[e.clientX,e.clientY],rect:selectionRect(),original:{...selection,points:selection.points.map(p=>[...p])}};
      return;
    }
    selection=null;roi=null;line=null;vertices=[];$('region').textContent='Full image';draw();return;
  }
  if(tool==='pointer'){cx=point[0];cy=point[1];commitFrameChange('view');scheduleRender(0);return;}
  if(tool==='zoom'){zoom(e.altKey?-1:1,raw);return;}
  if(tool==='text'){openTextDialog(point);return;}
  if(tool==='polygon'||tool==='angle'||(tool==='line'&&toolVariant==='segmented')){
    vertices.push(point);selection={type:tool,points:[...vertices]};draw();
    if(tool==='angle'&&vertices.length===3)finishSelection(tool,vertices);
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  drag={screen:[e.clientX,e.clientY],point,cx,cy,tool,pixelsPerImage:tileMode?tileViewport()?.pixelsPerImage||scale:scale,low:Number($('low').value),high:Number($('high').value)};
  if(['roi','oval','freehand','line'].includes(tool)){
    roi=null;line=null;selection={type:tool,points:tool==='freehand'?[point]:[point,point]};
  }
};
canvas.ondblclick=()=>{if(tileMode){tileMode=false;frameList();draw();}else if(( $('tool').value==='polygon'||toolVariant==='segmented')&&vertices.length>=2){if(vertices.length>2){const a=vertices.at(-1),b=vertices.at(-2);if(Math.hypot(a[0]-b[0],a[1]-b[1])<2)vertices.pop();}finishSelection(toolVariant==='segmented'?'line':'polygon',vertices);}};
canvas.onpointermove=e=>{
  if(!dataset)return;
  if(drag?.tool==='orthogonal'){orthogonalPoint('xy',e);return;}
  const p=position(e);
  if(drag){const dx=e.clientX-drag.screen[0],dy=e.clientY-drag.screen[1];
    if(drag.tool==='editHandle'||drag.tool==='editMove'){dragEditedSelection(e,roiGeometry.pixelPoint(p,dataset.width,dataset.height));return;}
    if(drag.tool==='pan'){cx=drag.cx-dx/drag.pixelsPerImage;cy=drag.cy-dy/drag.pixelsPerImage;clampCenter();commitFrameChange('view');scheduleRender(100);}
    else if(drag.tool==='contrast'){const span=Math.max(Number.MIN_VALUE,drag.high-drag.low),range=span*Math.exp(dy/150),middle=(drag.low+drag.high)/2-dx/300*span;$('cuts').value='manual';$('low').value=middle-range/2;$('high').value=middle+range/2;drawTransferCurve();commitFrameChange('bc');scheduleRender(100);}
    else if(selection){let end=roiGeometry.pixelPoint(p,dataset.width,dataset.height);if(['roi','oval'].includes(drag.tool))selection.points=rectPoints(roiGeometry.createRect(drag.point,end,{shift:e.shiftKey,center:e.ctrlKey||e.metaKey}));
      else if(drag.tool==='line'&&e.shiftKey){const dx=end[0]-drag.point[0],dy=end[1]-drag.point[1],angle=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4,length=Math.hypot(dx,dy);end=bounded([drag.point[0]+length*Math.cos(angle),drag.point[1]+length*Math.sin(angle)]);selection.points=[drag.point,end];}
      else if(drag.tool==='freehand'||toolVariant==='freeline')selection.points.push(end);else selection.points=[drag.point,end];
      selection.points=selection.points.map(q=>roiGeometry.pixelPoint(q,dataset.width,dataset.height));
      $('region').textContent=selection.points.map(q=>q.join(',')).join(' → ');draw();}
    return;
  }
  clearTimeout(pixelTimer);const stamp=revision,b=base();
  pixelTimer=setTimeout(async()=>{if(pixelRunning||p[0]<0||p[1]<0||p[0]>=dataset.width||p[1]>=dataset.height)return;pixelRunning=true;try{const r=await request('pixel',{...b,x:Math.floor(p[0]),y:Math.floor(p[1])});if(stamp===revision)$('pixel').textContent=`x=${formatValue(r.x*calibration.factor)} (${formatValue(r.x)}), y=${formatValue(r.y*calibration.factor)} (${formatValue(r.y)}), value=${Array.isArray(r.value)?r.value.map(formatValue).join(', '):formatValue(r.value)}`;}catch{/* main actions report worker errors */}finally{pixelRunning=false;}},100);
};
canvas.onpointerup=e=>{if(!drag)return;if(selection&&['roi','oval','freehand','line'].includes(drag.tool)){if(Math.hypot(e.clientX-drag.screen[0],e.clientY-drag.screen[1])<3){selection=null;roi=null;line=null;$('region').textContent='Full image';}else finishSelection(drag.tool,selection.points);}else if(['editHandle','editMove'].includes(drag.tool))refreshSelection();drag=null;canvas.releasePointerCapture(e.pointerId);draw();};
canvas.onpointercancel=()=>{drag=null;};
for(const name of ['xz','yz']){
  const surface=$(name==='xz'?'orthXZCanvas':'orthYZCanvas');let captured=null;
  surface.onpointerdown=event=>{if(event.button!==0||!orthogonal)return;captured=event.pointerId;surface.setPointerCapture(captured);orthogonalPoint(name,event);};
  surface.onpointermove=event=>{if(event.pointerId===captured)orthogonalPoint(name,event);};
  surface.onpointerup=surface.onpointercancel=event=>{if(event.pointerId!==captured)return;surface.releasePointerCapture(captured);captured=null;};
  surface.onwheel=event=>{event.preventDefault();if(orthogonal)changeFrame(event.deltaY>0?1:-1);};
}
const tools = [['roiTool','roi'],['ovalTool','oval'],['polygonTool','polygon'],['freehandTool','freehand'],['lineTool','line'],['angleTool','angle'],['textTool','text'],['zoomTool','zoom'],['panTool','pan'],['pointerTool','pointer']];
for(const [,value] of tools){const option=document.createElement('option');option.value=value;option.textContent=value;$('tool').append(option);}
function setTool(tool){
  if(tool==='lut'){vscode.postMessage({type:'focusAdjust'});return;}
  $('tool').value=tool;vertices=[];
  for(const [id,value] of tools)$(id).classList.toggle('selected',tool===value);
  toolVariant=toolVariants[tool]||'';
}
for(const [id,value] of tools)$(id).onclick=()=>setTool(value);
const variants={roi:[['Rectangle','roi'],['Rounded Rectangle','rounded']],oval:[['Oval','oval'],['Ellipse','ellipse']],line:[['Straight Line','line'],['Segmented Line','segmented'],['Freehand Line','freeline'],['Arrow','arrow']]};
function showToolVariants(event,tool){setTool(tool);showPopup($('toolPopup'),event,variants[tool].map(([label,value])=>[label,()=>{toolVariant=value;toolVariants[tool]=value;const button=tools.find(([,kind])=>kind===tool);$(button[0]).title=label;$(button[0]).dataset.tip=label;} ]));}
for(const button of document.querySelectorAll('[data-variant-for]'))button.onclick=e=>showToolVariants(e,button.dataset.variantFor);
for(const [id,tool] of tools)if(variants[tool])$(id).oncontextmenu=e=>showToolVariants(e,tool);
$('cmap').replaceChildren();
for(const [value,label] of lutOptions){const option=document.createElement('option');option.value=value;option.textContent=label;$('cmap').append(option);}
for(const button of document.querySelectorAll('.tool-button')) button.dataset.tip=button.title;
$('fit').onclick=fit;$('actual').onclick=()=>{scale=1;commitFrameChange('scale');scheduleRender(0);};$('zoomIn').onclick=()=>zoom(1);$('zoomOut').onclick=()=>zoom(-1);
$('zoom').onchange=()=>{const value=Number($('zoom').value.trim().replace(/%$/,''));if(!Number.isFinite(value)||value<=0||value>6400){$('zoom').value=`${formatValue(scale*100)}%`;showError(new Error('Enter a zoom percentage greater than 0 and at most 6400.'));return;}scale=value/100;commitFrameChange('scale');scheduleRender(0);};
for(const button of document.querySelectorAll('[data-click]')) button.onclick=()=>$(button.dataset.click).click();
for(const menu of document.querySelectorAll('.menu')){
  menu.querySelector(':scope > summary').addEventListener('click',event=>{event.preventDefault();menu.open=true;});
  menu.addEventListener('pointerenter',()=>{for(const other of document.querySelectorAll('.menu'))if(other!==menu)other.open=false;menu.open=true;});
  menu.addEventListener('pointerleave',()=>{menu.open=false;for(const sub of menu.querySelectorAll('.submenu'))sub.open=false;});
}
for(const sub of document.querySelectorAll('.submenu')){
  sub.querySelector(':scope > summary').addEventListener('click',event=>{event.preventDefault();sub.open=true;});
  sub.addEventListener('pointerenter',()=>{for(const sibling of sub.parentElement.children)if(sibling!==sub&&sibling.classList?.contains('submenu'))sibling.open=false;sub.open=true;});
  sub.addEventListener('pointerleave',()=>{sub.open=false;});
}
document.addEventListener('click',event=>{if(event.target.closest('.menu-panel button'))event.target.closest('.menu').open=false;});
const hoverTip=$('hoverTip');let hoveredTipTarget=null;
for(const item of document.querySelectorAll('.menu-bar [title]'))item.removeAttribute('title');
function hideHoverTip(){hoverTip.hidden=true;hoveredTipTarget=null;}
document.addEventListener('pointerover',event=>{
  const target=event.target.closest('.tool-bar button, .dialog-head button');
  if(!target||target===hoveredTipTarget)return;
  hoveredTipTarget=target;const tip=target.dataset.tip||target.getAttribute('title')||target.getAttribute('aria-label')||target.textContent.trim();
  if(!tip){hideHoverTip();return;}hoverTip.textContent=tip;hoverTip.hidden=false;
  const rect=target.getBoundingClientRect();hoverTip.style.left=Math.max(4,Math.min(rect.left,innerWidth-hoverTip.offsetWidth-4))+'px';hoverTip.style.top=Math.min(innerHeight-hoverTip.offsetHeight-4,rect.bottom+5)+'px';
},true);
document.addEventListener('pointerout',event=>{if(hoveredTipTarget&&!hoveredTipTarget.contains(event.relatedTarget))hideHoverTip();},true);
document.addEventListener('pointerdown',event=>{for(const id of ['toolPopup','imageContextMenu'])if(!$(id).contains(event.target))$(id).hidden=true;});
$('imageRename').onclick=()=>vscode.postMessage({type:'imageAction',action:'rename',frameId:activeFileFrame});
$('imageDuplicate').onclick=openDuplicateDialog;
$('monitorMemory').onclick=()=>vscode.postMessage({type:'imageAction',action:'memory',frameId:activeFileFrame});
$('focusLayout').onclick=()=>vscode.postMessage({type:'focusLayout'});
$('aboutVivi').onclick=()=>openDialog('about','About vivi','<p>vivi image viewer</p>');
$('closeAnalysis').onclick=()=>$('analysisPane').hidden=true;
function arrangeMinimized(){
  const windows=[...document.querySelectorAll('.floating-dialog.minimized, #analysisPane.minimized')];
  windows.forEach((pane,index)=>{pane.style.position='fixed';pane.style.left=`${8+index*188}px`;pane.style.right='auto';pane.style.top='auto';pane.style.bottom='25px';});
}
function toggleMinimized(pane){
  if(!pane.classList.contains('minimized')){
    pane.dataset.restoredPosition=pane.style.position||'';pane.dataset.restoredLeft=pane.style.left||'';pane.dataset.restoredRight=pane.style.right||'';pane.dataset.restoredTop=pane.style.top||'';pane.dataset.restoredBottom=pane.style.bottom||'';
    pane.classList.add('minimized');arrangeMinimized();
  }else{
    pane.classList.remove('minimized');
    for(const key of ['position','left','right','top','bottom'])pane.style[key]=pane.dataset[`restored${key[0].toUpperCase()+key.slice(1)}`]||'';
    arrangeMinimized();
  }
  const button=pane.querySelector('.dialog-min, #minimizeAnalysis');
  if(button){const minimized=pane.classList.contains('minimized');button.textContent=minimized?'+':'−';button.title=minimized?'Restore':'Minimize';button.setAttribute('aria-label',button.title);}
}
$('minimizeAnalysis').onclick=()=>toggleMinimized($('analysisPane'));
$('pinAnalysis').onclick=()=>$('analysisPane').classList.toggle('pinned');
const analysisHead=$('analysisPane').querySelector('.analysis-head');
analysisHead.onpointerdown=event=>{if(event.target.closest('button'))return;const pane=$('analysisPane'),rect=pane.getBoundingClientRect(),stage=$('stage').getBoundingClientRect(),left=rect.left-stage.left,top=rect.top-stage.top,startX=event.clientX,startY=event.clientY;pane.style.left=left+'px';pane.style.top=top+'px';pane.style.right='auto';pane.style.bottom='auto';analysisHead.setPointerCapture(event.pointerId);analysisHead.onpointermove=move=>{if(!analysisHead.hasPointerCapture(event.pointerId))return;pane.style.left=Math.max(0,left+move.clientX-startX)+'px';pane.style.top=Math.max(0,top+move.clientY-startY)+'px';};};
analysisHead.onpointerup=event=>{if(analysisHead.hasPointerCapture(event.pointerId))analysisHead.releasePointerCapture(event.pointerId);analysisHead.onpointermove=null;};
$('dataset').onchange=selectDataset;
for(const id of ['cuts','stretch'])$(id).onchange=()=>{commitFrameChange('bc');scheduleRender(0);};
for(const id of ['cmap','invert','threshold'])$(id).onchange=()=>{commitFrameChange('color');scheduleRender(0);};
for(const id of ['low','high'])$(id).onchange=()=>{$('cuts').value='manual';commitFrameChange('bc');scheduleRender(0);};
$('clear').onclick=()=>{roi=null;line=null;selection=null;vertices=[];$('region').textContent='Full image';draw();};
for(const op of ['measure','histogram','profile'])$(op).onclick=()=>analyze(op);
$('clearResults').onclick=()=>{measurementHistory.length=0;$('analysis').textContent='Results cleared.';chart([]);$('analysisPane').hidden=false;};
$('summarize').onclick=()=>{
  if(!measurementHistory.length){showError(new Error('Measure at least one image or selection first.'));return;}
  const lines=[`Summary · ${measurementHistory.length} measurements`];
  for(const key of ['area','mean','std','min','max','sum']){
    const values=measurementHistory.map(row=>Number(row[key])).filter(Number.isFinite);
    if(!values.length)continue;
    const mean=values.reduce((a,b)=>a+b,0)/values.length;
    const standard=Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length);
    lines.push(`${key}: mean ${formatValue(mean)}, SD ${formatValue(standard)}, min ${formatValue(Math.min(...values))}, max ${formatValue(Math.max(...values))}`);
  }
  $('analysis').textContent=lines.join('\n');chart([]);$('analysisPane').hidden=false;
};
$('distribution').onclick=()=>{
  if(!measurementHistory.length){showError(new Error('Measure at least one image or selection first.'));return;}
  document.querySelector('[data-dialog="distribution"]')?.remove();
  const dialog=openDialog('distribution','Distribution',`<label>Column <select class="distribution-field"><option>area</option><option>mean</option><option>std</option><option>min</option><option>max</option><option>sum</option></select></label><div class="dialog-actions"><button class="distribution-run">Plot</button></div>`);
  dialog.querySelector('.distribution-run').onclick=()=>{const field=dialog.querySelector('.distribution-field').value,values=measurementHistory.map(row=>Number(row[field])).filter(Number.isFinite);const low=Math.min(...values),high=Math.max(...values);const bins=Array(32).fill(0);for(const value of values)bins[Math.min(31,Math.floor((value-low)/(high-low||1)*32))]++;$('analysis').textContent=`Distribution · ${field}\n${formatValue(values.length)} measurements\nRange: ${formatValue(low)} … ${formatValue(high)}`;chart(bins);$('analysisPane').hidden=false;dialog.remove();};
};
$('setMeasurements').onclick=()=>{
  document.querySelector('[data-dialog="measurements"]')?.remove();
  const fields=['Area','Mean','Std','Min','Max','Sum'];
  const dialog=openDialog('measurements','Set Measurements',fields.map(field=>`<label><input type="checkbox" value="${field}" ${measurementFields.has(field)?'checked':''}>${field}</label>`).join('')+'<div class="dialog-actions"><button class="measurements-apply">OK</button></div>');
  dialog.querySelector('.measurements-apply').onclick=()=>{measurementFields=new Set([...dialog.querySelectorAll('input:checked')].map(input=>input.value));dialog.remove();};
};
$('setScale').onclick=()=>{
  document.querySelector('[data-dialog="set-scale"]')?.remove();
  const dialog=openDialog('set-scale','Set Scale',`<label>Distance in pixels <input class="scale-pixels" type="number" min="0.0001" step="any" value="1"></label><label>Known distance <input class="scale-known" type="number" min="0.0001" step="any" value="${formatValue(calibration.factor)}"></label><label>Unit <input class="scale-unit" type="text" value="${escapeHtml(calibration.unit)}"></label><div class="dialog-actions"><button class="scale-apply">OK</button></div>`);
  dialog.querySelector('.scale-apply').onclick=()=>{const pixels=Number(dialog.querySelector('.scale-pixels').value),known=Number(dialog.querySelector('.scale-known').value);if(!(pixels>0&&known>0)){showError(new Error('Distances must be positive.'));return;}calibration={factor:known/pixels,unit:dialog.querySelector('.scale-unit').value.trim()||'px'};dialog.remove();};
};
$('labelSelection').onclick=()=>{if(!selection){showError(new Error('Select a region first.'));return;}const bounds=selectionBounds(selection.points);annotations.push({point:[bounds[0],bounds[1]],text:String(roiManager.length+1)});draw();};
$('previous').onclick=()=>{stopPlay();changeFrame(-1);};$('next').onclick=()=>{stopPlay();changeFrame(1);};
$('frame').onchange=()=>{stopPlay();const n=Number($('frame').value);$('frame').value=Math.max(1,Math.min(dataset.frames,Number.isFinite(n)?Math.trunc(n):1));changeFrame(0);};
$('play').onclick=()=>{if(playing)stopPlay();else{playing=true;$('playIcon').setAttribute('href','#i-pause');$('play').title='Pause frames';changeFrame(1,true);}};
$('savePng').onclick=()=>{if(renderedRevision!==revision){showError(new Error('Wait for the current view to finish rendering before exporting.'));return;}const png=preview instanceof HTMLCanvasElement?preview.toDataURL('image/png').split(',')[1]:activePng;vscode.postMessage({type:'export',kind:'png',png,fileFrame:activeFileFrame});};
$('saveCsv').onclick=()=>vscode.postMessage({type:'export',kind:'csv',fileFrame:activeFileFrame});
$('fileFrames').onchange=()=>selectFileFrame($('fileFrames').value);
$('previousFileFrame').onclick=()=>moveFileFrame(-1);
$('nextFileFrame').onclick=()=>moveFileFrame(1);
$('tile').onclick=()=>{disableOrthogonal();saveFileFrame();tileMode=!tileMode;frameList();draw();if(tileMode)scheduleTileRefresh(0);};
$('tileLayout').onchange=()=>{if(tileMode)draw();};
$('lockView').onclick=()=>{const enabled=frameLocks.size!==Object.keys(lockGroups).length;for(const group of Object.keys(lockGroups))setFrameLock(group,enabled);};
for(const input of document.querySelectorAll('[data-frame-lock]'))input.onchange=()=>setFrameLock(input.dataset.frameLock,input.checked);
$('unlockAll').onclick=()=>{frameLocks.clear();frameList();};
$('closeFileFrame').onclick=()=>closeFileFrame();
function reorderFileFrame(to) {
  saveFileFrame();const entries=[...fileFrames.entries()],index=entries.findIndex(([id])=>id===activeFileFrame);
  if(index<0)return;const [entry]=entries.splice(index,1);entries.splice(to==='first'?0:entries.length,0,entry);
  fileFrames.clear();for(const [id,state] of entries)fileFrames.set(id,state);frameList();draw();
}
function reorderFrame(from,to){
  if(from===to||!fileFrames.has(from)||!fileFrames.has(to))return;
  saveFileFrame();const entries=[...fileFrames.entries()],index=entries.findIndex(([id])=>id===from),[entry]=entries.splice(index,1),target=entries.findIndex(([id])=>id===to);
  entries.splice(target,0,entry);fileFrames.clear();for(const [id,state] of entries)fileFrames.set(id,state);frameList();draw();
}
function setFrameVisible(id,visible){
  const state=fileFrames.get(id);if(!state)return;
  if(!visible&&visibleFrameIds().length===1)return;
  state.visible=visible;
  if(!visible&&activeFileFrame===id)selectFileFrame(visibleFrameIds()[0]);
  frameList();draw();if(visible)scheduleTileRefresh(0);
}
function applySidebarAction(action,value){
  if(!dataset)return;
  if(action==='stepSlice'){stopPlay();changeFrame(Number(value));}
  else if(action==='setSlice'){$('frame').value=Math.max(1,Math.min(dataset.frames,Math.trunc(Number(value)||1)));$('frame').onchange();}
  else if(action==='play')$('play').click();
  else if(action==='fps'){$('fps').value=Math.max(1,Math.min(30,Number(value)||5));publishSidebar();}
  else if(action==='dataset'){$('dataset').value=String(value);selectDataset();}
  else if(action==='selectFrame')selectFileFrame(value);
  else if(action==='renameFrame'&&fileFrames.has(Number(value)))vscode.postMessage({type:'imageAction',action:'rename',frameId:Number(value)});
  else if(action==='closeFrame')closeFileFrame(value);
  else if(action==='previousFrame')moveFileFrame(-1);
  else if(action==='nextFrame')moveFileFrame(1);
  else if(action==='tile')$('tile').click();
  else if(action==='blink')$('blink').click();
  else if(action==='columns'||action==='rows'){if(action==='columns')layoutColumns=Math.max(0,Math.min(16,Number(value)||0));else layoutRows=Math.max(0,Math.min(16,Number(value)||0));frameList();draw();}
  else if(action==='reorderFrame')reorderFrame(Number(value.from),Number(value.to));
  else if(action==='frameVisible')setFrameVisible(Number(value.id),!!value.visible);
  else if(action==='frameLockMember')setFrameLockMember(Number(value.id),!!value.enabled);
  else if(action==='lock')setFrameLock(value.group,!!value.enabled);
  else if(action==='lockAll'){saveFileFrame();for(const state of fileFrames.values())state.lockMember=true;for(const group of Object.keys(lockGroups))setFrameLock(group,true);}
  else if(action==='unlockAll'){$('unlockAll').click();}
  else if(action==='toggleBC'){transferVisible=!transferVisible;$('transferPanel').hidden=!transferVisible;publishSidebar();}
  else if(action==='adjust'){
    for(const key of ['cuts','low','high','stretch','cmap'])$(key).value=value[key];
    $('invert').checked=!!value.invert;$('threshold').checked=!!value.threshold;
    drawTransferCurve();commitFrameChange('bc');commitFrameChange('color');scheduleRender(0);publishSidebar();
  }
}
function stopBlink(){blinking=false;clearTimeout(blinkTimer);$('blink').classList.remove('selected');}
function blinkStep(){if(!blinking||visibleFrameIds().length<2)return;moveFileFrame(1);blinkTimer=setTimeout(blinkStep,1000/Math.max(1,Math.min(30,Number($('fps').value)||5)));}
$('blink').onclick=()=>{if(blinking)stopBlink();else{blinking=true;tileMode=false;$('blink').classList.add('selected');frameList();blinkStep();}};
$('moveFrameFirst').onclick=()=>reorderFileFrame('first');
$('moveFrameLast').onclick=()=>reorderFileFrame('last');
$('firstFileFrame').onclick=()=>selectFileFrame(fileFrames.keys().next().value);
$('lastFileFrame').onclick=()=>selectFileFrame([...fileFrames.keys()].at(-1));
$('frameClone').onclick=()=>vscode.postMessage({type:'cloneFrame',frameId:activeFileFrame});
for(const id of ['frameOpen','openFile'])$(id).onclick=()=>vscode.postMessage({type:'openDialog'});
let dialogTop=40, dialogZ=20;
function openDialog(key,title,content){
  let dialog=document.querySelector(`[data-dialog="${key}"]`);
  if(dialog){dialog.hidden=false;dialog.style.zIndex=++dialogZ;return dialog;}
  dialog=document.createElement('section');dialog.className='floating-dialog';dialog.dataset.dialog=key;dialog.style.top=dialogTop+'px';dialog.style.left=dialogTop+'px';dialog.style.zIndex=++dialogZ;dialogTop=dialogTop>110?40:dialogTop+25;
  dialog.innerHTML=`<div class="dialog-head"><strong>${title}</strong><button class="dialog-min" title="Minimize">−</button><button class="dialog-pin" title="Keep in front">◇</button><button class="dialog-close" title="Close">×</button></div><div class="dialog-body">${content}</div>`;
  $('dialogLayer').append(dialog);
  dialog.onclick=()=>{if(!dialog.classList.contains('pinned'))dialog.style.zIndex=++dialogZ;};
  dialog.querySelector('.dialog-close').onclick=()=>{dialog.remove();arrangeMinimized();};
  dialog.querySelector('.dialog-min').onclick=()=>toggleMinimized(dialog);
  dialog.querySelector('.dialog-pin').onclick=()=>{dialog.classList.toggle('pinned');dialog.style.zIndex=dialog.classList.contains('pinned')?10000:++dialogZ;};
  const head=dialog.querySelector('.dialog-head');head.onpointerdown=e=>{if(e.target.tagName==='BUTTON')return;head.setPointerCapture(e.pointerId);const x=e.clientX,y=e.clientY,left=dialog.offsetLeft,top=dialog.offsetTop;head.onpointermove=move=>{if(!head.hasPointerCapture(e.pointerId))return;dialog.style.left=Math.max(0,left+move.clientX-x)+'px';dialog.style.top=Math.max(0,top+move.clientY-y)+'px';};};
  head.onpointerup=e=>{if(head.hasPointerCapture(e.pointerId))head.releasePointerCapture(e.pointerId);head.onpointermove=null;};
  return dialog;
}
function openDuplicateDialog(){
  if(!dataset)return;
  document.querySelector('[data-dialog="duplicate"]')?.remove();
  const stack=dataset.frames>1,area=selection&&['roi','oval','polygon','freehand'].includes(selection.type);
  const content=`<label>Title <input class="duplicate-title" type="text"></label>${area?'<label><input class="duplicate-ignore" type="checkbox"> Ignore selection</label>':''}${stack?`<label><input class="duplicate-stack" type="checkbox"> Duplicate stack</label><label class="duplicate-range-label">Range <input class="duplicate-range" type="text" value="1-${dataset.frames}" placeholder="1-${dataset.frames}"></label>`:''}<div class="roi-dialog-error" role="alert"></div><div class="dialog-actions"><button class="duplicate-cancel">Cancel</button><button class="duplicate-create">Duplicate</button></div>`;
  const dialog=openDialog('duplicate','Duplicate…',content);
  const title=dialog.querySelector('.duplicate-title');title.value=`Copy · ${metadata.label||metadata.path.split(/[\\/]/).pop()}`;
  const duplicateStack=dialog.querySelector('.duplicate-stack'),range=dialog.querySelector('.duplicate-range');
  if(duplicateStack)duplicateStack.onchange=()=>{dialog.querySelector('.duplicate-range-label').hidden=!duplicateStack.checked;};
  if(duplicateStack)duplicateStack.onchange();
  dialog.querySelector('.duplicate-cancel').onclick=()=>dialog.remove();
  dialog.querySelector('.duplicate-create').onclick=()=>{
    const error=dialog.querySelector('.roi-dialog-error');error.textContent='';
    const value=title.value.trim();if(!value){error.textContent='Enter a title.';return;}
    let first=1,last=dataset.frames;
    if(duplicateStack?.checked){const match=/^\s*(\d+)\s*(?:[-:]\s*(\d+))?\s*$/.exec(range.value);if(!match){error.textContent='Enter a range such as 1-10.';return;}first=Number(match[1]);last=Number(match[2]||match[1]);if(first<1||last>dataset.frames||first>last){error.textContent=`Range must be within 1-${dataset.frames}.`;return;}}
    const args={dataset:dataset.id,frame:Number($('frame').value)-1,duplicateStack:!!duplicateStack?.checked,first,last,ignoreSelection:!!dialog.querySelector('.duplicate-ignore')?.checked,selection:area?cloneSelection(selection):null,box:area?selectionBounds(selection.points):undefined};
    vscode.postMessage({type:'imageAction',action:'duplicate',frameId:activeFileFrame,title:value,args});dialog.remove();
  };
  title.focus();title.select();
}
function derive(action,label,value){
  if(!dataset)return;
  const box=action==='crop'&&selection&&['roi','oval','polygon','freehand'].includes(selection.type)?selectionBounds(selection.points):[0,0,dataset.width,dataset.height];
  if(action==='crop'&&box[0]===0&&box[1]===0&&box[2]===dataset.width&&box[3]===dataset.height){showError(new Error('Select an area to crop.'));return;}
  vscode.postMessage({type:'derive',fileFrame:activeFileFrame,label,args:{dataset:dataset.id,frame:Number($('frame').value)-1,box,action,value,displayLow:Number($('low').value),displayHigh:Number($('high').value)}});
}
for(const [id,action] of [['flipHorizontal','flipHorizontal'],['flipVertical','flipVertical'],['rotateLeft','rotateLeft'],['rotateRight','rotateRight'],['rotate180','rotate180']])$(id).onclick=()=>vscode.postMessage({type:'transformFrame',fileFrame:activeFileFrame,action,args:base()});
for(const [id,action,label] of [['imageCrop','crop','Crop'],['type8','to8','8-bit'],['type16','to16','16-bit'],['type32','to32','32-bit'],['typeRgb','toRgb','RGB Color'],['processNormalize','normalize','Normalize'],['processSmooth','smooth','Smooth'],['processSharpen','sharpen','Sharpen'],['processEdges','findEdges','Find Edges'],['processErode','binaryErode','Erode'],['processDilate','binaryDilate','Dilate'],['processOpen','binaryOpen','Open'],['processClose','binaryClose','Close'],['processFft','fftPower','FFT'],['mathInvert','invertPixels','Invert'],['mathSqrt','sqrt','Square Root'],['mathSquare','square','Square'],['mathLog','log','Log'],['mathExp','exp','Exp'],['mathAbs','abs','Abs']])$(id).onclick=()=>derive(action,label);
$('imageInfo').onclick=()=>openDialog('info','Image Info',`<pre>${escapeHtml(metadata.path)}\n${dataset.width} × ${dataset.height} · ${escapeHtml(dataset.dtype)}\n${escapeHtml(dataset.shape.join(' × '))} · ${escapeHtml(dataset.axes||'YX')}\nDisplay: ${$('low').value} … ${$('high').value}</pre>`);
$('imageScale').onclick=()=>{
  document.querySelector('[data-dialog="scale"]')?.remove();
  const dialog=openDialog('scale','Scale',`<label>Scale factor <input class="scale-factor" type="number" min="0.001" max="32" step="any" value="1"></label><div class="dialog-actions"><button class="scale-cancel">Cancel</button><button class="scale-run">Create Frame</button></div>`);
  dialog.querySelector('.scale-cancel').onclick=()=>dialog.remove();
  dialog.querySelector('.scale-run').onclick=()=>{const factor=Number(dialog.querySelector('.scale-factor').value);if(!Number.isFinite(factor)||factor<=0||factor>32){showError(new Error('Scale factor must be between 0 and 32.'));return;}derive('resize','Scale',factor);dialog.remove();};
};
$('processBinary').onclick=()=>{
  document.querySelector('[data-dialog="binary"]')?.remove();
  const dialog=openDialog('binary','Make Binary',`<label>Threshold <input class="binary-threshold" type="number" step="any" value="${Number($('low').value)||0}"></label><div class="dialog-actions"><button class="binary-cancel">Cancel</button><button class="binary-run">Create Frame</button></div>`);
  dialog.querySelector('.binary-cancel').onclick=()=>dialog.remove();
  dialog.querySelector('.binary-run').onclick=()=>{const value=Number(dialog.querySelector('.binary-threshold').value);if(!Number.isFinite(value)){showError(new Error('Enter a finite threshold.'));return;}derive('thresholdBinary','Binary',value);dialog.remove();};
};
for(const [id,action,label] of [['shadowNorth','shadowNorth','Shadows North'],['shadowSouth','shadowSouth','Shadows South'],['shadowEast','shadowEast','Shadows East'],['shadowWest','shadowWest','Shadows West'],['processFillHoles','binaryFillHoles','Fill Holes'],['processSkeletonize','binarySkeleton','Skeletonize']])$(id).onclick=()=>derive(action,label);
for(const [id,action,label,field,initial,min,max] of [
  ['processMaxima','findMaxima','Find Maxima','Noise tolerance',0,0,1e6],
  ['filterMean','mean','Mean','Radius (px)',1,1,20],['filterMin','minimum','Minimum','Radius (px)',1,1,20],
  ['filterMax','maximum','Maximum','Radius (px)',1,1,20],['filterVariance','variance','Variance','Radius (px)',1,1,20],
  ['processNoise','noiseGaussian','Add Noise','Standard deviation',25,0,1e6],
  ['processSaltPepper','saltPepper','Salt and Pepper','Pixel fraction',0.05,0,1],
  ['processBandpass','fftBandpass','FFT Bandpass','Low frequency cutoff',0.05,0,0.5]])$(id).onclick=()=>{
    document.querySelector('[data-dialog="process-number"]')?.remove();
    const dialog=openDialog('process-number',label,`<label>${field} <input class="process-value" type="number" step="any" min="${min}" max="${max}" value="${initial}"></label><div class="dialog-actions"><button class="process-cancel">Cancel</button><button class="process-run">Create Frame</button></div>`);
    dialog.querySelector('.process-cancel').onclick=()=>dialog.remove();
    dialog.querySelector('.process-run').onclick=()=>{const value=Number(dialog.querySelector('.process-value').value);if(!Number.isFinite(value)||value<min||value>max){showError(new Error(`${field} must be between ${min} and ${max}.`));return;}derive(action,label,value);dialog.remove();};
  };
for(const [id,action,label] of [['mathAdd','add','Add'],['mathSubtract','subtract','Subtract'],['mathMultiply','multiply','Multiply'],['mathDivide','divide','Divide']])$(id).onclick=()=>{
  document.querySelector('[data-dialog="math"]')?.remove();
  const dialog=openDialog('math',label,`<label>Value <input class="math-value" type="number" step="any" value="1"></label><div class="dialog-actions"><button class="math-cancel">Cancel</button><button class="math-run">Create Frame</button></div>`);
  dialog.querySelector('.math-cancel').onclick=()=>dialog.remove();
  dialog.querySelector('.math-run').onclick=()=>{const value=Number(dialog.querySelector('.math-value').value);if(!Number.isFinite(value)){showError(new Error('Enter a finite number.'));return;}derive(action,label,value);dialog.remove();};
};
for(const [id,action,label] of [['filterGaussian','gaussian','Gaussian Blur'],['filterMedian','median','Median'],['filterUnsharp','unsharp','Unsharp Mask']])$(id).onclick=()=>{
  document.querySelector('[data-dialog="filter"]')?.remove();
  const dialog=openDialog('filter',label,`<label>${action==='median'?'Radius (1 or 2)':'Sigma'} (px) <input class="filter-radius" type="number" step="${action==='median'?'1':'any'}" min="${action==='median'?'1':'0.1'}" max="${action==='median'?'2':'20'}" value="1"></label><div class="roi-dialog-error" role="alert"></div><div class="dialog-actions"><button class="filter-cancel">Cancel</button><button class="filter-run">Create Frame</button></div>`);
  dialog.querySelector('.filter-cancel').onclick=()=>dialog.remove();
  dialog.querySelector('.filter-run').onclick=()=>{const value=Number(dialog.querySelector('.filter-radius').value);if(!Number.isFinite(value)||value<=0||value>(action==='median'?2:20)||(action==='median'&&!Number.isInteger(value))){dialog.querySelector('.roi-dialog-error').textContent=action==='median'?'Enter radius 1 or 2.':'Enter a value between 0 and 20 pixels.';return;}derive(action,label,value);dialog.remove();};
};
$('zProject').onclick=()=>{
  if(!dataset||dataset.frames<2){showError(new Error('Z Project requires a stack.'));return;}
  document.querySelector('[data-dialog="z-project"]')?.remove();
  const dialog=openDialog('z-project','Z Project',`<label>Projection <select class="z-method"><option value="zMax">Max Intensity</option><option value="zMean">Average Intensity</option><option value="zMin">Min Intensity</option></select></label><div class="dialog-actions"><button class="z-cancel">Cancel</button><button class="z-create">Create Frame</button></div>`);
  dialog.querySelector('.z-cancel').onclick=()=>dialog.remove();
  dialog.querySelector('.z-create').onclick=()=>{derive(dialog.querySelector('.z-method').value,'Z Project');dialog.remove();};
};
$('thresholdMenu').onclick=()=>{$('threshold').checked=true;$('cuts').value='manual';commitFrameChange('color');commitFrameChange('bc');scheduleRender(0);openBCDialog();};
$('selectAll').onclick=()=>{selection={type:'roi',variant:'roi',points:[[0,0],[dataset.width,dataset.height]],...selectionDefaults};refreshSelection();};
let previousSelection=null;
const originalClear=$('clear').onclick;
$('clear').onclick=()=>{if(selection)previousSelection=cloneSelection(selection);originalClear();};
$('restoreSelection').onclick=()=>{if(previousSelection){selection=cloneSelection(previousSelection);refreshSelection();}};
$('fitSpline').onclick=fitSelectionSpline;
$('enlargeSelection').onclick=()=>{
  if(!selection||!['roi','oval'].includes(selection.type)){showError(new Error('Select a rectangle or oval first.'));return;}
  document.querySelector('[data-dialog="enlarge"]')?.remove();const dialog=openDialog('enlarge','Enlarge Selection','<label>Pixels <input class="enlarge-value" type="number" step="any" value="1"></label><div class="dialog-actions"><button class="enlarge-run">Apply</button></div>');
  dialog.querySelector('.enlarge-run').onclick=()=>{const delta=Number(dialog.querySelector('.enlarge-value').value);if(!Number.isFinite(delta)){showError(new Error('Enter a finite pixel distance.'));return;}const [x0,y0,x1,y1]=selectionRect();selection.points=[[Math.max(0,x0-delta),Math.max(0,y0-delta)],[Math.min(dataset.width,x1+delta),Math.min(dataset.height,y1+delta)]];refreshSelection();dialog.remove();};
};
const cloneSelection=source=>({...source,points:source.points.map(point=>[...point])});
function fitSelectionSpline(){if(!selection||!['polygon','freehand','line'].includes(selection.type))return;selection.points=roiGeometry.smoothPoints(selection.points,selection.type!=='line').map(([x,y])=>[Math.max(0,Math.min(dataset.width-1,x)),Math.max(0,Math.min(dataset.height-1,y))]);refreshSelection();}
function createSelectionMask(){if(!selection)return;vscode.postMessage({type:'selectionMask',fileFrame:activeFileFrame,args:{...base(),box:roi,selection:cloneSelection(selection)}});}
function openRoiDefaults(){
  document.querySelector('[data-dialog="roi-defaults"]')?.remove();
  const dialog=openDialog('roi-defaults','ROI Defaults','<label>Stroke <input class="default-stroke" type="color"></label><label>Width <input class="default-width" type="number" min="0.5" max="20" step="any"></label><div class="roi-dialog-error" role="alert"></div><div class="dialog-actions"><button class="defaults-apply">Apply</button></div>');
  dialog.querySelector('.default-stroke').value=selectionDefaults.stroke;dialog.querySelector('.default-width').value=selectionDefaults.strokeWidth;
  dialog.querySelector('.defaults-apply').onclick=()=>{const width=Number(dialog.querySelector('.default-width').value);if(!Number.isFinite(width)||width<.5||width>20){dialog.querySelector('.roi-dialog-error').textContent='Width must be between 0.5 and 20.';return;}selectionDefaults.stroke=dialog.querySelector('.default-stroke').value;selectionDefaults.strokeWidth=width;dialog.remove();};
}
function addSelectionToOverlay(){if(!selection)return;overlays.push(cloneSelection(selection));draw();}
function addSelectionToManager(){if(!selection)return;roiManager.push(cloneSelection(selection));openRoiManager();}
function openRoiManager(){
  document.querySelector('[data-dialog="roi-manager"]')?.remove();
  const dialog=openDialog('roi-manager','ROI Manager','<div class="roi-manager-list"></div><div class="dialog-actions"><button class="roi-manager-add">Add Current</button></div>');
  const list=dialog.querySelector('.roi-manager-list');
  function renderList(){list.replaceChildren();roiManager.forEach((item,index)=>{const row=document.createElement('div');row.className='roi-manager-row';const restore=document.createElement('button');restore.textContent=`${index+1} · ${item.variant||item.type}`;restore.title='Select ROI';restore.onclick=()=>{selection=cloneSelection(item);refreshSelection();};const remove=document.createElement('button');remove.textContent='×';remove.title='Remove ROI';remove.onclick=()=>{roiManager.splice(index,1);renderList();};row.append(restore,remove);list.append(row);});if(!roiManager.length)list.textContent='No saved selections.';}
  dialog.querySelector('.roi-manager-add').onclick=()=>{if(selection){roiManager.push(cloneSelection(selection));renderList();}};
  renderList();
}
function openSelectionDialog(properties=false){
  if(!dataset)return;
  document.querySelector('[data-dialog="specify-selection"]')?.remove();
  const dialog=openDialog('specify-selection',properties?'ROI Properties':'Specify Selection',`<label>Shape <select class="roi-kind"><option value="roi">Rectangle</option><option value="oval">Oval</option><option value="polygon">Polygon</option><option value="freehand">Freehand</option><option value="line">Line</option><option value="angle">Angle</option></select></label><label>Variant <select class="roi-variant"></select></label><div class="roi-box-fields"><label>X <input class="roi-x" type="number" step="any"></label><label>Y <input class="roi-y" type="number" step="any"></label><label>Width <input class="roi-width" type="number" step="any" min="0"></label><label>Height <input class="roi-height" type="number" step="any" min="0"></label><label class="roi-center-label"><input class="roi-centered" type="checkbox"> Centered on X,Y</label></div><label class="roi-points-label">Vertices (X, Y per line)<textarea class="roi-points" rows="6" spellcheck="false"></textarea></label><label>Stroke <input class="roi-stroke" type="color" value="#72ebc4"></label><label>Width <input class="roi-stroke-width" type="number" min="0.5" max="20" step="any" value="1.5"></label><div class="roi-dialog-error" role="alert"></div><div class="dialog-actions"><button class="roi-cancel">Cancel</button><button class="roi-apply">Apply</button></div>`);
  const get=cls=>dialog.querySelector('.'+cls),kind=get('roi-kind'),variant=get('roi-variant');
  const variants={roi:[['Rectangle','roi'],['Rounded rectangle','rounded']],oval:[['Oval','oval'],['Ellipse','ellipse']],polygon:[['Polygon','polygon']],freehand:[['Freehand','freehand']],line:[['Straight','line'],['Segmented','segmented'],['Freehand line','freeline'],['Arrow','arrow']],angle:[['Angle','angle']]};
  function updateKind(){const shape=kind.value;variant.replaceChildren();for(const [label,value] of variants[shape]){const option=document.createElement('option');option.value=value;option.textContent=label;variant.append(option);}get('roi-box-fields').hidden=!['roi','oval'].includes(shape);get('roi-points-label').hidden=['roi','oval'].includes(shape);}
  kind.onchange=updateKind;
  kind.value=selection?.type||'roi';updateKind();variant.value=selection?.variant||variant.options[0].value;
  const points=selection?.points||[[0,0],[Math.min(20,dataset.width),Math.min(20,dataset.height)]];
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys);
  get('roi-x').value=x;get('roi-y').value=y;get('roi-width').value=Math.max(...xs)-x;get('roi-height').value=Math.max(...ys)-y;
  get('roi-points').value=points.map(p=>p.join(', ')).join('\n');
  get('roi-stroke').value=selection?.stroke||selectionDefaults.stroke;get('roi-stroke-width').value=selection?.strokeWidth||selectionDefaults.strokeWidth;
  get('roi-centered').onchange=()=>{const sign=get('roi-centered').checked?1:-1;get('roi-x').value=Number(get('roi-x').value)+sign*Number(get('roi-width').value)/2;get('roi-y').value=Number(get('roi-y').value)+sign*Number(get('roi-height').value)/2;};
  get('roi-cancel').onclick=()=>dialog.remove();
  get('roi-apply').onclick=()=>{try{
    const shape=kind.value,selectedPoints=['roi','oval'].includes(shape)?roiGeometry.specifiedRect(Number(get('roi-x').value),Number(get('roi-y').value),Number(get('roi-width').value),Number(get('roi-height').value),dataset.width,dataset.height,{centered:get('roi-centered').checked}):roiGeometry.specifiedVertices(get('roi-points').value,shape,dataset.width,dataset.height);
    const width=Number(get('roi-stroke-width').value);if(!Number.isFinite(width)||width<.5||width>20)throw new Error('Stroke width must be between 0.5 and 20.');
    selection={type:shape,variant:variant.value,points:selectedPoints,stroke:get('roi-stroke').value,strokeWidth:width};vertices=[];refreshSelection();dialog.remove();
  }catch(error){get('roi-dialog-error').textContent=error.message;}};
  get('roi-x').focus();
}
$('selectionProperties').onclick=()=>openSelectionDialog(true);
$('specifySelection').onclick=()=>openSelectionDialog(false);
$('addSelectionOverlay').onclick=addSelectionToOverlay;
$('addSelectionManager').onclick=addSelectionToManager;
$('openRoiManager').onclick=openRoiManager;
function openBCDialog(){
  vscode.postMessage({type:'focusAdjust'});
}
function openTextDialog(point){const dialog=openDialog('text','Text',`<label>Annotation <input class="text-value" type="text" maxlength="120"></label><div class="dialog-actions"><button class="text-apply">Place</button></div>`);dialog.querySelector('.text-value').focus();dialog.querySelector('.text-apply').onclick=()=>{const value=dialog.querySelector('.text-value').value;if(value)annotations.push({point,text:value});dialog.remove();draw();};}
function openMontageDialog(){
  document.querySelector('[data-dialog="montage"]')?.remove();
  const dialog=openDialog('montage','Make Montage',`<label>First slice <input class="montage-start" type="number" min="1" value="1"></label><label>Last slice <input class="montage-end" type="number" min="1"></label><label>Columns <input class="montage-columns" type="number" min="1" max="32" value="5"></label><label>Scale (%) <input class="montage-scale" type="number" min="1" max="400" step="any" value="100"></label><div class="roi-dialog-error" role="alert"></div><div class="dialog-actions"><button class="montage-create">Create Frame</button></div>`);
  dialog.querySelector('.montage-end').value=dataset.frames;
  dialog.querySelector('.montage-create').onclick=()=>{
    const args={dataset:dataset.id,start:Number(dialog.querySelector('.montage-start').value),end:Number(dialog.querySelector('.montage-end').value),columns:Number(dialog.querySelector('.montage-columns').value),scalePercent:Number(dialog.querySelector('.montage-scale').value)};
    if(!Number.isInteger(args.start)||!Number.isInteger(args.end)||args.start<1||args.end>dataset.frames||args.end<args.start||!Number.isInteger(args.columns)||args.columns<1||args.columns>32||!Number.isFinite(args.scalePercent)||args.scalePercent<1||args.scalePercent>400){dialog.querySelector('.roi-dialog-error').textContent='Check slice range, columns (1–32), and scale (1–400%).';return;}
    vscode.postMessage({type:'montage',fileFrame:activeFileFrame,args});dialog.remove();
  };
}
$('openBC').onclick=openBCDialog;
$('autoCuts').onclick=()=>{$('cuts').value='percentile';commitFrameChange('bc');scheduleRender(0);};
$('resetCuts').onclick=()=>{$('cuts').value='minmax';$('stretch').value='linear';commitFrameChange('bc');scheduleRender(0);};
$('montage').onclick=openMontageDialog;
function stackRangeFields(){return `<label>First slice <input class="stack-first" type="number" min="1" max="${dataset.frames}" value="1"></label><label>Last slice <input class="stack-last" type="number" min="1" max="${dataset.frames}" value="${dataset.frames}"></label>`;}
function stackRange(dialog){const start=Number(dialog.querySelector('.stack-first').value),end=Number(dialog.querySelector('.stack-last').value);if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>dataset.frames||end<start)throw new Error(`Choose slices between 1 and ${dataset.frames}.`);return {start,end};}
function runStackImage(action,args={}){vscode.postMessage({type:'stack',fileFrame:activeFileFrame,args:{action,dataset:dataset?.id,...args}});}
async function runStackAnalysis(action,args,title){
  try{
    const result=await request('stack',{action,dataset:dataset.id,...args});
    document.querySelector(`[data-dialog="stack-${action}"]`)?.remove();
    const dialog=openDialog(`stack-${action}`,title,`<canvas class="stack-plot" width="440" height="180" hidden></canvas><pre class="stack-result"></pre>`),plot=dialog.querySelector('.stack-plot');
    if(action==='zAxisProfile'){
      plot.hidden=false;const c=plot.getContext('2d'),values=result.values||[],finite=values.filter(Number.isFinite),min=Math.min(...finite),max=Math.max(...finite),span=max-min||1;c.clearRect(0,0,plot.width,plot.height);c.strokeStyle='#72d4b5';c.lineWidth=1.5;c.beginPath();values.forEach((value,index)=>{const x=16+index/Math.max(1,values.length-1)*(plot.width-32),y=plot.height-16-(value-min)/span*(plot.height-32);if(index)c.lineTo(x,y);else c.moveTo(x,y);});c.stroke();dialog.querySelector('.stack-result').textContent=`X ${formatValue(result.x)}, Y ${formatValue(result.y)}\nSlices: ${formatValue(result.frames?.length||0)}\nMin: ${formatValue(min)}  Max: ${formatValue(max)}\n`+values.map((value,index)=>`${result.frames[index]}\t${formatValue(value)}`).join('\n');
    }else if(action==='measureStack')dialog.querySelector('.stack-result').textContent=['Slice\tCount\tMean\tStdDev\tMin\tMax',...(result.results||[]).map((row,index)=>`${row.frame!=null?row.frame+1:index+1}\t${formatValue(row.count)}\t${formatValue(row.mean)}\t${formatValue(row.std)}\t${formatValue(row.min)}\t${formatValue(row.max)}`)].join('\n');
    else dialog.querySelector('.stack-result').textContent=Object.entries(result).map(([key,value])=>`${key}: ${Array.isArray(value)?value.map(item=>typeof item==='number'?formatValue(item):item).join(', '):typeof value==='number'?formatValue(value):value}`).join('\n');
  }catch(error){showError(error);}
}
function stackDialog(action,title,extra='',analysis=false){if(!dataset||dataset.frames<2){showError(new Error(`${title} requires a stack.`));return;}document.querySelector(`[data-dialog="stack-${action}-options"]`)?.remove();const dialog=openDialog(`stack-${action}-options`,title,stackRangeFields()+extra+'<div class="roi-dialog-error" role="alert"></div><div class="dialog-actions"><button class="stack-cancel">Cancel</button><button class="stack-run">Run</button></div>');dialog.querySelector('.stack-cancel').onclick=()=>dialog.remove();dialog.querySelector('.stack-run').onclick=()=>{try{const args=stackRange(dialog);if(action==='reslice'){args.axis=dialog.querySelector('.stack-axis').value;args.position=Number(dialog.querySelector('.stack-position').value);}if(action==='zAxisProfile'){args.x=Number(dialog.querySelector('.stack-x').value);args.y=Number(dialog.querySelector('.stack-y').value);}if(['measureStack','statistics'].includes(action)){args.box=roi||undefined;args.selection=selection||undefined;}if(analysis)runStackAnalysis(action,args,title);else runStackImage(action,args);dialog.remove();}catch(error){dialog.querySelector('.roi-dialog-error').textContent=error.message;}};}
if($('stackImagesToStack'))$('stackImagesToStack').onclick=()=>runStackImage('imagesToStack');
if($('importSequence'))$('importSequence').onclick=()=>vscode.postMessage({type:'importSequence'});
if($('stackToImages'))$('stackToImages').onclick=()=>stackDialog('stackToImages','Stack to Images');
if($('stackReslice'))$('stackReslice').onclick=()=>stackDialog('reslice','Reslice',`<label>Axis <select class="stack-axis"><option value="x">X</option><option value="y">Y</option></select></label><label>Position <input class="stack-position" type="number" min="0" max="${dataset?.width||1}" value="${Math.floor((dataset?.width||2)/2)}"></label>`);
if($('stackZProfile'))$('stackZProfile').onclick=()=>stackDialog('zAxisProfile','Plot Z-axis Profile',`<label>X <input class="stack-x" type="number" min="0" max="${dataset?.width||1}" value="${Math.floor((dataset?.width||2)/2)}"></label><label>Y <input class="stack-y" type="number" min="0" max="${dataset?.height||1}" value="${Math.floor((dataset?.height||2)/2)}"></label>`,true);
if($('stackMeasure'))$('stackMeasure').onclick=()=>stackDialog('measureStack','Measure Stack','',true);
if($('stackStatistics'))$('stackStatistics').onclick=()=>stackDialog('statistics','Stack Statistics','',true);
if($('processFftNative'))$('processFftNative').onclick=()=>derive('fftPowerImageJ','FFT (ImageJ padded)');
if($('processEqualize'))$('processEqualize').onclick=()=>derive('equalizeHistogram','Equalize Histogram');
if($('editUndo'))$('editUndo').onclick=()=>vscode.postMessage({type:'transformFrame',fileFrame:activeFileFrame,action:'undo',args:base()});
if($('editRedo'))$('editRedo').onclick=()=>vscode.postMessage({type:'transformFrame',fileFrame:activeFileFrame,action:'redo',args:base()});
if($('viewerDataset'))$('viewerDataset').onchange=()=>{$('dataset').value=$('viewerDataset').value;selectDataset();};
$('viewerAxis').onchange=()=>{sliceAxis=Number($('viewerAxis').value);if(orthogonal){orthogonal.axis=sliceAxis;orthogonal.depth=dataset.shape[sliceAxis];orthogonal.sectionKey='';}frameLabel();saveFileFrame();};
$('stackOrthogonal').onclick=toggleOrthogonal;
if($('viewerSliceRange'))$('viewerSliceRange').oninput=()=>{setAxisSlice(Number($('viewerSliceRange').value));$('frame').onchange();};
if($('viewerSliceNumber'))$('viewerSliceNumber').onchange=()=>{setAxisSlice(Number($('viewerSliceNumber').value));$('frame').onchange();};
function stopSliceHold(){clearTimeout(sliceHoldTimer);clearInterval(sliceRepeatTimer);sliceHoldTimer=null;sliceRepeatTimer=null;}
for(const [id,delta] of [['viewerSlicePrev',-1],['viewerSliceNext',1]]){
  const button=$(id);
  let suppressClick=false;
  button.onpointerdown=event=>{
    if(event.button!==0||button.disabled)return;
    event.preventDefault();suppressClick=true;stopSliceHold();stopPlay();changeFrame(delta);
    button.setPointerCapture(event.pointerId);
    sliceHoldTimer=setTimeout(()=>{
      const interval=1000/Math.max(1,Math.min(30,Number($('fps').value)||5));
      changeFrame(delta,true);
      sliceRepeatTimer=setInterval(()=>changeFrame(delta,true),interval);
    },350);
  };
  button.onpointerup=()=>{stopSliceHold();setTimeout(()=>{suppressClick=false;},0);};
  button.onpointercancel=()=>{stopSliceHold();suppressClick=false;};
  button.onlostpointercapture=stopSliceHold;
  button.onclick=()=>{if(suppressClick){suppressClick=false;return;}stopPlay();changeFrame(delta);};
}
if($('viewerSlicePlay'))$('viewerSlicePlay').onclick=()=>{$('play').click();syncViewerToolbar();};
if($('viewerSliceFps'))$('viewerSliceFps').onchange=()=>{$('fps').value=$('viewerSliceFps').value;publishSidebar();};
$('minimizeTransfer').onclick=()=>{const panel=$('transferPanel');panel.classList.toggle('minimized');$('minimizeTransfer').textContent=panel.classList.contains('minimized')?'+':'−';$('minimizeTransfer').title=panel.classList.contains('minimized')?'Show curve':'Minimize curve';};
function histogramOptions(){
  document.querySelector('[data-dialog="histogram-options"]')?.remove();
  const dialog=openDialog('histogram-options','Histogram',`<label>Bins <input class="hist-bins" type="number" min="2" max="4096" value="256"></label><label><input class="hist-auto" type="checkbox" checked> Use pixel value range</label><label>X min <input class="hist-min" type="number" step="any" disabled></label><label>X max <input class="hist-max" type="number" step="any" disabled></label><label>Y max <input class="hist-ymax" type="number" step="any" placeholder="Auto"></label><div class="roi-dialog-error" role="alert"></div><div class="dialog-actions"><button class="hist-cancel">Cancel</button><button class="hist-run">OK</button></div>`);
  const auto=dialog.querySelector('.hist-auto');auto.onchange=()=>{for(const name of ['.hist-min','.hist-max'])dialog.querySelector(name).disabled=auto.checked;};
  dialog.querySelector('.hist-cancel').onclick=()=>dialog.remove();
  dialog.querySelector('.hist-run').onclick=async()=>{
    const bins=Number(dialog.querySelector('.hist-bins').value),xMin=Number(dialog.querySelector('.hist-min').value),xMax=Number(dialog.querySelector('.hist-max').value),yMax=Number(dialog.querySelector('.hist-ymax').value);
    if(!Number.isInteger(bins)||bins<2||bins>4096||(!auto.checked&&(!Number.isFinite(xMin)||!Number.isFinite(xMax)||xMax<=xMin))){dialog.querySelector('.roi-dialog-error').textContent='Check bins and X range.';return;}
    const args={...base(),box:roi||undefined,selection,bins};if(!auto.checked){args.xMin=xMin;args.xMax=xMax;}if(dialog.querySelector('.hist-ymax').value){if(!Number.isFinite(yMax)||yMax<=0){dialog.querySelector('.roi-dialog-error').textContent='Y max must be positive.';return;}args.yMax=yMax;}
    dialog.remove();try{const result=await request('histogram',args);showHistogram(result,args);}catch(error){showError(error);}
  };
}
function showHistogram(result,args){
  document.querySelector('[data-dialog="histogram-result"]')?.remove();
  const title=metadata.label||metadata.path.split(/[\\/]/).pop();
  const dialog=openDialog('histogram-result',`Histogram of ${title}`,`<canvas class="hist-plot" width="300" height="145"></canvas><div class="hist-range"></div><pre class="hist-stats"></pre><div class="dialog-actions"><button class="hist-list">List</button><button class="hist-copy">Copy</button><button class="hist-log">Log</button><button class="hist-live">Live</button></div>`);
  const canvas=dialog.querySelector('.hist-plot'),context=canvas.getContext('2d'),counts=result.counts||[],edges=result.edges||[],peak=Math.max(1,...counts),ceiling=args.yMax||peak,w=canvas.width,h=canvas.height;
  context.fillStyle='#151a20';context.fillRect(0,0,w,h);context.fillStyle='#76d9ba';
  for(let i=0;i<counts.length;i++){const left=i*w/counts.length,width=Math.max(1,w/counts.length),height=Math.max(0,Math.min(h,counts[i]/ceiling*h));context.fillRect(left,h-height,width,height);}
  const range=dialog.querySelector('.hist-range');range.replaceChildren();for(const endpoint of [edges[0],edges.at(-1)]){const label=document.createElement('span');label.textContent=formatValue(endpoint);range.append(label);}
  const values=counts.map((count,index)=>(edges[index]+edges[index+1])/2),count=counts.reduce((a,b)=>a+b,0),mean=result.mean??values.reduce((sum,value,index)=>sum+value*counts[index],0)/(count||1),variance=values.reduce((sum,value,index)=>sum+(value-mean)**2*counts[index],0)/(count||1),modeAt=counts.indexOf(peak);
  const summary=[`${dataset.width}×${dataset.height} pixels; ${dataset.dtype}`,`N: ${formatValue(result.samples??count)}     Min: ${formatValue(result.min??edges[0])}`,`Mean: ${formatValue(mean)}     Max: ${formatValue(result.max??edges.at(-1))}`,`StdDev: ${formatValue(result.std??Math.sqrt(variance))}     Mode: ${formatValue(result.mode??values[modeAt])} (${formatValue(result.modeCount??peak)})`,`Bins: ${formatValue(counts.length)}     Bin Width: ${formatValue(result.binWidth??(edges[1]-edges[0]))}`,`Value: ---     Count: ---`];
  const stats=dialog.querySelector('.hist-stats');stats.textContent=summary.join('\n');
  canvas.onpointermove=e=>{const index=Math.max(0,Math.min(counts.length-1,Math.floor((e.offsetX/canvas.clientWidth)*counts.length)));summary[5]=`Value: ${formatValue(values[index])}     Count: ${formatValue(counts[index])}`;stats.textContent=summary.join('\n');};
  canvas.onpointerleave=()=>{summary[5]='Value: ---     Count: ---';stats.textContent=summary.join('\n');};
  dialog.querySelector('.hist-list').onclick=()=>{const list=openDialog('histogram-list','Histogram bins','<pre class="hist-list-data"></pre>');list.querySelector('.hist-list-data').textContent=counts.map((n,i)=>`${formatValue(edges[i])}\t${formatValue(edges[i+1])}\t${formatValue(n)}`).join('\n');};
  dialog.querySelector('.hist-copy').onclick=()=>navigator.clipboard?.writeText(counts.map((n,i)=>`${edges[i]}\t${n}`).join('\n')).catch(showError);
  dialog.querySelector('.hist-log').onclick=()=>{context.fillStyle='#151a20';context.fillRect(0,0,w,h);context.fillStyle='#76d9ba';const top=Math.log1p(ceiling);for(let i=0;i<counts.length;i++){const height=Math.max(0,Math.min(h,Math.log1p(counts[i])/top*h));context.fillRect(i*w/counts.length,h-height,Math.max(1,w/counts.length),height);}};
  dialog.querySelector('.hist-live').onclick=()=>{dialog.remove();histogramOptions();};
}
if($('histogram'))$('histogram').onclick=histogramOptions;
async function showLutDialog(gallery=false){
  document.querySelector('[data-dialog="lut-view"]')?.remove();
  const dialog=openDialog('lut-view',gallery?'Display LUTs':'Show LUT',`<label>LUT <select class="lut-preview-choice"></select></label><canvas class="lut-preview-canvas" width="256" height="60"></canvas><pre class="lut-preview-values"></pre>`);
  const choice=dialog.querySelector('.lut-preview-choice');for(const [value,label] of lutOptions){const option=document.createElement('option');option.value=value;option.textContent=label;choice.append(option);}choice.value=$('cmap').value;
  async function update(){try{const name=choice.value,data=await request('lutPreview',{cmap:name}),rgb=data.rgb,canvas=dialog.querySelector('.lut-preview-canvas'),context=canvas.getContext('2d'),image=context.createImageData(256,1);for(let i=0;i<256;i++){image.data.set([...rgb[i],255],i*4);}context.putImageData(image,0,0);context.drawImage(canvas,0,0,256,1,0,1,256,58);dialog.querySelector('.lut-preview-values').textContent=`${choice.options[choice.selectedIndex].text}\n0: ${rgb[0].join(', ')}   128: ${rgb[128].join(', ')}   255: ${rgb[255].join(', ')}`;}catch(error){showError(error);}}
  choice.onchange=update;await update();
  if(gallery){const apply=document.createElement('button');apply.textContent='Apply to Frame';dialog.querySelector('.dialog-body').append(apply);apply.onclick=()=>{$('cmap').value=choice.value;commitFrameChange('color');scheduleRender(0);};}
}
if($('colorShowLut'))$('colorShowLut').onclick=()=>showLutDialog(false);
if($('colorDisplayLuts'))$('colorDisplayLuts').onclick=()=>showLutDialog(true);
if($('colorInvertLuts'))$('colorInvertLuts').onclick=()=>{$('invert').checked=!$('invert').checked;commitFrameChange('color');scheduleRender(0);};
if($('colorSplitChannels'))$('colorSplitChannels').onclick=()=>{if(!String(dataset.axes||'').endsWith('S')){showError(new Error('Split Channels requires an RGB image.'));return;}for(const [action,label] of [['channelRed','Red channel'],['channelGreen','Green channel'],['channelBlue','Blue channel']])derive(action,label);};
for(const id of ['colorMergeChannels','colorChannelsTool','colorStackToRgb','colorMakeComposite'])if($(id)){$(id).disabled=true;$(id).title='Planned';}
document.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;
  const k=e.key.toLowerCase();
  if(e.shiftKey&&(['Equal','Minus','NumpadAdd','NumpadSubtract'].includes(e.code)||['+','=','-','_'].includes(k))){e.preventDefault();zoom(['Equal','NumpadAdd'].includes(e.code)||['+','='].includes(k)?1:-1);return;}
  if(tileMode&&['arrowleft','arrowright','arrowup','arrowdown'].includes(k)){
    e.preventDefault();const {w,h}=size(),{ids,cols}=tileGeometry(w,h),index=ids.indexOf(activeFileFrame),delta={arrowleft:-1,arrowright:1,arrowup:-cols,arrowdown:cols}[k],next=ids[index+delta];if(next)selectFileFrame(next);return;
  }
  const matches=action=>k===String(keyboardShortcuts[action]||'').toLowerCase();
  if(matches('fit'))fit();else if(matches('pan'))setTool('pan');else if(matches('roi'))setTool('roi');else if(matches('oval'))setTool('oval');else if(matches('line'))setTool('line');else if(matches('measure'))analyze('measure');else if(matches('undoTransform'))vscode.postMessage({type:'transformFrame',fileFrame:activeFileFrame,action:'undo',args:base()});else if(matches('clear')){$('clear').click();stopPlay();stopBlink();for(const menu of document.querySelectorAll('.menu'))menu.open=false;}
});
new ResizeObserver(()=>{if(dataset)scheduleRender(80);}).observe($('stage'));
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPlay();stopSliceHold();}});
window.addEventListener('message',({data:m})=>{
  if(m.type==='frameAdded'){
    if(m.keyboardShortcuts)keyboardShortcuts={...keyboardShortcuts,...m.keyboardShortcuts};
    if($('editUndo'))$('editUndo').disabled=!m.canUndo;
    if($('editRedo'))$('editRedo').disabled=!m.canRedo;
  fileFrames.set(m.frameId,{metadata:m});selectFileFrame(m.frameId);
    setTool('pan');
    if(m.initialSelection){selection=m.initialSelection;refreshSelection();saveFileFrame();}
  }else if(m.type==='frameUpdated'){
    if(orthogonal&&m.frameId===activeFileFrame)disableOrthogonal();
    if($('editUndo'))$('editUndo').disabled=!m.canUndo;
    if($('editRedo'))$('editRedo').disabled=!m.canRedo;
    const state=fileFrames.get(m.frameId);if(!state)return;
    const oldDataset=state.metadata.datasets.find(item=>item.id===(state.datasetId??state.metadata.datasets[0].id));
    const retained=transformCachedState(m.frameId,state,m.displayTransform,oldDataset);
    state.metadata={...state.metadata,...m};for(const key of transferHistograms.keys())if(key.startsWith(`${m.frameId}:`))transferHistograms.delete(key);
    if(!retained){state.preview=null;state.tilePreview=null;state.previewBox=null;state.frameCache=new Map();state.cacheSignature='';state.cacheBytes=0;state.tileSignature='';}
    state.plane=Math.min(state.plane||1,state.metadata.datasets[0].frames);
    if(m.frameId===activeFileFrame){activeFileFrame=null;selectFileFrame(m.frameId);}else{frameList();scheduleTileRefresh(0);}
  }else if(m.type==='sideAction'){
    applySidebarAction(m.action,m.value);
  }else if(m.type==='frameRenamed'){
    const state=fileFrames.get(m.frameId);if(state){state.metadata={...state.metadata,...m};if(m.frameId===activeFileFrame){metadata=state.metadata;$('filename').textContent=metadata.label;$('filename').title=metadata.path;}frameList();draw();}
  }else if(m.type==='memoryInfo'){
    const mib=n=>formatValue(n/1048576);const dialog=openDialog('memory','Monitor Memory',`<pre>Extension host RSS: ${mib(m.host.rss)} MiB\nHost free: ${mib(m.free)} / ${mib(m.total)} MiB\nCurrent preview cache: ${mib(cacheBytes)} MiB\nImage Frames: ${fileFrames.size}</pre>`);dialog.hidden=false;
  }else if(m.type==='result'||m.type==='error'){
    const p=pending.get(m.id);if(p){pending.delete(m.id);m.type==='error'?p.reject(new Error(m.message)):p.resolve(m.result);}else if(m.type==='error')showError(new Error(m.message));
  }
});
vscode.postMessage({type:'ready'});
