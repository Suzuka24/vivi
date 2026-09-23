'use strict';
const vscode = acquireVsCodeApi();
const $ = id => document.getElementById(id);
const labels = { open: 'Open', openAs:'Open As…', openNewTab: 'Open in New Tab', openStack: 'Open Folder as Stack…', copyPath: 'Copy Path', copyToTerminal: 'Insert Path into Terminal', copyName: 'Copy Name', rename: 'Rename…', delete: 'Remove Permanently…', newFile: 'New File…', newFolder: 'New Folder…', refresh: 'Refresh' };
const sorts = [['nameAsc','Name A–Z'],['nameDesc','Name Z–A'],['sizeAsc','Size: small first'],['sizeDesc','Size: large first'],['dateDesc','Modified: newest first'],['dateAsc','Modified: oldest first']];
let current = '', parent = '', offset = 0, entries = [], menuItems = [], history = [], selectedPath = '', sortMode = 'nameAsc', showHidden = true, more = false, loading = false;
const selectedChildByFolder = new Map();
let layoutState = null, heldSlice = null, errorUntil = 0, errorTimer;
let adjustSource = null;
let openAsPath='';
const setiTheme=window.ViviSetiTheme||{};
const columnKeys=['name','size','date'];
const columnMinimums={name:90,size:60,date:112};
let columnWidths=vscode.getState()?.columnWidths||{};
let keyboardShortcuts={previousFrame:'arrowup',nextFrame:'arrowdown',moveFrameUp:'shift+arrowup',moveFrameDown:'shift+arrowdown',moveFrameFirst:'ctrl+arrowup',moveFrameLast:'ctrl+arrowdown',toggleFrameDisplay:'d',play:'enter',previousSlice:'arrowleft',nextSlice:'arrowright',rename:'f2',toggleBC:'',autoCuts:'a',resetCuts:'s',stackAutoCuts:'shift+a',stackResetCuts:'shift+s'};
const formatAdjust = window.ViviNumberFormat.formatNumber;
const sideAction = (action, value) => vscode.postMessage({type:'sideAction',action,value});
const shortcutNames={ctrl:'Ctrl',control:'Ctrl',shift:'Shift',alt:'Alt',option:'Alt',cmd:'Cmd',meta:'Cmd',enter:'Enter',arrowup:'Up',arrowdown:'Down',arrowleft:'Left',arrowright:'Right',escape:'Esc',backspace:'Backspace',delete:'Delete',' ':'Space'};
const shortcutLabel=binding=>String(binding||'').split('+').map(part=>shortcutNames[part.trim().toLowerCase()]||part.trim().toUpperCase()).filter(Boolean).join('+');
const shortcutButtons={slicePrev:'previousSlice',sliceNext:'nextSlice',slicePlay:'play',framePrevious:'previousFrame',frameNext:'nextFrame',frameTile:'toggleFrameDisplay',frameMoveUp:'moveFrameUp',frameMoveDown:'moveFrameDown',frameMoveFirst:'moveFrameFirst',frameMoveLast:'moveFrameLast',adjustAuto:'autoCuts',adjustReset:'resetCuts',adjustStackAuto:'stackAutoCuts',adjustStackReset:'stackResetCuts',adjustToggleBC:'toggleBC'};
// VS Code Codicons (MIT): stable fallbacks for types not supplied by Seti.
const codiconPaths={
  folder:['M2 4.5V6H5.58579C5.71839 6 5.84557 5.94732 5.93934 5.85355L7.29289 4.5 5.93934 3.14645C5.84557 3.05268 5.71839 3 5.58579 3H3.5C2.67157 3 2 3.67157 2 4.5ZM1 4.5C1 3.11929 2.11929 2 3.5 2H5.58579C5.98361 2 6.36514 2.15804 6.64645 2.43934L8.20711 4H12.5C13.8807 4 15 5.11929 15 6.5V11.5C15 12.8807 13.8807 14 12.5 14H3.5C2.11929 14 1 12.8807 1 11.5V4.5ZM2 7V11.5C2 12.3284 2.67157 13 3.5 13H12.5C13.3284 13 14 12.3284 14 11.5V6.5C14 5.67157 13.3284 5 12.5 5H8.20711L6.64645 6.56066C6.36514 6.84197 5.98361 7 5.58579 7H2Z'],
  file:['M5 1C3.89543 1 3 1.89543 3 3V13C3 14.1046 3.89543 15 5 15H11C12.1046 15 13 14.1046 13 13V5.41421C13 5.01639 12.842 4.63486 12.5607 4.35355L9.64645 1.43934C9.36514 1.15804 8.98361 1 8.58579 1H5ZM4 3C4 2.44772 4.44772 2 5 2H8V4.5C8 5.32843 8.67157 6 9.5 6H12V13C12 13.5523 11.5523 14 11 14H5C4.44772 14 4 13.5523 4 13V3ZM11.7929 5H9.5C9.22386 5 9 4.77614 9 4.5V2.20711L11.7929 5Z']
};
function fileIcon(item){
  if(item.directory)return {paths:codiconPaths.folder,color:'var(--vscode-icon-foreground,#c5c5c5)'};
  const name=item.name.toLowerCase(),extensions=Object.keys(setiTheme.fileExtensions||{}).filter(extension=>name===extension||name.endsWith(`.${extension}`)).sort((left,right)=>right.length-left.length);
  const key=setiTheme.fileNames?.[name]||setiTheme.fileExtensions?.[extensions[0]]||setiTheme.file,definition=setiTheme.iconDefinitions?.[key];
  const code=Number.parseInt(String(definition?.fontCharacter||'').replace('\\',''),16);
  return Number.isFinite(code)?{glyph:String.fromCodePoint(code),color:definition?.fontColor||''}:{paths:codiconPaths.file,color:'var(--vscode-icon-foreground,#c5c5c5)'};
}
function fileIconElement(item){
  const icon=fileIcon(item),element=document.createElement('span');element.className='file-icon';
  if(icon.paths){
    element.classList.add('codicon-file-icon');const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 16 16');svg.setAttribute('aria-hidden','true');
    for(const data of icon.paths){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',data);svg.append(path);}element.append(svg);
  }else element.textContent=icon.glyph;
  if(icon.color)element.style.color=icon.color;
  return element;
}
function scrollbarHit(event){
  for(const element of document.querySelectorAll('*')){
    const rect=element.getBoundingClientRect(),verticalWidth=Math.max(12,element.offsetWidth-element.clientWidth),horizontalHeight=Math.max(12,element.offsetHeight-element.clientHeight);
    const vertical=element.scrollHeight>element.clientHeight&&event.clientX>=rect.right-verticalWidth&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;
    const horizontal=element.scrollWidth>element.clientWidth&&event.clientY>=rect.bottom-horizontalHeight&&event.clientY<=rect.bottom&&event.clientX>=rect.left&&event.clientX<=rect.right;
    if(vertical||horizontal)return true;
  }
  return false;
}
function updateScrollbarShortcutFocus(event){
  vscode.postMessage({type:'scrollbarShortcutFocus',active:scrollbarHit(event)});
}
window.addEventListener('pointerdown',updateScrollbarShortcutFocus,true);
window.addEventListener('mousedown',updateScrollbarShortcutFocus,true);
function updateShortcutTips(){
  for(const [id,action] of Object.entries(shortcutButtons)){
    const button=$(id);if(!button)continue;
    const base=button.dataset.shortcutBase||button.getAttribute('title')||button.getAttribute('aria-label')||button.textContent.trim();
    button.dataset.shortcutBase=base;const shortcut=shortcutLabel(keyboardShortcuts[action]),tip=shortcut?`${base} (${shortcut})`:base;
    button.dataset.tip=tip;button.title=tip;
  }
}
function frameIcon(symbol,title,pressed,action){
  const button=document.createElement('button');button.type='button';button.className='frame-icon';button.title=title;button.setAttribute('aria-label',title);button.setAttribute('aria-pressed',String(pressed));
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');
  const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href',`#${symbol}`);svg.append(use);button.append(svg);button.onclick=action;return button;
}
function renderSidebar(state){
  if(!state||adjustSource?.frame!==state.active||adjustSource?.dataset!==state.datasetId)adjustSource=null;
  layoutState=state;
  $('layoutEmpty').hidden=!!state;$('layoutControls').hidden=!state;
  if(!state){$('layoutTitle').textContent='';return;}
  $('layoutTitle').textContent=state.activeLabel||'';
  const dataset=$('layoutDataset');
  if(JSON.stringify([...dataset.options].map(o=>Number(o.value)))!==JSON.stringify(state.datasets.map(d=>d.id))){dataset.replaceChildren();for(const d of state.datasets){const option=document.createElement('option');option.value=d.id;option.textContent=d.name;dataset.append(option);}}
  dataset.value=String(state.datasetId);
  $('sliceRange').max=state.total;$('sliceRange').value=state.slice;$('sliceRange').disabled=state.total<2;
  $('sliceNumber').max=state.total;$('sliceNumber').value=state.slice;$('sliceTotal').textContent=`/ ${state.total}`;
  $('slicePlay').textContent=state.playing?'Ⅱ':'▶';$('slicePlay').disabled=state.total<2;
  if(document.activeElement!==$('sliceFps'))$('sliceFps').value=state.fps;
  $('frameTile').classList.toggle('selected',state.tile);
  $('frameTile').querySelector('use').setAttribute('href',state.tile?'#i-tile':'#i-single');
  $('frameTile').dataset.shortcutBase=state.tile?'Display: tiled frames; click for single frame':'Display: single frame; click to tile';
  $('frameTile').setAttribute('aria-label',$('frameTile').dataset.shortcutBase);
  $('frameColumns').value=state.columns||'';$('frameRows').value=state.rows||'';
  const list=$('frameItems'),scroller=$('layoutModule').querySelector('.side-module-body'),scrollTop=scroller.scrollTop;list.replaceChildren();
  for(const frame of state.frames){
    const row=document.createElement('div');row.className='frame-item'+(frame.id===state.active?' active':'');row.draggable=true;row.dataset.id=frame.id;
    const handle=document.createElement('span');handle.className='drag-handle';handle.textContent='⠿';handle.title='Drag to reorder';
    const visible=frameIcon(frame.visible?'i-eye':'i-eye-off',`${frame.visible?'Hide':'Show'} ${frame.label}`,frame.visible,()=>sideAction('frameVisible',{id:frame.id,visible:!frame.visible}));
    const locked=frameIcon(frame.locked?'i-frame-lock':'i-frame-unlock',`${frame.locked?'Remove':'Include'} ${frame.label} ${frame.locked?'from':'in'} parameter locks`,frame.locked,()=>sideAction('frameLockMember',{id:frame.id,enabled:!frame.locked}));
    const button=document.createElement('button');button.textContent=`${frame.id}: ${frame.label}`;button.title=frame.label;button.onclick=()=>sideAction('selectFrame',frame.id);
    const loading=document.createElement('span');loading.className='frame-loading';loading.title='Loading image';loading.hidden=!frame.loading;
    const remove=document.createElement('button');remove.className='frame-remove';remove.textContent='×';remove.title=`Close Frame ${frame.id}: ${frame.label}`;remove.setAttribute('aria-label',remove.title);remove.onclick=()=>sideAction('closeFrame',frame.id);
    row.append(handle,visible,locked,button,loading,remove);
    row.ondragstart=e=>{e.dataTransfer.setData('text/plain',String(frame.id));e.dataTransfer.effectAllowed='move';row.classList.add('dragging');};
    row.ondragend=()=>row.classList.remove('dragging');
    row.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move';};
    row.ondrop=e=>{e.preventDefault();const from=Number(e.dataTransfer.getData('text/plain'));if(from&&from!==frame.id)sideAction('reorderFrame',{from,to:frame.id});};
    row.oncontextmenu=e=>{
      e.preventDefault();closeMenu();
      const menu=$('contextMenu'),rename=document.createElement('button');
      rename.type='button';rename.role='menuitem';rename.textContent='Rename…';
      rename.onclick=()=>{closeMenu();sideAction('renameFrame',frame.id);};
      const duplicate=document.createElement('button');duplicate.type='button';duplicate.role='menuitem';duplicate.textContent='Duplicate Frame';duplicate.onclick=()=>{closeMenu();sideAction('duplicateFrame',frame.id);};
      const frameIndex=state.frames.findIndex(item=>item.id===frame.id),lastIndex=state.frames.length-1;
      const moveButton=(label,position,disabled)=>{const item=document.createElement('button');item.type='button';item.role='menuitem';item.textContent=label;item.disabled=disabled;item.onclick=()=>{closeMenu();sideAction('moveFrameAt',{id:frame.id,position});};return item;};
      const moveUp=moveButton('Move Up','up',frameIndex<=0),moveDown=moveButton('Move Down','down',frameIndex>=lastIndex),moveFirst=moveButton('Move to Top','first',frameIndex<=0),moveLast=moveButton('Move to Bottom','last',frameIndex>=lastIndex);
      const removeFrame=document.createElement('button');removeFrame.type='button';removeFrame.role='menuitem';removeFrame.textContent='Close Frame';removeFrame.onclick=()=>{closeMenu();sideAction('closeFrame',frame.id);};
      menu.append(rename,duplicate,moveUp,moveDown,moveFirst,moveLast,removeFrame);menu.hidden=false;
      menu.style.left=Math.max(4,Math.min(e.clientX,window.innerWidth-menu.offsetWidth-4))+'px';
      menu.style.top=Math.max(4,Math.min(e.clientY,window.innerHeight-menu.offsetHeight-4))+'px';
      rename.focus();
    };
    list.append(row);
  }
  scroller.scrollTop=scrollTop;
  for(const input of document.querySelectorAll('[data-side-lock]'))input.checked=state.locks.includes(input.dataset.sideLock);
  const lut=$('adjustLut');if(lut.options.length!==state.luts.length){lut.replaceChildren();for(const [value,label] of state.luts){const option=document.createElement('option');option.value=value;option.textContent=label;lut.append(option);}}
  for(const [target,key] of [['adjustCuts','cuts'],['adjustStretch','stretch'],['adjustLut','cmap']])if(document.activeElement!==$(target))$(target).value=state[key];
  for(const [target,key] of [['adjustLow','low'],['adjustHigh','high']])if(document.activeElement!==$(target))$(target).value=formatAdjust(Number(state[key]));
  $('adjustInvert').checked=state.invert;
  $('adjustToggleBC').setAttribute('aria-pressed',String(state.bcVisible!==false));
  $('adjustToggleBC').title=state.bcVisible===false?'Show Curve':'Hide Curve';
  $('adjustToggleBC').dataset.shortcutBase=$('adjustToggleBC').title;
  $('adjustToggleBC').setAttribute('aria-label',$('adjustToggleBC').title);
  updateShortcutTips();
  syncAdjustRanges();
}
function stopHeldSlice(){if(!heldSlice)return;clearTimeout(heldSlice.timeout);clearInterval(heldSlice.interval);heldSlice=null;}
for(const [id,delta] of [['slicePrev',-1],['sliceNext',1]]){
  const button=$(id);
  button.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();stopHeldSlice();const interval=1000/Math.max(1,Math.min(60,Number($('sliceFps').value)||24));heldSlice={id,repeated:false};heldSlice.timeout=setTimeout(()=>{if(!heldSlice||heldSlice.id!==id)return;heldSlice.repeated=true;sideAction('stepSlice',delta);heldSlice.interval=setInterval(()=>sideAction('stepSlice',delta),interval);},300);button.setPointerCapture(e.pointerId);};
  button.onpointerup=e=>{const shortPress=heldSlice?.id===id&&!heldSlice.repeated;stopHeldSlice();if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);if(shortPress)sideAction('stepSlice',delta);};
  button.onpointercancel=stopHeldSlice;
  button.onclick=e=>{if(e.detail===0)sideAction('stepSlice',delta);};
}
$('sliceRange').oninput=()=>sideAction('setSlice',Number($('sliceRange').value));
$('sliceNumber').onchange=()=>sideAction('setSlice',Number($('sliceNumber').value));
$('slicePlay').onclick=()=>sideAction('play');
$('sliceFps').onchange=()=>sideAction('fps',Number($('sliceFps').value));
$('layoutDataset').onchange=()=>sideAction('dataset',Number($('layoutDataset').value));
$('framePrevious').onclick=()=>sideAction('previousFrame');$('frameNext').onclick=()=>sideAction('nextFrame');
$('frameTile').onclick=()=>sideAction('tile');
for(const action of ['moveFrameUp','moveFrameDown','moveFrameFirst','moveFrameLast'])$(action.replace('moveFrame','frameMove')).onclick=()=>sideAction(action);
for(const id of ['frameColumns','frameRows'])$(id).onchange=()=>sideAction(id==='frameColumns'?'columns':'rows',Number($(id).value)||0);
$('lockAll').onclick=()=>sideAction('lockAll');$('unlockAllFrames').onclick=()=>sideAction('unlockAll');
for(const input of document.querySelectorAll('[data-side-lock]'))input.onchange=()=>sideAction('lock',{group:input.dataset.sideLock,enabled:input.checked});
function sendAdjust(){const low=Number($('adjustLow').value),high=Number($('adjustHigh').value);if(!Number.isFinite(low)||!Number.isFinite(high)||high<=low)return;sideAction('adjust',{cuts:$('adjustCuts').value,low,high,stretch:$('adjustStretch').value,cmap:$('adjustLut').value,invert:$('adjustInvert').checked});}
function syncAdjustRanges(){
  const low=Number($('adjustLow').value),high=Number($('adjustHigh').value);
  if(!Number.isFinite(low)||!Number.isFinite(high))return;
  const sourceMin=Number(layoutState?.rangeMin),sourceMax=Number(layoutState?.rangeMax);
  if(!Number.isFinite(sourceMin)||!Number.isFinite(sourceMax))return;
  if(!adjustSource||adjustSource.frame!==layoutState?.active||adjustSource.dataset!==layoutState?.datasetId||sourceMin!==adjustSource.min||sourceMax!==adjustSource.max){
    adjustSource={frame:layoutState?.active,dataset:layoutState?.datasetId,min:sourceMin,max:sourceMax};
  }
  const {min,max}=adjustSource,constant=max===min,range=Math.max(Number.MIN_VALUE,max-min);
  const clamp=x=>Math.max(0,Math.min(1000,Math.round(x)));
  const values={adjustMinRange:constant?0:clamp((low-min)/range*1000),adjustMaxRange:constant?1000:clamp((high-min)/range*1000),
    adjustBrightnessRange:clamp((.5-(((low+high)/2)-((min+max)/2))/range)*1000),
    adjustContrastRange:constant?500:clamp(Math.atan(range/Math.max(Number.MIN_VALUE,high-low))*2000/Math.PI)};
  for(const id of ['adjustMinRange','adjustMaxRange','adjustBrightnessRange','adjustContrastRange'])$(id).disabled=constant;
  for(const [id,value] of Object.entries(values))if(document.activeElement!==$(id))$(id).value=value;
  if(document.activeElement!==$('adjustBrightnessValue'))$('adjustBrightnessValue').value=formatAdjust(values.adjustBrightnessRange/1000);
  if(document.activeElement!==$('adjustContrastValue'))$('adjustContrastValue').value=formatAdjust(values.adjustContrastRange/1000);
}
for(const [id,key,other] of [['adjustMinRange','adjustLow','adjustHigh'],['adjustMaxRange','adjustHigh','adjustLow']]){
  $(id).oninput=()=>{const {min,max}=adjustSource,value=min+(max-min)*Number($(id).value)/1000,gap=Math.max(Number.MIN_VALUE,(max-min)*1e-9);$(key).value=formatAdjust(id==='adjustMinRange'?Math.min(value,Number($(other).value)-gap):Math.max(value,Number($(other).value)+gap));$('adjustCuts').value='manual';syncAdjustRanges();sendAdjust();};
}
for(const [id,kind] of [['adjustBrightnessRange','brightness'],['adjustContrastRange','contrast']]){
  $(id).oninput=()=>{
    const {min,max}=adjustSource,range=max-min,position=Number($(id).value)/1000,center=kind==='brightness'?(min+max)/2+(.5-position)*range:(Number($('adjustLow').value)+Number($('adjustHigh').value))/2;
    const width=kind==='brightness'?Number($('adjustHigh').value)-Number($('adjustLow').value):range/Math.tan(Math.max(.001,Math.min(.999,position))*Math.PI/2);
    $('adjustLow').value=formatAdjust(center-width/2);$('adjustHigh').value=formatAdjust(center+width/2);$('adjustCuts').value='manual';syncAdjustRanges();sendAdjust();
  };
}
for(const [id,slider] of [['adjustBrightnessValue','adjustBrightnessRange'],['adjustContrastValue','adjustContrastRange']])$(id).onchange=()=>{const value=Number($(id).value);if(!Number.isFinite(value))return;$(slider).value=Math.max(0,Math.min(1000,Math.round(value*1000)));$(slider).oninput();};
$('adjustAuto').onclick=()=>sideAction('autoCuts',{mode:'percentile'});
$('adjustReset').onclick=()=>sideAction('autoCuts',{mode:'minmax',resetStretch:true});
$('adjustStackAuto').onclick=()=>sideAction('stackAutoCuts',{mode:'percentile'});
$('adjustStackReset').onclick=()=>sideAction('stackAutoCuts',{mode:'minmax',resetStretch:true});
$('adjustToggleBC').onclick=()=>sideAction('toggleBC');
for(const id of ['adjustCuts','adjustStretch','adjustLut','adjustInvert'])$(id).onchange=sendAdjust;
for(const id of ['adjustLow','adjustHigh'])$(id).onchange=()=>{$('adjustCuts').value='manual';syncAdjustRanges();sendAdjust();};
function list(path, start = 0) {
  if(start && (loading || !more))return;
  closeMenu();if(Date.now()>=errorUntil)$('error').textContent='';loading=true;
  if(!start){more=false;entries=[];render();$('files').scrollTop=0;}
  vscode.postMessage({type:'list',path,offset:start,sortMode,showHidden});
}
function loadMore(){if(more&&!loading)list(current,entries.length);}
function fillViewport(){if(more&&!loading&&$('files').scrollHeight<=$('files').clientHeight+80)loadMore();}
$('files').onscroll=()=>{if($('files').scrollTop+$('files').clientHeight >= $('files').scrollHeight-200)loadMore();};
function select(item) {
  selectedPath = item.path;
  if(current)selectedChildByFolder.set(current,selectedPath);
  for(const row of $('files').children)row.classList.toggle('selected',row.dataset.path===selectedPath);
  $('delete').disabled=false;$('terminal').disabled=false;
}
function run(action, item) {
  closeMenu();
  if (action === 'open' || action === 'openNewTab') {
    if (item.directory) list(item.path);
    else vscode.postMessage({ type: 'open', path: item.path, newTab: action === 'openNewTab' });
  } else if(action==='openAs'){vscode.postMessage({type:'inspectOpenAs',path:item.path});}
  else if(action==='openStack'){vscode.postMessage({type:'openSequence',path:item.path});}
  else vscode.postMessage({ type: 'action', action, path: item.path, folder: current });
}
function closeMenu() { $('contextMenu').hidden = true; $('contextMenu').replaceChildren(); $('sortMenu').hidden=true;$('sortMenu').replaceChildren();$('sort').setAttribute('aria-expanded','false');$('historyMenu').hidden=true;$('pathHistory').setAttribute('aria-expanded','false'); }
function showMenu(event, item) {
  event.preventDefault(); closeMenu();select(item);
  const allowed = menuItems.filter(action => labels[action] && (item.directory || !['newFile','newFolder','openStack'].includes(action)) && (!item.directory || !['openAs','openNewTab'].includes(action)));
  if (!allowed.length) return;
  const menu = $('contextMenu');
  for (const action of allowed) {
    const button = document.createElement('button');
    button.type = 'button'; button.role = 'menuitem'; button.textContent = labels[action];
    button.onclick = () => run(action, item);
    menu.append(button);
  }
  menu.hidden = false;
  menu.style.left = Math.max(4, Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 4)) + 'px';
  menu.style.top = Math.max(4, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 4)) + 'px';
  menu.querySelector('button').focus();
}
function render() {
  const filter = $('filter').value.toLowerCase();
  $('files').replaceChildren();
  for (const item of entries.filter(entry => entry.name.toLowerCase().includes(filter))) {
    const row = document.createElement('div');
    row.tabIndex=0;row.className = 'file ' + (item.directory ? 'folder' : item.supported ? 'supported' : 'unsupported');
    row.title = item.path;
    row.dataset.path=item.path;
    row.setAttribute('role','listitem');
    const name=document.createElement('span');name.className='file-cell file-name';const iconElement=fileIconElement(item),label=document.createElement('span');label.className='file-label';label.textContent=item.name;name.append(iconElement,label);
    const size=document.createElement('span');size.className='file-cell file-size';size.textContent=item.directory||item.size==null?'':formatSizeKiB(item.size);
    const date=document.createElement('span');date.className='file-cell file-date';date.textContent=formatModified(item.mtimeMs);
    row.append(name,size,date);
    row.onclick=()=>{select(item);row.focus({preventScroll:true});};
    row.ondblclick = () => run('open', item);
    row.oncontextmenu = event => showMenu(event, item);
    row.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); run('open', item); } };
    $('files').append(row);
  }
  const selected=entries.find(item=>item.path===selectedPath&&item.name.toLowerCase().includes(filter));
  if(selected)select(selected);
  else {selectedPath='';$('delete').disabled=true;$('terminal').disabled=true;}
}
function formatModified(value){
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
  const pad=number=>String(number).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function formatSizeKiB(bytes){return String(Math.round(bytes/1024)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');}
function updateColumnHeaders(){
  for(const button of document.querySelectorAll('.file-column')){
    const prefix=button.dataset.column,direction=sortMode===`${prefix}Asc`?'ascending':sortMode===`${prefix}Desc`?'descending':'none';
    button.setAttribute('aria-sort',direction);
  }
}
function selectColumnSort(column){sortMode=sortMode===`${column}Asc`?`${column}Desc`:`${column}Asc`;list(current);}
function applyColumnWidths(){
  const table=$('fileTable');for(const key of columnKeys)if(Number.isFinite(columnWidths[key]))table.style.setProperty(`--column-${key}`,`${columnWidths[key]}px`);
}
function setColumnWidth(key,width){
  columnWidths={...columnWidths,[key]:Math.max(columnMinimums[key],Math.round(width))};
  $('fileTable').style.setProperty(`--column-${key}`,`${columnWidths[key]}px`);
  vscode.setState({...vscode.getState(),columnWidths});
}
function compactColumn(key){
  const selector=key==='name'?'.file-name':key==='size'?'.file-size':'.file-date';
  const header=$('fileColumns').querySelector(`[data-column="${key}"]`);
  const width=Math.max(header.scrollWidth,...[...document.querySelectorAll(selector)].map(cell=>cell.scrollWidth))+10;
  setColumnWidth(key,width);
}
$('navigate').onsubmit = event => { event.preventDefault(); list($('path').value); };
$('pathHistory').onclick=event=>{
  event.stopPropagation();const menu=$('historyMenu');
  if(!menu.hidden){closeMenu();return;}
  closeMenu();menu.replaceChildren();
  for(const path of history){const button=document.createElement('button');button.type='button';button.role='option';button.textContent=path;button.onclick=()=>list(path);menu.append(button);}
  menu.hidden=false;$('pathHistory').setAttribute('aria-expanded','true');menu.querySelector('button')?.focus();
};
$('path').onkeydown=event=>{if(event.key==='ArrowDown'&&history.length){event.preventDefault();$('pathHistory').click();}};
let pathTipTimer;
const pathTip=document.createElement('div');pathTip.className='path-tooltip';pathTip.hidden=true;document.body.append(pathTip);
function hidePathTip(){clearTimeout(pathTipTimer);pathTip.hidden=true;}
function showPathTip(element,value,delay=1000){hidePathTip();pathTipTimer=setTimeout(()=>{if(!value)return;pathTip.textContent=value;pathTip.hidden=false;const rect=element.getBoundingClientRect();pathTip.style.left=Math.max(4,Math.min(rect.left,window.innerWidth-pathTip.offsetWidth-4))+'px';pathTip.style.top=Math.min(window.innerHeight-pathTip.offsetHeight-4,rect.bottom+4)+'px';},delay);}
$('path').addEventListener('pointerenter',()=>showPathTip($('path'),$('path').value));$('path').addEventListener('pointerleave',hidePathTip);
$('frameTile').removeAttribute('title');$('frameTile').addEventListener('pointerenter',()=>showPathTip($('frameTile'),$('frameTile').dataset.tip,0));$('frameTile').addEventListener('pointerleave',hidePathTip);
updateShortcutTips();
$('historyMenu').addEventListener('pointerover',event=>{const button=event.target.closest('button');if(button)showPathTip(button,button.textContent);});
$('historyMenu').addEventListener('pointerleave',hidePathTip);
$('up').onclick = () => list(parent);
$('home').onclick = () => list('~');
$('refresh').onclick = () => list(current);
$('newFolder').onclick = () => vscode.postMessage({ type: 'action', action: 'newFolder', path: current });
$('newFile').onclick = () => vscode.postMessage({ type: 'action', action: 'newFile', path: current });
$('delete').onclick = () => {if(selectedPath)vscode.postMessage({type:'action',action:'delete',path:selectedPath,folder:current});};
$('terminal').onclick = () => {if(selectedPath)vscode.postMessage({type:'action',action:'copyToTerminal',path:selectedPath});};
$('hidden').onclick = () => {showHidden=!showHidden;list(current);};
$('sort').onclick = event => {
  event.stopPropagation();const menu=$('sortMenu');
  if(!menu.hidden){closeMenu();return;}
  closeMenu();
  for(const [mode,label] of sorts){const button=document.createElement('button');button.type='button';button.role='menuitemradio';button.setAttribute('aria-checked',String(mode===sortMode));button.textContent=(mode===sortMode?'✓ ':'   ')+label;button.onclick=()=>{sortMode=mode;list(current);};menu.append(button);}
  const rect=$('sort').getBoundingClientRect();menu.hidden=false;menu.style.left=Math.max(2,Math.min(rect.left,document.body.clientWidth-menu.offsetWidth-2))+'px';menu.style.top=rect.bottom+2+'px';$('sort').setAttribute('aria-expanded','true');
};
$('filter').oninput = render;
$('filterToggle').onclick=()=>{const field=$('filter');field.hidden=!field.hidden;$('filterToggle').setAttribute('aria-expanded',String(!field.hidden));if(!field.hidden)field.focus();else{field.value='';render();}};
for(const button of document.querySelectorAll('.icon-button')) button.dataset.tip = button.title;
applyColumnWidths();
for(const button of document.querySelectorAll('.file-column'))button.onclick=event=>{if(!event.target.closest('.column-resizer'))selectColumnSort(button.dataset.column);};
for(const handle of document.querySelectorAll('.column-resizer')){
  let resize=null;
  handle.ondblclick=event=>{event.preventDefault();event.stopPropagation();compactColumn(handle.dataset.resize);};
  handle.onpointerdown=event=>{event.preventDefault();event.stopPropagation();resize={key:handle.dataset.resize,start:event.clientX,width:handle.parentElement.getBoundingClientRect().width};handle.classList.add('resizing');};
  window.addEventListener('pointermove',event=>{if(resize)setColumnWidth(resize.key,resize.width+event.clientX-resize.start);});
  window.addEventListener('pointerup',()=>{if(resize){document.querySelector(`[data-resize="${resize.key}"]`)?.classList.remove('resizing');resize=null;}});
}
document.addEventListener('click', event => { if (!$('contextMenu').contains(event.target)&&!$('sortMenu').contains(event.target)&&!$('sort').contains(event.target)&&!$('historyMenu').contains(event.target)&&!$('pathHistory').contains(event.target)) closeMenu(); });
$('contextMenu').addEventListener('mouseleave', closeMenu);
document.addEventListener('keydown', event => { if (event.key === 'Escape'){closeMenu();if(!$('filter').hidden)$('filterToggle').click();} });
function targetShape(dataset,expression){
  const groups=expression.trim().toLowerCase().split(/[\s,]+/).filter(Boolean),labels=dataset.sourceAxes,sizes=Object.fromEntries(labels.map((name,index)=>[name,dataset.sourceShape[index]]));
  const flat=[...groups.join('')];
  if(!groups.length||flat.some(name=>!sizes[name])||new Set(flat).size!==flat.length||flat.length!==labels.length||labels.some(name=>!flat.includes(name)))throw new Error('Use every source axis exactly once.');
  if(!groups.includes('h')||!groups.includes('w'))throw new Error('h and w must remain separate dimensions.');
  const channel=groups.at(-1)==='c',end=groups.length-(channel?1:0);
  if(groups[end-2]!=='h'||groups[end-1]!=='w')throw new Error('Target must end with h w, optionally followed by c.');
  return groups.map(group=>[...group].reduce((value,name)=>value*sizes[name],1));
}
function updateOpenAsRow(row,dataset){
  try{row.querySelector('.open-as-target').textContent=`Target shape: ${targetShape(dataset,row.querySelector('input').value).join(' × ')}`;row.dataset.valid='true';}
  catch(error){row.querySelector('.open-as-target').textContent=error.message;row.dataset.valid='false';}
}
function showOpenAs(path,result){
  openAsPath=path;$('openAsRows').replaceChildren();$('openAsError').textContent='';
  for(const dataset of result.datasets){const row=document.createElement('div');row.className='open-as-row';row.dataset.id=dataset.id;const title=document.createElement('strong');title.textContent=dataset.name;const source=document.createElement('div');source.className='open-as-shape';source.textContent=`Source: ${dataset.sourceShape.join(' × ')}   (${dataset.sourceAxes.join(' ')})`;const label=document.createElement('label');label.append(document.createTextNode('Target axes'));const input=document.createElement('input');input.value=dataset.targetExpression;input.autocomplete='off';label.append(input);const target=document.createElement('div');target.className='open-as-target';row.append(title,source,label,target);input.oninput=()=>updateOpenAsRow(row,dataset);updateOpenAsRow(row,dataset);$('openAsRows').append(row);}
  $('openAsDialog').hidden=false;$('openAsRows').querySelector('input')?.focus();
}
function closeOpenAs(){$('openAsDialog').hidden=true;openAsPath='';$('openAsRows').replaceChildren();$('openAsError').textContent='';}
$('openAsClose').onclick=closeOpenAs;$('openAsCancel').onclick=closeOpenAs;
$('openAsForm').onsubmit=event=>{event.preventDefault();const rows=[...$('openAsRows').children];for(const row of rows)row.querySelector('input').dispatchEvent(new Event('input'));if(rows.some(row=>row.dataset.valid!=='true')){$('openAsError').textContent='Correct the invalid target axes before opening.';return;}const axisLayouts=Object.fromEntries(rows.map(row=>[row.dataset.id,row.querySelector('input').value.trim().toLowerCase()]));$('openAsError').textContent='Opening…';vscode.postMessage({type:'openAs',path:openAsPath,axisLayouts});};
function shortcutMatches(binding,event){
  if(!binding)return false;
  const parts=String(binding).toLowerCase().split('+').map(part=>part.trim()),key=parts.pop(),modifiers=new Set(parts);
  return event.key.toLowerCase()===key&&event.ctrlKey===(modifiers.has('ctrl')||modifiers.has('control'))&&event.metaKey===(modifiers.has('cmd')||modifiers.has('meta'))&&event.altKey===(modifiers.has('alt')||modifiers.has('option'))&&event.shiftKey===modifiers.has('shift');
}
function shortcutEditingTarget(event){
  const target=event.target.closest?.('input,select,textarea,[contenteditable="true"]');
  return !!target&&!(target.tagName==='INPUT'&&['range','checkbox','radio'].includes(target.type));
}
window.addEventListener('keydown',event=>{
  const action=Object.entries(keyboardShortcuts).find(([,binding])=>shortcutMatches(binding,event))?.[0];
  if(shortcutEditingTarget(event))return;
  if(action==='rename'){
    if(document.body.classList.contains('view-layout')&&layoutState?.active)sideAction('renameFrame',layoutState.active);
    else if(document.body.classList.contains('view-explorer')&&selectedPath)vscode.postMessage({type:'action',action:'rename',path:selectedPath,folder:current});
    else sideAction('shortcut',action);
  }else if(action)sideAction('shortcut',action);
  else return;
  event.preventDefault();
},true);
window.addEventListener('message', ({data:message}) => {
  if (message.type === 'error') { loading=false;if(!$('openAsDialog').hidden){$('openAsError').textContent=message.message;return;}$('error').textContent = message.message;errorUntil=Date.now()+2500;clearTimeout(errorTimer);errorTimer=setTimeout(()=>{if(Date.now()>=errorUntil)$('error').textContent='';},2600);return; }
  if(message.type==='openAsInfo'){showOpenAs(message.path,message.result);return;}
  if(message.type==='openAsAccepted'){closeOpenAs();return;}
  if(message.type==='shortcutSettings'){keyboardShortcuts={...keyboardShortcuts,...message.keyboardShortcuts};updateShortcutTips();return;}
  if(message.type==='sidebarState'){renderSidebar(message.state);return;}
  if(message.type==='sidebarClear'){renderSidebar(null);return;}
  if(message.type==='focusAdjust'){$('adjustModule').open=true;$('adjustCuts').focus();return;}
  if(message.type==='focusLayout'){$('layoutModule').open=true;$('frameItems').scrollIntoView({block:'nearest'});return;}
  if(message.type==='menuItems'){menuItems=message.items;closeMenu();return;}
  if (message.type !== 'list') return;
  const append=message.path===current&&message.offset===entries.length&&message.offset>0;
  current=message.path;parent=message.parent;offset=message.offset;entries=append?entries.concat(message.entries):message.entries;if(!append)selectedPath=selectedChildByFolder.get(current)||'';more=!!message.more;loading=false;menuItems=message.menuItems||[];history=message.history||[];sortMode=message.sortMode||sortMode;showHidden=!!message.showHidden;
  $('path').value = current;
  $('pathHistory').disabled=!history.length;
  $('hidden').classList.toggle('selected',showHidden);$('hidden').setAttribute('aria-pressed',String(showHidden));$('hidden').title=showHidden?'Hide hidden files':'Show hidden files';$('hidden').setAttribute('aria-label',$('hidden').title);$('hidden').dataset.tip=$('hidden').title;
  $('sort').title=`Sort: ${sorts.find(([mode])=>mode===sortMode)?.[1]||'Name A–Z'}`;$('sort').dataset.tip=$('sort').title;
  updateColumnHeaders();render();requestAnimationFrame(fillViewport);
});
vscode.postMessage({type:'ready'});
