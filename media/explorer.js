'use strict';
const vscode = acquireVsCodeApi();
const $ = id => document.getElementById(id);
const labels = { open: 'Open', openNewTab: 'Open in New Tab', copyPath: 'Copy Path', copyToTerminal: 'Insert Path into Terminal', copyName: 'Copy Name', rename: 'Rename…', delete: 'Move to Trash…', newFile: 'New File…', newFolder: 'New Folder…', refresh: 'Refresh' };
const sorts = [['nameAsc','Name A–Z'],['nameDesc','Name Z–A'],['sizeAsc','Size: small first'],['sizeDesc','Size: large first'],['dateDesc','Modified: newest first'],['dateAsc','Modified: oldest first']];
let current = '', parent = '', offset = 0, entries = [], menuItems = [], selectedPath = '', sortMode = 'nameAsc', showHidden = true;
let layoutState = null, heldSlice = null;
const sideAction = (action, value) => vscode.postMessage({type:'sideAction',action,value});
function renderSidebar(state){
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
  $('frameTile').classList.toggle('selected',state.tile);$('frameBlink').classList.toggle('selected',state.blinking);
  $('frameColumns').value=state.columns||'';$('frameRows').value=state.rows||'';
  const list=$('frameItems');list.replaceChildren();
  for(const frame of state.frames){
    const row=document.createElement('div');row.className='frame-item'+(frame.id===state.active?' active':'');row.draggable=true;row.dataset.id=frame.id;
    const handle=document.createElement('span');handle.className='drag-handle';handle.textContent='⠿';handle.title='Drag to reorder';
    const visible=document.createElement('input');visible.type='checkbox';visible.checked=frame.visible;visible.title='Show this frame';visible.setAttribute('aria-label',`Show ${frame.label}`);visible.onchange=()=>sideAction('frameVisible',{id:frame.id,visible:visible.checked});
    const button=document.createElement('button');button.textContent=`${frame.id}: ${frame.label}`;button.title=frame.label;button.onclick=()=>sideAction('selectFrame',frame.id);
    row.append(handle,visible,button);
    row.ondragstart=e=>{e.dataTransfer.setData('text/plain',String(frame.id));e.dataTransfer.effectAllowed='move';row.classList.add('dragging');};
    row.ondragend=()=>row.classList.remove('dragging');
    row.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move';};
    row.ondrop=e=>{e.preventDefault();const from=Number(e.dataTransfer.getData('text/plain'));if(from&&from!==frame.id)sideAction('reorderFrame',{from,to:frame.id});};
    list.append(row);
  }
  for(const input of document.querySelectorAll('[data-side-lock]'))input.checked=state.locks.includes(input.dataset.sideLock);
  const lut=$('adjustLut');if(lut.options.length!==state.luts.length){lut.replaceChildren();for(const [value,label] of state.luts){const option=document.createElement('option');option.value=value;option.textContent=label;lut.append(option);}}
  for(const [target,key] of [['adjustCuts','cuts'],['adjustLow','low'],['adjustHigh','high'],['adjustStretch','stretch'],['adjustLut','cmap']])if(document.activeElement!==$(target))$(target).value=state[key];
  $('adjustInvert').checked=state.invert;$('adjustThreshold').checked=state.threshold;
}
function stopHeldSlice(){if(!heldSlice)return;clearTimeout(heldSlice.timeout);clearInterval(heldSlice.interval);heldSlice=null;}
for(const [id,delta] of [['slicePrev',-1],['sliceNext',1]]){
  const button=$(id);
  button.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();stopHeldSlice();sideAction('stepSlice',delta);heldSlice={id,suppress:true};heldSlice.timeout=setTimeout(()=>{heldSlice.interval=setInterval(()=>sideAction('stepSlice',delta),1000/Math.max(1,Math.min(30,Number($('sliceFps').value)||5)));},300);button.setPointerCapture(e.pointerId);};
  button.onpointerup=e=>{stopHeldSlice();if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);};
  button.onpointercancel=stopHeldSlice;
  button.onclick=e=>{if(e.detail===0)sideAction('stepSlice',delta);};
}
$('sliceRange').oninput=()=>sideAction('setSlice',Number($('sliceRange').value));
$('sliceNumber').onchange=()=>sideAction('setSlice',Number($('sliceNumber').value));
$('slicePlay').onclick=()=>sideAction('play');
$('sliceFps').onchange=()=>sideAction('fps',Number($('sliceFps').value));
$('layoutDataset').onchange=()=>sideAction('dataset',Number($('layoutDataset').value));
$('framePrevious').onclick=()=>sideAction('previousFrame');$('frameNext').onclick=()=>sideAction('nextFrame');
$('frameTile').onclick=()=>sideAction('tile');$('frameBlink').onclick=()=>sideAction('blink');
for(const id of ['frameColumns','frameRows'])$(id).onchange=()=>sideAction(id==='frameColumns'?'columns':'rows',Number($(id).value)||0);
$('lockAll').onclick=()=>sideAction('lockAll');$('unlockAllFrames').onclick=()=>sideAction('unlockAll');
for(const input of document.querySelectorAll('[data-side-lock]'))input.onchange=()=>sideAction('lock',{group:input.dataset.sideLock,enabled:input.checked});
$('adjustApply').onclick=()=>sideAction('adjust',{cuts:$('adjustCuts').value,low:Number($('adjustLow').value),high:Number($('adjustHigh').value),stretch:$('adjustStretch').value,cmap:$('adjustLut').value,invert:$('adjustInvert').checked,threshold:$('adjustThreshold').checked});
$('adjustAuto').onclick=()=>{$('adjustCuts').value='percentile';$('adjustApply').click();};
$('adjustReset').onclick=()=>{$('adjustCuts').value='minmax';$('adjustStretch').value='linear';$('adjustApply').click();};
for(const id of ['adjustCuts','adjustStretch','adjustLut','adjustInvert','adjustThreshold'])$(id).onchange=()=>{$('adjustApply').click();};
for(const id of ['adjustLow','adjustHigh'])$(id).onchange=()=>{$('adjustCuts').value='manual';$('adjustApply').click();};
function list(path, start = 0) { closeMenu(); $('error').textContent = ''; vscode.postMessage({ type: 'list', path, offset: start, sortMode, showHidden }); }
function select(item) {
  selectedPath = item.path;
  for(const row of $('files').children)row.classList.toggle('selected',row.dataset.path===selectedPath);
  $('delete').disabled=false;$('terminal').disabled=false;
}
function run(action, item) {
  closeMenu();
  if (action === 'open' || action === 'openNewTab') {
    if (item.directory) list(item.path);
    else vscode.postMessage({ type: 'open', path: item.path, newTab: action === 'openNewTab' });
  } else vscode.postMessage({ type: 'action', action, path: item.path, folder: current });
}
function closeMenu() { $('contextMenu').hidden = true; $('contextMenu').replaceChildren(); $('sortMenu').hidden=true;$('sortMenu').replaceChildren();$('sort').setAttribute('aria-expanded','false'); }
function showMenu(event, item) {
  event.preventDefault(); closeMenu();select(item);
  const allowed = menuItems.filter(action => labels[action] && (item.directory || !['newFile','newFolder'].includes(action)) && (action !== 'openNewTab' || !item.directory));
  if (!allowed.length) return;
  const menu = $('contextMenu');
  for (const action of allowed) {
    const button = document.createElement('button');
    button.type = 'button'; button.role = 'menuitem'; button.textContent = labels[action];
    button.onclick = () => run(action, item);
    menu.append(button);
  }
  menu.hidden = false;
  const rect = document.body.getBoundingClientRect();
  menu.style.left = Math.min(event.clientX, rect.width - menu.offsetWidth - 4) + 'px';
  menu.style.top = Math.min(event.clientY, rect.height - menu.offsetHeight - 4) + 'px';
  menu.querySelector('button').focus();
}
function render() {
  const filter = $('filter').value.toLowerCase();
  $('files').replaceChildren();
  for (const item of entries.filter(entry => entry.name.toLowerCase().includes(filter))) {
    const row = document.createElement('button');
    row.type = 'button'; row.className = 'file ' + (item.directory ? 'folder' : item.supported ? 'supported' : 'unsupported');
    row.textContent = `${item.directory ? '▸' : item.supported ? '▧' : '·'}  ${item.name}`;
    row.title = item.path;
    row.dataset.path=item.path;
    row.setAttribute('role','listitem');
    row.onclick=()=>select(item);
    row.ondblclick = () => run('open', item);
    row.oncontextmenu = event => showMenu(event, item);
    row.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); run('open', item); } };
    $('files').append(row);
  }
  const selected=entries.find(item=>item.path===selectedPath&&item.name.toLowerCase().includes(filter));
  if(selected)select(selected);
  else {selectedPath='';$('delete').disabled=true;$('terminal').disabled=true;}
}
$('navigate').onsubmit = event => { event.preventDefault(); list($('path').value); };
$('up').onclick = () => list(parent);
$('home').onclick = () => list('~');
$('refresh').onclick = () => list(current, offset);
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
for(const button of document.querySelectorAll('.icon-button')) button.dataset.tip = button.title;
$('prev').onclick = () => list(current, Math.max(0,offset - 500));
$('next').onclick = () => list(current, offset + 500);
document.addEventListener('click', event => { if (!$('contextMenu').contains(event.target)&&!$('sortMenu').contains(event.target)&&!$('sort').contains(event.target)) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
window.addEventListener('message', ({data:message}) => {
  if (message.type === 'error') { $('error').textContent = message.message; return; }
  if(message.type==='sidebarState'){renderSidebar(message.state);return;}
  if(message.type==='sidebarClear'){renderSidebar(null);return;}
  if(message.type==='focusAdjust'){$('adjustModule').open=true;$('adjustCuts').focus();return;}
  if(message.type==='focusLayout'){$('layoutModule').open=true;$('frameItems').scrollIntoView({block:'nearest'});return;}
  if (message.type !== 'list') return;
  current = message.path; parent = message.parent; offset = message.offset; entries = message.entries; menuItems = message.menuItems || [];sortMode=message.sortMode||sortMode;showHidden=!!message.showHidden;
  $('path').value = current;
  $('page').textContent = entries.length?`${offset + 1}–${offset + entries.length}`:'0';
  $('prev').disabled = !offset; $('next').disabled = !message.more;
  $('hidden').classList.toggle('selected',showHidden);$('hidden').setAttribute('aria-pressed',String(showHidden));$('hidden').title=showHidden?'Hide hidden files':'Show hidden files';$('hidden').setAttribute('aria-label',$('hidden').title);$('hidden').dataset.tip=$('hidden').title;
  $('sort').title=`Sort: ${sorts.find(([mode])=>mode===sortMode)?.[1]||'Name A–Z'}`;$('sort').dataset.tip=$('sort').title;
  render();
});
vscode.postMessage({type:'ready'});
