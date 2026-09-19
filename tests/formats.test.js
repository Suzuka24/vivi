'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { viewers, viewerFor, isManaged, nativeEditorFor } = require('../src/formats');
const manifest = require('../package.json');

test('registered formats match the custom editor selector', () => {
  const pattern = manifest.contributes.customEditors[0].selector[0].filenamePattern;
  for (const ext of viewers.flatMap(v => v.extensions)) assert.ok(pattern.includes(ext), ext);
});

test('takeover is case insensitive and user controlled', () => {
  assert.equal(viewerFor('/data/SCIENCE.FITS').id, 'image');
  assert.equal(isManaged('/data/SCIENCE.FITS', ['fits']), true);
  assert.equal(isManaged('/data/SCIENCE.FITS', ['png']), false);
  assert.equal(isManaged('/data/notes.txt', ['txt']), false);
  assert.equal(isManaged('C:\\data\\scan.TIFF', ['.tiff']), true);
});

test('unmanaged common media use Cursor native previews', () => {
  assert.equal(nativeEditorFor('/data/photo.JPG'), 'imagePreview.previewEditor');
  assert.equal(nativeEditorFor('/data/movie.mp4'), 'vscode.videoPreview');
  assert.equal(nativeEditorFor('/data/cube.fits'), 'default');
});
