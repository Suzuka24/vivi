'use strict';

const DEFAULT_CHUNK_BYTES = 256 * 1024;
const DEFAULT_DELAY_MS = 5;

class CooperativeTransferScheduler {
  constructor(chunkBytes = DEFAULT_CHUNK_BYTES, delayMs = DEFAULT_DELAY_MS) {
    this.chunkBytes = chunkBytes;
    this.delayMs = delayMs;
    this.queue = [];
    this.running = false;
    this.serial = 0;
  }
  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({task, resolve, reject});
      this.pump();
    });
  }
  async pump() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      const item = this.queue.shift();
      try { item.resolve(await item.task()); }
      catch (error) { item.reject(error); }
      if (this.delayMs) await new Promise(resolve => setTimeout(resolve, this.delayMs));
      else await new Promise(resolve => setImmediate(resolve));
    }
    this.running = false;
  }
  async post(postMessage, message) {
    const payload = message?.result?.payload;
    if (!(payload instanceof ArrayBuffer) || payload.byteLength <= this.chunkBytes)
      return this.enqueue(() => postMessage(message));
    const transferId = ++this.serial;
    const metadata = {...message, result:{...message.result}};
    delete metadata.result.payload;
    const count = Math.ceil(payload.byteLength / this.chunkBytes);
    for (let index = 0; index < count; index++) {
      const start = index * this.chunkBytes;
      const chunk = payload.slice(start, Math.min(payload.byteLength, start + this.chunkBytes));
      await this.enqueue(() => postMessage({type:'transportChunk', transferId, index, count,
        totalBytes:payload.byteLength, message:index === 0 ? metadata : undefined, chunk}));
    }
    return true;
  }
}

module.exports = {CooperativeTransferScheduler, DEFAULT_CHUNK_BYTES, DEFAULT_DELAY_MS};
