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
    .replaceAll('{{script}}', uri(`${name}.js`)).replaceAll('{{style}}', uri('style.css')));
}

function activate(context) {
  const output = vscode.window.createOutputChannel('vivi');
  context.subscriptions.push(output);
  const config = () => vscode.workspace.getConfiguration('vivi');
  const managed = file => isManaged(file, config().get('managedExtensions', []));
  const menuItems = () => config().get('explorerContextMenu', []);
  const sessions = [];
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
    constructor() { this.listSerial = 0; }
    async resolveWebviewView(view) {
      this.view = view;
      view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] };
      view.webview.onDidReceiveMessage(async msg => {
        try {
          if (msg.type === 'ready') await this.list(context.workspaceState.get('explorerPath', config().get('defaultPath', '~')),
            0, context.workspaceState.get('explorerSort', 'nameAsc'), context.workspaceState.get('explorerShowHidden', true));
          if (msg.type === 'list') await this.list(msg.path, msg.offset || 0, msg.sortMode, msg.showHidden);
          if (msg.type === 'open') await open(msg.path, msg.newTab === true);
          if (msg.type === 'action') await this.action(msg);
        } catch (error) { view.webview.postMessage({ type: 'error', message: error.message }); }
      }, undefined, context.subscriptions);
      view.webview.html = await html(view.webview, context, 'explorer');
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
      this.view?.webview.postMessage({ type: 'list', path: folder, parent: path.dirname(folder), entries,
        offset:page.offset, more:page.more, sortMode:page.sortMode, showHidden:page.showHidden, menuItems: menuItems() });
    }
  }
  const explorer = new Explorer();
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('vivi.explorer', explorer, { webviewOptions: { retainContextWhenHidden: true } }));
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
      async add(file, generated = false, label = '') {
        if (disposed) throw new Error('Viewer closed.');
        if (!ready) { pendingPaths.push(file); return; }
        const worker = newBackend();
        try {
          const data = await worker.request('open', { path: file, maxPixels: worker.maxPixels });
          const id = ++nextId;
          frames.set(id, { id, file, worker, generated, latestPng: null, lastResult: null });
          activeId = id;
          panel.title = frames.size === 1 ? path.basename(file) : `vivi · ${frames.size} frames`;
          panel.webview.postMessage({ type: 'frameAdded', frameId: id, label, ...data,
            maxSize: config().get('maxPreviewSize', 1600), preloadMaxMiB: config().get('preloadMaxMiB', 512) });
        } catch (error) { worker.dispose(); throw error; }
      }
    };
    sessions.push(session);
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] };
    panel.onDidDispose(() => {
      disposed = true;
      for (const frame of frames.values()) frame.worker.dispose();
      for (const file of generatedPaths) fs.unlink(file).catch(error => output.appendLine(error.message));
      sessions.splice(sessions.indexOf(session), 1);
    });
    panel.webview.onDidReceiveMessage(async msg => {
      try {
        if (msg.type === 'ready') {
          ready = true;
          for (const file of pendingPaths.splice(0)) await session.add(file);
        } else if (msg.type === 'activeFrame') {
          if (frames.has(msg.frameId)) activeId = msg.frameId;
        } else if (msg.type === 'openDialog') {
          const uris = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: true, openLabel: 'Add Frame' });
          for (const uri of uris || []) await session.add(uri.fsPath);
        } else if (msg.type === 'montage') {
          const frame = frames.get(msg.fileFrame || activeId);
          if (!frame) throw new Error('Select a frame first.');
          const result = await frame.worker.request('montage', msg.args);
          const destination = path.join(os.tmpdir(), `vivi-montage-${crypto.randomUUID()}.png`);
          await fs.writeFile(destination, Buffer.from(result.png, 'base64'), { flag: 'wx' });
          generatedPaths.push(destination);
          await session.add(destination, true, `Montage · ${path.basename(frame.file)}`);
        } else if (msg.type === 'cloneFrame') {
          const frame = frames.get(msg.frameId || activeId);
          if (frame) await session.add(frame.file, frame.generated, `Copy · ${path.basename(frame.file)}`);
        } else if (msg.type === 'closeFrame') {
          const frame = frames.get(msg.frameId);
          if (!frame) return;
          frame.worker.dispose(); frames.delete(msg.frameId);
          if (frames.size) {
            activeId = frames.keys().next().value;
            panel.title = frames.size === 1 ? path.basename(frames.get(activeId).file) : `vivi · ${frames.size} frames`;
          } else panel.dispose();
        } else if (msg.type === 'request' && ['render','pixel','measure','histogram','profile'].includes(msg.op)) {
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
