'use strict';
const vscode = acquireVsCodeApi();
const $ = id => document.getElementById(id);
const roiGeometry = window.ViviRoiGeometry;
const lutOptions=[['gray','Grays'],['fire','Fire'],['ice','Ice'],['spectrum','Spectrum'],['rgb332','3-3-2 RGB'],['red','Red'],['green','Green'],['blue','Blue'],['cyan','Cyan'],['magenta','Magenta'],['yellow','Yellow'],['redgreen','Red/Green'],['heat','Heat'],['cool','Cool'],['sepia','Sepia'],['viridis','Viridis'],['plasma','Plasma'],['magma','Magma'],['inferno','Inferno'],['turbo','Turbo']];
const canvas = $('canvas'), ctx = canvas.getContext('2d');
let metadata, dataset, scale = 1, cx = 0, cy = 0, preview, previewBox;
const fileFrames = new Map();
let activeFileFrame = null, frameCache = new Map(), tileMode = false, toolVariant = '';
const toolVariants={roi:'roi',oval:'oval',line:'line'};
const frameLocks = new Set(), lockGroups = {bc:['cuts','low','high','stretch'],color:['cmap','invert','threshold'],view:['cx','cy'],scale:['scale'],slice:['plane']};
let tileRefreshTimer, sidebarTimer, layoutColumns=0, layoutRows=0;
let roi = null, line = null, selection = null, annotations = [], overlays = [], roiManager = [], vertices = [], drag = null, serial = 0, revision = 0, renderedRevision = -1;
const selectionDefaults={stroke:'#72ebc4',strokeWidth:1.5};
let renderRunning = false, renderWanted = false, renderTimer, pixelTimer, pixelRunning = false;
let playing = false, playbackTimer, analysisRunning = false, blinking = false, blinkTimer;
const pending = new Map();
let cacheSignature = '', cacheGeneration = 0, cacheBytes = 0, preloadRunning = false, preloadRestartWanted = false, preloadTimer, activePng = '';
const overviewCache = new Map();
let overviewBytes = 0, overviewRunning = false;
const fullBox = () => [0, 0, dataset.width, dataset.height];
const fullPreview = () => Math.max(dataset.width, dataset.height) <= metadata.maxSize;
const cacheKey = (frame, box) => `${frame}:${box.join(',')}`;
const overviewKey = (signature, frame) => `${signature}:${frame}`;
const visibleFrameIds = () => [...fileFrames].filter(([,state])=>state.visible!==false).map(([id])=>id);
function tileGeometry(w,h){const ids=visibleFrameIds(),cols=layoutColumns||Math.max(1,layoutRows?Math.ceil(ids.length/layoutRows):Math.ceil(Math.sqrt(ids.length))),rows=Math.max(layoutRows||0,Math.ceil(ids.length/cols),1);return {ids,cols,rows,tw:w/cols,th:h/rows};}
function sidebarState(){
  if(!dataset)return null;
  return {active:activeFileFrame,activeLabel:metadata.label||metadata.path.split(/[\\/]/).pop(),frames:[...fileFrames].map(([id,state])=>({id,label:state.metadata.label||state.metadata.path.split(/[\\/]/).pop(),visible:state.visible!==false})),
    datasets:metadata.datasets.map(d=>({id:d.id,name:d.name})),datasetId:dataset.id,slice:Number($('frame').value),total:dataset.frames,fps:Number($('fps').value)||5,playing,blinking,tile:tileMode,columns:layoutColumns,rows:layoutRows,locks:[...frameLocks],
    cuts:$('cuts').value,low:$('low').value,high:$('high').value,stretch:$('stretch').value,cmap:$('cmap').value,luts:lutOptions,invert:$('invert').checked,threshold:$('threshold').checked};
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
  const picture=fileFrames.get(activeFileFrame)?.tilePreview||preview;
  const baseRatio=Math.min((tw-16)/dataset.width,(th-34)/dataset.height);
  const normalScale=Math.min(w/dataset.width,h/dataset.height)*.96;
  const pixelsPerImage=picture&&fileFrames.get(activeFileFrame)?.tilePreview?baseRatio*scale/normalScale:Math.min((tw-16)/dataset.width,(th-34)/dataset.height);
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
      if(picture){const d=state.metadata.datasets.find(item=>item.id===(state.datasetId??state.metadata.datasets[0].id));const baseRatio=Math.min((tw-16)/d.width,(th-34)/d.height);const viewScale=state.scale??baseRatio;const normalScale=Math.min(w/d.width,h/d.height)*.96;const ratio=state.tilePreview?baseRatio*viewScale/normalScale*d.width/picture.width:Math.min((tw-16)/picture.width,(th-34)/picture.height);const pw=picture.width*ratio,ph=picture.height*ratio,centerX=state.tilePreview?(state.cx??d.width/2)/d.width*picture.width:picture.width/2,centerY=state.tilePreview?(state.cy??d.height/2)/d.height*picture.height:picture.height/2;ctx.save();ctx.beginPath();ctx.rect(x+3,y+22,tw-6,th-25);ctx.clip();ctx.drawImage(picture,x+tw/2-centerX*ratio,y+22+(th-26)/2-centerY*ratio,pw,ph);ctx.restore();}
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
  ctx.setLineDash([]);if(tileMode&&tileViewport())ctx.restore();$('zoom').textContent=`${(scale*100).toFixed(1)}%`;
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
function drawEntry(entry){const box=entry.result.box,[x,y]=transform(box[0],box[1]);ctx.drawImage(entry.image,x,y,(box[2]-box[0])*scale,(box[3]-box[1])*scale);}
function scheduleRender(delay=75) {
  if(!dataset)return;
  clearTimeout(playbackTimer);
  revision++;renderWanted=true;clearTimeout(renderTimer);renderTimer=setTimeout(render,delay);draw();
}
function renderArgs(frame) {
  return {dataset:dataset.id,frame,box:fullPreview()?fullBox():visibleBox(),size:metadata.maxSize,cuts:$('cuts').value,low:Number($('low').value),high:Number($('high').value),stretch:$('stretch').value,cmap:$('cmap').value,invert:$('invert').checked,threshold:$('threshold').checked,thresholdLow:Number($('low').value),thresholdHigh:Number($('high').value)};
}
function signatureOf(args) {
  const {frame, box, low, high, thresholdLow, thresholdHigh, ...rest} = args;
  return activeFileFrame + ':' + JSON.stringify(args.cuts === 'manual' || args.threshold ? {...rest,low,high,thresholdLow,thresholdHigh} : rest);
}
function ensureCache(signature) {
  if (signature === cacheSignature) return;
  frameCache.clear(); cacheBytes = 0; cacheSignature = signature; cacheGeneration++;
  clearTimeout(preloadTimer); updateCacheStatus();
}
function updateCacheStatus() {
  $('cacheStatus').textContent = dataset?.frames > 1 ? `${new Set([...frameCache.keys()].map(key=>key.split(':')[0])).size}/${dataset.frames} ready` : '';
}
async function decodePreview(result) {
  const image = new Image(); image.src = 'data:image/png;base64,' + result.png; await image.decode();
  return {image, result, bytes:image.width*image.height*4 + result.png.length*0.75};
}
function showPreview(entry, ticket) {
  if (ticket !== revision) return;
  preview = entry.image; previewBox = entry.result.box; activePng = entry.result.png;
  renderedRevision = ticket; $('empty').hidden = true; $('error').textContent = '';
  if ($('cuts').value !== 'manual') {
    $('low').value = entry.result.low; $('high').value = entry.result.high;
    if(frameLocks.has('bc')){$('cuts').value='manual';commitFrameChange('bc');scheduleRender(0);}
  }
  $('busy').textContent = ''; draw();
  publishSidebar();
}
function scheduleOverview() {
  if(fullPreview()||overviewRunning||renderRunning||renderWanted)return;
  const frame=Number($('frame').value)-1,signature=cacheSignature,key=overviewKey(signature,frame);
  if(overviewCache.has(key))return;
  overviewRunning=true;
  const args={...renderArgs(frame),box:fullBox()};
  request('render',args,true).then(decodePreview).then(entry=>{
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
  const order = Array.from({length:dataset.frames}, (_,frame)=>frame).sort((a,b)=>Math.abs(a-active)-Math.abs(b-active));
  const limit = Math.max(32,Number(metadata.preloadMaxMiB)||512)*1024*1024;
  try {
    for (const frame of order) {
      if (generation !== cacheGeneration || renderRunning || renderWanted) break;
      const args = renderArgs(frame),key=cacheKey(frame,args.box);
      if (frameCache.has(key)) continue;
      if (signatureOf(args) !== signature) break;
      const estimate = Math.min(dataset.width,metadata.maxSize)*Math.min(dataset.height,metadata.maxSize)*4;
      if (cacheBytes + estimate > limit) break;
      try {
        const entry = await decodePreview(await request('render',args,true));
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
  if(cached){showPreview(cached,ticket);schedulePlayback();schedulePreload();return;}
  renderRunning=true;
  if (!preview) $('busy').textContent='Loading…';
  try {
    const entry=await decodePreview(await request('render',args));
    if (cacheSignature === signature) {frameCache.set(key,entry);cacheBytes += entry.bytes;updateCacheStatus();trimFrameCache();}
    showPreview(entry,ticket);
  } catch(error){showError(error);stopPlay();}
  finally{renderRunning=false;if(renderWanted)render();else{schedulePlayback();schedulePreload();}}
}
function trimFrameCache(){
  const limit=Math.max(32,Number(metadata.preloadMaxMiB)||512)*1024*1024;
  while(cacheBytes>limit&&frameCache.size>1){const oldest=frameCache.keys().next().value;cacheBytes-=frameCache.get(oldest).bytes;frameCache.delete(oldest);}
}
function showError(error){$('error').textContent=error.message;$('busy').textContent='Error';}
function fit(){if(!dataset)return;const {w,h}=size();scale=Math.min(w/dataset.width,h/dataset.height)*.96;cx=dataset.width/2;cy=dataset.height/2;commitFrameChange('view');commitFrameChange('scale');scheduleRender(0);}
const zoomLevels=[1/72,1/48,1/32,1/24,1/16,1/12,1/8,1/6,1/4,1/3,1/2,.75,1,1.5,2,3,4,6,8,12,16,24,32];
let lastPointer=null;
function zoom(direction){
  if(!dataset)return;
  const old=scale,epsilon=1e-9;
  const next=direction>0?zoomLevels.find(value=>value>old+epsilon):[...zoomLevels].reverse().find(value=>value<old-epsilon);
  if(!next)return;
  const anchor=$('tool').value==='pan'&&lastPointer?lastPointer:null;
  scale=next;
  if(anchor){cx=anchor[0]-(anchor[0]-cx)*old/scale;cy=anchor[1]-(anchor[1]-cy)*old/scale;}
  clampCenter();commitFrameChange('scale');if(anchor)commitFrameChange('view');scheduleRender();
}
function stopPlay(){playing=false;clearTimeout(playbackTimer);$('playIcon').setAttribute('href','#i-play');$('play').title='Play frames';publishSidebar();}
function frameLabel(){
  let n=Number($('frame').value)-1;
  const coordinates=[];
  for(const axis of [...dataset.extra].reverse()){
    const length=dataset.shape[axis];
    coordinates.unshift(`${dataset.axes?.[axis]||`D${axis}`} ${n%length+1}`);
    n=Math.floor(n/length);
  }
  $('frameCount').textContent=`/ ${dataset.frames}${coordinates.length>1?' · '+coordinates.join(' '):''}`;
  publishSidebar();
}
function changeFrame(delta, automatic=false){if(!dataset)return;let n=Number($('frame').value)-1+delta;if(automatic)n%=dataset.frames;else n=Math.max(0,Math.min(dataset.frames-1,n));$('frame').value=n+1;frameLabel();$('pixel').textContent='';commitFrameChange('slice');scheduleRender(0);}
function selectDataset(){dataset=metadata.datasets.find(d=>d.id===Number($('dataset').value));$('frame').value=1;$('frame').max=dataset.frames;frameLabel();$('play').disabled=dataset.frames<2;roi=null;line=null;selection=null;annotations=[];overlays=[];roiManager=[];vertices=[];preview=null;activePng='';stopPlay();$('metadata').textContent=`${dataset.width} × ${dataset.height}\n${dataset.dtype} · ${metadata.kind}\nShape: ${dataset.shape.join(' × ')}\nAxes: ${dataset.axes||'FITS (..., Y, X)'}`;fit();}
function saveFileFrame() {
  if (!activeFileFrame || !fileFrames.has(activeFileFrame)) return;
  Object.assign(fileFrames.get(activeFileFrame), {metadata,datasetId:dataset?.id,plane:Number($('frame').value),scale,cx,cy,preview,previewBox,activePng,frameCache,cacheSignature,cacheBytes,
    cuts:$('cuts').value,low:$('low').value,high:$('high').value,stretch:$('stretch').value,cmap:$('cmap').value,invert:$('invert').checked,threshold:$('threshold').checked,roi,line,selection,annotations,overlays,roiManager});
}
function scheduleTileRefresh(delay=80){if(!tileMode)return;clearTimeout(tileRefreshTimer);tileRefreshTimer=setTimeout(refreshTilePreviews,delay);}
function refreshTilePreviews(){
  if(!tileMode)return;
  saveFileFrame();
  for(const [id,state] of fileFrames){
    if(state.visible===false)continue;
    const d=state.metadata.datasets.find(item=>item.id===(state.datasetId??state.metadata.datasets[0].id));
    if(!d)continue;
    const args={dataset:d.id,frame:Math.max(0,Math.min(d.frames-1,(state.plane||1)-1)),box:[0,0,d.width,d.height],size:Math.min(1024,state.metadata.maxSize),cuts:state.cuts||'percentile',low:Number(state.low??0),high:Number(state.high??1),stretch:state.stretch||'linear',cmap:state.cmap||'gray',invert:!!state.invert,threshold:!!state.threshold,thresholdLow:Number(state.low??0),thresholdHigh:Number(state.high??1)};
    const signature=JSON.stringify(args);
    if(signature===state.tileSignature)continue;
    state.tileSignature=signature;
    const generation=(state.tileGeneration||0)+1;state.tileGeneration=generation;
    request('render',args,true,id).then(decodePreview).then(entry=>{if(fileFrames.get(id)!==state||state.tileGeneration!==generation)return;state.tilePreview=entry.image;draw();}).catch(()=>{if(state.tileGeneration===generation)state.tileSignature='';});
  }
}
function commitFrameChange(group){
  if(!activeFileFrame||!fileFrames.has(activeFileFrame))return;
  saveFileFrame();
  publishSidebar();
  if(!frameLocks.has(group)){
    if(['bc','color','slice'].includes(group))scheduleTileRefresh();else if(tileMode)draw();
    return;
  }
  if(group==='bc'&&$('cuts').value!=='manual')return;
  const active=fileFrames.get(activeFileFrame),keys=lockGroups[group];
  for(const [id,state] of fileFrames){
    if(id===activeFileFrame)continue;
    for(const key of keys)state[key]=active[key];
    if(group==='slice'){
      const d=state.metadata.datasets.find(item=>item.id===(state.datasetId??state.metadata.datasets[0].id));
      state.plane=Math.max(1,Math.min(d.frames,active.plane));
    }
    if(group==='bc'||group==='color'||group==='slice'){
      state.frameCache?.clear();state.cacheSignature='';state.cacheBytes=0;
    }
  }
  if(['bc','color','slice'].includes(group))scheduleTileRefresh();else if(tileMode)draw();
}
function setFrameLock(group,enabled){
  if(enabled)frameLocks.add(group);else frameLocks.delete(group);
  if(enabled&&group==='bc'&&$('cuts').value!=='manual')$('cuts').value='manual';
  if(enabled)commitFrameChange(group);
  frameList();
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
function selectFileFrame(id) {
  id=Number(id); if(!fileFrames.has(id)||id===activeFileFrame)return;
  const oldId=activeFileFrame;
  saveFileFrame(); stopPlay(); clearTimeout(renderTimer); clearTimeout(preloadTimer); revision++; cacheGeneration++;
  activeFileFrame=id;
  const state=fileFrames.get(id); metadata=state.metadata;
  if(state.datasetId===undefined&&oldId!==null){const source=fileFrames.get(oldId);if(source)for(const group of frameLocks)for(const key of lockGroups[group])state[key]=source[key];}
  $('filename').textContent=metadata.label||metadata.path.split(/[\\/]/).pop(); $('filename').title=metadata.path;
  $('warning').textContent=metadata.warning; $('dataset').replaceChildren();
  for(const d of metadata.datasets){const option=document.createElement('option');option.value=d.id;option.textContent=d.name;$('dataset').append(option);}
  $('dataset').value=String(state.datasetId??metadata.datasets[0].id);
  dataset=metadata.datasets.find(d=>d.id===Number($('dataset').value));
  $('frame').value=state.plane||1; $('frame').max=dataset.frames; frameLabel(); $('play').disabled=dataset.frames<2;
  scale=state.scale??1; cx=state.cx??dataset.width/2; cy=state.cy??dataset.height/2;
  preview=state.preview||null; previewBox=state.previewBox||null; activePng=state.activePng||'';
  frameCache=state.frameCache||new Map(); cacheSignature=state.cacheSignature||''; cacheBytes=state.cacheBytes||0;
  roi=state.roi||null; line=state.line||null; selection=state.selection||null;annotations=state.annotations||[];overlays=state.overlays||[];roiManager=state.roiManager||[];vertices=[];
  for(const key of ['cuts','low','high','stretch','cmap']) $(key).value=state[key]??(key==='cuts'?'percentile':key==='stretch'?'linear':key==='cmap'?'gray':key==='low'?'0':'1');
  $('invert').checked=!!state.invert; $('threshold').checked=!!state.threshold;
  $('frame').value=Math.max(1,Math.min(dataset.frames,Number($('frame').value)));frameLabel();clampCenter();
  $('metadata').textContent=`${dataset.width} × ${dataset.height}\n${dataset.dtype} · ${metadata.kind}\nShape: ${dataset.shape.join(' × ')}\nAxes: ${dataset.axes||'FITS (..., Y, X)'}`;
  $('empty').hidden=!!preview; $('error').textContent=''; $('busy').textContent='';
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
async function analyze(op){if(!dataset||analysisRunning)return;if(op==='measure'&&selection?.type==='angle'&&selection.points.length===3){const [a,b,c]=selection.points,u=[a[0]-b[0],a[1]-b[1]],v=[c[0]-b[0],c[1]-b[1]],cos=(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v));$('analysis').textContent=`Angle: ${(Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI).toFixed(3)}°`;chart([]);$('analysisPane').hidden=false;return;}if(op==='profile'&&!line){showError(new Error('Choose Line [L] and draw a line first.'));return;}stopPlay();analysisRunning=true;$('busy').textContent='Analyzing…';const args={...base(),box:roi||undefined,points:line,selection};try{const r=await request(op,args);$('error').textContent='';if(op==='measure'){$('analysis').textContent=`Frame: ${r.frame+1} · Dataset: ${r.dataset}\nROI: ${r.box.join(', ')}\nArea: ${r.area} px²\nFinite pixels: ${r.count}\nMean: ${r.mean}\nStd (population): ${r.std}\nMin: ${r.min}\nMax: ${r.max}\nSum: ${r.sum}`;chart([]);}else if(op==='histogram'){$('analysis').textContent=`Histogram · ${r.samples} samples\n${r.sampled?'Sampled; stride '+r.step:'All pixels'}\nX: ${r.edges[0]} … ${r.edges.at(-1)}\nY: count per bin`;chart(r.counts);}else{$('analysis').textContent=`Profile · ${r.values.length} points\nLength: ${r.distance.at(-1).toFixed(3)} px\nX: distance · Y: raw value\nNearest-neighbor samples`;chart(r.values);}$('analysisPane').hidden=false;$('busy').textContent='';}catch(error){showError(error);}finally{analysisRunning=false;}}
canvas.addEventListener('wheel',e=>{e.preventDefault();lastPointer=position(e);zoom(e.deltaY<0?1:-1);},{passive:false});
function showPopup(menu,event,items){event.preventDefault();menu.replaceChildren();for(const [label,run] of items){const button=document.createElement('button');button.textContent=label;button.disabled=!run;if(run)button.onclick=()=>{menu.hidden=true;run();};menu.append(button);}menu.hidden=false;menu.style.left=Math.min(event.clientX,window.innerWidth-menu.offsetWidth-6)+'px';menu.style.top=Math.min(event.clientY,window.innerHeight-menu.offsetHeight-6)+'px';}
canvas.oncontextmenu=e=>{if(e.altKey||!dataset)return;if($('tool').value==='zoom'){e.preventDefault();lastPointer=position(e);zoom(-1);return;}const point=position(e);const selected=selection&&vertices.length===0&&!e.shiftKey&&(hitSelectionHandle(e)>=0||insideSelection(point));
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
  if(tileMode){const rect=canvas.getBoundingClientRect(),{ids,cols,rows}=tileGeometry(rect.width,rect.height),col=Math.floor((e.clientX-rect.left)/(rect.width/cols)),row=Math.floor((e.clientY-rect.top)/(rect.height/rows)),id=ids[row*cols+col];if(!id)return;if(id!==activeFileFrame){selectFileFrame(id);draw();return;}}
  if(e.button===2&&!e.altKey)return;
  stopPlay();const raw=bounded(position(e)),tool=e.button===2?'contrast':e.button===1?'pan':$('tool').value;
  lastPointer=raw;
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
  if(tool==='zoom'){zoom(e.altKey?-1:1);return;}
  if(tool==='lut'){openBCDialog();return;}
  if(tool==='text'){openTextDialog(point);return;}
  if(tool==='polygon'||tool==='angle'||(tool==='line'&&toolVariant==='segmented')){
    vertices.push(point);selection={type:tool,points:[...vertices]};draw();
    if(tool==='angle'&&vertices.length===3)finishSelection(tool,vertices);
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  drag={screen:[e.clientX,e.clientY],point,cx,cy,tool,low:Number($('low').value),high:Number($('high').value)};
  if(['roi','oval','freehand','line'].includes(tool)){
    roi=null;line=null;selection={type:tool,points:tool==='freehand'?[point]:[point,point]};
  }
};
canvas.ondblclick=()=>{if(tileMode){tileMode=false;frameList();draw();}else if(( $('tool').value==='polygon'||toolVariant==='segmented')&&vertices.length>=2){if(vertices.length>2){const a=vertices.at(-1),b=vertices.at(-2);if(Math.hypot(a[0]-b[0],a[1]-b[1])<2)vertices.pop();}finishSelection(toolVariant==='segmented'?'line':'polygon',vertices);}};
canvas.onpointermove=e=>{
  if(!dataset)return;
  const p=position(e);lastPointer=p;
  if(drag){const dx=e.clientX-drag.screen[0],dy=e.clientY-drag.screen[1];
    if(drag.tool==='editHandle'||drag.tool==='editMove'){dragEditedSelection(e,roiGeometry.pixelPoint(p,dataset.width,dataset.height));return;}
    if(drag.tool==='pan'){cx=drag.cx-dx/scale;cy=drag.cy-dy/scale;clampCenter();commitFrameChange('view');scheduleRender(100);}
    else if(drag.tool==='contrast'){const span=Math.max(1e-12,drag.high-drag.low),range=span*Math.exp(dy/150),middle=(drag.low+drag.high)/2-dx/300*span;$('cuts').value='manual';$('low').value=middle-range/2;$('high').value=middle+range/2;commitFrameChange('bc');scheduleRender(100);}
    else if(selection){let end=roiGeometry.pixelPoint(p,dataset.width,dataset.height);if(['roi','oval'].includes(drag.tool))selection.points=rectPoints(roiGeometry.createRect(drag.point,end,{shift:e.shiftKey,center:e.ctrlKey||e.metaKey}));
      else if(drag.tool==='line'&&e.shiftKey){const dx=end[0]-drag.point[0],dy=end[1]-drag.point[1],angle=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4,length=Math.hypot(dx,dy);end=bounded([drag.point[0]+length*Math.cos(angle),drag.point[1]+length*Math.sin(angle)]);selection.points=[drag.point,end];}
      else if(drag.tool==='freehand'||toolVariant==='freeline')selection.points.push(end);else selection.points=[drag.point,end];
      selection.points=selection.points.map(q=>roiGeometry.pixelPoint(q,dataset.width,dataset.height));
      $('region').textContent=selection.points.map(q=>q.join(',')).join(' → ');draw();}
    return;
  }
  clearTimeout(pixelTimer);const stamp=revision,b=base();
  pixelTimer=setTimeout(async()=>{if(pixelRunning||p[0]<0||p[1]<0||p[0]>=dataset.width||p[1]>=dataset.height)return;pixelRunning=true;try{const r=await request('pixel',{...b,x:Math.floor(p[0]),y:Math.floor(p[1])});if(stamp===revision)$('pixel').textContent=`X ${r.x}   Y ${r.y}\nValue: ${JSON.stringify(r.value)}`;}catch{/* main actions report worker errors */}finally{pixelRunning=false;}},100);
};
canvas.onpointerup=e=>{if(!drag)return;if(selection&&['roi','oval','freehand','line'].includes(drag.tool)){if(Math.hypot(e.clientX-drag.screen[0],e.clientY-drag.screen[1])<3){selection=null;roi=null;line=null;$('region').textContent='Full image';}else finishSelection(drag.tool,selection.points);}else if(['editHandle','editMove'].includes(drag.tool))refreshSelection();drag=null;canvas.releasePointerCapture(e.pointerId);draw();};
canvas.onpointercancel=()=>{drag=null;};
const tools = [['roiTool','roi'],['ovalTool','oval'],['polygonTool','polygon'],['freehandTool','freehand'],['lineTool','line'],['angleTool','angle'],['textTool','text'],['zoomTool','zoom'],['panTool','pan'],['pointerTool','pointer'],['lutTool','lut']];
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
$('fit').onclick=fit;$('actual').onclick=()=>{const old=scale;scale=1;if($('tool').value==='pan'&&lastPointer){cx=lastPointer[0]-(lastPointer[0]-cx)*old;cy=lastPointer[1]-(lastPointer[1]-cy)*old;clampCenter();commitFrameChange('view');}commitFrameChange('scale');scheduleRender(0);};$('zoomIn').onclick=()=>zoom(1);$('zoomOut').onclick=()=>zoom(-1);
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
function hideHoverTip(){hoverTip.hidden=true;hoveredTipTarget=null;}
document.addEventListener('pointerover',event=>{
  const target=event.target.closest('.tool-bar button, .menu-bar summary, .menu-panel button, .menu-panel summary, .dialog-head button');
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
$('minimizeAnalysis').onclick=()=>$('analysisPane').classList.toggle('minimized');
$('pinAnalysis').onclick=()=>$('analysisPane').classList.toggle('pinned');
$('dataset').onchange=selectDataset;
for(const id of ['cuts','stretch'])$(id).onchange=()=>{commitFrameChange('bc');scheduleRender(0);};
for(const id of ['cmap','invert','threshold'])$(id).onchange=()=>{commitFrameChange('color');scheduleRender(0);};
for(const id of ['low','high'])$(id).onchange=()=>{$('cuts').value='manual';commitFrameChange('bc');scheduleRender(0);};
$('clear').onclick=()=>{roi=null;line=null;selection=null;vertices=[];$('region').textContent='Full image';draw();};
for(const op of ['measure','histogram','profile'])$(op).onclick=()=>analyze(op);
$('previous').onclick=()=>{stopPlay();changeFrame(-1);};$('next').onclick=()=>{stopPlay();changeFrame(1);};
$('frame').onchange=()=>{stopPlay();const n=Number($('frame').value);$('frame').value=Math.max(1,Math.min(dataset.frames,Number.isFinite(n)?Math.trunc(n):1));changeFrame(0);};
$('play').onclick=()=>{if(playing)stopPlay();else{playing=true;$('playIcon').setAttribute('href','#i-pause');$('play').title='Pause frames';changeFrame(1,true);}};
$('savePng').onclick=()=>{if(renderedRevision!==revision){showError(new Error('Wait for the current view to finish rendering before exporting.'));return;}vscode.postMessage({type:'export',kind:'png',png:activePng,fileFrame:activeFileFrame});};
$('saveCsv').onclick=()=>vscode.postMessage({type:'export',kind:'csv',fileFrame:activeFileFrame});
$('fileFrames').onchange=()=>selectFileFrame($('fileFrames').value);
$('previousFileFrame').onclick=()=>moveFileFrame(-1);
$('nextFileFrame').onclick=()=>moveFileFrame(1);
$('tile').onclick=()=>{saveFileFrame();tileMode=!tileMode;frameList();draw();if(tileMode)scheduleTileRefresh(0);};
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
  else if(action==='closeFrame')closeFileFrame(value);
  else if(action==='previousFrame')moveFileFrame(-1);
  else if(action==='nextFrame')moveFileFrame(1);
  else if(action==='tile')$('tile').click();
  else if(action==='blink')$('blink').click();
  else if(action==='columns'||action==='rows'){if(action==='columns')layoutColumns=Math.max(0,Math.min(16,Number(value)||0));else layoutRows=Math.max(0,Math.min(16,Number(value)||0));frameList();draw();}
  else if(action==='reorderFrame')reorderFrame(Number(value.from),Number(value.to));
  else if(action==='frameVisible')setFrameVisible(Number(value.id),!!value.visible);
  else if(action==='lock')setFrameLock(value.group,!!value.enabled);
  else if(action==='lockAll')for(const group of Object.keys(lockGroups))setFrameLock(group,true);
  else if(action==='unlockAll'){$('unlockAll').click();}
  else if(action==='adjust'){
    for(const key of ['cuts','low','high','stretch','cmap'])$(key).value=value[key];
    $('invert').checked=!!value.invert;$('threshold').checked=!!value.threshold;
    commitFrameChange('bc');commitFrameChange('color');scheduleRender(0);publishSidebar();
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
  dialog.querySelector('.dialog-close').onclick=()=>dialog.remove();
  dialog.querySelector('.dialog-min').onclick=()=>dialog.classList.toggle('minimized');
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
  vscode.postMessage({type:'derive',fileFrame:activeFileFrame,label,args:{dataset:dataset.id,frame:Number($('frame').value)-1,box,action,value}});
}
for(const [id,action,label] of [['flipHorizontal','flipHorizontal','Flip Horizontal'],['flipVertical','flipVertical','Flip Vertical'],['imageCrop','crop','Crop'],['processNormalize','normalize','Normalize']])$(id).onclick=()=>derive(action,label);
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
function openMontageDialog(){const dialog=openDialog('montage','Make Montage',`<label>First slice <input class="montage-start" type="number" min="1" value="1"></label><label>Last slice <input class="montage-end" type="number" min="1"></label><label>Columns <input class="montage-columns" type="number" min="1" max="32" value="5"></label><label>Tile size <input class="montage-tile" type="number" min="32" max="512" value="160"></label><div class="dialog-actions"><button class="montage-create">Create Frame</button></div>`);dialog.querySelector('.montage-end').value=dataset.frames;dialog.querySelector('.montage-create').onclick=()=>{const args={dataset:dataset.id,start:Number(dialog.querySelector('.montage-start').value),end:Number(dialog.querySelector('.montage-end').value),columns:Number(dialog.querySelector('.montage-columns').value),tile:Number(dialog.querySelector('.montage-tile').value),cuts:$('cuts').value,low:Number($('low').value),high:Number($('high').value),stretch:$('stretch').value,cmap:$('cmap').value};vscode.postMessage({type:'montage',fileFrame:activeFileFrame,args});dialog.remove();};}
$('openBC').onclick=openBCDialog;
$('autoCuts').onclick=()=>{$('cuts').value='percentile';commitFrameChange('bc');scheduleRender(0);};
$('resetCuts').onclick=()=>{$('cuts').value='minmax';$('stretch').value='linear';commitFrameChange('bc');scheduleRender(0);};
$('montage').onclick=openMontageDialog;
document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;const k=e.key.toLowerCase();if(k==='f')fit();if(k==='p')setTool('pan');if(k==='r')setTool('roi');if(k==='o')setTool('oval');if(k==='l')setTool('line');if(k==='m')analyze('measure');if(k==='escape'){$('clear').click();stopPlay();stopBlink();for(const menu of document.querySelectorAll('.menu'))menu.open=false;}});
new ResizeObserver(()=>{if(dataset)scheduleRender(80);}).observe($('stage'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlay();});
window.addEventListener('message',({data:m})=>{
  if(m.type==='frameAdded'){
    fileFrames.set(m.frameId,{metadata:m});selectFileFrame(m.frameId);
    if(m.initialSelection){selection=m.initialSelection;refreshSelection();saveFileFrame();}
  }else if(m.type==='sideAction'){
    applySidebarAction(m.action,m.value);
  }else if(m.type==='frameRenamed'){
    const state=fileFrames.get(m.frameId);if(state){state.metadata={...state.metadata,...m};if(m.frameId===activeFileFrame){metadata=state.metadata;$('filename').textContent=m.path.split(/[\\/]/).pop();$('filename').title=m.path;}frameList();draw();}
  }else if(m.type==='memoryInfo'){
    const mib=n=>(n/1048576).toFixed(1);const dialog=openDialog('memory','Monitor Memory',`<pre>Extension host RSS: ${mib(m.host.rss)} MiB\nHost free: ${mib(m.free)} / ${mib(m.total)} MiB\nCurrent preview cache: ${mib(cacheBytes)} MiB\nImage Frames: ${fileFrames.size}</pre>`);dialog.hidden=false;
  }else if(m.type==='result'||m.type==='error'){
    const p=pending.get(m.id);if(p){pending.delete(m.id);m.type==='error'?p.reject(new Error(m.message)):p.resolve(m.result);}else if(m.type==='error')showError(new Error(m.message));
  }
});
vscode.postMessage({type:'ready'});
