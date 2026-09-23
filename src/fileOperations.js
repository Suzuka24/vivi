'use strict';
const fs = require('node:fs/promises');
const {constants} = require('node:fs');
const path = require('node:path');

function isInside(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function compactPaths(values) {
  const unique = [...new Set(values.map(value => path.resolve(value)))];
  return unique.filter(candidate => !unique.some(parent => parent !== candidate && isInside(candidate, parent)));
}

async function availableDestination(folder, source, isDirectory) {
  const original = path.join(folder, path.basename(source));
  try { await fs.access(original); }
  catch { return original; }
  const extension = isDirectory ? '' : path.extname(source);
  const stem = path.basename(source, extension);
  for (let serial = 1;;serial++) {
    const suffix = serial === 1 ? ' copy' : ` copy ${serial}`;
    const candidate = path.join(folder, `${stem}${suffix}${extension}`);
    try { await fs.access(candidate); }
    catch { return candidate; }
  }
}

async function copyEntry(source, destination, isDirectory) {
  if (isDirectory) await fs.cp(source, destination, {recursive:true, errorOnExist:true, force:false});
  else await fs.copyFile(source, destination, constants.COPYFILE_EXCL);
}

async function transferEntries(values, destinationFolder, move = false) {
  const sources = compactPaths(values), folder = path.resolve(destinationFolder);
  if (!(await fs.stat(folder)).isDirectory()) throw new Error('Choose a destination folder.');
  const results = [];
  for (const source of sources) {
    const stat = await fs.stat(source), sameFolder = path.dirname(source) === folder;
    if (move && sameFolder) continue;
    if (stat.isDirectory() && isInside(folder, source)) throw new Error(`Cannot move or copy ${path.basename(source)} into itself.`);
    const destination = await availableDestination(folder, source, stat.isDirectory());
    if (move) {
      try { await fs.rename(source, destination); }
      catch (error) {
        if (error.code !== 'EXDEV') throw error;
        await copyEntry(source, destination, stat.isDirectory());
        await fs.rm(source, {recursive:true, force:true});
      }
    } else await copyEntry(source, destination, stat.isDirectory());
    results.push(destination);
  }
  return results;
}

module.exports = {compactPaths, isInside, transferEntries};
