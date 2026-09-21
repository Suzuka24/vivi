'use strict';

function previewCompressionOptions(settings, sourceFileBytes) {
  const options = {compress: settings.lossless === true,
    losslessMethod: settings.lossless === true ? (settings.losslessMethod || 'zstd1-shuffle') : 'none'};
  const threshold = Number(settings.minMiB) * 1048576;
  if (settings.lossy === true && sourceFileBytes > threshold) {
    options.lossyMethod = settings.method;
    options.lossyTolerance = settings.tolerance;
  }
  return options;
}

module.exports = {previewCompressionOptions};
