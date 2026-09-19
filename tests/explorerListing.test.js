'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { listDirectory } = require('../src/explorerListing');

test('hidden files, folders, size and modification sorting', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'vivi-list-'));
  try {
    await fs.mkdir(path.join(folder, 'folder'));
    await fs.writeFile(path.join(folder, '.secret'), 'hidden');
    await fs.writeFile(path.join(folder, 'small.txt'), 'a');
    await fs.writeFile(path.join(folder, 'large.txt'), 'longer');
    await fs.utimes(path.join(folder, 'small.txt'), new Date(1000), new Date(1000));
    await fs.utimes(path.join(folder, 'large.txt'), new Date(2000), new Date(2000));
    const names = async (mode, hidden = false) => (await listDirectory(folder, 0, mode, hidden)).entries.map(item => item.name);
    assert.deepEqual(await names('sizeDesc'), ['folder', 'large.txt', 'small.txt']);
    assert.deepEqual(await names('dateAsc'), ['folder', 'small.txt', 'large.txt']);
    assert.deepEqual(await names('nameAsc', true), ['folder', '.secret', 'large.txt', 'small.txt']);
  } finally { await fs.rm(folder, {recursive:true,force:true}); }
});

test('pagination follows the ordering of the whole directory', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'vivi-pages-'));
  try {
    for (let i = 502; i >= 0; i--) await fs.writeFile(path.join(folder, `file-${String(i).padStart(3,'0')}`), '');
    const first = await listDirectory(folder, 0, 'nameAsc');
    const second = await listDirectory(folder, 500, 'nameAsc');
    assert.equal(first.entries.length, 500);
    assert.equal(first.entries[0].name, 'file-000');
    assert.equal(first.entries.at(-1).name, 'file-499');
    assert.equal(first.more, true);
    assert.deepEqual(second.entries.map(item=>item.name), ['file-500','file-501','file-502']);
    assert.equal(second.more, false);
  } finally { await fs.rm(folder, {recursive:true,force:true}); }
});
