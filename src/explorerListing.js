'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

const sortModes = new Set(['nameAsc','nameDesc','sizeAsc','sizeDesc','dateAsc','dateDesc']);
function compare(a, b, mode) {
  if (a.directory !== b.directory) return a.directory ? -1 : 1;
  if (!a.directory && mode.startsWith('size') && a.size !== b.size)
    return mode === 'sizeAsc' ? a.size - b.size : b.size - a.size;
  if (mode.startsWith('date') && a.mtimeMs !== b.mtimeMs)
    return mode === 'dateAsc' ? a.mtimeMs - b.mtimeMs : b.mtimeMs - a.mtimeMs;
  const name = a.name.localeCompare(b.name, undefined, { numeric: true });
  return mode === 'nameDesc' ? -name : name;
}

async function listDirectory(folder, offset = 0, mode = 'nameAsc', showHidden = true, pageSize = 500) {
  if (!sortModes.has(mode)) mode = 'nameAsc';
  offset = Math.max(0, Math.trunc(Number(offset) || 0));
  const wanted = offset + pageSize + 1, heap = [];
  const worse = (a,b) => compare(a,b,mode) > 0;
  function keep(entry) {
    if (heap.length < wanted) {
      heap.push(entry);
      for (let i = heap.length - 1; i > 0;) {
        const parent = (i - 1) >> 1;
        if (!worse(heap[i],heap[parent])) break;
        [heap[i],heap[parent]] = [heap[parent],heap[i]]; i = parent;
      }
    } else if (compare(entry,heap[0],mode) < 0) {
      heap[0] = entry;
      for (let i = 0;;) {
        const left = 2*i+1, right = left+1;
        if (left >= heap.length) break;
        let child = right < heap.length && worse(heap[right],heap[left]) ? right : left;
        if (!worse(heap[child],heap[i])) break;
        [heap[i],heap[child]] = [heap[child],heap[i]]; i = child;
      }
    }
  }
  async function addBatch(batch) {
    const entries = await Promise.all(batch.map(async item => {
      const full = path.join(folder,item.name);
      let stat;
      try { stat = await fs.stat(full); } catch { /* broken link or removed file */ }
      return {name:item.name,path:full,directory:stat?.isDirectory() ?? item.isDirectory(),
        size:stat?.isDirectory() ? null : (stat?.size ?? 0),mtimeMs:stat?.mtimeMs ?? 0};
    }));
    for(const entry of entries)keep(entry);
  }
  const dir = await fs.opendir(folder);
  let batch = [], count = 0;
  for await (const item of dir) {
    if (!showHidden && item.name.startsWith('.')) continue;
    count++;batch.push(item);
    if(batch.length >= 32){await addBatch(batch);batch=[];}
  }
  if(batch.length)await addBatch(batch);
  const sorted = heap.sort((a,b)=>compare(a,b,mode));
  return {entries:sorted.slice(offset,offset+pageSize),more:count>offset+pageSize,offset,sortMode:mode,showHidden};
}

async function listColumnValues(folder, key, showHidden = true) {
  if (!['name','size','date'].includes(key)) throw new Error('Unknown Explorer column.');
  const values = [], dir = await fs.opendir(folder);
  let batch = [];
  async function addBatch(items) {
    if (key === 'name') {
      values.push(...items.map(item => item.name));
      return;
    }
    const measured = await Promise.all(items.map(async item => {
      try {
        const stat = await fs.stat(path.join(folder,item.name));
        if (key === 'size') return stat.isDirectory() ? null : stat.size;
        return stat.mtimeMs;
      } catch { return null; }
    }));
    values.push(...measured.filter(value => value != null));
  }
  for await (const item of dir) {
    if (!showHidden && item.name.startsWith('.')) continue;
    batch.push(item);
    if (batch.length >= 32) { await addBatch(batch); batch = []; }
  }
  if (batch.length) await addBatch(batch);
  return values;
}

module.exports = {listDirectory, listColumnValues, compare, sortModes};
