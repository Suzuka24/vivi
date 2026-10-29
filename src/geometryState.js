'use strict';

const IDENTITY = Object.freeze([1, 0, 0, 1]);
const OPERATIONS = Object.freeze({
  flipHorizontal: [-1, 0, 0, 1],
  flipVertical: [1, 0, 0, -1],
  rotateLeft: [0, 1, -1, 0],
  rotateRight: [0, -1, 1, 0],
  rotate180: [-1, 0, 0, -1]
});

function createGeometryState() {
  return { matrix: [...IDENTITY], resampled: false };
}

function multiply(left, right) {
  return [
    left[0] * right[0] + left[1] * right[2],
    left[0] * right[1] + left[1] * right[3],
    left[2] * right[0] + left[3] * right[2],
    left[2] * right[1] + left[3] * right[3]
  ];
}

function applyGeometryAction(state, action, args = {}) {
  const current = state || createGeometryState();
  if (OPERATIONS[action]) return { matrix: multiply(OPERATIONS[action], current.matrix), resampled: current.resampled };
  if (action === 'rotate') {
    const angle = Number(args.angle);
    const normalized = Number.isFinite(angle) ? ((angle % 360) + 360) % 360 : 0;
    if (normalized === 0) return { matrix: [...current.matrix], resampled: current.resampled };
    return { matrix: [...current.matrix], resampled: true };
  }
  return { matrix: [...current.matrix], resampled: current.resampled };
}

function isGeometryIdentity(state) {
  const current = state || createGeometryState();
  return !current.resampled && current.matrix.every((value, index) => value === IDENTITY[index]);
}

function sourceHeaderResult(header, transformed, geometryState) {
  if (!header?.available) return header;
  return {
    ...header,
    sourceHeader: !!transformed,
    wcsWarning: transformed && !isGeometryIdentity(geometryState)
      ? '当前图像仍包含 flip/rotate 几何变换；以下为源文件 Header，WCS 可能不再对应当前图像。'
      : ''
  };
}

module.exports = { applyGeometryAction, createGeometryState, isGeometryIdentity, sourceHeaderResult };
