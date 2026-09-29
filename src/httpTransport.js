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
    this.entries.set(token, {kind:'fixed',buffers, byteLength, owner:String(owner), onAbort, timer, response:null, started:false, finished:false});
    const url = new URL(this.externalBase);
    url.pathname += `vivi-transfer/${token}`;
    return {url:url.toString(), token, byteLength};
  }
  offerStream(owner, onAbort = () => {}, ttlMs = 120000) {
    if (!this.externalBase) throw new Error('HTTP image transport is unavailable.');
    const token=crypto.randomBytes(24).toString('hex');
    let resolveReady,rejectReady;
    const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    const timer=setTimeout(()=>this.remove(token,new Error('HTTP image stream was not opened in time.')),ttlMs);timer.unref?.();
    const entry={kind:'stream',owner:String(owner),onAbort,timer,response:null,started:false,finished:false,resolveReady,rejectReady,readySettled:false};
    this.entries.set(token,entry);
    const url=new URL(this.externalBase);url.pathname+=`vivi-transfer/${token}`;
    const descriptor={url:url.toString(),token,streaming:true};
    return {
      descriptor,ready,
      write:buffers=>this.writeBuffers(entry,Array.isArray(buffers)?buffers:[buffers]),
      end:()=>this.endStream(entry),
      fail:error=>this.failStream(token,entry,error)
    };
  }
  handle(request, response) {
    const token = new URL(request.url || '/', this.origin).pathname.split('/').filter(Boolean).at(-1);
    const entry = this.entries.get(token);
    if (request.method !== 'GET' || !entry || entry.started) {
      response.writeHead(404, {'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});response.end();return;
    }
    entry.started=true;entry.response=response;clearTimeout(entry.timer);
    const headers={
      'Content-Type':'application/octet-stream',
      'Cache-Control':'no-store',
      'Access-Control-Allow-Origin':'*',
      'Cross-Origin-Resource-Policy':'cross-origin'
    };
    if(entry.kind==='fixed')headers['Content-Length']=String(entry.byteLength);
    response.writeHead(200,headers);
    response.once('finish',()=>{entry.finished=true;});
    response.once('close',()=>{if(!entry.finished){this.remove(token);try{entry.onAbort();}catch(error){this.log(error.stack||error.message);}}});
    if(entry.kind==='stream'){
      entry.readySettled=true;entry.resolveReady();
    }else this.writeEntry(entry,response).catch(error=>{this.log(error.stack||error.message);response.destroy();});
  }
  async writeEntry(entry,response) {
    await this.writeBuffers(entry,entry.buffers);
    if(!response.destroyed)response.end();
  }
  async writeBuffers(entry,buffers) {
    const response=entry.response;
    if(!response||response.destroyed)throw new Error('HTTP image stream is closed.');
    for(const value of buffers){
      const buffer=Buffer.isBuffer(value)?value:Buffer.from(value);
      if(response.destroyed)throw new Error('HTTP image stream is closed.');
      if(response.write(buffer))continue;
      await new Promise((resolve,reject)=>{
        const clean=()=>{response.off('drain',drain);response.off('close',close);response.off('error',error);};
        const drain=()=>{clean();resolve();},close=()=>{clean();reject(new Error('HTTP image stream was cancelled.'));},error=value=>{clean();reject(value);};
        response.once('drain',drain);response.once('close',close);response.once('error',error);
      });
    }
  }
  endStream(entry){if(!entry.response||entry.response.destroyed)throw new Error('HTTP image stream is closed.');entry.response.end();}
  failStream(token,entry,error){if(error)this.log(error.stack||error.message||String(error));if(entry.response&&!entry.response.destroyed)entry.response.destroy();else this.remove(token,error instanceof Error?error:new Error(String(error)));}
  remove(token, reason = null) {
    const entry=this.entries.get(token);if(!entry)return;
    clearTimeout(entry.timer);this.entries.delete(token);
    if(entry.kind==='stream'&&!entry.readySettled){entry.readySettled=true;entry.rejectReady(reason||new Error('HTTP image stream was cancelled.'));}
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

function packStackRecord(event) {
  const {payload,...result}=event.result,body=Buffer.from(payload);
  const header=Buffer.from(JSON.stringify({frame:event.frame,total:event.total,result,payloadLength:body.byteLength}));
  const prefix=Buffer.allocUnsafe(4);prefix.writeUInt32LE(header.byteLength);
  return [prefix,header,body];
}

module.exports = {HttpPayloadTransport,packStackPayload,packStackRecord};
