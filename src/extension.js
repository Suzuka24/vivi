'use strict';
const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { Backend } = require('./backend');
const { viewerFor, isManaged, nativeEditorFor } = require('./formats');
const { listDirectory, listColumnValues } = require('./explorerListing');
const { uniqueFrameLabel } = require('./frameLabels');
const { menuPaths } = require('./menuVisibility');
const { previewCompressionOptions } = require('./compressionPolicy');
const { compactPaths, transferEntries } = require('./fileOperations');
const { HttpPayloadTransport, packStackPayload } = require('./httpTransport');

function nativePath(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Enter a path on the extension host.');
  input = input.trim();
  if (input === '~') return os.homedir();
  if (/^~[\\/]/.test(input)) input = path.join(os.homedir(), input.slice(2));
  return path.resolve(input);
}

function setiThemeExtension() {
  return vscode.extensions.getExtension('vscode.theme-seti');
}

function webviewResourceRoots(context) {
  const roots = [vscode.Uri.joinPath(context.extensionUri, 'media')], seti = setiThemeExtension();
  if (seti) roots.push(seti.extensionUri);
  return roots;
}

async function html(webview, context, name, httpCsp = '') {
  const nonce = crypto.randomBytes(20).toString('hex');
  const uri = file => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', file)).toString();
  let setiFont = '', setiTheme = '{}';
  if (name === 'explorer') {
    const seti = setiThemeExtension();
    if (seti) {
      const icons = vscode.Uri.joinPath(seti.extensionUri, 'icons');
      try {
        const source = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(icons, 'vs-seti-icon-theme.json'));
        const theme = JSON.parse(Buffer.from(source).toString('utf8'));
        setiTheme = JSON.stringify({ iconDefinitions: theme.iconDefinitions, file: theme.file, fileExtensions: theme.fileExtensions, fileNames: theme.fileNames }).replaceAll('<', '\\u003c');
        setiFont = webview.asWebviewUri(vscode.Uri.joinPath(icons, 'seti.woff')).toString();
      } catch {}
    }
  }
  const text = await fs.readFile(path.join(context.extensionPath, 'media', `${name}.html`), 'utf8');
  return text
    .replaceAll('{{nonce}}', nonce).replaceAll('{{csp}}', webview.cspSource).replaceAll('{{httpCsp}}', httpCsp)
    .replaceAll('{{script}}', uri(`${name}.js`)).replaceAll('{{style}}', uri('style.css'))
    .replaceAll('{{extraStyle}}', uri(`${name}.css`))
    .replaceAll('{{formatScript}}', uri('numberFormat.js'))
    .replaceAll('{{displayScript}}', uri('display.js'))
    .replaceAll('{{imageWorkerScript}}', uri('imageWorker.js'))
    .replaceAll('{{recentCacheScript}}', uri('recentPayloadCache.js'))
    .replaceAll('{{roiScript}}', uri('roiGeometry.js'))
    .replaceAll('{{zstdScript}}', uri('vendor/fzstd.js'))
    .replaceAll('{{zfpScript}}', uri('vendor/zfp.js'))
    .replaceAll('{{zfpWasm}}', uri('vendor/wasm-zfp.wasm'))
    .replaceAll('{{setiFont}}', setiFont).replaceAll('{{setiTheme}}', setiTheme);
}

