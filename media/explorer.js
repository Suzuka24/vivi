'use strict';
const vscode = acquireVsCodeApi();
const $ = id => document.getElementById(id);
const labels = { open: 'Open', openNewTab: 'Open in New Tab', copyPath: 'Copy Path', copyToTerminal: 'Insert Path into Terminal', copyName: 'Copy Name', rename: 'Rename…', delete: 'Move to Trash…', newFile: 'New File…', newFolder: 'New Folder…', refresh: 'Refresh' };
const sorts = [['nameAsc','Name A–Z'],['nameDesc','Name Z–A'],['sizeAsc','Size: small first'],['sizeDesc','Size: large first'],['dateDesc','Modified: newest first'],['dateAsc','Modified: oldest first']];
let current = '', parent = '', offset = 0, entries = [], menuItems = [], selectedPath = '', sortMode = 'nameAsc', showHidden = true;
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
