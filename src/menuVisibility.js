'use strict';

// First and second menu levels only. Submenu contents follow their parent toggle.
const menuPaths = [
  'File', 'File > New', 'File > Open…', 'File > Open Recent', 'File > Import',
  'File > Close Frame', 'File > Save As', 'File > Revert', 'File > Print…',
  'Edit', 'Edit > Undo', 'Edit > Redo', 'Edit > Cut', 'Edit > Copy',
  'Edit > Paste', 'Edit > Clear Selection', 'Edit > Selection', 'Edit > Options',
  'Image', 'Image > Type', 'Image > Adjust', 'Image > Color', 'Image > Stacks',
  'Image > Transform', 'Image > Crop', 'Image > Copy Image', 'Image > Duplicate…',
  'Image > Rename…', 'Image > Scale…', 'Image > Show Info…', 'Image > Zoom',
  'Image > Overlay', 'Image > Properties…',
  'Process', 'Process > Smooth', 'Process > Sharpen', 'Process > Find Edges',
  'Process > Find Maxima…', 'Process > Filters', 'Process > Enhance Contrast',
  'Process > Noise', 'Process > Shadows', 'Process > Binary', 'Process > Math',
  'Process > FFT',
  'Analyze', 'Analyze > Measure', 'Analyze > Analyze Particles…',
  'Analyze > Summarize', 'Analyze > Distribution…', 'Analyze > Clear Results',
  'Analyze > Set Measurements…', 'Analyze > Set Scale…', 'Analyze > Histogram',
  'Analyze > Plot Profile', 'Analyze > Skeleton…', 'Analyze > Tools'
];

module.exports = { menuPaths };
