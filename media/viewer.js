'use strict';
const vscode = acquireVsCodeApi();
const $ = id => document.getElementById(id);
const formatValue = window.ViviNumberFormat.formatNumber;
const {decodeRawPayload,autoLimits,imageJAutoLimitsFromPixels,imageJResetLimits,stretchContext,stretchContextFromHistogram,stretchIntensity,renderPixels,transformRaw,transformBox,preloadFrameOrder,selectedStackFrameIndices,reorderedEntries,sliceDisplayRange} = window.ViviDisplay;
const escapeHtml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const roiGeometry = window.ViviRoiGeometry;
const lutOptions=[['gray','Grays'],['fire','Fire'],['ice','Ice'],['spectrum','Spectrum'],['rgb332','3-3-2 RGB'],['red','Red'],['green','Green'],['blue','Blue'],['cyan','Cyan'],['magenta','Magenta'],['yellow','Yellow'],['redgreen','Red/Green'],['heat','Heat'],['plasma','Plasma'],['magma','Magma'],['inferno','Inferno'],['turbo','Turbo']];
lutOptions.push(...[["ij-000-gray","000 Gray"],["ij-001-fire","001 Fire"],["ij-002-spectrum","002 Spectrum"],["ij-003-ice","003 Ice"],["ij-004-phase","004 Phase"],["ij-005-random","005 Random"],["ij-16-colors","16 Colors"],["ij-16-equal","16 Equal"],["ij-16-ramps","16 Ramps"],["ij-20-colors","20 Colors"],["ij-32-colors","32 Colors"],["ij-5-ramps","5 Ramps"],["ij-6-reserved-colors","6 Reserved Colors"],["ij-6-shades","6 Shades"],["ij-amber","Amber"],["ij-auxctq","Auxctq"],["ij-blue-orange","Blue Orange"],["ij-blue-orange-icb","Blue Orange Icb"],["ij-brain","Brain"],["ij-brgbcmyw","BRGBCMYW"],["ij-cells","Cells"],["ij-cequal","Cequal"],["ij-cmy","CMY"],["ij-cmy-cyan","CMY Cyan"],["ij-cmy-magneta","CMY Magneta"],["ij-cmy-yellow","CMY Yellow"],["ij-cold","Cold"],["ij-cool","Cool"],["ij-cti-ras","CTI RAS"],["ij-cyan-hot","Cyan Hot"],["ij-edges","Edges"],["ij-gem","Gem"],["ij-gem-16","Gem 16"],["ij-gem-256","Gem 256"],["ij-glasbey","Glasbey"],["ij-glasbey-inverted","Glasbey Inverted"],["ij-glasbey-on-dark","Glasbey On Dark"],["ij-glow","Glow"],["ij-gold","Gold"],["ij-green-fire-blue","Green Fire Blue"],["ij-gyr-centre","GYR Centre"],["ij-heart","Heart"],["ij-hilo","HiLo"],["ij-hue","Hue"],["ij-hue-ramps-08","Hue Ramps 08"],["ij-hue-ramps-16","Hue Ramps 16"],["ij-ica","ICA"],["ij-ica2","ICA2"],["ij-ica3","ICA3"],["ij-iman","Iman"],["ij-invert-gray","Invert Gray"],["ij-isocontour","Isocontour"],["ij-jet","Jet"],["ij-log-down","Log Down"],["ij-log-up","Log Up"],["ij-magenta-hot","Magenta Hot"],["ij-mixed","Mixed"],["ij-mpl-inferno","MPL Inferno"],["ij-mpl-magma","MPL Magma"],["ij-mpl-plasma","MPL Plasma"],["ij-mpl-viridis","MPL Viridis"],["ij-neon-blue","Neon Blue"],["ij-neon-green","Neon Green"],["ij-neon-magenta","Neon Magenta"],["ij-neon-red","Neon Red"],["ij-orange-hot","Orange Hot"],["ij-pastel","Pastel"],["ij-phase","Phase"],["ij-physics","Physics"],["ij-rainbow-rgb","Rainbow RGB"],["ij-random","Random"],["ij-red-hot","Red Hot"],["ij-rgb-blue","RGB Blue"],["ij-rgb-green","RGB Green"],["ij-rgb-red","RGB Red"],["ij-royal","Royal"],["ij-sepia","Sepia"],["ij-siemens","Siemens"],["ij-smart","Smart"],["ij-split-blackblue-redwhite","Split Blackblue Redwhite"],["ij-split-blackwhite-ge","Split Blackwhite Ge"],["ij-split-blackwhite-warmmetal","Split Blackwhite Warmmetal"],["ij-split-bluered-warmmetal","Split Bluered Warmmetal"],["ij-system-lut","System LUT"],["ij-thal","Thal"],["ij-thal-16","Thal 16"],["ij-thal-256","Thal 256"],["ij-thallium","Thallium"],["ij-thermal","Thermal"],["ij-topography","Topography"],["ij-unionjack","Unionjack"],["ij-viridis","Viridis"],["ij-vivid","Vivid"],["ij-warhol","Warhol"],["ij-yellow-hot","Yellow Hot"]]);
lutOptions.sort((a,b)=>a[1].localeCompare(b[1],undefined,{numeric:true,sensitivity:'base'}));
const canvas = $('canvas'), ctx = canvas.getContext('2d');
let sliceAxis = null, errorUntil = 0, errorTimer, transferVisible = true;
let orthogonal = null, orthogonalTimer, orthogonalTicket = 0;
let metadata, dataset, scale = 1, cx = 0, cy = 0, preview, previewBox;
const fileFrames = new Map();
let activeFileFrame = null, frameCache = new Map(), tileMode = false, toolVariant = '';
const toolVariants={roi:'roi',oval:'oval',line:'line'};
const frameLocks = new Set(), lockGroups = {bc:['cuts','low','high','stretch','cmap','invert','threshold'],view:['cx','cy','scale'],slice:['plane'],selection:['roi','line','selection','orthogonalState']};
let tileRefreshTimer, tileRefreshRunning=false, tileRefreshWanted=false, sidebarTimer, layoutColumns=0, layoutRows=0;
let keyboardShortcuts={fit:'f',hand:'h',pointer:'p',roi:'r',oval:'o',line:'l',measure:'m',clear:'c',undoTransform:'z',redoTransform:'',zoomIn:'=',zoomOut:'-',play:'enter',previousSlice:'arrowleft',nextSlice:'arrowright',previousFrame:'arrowup',nextFrame:'arrowdown',moveFrameUp:'shift+arrowup',moveFrameDown:'shift+arrowdown',moveFrameFirst:'ctrl+arrowup',moveFrameLast:'ctrl+arrowdown',toggleFrameDisplay:'d',rename:'f2',autoCuts:'a',resetCuts:'s',stackAutoCuts:'shift+a',stackResetCuts:'shift+s'};
const shortcutNames={ctrl:'Ctrl',control:'Ctrl',shift:'Shift',alt:'Alt',option:'Alt',cmd:'Cmd',meta:'Cmd',enter:'Enter',arrowup:'Up',arrowdown:'Down',arrowleft:'Left',arrowright:'Right',escape:'Esc',backspace:'Backspace',delete:'Delete',' ':'Space'};
const shortcutLabel=binding=>String(binding||'').split('+').map(part=>shortcutNames[part.trim().toLowerCase()]||part.trim().toUpperCase()).filter(Boolean).join('+');
const shortcutButtonIds={fit:['fit'],hand:['panTool'],pointer:['pointerTool'],roi:['roiTool'],oval:['ovalTool'],polygon:['polygonTool'],freehand:['freehandTool'],line:['lineTool'],angle:['angleTool'],text:['textTool'],zoomTool:['zoomTool'],measure:['toolMeasure','measure'],clear:['clear'],undoTransform:['editUndo'],redoTransform:['editRedo'],zoomIn:['zoomIn'],zoomOut:['zoomOut'],actual:['actual'],play:['viewerSlicePlay'],previousSlice:['viewerSlicePrev'],nextSlice:['viewerSliceNext'],previousFrame:['previousFileFrame'],nextFrame:['nextFileFrame'],toggleFrameDisplay:['tile'],rename:['imageRename'],autoCuts:['autoCuts','processAuto'],resetCuts:['resetCuts']};
function updateShortcutTips(){
  const mappedButtonIds=new Set(Object.values(shortcutButtonIds).flat());
  for(const [action,ids] of Object.entries(shortcutButtonIds))for(const id of ids){
    const button=$(id);if(!button)continue;
    const base=button.dataset.shortcutBase||button.getAttribute('title')||button.getAttribute('aria-label')||button.textContent.trim();
    button.dataset.shortcutBase=base;const shortcut=shortcutLabel(keyboardShortcuts[action]),tip=shortcut?`${base} (${shortcut})`:base;
    button.dataset.tip=tip;button.title=tip;
  }
  for(const [action,binding] of Object.entries(keyboardShortcuts)){
    const button=$(action);if(!button||button.tagName!=='BUTTON'||shortcutButtonIds[action]||mappedButtonIds.has(action))continue;
    const base=button.dataset.shortcutBase||button.getAttribute('title')||button.textContent.trim();button.dataset.shortcutBase=base;
    const shortcut=shortcutLabel(binding);button.dataset.tip=shortcut?`${base} (${shortcut})`:base;button.title=button.dataset.tip;
  }
}
let mouseShortcuts={slice:'wheel',zoomAtPointer:'shift+wheel',zoomAtCenter:'mod+wheel',orthogonalTool:'space+click',handDrag:'middle+drag',contrastDrag:'alt+right+drag',fit:'doubleclick'};
let defaultFps=24,transformsRunning=0;
let imageJAutoThreshold=0,imageJStackAutoThreshold=0;
let spaceHeld=false;
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
const fullPreview = () => true;
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
  const currentFrame=Number($('frame').value)-1,entry=currentRawEntry();
  const [rangeMin,rangeMax]=entry?imageJResetLimits(entry.raw,entry.channels,imageJDataKind(entry)):sliceDisplayRange(transferHistograms,displayBounds,activeFileFrame,dataset.id,currentFrame,Number($('low').value),Number($('high').value));
  return {active:activeFileFrame,activeLabel:metadata.label||metadata.path.split(/[\\/]/).pop(),frames:[...fileFrames].map(([id,state])=>({id,label:state.metadata.label||state.metadata.path.split(/[\\/]/).pop(),visible:state.visible!==false,locked:!!state.lockMember,loading:!!state.loading})),
    datasets:metadata.datasets.map(d=>({id:d.id,name:d.name})),datasetId:dataset.id,slice:Number($('frame').value),total:dataset.frames,fps:Number($('fps').value)||defaultFps,playing,blinking,tile:tileMode,columns:layoutColumns,rows:layoutRows,locks:[...frameLocks],
    cuts:$('cuts').value,low:$('low').value,high:$('high').value,rangeMin,rangeMax,stretch:$('stretch').value,cmap:$('cmap').value,luts:lutOptions,invert:$('invert').checked,threshold:$('threshold').checked,bcVisible:transferVisible};
}
function publishSidebar(delay=20){clearTimeout(sidebarTimer);sidebarTimer=setTimeout(()=>{const state=sidebarState();if(state)vscode.postMessage({type:'sidebarState',state});},delay);}
function request(op, args, prefetch = false, fileFrame = activeFileFrame) {
  return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});vscode.postMessage({type:'request',id,op,args,prefetch,fileFrame});});
}
function requestStream(op,args,onEvent,fileFrame=activeFileFrame){
  return new Promise((resolve,reject)=>{
    const id=++serial;let chain=Promise.resolve(),streamError=null;
    pending.set(id,{reject,onStream:message=>{chain=chain.then(()=>onEvent(message)).catch(error=>{streamError=error;});},resolve:result=>{chain.then(()=>streamError?reject(streamError):resolve(result),reject);}});
    vscode.postMessage({type:'request',id,op,args,prefetch:true,fileFrame});
  });
}
function updateLoadProgress(state=fileFrames.get(activeFileFrame)){
  const panel=$('loadProgress');
  if(!state?.loading){panel.hidden=true;panel.removeAttribute('aria-valuenow');return;}
  const total=Math.max(0,Number(state.loadTotal)||0),done=Math.max(0,Number(state.loadDone)||0),percent=total?Math.min(100,Math.round(done/total*100)):0;
  panel.hidden=false;$('loadProgressLabel').textContent=state.loadLabel||'Loading image…';$('loadProgressPercent').textContent=total?`${percent}%`:'';
  const bar=$('loadProgressBar');if(total){bar.value=percent;panel.setAttribute('aria-valuenow',String(percent));}else{bar.removeAttribute('value');panel.removeAttribute('aria-valuenow');}
}
function setFrameLoading(id,loading,done=0,total=0,label='Loading image…'){
  const state=fileFrames.get(id);if(!state)return;
  state.loading=loading;state.loadDone=done;state.loadTotal=total;state.loadLabel=label;
  if(id===activeFileFrame)updateLoadProgress(state);
  publishSidebar(loading&&done?40:0);
}
function base() { return {dataset:dataset.id,frame:Number($('frame').value)-1,stretch:$('stretch').value}; }
function size() { return {w:canvas.clientWidth,h:canvas.clientHeight}; }
function tileViewport(){
  const {w,h}=size(),{ids,cols,tw,th}=tileGeometry(w,h),index=ids.indexOf(activeFileFrame);
  if(index<0||!dataset)return null;
  const left=(index%cols)*tw,top=Math.floor(index/cols)*th;
  const state=fileFrames.get(activeFileFrame),picture=state?.tilePreview||preview;
  if(state?.orthogonalState){const layout=tileOrthogonalLayout(state,dataset,left,top,tw,th);return {left,top,tw,th,pixelsPerImage:layout.ratio,imageLeft:layout.xy.x,imageTop:layout.xy.y,orthogonal:layout};}
  const pixelsPerImage=picture?tilePictureRatio(state,dataset,picture,w,tw,th)*picture.width/dataset.width:Math.min((tw-16)/dataset.width,(th-34)/dataset.height);
  return {left,top,tw,th,pixelsPerImage,imageLeft:left+tw/2-(state?.cx??dataset.width/2)*pixelsPerImage,imageTop:top+22+(th-26)/2-(state?.cy??dataset.height/2)*pixelsPerImage};
}
function transform(x,y) {const tile=tileMode?tileViewport():null;if(tile)return [tile.imageLeft+x*tile.pixelsPerImage,tile.imageTop+y*tile.pixelsPerImage];const {w,h}=size();return [(x-cx)*scale+w/2,(y-cy)*scale+h/2]; }
function position(e) {
  const rect=canvas.getBoundingClientRect(),{w,h}=size(),tile=tileMode?tileViewport():null;
  if(tile)return [(e.clientX-rect.left-tile.imageLeft)/tile.pixelsPerImage,(e.clientY-rect.top-tile.imageTop)/tile.pixelsPerImage];
  return [(e.clientX-rect.left-w/2)/scale+cx,(e.clientY-rect.top-h/2)/scale+cy];
}
function bounded(p) { return [Math.max(0,Math.min(dataset.width-1,p[0])),Math.max(0,Math.min(dataset.height-1,p[1]))]; }
function visibleBox() {
  const {w,h}=size();
  return [Math.max(0,Math.floor(cx-w/2/scale)),Math.max(0,Math.floor(cy-h/2/scale)),Math.min(dataset.width,Math.ceil(cx+w/2/scale)),Math.min(dataset.height,Math.ceil(cy+h/2/scale))];
}
function clampCenter() {const depth=orthogonal?.depth||0;cx=Math.max(0,Math.min(dataset.width+depth,cx));cy=Math.max(0,Math.min(dataset.height+depth,cy));}
function drawTileSelection(state,x,y,tw,th,d,picture,w){
  const selected=state.selection;if(!selected||!picture)return;
  const orthogonalLayout=state.orthogonalState?tileOrthogonalLayout(state,d,x,y,tw,th):null;
  const ratio=orthogonalLayout?.ratio??tilePictureRatio(state,d,picture,w,tw,th),centerX=(state.cx??d.width/2),centerY=(state.cy??d.height/2);
  const point=orthogonalLayout?([px,py])=>[orthogonalLayout.xy.x+px*ratio,orthogonalLayout.xy.y+py*ratio]:([px,py])=>[x+tw/2+(px-centerX)*ratio*picture.width/d.width,y+22+(th-26)/2+(py-centerY)*ratio*picture.height/d.height];
  const pts=selected.points||[];if(!pts.length)return;
  ctx.save();ctx.beginPath();ctx.rect(x+3,y+22,tw-6,th-25);ctx.clip();ctx.strokeStyle=selected.stroke||'#72ebc4';ctx.lineWidth=selected.strokeWidth||1.5;ctx.setLineDash([5,3]);ctx.beginPath();
  if(selected.type==='roi'&&pts.length>=2){const a=point(pts[0]),b=point(pts[1]);ctx.rect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));}
  else if(selected.type==='oval'&&pts.length>=2){const a=point(pts[0]),b=point(pts[1]);ctx.ellipse((a[0]+b[0])/2,(a[1]+b[1])/2,Math.max(.5,Math.abs(b[0]-a[0])/2),Math.max(.5,Math.abs(b[1]-a[1])/2),0,0,Math.PI*2);}
  else{const a=point(pts[0]);ctx.moveTo(...a);for(const item of pts.slice(1))ctx.lineTo(...point(item));if(['roi','polygon','freehand'].includes(selected.type))ctx.closePath();}
  ctx.stroke();ctx.restore();
}
function tileOrthogonalLayout(state,d,x,y,tw,th){
  const depth=state.orthogonalState?.depth||1,availableWidth=Math.max(1,tw-8),availableHeight=Math.max(1,th-29);
  const fitRatio=Math.max(.01,Math.min(availableWidth/(d.width+depth),availableHeight/(d.height+depth)));
  const viewport=size(),normalScale=Math.max(.01,Math.min(viewport.w/(d.width+depth),viewport.h/(d.height+depth))*.96);
  const ratio=fitRatio*Math.max(.01,state.scale??normalScale)/normalScale;
  const centerX=state.cx??(d.width+depth)/2,centerY=state.cy??(d.height+depth)/2;
  const left=x+4+availableWidth/2-centerX*ratio,top=y+24+availableHeight/2-centerY*ratio;
  return {ratio,xy:{x:left,y:top,w:d.width*ratio,h:d.height*ratio},yz:{x:left+d.width*ratio,y:top,w:depth*ratio,h:d.height*ratio},xz:{x:left,y:top+d.height*ratio,w:d.width*ratio,h:depth*ratio}};
}
function drawTileOrthogonal(state,d,picture,x,y,tw,th){
  const view=state.orthogonalState,layout=tileOrthogonalLayout(state,d,x,y,tw,th),images=state.tileOrthogonalImages;
  ctx.save();ctx.beginPath();ctx.rect(x+3,y+22,tw-6,th-25);ctx.clip();ctx.imageSmoothingEnabled=false;
  if(picture)ctx.drawImage(picture,layout.xy.x,layout.xy.y,layout.xy.w,layout.xy.h);
  if(images?.yz)ctx.drawImage(images.yz,layout.yz.x,layout.yz.y,layout.yz.w,layout.yz.h);
  if(images?.xz)ctx.drawImage(images.xz,layout.xz.x,layout.xz.y,layout.xz.w,layout.xz.h);
  ctx.strokeStyle='#f4cf65';ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(layout.yz.x,layout.xy.y);ctx.lineTo(layout.yz.x,layout.xy.y+layout.xy.h);ctx.moveTo(layout.xz.x,layout.xz.y);ctx.lineTo(layout.xz.x+layout.xz.w,layout.xz.y);ctx.stroke();
  ctx.setLineDash([4,3]);ctx.beginPath();const px=layout.xy.x+(view.x+.5)*layout.ratio,py=layout.xy.y+(view.y+.5)*layout.ratio,pzX=layout.yz.x+(view.z+.5)*layout.ratio,pzY=layout.xz.y+(view.z+.5)*layout.ratio;
  ctx.moveTo(px,layout.xy.y);ctx.lineTo(px,layout.xz.y+layout.xz.h);ctx.moveTo(layout.xy.x,py);ctx.lineTo(layout.yz.x+layout.yz.w,py);ctx.moveTo(pzX,layout.yz.y);ctx.lineTo(pzX,layout.yz.y+layout.yz.h);ctx.moveTo(layout.xz.x,pzY);ctx.lineTo(layout.xz.x+layout.xz.w,pzY);ctx.stroke();ctx.restore();
  return layout;
}
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
      if(picture){const d=state.metadata.datasets.find(item=>item.id===(state.datasetId??state.metadata.datasets[0].id));if(state.orthogonalState){drawTileOrthogonal(state,d,picture,x,y,tw,th);if(id!==activeFileFrame)drawTileSelection(state,x,y,tw,th,d,picture,w);}else{const ratio=tilePictureRatio(state,d,picture,w,tw,th);const pw=picture.width*ratio,ph=picture.height*ratio,centerX=state.tilePreview?(state.cx??d.width/2)/d.width*picture.width:picture.width/2,centerY=state.tilePreview?(state.cy??d.height/2)/d.height*picture.height:picture.height/2;ctx.save();ctx.beginPath();ctx.rect(x+3,y+22,tw-6,th-25);ctx.clip();ctx.drawImage(picture,x+tw/2-centerX*ratio,y+22+(th-26)/2-centerY*ratio,pw,ph);ctx.restore();if(id!==activeFileFrame)drawTileSelection(state,x,y,tw,th,d,picture,w);}}
      ctx.strokeStyle=id===activeFileFrame?'#72d4b5':'#7b899450';ctx.lineWidth=id===activeFileFrame?2:1;ctx.strokeRect(x+1,y+1,tw-2,th-2);
      ctx.fillStyle='#d9e2e9';ctx.font='11px sans-serif';ctx.fillText(`${id}: ${state.metadata.label||state.metadata.path.split(/[\\/]/).pop()}`,x+8,y+16,tw-14);
    });
    const active=tileViewport();if(active){ctx.save();ctx.beginPath();ctx.rect(active.left+3,active.top+22,active.tw-6,active.th-25);ctx.clip();}
  }
  if(!tileMode){const frame=Number($('frame').value)-1;let painted=false;
  const overview=overviewCache.get(overviewKey(cacheSignature,frame));
  if(overview?.image){drawEntry(overview);painted=true;}
  for(const [key,entry] of frameCache)if(key.startsWith(`${frame}:`)&&entry.image){drawEntry(entry);painted=true;}
  if(!painted&&preview&&previewBox)drawEntry({image:preview,result:{box:previewBox}});
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
  if(orthogonal&&!tileMode){const [x,y]=transform(orthogonal.x+.5,orthogonal.y+.5),[left,top]=transform(0,0);ctx.save();ctx.strokeStyle='#f4cf65';ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+dataset.height*scale);ctx.moveTo(left,y);ctx.lineTo(left+dataset.width*scale,y);ctx.stroke();ctx.restore();drawOrthogonalViews();if(orthogonal.sections&&orthogonal.colorKey!==orthogonalColorKey()&&!orthogonal.colorPending){orthogonal.colorPending=true;queueMicrotask(()=>{if(orthogonal){orthogonal.colorPending=false;colorOrthogonal().catch(showError);}});}}
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
function cachedOrthogonalSections(){
  const view=orthogonal,depth=view.depth,width=dataset.width,height=dataset.height,stride=axisStride(axisIndex()),flat=Number($('frame').value)-1-view.z*stride;
  const slices=[];
  for(let z=0;z<depth;z++){
    const entry=frameCache.get(cacheKey(flat+z*stride,fullBox()));
    if(!entry?.raw||entry.result.width!==width||entry.result.height!==height)return null;
    slices.push(entry);
  }
  const channels=slices[0].channels;if(depth*(width+height)*channels>16_000_000)return null;
  const xz=new Float32Array(depth*width*channels),yz=new Float32Array(height*depth*channels);
  for(let z=0;z<depth;z++){
    const raw=slices[z].raw;
    for(let x=0;x<width;x++)for(let c=0;c<channels;c++)xz[(z*width+x)*channels+c]=Number(raw[(view.y*width+x)*channels+c]);
    for(let y=0;y<height;y++)for(let c=0;c<channels;c++)yz[(y*depth+z)*channels+c]=Number(raw[(y*width+view.x)*channels+c]);
  }
  return {channels,xz:{raw:xz,width,height:depth},yz:{raw:yz,width:depth,height}};
}
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
async function refreshTileOrthogonalState(id,state){
  const view=state?.orthogonalState,d=state?.metadata.datasets.find(item=>item.id===(state.datasetId??state.metadata.datasets[0].id));
  if(!tileMode||!view||!d?.extra?.length||!state.frameCache?.size){if(state){state.tileOrthogonalImages=null;state.tileOrthogonalKey='';}return;}
  const axis=d.extra.includes(view.axis)?view.axis:d.extra.at(-1),axisAt=d.extra.indexOf(axis),depth=d.shape[axis],stride=d.extra.slice(axisAt+1).reduce((product,item)=>product*d.shape[item],1),flat=Math.max(0,(state.plane||1)-1),current=Math.floor(flat/stride)%depth,baseFlat=flat-current*stride;
  const x=Math.max(0,Math.min(d.width-1,Math.floor(view.x))),y=Math.max(0,Math.min(d.height-1,Math.floor(view.y))),settings={low:Number(state.low??0),high:Number(state.high??1),stretch:state.stretch||'linear',cmap:state.cmap||'gray',invert:!!state.invert,threshold:!!state.threshold};
  const key=JSON.stringify([state.cacheSignature,axis,baseFlat,x,y,settings]);if(state.tileOrthogonalKey===key&&state.tileOrthogonalImages)return;
  const slices=[];for(let z=0;z<depth;z++){const entry=state.frameCache.get(cacheKey(baseFlat+z*stride,[0,0,d.width,d.height]));if(!entry?.raw)return;slices.push(entry);}
  const channels=slices[0].channels;if(depth*(d.width+d.height)*channels>16_000_000)return;
  const xz=new Float32Array(depth*d.width*channels),yz=new Float32Array(d.height*depth*channels);
  for(let z=0;z<depth;z++){const raw=slices[z].raw;for(let px=0;px<d.width;px++)for(let c=0;c<channels;c++)xz[(z*d.width+px)*channels+c]=Number(raw[(y*d.width+px)*channels+c]);for(let py=0;py<d.height;py++)for(let c=0;c<channels;c++)yz[(py*depth+z)*channels+c]=Number(raw[(py*d.width+x)*channels+c]);}
  const ticket=state.tileOrthogonalTicket=(state.tileOrthogonalTicket||0)+1,lut=channels>1&&!settings.threshold?null:await lutTable(settings.cmap);if(fileFrames.get(id)!==state||ticket!==state.tileOrthogonalTicket)return;
  const images={};for(const [name,raw,width,height] of [['xz',xz,d.width,depth],['yz',yz,depth,d.height]]){const surface=document.createElement('canvas');surface.width=width;surface.height=height;surface.getContext('2d').putImageData(new ImageData(renderPixels(raw,width,height,channels,settings,lut),width,height),0,0);images[name]=surface;}
  state.tileOrthogonalImages=images;state.tileOrthogonalKey=key;if(tileMode)draw();
}
function refreshTileOrthogonalStates(){if(!tileMode)return;for(const [id,state] of fileFrames)if(state.visible!==false&&state.orthogonalState)refreshTileOrthogonalState(id,state).catch(showError);}
function orthogonalRect(name,canvas){
  const width=name==='xz'?dataset.width:orthogonal.depth, height=name==='xz'?orthogonal.depth:dataset.height;
  return {left:0,top:0,ratio:scale,width,height};
}
function drawOrthogonalViews(){
  if(!orthogonal)return;
  const [left,top]=transform(0,0),width=dataset.width*scale,height=dataset.height*scale,depth=orthogonal.depth*scale;
  for(const [id,x,y,w,h] of [['orthYZ',left+width,top,depth,height],['orthXZ',left,top+height,width,depth]]){
    const panel=$(id);panel.style.left=`${x}px`;panel.style.top=`${y}px`;panel.style.width=`${w}px`;panel.style.height=`${h}px`;
  }
  for(const name of ['yz','xz']){
    const canvas=$(name==='yz'?'orthYZCanvas':'orthXZCanvas'),g=canvas.getContext('2d'),rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=window.devicePixelRatio||1;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    g.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);g.clearRect(0,0,w,h);
    const r=orthogonalRect(name,canvas);if(orthogonal.images?.[name]){g.imageSmoothingEnabled=false;g.drawImage(orthogonal.images[name],r.left,r.top,r.width*r.ratio,r.height*r.ratio);}
    g.save();g.strokeStyle='#f4cf65';g.lineWidth=1;g.setLineDash([4,3]);g.beginPath();
    if(name==='xz'){g.moveTo(r.left+(orthogonal.x+.5)*r.ratio,r.top);g.lineTo(r.left+(orthogonal.x+.5)*r.ratio,r.top+r.height*r.ratio);g.moveTo(r.left,r.top+(orthogonal.z+.5)*r.ratio);g.lineTo(r.left+r.width*r.ratio,r.top+(orthogonal.z+.5)*r.ratio);}
    else{g.moveTo(r.left+(orthogonal.z+.5)*r.ratio,r.top);g.lineTo(r.left+(orthogonal.z+.5)*r.ratio,r.top+r.height*r.ratio);g.moveTo(r.left,r.top+(orthogonal.y+.5)*r.ratio);g.lineTo(r.left+r.width*r.ratio,r.top+(orthogonal.y+.5)*r.ratio);}
    g.stroke();g.restore();
  }
}
function refreshOrthogonal(delay=70){
  if(!orthogonal)return;
  const view=orthogonal,key=orthogonalKey();if(view.sectionKey===key)return;
  const cached=cachedOrthogonalSections();if(cached){clearTimeout(orthogonalTimer);orthogonalTicket++;view.sections=cached;view.sectionKey=key;view.colorKey='';colorOrthogonal().catch(showError);return;}
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
  $('stage').classList.remove('orthogonal');$('orthYZ').hidden=true;$('orthXZ').hidden=true;$('stackOrthogonal').setAttribute('aria-pressed','false');$('toolOrthogonal').classList.remove('selected');$('toolOrthogonal').setAttribute('aria-pressed','false');
  if(refit)requestAnimationFrame(()=>{if(dataset)fit();});
}
function orthogonalSnapshot(){return orthogonal?{axis:orthogonal.axis,x:orthogonal.x,y:orthogonal.y,z:orthogonal.z,depth:orthogonal.depth}:null;}
function enableOrthogonal(saved=null,refit=true){
  if(!dataset||dataset.frames<2||!sliceAxes().length){showError(new Error('Orthogonal Views requires a stack Frame.'));return;}
  const axis=sliceAxes().includes(saved?.axis)?saved.axis:sliceAxes()[axisIndex()],depth=dataset.shape[axis];
  orthogonal={axis,x:Math.max(0,Math.min(dataset.width-1,Math.floor(saved?.x??dataset.width/2))),y:Math.max(0,Math.min(dataset.height-1,Math.floor(saved?.y??dataset.height/2))),z:Math.max(0,Math.min(depth-1,Math.floor(saved?.z??slicePosition()-1))),depth,sectionKey:'',colorKey:'',colorTicket:0};
  $('stage').classList.toggle('orthogonal',!tileMode);$('orthYZ').hidden=tileMode;$('orthXZ').hidden=tileMode;$('stackOrthogonal').setAttribute('aria-pressed','true');$('toolOrthogonal').classList.add('selected');$('toolOrthogonal').setAttribute('aria-pressed','true');
  requestAnimationFrame(()=>{if(refit&&!tileMode)fit();else draw();refreshOrthogonal(0);if(tileMode){saveFileFrame();refreshTileOrthogonalStates();}});
}
function toggleOrthogonal(){
  if(orthogonal){disableOrthogonal(!tileMode);commitFrameChange('selection');return;}
  enableOrthogonal();
  if(orthogonal)commitFrameChange('selection');
}
function orthogonalPoint(name,event){
  const view=orthogonal;if(!view)return;
  if(name==='xy'){const [x,y]=bounded(position(event));view.x=Math.floor(x);view.y=Math.floor(y);}
  else {const canvas=$(name==='xz'?'orthXZCanvas':'orthYZCanvas'),rect=canvas.getBoundingClientRect(),r=orthogonalRect(name,canvas),horizontal=Math.max(0,Math.min(r.width-1,Math.floor((event.clientX-rect.left-r.left)/r.ratio))),vertical=Math.max(0,Math.min(r.height-1,Math.floor((event.clientY-rect.top-r.top)/r.ratio))),z=name==='xz'?vertical:horizontal;
    if(name==='xz')view.x=horizontal;else view.y=vertical;
    if(z!==view.z){view.z=z;setAxisSlice(z+1);frameLabel();commitFrameChange('slice');scheduleRender(0);}
  }
  commitFrameChange('selection');draw();refreshOrthogonal();refreshTileOrthogonalStates();
}
function tileOrthogonalViewAt(event){
  const viewport=tileViewport(),layout=viewport?.orthogonal;if(!layout)return null;
  const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  for(const name of ['xy','yz','xz']){const area=layout[name];if(x>=area.x&&x<=area.x+area.w&&y>=area.y&&y<=area.y+area.h)return name;}
  return null;
}
function tileOrthogonalPoint(name,event){
  const layout=tileViewport()?.orthogonal,view=orthogonal;if(!layout||!view)return;
  const rect=canvas.getBoundingClientRect(),area=layout[name],horizontal=Math.max(0,Math.floor((event.clientX-rect.left-area.x)/layout.ratio)),vertical=Math.max(0,Math.floor((event.clientY-rect.top-area.y)/layout.ratio));
  if(name==='xy'){view.x=Math.min(dataset.width-1,horizontal);view.y=Math.min(dataset.height-1,vertical);}
  else{const z=Math.min(view.depth-1,name==='xz'?vertical:horizontal);if(name==='xz')view.x=Math.min(dataset.width-1,horizontal);else view.y=Math.min(dataset.height-1,vertical);if(z!==view.z){view.z=z;setAxisSlice(z+1);frameLabel();commitFrameChange('slice');scheduleRender(0);}}
  commitFrameChange('selection');draw();refreshOrthogonal();refreshTileOrthogonalStates();
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
  $('cacheStatus').textContent='';
}
async function lutTable(name){
  if(name==='gray')return null;
  if(!lutTables.has(name))lutTables.set(name,request('lutPreview',{cmap:name}).then(result=>result.rgb).catch(error=>{lutTables.delete(name);throw error;}));
  return lutTables.get(name);
}
async function recolorEntry(entry,args){
  if(!entry.raw)return;
  const paintVersion=entry.paintVersion=(entry.paintVersion||0)+1;
  const limits=args.cuts==='manual'?[args.low,args.high]:args.cuts===entry.baseMode?entry.baseLimits:autoLimits(entry.raw,entry.channels,args.cuts);
  const [low,high]=limits;
  const colorKey=JSON.stringify([low,high,args.stretch,args.cmap,args.invert,args.threshold]);
  if(entry.image&&entry.colorKey===colorKey)return;
  const lut=entry.channels>1&&!args.threshold?null:await lutTable(args.cmap);
  const context=entryStretchContext(entry,args.stretch,low,high);
  const pixels=renderPixels(entry.raw,entry.result.width,entry.result.height,entry.channels,{...args,low,high,stretchContext:context},lut);
  const image=document.createElement('canvas');image.width=entry.result.width;image.height=entry.result.height;
  image.getContext('2d').putImageData(new ImageData(pixels,image.width,image.height),0,0);
  if(entry.paintVersion!==paintVersion)return;
  entry.image=image;entry.result.low=low;entry.result.high=high;entry.colorKey=colorKey;
}
function scheduleCachedRecolor(id,state){
  if(!state?.frameCache?.size&&!state?.tileEntry)return;
  const ticket=state.recolorTicket=(state.recolorTicket||0)+1;
  const entries=[...new Set([...(state.frameCache?.values()||[]),state.tileEntry,...[...overviewCache].filter(([key])=>key.startsWith(`${id}:`)).map(([,entry])=>entry)])]
    .filter(entry=>entry?.raw&&entry.sourceDataset===(state.datasetId??state.metadata.datasets[0].id));
  entries.sort((a,b)=>Math.abs(a.sourceFrame-(state.plane||1)+1)-Math.abs(b.sourceFrame-(state.plane||1)+1));
  const args={cuts:state.cuts||'manual',low:Number(state.low),high:Number(state.high),stretch:state.stretch||'linear',cmap:state.cmap||'gray',invert:!!state.invert,threshold:!!state.threshold};
  let index=0;
  async function next(){
    if(state.recolorTicket!==ticket||fileFrames.get(id)!==state)return;
    const entry=entries[index++];if(!entry)return;
    try{await recolorEntry(entry,args);if(state.recolorTicket!==ticket)return;
      if(state.tileEntry===entry)state.tilePreview=entry.image;
      if(id===activeFileFrame&&entry.sourceFrame===Number($('frame').value)-1){preview=entry.image;previewBox=entry.result.box;draw();}
    }catch(error){showError(error);return;}
    setTimeout(next,0);
  }
  setTimeout(next,0);
}
async function decodePreview(result,args,paint=true) {
  if(result.payload instanceof ArrayBuffer){
    const {raw:sourceRaw,sourceBytes}=await decodeRawPayload(result);
    const scale=Number(result.bscale??1),zero=Number(result.bzero??0),blank=result.blank;
    const calibrated=scale!==1||zero!==0||blank!=null;
    const raw=calibrated?Float64Array.from(sourceRaw,value=>blank!=null&&String(value)===String(blank)?NaN:Number(value)*scale+zero):sourceRaw;
    delete result.payload;
    const entry={image:null,raw,sourceRaw,sourceBytes,channels:result.channels,result,sourceFrame:args.frame,sourceDataset:args.dataset,baseMode:args.cuts,baseLimits:[result.low,result.high],bytes:raw.byteLength+(sourceBytes.buffer===raw.buffer?0:sourceBytes.byteLength)};
    if(paint)await recolorEntry(entry,args);
    return entry;
  }
  if(result.raw){
    const binary=atob(result.raw),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    const {raw,sourceBytes}=await decodeRawPayload({payload:bytes.buffer,dtype:result.dtype,codec:'none',shuffle:0,byteLength:bytes.byteLength,width:result.width,height:result.height,channels:result.channels});
    delete result.raw;
    const entry={image:null,raw,sourceBytes,channels:result.channels,result,sourceFrame:args.frame,sourceDataset:args.dataset,baseMode:args.cuts,baseLimits:[result.low,result.high],bytes:raw.byteLength+(sourceBytes.buffer===raw.buffer?0:sourceBytes.byteLength)};
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
  request('render',args,true).then(result=>decodePreview(result,args)).then(async entry=>{
    if(cacheSignature!==signature)return;
    await recolorEntry(entry,renderArgs(frame));
    if(cacheSignature!==signature)return;
    overviewCache.set(key,entry);overviewBytes+=entry.bytes;
    while(overviewBytes>128*1024*1024&&overviewCache.size>1){const oldest=overviewCache.keys().next().value;overviewBytes-=overviewCache.get(oldest).bytes;overviewCache.delete(oldest);}
    draw();
  }).catch(()=>{}).finally(()=>{overviewRunning=false;if(dataset&&!renderRunning&&!renderWanted)schedulePreload();});
}
function schedulePlayback() {
  if (playing && !renderWanted) playbackTimer = setTimeout(() => changeFrame(1,true), 1000/Math.max(1,Math.min(60,Number($('fps').value)||defaultFps)));
}
function schedulePreload() {
  // Stack planes arrive through one continuous renderStack request. Keeping this
  // hook avoids special cases in playback and overview code without starting
  // the former per-plane request loop.
}
async function preloadFrames() {
  return;
}
function statePaintArgs(state,frame){
  return {dataset:state.datasetId??state.metadata.datasets[0].id,frame,cuts:state.cuts||'manual',low:Number(state.low??0),high:Number(state.high??1),stretch:state.stretch||'linear',cmap:state.cmap||'gray',invert:!!state.invert,threshold:!!state.threshold};
}
async function loadStack(id,state,args,signature){
  if(state.stackLoadPromise&&state.stackLoadSignature===signature)return state.stackLoadPromise;
  const generation=(state.stackLoadGeneration||0)+1;state.stackLoadGeneration=generation;state.stackLoadSignature=signature;
  const entries=new Map(),stackDataset=state.metadata.datasets.find(item=>item.id===args.dataset);let bytes=0,firstLimits=null;
  setFrameLoading(id,true,0,stackDataset?.frames||0,'Loading stack…');
  state.stackLoadPromise=requestStream('renderStack',{...args,frame:undefined},async message=>{
    if(message.event==='start'){setFrameLoading(id,true,0,message.result?.total||message.total||stackDataset?.frames||0,'Loading stack…');return;}
    if(message.event!=='frame')return;
    if(fileFrames.get(id)!==state||state.stackLoadGeneration!==generation)return;
    const frame=Number(message.frame),frameArgs={...args,frame};
    const entry=await decodePreview(message.result,frameArgs,false);
    if(!firstLimits)firstLimits=[entry.result.low,entry.result.high];
    const paint=statePaintArgs(state,frame);
    if((state.cuts||args.cuts)!=='manual'){paint.cuts='manual';paint.low=firstLimits[0];paint.high=firstLimits[1];}
    await recolorEntry(entry,paint);
    entries.set(cacheKey(frame,args.box),entry);bytes+=entry.bytes;
    setFrameLoading(id,true,entries.size,message.total||stackDataset?.frames||0,'Loading stack…');
    await new Promise(resolve=>setTimeout(resolve,0));
  },id).then(async()=>{
    if(fileFrames.get(id)!==state||state.stackLoadGeneration!==generation)return;
    if(firstLimits&&(state.cuts||args.cuts)!=='manual'){
      state.cuts='manual';state.low=firstLimits[0];state.high=firstLimits[1];
      if(id===activeFileFrame){$('cuts').value='manual';$('low').value=firstLimits[0];$('high').value=firstLimits[1];}
    }
    for(const entry of entries.values())await recolorEntry(entry,statePaintArgs(state,entry.sourceFrame));
    state.frameCache=entries;state.cacheBytes=bytes;state.cacheSignature=signature;state.stackLoadedSignature=signature;
    if(id===activeFileFrame){frameCache=entries;cacheBytes=bytes;cacheSignature=signature;const frame=Number($('frame').value)-1;const entry=entries.get(cacheKey(frame,args.box));if(entry)showPreview(entry,revision);}
  }).finally(()=>{
    if(fileFrames.get(id)===state&&state.stackLoadGeneration===generation){state.stackLoadPromise=null;setFrameLoading(id,false);if(tileMode)scheduleTileRefresh(0);}
  });
  return state.stackLoadPromise;
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
    const state=fileFrames.get(activeFileFrame);
    if(dataset.frames>1){await loadStack(activeFileFrame,state,args,signature);return;}
    setFrameLoading(activeFileFrame,true,0,0,'Loading image…');
    const entry=await decodePreview(await request('render',args),args);
    if (cacheSignature === signature) {frameCache.set(key,entry);cacheBytes += entry.bytes;updateCacheStatus();}
    showPreview(entry,ticket);
  } catch(error){showError(error);stopPlay();}
  finally{if(dataset?.frames===1)setFrameLoading(activeFileFrame,false);renderRunning=false;if(renderWanted)render();else{schedulePlayback();schedulePreload();}}
}
function dismissError(){errorUntil=0;clearTimeout(errorTimer);$('error').hidden=true;if($('busy').textContent==='Error')$('busy').textContent='';}
function clearExpiredError(){if(Date.now()>=errorUntil)dismissError();}
function showError(error){$('errorMessage').textContent=error.message;$('error').hidden=false;errorUntil=Date.now()+2500;clearTimeout(errorTimer);errorTimer=setTimeout(clearExpiredError,2600);$('busy').textContent='Error';}
$('dismissError').onclick=dismissError;
function fit(){if(!dataset)return;const {w,h}=size(),depth=orthogonal?.depth||0;scale=Math.min(w/(dataset.width+depth),h/(dataset.height+depth))*.96;cx=(dataset.width+depth)/2;cy=(dataset.height+depth)/2;commitFrameChange('view');scheduleRender(0);}
const zoomLevels=[1/72,1/48,1/32,1/24,1/16,1/12,1/8,1/6,1/4,1/3,1/2,.75,1,1.5,2,3,4,6,8,12,16,24,32];
function zoom(direction,anchor=null){
  if(!dataset)return;
  const old=scale,epsilon=1e-9;
  const next=direction>0?zoomLevels.find(value=>value>old+epsilon):[...zoomLevels].reverse().find(value=>value<old-epsilon);
  if(!next)return;
  scale=next;
  if(anchor){cx=anchor[0]-(anchor[0]-cx)*old/scale;cy=anchor[1]-(anchor[1]-cy)*old/scale;}
  clampCenter();commitFrameChange('view');scheduleRender();
}
function stopPlay(){playing=false;clearTimeout(playbackTimer);$('playIcon').setAttribute('href','#i-play');$('play').title='Play frames';syncViewerToolbar();publishSidebar();}
function datasetAxisLabel(index){return dataset.targetGroups?.[index]?.join('')||dataset.axes?.[index]||`D${index}`;}
function frameLabel(){
  let n=Number($('frame').value)-1;
  const coordinates=[];
  for(const axis of [...dataset.extra].reverse()){
    const length=dataset.shape[axis];
    coordinates.unshift(`${datasetAxisLabel(axis)} ${n%length+1}`);
    n=Math.floor(n/length);
  }
  $('frameCount').textContent=`/ ${dataset.frames}${coordinates.length>1?' · '+coordinates.join(' '):''}`;
  const sourceName=metadata.sliceLabels?.[Number($('frame').value)-1]||'';
  $('sliceName').textContent=sourceName;$('sliceName').title=sourceName;
  syncViewerToolbar();
  if(orthogonal){orthogonal.z=slicePosition()-1;if(tileMode){saveFileFrame();refreshTileOrthogonalStates();draw();}else{drawOrthogonalViews();refreshOrthogonal();}}
  publishSidebar();
}
function sliceAxes(){return dataset?.extra||[];}
function axisIndex(){const axes=sliceAxes();return axes.includes(sliceAxis)?axes.indexOf(sliceAxis):Math.max(0,axes.length-1);}
function axisStride(index){return sliceAxes().slice(index+1).reduce((product,axis)=>product*dataset.shape[axis],1);}
function slicePosition(){const index=axisIndex(),axis=sliceAxes()[index];return axis===undefined?Number($('frame').value):Math.floor((Number($('frame').value)-1)/axisStride(index))%dataset.shape[axis]+1;}
function setAxisSlice(value){const index=axisIndex(),axis=sliceAxes()[index];if(axis===undefined){$('frame').value=value;return;}const stride=axisStride(index),length=dataset.shape[axis],flat=Number($('frame').value)-1,current=Math.floor(flat/stride)%length,next=Math.max(0,Math.min(length-1,Math.round(value)-1));$('frame').value=flat+(next-current)*stride+1;}
function syncViewerToolbar(){
  if(!dataset)return;
  $('tool-slices').hidden=false;
  const select=$('viewerDataset');
  if(select){if(select.options.length!==metadata.datasets.length||[...select.options].some((option,index)=>Number(option.value)!==metadata.datasets[index].id)){select.replaceChildren();for(const item of metadata.datasets){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}}select.value=String(dataset.id);}
  const axis=$('viewerAxis'),axes=sliceAxes();axis.hidden=axes.length<2;
  if(!axis.hidden){if(axis.options.length!==axes.length||[...axis.options].some((option,index)=>Number(option.value)!==[...axes].reverse()[index])){axis.replaceChildren();for(const index of [...axes].reverse()){const option=document.createElement('option');option.value=index;option.textContent=`Axis ${dataset.shape.length-index} · ${datasetAxisLabel(index)} (${dataset.shape[index]})`;axis.append(option);}}axis.value=String(axes[axisIndex()]);}
  const length=axes.length?dataset.shape[axes[axisIndex()]]:dataset.frames,position=slicePosition();
  $('viewerSliceRange').max=String(length);$('viewerSliceRange').value=position;$('viewerSliceRange').disabled=length<2;
  $('viewerSliceNumber').max=String(length);$('viewerSliceNumber').value=position;
  $('viewerSliceCount').textContent=`/ ${length}`;
  for(const id of ['viewerSlicePrev','viewerSliceNext','viewerSlicePlay'])$(id).disabled=length<2;
  $('viewerSlicePlay').textContent=playing?'Ⅱ':'▶';
  $('viewerSlicePlay').dataset.shortcutBase=playing?'Pause slices':'Play slices';
  if(document.activeElement!==$('viewerSliceFps'))$('viewerSliceFps').value=$('fps').value;
  const dtype=String(dataset.dtype||''),bits=Number(dtype.match(/\d+/)?.[0])||8,channels=dataset.channel==null?1:dataset.shape[dataset.channel];
  const bytes=dataset.width*dataset.height*channels*bits/8,sizeLabel=bytes<1048576?`${formatValue(bytes/1024)}KB`:`${formatValue(bytes/1048576)}MB`;
  const sourceName=metadata.sliceLabels?.[Number($('frame').value)-1];
  $('imageSummary').textContent=`${dataset.width}×${dataset.height} (${dataset.width}×${dataset.height}); ${channels===3?'RGB':bits+'-bit'}; ${sizeLabel}${sourceName?' · '+sourceName:''}`;
  drawTransferCurve();
  updateShortcutTips();
}
function changeFrame(delta, automatic=false){if(!dataset)return;const previous=Number($('frame').value),total=sliceAxes().length?dataset.shape[sliceAxes()[axisIndex()]]:dataset.frames;let position=slicePosition()-1+delta;if(automatic)position=(position+total)%total;else position=Math.max(0,Math.min(total-1,position));setAxisSlice(position+1);if(Number($('frame').value)!==previous)resetAutoThresholds();frameLabel();$('pixel').textContent='';commitFrameChange('slice');if(orthogonal)commitFrameChange('selection');scheduleRender(0);}
function loadTransferHistogram(){
  if(!dataset)return;
  const key=transferHistogramKey();
  if(transferHistograms.has(key))return;
  transferHistograms.set(key,null);
  const boundKey=key;
  request('histogram',{...base(),bins:256},true).then(result=>{transferHistograms.set(key,result);if(!displayBounds.has(boundKey)&&Number.isFinite(result.min)&&Number.isFinite(result.max)&&result.max>result.min)displayBounds.set(boundKey,[result.min,result.max]);if(key===transferHistogramKey()){for(const entry of frameCache.values())entry.stretchContexts?.clear();drawTransferCurve();publishSidebar();if($('stretch').value==='histeq')scheduleRender(0);}}).catch(()=>transferHistograms.delete(key));
}
function transferHistogramKey(){return `${activeFileFrame}:${dataset?.id}:${Number($('frame').value)-1}`;}
function transferStretchContext(stretch,low,high){
  const histogram=transferHistograms.get(transferHistogramKey());
  const zero=high>low?(0-low)/(high-low):0;
  if(stretch!=='histeq'||!histogram?.counts?.length||!(high>low))return stretchContextFromHistogram(null,stretch,zero);
  const counts=new Uint32Array(256),edges=histogram.edges||[],range=high-low;
  for(let index=0;index<histogram.counts.length;index++){
    const value=(edges[index]+edges[index+1])/2;if(!Number.isFinite(value)||value<low||value>high)continue;
    counts[Math.max(0,Math.min(255,Math.floor((value-low)/range*255)))]+=histogram.counts[index];
  }
  return stretchContextFromHistogram(counts,stretch,zero);
}
function drawTransferCurve(){
  const canvas=$('transferCurve'),g=canvas.getContext('2d'),w=canvas.width,h=canvas.height,low=Number($('low').value),high=Number($('high').value);if(!Number.isFinite(low)||!Number.isFinite(high))return;
  const histogram=transferHistograms.get(transferHistogramKey());
  const bounds=displayBounds.get(transferHistogramKey()),span=Math.max(Number.MIN_VALUE,high-low),start=histogram?.min??bounds?.[0]??low,end=histogram?.max??bounds?.[1]??high,extent=Math.max(Number.MIN_VALUE,end-start),x=value=>Math.max(0,Math.min(w,(value-start)/extent*w));
  g.fillStyle='#1a2028';g.fillRect(0,0,w,h);
  if(histogram){const peak=Math.max(1,...histogram.counts);g.fillStyle='#55626d';for(let i=0;i<histogram.counts.length;i++){const height=Math.min(h-4,histogram.counts[i]/peak*(h-4));g.fillRect(i*w/histogram.counts.length,h-height,Math.max(1,w/histogram.counts.length),height);}}
  const context=transferStretchContext($('stretch').value,low,high),y=value=>h-stretchIntensity((value-low)/span,context)*h;
  g.strokeStyle='#586673';g.strokeRect(.5,.5,w-1,h-1);g.strokeStyle='#72d4b5';g.lineWidth=2;g.beginPath();
  for(let point=0;point<=128;point++){const value=start+extent*point/128,px=point*w/128,py=y(value);if(point)g.lineTo(px,py);else g.moveTo(px,py);}g.stroke();
  g.fillStyle='#d5e4e7';for(const value of [low,high]){const px=x(value);g.fillRect(Math.max(0,Math.min(w-1,px)),h-5,1,5);}
  $('transferLow').textContent=formatValue(low);$('transferHigh').textContent=formatValue(high);
}
function currentRawEntry(){
  const frame=Number($('frame').value)-1;
  return [...frameCache.values()].find(entry=>entry.sourceDataset===dataset.id&&entry.sourceFrame===frame&&entry.raw);
}
function forEachSelectionPixel(entry,maxPixels,callback){
  const width=entry.result.width,height=entry.result.height,channels=entry.channels||1,box=entry.result.box,pixels=width*height;
  const areaSelection=selection&&['roi','oval','polygon','freehand'].includes(selection.type);
  if(!areaSelection){
    const step=Number.isFinite(maxPixels)?Math.max(1,Math.floor(pixels/Math.max(1,maxPixels))):1;
    for(let pixel=0;pixel<pixels;pixel+=step)callback(pixel*channels,channels);
    return;
  }
  const bounds=selectionBounds(selection.points,selection.type),left=Math.max(0,Math.floor((bounds[0]-box[0])/(box[2]-box[0])*width)),right=Math.min(width,Math.ceil((bounds[2]-box[0])/(box[2]-box[0])*width));
  const top=Math.max(0,Math.floor((bounds[1]-box[1])/(box[3]-box[1])*height)),bottom=Math.min(height,Math.ceil((bounds[3]-box[1])/(box[3]-box[1])*height));
  const area=Math.max(1,(right-left)*(bottom-top)),step=Number.isFinite(maxPixels)?Math.max(1,Math.floor(Math.sqrt(area/Math.max(1,maxPixels)))):1;
  for(let py=top;py<bottom;py+=step)for(let px=left;px<right;px+=step){
    const x=box[0]+(px+.5)*(box[2]-box[0])/width,y=box[1]+(py+.5)*(box[3]-box[1])/height;
    if(!insideSelection([x,y]))continue;
    callback((py*width+px)*channels,channels);
  }
}
function selectionSamples(entry,maxPixels=262144){
  if(!selection||!['roi','oval','polygon','freehand'].includes(selection.type))return entry.raw;
  const values=[];
  forEachSelectionPixel(entry,maxPixels,(offset,channels)=>{for(let channel=0;channel<channels;channel++)values.push(entry.raw[offset+channel]);});
  return values;
}
function imageJDataKind(entry){
  if((entry.channels||1)>1)return 'byte';
  const dtype=String(dataset?.dtype||entry.result?.dtype||'').toLowerCase();
  if(entry.raw instanceof Uint8Array||dtype==='l'||dtype==='1'||/^(?:[<>=|]?[ub]1|u?int8|bool)$/.test(dtype))return 'byte';
  if(entry.raw instanceof Uint16Array||/^(?:[<>=|]?u2|uint16)$/.test(dtype))return 'short';
  return 'float';
}
function entryStretchContext(entry,stretch=$('stretch').value,low=Number($('low').value),high=Number($('high').value)){
  entry.stretchContexts??=new Map();
  const key=`${stretch}:${low}:${high}`;
  if(!entry.stretchContexts.has(key))entry.stretchContexts.set(key,stretchContext(entry.raw,entry.channels||1,stretch,low,high));
  return entry.stretchContexts.get(key);
}
function resetLimitsForEntries(entries){
  if(!entries.length)return [0,1];
  let low=Infinity,high=-Infinity;
  for(const entry of entries){const limits=imageJResetLimits(entry.raw,entry.channels,imageJDataKind(entry));low=Math.min(low,limits[0]);high=Math.max(high,limits[1]);}
  return Number.isFinite(low)&&Number.isFinite(high)?[low,high]:[0,1];
}
function imageJSelectionLimits(entries,previousThreshold){
  return imageJAutoLimitsFromPixels(consume=>{
    for(const entry of entries)forEachSelectionPixel(entry,Infinity,(offset,channels)=>{
      let value=channels<=1?Number(entry.raw[offset]):Array.from({length:Math.min(3,channels)},(_,channel)=>Number(entry.raw[offset+channel])).reduce((sum,item)=>sum+item,0)/Math.min(3,channels);
      if(channels>1)value=Math.floor(value+0.5);consume(value);
    });
  },previousThreshold,imageJDataKind(entries[0]));
}
function resetAutoThresholds(){imageJAutoThreshold=0;imageJStackAutoThreshold=0;}
function applyCutLimits(low,high){
  $('cuts').value='manual';$('low').value=low;$('high').value=high;
  drawTransferCurve();commitFrameChange('bc');scheduleRender(0);publishSidebar();
}
function applyAutoCuts(mode){
  const entry=currentRawEntry();
  if(!entry){$('cuts').value=mode;commitFrameChange('bc');scheduleRender(0);return;}
  let low,high;
  if(mode==='minmax'){
    imageJAutoThreshold=0;[low,high]=imageJResetLimits(entry.raw,entry.channels,imageJDataKind(entry));
  }else if(mode==='percentile'){
    const result=imageJSelectionLimits([entry],imageJAutoThreshold);
    imageJAutoThreshold=result.autoThreshold;
    if(result.limits)[low,high]=result.limits;
    else{imageJAutoThreshold=0;[low,high]=imageJResetLimits(entry.raw,entry.channels,imageJDataKind(entry));}
  }else{
    const samples=[];
    forEachSelectionPixel(entry,Infinity,(offset,channels)=>{for(let channel=0;channel<channels;channel++)samples.push(Number(entry.raw[offset+channel]));});
    [low,high]=autoLimits(samples,entry.channels,mode);
  }
  applyCutLimits(low,high);
}
function selectedStackFrames(){
  return selectedStackFrameIndices(sliceAxes(),dataset.shape,sliceAxes()[axisIndex()],Number($('frame').value)-1);
}
function applyStackAutoCuts(mode){
  const frames=new Set(selectedStackFrames());
  const entries=[...frameCache.values()].filter(entry=>entry.raw&&entry.sourceDataset===dataset.id&&frames.has(entry.sourceFrame));
  if(!entries.length){applyAutoCuts(mode);return;}
  if(entries.length<frames.size){showError(new Error('Wait for the current stack to finish loading before using S-Auto or S-Reset.'));return;}
  if(mode==='minmax'){
    imageJStackAutoThreshold=0;const [low,high]=resetLimitsForEntries(entries);
    applyCutLimits(low,high);return;
  }
  let low,high;
  if(mode==='percentile'){
    const result=imageJSelectionLimits(entries,imageJStackAutoThreshold);
    imageJStackAutoThreshold=result.autoThreshold;
    if(result.limits)[low,high]=result.limits;
    else{imageJStackAutoThreshold=0;[low,high]=resetLimitsForEntries(entries);}
  }else{
    const channels=entries[0].channels||1,samples=[];
    for(const entry of entries)forEachSelectionPixel(entry,Infinity,(offset,entryChannels)=>{
      for(let channel=0;channel<entryChannels;channel++)samples.push(Number(entry.raw[offset+channel]));
    });
    [low,high]=autoLimits(samples,channels,mode);
  }
  applyCutLimits(low,high);
}
function selectDataset(){disableOrthogonal();dataset=metadata.datasets.find(d=>d.id===Number($('dataset').value));resetAutoThresholds();sliceAxis=dataset.extra?.at(-1)??null;$('frame').value=1;$('frame').max=dataset.frames;frameLabel();$('play').disabled=dataset.frames<2;roi=null;line=null;selection=null;annotations=[];overlays=[];roiManager=[];vertices=[];preview=null;activePng='';stopPlay();$('metadata').textContent=`${dataset.width} × ${dataset.height}\n${dataset.dtype} · ${metadata.kind}\nShape: ${dataset.shape.join(' × ')}\nAxes: ${dataset.targetExpression||dataset.axes||'h w'}`;fit();}
function saveFileFrame() {
  if (!activeFileFrame || !fileFrames.has(activeFileFrame)) return;
  Object.assign(fileFrames.get(activeFileFrame), {metadata,datasetId:dataset?.id,plane:Number($('frame').value),sliceAxis,scale,cx,cy,preview,previewBox,activePng,frameCache,cacheSignature,cacheBytes,
    cuts:$('cuts').value,low:$('low').value,high:$('high').value,stretch:$('stretch').value,cmap:$('cmap').value,invert:$('invert').checked,threshold:$('threshold').checked,roi,line,selection,orthogonalState:orthogonalSnapshot(),annotations,overlays,roiManager,calibration});
}
function scheduleTileRefresh(delay=0){
  if(!tileMode)return;tileRefreshWanted=true;
  if(tileRefreshRunning||tileRefreshTimer)return;
  tileRefreshTimer=setTimeout(()=>{tileRefreshTimer=null;refreshTilePreviews();},delay);
}
function invalidateTilePreview(state){
  if(!state)return;
  state.tileSignature='';
  state.tileGeneration=(state.tileGeneration||0)+1;
}
async function refreshTilePreviews(){
  if(!tileMode||tileRefreshRunning)return;
  tileRefreshRunning=true;tileRefreshWanted=false;
  try{
    saveFileFrame();
    const jobs=[];
    for(const [id,state] of fileFrames){
      if(state.visible===false)continue;
      const d=state.metadata.datasets.find(item=>item.id===(state.datasetId??state.metadata.datasets[0].id));
      if(!d)continue;
      if(state.loading)continue;
      const args={dataset:d.id,frame:Math.max(0,Math.min(d.frames-1,(state.plane||1)-1)),box:[0,0,d.width,d.height],size:Math.min(1024,state.metadata.maxSize),raw:true,cuts:state.cuts||'percentile',low:Number(state.low??0),high:Number(state.high??1),stretch:state.stretch||'linear',cmap:state.cmap||'gray',invert:!!state.invert,threshold:!!state.threshold,thresholdLow:Number(state.low??0),thresholdHigh:Number(state.high??1)};
      const signature=JSON.stringify(args);
      if(signature===state.tileSignature)continue;
      state.tileSignature=signature;
      const generation=(state.tileGeneration||0)+1;state.tileGeneration=generation;
      const cached=state.frameCache?.get(cacheKey(args.frame,args.box))||state.tileEntry;
      const reusable=cached&&cached.sourceFrame===args.frame&&cached.sourceDataset===args.dataset&&cached.result.box.join(',')===args.box.join(',');
      const source=reusable?Promise.resolve(cached):request('render',args,true,id).then(result=>decodePreview(result,args,false));
      jobs.push(source.then(async entry=>{if(fileFrames.get(id)!==state||state.tileGeneration!==generation)return null;await recolorEntry(entry,args);return {id,state,generation,entry};}).catch(()=>{if(state.tileGeneration===generation)state.tileSignature='';return null;}));
    }
    const ready=await Promise.all(jobs);
    for(const item of ready)if(item&&fileFrames.get(item.id)===item.state&&item.state.tileGeneration===item.generation){item.state.tileEntry=item.entry;item.state.tilePreview=item.entry.image;}
    draw();for(const item of ready)if(item)scheduleCachedRecolor(item.id,item.state);
    refreshTileOrthogonalStates();
  }finally{
    tileRefreshRunning=false;if(tileRefreshWanted)scheduleTileRefresh(0);
  }
}
function commitFrameChange(group){
  if(!activeFileFrame||!fileFrames.has(activeFileFrame))return;
  saveFileFrame();
  publishSidebar();
  const active=fileFrames.get(activeFileFrame),refreshesTile=['bc','slice'].includes(group);
  if(refreshesTile)invalidateTilePreview(active);
  if(group==='bc'&&!tileMode)scheduleCachedRecolor(activeFileFrame,fileFrames.get(activeFileFrame));
  if(!frameLocks.has(group)||!fileFrames.get(activeFileFrame)?.lockMember){
    if(refreshesTile)scheduleTileRefresh();else if(tileMode)draw();
    return;
  }
  const keys=lockGroups[group];
  for(const [id,state] of fileFrames){
    if(id===activeFileFrame||!state.lockMember)continue;
    for(const key of keys)state[key]=group==='selection'&&active[key]!=null?structuredClone(active[key]):active[key];
    if(group==='selection')syncOrthogonalState(active,state);
    if(group==='slice'){
      const d=state.metadata.datasets.find(item=>item.id===(state.datasetId??state.metadata.datasets[0].id));
      state.plane=Math.max(1,Math.min(d.frames,active.plane));
    }
    if(refreshesTile)invalidateTilePreview(state);
    if(group==='bc'&&!tileMode)scheduleCachedRecolor(id,state);
  }
  if(refreshesTile)scheduleTileRefresh();else if(tileMode){refreshTileOrthogonalStates();draw();}
}
function syncOrthogonalState(source,state){
  const d=state.metadata.datasets.find(item=>item.id===(state.datasetId??state.metadata.datasets[0].id)),view=source.orthogonalState;
  if(!view||!d?.extra?.length){state.orthogonalState=null;return;}
  const axis=d.extra.includes(view.axis)?view.axis:d.extra.at(-1),depth=d.shape[axis],z=Math.max(0,Math.min(depth-1,view.z));
  state.orthogonalState={axis,x:Math.max(0,Math.min(d.width-1,view.x)),y:Math.max(0,Math.min(d.height-1,view.y)),z,depth};
  state.tileOrthogonalKey='';
  const axes=d.extra,index=axes.indexOf(axis),stride=axes.slice(index+1).reduce((product,item)=>product*d.shape[item],1),flat=Math.max(0,(state.plane||1)-1),current=Math.floor(flat/stride)%depth;
  state.plane=flat+(z-current)*stride+1;
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
    if(source)for(const group of frameLocks){for(const key of lockGroups[group])state[key]=group==='selection'&&source[key]!=null?structuredClone(source[key]):source[key];if(group==='selection')syncOrthogonalState(source,state);}
    if(source){state.tileSignature='';scheduleCachedRecolor(id,state);}
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
function syncFlipButtons(state){
  for(const [id,key] of [['toolFlipHorizontal','horizontal'],['toolFlipVertical','vertical']]){
    const pressed=!!state?.flipState?.[key];$(id).classList.toggle('selected',pressed);$(id).setAttribute('aria-pressed',String(pressed));
  }
}
function transformCachedImage(image,action){
  if(!image)return null;
  const width=image.width,height=image.height,rotated=action==='rotateLeft'||action==='rotateRight';
  const output=document.createElement('canvas');output.width=rotated?height:width;output.height=rotated?width:height;
  const context=output.getContext('2d');context.imageSmoothingEnabled=false;
  if(action==='flipHorizontal'){context.translate(width,0);context.scale(-1,1);}
  else if(action==='flipVertical'){context.translate(0,height);context.scale(1,-1);}
  else if(action==='rotate180'){context.translate(width,height);context.rotate(Math.PI);}
  else if(action==='rotateLeft'){context.translate(0,width);context.rotate(-Math.PI/2);}
  else if(action==='rotateRight'){context.translate(height,0);context.rotate(Math.PI/2);}
  context.drawImage(image,0,0);
  return output;
}
function transformCachedState(id,state,action,oldDataset){
  if(!oldDataset||!['flipHorizontal','flipVertical','rotateLeft','rotateRight','rotate180'].includes(action))return false;
  const transformed=new Set(),images=new Map();
  const update=entry=>{
    if(!entry?.raw||transformed.has(entry))return;
    transformed.add(entry);
    const result=transformRaw(entry.raw,entry.result.width,entry.result.height,entry.channels,action);
    entry.raw=result.raw;entry.result.box=transformBox(entry.result.box,oldDataset.width,oldDataset.height,action);
    entry.result.width=result.width;entry.result.height=result.height;
    if(entry.image){const old=entry.image;entry.image=transformCachedImage(old,action);images.set(old,entry.image);}
  };
  const next=new Map();
  for(const entry of state.frameCache?.values()||[]){update(entry);next.set(cacheKey(entry.sourceFrame,entry.result.box),entry);}
  state.frameCache=next;
  update(state.tileEntry);
  for(const [key,entry] of overviewCache)if(key.startsWith(`${id}:`))update(entry);
  if(state.preview)state.preview=images.get(state.preview)||transformCachedImage(state.preview,action);
  if(state.previewBox)state.previewBox=transformBox(state.previewBox,oldDataset.width,oldDataset.height,action);
  state.tilePreview=state.tileEntry?.image||null;state.tileSignature='';
  return transformed.size>0;
}
function selectFileFrame(id) {
  id=Number(id); if(!fileFrames.has(id)||id===activeFileFrame)return;
  const oldId=activeFileFrame;
  saveFileFrame();disableOrthogonal();stopPlay(); stopSliceHold(); clearTimeout(renderTimer); clearTimeout(preloadTimer); revision++; cacheGeneration++;
  activeFileFrame=id;
  resetAutoThresholds();
  const state=fileFrames.get(id); metadata=state.metadata;
  syncFlipButtons(state);
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
  $('metadata').textContent=`${dataset.width} × ${dataset.height}\n${dataset.dtype} · ${metadata.kind}\nShape: ${dataset.shape.join(' × ')}\nAxes: ${dataset.targetExpression||dataset.axes||'h w'}`;
  $('empty').hidden=!!preview; clearExpiredError(); $('busy').textContent='';
  frameList(); updateCacheStatus();updateLoadProgress(state);
  if(!state.preview&&!state.scale){const {w,h}=size();scale=Math.min(w/dataset.width,h/dataset.height)*.96;if(!frameLocks.has('view')){cx=dataset.width/2;cy=dataset.height/2;}saveFileFrame();}
  if(state.orthogonalState)enableOrthogonal(state.orthogonalState,false);
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
function interactivePlot(canvas,values,xValues=null,readout=null){
  const finite=values.map(value=>value==null?NaN:Number(value)),xs=xValues?.map(value=>value==null?NaN:Number(value))||finite.map((_,index)=>index),valid=finite.some((value,index)=>Number.isFinite(value)&&Number.isFinite(xs[index]));
  canvas._plot={values:finite,xs,view:[0,Math.max(1,finite.length-1)],readout,hover:-1};canvas.classList.toggle('has-data',valid);if(readout&&!valid)readout.textContent='';
  const ticks=(low,high,count=5)=>{const span=Math.max(Number.MIN_VALUE,high-low),raw=span/count,power=10**Math.floor(Math.log10(raw)),unit=raw/power,step=(unit<=1?1:unit<=2?2:unit<=5?5:10)*power,start=Math.ceil(low/step)*step,result=[];for(let value=start;value<=high+step*1e-9;value+=step)result.push(value);return result;};
  const draw=()=>{
    const state=canvas._plot,rect=canvas.getBoundingClientRect(),cssWidth=Math.max(240,Math.round(rect.width||canvas.parentElement?.clientWidth||520)),cssHeight=Math.max(140,Math.round(rect.height||190)),ratio=Math.max(1,window.devicePixelRatio||1),pixelWidth=Math.round(cssWidth*ratio),pixelHeight=Math.round(cssHeight*ratio);
    if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
    const g=canvas.getContext('2d');g.setTransform(ratio,0,0,ratio,0,0);g.clearRect(0,0,cssWidth,cssHeight);if(!state||!state.values.some(Number.isFinite))return;
    const margin={left:58,right:14,top:12,bottom:34},plot={x:margin.left,y:margin.top,w:Math.max(20,cssWidth-margin.left-margin.right),h:Math.max(20,cssHeight-margin.top-margin.bottom)},[from,to]=state.view,start=Math.max(0,Math.floor(from)),end=Math.min(state.values.length-1,Math.ceil(to)),shown=state.values.slice(start,end+1).filter(Number.isFinite);if(!shown.length)return;
    let min=Math.min(...shown),max=Math.max(...shown);if(max===min){const delta=Math.max(.5,Math.abs(max)*.05);min-=delta;max+=delta;}const xAt=index=>plot.x+(index-from)/Math.max(1e-9,to-from)*plot.w,yAt=value=>plot.y+plot.h-(value-min)/(max-min)*plot.h;
    g.font='10px sans-serif';g.lineWidth=1;g.strokeStyle='#65717f66';g.fillStyle='#aeb7c3';g.textBaseline='middle';
    for(const value of ticks(min,max,5)){const y=yAt(value);g.beginPath();g.moveTo(plot.x,y);g.lineTo(plot.x+plot.w,y);g.stroke();const label=formatValue(value);g.fillText(label,plot.x-7-g.measureText(label).width,y);}
    g.textBaseline='top';const xTickCount=Math.max(2,Math.min(6,Math.floor(plot.w/90)));for(let n=0;n<=xTickCount;n++){const index=from+(to-from)*n/xTickCount,x=xAt(index);g.beginPath();g.moveTo(x,plot.y);g.lineTo(x,plot.y+plot.h);g.stroke();const nearest=Math.max(0,Math.min(state.xs.length-1,Math.round(index))),label=formatValue(state.xs[nearest]??nearest),width=g.measureText(label).width;g.fillText(label,Math.max(plot.x,Math.min(plot.x+plot.w-width,x-width/2)),plot.y+plot.h+7);}
    g.strokeStyle='#788593';g.strokeRect(plot.x+.5,plot.y+.5,plot.w-1,plot.h-1);
    g.save();g.beginPath();g.rect(plot.x,plot.y,plot.w,plot.h);g.clip();g.strokeStyle='#72d4b5';g.lineWidth=1.4;g.beginPath();let pen=false;for(let i=start;i<=end;i++){const value=state.values[i];if(!Number.isFinite(value)){pen=false;continue;}const x=xAt(i),y=yAt(value);if(pen)g.lineTo(x,y);else g.moveTo(x,y);pen=true;}g.stroke();
    if(state.hover>=start&&state.hover<=end&&Number.isFinite(state.values[state.hover])){const x=xAt(state.hover),y=yAt(state.values[state.hover]);g.strokeStyle='#d7e3e8aa';g.setLineDash([3,3]);g.beginPath();g.moveTo(x,plot.y);g.lineTo(x,plot.y+plot.h);g.moveTo(plot.x,y);g.lineTo(plot.x+plot.w,y);g.stroke();g.setLineDash([]);g.fillStyle='#72d4b5';g.beginPath();g.arc(x,y,3,0,Math.PI*2);g.fill();}g.restore();state.range=[min,max];state.plotRect=plot;
  };canvas._plotDraw=draw;
  if(!canvas._plotBound){canvas._plotBound=true;let drag=null;
    canvas._plotObserver=new ResizeObserver(()=>canvas._plotDraw?.());canvas._plotObserver.observe(canvas);
    canvas.addEventListener('wheel',event=>{const state=canvas._plot;if(!state||state.values.length<3)return;event.preventDefault();const rect=canvas.getBoundingClientRect(),plot=state.plotRect||{x:0,w:rect.width},ratio=Math.max(0,Math.min(1,(event.clientX-rect.left-plot.x)/plot.w)),span=state.view[1]-state.view[0],next=Math.max(2,Math.min(state.values.length-1,span*(event.deltaY<0?.8:1.25))),anchor=state.view[0]+ratio*span,from=Math.max(0,Math.min(state.values.length-1-next,anchor-ratio*next));state.view=[from,from+next];canvas._plotDraw();},{passive:false});
    canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,view:[...canvas._plot.view]};canvas.setPointerCapture(event.pointerId);});
    canvas.addEventListener('pointermove',event=>{const state=canvas._plot;if(!state)return;const rect=canvas.getBoundingClientRect(),plot=state.plotRect||{x:0,w:rect.width},ratio=Math.max(0,Math.min(1,(event.clientX-rect.left-plot.x)/plot.w)),index=Math.max(0,Math.min(state.values.length-1,Math.round(state.view[0]+ratio*(state.view[1]-state.view[0]))));state.hover=index;if(state.readout)state.readout.textContent=`X=${formatValue(state.xs[index])}, Y=${formatValue(state.values[index])}`;if(drag){const span=drag.view[1]-drag.view[0],shift=(drag.x-event.clientX)/plot.w*span,from=Math.max(0,Math.min(state.values.length-1-span,drag.view[0]+shift));state.view=[from,from+span];}canvas._plotDraw();});
    canvas.addEventListener('pointerleave',()=>{if(canvas._plot){canvas._plot.hover=-1;if(canvas._plot.readout)canvas._plot.readout.textContent='';canvas._plotDraw();}});canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});canvas.addEventListener('dblclick',()=>{const state=canvas._plot;if(state){state.view=[0,Math.max(1,state.values.length-1)];state.hover=-1;canvas._plotDraw();}});
  }draw();requestAnimationFrame(draw);
}
function chart(values,xValues=null){interactivePlot($('chart'),values,xValues,$('plotReadout'));}
const measurementHistory=[];
let measurementFields=new Set(["Area","Mean","Std","Min","Max","Sum"]);
let calibration={factor:1,unit:"px"};
async function analyze(op){if(!dataset||analysisRunning)return;if(op==='measure'&&selection?.type==='angle'&&selection.points.length===3){const [a,b,c]=selection.points,u=[a[0]-b[0],a[1]-b[1]],v=[c[0]-b[0],c[1]-b[1]],cos=(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v));$('analysis').textContent=`Angle: ${formatValue(Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI)}°`;chart([]);$('analysisPane').hidden=false;return;}if(op==='profile'&&!line){showError(new Error('Choose Line [L] and draw a line first.'));return;}stopPlay();analysisRunning=true;$('busy').textContent='Analyzing…';const args={...base(),box:roi||undefined,points:line,selection};try{const r=await request(op,args);clearExpiredError();if(op==='measure'){measurementHistory.push({...r,label:metadata.label||metadata.path.split(/[\\/]/).pop(),slice:Number($('frame').value)});$('analysis').textContent=`Frame: ${r.frame+1} · Dataset: ${r.dataset}\nROI: ${r.box.join(', ')}\nArea: ${formatValue(r.area*calibration.factor*calibration.factor)} ${calibration.unit}²\nFinite pixels: ${formatValue(r.count)}\nMean: ${formatValue(r.mean)}\nStd (population): ${formatValue(r.std)}\nMin: ${formatValue(r.min)}\nMax: ${formatValue(r.max)}\nSum: ${formatValue(r.sum)}`.split('\n').filter(line=>!['Area','Mean','Std','Min','Max','Sum'].some(field=>line.startsWith(field+':')&&!measurementFields.has(field))).join('\n');chart([]);}else if(op==='histogram'){$('analysis').textContent=`Histogram · ${formatValue(r.samples)} samples\n${r.sampled?'Sampled; stride '+formatValue(r.step):'All pixels'}\nX: ${formatValue(r.edges[0])} … ${formatValue(r.edges.at(-1))}\nY: count per bin`;chart(r.counts,r.counts.map((_,index)=>(r.edges[index]+r.edges[index+1])/2));}else{$('analysis').textContent=`Profile · ${formatValue(r.values.length)} points\nLength: ${formatValue(r.distance.at(-1))} px\nX: distance · Y: raw value\nNearest-neighbor samples`;chart(r.values,r.distance);}$('analysisPane').hidden=false;$('busy').textContent='';}catch(error){showError(error);}finally{analysisRunning=false;}}
function mouseMatches(binding,event,gesture,allowExtraShift=false){
  if(!binding)return false;
  const parts=String(binding).toLowerCase().split('+').map(part=>part.trim()),name=parts.pop(),mods=new Set(parts);
  const mac=/Mac/i.test(navigator.platform);
  return name===gesture&&spaceHeld===mods.has('space')&&(!mods.has('left')||event.button===0)&&(!mods.has('middle')||event.button===1)&&(!mods.has('right')||event.button===2)&&(allowExtraShift?(!mods.has('shift')||event.shiftKey):event.shiftKey===mods.has('shift'))&&event.altKey===(mods.has('alt')||mods.has('option'))&&event.ctrlKey===(mods.has('ctrl')||mods.has('control')||(!mac&&mods.has('mod')))&&event.metaKey===(mods.has('cmd')||mods.has('meta')||(mac&&mods.has('mod')));
}
function imageWheel(event){
  if(!dataset||event.deltaY===0)return;
  event.preventDefault();
  if(mouseMatches(mouseShortcuts.zoomAtPointer,event,'wheel'))zoom(event.deltaY<0?1:-1,position(event));
  else if(mouseMatches(mouseShortcuts.zoomAtCenter,event,'wheel'))zoom(event.deltaY<0?1:-1);
  else if(mouseMatches(mouseShortcuts.slice,event,'wheel')&&dataset.frames>1)changeFrame(event.deltaY<0?-1:1);
}
canvas.addEventListener('wheel',imageWheel,{passive:false});
function showPopup(menu,event,items){event.preventDefault();menu.replaceChildren();for(const [label,run] of items){const button=document.createElement('button');button.textContent=label;button.disabled=!run;if(run)button.onclick=()=>{menu.hidden=true;run();};menu.append(button);}menu.hidden=false;menu.style.left=Math.min(event.clientX,window.innerWidth-menu.offsetWidth-6)+'px';menu.style.top=Math.min(event.clientY,window.innerHeight-menu.offsetHeight-6)+'px';}
function applyMenuVisibility(items={}){
  for(const menu of document.querySelectorAll('.menu-bar > details.menu')){
    const name=menu.querySelector(':scope > summary')?.textContent.trim();
    menu.hidden=items[name]===false;
    const panel=menu.querySelector(':scope > .menu-panel');
    if(!panel)continue;
    for(const element of panel.children){
      if(!element.matches('button, details.submenu'))continue;
      const label=(element.matches('button')?element.textContent:element.querySelector(':scope > summary')?.textContent||'').trim().replace(/\s*▸\s*$/,'');
      element.hidden=items[`${name} > ${label}`]===false;
    }
  }
}
function copyDisplayedImage(){
  if(!dataset||!navigator.clipboard?.write||typeof ClipboardItem==='undefined'){showError(new Error('Image clipboard is unavailable in this editor.'));return;}
  const ratio=canvas.width/canvas.clientWidth;
  const [left,top]=tileMode?[0,0]:transform(0,0);
  const right=tileMode?canvas.clientWidth:left+(dataset.width+(orthogonal?.depth||0))*scale;
  const bottom=tileMode?canvas.clientHeight:top+(dataset.height+(orthogonal?.depth||0))*scale;
  const x0=Math.max(0,Math.floor(left*ratio)),y0=Math.max(0,Math.floor(top*ratio));
  const x1=Math.min(canvas.width,Math.ceil(right*ratio)),y1=Math.min(canvas.height,Math.ceil(bottom*ratio));
  if(x1<=x0||y1<=y0){showError(new Error('No image pixels are visible to copy.'));return;}
  const copy=document.createElement('canvas');copy.width=x1-x0;copy.height=y1-y0;
  const context=copy.getContext('2d');context.drawImage(canvas,x0,y0,copy.width,copy.height,0,0,copy.width,copy.height);
  if(orthogonal&&!tileMode)for(const id of ['orthYZCanvas','orthXZCanvas']){
    const section=$(id),rect=section.getBoundingClientRect(),view=canvas.getBoundingClientRect();
    context.drawImage(section,(rect.left-view.left)*ratio-x0,(rect.top-view.top)*ratio-y0,rect.width*ratio,rect.height*ratio);
  }
  const png=new Promise((resolve,reject)=>copy.toBlob(blob=>blob?resolve(blob):reject(new Error('Unable to encode copied image')),'image/png'));
  navigator.clipboard.write([new ClipboardItem({'image/png':png})]).catch(showError);
}
canvas.oncontextmenu=e=>{if(mouseMatches(mouseShortcuts.contrastDrag,e,'drag')||!dataset)return;if($('tool').value==='zoom'){e.preventDefault();zoom(-1,position(e));return;}const point=position(e);const selected=selection&&vertices.length===0&&!e.shiftKey&&(hitSelectionHandle(e)>=0||insideSelection(point));
  const items=selected?[
    ['ROI Properties…',()=>openSelectionDialog(true)],['Specify…',()=>openSelectionDialog(false)],
    ['ROI Defaults…',openRoiDefaults],['Add to Overlay',addSelectionToOverlay],['Add to ROI Manager',addSelectionToManager],
    ['Copy Image',copyDisplayedImage],
    ['Duplicate Image…',openDuplicateDialog],
    ['Fit Spline',['polygon','freehand','line'].includes(selection.type)?fitSelectionSpline:null],['Create Mask',createSelectionMask],['Measure',()=>analyze('measure')]
  ]:[['Copy Image',copyDisplayedImage],['Rename…',()=>vscode.postMessage({type:'imageAction',action:'rename',frameId:activeFileFrame})],['Duplicate…',openDuplicateDialog],['Original Scale',()=>$('actual').click()],['Fit to Window',()=>$('fit').click()],['Brightness/Contrast…',openBCDialog],['Measure',()=>analyze('measure')],['Clear Selection',()=>$('clear').click()],['Monitor Memory…',()=>vscode.postMessage({type:'imageAction',action:'memory',frameId:activeFileFrame})]];
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
function selectionStatus(item){if(!item?.points?.length)return '';const points=item.points,last=points.at(-1),first=points[0];if(['roi','oval'].includes(item.type)){const [x0,y0,x1,y1]=selectionBounds(points,item.type);return `x=${formatValue(x0)}, y=${formatValue(y0)}, width=${formatValue(x1-x0)}, height=${formatValue(y1-y0)}`;}if(item.type==='line'){let length=0;for(let i=1;i<points.length;i++)length+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);const angle=Math.atan2(-(last[1]-first[1]),last[0]-first[0])*180/Math.PI;return `x=${formatValue(last[0])}, y=${formatValue(last[1])}, angle=${formatValue(angle)}°, length=${formatValue(length)}`;}if(item.type==='angle'&&points.length===3){const [a,b,c]=points,u=[a[0]-b[0],a[1]-b[1]],v=[c[0]-b[0],c[1]-b[1]],value=Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)||1))))*180/Math.PI;return `x=${formatValue(last[0])}, y=${formatValue(last[1])}, angle=${formatValue(value)}°`;}return `x=${formatValue(last[0])}, y=${formatValue(last[1])}, points=${points.length}`;}
function refreshSelection(){if(selection){roi=selectionBounds(selection.points);line=selection.type==='line'?[...selection.points[0],...selection.points.at(-1)]:null;$('region').textContent=selectionStatus(selection);}else{roi=null;line=null;$('region').textContent='';}commitFrameChange('selection');draw();}
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
  $('region').textContent=selectionStatus(selection);
  vertices=[];commitFrameChange('selection');draw();
}
canvas.onpointerdown=e=>{
  if(!dataset)return;canvas.focus();
  if(tileMode){const rect=canvas.getBoundingClientRect(),{ids,cols,rows}=tileGeometry(rect.width,rect.height),col=Math.floor((e.clientX-rect.left)/(rect.width/cols)),row=Math.floor((e.clientY-rect.top)/(rect.height/rows)),id=ids[row*cols+col];if(!id)return;if(id!==activeFileFrame){selectFileFrame(id);draw();}}
  if(orthogonal&&e.button===0&&!mouseMatches(mouseShortcuts.orthogonalTool,e,'click',true)){const name=tileMode?tileOrthogonalViewAt(e):'xy';if(!name)return;canvas.setPointerCapture(e.pointerId);drag={tool:'orthogonal',orthogonalName:name};if(tileMode)tileOrthogonalPoint(name,e);else orthogonalPoint('xy',e);return;}
  const contrastDrag=mouseMatches(mouseShortcuts.contrastDrag,e,'drag'),handDrag=mouseMatches(mouseShortcuts.handDrag,e,'drag');
  if((e.button===2&&!contrastDrag)||(e.button===1&&!handDrag))return;
  stopPlay();const raw=bounded(position(e)),tool=contrastDrag?'contrast':handDrag?'pan':$('tool').value;
  const point=['roi','oval','polygon','freehand','line','angle'].includes(tool)?roiGeometry.pixelPoint(raw,dataset.width,dataset.height):raw;
  if(e.button===0&&selection&&['roi','oval','polygon','freehand','line','angle'].includes(tool)){
    const handle=hitSelectionHandle(e);
    if(handle>=0||insideSelection(point)){
      canvas.setPointerCapture(e.pointerId);
      drag={tool:handle>=0?'editHandle':'editMove',handle,point,screen:[e.clientX,e.clientY],rect:selectionRect(),original:{...selection,points:selection.points.map(p=>[...p])}};
      return;
    }
    selection=null;vertices=[];refreshSelection();return;
  }
  if(tool==='pointer'){cx=point[0];cy=point[1];commitFrameChange('view');scheduleRender(0);return;}
  if(tool==='zoom'){zoom(e.altKey?-1:1,raw);return;}
  if(tool==='text'){openTextDialog(point);return;}
  if(tool==='polygon'||tool==='angle'||(tool==='line'&&toolVariant==='segmented')){
    vertices.push(point);selection={type:tool,points:[...vertices]};commitFrameChange('selection');draw();
    if(tool==='angle'&&vertices.length===3)finishSelection(tool,vertices);
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  drag={screen:[e.clientX,e.clientY],point,cx,cy,tool,pixelsPerImage:tileMode?tileViewport()?.pixelsPerImage||scale:scale,low:Number($('low').value),high:Number($('high').value)};
  if(['roi','oval','freehand','line'].includes(tool)){
    roi=null;line=null;selection={type:tool,points:tool==='freehand'?[point]:[point,point]};
  }
};
canvas.ondblclick=e=>{if(mouseMatches(mouseShortcuts.fit,e,'doubleclick')){vertices=[];fit();}};
canvas.onpointermove=e=>{
  if(!dataset)return;
  if(drag?.tool==='orthogonal'){if(tileMode)tileOrthogonalPoint(drag.orthogonalName,e);else orthogonalPoint('xy',e);return;}
  const p=position(e);
  if(drag){const dx=e.clientX-drag.screen[0],dy=e.clientY-drag.screen[1];
    if(drag.tool==='editHandle'||drag.tool==='editMove'){dragEditedSelection(e,roiGeometry.pixelPoint(p,dataset.width,dataset.height));return;}
    if(drag.tool==='pan'){cx=drag.cx-dx/drag.pixelsPerImage;cy=drag.cy-dy/drag.pixelsPerImage;clampCenter();commitFrameChange('view');scheduleRender(100);}
    else if(drag.tool==='contrast'){const span=Math.max(Number.MIN_VALUE,drag.high-drag.low),range=span*Math.exp(dy/150),middle=(drag.low+drag.high)/2-dx/300*span;$('cuts').value='manual';$('low').value=middle-range/2;$('high').value=middle+range/2;drawTransferCurve();commitFrameChange('bc');scheduleRender(100);}
    else if(selection){let end=roiGeometry.pixelPoint(p,dataset.width,dataset.height);if(['roi','oval'].includes(drag.tool))selection.points=rectPoints(roiGeometry.createRect(drag.point,end,{shift:e.shiftKey,center:e.ctrlKey||e.metaKey}));
      else if(drag.tool==='line'&&e.shiftKey){const dx=end[0]-drag.point[0],dy=end[1]-drag.point[1],angle=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4,length=Math.hypot(dx,dy);end=bounded([drag.point[0]+length*Math.cos(angle),drag.point[1]+length*Math.sin(angle)]);selection.points=[drag.point,end];}
      else if(drag.tool==='freehand'||toolVariant==='freeline')selection.points.push(end);else selection.points=[drag.point,end];
      selection.points=selection.points.map(q=>roiGeometry.pixelPoint(q,dataset.width,dataset.height));
      $('region').textContent=selectionStatus(selection);commitFrameChange('selection');draw();}
    return;
  }
  clearTimeout(pixelTimer);const stamp=revision,b=base();
  pixelTimer=setTimeout(async()=>{if(pixelRunning||p[0]<0||p[1]<0||p[0]>=dataset.width||p[1]>=dataset.height)return;pixelRunning=true;try{const r=await request('pixel',{...b,x:Math.floor(p[0]),y:Math.floor(p[1])});if(stamp===revision)$('pixel').textContent=`x=${formatValue(r.x*calibration.factor)} (${formatValue(r.x)}), y=${formatValue(r.y*calibration.factor)} (${formatValue(r.y)}), value=${Array.isArray(r.value)?r.value.map(formatValue).join(', '):formatValue(r.value)}`;}catch{/* main actions report worker errors */}finally{pixelRunning=false;}},100);
};
canvas.onpointerup=e=>{if(!drag)return;if(selection&&['roi','oval','freehand','line'].includes(drag.tool)){if(Math.hypot(e.clientX-drag.screen[0],e.clientY-drag.screen[1])<3){selection=null;refreshSelection();}else finishSelection(drag.tool,selection.points);}else if(['editHandle','editMove'].includes(drag.tool))refreshSelection();drag=null;canvas.releasePointerCapture(e.pointerId);draw();};
canvas.onpointercancel=()=>{drag=null;};
for(const name of ['xz','yz']){
  const surface=$(name==='xz'?'orthXZCanvas':'orthYZCanvas');let captured=null;
  surface.onpointerdown=event=>{if(event.button!==0||!orthogonal)return;captured=event.pointerId;surface.setPointerCapture(captured);orthogonalPoint(name,event);};
  surface.onpointermove=event=>{if(event.pointerId===captured)orthogonalPoint(name,event);};
  surface.onpointerup=surface.onpointercancel=event=>{if(event.pointerId!==captured)return;surface.releasePointerCapture(captured);captured=null;};
  surface.onwheel=imageWheel;
  surface.oncontextmenu=event=>{if(!orthogonal)return;event.preventDefault();showPopup($('imageContextMenu'),event,[[`Duplicate ${name.toUpperCase()} as Frame`,()=>vscode.postMessage({type:'orthogonalDuplicate',fileFrame:activeFileFrame,args:{...base(),axis:orthogonal.axis,x:orthogonal.x,y:orthogonal.y,plane:name}})]]);};
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
function showToolVariants(event,tool){setTool(tool);showPopup($('toolPopup'),event,variants[tool].map(([label,value])=>[label,()=>{toolVariant=value;toolVariants[tool]=value;const button=$(tools.find(([,kind])=>kind===tool)[0]);button.dataset.shortcutBase=label;updateShortcutTips();} ]));}
for(const button of document.querySelectorAll('[data-variant-for]'))button.onclick=e=>showToolVariants(e,button.dataset.variantFor);
for(const [id,tool] of tools)if(variants[tool])$(id).oncontextmenu=e=>showToolVariants(e,tool);
$('cmap').replaceChildren();
for(const [value,label] of lutOptions){const option=document.createElement('option');option.value=value;option.textContent=label;$('cmap').append(option);}
for(const button of document.querySelectorAll('.tool-button')) button.dataset.tip=button.title;
$('fit').onclick=fit;$('actual').onclick=()=>{scale=1;commitFrameChange('view');scheduleRender(0);};$('zoomIn').onclick=()=>zoom(1);$('zoomOut').onclick=()=>zoom(-1);
$('zoom').onchange=()=>{const value=Number($('zoom').value.trim().replace(/%$/,''));if(!Number.isFinite(value)||value<=0||value>6400){$('zoom').value=`${formatValue(scale*100)}%`;showError(new Error('Enter a zoom percentage greater than 0 and at most 6400.'));return;}scale=value/100;commitFrameChange('view');scheduleRender(0);};
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
updateShortcutTips();
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
$('imageCopy').onclick=copyDisplayedImage;
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
for(const id of ['cmap','invert','threshold'])$(id).onchange=()=>{commitFrameChange('bc');scheduleRender(0);};
for(const id of ['low','high'])$(id).onchange=()=>{$('cuts').value='manual';commitFrameChange('bc');scheduleRender(0);};
$('clear').onclick=()=>{selection=null;vertices=[];refreshSelection();};
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
$('tile').onclick=()=>{saveFileFrame();const saved=fileFrames.get(activeFileFrame)?.orthogonalState;disableOrthogonal();tileMode=!tileMode;frameList();if(saved)enableOrthogonal(saved,false);draw();if(tileMode){scheduleTileRefresh(0);refreshTileOrthogonalStates();}};
$('tileLayout').onchange=()=>{if(tileMode)draw();};
$('lockView').onclick=()=>{const enabled=frameLocks.size!==Object.keys(lockGroups).length;for(const group of Object.keys(lockGroups))setFrameLock(group,enabled);};
for(const input of document.querySelectorAll('[data-frame-lock]'))input.onchange=()=>setFrameLock(input.dataset.frameLock,input.checked);
$('unlockAll').onclick=()=>{frameLocks.clear();frameList();};
$('closeFileFrame').onclick=()=>closeFileFrame();
function reorderFileFrame(action) {
  saveFileFrame();const entries=reorderedEntries([...fileFrames.entries()],activeFileFrame,action);
  fileFrames.clear();for(const [id,state] of entries)fileFrames.set(id,state);frameList();draw();
}
function reorderFrameAt(id,action){
  id=Number(id);if(!fileFrames.has(id))return;
  if(id!==activeFileFrame)selectFileFrame(id);
  reorderFileFrame(action);
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
function runShortcut(action){
  if(!dataset||!action)return;
  if(action==='fit')fit();
  else if(['hand','pan','pointer','roi','oval','polygon','freehand','line','angle','text','zoomTool'].includes(action))setTool(action==='zoomTool'?'zoom':action==='hand'?'pan':action);
  else if(action==='undoTransform')$('editUndo').click();
  else if(action==='redoTransform')$('editRedo').click();
  else if(action==='toggleBC')applySidebarAction('toggleBC');
  else if(action==='nextSlice')changeFrame(1);
  else if(action==='previousSlice')changeFrame(-1);
  else if(action==='nextFrame')moveFileFrame(1);
  else if(action==='previousFrame')moveFileFrame(-1);
  else if(['moveFrameUp','moveFrameDown','moveFrameFirst','moveFrameLast'].includes(action))reorderFileFrame(action.replace('moveFrame','').toLowerCase());
  else if(action==='toggleFrameDisplay')$('tile').click();
  else if(action==='play')$('play').click();
  else if(action==='rename')$('imageRename').click();
  else if(action==='autoCuts')applyAutoCuts('percentile');
  else if(action==='resetCuts')applyAutoCuts('minmax');
  else if(action==='stackAutoCuts')applyStackAutoCuts('percentile');
  else if(action==='stackResetCuts')applyStackAutoCuts('minmax');
  else if(action==='clear'){$('clear').click();stopPlay();stopBlink();for(const menu of document.querySelectorAll('.menu'))menu.open=false;}
  else if(action==='zoomIn'||action==='zoomOut'||action==='actual')$(action).click();
  else $(action)?.click();
}
function applySidebarAction(action,value){
  if(action==='shortcut'){runShortcut(String(value||''));return;}
  if(!dataset)return;
  if(action==='stepSlice'){stopPlay();changeFrame(Number(value));}
  else if(action==='setSlice'){$('frame').value=Math.max(1,Math.min(dataset.frames,Math.trunc(Number(value)||1)));$('frame').onchange();}
  else if(action==='play')$('play').click();
  else if(action==='fps'){$('fps').value=Math.max(1,Math.min(60,Number(value)||defaultFps));publishSidebar();}
  else if(action==='dataset'){$('dataset').value=String(value);selectDataset();}
  else if(action==='selectFrame')selectFileFrame(value);
  else if(action==='renameFrame'&&fileFrames.has(Number(value)))vscode.postMessage({type:'imageAction',action:'rename',frameId:Number(value)});
  else if(action==='duplicateFrame'&&fileFrames.has(Number(value)))vscode.postMessage({type:'cloneFrame',frameId:Number(value)});
  else if(action==='closeFrame')closeFileFrame(value);
  else if(action==='previousFrame')moveFileFrame(-1);
  else if(action==='nextFrame')moveFileFrame(1);
  else if(['moveFrameUp','moveFrameDown','moveFrameFirst','moveFrameLast'].includes(action))reorderFileFrame(action.replace('moveFrame','').toLowerCase());
  else if(action==='moveFrameAt')reorderFrameAt(value?.id,value?.position);
  else if(action==='tile')$('tile').click();
  else if(action==='blink')$('blink').click();
  else if(action==='columns'||action==='rows'){if(action==='columns')layoutColumns=Math.max(0,Math.min(16,Number(value)||0));else layoutRows=Math.max(0,Math.min(16,Number(value)||0));frameList();draw();}
  else if(action==='reorderFrame')reorderFrame(Number(value.from),Number(value.to));
  else if(action==='frameVisible')setFrameVisible(Number(value.id),!!value.visible);
  else if(action==='frameLockMember')setFrameLockMember(Number(value.id),!!value.enabled);
  else if(action==='lock')setFrameLock(value.group,!!value.enabled);
  else if(action==='lockAll'){for(const id of fileFrames.keys())setFrameLockMember(id,true);}
  else if(action==='unlockAll'){for(const state of fileFrames.values())state.lockMember=false;frameList();if(tileMode)scheduleTileRefresh(0);}
  else if(action==='toggleBC'){transferVisible=!transferVisible;$('transferPanel').hidden=!transferVisible;publishSidebar();}
  else if(action==='autoCuts')applyAutoCuts(value?.mode||'percentile');
  else if(action==='stackAutoCuts')applyStackAutoCuts(value?.mode||'percentile');
  else if(action==='adjust'){
    for(const key of ['low','high','stretch','cmap'])$(key).value=value[key];
    $('invert').checked=!!value.invert;if('threshold' in value)$('threshold').checked=!!value.threshold;
    if(value.cuts!=='manual'){applyAutoCuts(value.cuts);return;}
    $('cuts').value='manual';
    drawTransferCurve();commitFrameChange('bc');scheduleRender(0);publishSidebar();
  }
}
function stopBlink(){blinking=false;clearTimeout(blinkTimer);$('blink').classList.remove('selected');}
function blinkStep(){if(!blinking||visibleFrameIds().length<2)return;moveFileFrame(1);blinkTimer=setTimeout(blinkStep,1000/Math.max(1,Math.min(60,Number($('fps').value)||defaultFps)));}
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
  vscode.postMessage({type:'transformFrame',fileFrame:activeFileFrame,action,args:{dataset:dataset.id,frame:Number($('frame').value)-1,box,action,value,selection:selection?cloneSelection(selection):undefined,displayLow:Number($('low').value),displayHigh:Number($('high').value)}});
}
function deriveNewFrame(action,label,value){
  vscode.postMessage({type:'deriveNewFrame',fileFrame:activeFileFrame,label,args:{dataset:dataset.id,frame:Number($('frame').value)-1,box:[0,0,dataset.width,dataset.height],action,value,displayLow:Number($('low').value),displayHigh:Number($('high').value)}});
}
function transformViewFrames(action,extra={}){
  saveFileFrame();
  const active=fileFrames.get(activeFileFrame),locked=frameLocks.has('view')&&active?.lockMember;
  for(const [id,state] of fileFrames){
    if(id!==activeFileFrame&&(!locked||!state.lockMember))continue;
    const d=state.metadata.datasets.find(item=>item.id===(state.datasetId??state.metadata.datasets[0].id));
    if(!d)continue;
    vscode.postMessage({type:'transformFrame',fileFrame:id,action,args:{dataset:d.id,frame:Math.max(0,Math.min(d.frames-1,(state.plane||1)-1)),...extra}});
  }
}
for(const [id,action] of [['flipHorizontal','flipHorizontal'],['flipVertical','flipVertical'],['rotateLeft','rotateLeft'],['rotateRight','rotateRight'],['rotate180','rotate180']])$(id).onclick=()=>transformViewFrames(action);
function openRotateDialog(){
  if(!dataset)return;
  document.querySelector('[data-dialog="rotate-arbitrary"]')?.remove();
  const dialog=openDialog('rotate-arbitrary','Rotate',`<label>Angle (degrees) <input class="rotate-angle" type="number" min="-3600" max="3600" step="0.1" value="15"></label><input class="rotate-slider" type="range" min="-180" max="180" step="0.1" value="15" aria-label="Rotation angle"><label>Grid lines <input class="rotate-grid" type="number" min="0" max="20" value="3"></label><label>Interpolation <select class="rotate-interpolation"><option value="nearest">None</option><option value="bilinear" selected>Bilinear</option><option value="bicubic">Bicubic</option></select></label><label><input class="rotate-background" type="checkbox"> Fill with background color</label><label><input class="rotate-enlarge" type="checkbox"> Enlarge image to fit result</label><label><input class="rotate-live" type="checkbox" checked> Preview</label><canvas class="rotate-preview" width="240" height="180" aria-label="Rotation preview"></canvas><div class="roi-dialog-error" role="alert"></div><div class="dialog-actions"><button class="rotate-cancel">Cancel</button><button class="rotate-run">Apply</button></div>`);
  const angle=dialog.querySelector('.rotate-angle'),slider=dialog.querySelector('.rotate-slider'),previewCanvas=dialog.querySelector('.rotate-preview'),g=previewCanvas.getContext('2d');
  function previewRotation(){
    g.fillStyle='#161b22';g.fillRect(0,0,240,180);
    if(!dialog.querySelector('.rotate-live').checked)return;
    const source=frameCache.get(cacheKey(Number($('frame').value)-1,fullBox()))?.image||preview||canvas;
    if(!source)return;
    const fit=Math.min(200/source.width,140/source.height),w=source.width*fit,h=source.height*fit;
    g.save();g.translate(120,90);g.rotate(Number(angle.value)*Math.PI/180);g.imageSmoothingEnabled=dialog.querySelector('.rotate-interpolation').value!=='nearest';g.drawImage(source,-w/2,-h/2,w,h);g.restore();
    const count=Math.max(0,Math.min(20,Number(dialog.querySelector('.rotate-grid').value)||0));if(count){g.strokeStyle='#f4cf6599';g.lineWidth=1;for(let i=1;i<=count;i++){const x=i*240/(count+1),y=i*180/(count+1);g.beginPath();g.moveTo(x,0);g.lineTo(x,180);g.moveTo(0,y);g.lineTo(240,y);g.stroke();}}
  }
  angle.oninput=()=>{slider.value=String(Math.max(-180,Math.min(180,Number(angle.value)||0)));previewRotation();};slider.oninput=()=>{angle.value=slider.value;previewRotation();};
  for(const element of dialog.querySelectorAll('.rotate-grid,.rotate-interpolation,.rotate-background,.rotate-enlarge,.rotate-live'))element.oninput=previewRotation;
  dialog.querySelector('.rotate-cancel').onclick=()=>dialog.remove();
  dialog.querySelector('.rotate-run').onclick=()=>{const value=Number(angle.value);if(!Number.isFinite(value)||Math.abs(value)>3600){dialog.querySelector('.roi-dialog-error').textContent='Enter an angle within ±3600°.';return;}transformViewFrames('rotate',{angle:value,interpolation:dialog.querySelector('.rotate-interpolation').value,fillBackground:dialog.querySelector('.rotate-background').checked,enlarge:dialog.querySelector('.rotate-enlarge').checked});dialog.remove();};
  previewRotation();
}
$('rotateArbitrary').onclick=openRotateDialog;
for(const [target,source] of [['toolMontage','montage'],['toolOrthogonal','stackOrthogonal'],['toolHistogram','histogram'],['toolMeasure','measure'],['toolFlipHorizontal','flipHorizontal'],['toolFlipVertical','flipVertical'],['toolRotateLeft','rotateLeft'],['toolRotateRight','rotateRight']])$(target).onclick=()=>$(source).click();
for(const [id,action,label] of [['imageCrop','crop','Crop'],['type8','to8','8-bit'],['type16','to16','16-bit'],['type32','to32','32-bit'],['typeRgb','toRgb','RGB Color'],['processNormalize','normalize','Normalize'],['processSmooth','smooth','Smooth'],['processSharpen','sharpen','Sharpen'],['processEdges','findEdges','Find Edges'],['processErode','binaryErode','Erode'],['processDilate','binaryDilate','Dilate'],['processOpen','binaryOpen','Open'],['processClose','binaryClose','Close'],['processFft','fftPower','FFT'],['mathInvert','invertPixels','Invert'],['mathSqrt','sqrt','Square Root'],['mathSquare','square','Square'],['mathLog','log','Log'],['mathAsinh','asinh','Asinh'],['mathSinh','sinh','Sinh'],['mathExp','exp','Exp'],['mathAbs','abs','Abs'],['mathHisteq','histeq','Histogram Equalization']])$(id).onclick=()=>derive(action,label);
$('mathPower').onclick=()=>{
  document.querySelector('[data-dialog="math-power"]')?.remove();
  const dialog=openDialog('math-power','Power',`<label>Exponent <input class="math-power-value" type="number" min="-100" max="100" step="any" value="2"></label><div class="roi-dialog-error" role="alert"></div><div class="dialog-actions"><button class="math-power-cancel">Cancel</button><button class="math-power-run">Apply</button></div>`);
  dialog.querySelector('.math-power-cancel').onclick=()=>dialog.remove();
  dialog.querySelector('.math-power-run').onclick=()=>{const value=Number(dialog.querySelector('.math-power-value').value);if(!Number.isFinite(value)||value < -100||value > 100){dialog.querySelector('.roi-dialog-error').textContent='Exponent must be between -100 and 100.';return;}derive('power','Power',value);dialog.remove();};
};
$('imageInfo').onclick=()=>openDialog('info','Image Info',`<pre>${escapeHtml(metadata.path)}\n${dataset.width} × ${dataset.height} · ${escapeHtml(dataset.dtype)}\n${escapeHtml(dataset.shape.join(' × '))} · ${escapeHtml(dataset.targetExpression||dataset.axes||'h w')}\nDisplay: ${$('low').value} … ${$('high').value}</pre>`);
$('imageScale').onclick=()=>{
  document.querySelector('[data-dialog="scale"]')?.remove();
  const dialog=openDialog('scale','Scale',`<label>Scale factor <input class="scale-factor" type="number" min="0.001" max="32" step="any" value="1"></label><div class="dialog-actions"><button class="scale-cancel">Cancel</button><button class="scale-run">Apply</button></div>`);
  dialog.querySelector('.scale-cancel').onclick=()=>dialog.remove();
  dialog.querySelector('.scale-run').onclick=()=>{const factor=Number(dialog.querySelector('.scale-factor').value);if(!Number.isFinite(factor)||factor<=0||factor>32){showError(new Error('Scale factor must be between 0 and 32.'));return;}derive('resize','Scale',factor);dialog.remove();};
};
$('processBinary').onclick=()=>{
  document.querySelector('[data-dialog="binary"]')?.remove();
  const dialog=openDialog('binary','Make Binary',`<label>Threshold <input class="binary-threshold" type="number" step="any" value="${Number($('low').value)||0}"></label><div class="dialog-actions"><button class="binary-cancel">Cancel</button><button class="binary-run">Apply</button></div>`);
  dialog.querySelector('.binary-cancel').onclick=()=>dialog.remove();
  dialog.querySelector('.binary-run').onclick=()=>{const value=Number(dialog.querySelector('.binary-threshold').value);if(!Number.isFinite(value)){showError(new Error('Enter a finite threshold.'));return;}derive('thresholdBinary','Binary',value);dialog.remove();};
};
for(const [id,action,label] of [['shadowNorth','shadowNorth','Shadows North'],['shadowSouth','shadowSouth','Shadows South'],['shadowEast','shadowEast','Shadows East'],['shadowWest','shadowWest','Shadows West'],['processFillHoles','binaryFillHoles','Fill Holes'],['processSkeletonize','binarySkeleton','Skeletonize']])$(id).onclick=()=>derive(action,label);
$('processWatershed').onclick=()=>derive('binaryWatershed','Watershed');
$('analyzeSkeleton').onclick=()=>derive('binarySkeleton','Skeleton');
for(const [id,action,label,field,initial,min,max] of [
  ['processMaxima','findMaxima','Find Maxima','Noise tolerance',0,0,1e6],
  ['filterMean','mean','Mean','Radius (px)',1,1,20],['filterMin','minimum','Minimum','Radius (px)',1,1,20],
  ['filterMax','maximum','Maximum','Radius (px)',1,1,20],['filterVariance','variance','Variance','Radius (px)',1,1,20],
  ['processNoise','noiseGaussian','Add Noise','Standard deviation',25,0,1e6],
  ['processSaltPepper','saltPepper','Salt and Pepper','Pixel fraction',0.05,0,1],
  ['processBandpass','fftBandpass','FFT Bandpass','Low frequency cutoff',0.05,0,0.5]])$(id).onclick=()=>{
    document.querySelector('[data-dialog="process-number"]')?.remove();
    const dialog=openDialog('process-number',label,`<label>${field} <input class="process-value" type="number" step="any" min="${min}" max="${max}" value="${initial}"></label><div class="dialog-actions"><button class="process-cancel">Cancel</button><button class="process-run">Apply</button></div>`);
    dialog.querySelector('.process-cancel').onclick=()=>dialog.remove();
    dialog.querySelector('.process-run').onclick=()=>{const value=Number(dialog.querySelector('.process-value').value);if(!Number.isFinite(value)||value<min||value>max){showError(new Error(`${field} must be between ${min} and ${max}.`));return;}derive(action,label,value);dialog.remove();};
  };
$('processSpecifiedNoise').onclick=()=>$('processNoise').click();
$('processRemoveOutliers').onclick=()=>{
  const dialog=openDialog('remove-outliers','Remove Outliers',`<label>Radius <input class="outlier-radius" type="number" min="1" max="20" step="1" value="2"></label><label>Threshold <input class="outlier-threshold" type="number" min="0" step="any" value="50"></label><label>Which <select class="outlier-which"><option value="bright">Bright</option><option value="dark">Dark</option></select></label><div class="roi-dialog-error" role="alert"></div><div class="dialog-actions"><button class="outlier-cancel">Cancel</button><button class="outlier-run">Apply</button></div>`);
  dialog.querySelector('.outlier-cancel').onclick=()=>dialog.remove();dialog.querySelector('.outlier-run').onclick=()=>{const radius=Number(dialog.querySelector('.outlier-radius').value),threshold=Number(dialog.querySelector('.outlier-threshold').value);if(!Number.isInteger(radius)||radius<1||radius>20||!Number.isFinite(threshold)||threshold<0){dialog.querySelector('.roi-dialog-error').textContent='Check radius and threshold.';return;}vscode.postMessage({type:'transformFrame',fileFrame:activeFileFrame,action:'removeOutliers',args:{...base(),radius,threshold,which:dialog.querySelector('.outlier-which').value}});dialog.remove();};
};
$('filterConvolve').onclick=()=>{
  const dialog=openDialog('convolve','Convolve',`<label class="roi-points-label">Kernel<textarea class="convolve-kernel roi-points" rows="5">0 -1 0\n-1 5 -1\n0 -1 0</textarea></label><label><input class="convolve-normalize" type="checkbox"> Normalize kernel</label><div class="roi-dialog-error" role="alert"></div><div class="dialog-actions"><button class="convolve-cancel">Cancel</button><button class="convolve-run">Apply</button></div>`);
  dialog.querySelector('.convolve-cancel').onclick=()=>dialog.remove();dialog.querySelector('.convolve-run').onclick=()=>{const text=dialog.querySelector('.convolve-kernel').value.trim(),rows=text.split(/\n+/).map(row=>row.trim().split(/[\s,]+/).map(Number));if(!rows.length||rows.some(row=>row.length!==rows.length||row.some(value=>!Number.isFinite(value)))||rows.length%2!==1||rows.length>15){dialog.querySelector('.roi-dialog-error').textContent='Enter an odd square kernel up to 15×15.';return;}vscode.postMessage({type:'transformFrame',fileFrame:activeFileFrame,action:'convolve',args:{...base(),kernel:rows.flat(),normalize:dialog.querySelector('.convolve-normalize').checked}});dialog.remove();};
};
for(const [id,action,label] of [['mathAdd','add','Add'],['mathSubtract','subtract','Subtract'],['mathMultiply','multiply','Multiply'],['mathDivide','divide','Divide']])$(id).onclick=()=>{
  document.querySelector('[data-dialog="math"]')?.remove();
  const dialog=openDialog('math',label,`<label>Value <input class="math-value" type="number" step="any" value="1"></label><div class="dialog-actions"><button class="math-cancel">Cancel</button><button class="math-run">Apply</button></div>`);
  dialog.querySelector('.math-cancel').onclick=()=>dialog.remove();
  dialog.querySelector('.math-run').onclick=()=>{const value=Number(dialog.querySelector('.math-value').value);if(!Number.isFinite(value)){showError(new Error('Enter a finite number.'));return;}derive(action,label,value);dialog.remove();};
};
for(const [id,action,label] of [['filterGaussian','gaussian','Gaussian Blur'],['filterMedian','median','Median'],['filterUnsharp','unsharp','Unsharp Mask']])$(id).onclick=()=>{
  document.querySelector('[data-dialog="filter"]')?.remove();
  const dialog=openDialog('filter',label,`<label>${action==='median'?'Radius (1 or 2)':'Sigma'} (px) <input class="filter-radius" type="number" step="${action==='median'?'1':'any'}" min="${action==='median'?'1':'0.1'}" max="${action==='median'?'2':'20'}" value="1"></label><div class="roi-dialog-error" role="alert"></div><div class="dialog-actions"><button class="filter-cancel">Cancel</button><button class="filter-run">Apply</button></div>`);
  dialog.querySelector('.filter-cancel').onclick=()=>dialog.remove();
  dialog.querySelector('.filter-run').onclick=()=>{const value=Number(dialog.querySelector('.filter-radius').value);if(!Number.isFinite(value)||value<=0||value>(action==='median'?2:20)||(action==='median'&&!Number.isInteger(value))){dialog.querySelector('.roi-dialog-error').textContent=action==='median'?'Enter radius 1 or 2.':'Enter a value between 0 and 20 pixels.';return;}derive(action,label,value);dialog.remove();};
};
$('zProject').onclick=()=>{
  if(!dataset||dataset.frames<2){showError(new Error('Z Project requires a stack.'));return;}
  document.querySelector('[data-dialog="z-project"]')?.remove();
  const dialog=openDialog('z-project','Z Project',`<label>Projection <select class="z-method"><option value="zMax">Max Intensity</option><option value="zMean">Average Intensity</option><option value="zMin">Min Intensity</option></select></label><div class="dialog-actions"><button class="z-cancel">Cancel</button><button class="z-create">Apply</button></div>`);
  dialog.querySelector('.z-cancel').onclick=()=>dialog.remove();
  dialog.querySelector('.z-create').onclick=()=>{derive(dialog.querySelector('.z-method').value,'Z Project');dialog.remove();};
};
$('thresholdMenu').onclick=()=>{$('threshold').checked=true;$('cuts').value='manual';commitFrameChange('bc');scheduleRender(0);openBCDialog();};
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
  const defaultColumns=Math.max(1,Math.round(Math.sqrt(dataset.frames)));
  const dialog=openDialog('montage','Make Montage',`<label>First slice <input class="montage-start" type="number" min="1" value="1"></label><label>Last slice <input class="montage-end" type="number" min="1"></label><label>Columns <input class="montage-columns" type="number" min="1" max="32" value="${defaultColumns}"></label><label>Scale (%) <input class="montage-scale" type="number" min="1" max="400" step="any" value="100"></label><div class="roi-dialog-error" role="alert"></div><div class="dialog-actions"><button class="montage-create">Create Frame</button></div>`);
  dialog.querySelector('.montage-end').value=dataset.frames;
  dialog.querySelector('.montage-create').onclick=()=>{
    const args={dataset:dataset.id,start:Number(dialog.querySelector('.montage-start').value),end:Number(dialog.querySelector('.montage-end').value),columns:Number(dialog.querySelector('.montage-columns').value),scalePercent:Number(dialog.querySelector('.montage-scale').value)};
    if(!Number.isInteger(args.start)||!Number.isInteger(args.end)||args.start<1||args.end>dataset.frames||args.end<args.start||!Number.isInteger(args.columns)||args.columns<1||args.columns>32||!Number.isFinite(args.scalePercent)||args.scalePercent<1||args.scalePercent>400){dialog.querySelector('.roi-dialog-error').textContent='Check slice range, columns (1–32), and scale (1–400%).';return;}
    vscode.postMessage({type:'montage',fileFrame:activeFileFrame,args});dialog.remove();
  };
}
$('openBC').onclick=openBCDialog;
$('autoCuts').onclick=()=>applyAutoCuts('percentile');
$('resetCuts').onclick=()=>applyAutoCuts('minmax');
$('montage').onclick=openMontageDialog;
function stackRangeFields(){return `<label>First slice <input class="stack-first" type="number" min="1" max="${dataset.frames}" value="1"></label><label>Last slice <input class="stack-last" type="number" min="1" max="${dataset.frames}" value="${dataset.frames}"></label>`;}
function stackRange(dialog){const start=Number(dialog.querySelector('.stack-first').value),end=Number(dialog.querySelector('.stack-last').value);if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>dataset.frames||end<start)throw new Error(`Choose slices between 1 and ${dataset.frames}.`);return {start,end};}
function runStackImage(action,args={}){vscode.postMessage({type:'stack',fileFrame:activeFileFrame,args:{action,dataset:dataset?.id,...args}});}
async function runStackAnalysis(action,args,title){
  try{
    const result=await request('stack',{action,dataset:dataset.id,stretch:$('stretch').value,...args});
    document.querySelector(`[data-dialog="stack-${action}"]`)?.remove();
    const dialog=openDialog(`stack-${action}`,title,`<canvas class="stack-plot interactive-plot" width="520" height="190" hidden></canvas><div class="plot-readout"></div><div class="stack-result stats-content"></div>`),plot=dialog.querySelector('.stack-plot'),content=dialog.querySelector('.stack-result');dialog.classList.add('statistics-dialog');if(action==='zAxisProfile')dialog.classList.add('plot-dialog');
    const table=(headers,rows)=>`<div class="stats-scroll"><table class="stats-table"><thead><tr>${headers.map(value=>`<th>${value}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(value=>`<td>${value}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    if(action==='zAxisProfile'){
      plot.hidden=false;const values=result.values||[],finite=values.filter(Number.isFinite),min=Math.min(...finite),max=Math.max(...finite);interactivePlot(plot,values,result.frames,dialog.querySelector('.plot-readout'));content.innerHTML=table(['Slice','Value'],values.map((value,index)=>[result.frames[index],formatValue(value)]));content.insertAdjacentHTML('afterbegin',`<div class="stats-list"><span>X</span><span>${formatValue(result.x)}</span><span>Y</span><span>${formatValue(result.y)}</span><span>Minimum</span><span>${formatValue(min)}</span><span>Maximum</span><span>${formatValue(max)}</span></div>`);
    }else if(action==='measureStack')content.innerHTML=table(['Slice','Count','Mean','StdDev','Min','Max'],(result.results||[]).map((row,index)=>[row.frame!=null?row.frame+1:index+1,formatValue(row.count),formatValue(row.mean),formatValue(row.std),formatValue(row.min),formatValue(row.max)]));
    else content.innerHTML=`<div class="stats-list">${Object.entries(result).map(([key,value])=>`<span>${key}</span><span>${Array.isArray(value)?value.map(item=>typeof item==='number'?formatValue(item):item).join(', '):typeof value==='number'?formatValue(value):value}</span>`).join('')}</div>`;
  }catch(error){showError(error);}
}
function stackDialog(action,title,extra='',analysis=false){if(!dataset||dataset.frames<2){showError(new Error(`${title} requires a stack.`));return;}document.querySelector(`[data-dialog="stack-${action}-options"]`)?.remove();const lineReslice=action==='reslice'&&selection?.type==='line'&&selection.points.length>=2;if(action==='reslice'&&selection&&!lineReslice){showError(new Error('Reslice requires a line selection.'));return;}const lineInfo=lineReslice?`<div class="dialog-note">Along selected line · ${selection.points.length} point${selection.points.length===1?'':'s'}</div>`:extra;const dialog=openDialog(`stack-${action}-options`,title,stackRangeFields()+lineInfo+'<div class="roi-dialog-error" role="alert"></div><div class="dialog-actions"><button class="stack-cancel">Cancel</button><button class="stack-run">Run</button></div>');dialog.querySelector('.stack-cancel').onclick=()=>dialog.remove();dialog.querySelector('.stack-run').onclick=()=>{try{const args=stackRange(dialog);if(action==='reslice'){if(lineReslice)args.points=cloneSelection(selection).points;else{args.axis=dialog.querySelector('.stack-axis').value;args.position=Number(dialog.querySelector('.stack-position').value);}}if(action==='zAxisProfile'){args.x=Number(dialog.querySelector('.stack-x').value);args.y=Number(dialog.querySelector('.stack-y').value);}if(['measureStack','statistics'].includes(action)){args.box=roi||undefined;args.selection=selection||undefined;}if(analysis)runStackAnalysis(action,args,title);else runStackImage(action,args);dialog.remove();}catch(error){dialog.querySelector('.roi-dialog-error').textContent=error.message;}};}
if($('stackImagesToStack'))$('stackImagesToStack').onclick=()=>runStackImage('imagesToStack');
if($('importSequence'))$('importSequence').onclick=()=>vscode.postMessage({type:'importSequence'});
if($('stackToImages'))$('stackToImages').onclick=()=>stackDialog('stackToImages','Stack to Images');
if($('stackReslice'))$('stackReslice').onclick=()=>{if(!selection||selection.type!=='line'){showError(new Error('Draw a straight, segmented, or freehand line before Reslice.'));return;}stackDialog('reslice','Reslice');};
if($('stackZProfile'))$('stackZProfile').onclick=()=>stackDialog('zAxisProfile','Plot Z-axis Profile',`<label>X <input class="stack-x" type="number" min="0" max="${dataset?.width||1}" value="${Math.floor((dataset?.width||2)/2)}"></label><label>Y <input class="stack-y" type="number" min="0" max="${dataset?.height||1}" value="${Math.floor((dataset?.height||2)/2)}"></label>`,true);
if($('stackMeasure'))$('stackMeasure').onclick=()=>stackDialog('measureStack','Measure Stack','',true);
if($('stackStatistics'))$('stackStatistics').onclick=()=>stackDialog('statistics','Stack Statistics','',true);
if($('processFftNative'))$('processFftNative').onclick=()=>derive('fftPowerImageJ','FFT (ImageJ padded)');
if($('processEqualize'))$('processEqualize').onclick=()=>derive('equalizeHistogram','Equalize Histogram');
if($('editUndo'))$('editUndo').onclick=()=>vscode.postMessage({type:'transformFrame',fileFrame:activeFileFrame,action:'undo',args:base()});
if($('editRedo'))$('editRedo').onclick=()=>vscode.postMessage({type:'transformFrame',fileFrame:activeFileFrame,action:'redo',args:base()});
if($('viewerDataset'))$('viewerDataset').onchange=()=>{$('dataset').value=$('viewerDataset').value;selectDataset();};
$('viewerAxis').onchange=()=>{sliceAxis=Number($('viewerAxis').value);resetAutoThresholds();if(orthogonal){orthogonal.axis=sliceAxis;orthogonal.depth=dataset.shape[sliceAxis];orthogonal.sectionKey='';}frameLabel();saveFileFrame();};
$('stackOrthogonal').onclick=toggleOrthogonal;
if($('viewerSliceRange'))$('viewerSliceRange').oninput=()=>{setAxisSlice(Number($('viewerSliceRange').value));$('frame').onchange();};
if($('viewerSliceNumber'))$('viewerSliceNumber').onchange=()=>{setAxisSlice(Number($('viewerSliceNumber').value));$('frame').onchange();};
function stopSliceHold(){clearTimeout(sliceHoldTimer);clearInterval(sliceRepeatTimer);sliceHoldTimer=null;sliceRepeatTimer=null;}
for(const [id,delta] of [['viewerSlicePrev',-1],['viewerSliceNext',1]]){
  const button=$(id);
  let suppressClick=false,repeated=false,pressActive=false;
  button.onpointerdown=event=>{
    if(event.button!==0||button.disabled)return;
    event.preventDefault();suppressClick=true;repeated=false;pressActive=true;stopSliceHold();stopPlay();
    button.setPointerCapture(event.pointerId);
    const interval=1000/Math.max(1,Math.min(60,Number($('fps').value)||defaultFps));
    sliceHoldTimer=setTimeout(()=>{repeated=true;changeFrame(delta,true);sliceRepeatTimer=setInterval(()=>changeFrame(delta,true),interval);},300);
  };
  button.onpointerup=()=>{const shortPress=pressActive&&!repeated;pressActive=false;stopSliceHold();if(shortPress)changeFrame(delta);setTimeout(()=>{suppressClick=false;},0);};
  button.onpointercancel=()=>{pressActive=false;stopSliceHold();suppressClick=false;};
  button.onlostpointercapture=()=>{pressActive=false;stopSliceHold();};
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
  if(gallery){const apply=document.createElement('button');apply.textContent='Apply to Frame';dialog.querySelector('.dialog-body').append(apply);apply.onclick=()=>{$('cmap').value=choice.value;commitFrameChange('bc');scheduleRender(0);};}
}
if($('colorShowLut'))$('colorShowLut').onclick=()=>showLutDialog(false);
if($('colorDisplayLuts'))$('colorDisplayLuts').onclick=()=>showLutDialog(true);
if($('colorInvertLuts'))$('colorInvertLuts').onclick=()=>{$('invert').checked=!$('invert').checked;commitFrameChange('bc');scheduleRender(0);};
if($('colorSplitChannels'))$('colorSplitChannels').onclick=()=>{if(dataset.channel==null&&!(dataset.shape?.at(-1)===3)){showError(new Error('Split Channels requires an RGB image.'));return;}for(const [action,label] of [['channelRed','Red channel'],['channelGreen','Green channel'],['channelBlue','Blue channel']])deriveNewFrame(action,label);};
function openStackChannels(title='Stack to RGB'){
  if(dataset.frames<3){showError(new Error(`${title} requires at least three slices.`));return;}
  const dialog=openDialog('stack-channels',title,`<label>Red slice <input class="channel-r" type="number" min="1" max="${dataset.frames}" value="1"></label><label>Green slice <input class="channel-g" type="number" min="1" max="${dataset.frames}" value="2"></label><label>Blue slice <input class="channel-b" type="number" min="1" max="${dataset.frames}" value="3"></label><div class="roi-dialog-error" role="alert"></div><div class="dialog-actions"><button class="channels-cancel">Cancel</button><button class="channels-run">Apply</button></div>`);
  dialog.querySelector('.channels-cancel').onclick=()=>dialog.remove();dialog.querySelector('.channels-run').onclick=()=>{const channelFrames=['r','g','b'].map(name=>Number(dialog.querySelector(`.channel-${name}`).value));if(channelFrames.some(value=>!Number.isInteger(value)||value<1||value>dataset.frames)){dialog.querySelector('.roi-dialog-error').textContent='Choose three valid slice numbers.';return;}vscode.postMessage({type:'transformFrame',fileFrame:activeFileFrame,action:'stackToRgb',args:{...base(),channelFrames}});dialog.remove();};
}
$('colorStackToRgb').onclick=()=>openStackChannels('Stack to RGB');$('colorMakeComposite').onclick=()=>openStackChannels('Make Composite');$('colorChannelsTool').onclick=()=>openStackChannels('Channels Tool');
$('colorMergeChannels').onclick=()=>{
  const choices=[...fileFrames].map(([id,state])=>`<option value="${id}">${escapeHtml(state.metadata.label||state.metadata.path.split(/[\\/]/).pop())}</option>`).join('');
  if(fileFrames.size<2){showError(new Error('Open at least two Frames to merge channels.'));return;}
  const dialog=openDialog('merge-channels','Merge Channels',`<label>Red <select class="merge-r">${choices}</select></label><label>Green <select class="merge-g">${choices}</select></label><label>Blue <select class="merge-b"><option value="">None</option>${choices}</select></label><div class="dialog-actions"><button class="merge-cancel">Cancel</button><button class="merge-run">Apply</button></div>`);
  const ids=[...fileFrames.keys()];dialog.querySelector('.merge-r').value=ids[0];dialog.querySelector('.merge-g').value=ids[1];dialog.querySelector('.merge-cancel').onclick=()=>dialog.remove();dialog.querySelector('.merge-run').onclick=()=>{const channelFrameIds=['r','g','b'].map(name=>dialog.querySelector(`.merge-${name}`).value).filter(Boolean).map(Number);vscode.postMessage({type:'transformFrame',fileFrame:activeFileFrame,action:'mergeChannels',args:{...base(),channelFrameIds}});dialog.remove();};
};
function shortcutMatches(binding,event){
  if(!binding)return false;
  const parts=String(binding).toLowerCase().split('+').map(part=>part.trim()),key=parts.pop(),modifiers=new Set(parts);
  return event.key.toLowerCase()===key&&event.ctrlKey===(modifiers.has('ctrl')||modifiers.has('control'))&&event.metaKey===(modifiers.has('cmd')||modifiers.has('meta'))&&event.altKey===(modifiers.has('alt')||modifiers.has('option'))&&event.shiftKey===modifiers.has('shift');
}
document.addEventListener('keydown',e=>{
  const action=Object.entries(keyboardShortcuts).find(([,binding])=>shortcutMatches(binding,e))?.[0];
  if(e.target.closest?.('input,select,textarea,[contenteditable="true"]'))return;
  if(e.code==='Space'&&orthogonal){spaceHeld=true;e.preventDefault();return;}
  if(!action)return;
  e.preventDefault();
  runShortcut(action);
});
document.addEventListener('keyup',e=>{if(e.code==='Space')spaceHeld=false;});
new ResizeObserver(()=>{if(dataset)scheduleRender(80);}).observe($('stage'));
document.addEventListener('visibilitychange',()=>{if(document.hidden){spaceHeld=false;stopPlay();stopSliceHold();}});
window.addEventListener('message',({data:m})=>{
  if(m.type==='frameAdded'){
    if(m.menuVisibility)applyMenuVisibility(m.menuVisibility);
    if(m.keyboardShortcuts)keyboardShortcuts={...keyboardShortcuts,...m.keyboardShortcuts};
    if(m.mouseShortcuts)mouseShortcuts={...mouseShortcuts,...m.mouseShortcuts};
    if(fileFrames.size===0){defaultFps=Math.max(1,Math.min(60,Number(m.defaultFps)||24));$('fps').value=defaultFps;$('viewerSliceFps').value=defaultFps;}
    if($('editUndo'))$('editUndo').disabled=!m.canUndo;
    if($('editRedo'))$('editRedo').disabled=!m.canRedo;
  fileFrames.set(m.frameId,{metadata:m,flipState:m.flipState});selectFileFrame(m.frameId);
    setTool('pan');
    if(m.initialSelection){selection=m.initialSelection;refreshSelection();saveFileFrame();}
  }else if(m.type==='frameUpdated'){
    if(orthogonal&&m.frameId===activeFileFrame)disableOrthogonal();
    if($('editUndo'))$('editUndo').disabled=!m.canUndo;
    if($('editRedo'))$('editRedo').disabled=!m.canRedo;
    const state=fileFrames.get(m.frameId);if(!state)return;state.orthogonalState=null;
    state.flipState=m.flipState||state.flipState;
    const oldDataset=state.metadata.datasets.find(item=>item.id===(state.datasetId??state.metadata.datasets[0].id));
    const retained=transformCachedState(m.frameId,state,m.displayTransform,oldDataset);
    state.metadata={...state.metadata,...m};for(const key of transferHistograms.keys())if(key.startsWith(`${m.frameId}:`))transferHistograms.delete(key);
    if(!retained){state.preview=null;state.tilePreview=null;state.previewBox=null;state.frameCache=new Map();state.cacheSignature='';state.cacheBytes=0;state.tileSignature='';}
    state.plane=Math.min(state.plane||1,state.metadata.datasets[0].frames);
    if(m.frameId===activeFileFrame){activeFileFrame=null;selectFileFrame(m.frameId);}else{frameList();scheduleTileRefresh(0);}
    if(retained)scheduleCachedRecolor(m.frameId,state);
  }else if(m.type==='transformBusy'){
    transformsRunning=Math.max(0,transformsRunning+(m.busy?1:-1));const notice=$('transformStatus');notice.hidden=transformsRunning===0;notice.textContent=transformsRunning?`Processing ${m.action.replace(/([A-Z])/g,' $1').toLowerCase()}…`:'';
  }else if(m.type==='menuVisibility'){
    applyMenuVisibility(m.items);
  }else if(m.type==='shortcutSettings'){
    keyboardShortcuts={...keyboardShortcuts,...m.keyboardShortcuts};updateShortcutTips();
  }else if(m.type==='sideAction'){
    applySidebarAction(m.action,m.value);
  }else if(m.type==='frameRenamed'){
    const state=fileFrames.get(m.frameId);if(state){state.metadata={...state.metadata,...m};if(m.frameId===activeFileFrame){metadata=state.metadata;$('filename').textContent=metadata.label;$('filename').title=metadata.path;}frameList();draw();}
  }else if(m.type==='memoryInfo'){
    const mib=n=>formatValue(n/1048576);const dialog=openDialog('memory','Monitor Memory',`<pre>Extension host RSS: ${mib(m.host.rss)} MiB\nHost free: ${mib(m.free)} / ${mib(m.total)} MiB\nCurrent preview cache: ${mib(cacheBytes)} MiB\nImage Frames: ${fileFrames.size}</pre>`);dialog.hidden=false;
  }else if(m.type==='stream'){
    const p=pending.get(m.id);if(p?.onStream)p.onStream(m);
  }else if(m.type==='result'||m.type==='error'){
    const p=pending.get(m.id);if(p){pending.delete(m.id);m.type==='error'?p.reject(new Error(m.message)):p.resolve(m.result);}else if(m.type==='error')showError(new Error(m.message));
  }
});
vscode.postMessage({type:'ready'});