async function activate(context) {
  const output = vscode.window.createOutputChannel('vivi');
  context.subscriptions.push(output);
  const httpTransport = new HttpPayloadTransport(message=>output.appendLine(String(message)));
  context.subscriptions.push(httpTransport);
  let httpCsp='';
  try {
    const local=await httpTransport.listen(),external=await vscode.env.asExternalUri(vscode.Uri.parse(local));
    httpTransport.setExternalBase(external.toString());httpCsp=httpTransport.cspSource;
  } catch(error) { output.appendLine(`[transport] HTTP stream unavailable; postMessage fallback will be used: ${error.message}`); }
  const config = () => vscode.workspace.getConfiguration('vivi');
  const previousMenuSetting = config().inspect('explorerContextMenu');
  for (const [value, target] of [
    [previousMenuSetting?.globalValue, vscode.ConfigurationTarget.Global],
    [previousMenuSetting?.workspaceValue, vscode.ConfigurationTarget.Workspace],
    [previousMenuSetting?.workspaceFolderValue, vscode.ConfigurationTarget.WorkspaceFolder]
  ]) if (Array.isArray(value)) {
    const allVisible = Object.fromEntries(menuPaths.map(item => [item, true]));
    config().update('explorerContextMenu', allVisible, target).then(undefined,
      error => output.appendLine(`Menu setting migration: ${error.message}`));
  }
  const previousMouseSetting = config().inspect('mouseShortcuts');
  for (const [value, target] of [
    [previousMouseSetting?.globalValue, vscode.ConfigurationTarget.Global],
    [previousMouseSetting?.workspaceValue, vscode.ConfigurationTarget.Workspace],
    [previousMouseSetting?.workspaceFolderValue, vscode.ConfigurationTarget.WorkspaceFolder]
  ]) if (value && typeof value === 'object' && value.orthogonalTool === 'shift+click') {
    config().update('mouseShortcuts', {...value, orthogonalTool:'space+click'}, target).then(undefined,
      error => output.appendLine(`Mouse setting migration: ${error.message}`));
  }
  const mouseShortcuts = () => {
    const value=config().get('mouseShortcuts', {});
    return value?.orthogonalTool==='shift+click'?{...value,orthogonalTool:'space+click'}:value;
  };
  const managed = file => isManaged(file, config().get('managedExtensions', []));
  const menuItems = () => explorerMenuOptions.map(([id]) => id);
  const menuVisibility = () => {
    const saved = config().get('explorerContextMenu', {});
    return Object.fromEntries(menuPaths.map(item => [item, !saved || Array.isArray(saved) || saved[item] !== false]));
  };
  const explorerMenuOptions = [
    ['open', 'Open'], ['openAs', 'Open As…'], ['openNewTab', 'Open in New Tab'], ['openStack', 'Open Folder as Stack…'],
    ['copyItems', 'Copy'], ['cutItems', 'Cut'], ['pasteItems', 'Paste Into Folder'],
    ['copyPath', 'Copy Path'], ['copyToTerminal', 'Insert Path into Terminal'], ['copyName', 'Copy Name'],
    ['rename', 'Rename…'], ['delete', 'Remove Permanently…'], ['newFile', 'New File…'],
    ['newFolder', 'New Folder…'], ['refresh', 'Refresh']
  ];
  const sessions = [];
  let activeSession = null;
  const sidebarViews = [];
  const publishSidebar = session => { for (const provider of sidebarViews) provider.view?.webview.postMessage(session?.sidebarState ? {type:'sidebarState',state:session.sidebarState}:{type:'sidebarClear'}); };
  const setSessionContext = () => {
    vscode.commands.executeCommand('setContext', 'vivi.sessionActive', sessions.length > 0);
    if (!sessions.length) vscode.commands.executeCommand('setContext', 'vivi.scrollbarShortcutFocus', false);
  };
  setSessionContext();
  context.subscriptions.push(vscode.commands.registerCommand('vivi.runShortcut', action => {
    activeSession?.panel.webview.postMessage({type:'sideAction',action:'shortcut',value:String(action || '')});
  }));
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() =>
    vscode.commands.executeCommand('setContext', 'vivi.scrollbarShortcutFocus', false)
  ));
  for (const action of ['moveFrameUp','moveFrameDown','moveFrameFirst','moveFrameLast']) context.subscriptions.push(
    vscode.commands.registerCommand(`vivi.${action}`, () => activeSession?.panel.webview.postMessage({type:'sideAction',action}))
  );
  const newBackend = () => {
    const c = config();
    // python3 is the portable Linux default; Windows installations commonly use python.exe.
    const configured = c.get('pythonPath', '') || vscode.workspace.getConfiguration('imageViewer').get('pythonPath', 'python3');
    const python = process.platform === 'win32' && configured === 'python3' ? 'python' : configured;
    return new Backend(python, path.join(context.extensionPath, 'backend', 'worker.py'), c.get('requestTimeoutSeconds', 120)*1000, s => output.append(s), c.get('maxDecodedPixels', 256000000));
  };
  // The editor converts a file URI from the remote extension host over RPC.
  const uriFor = file => vscode.Uri.file(file);
  const editorOptions = newTab => ({ viewColumn: vscode.ViewColumn.Active, preview: !newTab, preserveFocus: false });
  async function openNormally(uri, newTab = false) {
    const editor = nativeEditorFor(uri.fsPath);
    try { await vscode.commands.executeCommand('vscode.openWith', uri, editor, editorOptions(newTab)); }
    catch (error) {
      if (editor === 'default') throw error;
      await vscode.commands.executeCommand('vscode.openWith', uri, 'default', editorOptions(newTab));
    }
  }
  async function open(input, newTab = false, sequence = false, sequenceMode = '2d', openOptions = {}) {
    const file = nativePath(input);
    if (sequence ? !(await fs.stat(file)).isDirectory() : !(await fs.stat(file)).isFile()) throw new Error(sequence ? 'Select an image folder.' : 'Select a file.');
    const uri = uriFor(file);
    if (sequence || managed(file)) {
      if (!newTab && sessions.length) {
        const session = sessions.at(-1);
        await session.add(file,false,'',null,sequenceMode,openOptions);
        session.panel.reveal();
      } else {
        const panel = vscode.window.createWebviewPanel('vivi.session', path.basename(file), vscode.ViewColumn.Active,
          { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: webviewResourceRoots(context) });
        createSession(panel, file, sequenceMode, openOptions);
      }
    } else await openNormally(uri, newTab);
  }
  const report = error => vscode.window.showErrorMessage(`vivi: ${error.message}`);

  class Explorer {
    constructor(kind = 'explorer') { this.kind = kind; this.listSerial = 0; this.fileClipboard = null; }
    async resolveWebviewView(view) {
      this.view = view;
      view.webview.options = { enableScripts: true, localResourceRoots: webviewResourceRoots(context) };
      view.webview.onDidReceiveMessage(async msg => {
        try {
          if (msg.type === 'ready' && this.kind === 'explorer') await this.list(context.workspaceState.get('explorerPath', config().get('defaultPath', '~')),
            0, context.workspaceState.get('explorerSort', 'nameAsc'), context.workspaceState.get('explorerShowHidden', true));
          if (msg.type === 'ready') {
            view.webview.postMessage({type:'shortcutSettings',keyboardShortcuts:config().get('keyboardShortcuts', {})});
            if(this.kind==='explorer'&&this.fileClipboard)view.webview.postMessage({type:'fileClipboard',paths:this.fileClipboard.paths,move:this.fileClipboard.move});
            publishSidebar(activeSession);
          }
          if (msg.type === 'list' && this.kind === 'explorer') await this.list(msg.path, msg.offset || 0, msg.sortMode, msg.showHidden);
          if (msg.type === 'measureColumn' && this.kind === 'explorer') {
            const folder=nativePath(msg.path),values=await listColumnValues(folder,msg.key,msg.showHidden);
            view.webview.postMessage({type:'columnValues',path:folder,key:msg.key,requestId:msg.requestId,values});
          }
          if (msg.type === 'open') await open(msg.path, msg.newTab === true);
          if (msg.type === 'inspectOpenAs') {
            const worker=newBackend();
            try { view.webview.postMessage({type:'openAsInfo',path:msg.path,result:await worker.request('inspect',{path:nativePath(msg.path),maxPixels:worker.maxPixels})}); }
            finally { worker.dispose(); }
          }
          if (msg.type === 'openAs') {
            const worker=newBackend();
            try {
              await worker.request('open',{path:nativePath(msg.path),maxPixels:worker.maxPixels,axisLayouts:msg.axisLayouts});
              view.webview.postMessage({type:'openAsAccepted'});
              await open(msg.path,msg.newTab===true,false,'2d',{axisLayouts:msg.axisLayouts});
            } finally { worker.dispose(); }
          }
          if (msg.type === 'openSequence') {
            const choice=await vscode.window.showQuickPick([{label:'Only 2D images',mode:'2d',description:'Skip files containing multiple slices'},{label:'All image planes',mode:'all',description:'Expand every 2D or 3D file into slices'}],{title:'Open Folder as Stack',placeHolder:'Choose which images to include'});
            if(choice){
              const value=await vscode.window.showInputBox({title:'Image Sequence Size',prompt:'Optional H W filter, for example: 795 795. Leave blank to use the first qualifying image.',placeHolder:'height width',validateInput:text=>{const values=text.trim().split(/\s+/).map(Number);return !text.trim()||(values.length===2&&values.every(Number.isInteger)&&values.every(number=>number>0))?null:'Enter two positive integers separated by a space.';}});
              if(value!==undefined){const sequenceSize=value.trim()?value.trim().split(/\s+/).map(Number):null;await open(msg.path,msg.newTab===true,true,choice.mode,{sequenceSize});}
            }
          }
          if (msg.type === 'action') await this.action(msg);
          if (msg.type === 'sideAction') {
            if (msg.action === 'cancelFrameLoad') activeSession?.cancelFrameLoad(msg.value);
            else activeSession?.panel.webview.postMessage({type:'sideAction',action:msg.action,value:msg.value});
          }
          if (msg.type === 'scrollbarShortcutFocus') await vscode.commands.executeCommand('setContext', 'vivi.scrollbarShortcutFocus', msg.active === true);
        } catch (error) { view.webview.postMessage({ type: 'error', message: error.message }); }
      }, undefined, context.subscriptions);
      view.webview.html = (await html(view.webview, context, 'explorer')).replace('{{viewKind}}', this.kind);
    }
    async action(msg) {
      const action = msg.action;
      if (!menuItems().includes(action) && !['newFile', 'newFolder', 'refresh', 'copyToTerminal', 'moveItems'].includes(action)) throw new Error('Explorer action is disabled.');
      const target = nativePath(msg.path);
      const targets = compactPaths((Array.isArray(msg.paths) ? msg.paths : [msg.path]).map(nativePath));
      if (['copyToTerminal','copyItems','cutItems','moveItems','delete'].includes(action) && !targets.length) return;
      if (action === 'refresh') return this.list(msg.folder || target);
      if (action === 'copyPath') return vscode.env.clipboard.writeText(target);
      if (action === 'copyName') return vscode.env.clipboard.writeText(path.basename(target));
      if (action === 'copyToTerminal') {
        const existing = vscode.window.activeTerminal;
        const terminal = existing || vscode.window.createTerminal('vivi');
        const quoted = targets.map(value=>`'${value.replaceAll("'", process.platform === 'win32' ? "''" : "'\\''")}'`).join(' ');
        terminal.show();
        if (!existing) {
          await terminal.processId;
          // A new remote shell can still be running its startup commands after its process appears.
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        terminal.sendText(quoted, false);
        return;
      }
      if (action === 'copyItems' || action === 'cutItems') {
        await Promise.all(targets.map(value=>fs.stat(value)));
        this.fileClipboard={paths:targets,move:action==='cutItems'};
        this.view?.webview.postMessage({type:'fileClipboard',paths:targets,move:this.fileClipboard.move});
        return;
      }
      if (action === 'pasteItems') {
        if (!this.fileClipboard?.paths.length) return;
        const folder=(await fs.stat(target)).isDirectory()?target:path.dirname(target);
        await transferEntries(this.fileClipboard.paths,folder,this.fileClipboard.move);
        if(this.fileClipboard.move){this.fileClipboard=null;this.view?.webview.postMessage({type:'fileClipboard',paths:[],move:false});}
        return this.list(folder);
      }
      if (action === 'moveItems') {
        await transferEntries(targets,target,true);
        return this.list(msg.folder||path.dirname(target));
      }
      if (action === 'newFile' || action === 'newFolder') {
        const name = await vscode.window.showInputBox({ prompt: action === 'newFolder' ? 'New folder name' : 'New file name' });
        if (!name) return;
        if (name !== path.basename(name) || name === '.' || name === '..') throw new Error('Enter one file or folder name.');
        const destination = path.join((await fs.stat(target)).isDirectory() ? target : path.dirname(target), name);
        if (action === 'newFolder') await fs.mkdir(destination);
        else await fs.writeFile(destination, '', { flag: 'wx' });
        return this.list(path.dirname(destination));
      }
      if (action === 'rename') {
        const name = await vscode.window.showInputBox({ prompt: 'Rename', value: path.basename(target) });
        if (!name || name === path.basename(target)) return;
        if (name !== path.basename(name) || name === '.' || name === '..') throw new Error('Enter one file or folder name.');
        await fs.rename(target, path.join(path.dirname(target), name));
        return this.list(path.dirname(target));
      }
      if (action === 'delete') {
        const description=targets.length===1?targets[0]:`${targets.length} selected items`;
        const choice = await vscode.window.showWarningMessage(`Permanently remove ${description} and all selected folder contents?`, { modal: true }, 'Remove Permanently');
        if (choice !== 'Remove Permanently') return;
        await Promise.all(targets.map(value=>fs.rm(value,{recursive:true,force:true})));
        return this.list(msg.folder||path.dirname(targets[0]));
      }
      throw new Error('Unknown Explorer action.');
    }
    async list(input, offset = 0, sortMode = context.workspaceState.get('explorerSort', 'nameAsc'), showHidden = context.workspaceState.get('explorerShowHidden', true)) {
      const folder = nativePath(input);
      const serial = ++this.listSerial;
      const page = await listDirectory(folder, offset, sortMode, showHidden);
      if(serial !== this.listSerial)return;
      const entries = page.entries.map(item => ({...item, supported:managed(item.path)}));
      await context.workspaceState.update('explorerPath', folder);
      await context.workspaceState.update('explorerSort', page.sortMode);
      await context.workspaceState.update('explorerShowHidden', page.showHidden);
      const history = [folder, ...context.workspaceState.get('explorerHistory', []).filter(item => item !== folder)].slice(0, 20);
      await context.workspaceState.update('explorerHistory', history);
      this.view?.webview.postMessage({ type: 'list', path: folder, parent: path.dirname(folder), entries,
        offset:page.offset, more:page.more, sortMode:page.sortMode, showHidden:page.showHidden, menuItems: menuItems(), history });
    }
  }
  const explorer = new Explorer();
  const layout = new Explorer('layout');
  const adjust = new Explorer('adjust');
  sidebarViews.push(explorer, layout, adjust);
  for (const provider of sidebarViews) context.subscriptions.push(vscode.window.registerWebviewViewProvider(`vivi.${provider.kind}`, provider, { webviewOptions: { retainContextWhenHidden: true } }));
  context.subscriptions.push(vscode.commands.registerCommand('vivi.browse', async () => {
    await vscode.commands.executeCommand('vivi.explorer.focus');
  }));
  context.subscriptions.push(vscode.commands.registerCommand('vivi.configureExplorerContextMenu', async () => {
    const enabled = menuVisibility();
    const picked = await vscode.window.showQuickPick(menuPaths.map(label => ({ label, picked: enabled[label] })),
      { canPickMany: true, title: 'vivi Menu Visibility', placeHolder: 'Check the first- and second-level menu items to show', ignoreFocusOut: true });
    if (!picked) return;
    const inspection = config().inspect('explorerContextMenu');
    const target = inspection?.workspaceFolderValue !== undefined ? vscode.ConfigurationTarget.WorkspaceFolder
      : inspection?.workspaceValue !== undefined ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
    const selected = new Set(picked.map(item => item.label));
    await config().update('explorerContextMenu', Object.fromEntries(menuPaths.map(item => [item, selected.has(item)])), target);
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('vivi.explorerContextMenu')) for (const session of sessions)
      session.panel.webview.postMessage({type:'menuVisibility',items:menuVisibility()});
    if (event.affectsConfiguration('vivi.keyboardShortcuts')) {
      const keyboardShortcuts=config().get('keyboardShortcuts', {});
      for (const session of sessions) session.panel.webview.postMessage({type:'shortcutSettings',keyboardShortcuts});
      for (const provider of sidebarViews) provider.view?.webview.postMessage({type:'shortcutSettings',keyboardShortcuts});
    }
  }));
  context.subscriptions.push(vscode.commands.registerCommand('vivi.open', async uri => {
    try {
      const input = uri?.fsPath || await vscode.window.showInputBox({ prompt: 'Image/video path on this host', value: '~/' });
      if (input) await open(input);
    } catch (error) { report(error); }
  }));
  context.subscriptions.push(vscode.commands.registerCommand('vivi.diagnostics', async () => {
    const worker = newBackend();
    try { output.appendLine(JSON.stringify(await worker.request('diagnostics'), null, 2)); output.show(); }
    catch (error) { report(error); output.show(); }
    finally { worker.dispose(); }
  }));
  function createSession(panel, firstFile, firstMode = '2d', firstOptions = {}) {
    const frames = new Map();
    const sessionKey=crypto.randomUUID(),transportOwner=frameId=>`${sessionKey}:${Number(frameId)}`;
    const pendingPaths = [{file:firstFile,mode:firstMode,options:firstOptions}];
    const generatedPaths = [];
    let ready = false, disposed = false, nextId = 0, activeId = null, idleDisposeTimer = null;
    const removeFrame = (frameId, retainRecentSeconds = 0, notifyViewer = false) => {
      const id=Number(frameId),frame=frames.get(id);
      if (!frame) return false;
      httpTransport.cancelFrame(transportOwner(id));frame.worker.dispose();frames.delete(id);
      if (!frames.has(activeId)) activeId=frames.keys().next().value||null;
      if (session.sidebarState) {
        const sidebarFrames=session.sidebarState.frames.filter(item=>item.id!==id),active=sidebarFrames.find(item=>item.id===activeId);
        session.sidebarState=sidebarFrames.length?{...session.sidebarState,frames:sidebarFrames,active:activeId,activeLabel:active?.label||''}:null;
        if(activeSession===session)publishSidebar(session);
      }
      if (notifyViewer&&!disposed) panel.webview.postMessage({type:'frameCancelled',frameId:id});
      if (frames.size) panel.title=frames.size===1?(frames.get(activeId).label||path.basename(frames.get(activeId).file)):`vivi · ${frames.size} frames`;
      else {
        panel.title='vivi';
        const seconds=Math.max(0,Math.min(60,Number(retainRecentSeconds)||0));
        if(seconds)idleDisposeTimer=setTimeout(()=>{if(!disposed&&!frames.size)panel.dispose();},seconds*1000);
        else panel.dispose();
      }
      return true;
    };
    const session = {
      panel,
      sidebarState:null,
      cancelFrameLoad(frameId) { return removeFrame(frameId,0,true); },
      async add(file, generated = false, label = '', initialSelection = null, sequenceMode = '2d', openOptions = {}) {
        if (disposed) throw new Error('Viewer closed.');
        clearTimeout(idleDisposeTimer);idleDisposeTimer=null;
        if (!ready) { pendingPaths.push({file,mode:sequenceMode,options:openOptions}); return; }
        const worker = newBackend();
        try {
          const data = await worker.request('open', { path: file, maxPixels: worker.maxPixels, sequenceMode, ...openOptions });
          const sourceStat = await fs.stat(file).catch(() => null);
          const sourceFileBytes = sourceStat?.isFile() ? sourceStat.size : 0;
          const sourceIdentity = sourceStat?.isFile() ? {path:path.resolve(file),size:sourceStat.size,mtimeMs:sourceStat.mtimeMs,ctimeMs:sourceStat.ctimeMs,ino:Number(sourceStat.ino)||0} : null;
          const id = ++nextId;
          label = uniqueFrameLabel(label || path.basename(file), [...frames.values()].map(frame => frame.label || path.basename(frame.file)));
          frames.set(id, { id, file, label, worker, generated, sequenceMode, openOptions, pathOptions:new Map([[file,openOptions]]), sourceFileBytes, undoPaths: [], redoPaths: [], undoActions: [], redoActions: [], flipState: {horizontal:false,vertical:false}, undoFlipStates:[], redoFlipStates:[], transformQueue: Promise.resolve(), latestPng: null, lastResult: null });
          activeId = id;
          panel.title = frames.size === 1 ? (label || path.basename(file)) : `vivi · ${frames.size} frames`;
          panel.webview.postMessage({ type: 'frameAdded', frameId: id, label, initialSelection, canUndo: false, canRedo: false, ...data,
            maxSize: Math.max(...data.datasets.map(item => Math.max(item.width, item.height))),
            menuVisibility: menuVisibility(),
            keyboardShortcuts: config().get('keyboardShortcuts', {}), mouseShortcuts: mouseShortcuts(), defaultFps:config().get('defaultFps', 24),
            recentCacheSeconds:config().get('recentCacheSeconds',20),sourceIdentity,flipState:frames.get(id).flipState });
        } catch (error) { worker.dispose(); throw error; }
      }
    };
    sessions.push(session);
    activeSession=session;
    setSessionContext();
    panel.onDidChangeViewState(()=>{
      if(panel.active){activeSession=session;publishSidebar(session);}
      else vscode.commands.executeCommand('setContext', 'vivi.scrollbarShortcutFocus', false);
    });
    panel.webview.options = { enableScripts: true, localResourceRoots: webviewResourceRoots(context) };
    panel.onDidDispose(() => {
      disposed = true;
      clearTimeout(idleDisposeTimer);
      for (const frame of frames.values()) frame.worker.dispose();
      for (const file of generatedPaths) fs.unlink(file).catch(error => output.appendLine(error.message));
      sessions.splice(sessions.indexOf(session), 1);
      setSessionContext();
      if(activeSession===session){activeSession=sessions.at(-1)||null;publishSidebar(activeSession);}
    });
    panel.webview.onDidReceiveMessage(async msg => {
      try {
        if (msg.type === 'ready') {
          ready = true;
          for (const item of pendingPaths.splice(0)) await session.add(item.file,false,'',null,item.mode,item.options);
        } else if (msg.type === 'scrollbarShortcutFocus') {
          await vscode.commands.executeCommand('setContext', 'vivi.scrollbarShortcutFocus', msg.active === true);
        } else if (msg.type === 'activeFrame') {
          if (frames.has(msg.frameId)) activeId = msg.frameId;
        } else if (msg.type === 'loadTiming') {
          output.appendLine(`[load] ${msg.path || 'image'} transfer+backend=${Number(msg.transferMs||0).toFixed(1)}ms decode=${Number(msg.decodeMs||0).toFixed(1)}ms paint=${Number(msg.paintMs||0).toFixed(1)}ms`);
        } else if (msg.type === 'httpTransferComplete') {
          httpTransport.complete(msg.token);
        } else if (msg.type === 'httpTransferCancel') {
          httpTransport.cancel(msg.token);
        } else if (msg.type === 'sidebarState') {
          const currentFrames=msg.state?.frames?.filter(item=>frames.has(item.id))||[];
          session.sidebarState=currentFrames.length?{...msg.state,frames:currentFrames,active:frames.has(msg.state.active)?msg.state.active:activeId}:null;
          if(activeSession===session)publishSidebar(session);
        } else if (msg.type === 'focusAdjust') {
          await vscode.commands.executeCommand('vivi.adjust.focus');
          adjust.view?.webview.postMessage({type:'focusAdjust'});
        } else if (msg.type === 'focusLayout') {
          await vscode.commands.executeCommand('vivi.layout.focus');
          layout.view?.webview.postMessage({type:'focusLayout'});
        } else if (msg.type === 'imageAction') {
          const frame=frames.get(msg.frameId||activeId);
          if(!frame)throw new Error('Select a frame first.');
          if(msg.action==='rename'){
            const name=await vscode.window.showInputBox({prompt:'Rename Frame title',value:frame.label||path.basename(frame.file)});
            if(!name?.trim())return;
            frame.label=uniqueFrameLabel(name,[...frames.values()].filter(item=>item!==frame).map(item=>item.label||path.basename(item.file)));
            panel.webview.postMessage({type:'frameRenamed',frameId:frame.id,label:frame.label});
            if(frames.size===1)panel.title=frame.label;
          }else if(msg.action==='duplicate'){
            const result=await frame.worker.request('duplicate',msg.args||{});
            generatedPaths.push(result.path);
            const original=msg.args?.selection;
            const selected=original&&(msg.args.ignoreSelection||['oval','polygon','freehand'].includes(original.type))
              ? {...original,points:original.points.map(([x,y])=>msg.args.ignoreSelection?[x,y]:[x-result.box[0],y-result.box[1]])} : null;
            await session.add(result.path,true,String(msg.title||`Copy · ${path.basename(frame.file)}`),selected);
          }
          else if(msg.action==='memory')panel.webview.postMessage({type:'memoryInfo',host:process.memoryUsage(),total:os.totalmem(),free:os.freemem()});
        } else if (msg.type === 'openDialog') {
          const uris = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: true, openLabel: 'Add Frame' });
          for (const uri of uris || []) await session.add(uri.fsPath);
        } else if (msg.type === 'importSequence') {
          const uris = await vscode.window.showOpenDialog({canSelectFiles:false,canSelectFolders:true,canSelectMany:false,openLabel:'Open Image Sequence'});
          if (uris?.[0]) {
            const choice=await vscode.window.showQuickPick([{label:'Only 2D images',mode:'2d'},{label:'All image planes',mode:'all'}],{title:'Open Folder as Stack'});
            if(choice){
              const value=await vscode.window.showInputBox({title:'Image Sequence Size',prompt:'Optional H W filter, for example: 795 795. Leave blank to use the first qualifying image.',placeHolder:'height width',validateInput:text=>{const values=text.trim().split(/\s+/).map(Number);return !text.trim()||(values.length===2&&values.every(Number.isInteger)&&values.every(number=>number>0))?null:'Enter two positive integers separated by a space.';}});
              if(value!==undefined)await session.add(uris[0].fsPath,false,'',null,choice.mode,{sequenceSize:value.trim()?value.trim().split(/\s+/).map(Number):null});
            }
          }
        } else if (msg.type === 'montage') {
          const frame = frames.get(msg.fileFrame || activeId);
          if (!frame) throw new Error('Select a frame first.');
          const result = await frame.worker.request('montage', msg.args);
          if (!result?.path) throw new Error('Montage did not return a file path.');
          generatedPaths.push(result.path);
          await session.add(result.path, true, `Montage · ${path.basename(frame.file)}`);
        } else if (msg.type === 'orthogonalDuplicate') {
          const frame = frames.get(msg.fileFrame || activeId);
          if (!frame) throw new Error('Select a frame first.');
          const result = await frame.worker.request('orthogonalDuplicate', msg.args);
          generatedPaths.push(result.path);
          await session.add(result.path, true, `${msg.args.plane.toUpperCase()} · ${frame.label}`);
        } else if (msg.type === 'stack' && ['imagesToStack','stackToImages','reslice'].includes(msg.args?.action)) {
          const frame = frames.get(msg.fileFrame || activeId);
          if (!frame) throw new Error('Select a frame first.');
          const args = {...msg.args};
          if (args.action === 'imagesToStack' && !args.paths) {
            const uris = await vscode.window.showOpenDialog({canSelectFiles:true,canSelectFolders:false,canSelectMany:true,openLabel:'Create Stack'});
            if (!uris?.length) return;
            args.paths = uris.map(uri => uri.fsPath);
          }
          const result = await frame.worker.request('stack', args);
          const paths = result?.paths || (result?.path ? [result.path] : []);
          if (!Array.isArray(paths) || !paths.length || paths.some(file => typeof file !== 'string'))
            throw new Error(`${args.action} did not return file paths.`);
          for (const file of paths) {
            generatedPaths.push(file);
            await session.add(file, true, `${args.action} · ${path.basename(frame.file)}`);
          }
          if (msg.id != null) panel.webview.postMessage({type:'result',id:msg.id,op:'stack',result});
        } else if (msg.type === 'transformFrame') {
          const frame = frames.get(msg.fileFrame || activeId);
          if (!frame) throw new Error('Select a frame first.');
          const action = msg.action;
          if (typeof action !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(action))
            throw new Error('Unsupported frame operation.');
          const update = async () => {
            panel.webview.postMessage({type:'transformBusy',frameId:frame.id,action,busy:true});
            if (!frames.has(frame.id)) throw new Error('Frame closed.');
            if (action === 'undo' && !frame.undoPaths.length) throw new Error('Nothing to undo.');
            if (action === 'redo' && !frame.redoPaths.length) throw new Error('Nothing to redo.');
            const previous = frame.file;
            let destination;
            const inverse = {flipHorizontal:'flipHorizontal',flipVertical:'flipVertical',rotateLeft:'rotateRight',rotateRight:'rotateLeft',rotate180:'rotate180',rotate:'rotate'};
            const historyAction=action==='undo'?frame.undoActions.at(-1):action==='redo'?frame.redoActions.at(-1):action;
            const displayTransform = action === 'undo' ? inverse[historyAction] : historyAction;
            if (action === 'undo') destination = frame.undoPaths.at(-1);
            else if (action === 'redo') destination = frame.redoPaths.at(-1);
            else {
              const operationArgs={...msg.args, action, preserveStack:true};
              if(action==='mergeChannels')operationArgs.paths=(msg.args.channelFrameIds||[]).map(id=>frames.get(Number(id))?.file).filter(Boolean);
              const result = await frame.worker.request('derive', operationArgs);
              destination = result?.path;
              if (!destination) throw new Error('Transform did not return a file path.');
              generatedPaths.push(destination);
              frame.pathOptions.set(destination,{});
            }
            let data;
            const destinationOptions=frame.pathOptions.get(destination)||{};
            try { data = await frame.worker.request('open', {path: destination, maxPixels: frame.worker.maxPixels,...destinationOptions}); }
            catch (error) {
              await frame.worker.request('open', {path: previous, maxPixels: frame.worker.maxPixels,...(frame.pathOptions.get(previous)||{})}).catch(restoreError => output.appendLine(restoreError.stack || restoreError.message));
              throw error;
            }
            if (action === 'undo') {
              frame.undoPaths.pop();
              frame.undoActions.pop();
              frame.redoFlipStates.push(frame.flipState);
              frame.flipState=frame.undoFlipStates.pop() || {horizontal:false,vertical:false};
              frame.redoPaths = [...frame.redoPaths, previous].slice(-10);
              frame.redoActions = [...frame.redoActions, historyAction].slice(-10);
            } else {
              if (action === 'redo') { frame.redoPaths.pop(); frame.redoActions.pop(); }
              else { frame.redoPaths = []; frame.redoActions = []; frame.redoFlipStates=[]; }
              frame.undoFlipStates.push(frame.flipState);
              frame.undoFlipStates=frame.undoFlipStates.slice(-10);
              if(action==='redo')frame.flipState=frame.redoFlipStates.pop() || frame.flipState;
              else if(action==='flipHorizontal')frame.flipState={...frame.flipState,horizontal:!frame.flipState.horizontal};
              else if(action==='flipVertical')frame.flipState={...frame.flipState,vertical:!frame.flipState.vertical};
              else if(action==='rotateLeft'||action==='rotateRight')frame.flipState={horizontal:frame.flipState.vertical,vertical:frame.flipState.horizontal};
              frame.undoPaths = [...frame.undoPaths, previous].slice(-10);
              frame.undoActions = [...frame.undoActions, historyAction].slice(-10);
            }
            if (!frame.label) frame.label = path.basename(frame.undoPaths[0] || previous);
            frame.file = destination;
            frame.openOptions=destinationOptions;
            frame.generated = true;
            frame.latestPng = null;
            frame.lastResult = null;
            panel.webview.postMessage({type:'frameUpdated',frameId:frame.id,label:frame.label,
              canUndo:frame.undoPaths.length>0,canRedo:frame.redoPaths.length>0,displayTransform,flipState:frame.flipState,...data});
          };
          const queued = frame.transformQueue.then(update);
          frame.transformQueue = queued.catch(() => {});
          try { await queued; }
          finally { panel.webview.postMessage({type:'transformBusy',frameId:frame.id,action,busy:false}); }
        } else if (msg.type === 'selectionMask') {
          const frame = frames.get(msg.fileFrame || activeId);
          if (!frame) throw new Error('Select a frame first.');
          const result = await frame.worker.request('mask', msg.args);
          const destination = path.join(os.tmpdir(), `vivi-roi-mask-${crypto.randomUUID()}.png`);
          await fs.writeFile(destination, Buffer.from(result.png, 'base64'), { flag: 'wx' });
          generatedPaths.push(destination);
          await session.add(destination, true, `Mask · ${path.basename(frame.file)}`);
        } else if (msg.type === 'deriveNewFrame') {
          const frame = frames.get(msg.fileFrame || activeId);
          if (!frame) throw new Error('Select a frame first.');
          const result = await frame.worker.request('derive', msg.args);
          generatedPaths.push(result.path);
          await session.add(result.path, true, `${msg.label} · ${path.basename(frame.file)}`);
        } else if (msg.type === 'cloneFrame') {
          const frame = frames.get(msg.frameId || activeId);
          if (frame) {
            const source=(frame.label||path.basename(frame.file)).replace(/ \[copy \d+\]$/,'');
            const labels=new Set([...frames.values()].map(item=>item.label));
            let serial=1;while(labels.has(`${source} [copy ${serial}]`))serial++;
            await session.add(frame.file, frame.generated, `${source} [copy ${serial}]`, null, frame.sequenceMode, frame.openOptions);
          }
        } else if (msg.type === 'closeFrame') {
          removeFrame(msg.frameId,msg.retainRecentSeconds,false);
        } else if (msg.type === 'request' && ['render','renderStack','pixel','measure','histogram','profile','stack','lutPreview','orthogonal'].includes(msg.op)) {
          const frame = frames.get(msg.fileFrame);
          if (!frame) throw new Error('Frame closed.');
          const args = { ...msg.args };
          if (msg.op === 'render' || msg.op === 'renderStack') {
            args.binary = true;
            Object.assign(args, previewCompressionOptions({
              lossless: config().get('losslessCompression', true),
              losslessMethod: config().get('losslessMethod', 'zstd1-shuffle'),
              lossy: config().get('lossyCompression', false),
              minMiB: config().get('lossyMinFileMiB', 128),
              method: config().get('lossyMethod', 'zfp'),
              tolerance: config().get('lossyTolerance', 1e-4)
            }, frame.sourceFileBytes));
          }
          const mode=config().get('transportMode','http'),useHttp=mode==='http'&&!!httpTransport.externalBase;
          const transportResult=async result=>{
            if(!useHttp||!(result?.payload instanceof ArrayBuffer))return result;
            const {payload,...metadata}=result;
            const httpPayload=httpTransport.offer(Buffer.from(payload),transportOwner(frame.id),()=>{
              if(frames.get(frame.id)===frame)removeFrame(frame.id,0,true);
            });
            return {...metadata,httpPayload};
          };
          const forwarding=[],stackEvents=[];
          const result = msg.op === 'renderStack'
            ? await frame.worker.requestStream(msg.op, args, event => {
                if (disposed||frames.get(msg.fileFrame)!==frame)return;
                if(useHttp&&event.streamEvent==='frame'){stackEvents.push({frame:event.frame,total:event.total,result:event.result});return;}
                if(useHttp&&event.streamEvent==='end')return;
                forwarding.push(panel.webview.postMessage({type:'stream',id:msg.id,event:event.streamEvent,
                  frame:event.frame,total:event.total,result:event.result}));
              })
            : await frame.worker.request(msg.op, args);
          if(msg.op==='renderStack')await Promise.all(forwarding);
          if(frames.get(msg.fileFrame)!==frame)return;
          if(msg.op==='renderStack'&&useHttp){
            const total=stackEvents.length;
            const httpStack=httpTransport.offer(packStackPayload(stackEvents),transportOwner(frame.id),()=>{
              if(frames.get(frame.id)===frame)removeFrame(frame.id,0,true);
            });
            stackEvents.length=0;
            await panel.webview.postMessage({type:'stream',id:msg.id,event:'httpStack',result:{httpStack,total}});
          }
          const outgoing=await transportResult(result);
          if (msg.op === 'render' && !msg.prefetch) frame.latestPng = outgoing.png;
          if (['measure','histogram','profile'].includes(msg.op)) frame.lastResult = { op: msg.op, result };
          if (!disposed) panel.webview.postMessage({ type: 'result', id: msg.id, op: msg.op, result:outgoing });
        } else if (msg.type === 'export') {
          const frame = frames.get(msg.fileFrame || activeId);
          if (!frame) throw new Error('Select a frame first.');
          let content, extension;
          if (msg.kind === 'png' && (msg.png || frame.latestPng)) {
            content = Buffer.from(msg.png || frame.latestPng, 'base64'); extension = 'png';
          } else if (msg.kind === 'csv' && frame.lastResult) {
            const { op, result: r } = frame.lastResult;
            let rows;
            if (op === 'histogram') rows = [['source','dataset','frame','roi','bin_start','bin_end','count','sampling_step'], ...r.counts.map((n,i) => [frame.file,r.dataset,r.frame,r.box.join(' '),r.edges[i],r.edges[i+1],n,r.step])];
            else if (op === 'profile') rows = [['source','dataset','frame','endpoints','distance_pixels','value'], ...r.values.map((n,i)=>[frame.file,r.dataset,r.frame,r.points.join(' '),r.distance[i],n])];
            else { const flat = { source: frame.file, ...r, x0:r.box[0],y0:r.box[1],x1:r.box[2],y1:r.box[3] }; delete flat.box; rows = [Object.keys(flat), Object.values(flat)]; }
            content = Buffer.from(rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n'); extension = 'csv';
          } else throw new Error('Render a preview or run an analysis first.');
          const source = uriFor(frame.file);
          const target = await vscode.window.showSaveDialog({ defaultUri: source.with({ path: source.path + `.preview.${extension}` }), filters: { [extension.toUpperCase()]: [extension] } });
          if (target) {
            if (target.toString() === source.toString()) throw new Error('Export cannot overwrite the source image.');
            const original = await fs.realpath(frame.file);
            const destination = await fs.realpath(target.fsPath).catch(() => null);
            if (original === destination) throw new Error('Export cannot overwrite the source image through a symlink.');
            await vscode.workspace.fs.writeFile(target, content);
            vscode.window.showInformationMessage(`Saved ${target.fsPath}`);
          }
        }
      } catch (error) {
        if(msg.type==='request'&&msg.fileFrame&&!frames.has(Number(msg.fileFrame)))return;
        output.appendLine(error.stack || error.message);
        if (!disposed) panel.webview.postMessage({ type: 'error', id: msg.id, message: error.message });
      }
    });
    html(panel.webview, context, 'viewer', httpCsp).then(content => { if (!disposed) panel.webview.html = content; }).catch(report);
    return session;
  }
  context.subscriptions.push(vscode.window.registerCustomEditorProvider('vivi.viewer', {
    openCustomDocument(uri) { return { uri, dispose() {} }; },
    async resolveCustomEditor(document, panel) {
      if (!managed(document.uri.fsPath) || !viewerFor(document.uri.fsPath)) {
        await openNormally(document.uri);
        panel.dispose();
        return;
      }
      createSession(panel, document.uri.fsPath);
    }
  }, { webviewOptions: { retainContextWhenHidden: true }, supportsMultipleEditorsPerDocument: false }));
}
module.exports = { activate, nativePath };
