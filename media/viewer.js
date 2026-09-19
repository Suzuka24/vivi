'use strict';
const vscode = acquireVsCodeApi();
const $ = id => document.getElementById(id);
const canvas = $('canvas'), ctx = canvas.getContext('2d');
let metadata, dataset, scale = 1, cx = 0, cy = 0, preview, previewBox;
const fileFrames = new Map();
let activeFileFrame = null, frameCache = new Map(), tileMode = false, toolVariant = '';
const frameLocks = new Set(), lockGroups = {bc:['cuts','low','high','stretch'],color:['cmap','invert','threshold'],view:['cx','cy'],scale:['scale'],slice:['plane']};
let tileRefreshTimer;
let roi = null, line = null, selection = null, annotations = [], vertices = [], drag = null, serial = 0, revision = 0, renderedRevision = -1;
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
function request(op, args, prefetch = false, fileFrame = activeFileFrame) {
  return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});vscode.postMessage({type:'request',id,op,args,prefetch,fileFrame});});
}
function base() { return {dataset:dataset.id,frame:Number($('frame').value)-1}; }
function size() { return {w:canvas.clientWidth,h:canvas.clientHeight}; }
function transform(x,y) { const {w,h}=size();return [(x-cx)*scale+w/2,(y-cy)*scale+h/2]; }
function position(e) {
  const rect=canvas.getBoundingClientRect(),{w,h}=size();
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
    const ids=[...fileFrames.keys()],layout=$('tileLayout').value,cols=layout==='row'?ids.length:layout==='column'?1:Math.ceil(Math.sqrt(ids.length)),rows=Math.ceil(ids.length/cols),tw=w/cols,th=h/rows;
    ids.forEach((id,index)=>{
      const state=fileFrames.get(id),picture=state.tilePreview||(id===activeFileFrame?preview:state.preview);
      const x=(index%cols)*tw,y=Math.floor(index/cols)*th;
      ctx.fillStyle='#11151b';ctx.fillRect(x+2,y+2,tw-4,th-4);
      if(picture){const d=state.metadata.datasets.find(item=>item.id===(state.datasetId??state.metadata.datasets[0].id));const baseRatio=Math.min((tw-16)/d.width,(th-34)/d.height);const viewScale=state.scale??baseRatio;const normalScale=Math.min(w/d.width,h/d.height)*.96;const ratio=state.tilePreview?baseRatio*viewScale/normalScale*d.width/picture.width:Math.min((tw-16)/picture.width,(th-34)/picture.height);const pw=picture.width*ratio,ph=picture.height*ratio,centerX=state.tilePreview?(state.cx??d.width/2)/d.width*picture.width:picture.width/2,centerY=state.tilePreview?(state.cy??d.height/2)/d.height*picture.height:picture.height/2;ctx.save();ctx.beginPath();ctx.rect(x+3,y+22,tw-6,th-25);ctx.clip();ctx.drawImage(picture,x+tw/2-centerX*ratio,y+22+(th-26)/2-centerY*ratio,pw,ph);ctx.restore();}
      ctx.strokeStyle=id===activeFileFrame?'#72d4b5':'#7b899450';ctx.lineWidth=id===activeFileFrame?2:1;ctx.strokeRect(x+1,y+1,tw-2,th-2);
      ctx.fillStyle='#d9e2e9';ctx.font='11px sans-serif';ctx.fillText(`${id}: ${state.metadata.label||state.metadata.path.split(/[\\/]/).pop()}`,x+8,y+16,tw-14);
    });
    return;
  }
  const frame=Number($('frame').value)-1;
  const overview=overviewCache.get(overviewKey(cacheSignature,frame));
  if(overview)drawEntry(overview);
  for(const [key,entry] of frameCache)if(key.startsWith(`${frame}:`))drawEntry(entry);
  if(!overview&&!frameCache.size&&preview&&previewBox)drawEntry({image:preview,result:{box:previewBox}});
  ctx.strokeStyle='#72ebc4';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);
  if(selection){
    ctx.beginPath();const pts=selection.points;
    if(selection.type==='roi'&&pts.length>=2){const a=transform(...pts[0]),b=transform(...pts[1]),x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),rw=Math.abs(b[0]-a[0]),rh=Math.abs(b[1]-a[1]);if(selection.variant==='rounded')ctx.roundRect(x,y,rw,rh,Math.min(rw,rh)*.15);else ctx.rect(x,y,rw,rh);}
    else if(selection.type==='oval'&&pts.length>=2){const a=transform(...pts[0]),b=transform(...pts[1]);ctx.ellipse((a[0]+b[0])/2,(a[1]+b[1])/2,Math.max(.5,Math.abs(b[0]-a[0])/2),Math.max(.5,Math.abs(b[1]-a[1])/2),0,0,Math.PI*2);}
    else if(pts.length){const a=transform(...pts[0]);ctx.moveTo(...a);for(const point of pts.slice(1))ctx.lineTo(...transform(...point));if(['roi','polygon','freehand'].includes(selection.type))ctx.closePath();}
    ctx.stroke();
    if(selection.type==='text'){const at=transform(...pts[0]);ctx.fillStyle='#72ebc4';ctx.font='16px sans-serif';ctx.fillText(selection.text||'',at[0],at[1]);}
    if(selection.type==='line'&&selection.variant==='arrow'&&pts.length>=2){const tip=transform(...pts.at(-1)),from=transform(...pts.at(-2)),angle=Math.atan2(tip[1]-from[1],tip[0]-from[0]);ctx.beginPath();for(const d of [-.5,.5]){ctx.moveTo(...tip);ctx.lineTo(tip[0]-12*Math.cos(angle+d),tip[1]-12*Math.sin(angle+d));}ctx.stroke();}
  }else if(roi){const a=transform(roi[0],roi[1]),b=transform(roi[2],roi[3]);ctx.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);}
  if(line&&!selection){const a=transform(line[0],line[1]),b=transform(line[2],line[3]);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}
  ctx.fillStyle='#72ebc4';ctx.font='16px sans-serif';for(const note of annotations){const at=transform(...note.point);ctx.fillText(note.text,at[0],at[1]);}
  ctx.setLineDash([]);$('zoom').textContent=`${(scale*100).toFixed(1)}%`;
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
  if (playing && !renderWanted) playbackTimer = setTimeout(() => changeFrame(1,true), 1000/Math.max(1,Math.min(20,Number($('fps').value)||5)));
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
function zoom(factor, anchor){if(!dataset)return;const old=scale;scale=Math.max(.000001,Math.min(128,scale*factor));if(anchor){cx=anchor[0]-(anchor[0]-cx)*old/scale;cy=anchor[1]-(anchor[1]-cy)*old/scale;}clampCenter();commitFrameChange('scale');if(anchor)commitFrameChange('view');scheduleRender();}
function stopPlay(){playing=false;clearTimeout(playbackTimer);$('playIcon').setAttribute('href','#i-play');$('play').title='Play frames';}
function frameLabel(){
  let n=Number($('frame').value)-1;
  const coordinates=[];
  for(const axis of [...dataset.extra].reverse()){
    const length=dataset.shape[axis];
    coordinates.unshift(`${dataset.axes?.[axis]||`D${axis}`} ${n%length+1}`);
    n=Math.floor(n/length);
  }
  $('frameCount').textContent=`/ ${dataset.frames}${coordinates.length>1?' · '+coordinates.join(' '):''}`;
}
function changeFrame(delta, automatic=false){if(!dataset)return;let n=Number($('frame').value)-1+delta;if(automatic)n%=dataset.frames;else n=Math.max(0,Math.min(dataset.frames-1,n));$('frame').value=n+1;frameLabel();$('pixel').textContent='';commitFrameChange('slice');scheduleRender(0);}
function selectDataset(){dataset=metadata.datasets.find(d=>d.id===Number($('dataset').value));$('frame').value=1;$('frame').max=dataset.frames;frameLabel();$('play').disabled=dataset.frames<2;roi=null;line=null;selection=null;annotations=[];vertices=[];preview=null;activePng='';stopPlay();$('metadata').textContent=`${dataset.width} × ${dataset.height}\n${dataset.dtype} · ${metadata.kind}\nShape: ${dataset.shape.join(' × ')}\nAxes: ${dataset.axes||'FITS (..., Y, X)'}`;fit();}
function saveFileFrame() {
  if (!activeFileFrame || !fileFrames.has(activeFileFrame)) return;
  Object.assign(fileFrames.get(activeFileFrame), {metadata,datasetId:dataset?.id,plane:Number($('frame').value),scale,cx,cy,preview,previewBox,activePng,frameCache,cacheSignature,cacheBytes,
    cuts:$('cuts').value,low:$('low').value,high:$('high').value,stretch:$('stretch').value,cmap:$('cmap').value,invert:$('invert').checked,threshold:$('threshold').checked,roi,line,selection,annotations});
}
function scheduleTileRefresh(delay=80){if(!tileMode)return;clearTimeout(tileRefreshTimer);tileRefreshTimer=setTimeout(refreshTilePreviews,delay);}
function refreshTilePreviews(){
  if(!tileMode)return;
  saveFileFrame();
  for(const [id,state] of fileFrames){
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
  $('closeFileFrame').disabled=fileFrames.size<2;
  $('tile').classList.toggle('selected',tileMode);
  $('lockView').classList.toggle('selected',frameLocks.size>0);
  $('lockView').title=frameLocks.size?`Locked: ${[...frameLocks].join(', ')}. Click to unlock all.`:'Lock all Frame parameters';
  for(const input of document.querySelectorAll('[data-frame-lock]'))input.checked=frameLocks.has(input.dataset.frameLock);
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
  roi=state.roi||null; line=state.line||null; selection=state.selection||null;annotations=state.annotations||[];vertices=[];
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
function moveFileFrame(delta){const ids=[...fileFrames.keys()],at=ids.indexOf(activeFileFrame),next=ids[(at+delta+ids.length)%ids.length];selectFileFrame(next);}
function closeFileFrame(){if(fileFrames.size<2)return;const id=activeFileFrame,next=[...fileFrames.keys()].find(value=>value!==id);selectFileFrame(next);fileFrames.delete(id);vscode.postMessage({type:'closeFrame',frameId:id});frameList();draw();}
function chart(values){const c=$('chart'),g=c.getContext('2d'),w=c.width,h=c.height;g.clearRect(0,0,w,h);const good=values.filter(Number.isFinite);c.classList.toggle('has-data',!!good.length);if(!good.length)return;let min=Math.min(...good),max=Math.max(...good);if(max===min)max=min+1;g.strokeStyle='#72d4b5';g.lineWidth=1;g.beginPath();let pen=false;values.forEach((v,i)=>{if(!Number.isFinite(v)){pen=false;return;}const x=8+i/Math.max(1,values.length-1)*(w-16),y=h-8-(v-min)/(max-min)*(h-16);if(pen)g.lineTo(x,y);else g.moveTo(x,y);pen=true;});g.stroke();}
async function analyze(op){if(!dataset||analysisRunning)return;if(op==='measure'&&selection?.type==='angle'&&selection.points.length===3){const [a,b,c]=selection.points,u=[a[0]-b[0],a[1]-b[1]],v=[c[0]-b[0],c[1]-b[1]],cos=(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v));$('analysis').textContent=`Angle: ${(Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI).toFixed(3)}°`;chart([]);$('analysisPane').hidden=false;return;}if(op==='profile'&&!line){showError(new Error('Choose Line [L] and draw a line first.'));return;}stopPlay();analysisRunning=true;$('busy').textContent='Analyzing…';const args={...base(),box:roi||undefined,points:line,selection};try{const r=await request(op,args);$('error').textContent='';if(op==='measure'){$('analysis').textContent=`Frame: ${r.frame+1} · Dataset: ${r.dataset}\nROI: ${r.box.join(', ')}\nArea: ${r.area} px²\nFinite pixels: ${r.count}\nMean: ${r.mean}\nStd (population): ${r.std}\nMin: ${r.min}\nMax: ${r.max}\nSum: ${r.sum}`;chart([]);}else if(op==='histogram'){$('analysis').textContent=`Histogram · ${r.samples} samples\n${r.sampled?'Sampled; stride '+r.step:'All pixels'}\nX: ${r.edges[0]} … ${r.edges.at(-1)}\nY: count per bin`;chart(r.counts);}else{$('analysis').textContent=`Profile · ${r.values.length} points\nLength: ${r.distance.at(-1).toFixed(3)} px\nX: distance · Y: raw value\nNearest-neighbor samples`;chart(r.values);}$('analysisPane').hidden=false;$('busy').textContent='';}catch(error){showError(error);}finally{analysisRunning=false;}}
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.0015),position(e));},{passive:false});
canvas.oncontextmenu=e=>e.preventDefault();
function selectionBounds(points){
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  return [Math.max(0,Math.floor(Math.min(...xs))),Math.max(0,Math.floor(Math.min(...ys))),Math.min(dataset.width,Math.ceil(Math.max(...xs))+1),Math.min(dataset.height,Math.ceil(Math.max(...ys))+1)];
}
function finishSelection(type,points){
  if(points.length<2)return;
  selection={type,variant:toolVariant,points:points.map(p=>[...p])};
  roi=selectionBounds(points); line=type==='line'?[...points[0],...points.at(-1)]:null;
  $('region').textContent=`${type} · ${roi.join(', ')}`;
  vertices=[];draw();
}
canvas.onpointerdown=e=>{
  if(!dataset)return;canvas.focus();
  if(tileMode){const rect=canvas.getBoundingClientRect(),ids=[...fileFrames.keys()],layout=$('tileLayout').value,cols=layout==='row'?ids.length:layout==='column'?1:Math.ceil(Math.sqrt(ids.length)),rows=Math.ceil(ids.length/cols),col=Math.floor((e.clientX-rect.left)/(rect.width/cols)),row=Math.floor((e.clientY-rect.top)/(rect.height/rows)),id=ids[row*cols+col];if(id)selectFileFrame(id);draw();return;}
  stopPlay();const point=bounded(position(e)),tool=e.button===2?'contrast':e.button===1?'pan':$('tool').value;
  if(tool==='pointer'){cx=point[0];cy=point[1];commitFrameChange('view');scheduleRender(0);return;}
  if(tool==='zoom'){zoom(e.altKey?.5:2,point);return;}
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
  const p=position(e);
  if(drag){const dx=e.clientX-drag.screen[0],dy=e.clientY-drag.screen[1];
    if(drag.tool==='pan'){cx=drag.cx-dx/scale;cy=drag.cy-dy/scale;clampCenter();commitFrameChange('view');scheduleRender(100);}
    else if(drag.tool==='contrast'){const span=Math.max(1e-12,drag.high-drag.low),range=span*Math.exp(dy/150),middle=(drag.low+drag.high)/2-dx/300*span;$('cuts').value='manual';$('low').value=middle-range/2;$('high').value=middle+range/2;commitFrameChange('bc');scheduleRender(100);}
    else if(selection){let end=bounded(p);if(e.shiftKey&&['roi','oval'].includes(drag.tool)){const side=Math.max(Math.abs(end[0]-drag.point[0]),Math.abs(end[1]-drag.point[1]));end=[drag.point[0]+Math.sign(end[0]-drag.point[0])*side,drag.point[1]+Math.sign(end[1]-drag.point[1])*side];}
      if(drag.tool==='freehand'||toolVariant==='freeline')selection.points.push(end);else selection.points=[drag.point,end];
      $('region').textContent=selection.points.map(q=>q.map(n=>n.toFixed(1)).join(',')).join(' → ');draw();}
    return;
  }
  clearTimeout(pixelTimer);const stamp=revision,b=base();
  pixelTimer=setTimeout(async()=>{if(pixelRunning||p[0]<0||p[1]<0||p[0]>=dataset.width||p[1]>=dataset.height)return;pixelRunning=true;try{const r=await request('pixel',{...b,x:Math.floor(p[0]),y:Math.floor(p[1])});if(stamp===revision)$('pixel').textContent=`X ${r.x}   Y ${r.y}\nValue: ${JSON.stringify(r.value)}`;}catch{/* main actions report worker errors */}finally{pixelRunning=false;}},100);
};
canvas.onpointerup=e=>{if(!drag)return;if(selection&&['roi','oval','freehand','line'].includes(drag.tool))finishSelection(drag.tool,selection.points);drag=null;canvas.releasePointerCapture(e.pointerId);draw();};
canvas.onpointercancel=()=>{drag=null;};
const tools = [['roiTool','roi'],['ovalTool','oval'],['polygonTool','polygon'],['freehandTool','freehand'],['lineTool','line'],['angleTool','angle'],['textTool','text'],['zoomTool','zoom'],['panTool','pan'],['pointerTool','pointer'],['lutTool','lut']];
for(const [,value] of tools){const option=document.createElement('option');option.value=value;option.textContent=value;$('tool').append(option);}
function setTool(tool){
  $('tool').value=tool;vertices=[];toolVariant='';
  for(const [id,value] of tools)$(id).classList.toggle('selected',tool===value);
  const variants={roi:[['roi','Rectangle'],['rounded','Rounded rectangle']],oval:[['oval','Oval'],['ellipse','Ellipse']],line:[['line','Straight'],['segmented','Segmented'],['freeline','Freehand line'],['arrow','Arrow']],lut:[['gray','Gray'],['heat','Heat'],['cool','Cool']]};
  $('toolVariant').replaceChildren();
  for(const [value,label] of variants[tool]||[['none','Options ▾']]){const option=document.createElement('option');option.value=value;option.textContent=label;$('toolVariant').append(option);}
  $('toolVariant').disabled=!variants[tool];
  toolVariant=$('toolVariant').value;
}
for(const [id,value] of tools)$(id).onclick=()=>setTool(value);
$('toolVariant').onchange=()=>{toolVariant=$('toolVariant').value;vertices=[];if(['gray','heat','cool'].includes(toolVariant)){$('cmap').value=toolVariant;commitFrameChange('color');scheduleRender(0);}};
for(const button of document.querySelectorAll('.tool-button')) button.dataset.tip=button.title;
$('fit').onclick=fit;$('actual').onclick=()=>{scale=1;commitFrameChange('scale');scheduleRender(0);};$('zoomIn').onclick=()=>zoom(2);$('zoomOut').onclick=()=>zoom(.5);
for(const button of document.querySelectorAll('[data-click]')) button.onclick=()=>$(button.dataset.click).click();
for(const menu of document.querySelectorAll('.menu')) menu.addEventListener('toggle',()=>{if(menu.open)for(const other of document.querySelectorAll('.menu'))if(other!==menu)other.open=false;});
document.addEventListener('click',event=>{if(event.target.closest('.menu-panel button'))event.target.closest('.menu').open=false;});
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
$('closeFileFrame').onclick=closeFileFrame;
function reorderFileFrame(to) {
  saveFileFrame();const entries=[...fileFrames.entries()],index=entries.findIndex(([id])=>id===activeFileFrame);
  if(index<0)return;const [entry]=entries.splice(index,1);entries.splice(to==='first'?0:entries.length,0,entry);
  fileFrames.clear();for(const [id,state] of entries)fileFrames.set(id,state);frameList();draw();
}
function stopBlink(){blinking=false;clearTimeout(blinkTimer);$('blink').classList.remove('selected');}
function blinkStep(){if(!blinking||fileFrames.size<2)return;moveFileFrame(1);blinkTimer=setTimeout(blinkStep,1000/Math.max(1,Math.min(20,Number($('fps').value)||5)));}
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
function openBCDialog(){
  const dialog=openDialog('bc','Brightness & Contrast',`<label>Scale <select class="bc-cuts"></select></label><label>Min <input class="bc-low" type="number" step="any"></label><label>Max <input class="bc-high" type="number" step="any"></label><label>Stretch <select class="bc-stretch"></select></label><div class="dialog-actions"><button class="bc-auto">Auto</button><button class="bc-reset">Reset</button><button class="bc-apply">Apply</button></div>`);
  const copy=(source,target)=>{target.replaceChildren(...[...source.options].map(option=>option.cloneNode(true)));target.value=source.value;};
  copy($('cuts'),dialog.querySelector('.bc-cuts'));copy($('stretch'),dialog.querySelector('.bc-stretch'));
  dialog.querySelector('.bc-low').value=$('low').value;dialog.querySelector('.bc-high').value=$('high').value;
  const apply=()=>{$('cuts').value=dialog.querySelector('.bc-cuts').value;$('low').value=dialog.querySelector('.bc-low').value;$('high').value=dialog.querySelector('.bc-high').value;$('stretch').value=dialog.querySelector('.bc-stretch').value;commitFrameChange('bc');scheduleRender(0);};
  dialog.querySelector('.bc-apply').onclick=apply;
  dialog.querySelector('.bc-auto').onclick=()=>{dialog.querySelector('.bc-cuts').value='percentile';apply();};
  dialog.querySelector('.bc-reset').onclick=()=>{dialog.querySelector('.bc-cuts').value='minmax';dialog.querySelector('.bc-stretch').value='linear';apply();};
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
  }else if(m.type==='result'||m.type==='error'){
    const p=pending.get(m.id);if(p){pending.delete(m.id);m.type==='error'?p.reject(new Error(m.message)):p.resolve(m.result);}else if(m.type==='error')showError(new Error(m.message));
  }
});
vscode.postMessage({type:'ready'});
