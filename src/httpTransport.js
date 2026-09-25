'use strict';
const http = require('node:http');
const crypto = require('node:crypto');

class HttpPayloadTransport {
  constructor(log = () => {}) {
    this.log = log;
    this.server = null;
    this.origin = '';
    this.externalBase = '';
    this.entries = new Map();
  }
  async listen() {
    if (this.server) return this.origin;
    this.server = http.createServer((request, response) => this.handle(request, response));
    await new Promise((resolve, reject) => {
      const fail = error => { this.server = null; reject(error); };
      this.server.once('error', fail);
      this.server.listen(0, '127.0.0.1', () => { this.server.off('error', fail); resolve(); });
    });
    const address = this.server.address();
    this.origin = `http://127.0.0.1:${address.port}/`;
    return this.origin;
  }
  setExternalBase(value) {
    const url = new URL(String(value));
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    this.externalBase = url.toString();
  }
  get cspSource() {
    if (!this.externalBase) return '';
    const url = new URL(this.externalBase);
    return `${url.protocol}//${url.host}`;
  }
  offer(payload, owner, onAbort = () => {}, ttlMs = 120000) {
    if (!this.externalBase) throw new Error('HTTP image transport is unavailable.');
    const token = crypto.randomBytes(24).toString('hex');
    const buffers=(Array.isArray(payload)?payload:[payload]).map(value=>Buffer.isBuffer(value)?value:Buffer.from(value));
    const byteLength=buffers.reduce((sum,value)=>sum+value.byteLength,0);
    const timer = setTimeout(() => this.remove(token), ttlMs);
    timer.unref?.();
    this.entries.set(token, {buffers, byteLength, owner:String(owner), onAbort, timer, response:null, started:false, finished:false});
    const url = new URL(this.externalBase);
    url.pathname += `vivi-transfer/${token}`;
    return {url:url.toString(), token, byteLength};
  }
  handle(request, response) {
    const token = new URL(request.url || '/', this.origin).pathname.split('/').filter(Boolean).at(-1);
    const entry = this.entries.get(token);
    if (request.method !== 'GET' || !entry || entry.started) {
      response.writeHead(404, {'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});response.end();return;
    }
    entry.started=true;entry.response=response;
    response.writeHead(200, {
      'Content-Type':'application/octet-stream',
      'Content-Length':String(entry.byteLength),
      'Cache-Control':'no-store',
      'Access-Control-Allow-Origin':'*',
      'Cross-Origin-Resource-Policy':'cross-origin'
    });
    response.once('finish',()=>{entry.finished=true;});
    response.once('close',()=>{if(!entry.finished){this.remove(token);try{entry.onAbort();}catch(error){this.log(error.stack||error.message);}}});
    this.writeEntry(entry,response).catch(error=>{this.log(error.stack||error.message);response.destroy(error);});
  }
  async writeEntry(entry,response) {
    for(const buffer of entry.buffers){
      if(response.destroyed)return;
      if(response.write(buffer))continue;
      await new Promise(resolve=>{
        const done=()=>{response.off('drain',done);response.off('close',done);response.off('error',done);resolve();};
        response.once('drain',done);response.once('close',done);response.once('error',done);
      });
    }
    if(!response.destroyed)response.end();
  }
  remove(token) {
    const entry=this.entries.get(token);if(!entry)return;
    clearTimeout(entry.timer);this.entries.delete(token);
  }
  cancelFrame(owner) {
    const key=String(owner);
    for(const [token,entry] of [...this.entries])if(entry.owner===key){this.remove(token);entry.response?.destroy();}
  }
  complete(token) { this.remove(String(token||'')); }
  cancel(token) {
    const entry=this.entries.get(String(token||''));if(!entry)return false;
    this.remove(String(token));entry.response?.destroy();return true;
  }
  dispose() {
    for(const [token,entry] of [...this.entries]){this.remove(token);entry.response?.destroy();}
    this.server?.close();this.server=null;
  }
}

function packStackPayload(events) {
  let offset=0;
  const payloads=[],manifest=events.map(event=>{
    const {payload,...result}=event.result;
    const buffer=Buffer.from(payload);payloads.push(buffer);
    const item={frame:event.frame,total:event.total,result,offset,byteLength:buffer.byteLength};offset+=buffer.byteLength;return item;
  });
  const header=Buffer.from(JSON.stringify(manifest)),prefix=Buffer.allocUnsafe(4);prefix.writeUInt32LE(header.byteLength);
  return [prefix,header,...payloads];
}

module.exports = {HttpPayloadTransport,packStackPayload};
