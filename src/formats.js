'use strict';

// Register future viewers here and add their extensions to package.json's selector.
const viewers = [
  { id: 'image', extensions: ['fits', 'fit', 'fts', 'fz', 'tif', 'tiff', 'png', 'jpg', 'jpeg', 'bmp', 'gif', 'avi', 'mp4', 'mov', 'mkv'] }
];

function extensionOf(file) {
  return String(file).match(/\.([^.\\/]+)$/)?.[1].toLowerCase() || '';
}

function viewerFor(file) {
  const extension = extensionOf(file);
  return viewers.find(viewer => viewer.extensions.includes(extension));
}

function isManaged(file, extensions) {
  return !!viewerFor(file) && Array.isArray(extensions) && extensions.map(value => String(value).replace(/^\./, '').toLowerCase()).includes(extensionOf(file));
}

function nativeEditorFor(file) {
  const ext = extensionOf(file);
  if (['png', 'jpg', 'jpeg', 'bmp', 'gif'].includes(ext)) return 'imagePreview.previewEditor';
  if (ext === 'mp4') return 'vscode.videoPreview';
  return 'default';
}

module.exports = { viewers, extensionOf, viewerFor, isManaged, nativeEditorFor };
