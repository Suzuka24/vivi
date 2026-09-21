'use strict';
const vscode = acquireVsCodeApi();
const $ = id => document.getElementById(id);
const labels = { open: 'Open', openAs:'Open As…', openNewTab: 'Open in New Tab', openStack: 'Open Folder as Stack…', copyPath: 'Copy Path', copyToTerminal: 'Insert Path into Terminal', copyName: 'Copy Name', rename: 'Rename…', delete: 'Remove Permanently…', newFile: 'New File…', newFolder: 'New Folder…', refresh: 'Refresh' };
const sorts = [['nameAsc','Name A–Z'],['nameDesc','Name Z–A'],['sizeAsc','Size: small first'],['sizeDesc','Size: large first'],['dateDesc','Modified: newest first'],['dateAsc','Modified: oldest first']];
let current = '', parent = '', offset = 0, entries = [], menuItems = [], history = [], selectedPath = '', sortMode = 'nameAsc', showHidden = true, more = false, loading = false;
const lastActivatedByFolder = new Map();
let layoutState = null, heldSlice = null, errorUntil = 0, errorTimer;
let adjustSource = null;
let openAsPath='';
const formatAdjust = window.ViviNumberFormat.formatNumber;
const sideAction = (action, value) => vscode.postMessage({type:'sideAction',action,value});
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
  $('frameTile').dataset.tip=state.tile?'Display: tiled frames; click for single frame':'Display: single frame; click to tile';
  $('frameTile').setAttribute('aria-label',$('frameTile').dataset.tip);
  $('frameColumns').value=state.columns||'';$('frameRows').value=state.rows||'';
  const list=$('frameItems'),scroller=$('layoutModule').querySelector('.side-module-body'),scrollTop=scroller.scrollTop;list.replaceChildren();
  for(const frame of state.frames){
    const row=document.createElement('div');row.className='frame-item'+(frame.id===state.active?' active':'');row.draggable=true;row.dataset.id=frame.id;
    const handle=document.createElement('span');handle.className='drag-handle';handle.textContent='⠿';handle.title='Drag to reorder';
    const visible=frameIcon(frame.visible?'i-eye':'i-eye-off',`${frame.visible?'Hide':'Show'} ${frame.label}`,frame.visible,()=>sideAction('frameVisible',{id:frame.id,visible:!frame.visible}));
    const locked=frameIcon(frame.locked?'i-frame-lock':'i-frame-unlock',`${frame.locked?'Remove':'Include'} ${frame.label} ${frame.locked?'from':'in'} parameter locks`,frame.locked,()=>sideAction('frameLockMember',{id:frame.id,enabled:!frame.locked}));
    const button=document.createElement('button');button.textContent=`${frame.id}: ${frame.label}`;button.title=frame.label;button.onclick=()=>sideAction('selectFrame',frame.id);
    const remove=document.createElement('button');remove.className='frame-remove';remove.textContent='×';remove.title=`Close Frame ${frame.id}: ${frame.label}`;remove.setAttribute('aria-label',remove.title);remove.onclick=()=>sideAction('closeFrame',frame.id);
    row.append(handle,visible,locked,button,remove);
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
      const removeFrame=document.createElement('button');removeFrame.type='button';removeFrame.role='menuitem';removeFrame.textContent='Close Frame';removeFrame.onclick=()=>{closeMenu();sideAction('closeFrame',frame.id);};
      menu.append(rename,duplicate,removeFrame);menu.hidden=false;
      menu.style.left=Math.min(e.clientX,document.body.clientWidth-menu.offsetWidth-4)+'px';
      menu.style.top=Math.min(e.clientY,document.body.clientHeight-menu.offsetHeight-4)+'px';
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
  $('adjustToggleBC').setAttribute('aria-label',$('adjustToggleBC').title);
  syncAdjustRanges();
}
function stopHeldSlice(){if(!heldSlice)return;clearTimeout(heldSlice.timeout);clearInterval(heldSlice.interval);heldSlice=null;}
for(const [id,delta] of [['slicePrev',-1],['sliceNext',1]]){
  const button=$(id);
  button.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();stopHeldSlice();sideAction('stepSlice',delta);const interval=1000/Math.max(1,Math.min(60,Number($('sliceFps').value)||24));heldSlice={id,suppress:true};heldSlice.timeout=setTimeout(()=>{sideAction('stepSlice',delta);heldSlice.interval=setInterval(()=>sideAction('stepSlice',delta),interval);},interval);button.setPointerCapture(e.pointerId);};
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
$('frameTile').onclick=()=>sideAction('tile');
for(const id of ['frameColumns','frameRows'])$(id).onchange=()=>sideAction(id==='frameColumns'?'columns':'rows',Number($(id).value)||0);
$('lockAll').onclick=()=>sideAction('lockAll');$('unlockAllFrames').onclick=()=>sideAction('unlockAll');
for(const input of document.querySelectorAll('[data-side-lock]'))input.onchange=()=>sideAction('lock',{group:input.dataset.sideLock,enabled:input.checked});
function sendAdjust(){const low=Number($('adjustLow').value),high=Number($('adjustHigh').value);if(!Number.isFinite(low)||!Number.isFinite(high)||high<=low)return;sideAction('adjust',{cuts:$('adjustCuts').value,low,high,stretch:$('adjustStretch').value,cmap:$('adjustLut').value,invert:$('adjustInvert').checked});}
function syncAdjustRanges(){
  const low=Number($('adjustLow').value),high=Number($('adjustHigh').value);
  if(!Number.isFinite(low)||!Number.isFinite(high)||!(high>low))return;
  const sourceMin=Number(layoutState?.rangeMin),sourceMax=Number(layoutState?.rangeMax);
  if(!adjustSource||adjustSource.frame!==layoutState?.active||adjustSource.dataset!==layoutState?.datasetId||sourceMin!==adjustSource.min||sourceMax!==adjustSource.max){
    adjustSource={frame:layoutState?.active,dataset:layoutState?.datasetId,min:sourceMin,max:sourceMax};
  }
  const {min,max}=adjustSource,range=Math.max(Number.MIN_VALUE,max-min);
  const clamp=x=>Math.max(0,Math.min(1000,Math.round(x)));
  const values={adjustMinRange:clamp((low-min)/range*1000),adjustMaxRange:clamp((high-min)/range*1000),
    adjustBrightnessRange:clamp((.5-(((low+high)/2)-((min+max)/2))/range)*1000),
    adjustContrastRange:clamp(Math.atan(range/(high-low))*2000/Math.PI)};
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
  for(const row of $('files').children)row.classList.toggle('selected',row.dataset.path===selectedPath);
  $('delete').disabled=false;$('terminal').disabled=false;
}
function rememberActivated(folder,path){
  if(folder&&path)lastActivatedByFolder.set(folder,path);
}
function run(action, item) {
  closeMenu();
  if (action === 'open' || action === 'openNewTab') {
    rememberActivated(current,item.path);render();
    if (item.directory) list(item.path);
    else vscode.postMessage({ type: 'open', path: item.path, newTab: action === 'openNewTab' });
  } else if(action==='openAs'){rememberActivated(current,item.path);render();vscode.postMessage({type:'inspectOpenAs',path:item.path});}
  else if(action==='openStack'){rememberActivated(current,item.path);render();vscode.postMessage({type:'openSequence',path:item.path});}
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
    if(item.path===lastActivatedByFolder.get(current)){row.classList.add('recent');row.setAttribute('aria-current','true');}
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
$('historyMenu').addEventListener('pointerover',event=>{const button=event.target.closest('button');if(button)showPathTip(button,button.textContent);});
$('historyMenu').addEventListener('pointerleave',hidePathTip);
$('up').onclick = () => {rememberActivated(parent,current);list(parent);};
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
window.addEventListener('message', ({data:message}) => {
  if (message.type === 'error') { loading=false;if(!$('openAsDialog').hidden){$('openAsError').textContent=message.message;return;}$('error').textContent = message.message;errorUntil=Date.now()+2500;clearTimeout(errorTimer);errorTimer=setTimeout(()=>{if(Date.now()>=errorUntil)$('error').textContent='';},2600);return; }
  if(message.type==='openAsInfo'){showOpenAs(message.path,message.result);return;}
  if(message.type==='openAsAccepted'){closeOpenAs();return;}
  if(message.type==='sidebarState'){renderSidebar(message.state);return;}
  if(message.type==='sidebarClear'){renderSidebar(null);return;}
  if(message.type==='focusAdjust'){$('adjustModule').open=true;$('adjustCuts').focus();return;}
  if(message.type==='focusLayout'){$('layoutModule').open=true;$('frameItems').scrollIntoView({block:'nearest'});return;}
  if(message.type==='menuItems'){menuItems=message.items;closeMenu();return;}
  if (message.type !== 'list') return;
  const append=message.path===current&&message.offset===entries.length&&message.offset>0;
  current=message.path;parent=message.parent;offset=message.offset;entries=append?entries.concat(message.entries):message.entries;more=!!message.more;loading=false;menuItems=message.menuItems||[];history=message.history||[];sortMode=message.sortMode||sortMode;showHidden=!!message.showHidden;
  $('path').value = current;
  $('pathHistory').disabled=!history.length;
  $('hidden').classList.toggle('selected',showHidden);$('hidden').setAttribute('aria-pressed',String(showHidden));$('hidden').title=showHidden?'Hide hidden files':'Show hidden files';$('hidden').setAttribute('aria-label',$('hidden').title);$('hidden').dataset.tip=$('hidden').title;
  $('sort').title=`Sort: ${sorts.find(([mode])=>mode===sortMode)?.[1]||'Name A–Z'}`;$('sort').dataset.tip=$('sort').title;
  render();requestAnimationFrame(fillViewport);
});
vscode.postMessage({type:'ready'});
