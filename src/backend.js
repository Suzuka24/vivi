'use strict';
const { spawn } = require('node:child_process');
const readline = require('node:readline');

class Backend {
  constructor(python, script, timeout, log, maxPixels) {
    this.pending = new Map();
    this.nextId = 0;
    this.timeout = timeout;
    this.maxPixels = maxPixels;
    this.dead = false;
    this.child = spawn(python, ['-u', script], { shell: false, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    this.child.stderr.on('data', data => log(String(data)));
    this.child.on('error', error => this.stop(new Error(`Python backend: ${error.message}. Configure vivi.pythonPath on this machine.`)));
    this.child.on('exit', code => this.stop(new Error(`Python backend exited (${code}). Check Python dependencies in README; reopen the image to restart.`)));
    this.child.stdin.on('error', error => this.stop(error));
    this.lines = readline.createInterface({ input: this.child.stdout });
    this.lines.on('line', line => {
      let msg;
      try { msg = JSON.parse(line); } catch { this.stop(new Error('Invalid backend JSON')); return; }
      const item = this.pending.get(msg.id);
      if (!item) return;
      clearTimeout(item.timer);
      this.pending.delete(msg.id);
      if (msg.error) item.reject(new Error(msg.error)); else item.resolve(msg.result);
    });
  }
  request(op, args = {}) {
    if (this.dead) return Promise.reject(new Error('Backend stopped. Reopen this image to restart.'));
    if (this.pending.size >= 8) return Promise.reject(new Error('Backend busy; please wait.'));
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => this.stop(new Error('Backend request timed out and was stopped. Reopen the image or increase vivi.requestTimeoutSeconds.')), this.timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ ...args, op, id }) + '\n');
    });
  }
  stop(error = new Error('Image closed')) {
    if (this.dead) return;
    this.dead = true;
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); }
    this.pending.clear();
    this.lines?.close();
    this.child.kill();
  }
  dispose() { this.stop(); }
}
module.exports = { Backend };
