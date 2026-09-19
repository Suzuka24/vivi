'use strict';
const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { Backend } = require('./backend');
const { viewerFor, isManaged, nativeEditorFor } = require('./formats');
const { listDirectory } = require('./explorerListing');

function nativePath(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Enter a path on the extension host.');
  input = input.trim();
  if (input === '~') return os.homedir();
  if (/^~[\\/]/.test(input)) input = path.join(os.homedir(), input.slice(2));
  return path.resolve(input);
}

function html(webview, context, name) {
  const nonce = crypto.randomBytes(20).toString('hex');
  const uri = file => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', file)).toString();
  return fs.readFile(path.join(context.extensionPath, 'media', `${name}.html`), 'utf8').then(text => text
    .replaceAll('{{nonce}}', nonce).replaceAll('{{csp}}', webview.cspSource)
    .replaceAll('{{script}}', uri(`${name}.js`)).replaceAll('{{style}}', uri('style.css'))
    .replaceAll('{{extraStyle}}', uri(`${name}.css`))
    .replaceAll('{{roiScript}}', uri('roiGeometry.js')));
}

function activate(context) {
  const output = vscode.window.createOutputChannel('vivi');
  context.subscriptions.push(output);
  const config = () => vscode.workspace.getConfiguration('vivi');
  const managed = file => isManaged(file, config().get('managedExtensions', []));
  const menuItems = () => config().get('explorerContextMenu', []);
  const sessions = [];
  let activeSession = null;
  const sidebarViews = [];
  const publishSidebar = session => { for (const provider of sidebarViews) provider.view?.webview.postMessage(session?.sidebarState ? {type:'sidebarState',state:session.sidebarState}:{type:'sidebarClear'}); };
  const newBackend = () => {
    const c = config();
    // python3 is the portable Linux default; Windows installations commonly use python.exe.
    const configured = c.get('pythonPath', '') || vscode.workspace.getConfiguration('imageViewer').get('pythonPath', 'python3');
    const python = process.platform === 'win32' && configured === 'python3' ? 'python' : configured;
    return new Backend(python, path.join(context.extensionPath, 'backend', 'worker.py'), c.get('requestTimeoutSeconds', 120)*1000, s => output.append(s), c.get('maxDecodedPixels', 64000000));
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
  async function open(input, newTab = false) {
    const file = nativePath(input);
    if (!(await fs.stat(file)).isFile()) throw new Error('Select a file.');
    const uri = uriFor(file);
    if (managed(file)) {
      if (!newTab && sessions.length) {
        const session = sessions.at(-1);
        await session.add(file);
        session.panel.reveal();
      } else {
        const panel = vscode.window.createWebviewPanel('vivi.session', path.basename(file), vscode.ViewColumn.Active,
          { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] });
        createSession(panel, file);
      }
    } else await openNormally(uri, newTab);
  }
  const report = error => vscode.window.showErrorMessage(`vivi: ${error.message}`);

  class Explorer {
    constructor(kind = 'explorer') { this.kind = kind; this.listSerial = 0; }
    async resolveWebviewView(view) {
      this.view = view;
      view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] };
      view.webview.onDidReceiveMessage(async msg => {
        try {
          if (msg.type === 'ready' && this.kind === 'explorer') await this.list(context.workspaceState.get('explorerPath', config().get('defaultPath', '~')),
            0, context.workspaceState.get('explorerSort', 'nameAsc'), context.workspaceState.get('explorerShowHidden', true));
          if (msg.type === 'ready') publishSidebar(activeSession);
          if (msg.type === 'list' && this.kind === 'explorer') await this.list(msg.path, msg.offset || 0, msg.sortMode, msg.showHidden);
          if (msg.type === 'open') await open(msg.path, msg.newTab === true);
          if (msg.type === 'action') await this.action(msg);
          if (msg.type === 'sideAction') activeSession?.panel.webview.postMessage({type:'sideAction',action:msg.action,value:msg.value});
        } catch (error) { view.webview.postMessage({ type: 'error', message: error.message }); }
      }, undefined, context.subscriptions);
      view.webview.html = (await html(view.webview, context, 'explorer')).replace('{{viewKind}}', this.kind);
    }
    async action(msg) {
      const action = msg.action;
      if (!menuItems().includes(action) && !['newFile', 'newFolder', 'refresh', 'copyToTerminal'].includes(action)) throw new Error('Explorer action is disabled.');
      const target = nativePath(msg.path);
      if (action === 'refresh') return this.list(msg.folder || target);
      if (action === 'copyPath') return vscode.env.clipboard.writeText(target);
      if (action === 'copyName') return vscode.env.clipboard.writeText(path.basename(target));
      if (action === 'copyToTerminal') {
        const existing = vscode.window.activeTerminal;
        const terminal = existing || vscode.window.createTerminal('vivi');
        const quoted = `'${target.replaceAll("'", process.platform === 'win32' ? "''" : "'\\''")}'`;
        terminal.show();
        if (!existing) {
          await terminal.processId;
          // A new remote shell can still be running its startup commands after its process appears.
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        terminal.sendText(quoted, false);
        return;
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
        const choice = await vscode.window.showWarningMessage(`Move ${path.basename(target)} to Trash?`, { modal: true }, 'Move to Trash');
        if (choice !== 'Move to Trash') return;
        try { await vscode.workspace.fs.delete(uriFor(target), { recursive: true, useTrash: true }); }
        catch {
          const confirm = await vscode.window.showWarningMessage(
            `Could not move ${path.basename(target)} to Trash. Delete permanently?`,
            { modal: true }, 'Delete Permanently');
          if (confirm !== 'Delete Permanently') return;
          await vscode.workspace.fs.delete(uriFor(target), { recursive: true, useTrash: false });
        }
        return this.list(path.dirname(target));
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
  function createSession(panel, firstFile) {
    const frames = new Map();
    const pendingPaths = [firstFile];
    const generatedPaths = [];
    let ready = false, disposed = false, nextId = 0, activeId = null;
    const session = {
      panel,
      sidebarState:null,
      async add(file, generated = false, label = '', initialSelection = null) {
        if (disposed) throw new Error('Viewer closed.');
        if (!ready) { pendingPaths.push(file); return; }
        const worker = newBackend();
        try {
          const data = await worker.request('open', { path: file, maxPixels: worker.maxPixels });
          const id = ++nextId;
          frames.set(id, { id, file, label, worker, generated, undoPaths: [], redoPaths: [], transformQueue: Promise.resolve(), latestPng: null, lastResult: null });
          activeId = id;
          panel.title = frames.size === 1 ? (label || path.basename(file)) : `vivi · ${frames.size} frames`;
          panel.webview.postMessage({ type: 'frameAdded', frameId: id, label, initialSelection, canUndo: false, canRedo: false, ...data,
            maxSize: config().get('maxPreviewSize', 1600), preloadMaxMiB: config().get('preloadMaxMiB', 512),
            keyboardShortcuts: config().get('keyboardShortcuts', {}) });
        } catch (error) { worker.dispose(); throw error; }
      }
    };
    sessions.push(session);
    activeSession=session;
    panel.onDidChangeViewState(()=>{if(panel.active){activeSession=session;publishSidebar(session);}});
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] };
    panel.onDidDispose(() => {
      disposed = true;
      for (const frame of frames.values()) frame.worker.dispose();
      for (const file of generatedPaths) fs.unlink(file).catch(error => output.appendLine(error.message));
      sessions.splice(sessions.indexOf(session), 1);
      if(activeSession===session){activeSession=sessions.at(-1)||null;publishSidebar(activeSession);}
    });
    panel.webview.onDidReceiveMessage(async msg => {
      try {
        if (msg.type === 'ready') {
          ready = true;
          for (const file of pendingPaths.splice(0)) await session.add(file);
        } else if (msg.type === 'activeFrame') {
          if (frames.has(msg.frameId)) activeId = msg.frameId;
        } else if (msg.type === 'sidebarState') {
          session.sidebarState=msg.state;
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
            const name=await vscode.window.showInputBox({prompt:'Rename image file',value:path.basename(frame.file)});
            if(!name||name===path.basename(frame.file))return;
            if(name!==path.basename(name)||name==='.'||name==='..')throw new Error('Enter one file name.');
            const destination=path.join(path.dirname(frame.file),name);
            await fs.rename(frame.file,destination);
            const data=await frame.worker.request('open',{path:destination,maxPixels:frame.worker.maxPixels});
            frame.file=destination;
            panel.webview.postMessage({type:'frameRenamed',frameId:frame.id,...data});
            if(frames.size===1)panel.title=name;
            explorer.list(path.dirname(destination)).catch(report);
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
        } else if (msg.type === 'montage') {
          const frame = frames.get(msg.fileFrame || activeId);
          if (!frame) throw new Error('Select a frame first.');
          const result = await frame.worker.request('montage', msg.args);
          if (!result?.path) throw new Error('Montage did not return a file path.');
          generatedPaths.push(result.path);
          await session.add(result.path, true, `Montage · ${path.basename(frame.file)}`);
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
          if (!['flipHorizontal','flipVertical','rotateLeft','rotateRight','rotate180','undo','redo'].includes(action))
            throw new Error('Unsupported frame transform.');
          const update = async () => {
            if (!frames.has(frame.id)) throw new Error('Frame closed.');
            if (action === 'undo' && !frame.undoPaths.length) throw new Error('Nothing to undo.');
            if (action === 'redo' && !frame.redoPaths.length) throw new Error('Nothing to redo.');
            const previous = frame.file;
            let destination;
            if (action === 'undo') destination = frame.undoPaths.at(-1);
            else if (action === 'redo') destination = frame.redoPaths.at(-1);
            else {
              const result = await frame.worker.request('derive', {...msg.args, action, preserveStack:true});
              destination = result?.path;
              if (!destination) throw new Error('Transform did not return a file path.');
              generatedPaths.push(destination);
            }
            let data;
            try { data = await frame.worker.request('open', {path: destination, maxPixels: frame.worker.maxPixels}); }
            catch (error) {
              await frame.worker.request('open', {path: previous, maxPixels: frame.worker.maxPixels}).catch(restoreError => output.appendLine(restoreError.stack || restoreError.message));
              throw error;
            }
            if (action === 'undo') {
              frame.undoPaths.pop();
              frame.redoPaths = [...frame.redoPaths, previous].slice(-10);
            } else {
              if (action === 'redo') frame.redoPaths.pop();
              else frame.redoPaths = [];
              frame.undoPaths = [...frame.undoPaths, previous].slice(-10);
            }
            if (!frame.label) frame.label = path.basename(frame.undoPaths[0] || previous);
            frame.file = destination;
            frame.generated = true;
            frame.latestPng = null;
            frame.lastResult = null;
            panel.webview.postMessage({type:'frameUpdated',frameId:frame.id,label:frame.label,
              canUndo:frame.undoPaths.length>0,canRedo:frame.redoPaths.length>0,...data});
          };
          const queued = frame.transformQueue.then(update);
          frame.transformQueue = queued.catch(() => {});
          await queued;
        } else if (msg.type === 'selectionMask') {
          const frame = frames.get(msg.fileFrame || activeId);
          if (!frame) throw new Error('Select a frame first.');
          const result = await frame.worker.request('mask', msg.args);
          const destination = path.join(os.tmpdir(), `vivi-roi-mask-${crypto.randomUUID()}.png`);
          await fs.writeFile(destination, Buffer.from(result.png, 'base64'), { flag: 'wx' });
          generatedPaths.push(destination);
          await session.add(destination, true, `Mask · ${path.basename(frame.file)}`);
        } else if (msg.type === 'derive') {
          const frame = frames.get(msg.fileFrame || activeId);
          if (!frame) throw new Error('Select a frame first.');
          const result = await frame.worker.request('derive', msg.args);
          generatedPaths.push(result.path);
          await session.add(result.path, true, `${msg.label} · ${path.basename(frame.file)}`);
        } else if (msg.type === 'cloneFrame') {
          const frame = frames.get(msg.frameId || activeId);
          if (frame) await session.add(frame.file, frame.generated, `Copy · ${path.basename(frame.file)}`);
        } else if (msg.type === 'closeFrame') {
          const frame = frames.get(msg.frameId);
          if (!frame) return;
          frame.worker.dispose(); frames.delete(msg.frameId);
          if (frames.size) {
            if (!frames.has(activeId)) activeId = frames.keys().next().value;
            panel.title = frames.size === 1 ? (frames.get(activeId).label || path.basename(frames.get(activeId).file)) : `vivi · ${frames.size} frames`;
          } else panel.dispose();
        } else if (msg.type === 'request' && ['render','pixel','measure','histogram','profile','stack','lutPreview'].includes(msg.op)) {
          const frame = frames.get(msg.fileFrame);
          if (!frame) throw new Error('Frame closed.');
          const args = { ...msg.args };
          if (msg.op === 'render') args.size = Math.min(config().get('maxPreviewSize',1600), Number(args.size) || 1600);
          const result = await frame.worker.request(msg.op, args);
          if (msg.op === 'render' && !msg.prefetch) frame.latestPng = result.png;
          if (['measure','histogram','profile'].includes(msg.op)) frame.lastResult = { op: msg.op, result };
          if (!disposed) panel.webview.postMessage({ type: 'result', id: msg.id, op: msg.op, result });
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
        output.appendLine(error.stack || error.message);
        if (!disposed) panel.webview.postMessage({ type: 'error', id: msg.id, message: error.message });
      }
    });
    html(panel.webview, context, 'viewer').then(content => { if (!disposed) panel.webview.html = content; }).catch(report);
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
