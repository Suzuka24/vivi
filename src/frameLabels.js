'use strict';

function uniqueFrameLabel(name, existing) {
  const base = String(name).trim();
  const used = new Set(existing);
  if (!used.has(base)) return base;
  for (let number = 2; ; number++) {
    const candidate = `${base} (${number})`;
    if (!used.has(candidate)) return candidate;
  }
}

module.exports = { uniqueFrameLabel };
