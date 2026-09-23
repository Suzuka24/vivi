'use strict';
const { spawn } = require('node:child_process');
const os = require('node:os');

class Backend {
  constructor(python, script, timeout, log, maxPixels, protectResources = false) {
    this.pending = new Map();
    this.nextId = 0;
    this.timeout = timeout;
    this.maxPixels = maxPixels;
    this.dead = false;
    this.headerParts = [];
    this.headerBytes = 0;
    this.binaryMessage = null;
    this.outputPaused = false;
    this.queuedChunks = [];
    this.child = spawn(python, ['-u', script], { shell: false, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    if (protectResources) {
      try { os.setPriority(this.child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); }
      catch {}
    }
    this.child.stderr.on('data', data => log(String(data)));
    this.child.on('error', error => this.stop(new Error(`Python backend: ${error.message}. Configure vivi.pythonPath on this machine.`)));
    this.child.on('exit', code => this.stop(new Error(`Python backend exited (${code}). Check Python dependencies in README; reopen the image to restart.`)));
    this.child.stdin.on('error', error => this.stop(error));
    this.child.stdout.on('data', chunk => this.accept(chunk));
  }
  accept(chunk) {
    if (this.outputPaused) this.queuedChunks.push(chunk);
    else this.consume(chunk);
  }
  resumeOutput() {
    if (this.dead) return;
    this.outputPaused = false;
    const queued = this.queuedChunks;
    this.queuedChunks = [];
    for (let index = 0; index < queued.length; index++) {
      this.consume(queued[index]);
      if (this.outputPaused) {
        this.queuedChunks.unshift(...queued.slice(index + 1));
        return;
      }
    }
    this.child.stdout.resume();
  }
  consume(chunk) {
    let offset = 0;
    while (offset < chunk.length && !this.dead) {
      if (this.binaryMessage) {
        const state = this.binaryMessage;
        this.touchStream(state.msg.id);
        const take = Math.min(chunk.length - offset, state.length - state.bytes);
        state.parts.push(chunk.subarray(offset, offset + take));
        state.bytes += take;
        offset += take;
        if (state.bytes < state.length) return;
        const payload = Buffer.concat(state.parts, state.length);
        const {msg} = state;
        msg.result.payload = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
        this.binaryMessage = null;
        const paused = this.dispatch(msg);
        if (paused) {
          if (offset < chunk.length) this.queuedChunks.push(chunk.subarray(offset));
          return;
        }
      } else {
        const newline = chunk.indexOf(10, offset);
        if (newline < 0) {
          this.headerParts.push(chunk.subarray(offset));
          this.headerBytes += chunk.length - offset;
          if (this.headerBytes > 1024 * 1024) this.stop(new Error('Invalid backend header'));
          return;
        }
        let msg;
        const header = Buffer.concat([...this.headerParts, chunk.subarray(offset, newline)], this.headerBytes + newline - offset);
        this.headerParts = [];
        this.headerBytes = 0;
        offset = newline + 1;
        try { msg = JSON.parse(header.toString('utf8')); }
        catch { this.stop(new Error('Invalid backend JSON')); return; }
        if (msg.binaryLength !== undefined) {
          if (!Number.isSafeInteger(msg.binaryLength) || msg.binaryLength < 0 || !msg.result) {
            this.stop(new Error('Invalid backend binary length')); return;
          }
          if (msg.binaryLength) this.binaryMessage = {msg, length: msg.binaryLength, parts: [], bytes: 0};
          else {
            msg.result.payload = new ArrayBuffer(0);
            const paused = this.dispatch(msg);
            if (paused) {
              if (offset < chunk.length) this.queuedChunks.push(chunk.subarray(offset));
              return;
            }
          }
        } else {
          const paused = this.dispatch(msg);
          if (paused) {
            if (offset < chunk.length) this.queuedChunks.push(chunk.subarray(offset));
            return;
          }
        }
      }
    }
  }
  touchStream(id) {
    if (!this.pending) return;
    const item = this.pending.get(id);
    if (!item?.onEvent) return;
    clearTimeout(item.timer);
    item.timer = setTimeout(() => this.stop(new Error('Backend stream timed out and was stopped. Reopen the image or increase vivi.requestTimeoutSeconds.')), this.timeout);
  }
  complete(msg) {
    const item = this.pending.get(msg.id);
    if (!item) return;
    clearTimeout(item.timer);
    this.pending.delete(msg.id);
    if (msg.error) item.reject(new Error(msg.error)); else item.resolve(msg.result);
  }
  dispatch(msg) {
    if (!this.pending) { this.complete(msg); return; }
    const item = this.pending.get(msg.id);
    if (!item || !msg.streamEvent) { this.complete(msg); return; }
    this.touchStream(msg.id);
    let eventResult;
    try { eventResult = item.onEvent(msg); }
    catch (error) { this.pending.delete(msg.id); clearTimeout(item.timer); item.reject(error); return; }
    const finish = () => {
      if (msg.streamEvent !== 'end') return;
      this.pending.delete(msg.id); clearTimeout(item.timer); item.resolve(msg.result);
    };
    if (eventResult?.then) {
      this.outputPaused = true;
      this.child.stdout.pause();
      Promise.resolve(eventResult).then(() => { finish(); this.resumeOutput(); }, error => this.stop(error));
      return true;
    }
    finish();
    return false;
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
  requestStream(op, args = {}, onEvent = () => {}) {
    if (this.dead) return Promise.reject(new Error('Backend stopped. Reopen this image to restart.'));
    if (this.pending.size >= 8) return Promise.reject(new Error('Backend busy; please wait.'));
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => this.stop(new Error('Backend stream timed out and was stopped. Reopen the image or increase vivi.requestTimeoutSeconds.')), this.timeout);
      this.pending.set(id, { resolve, reject, timer, onEvent });
      this.child.stdin.write(JSON.stringify({ ...args, op, id }) + '\n');
    });
  }
  stop(error = new Error('Image closed')) {
    if (this.dead) return;
    this.dead = true;
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); }
    this.pending.clear();
    this.child.kill();
  }
  dispose() { this.stop(); }
}
module.exports = { Backend };
