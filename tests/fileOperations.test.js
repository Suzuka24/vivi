'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {compactPaths,isInside,transferEntries}=require('../src/fileOperations');

test('file operations compact nested selections and identify descendants',()=>{
  const root=path.resolve('/tmp/vivi-root'),child=path.join(root,'child'),peer=path.resolve('/tmp/vivi-peer');
  assert.equal(isInside(child,root),true);assert.equal(isInside(peer,root),false);
  assert.deepEqual(compactPaths([child,root,peer,root]),[root,peer]);
});

test('copy and move selected files without overwriting existing names',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vivi-files-'));
  try{
    const source=path.join(root,'source'),destination=path.join(root,'destination');
    await fs.mkdir(source);await fs.mkdir(destination);await fs.writeFile(path.join(source,'a.txt'),'one');
    await transferEntries([path.join(source,'a.txt')],destination,false);
    await transferEntries([path.join(source,'a.txt')],destination,false);
    assert.equal(await fs.readFile(path.join(destination,'a.txt'),'utf8'),'one');
    assert.equal(await fs.readFile(path.join(destination,'a copy.txt'),'utf8'),'one');
    await transferEntries([path.join(source,'a.txt')],destination,true);
    assert.equal(await fs.readFile(path.join(destination,'a copy 2.txt'),'utf8'),'one');
    await assert.rejects(fs.stat(path.join(source,'a.txt')));
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('directories cannot be transferred into their descendants',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vivi-nested-'));
  try{const child=path.join(root,'child');await fs.mkdir(child);await assert.rejects(transferEntries([root],child,true),/into itself/);}
  finally{await fs.rm(root,{recursive:true,force:true});}
});
