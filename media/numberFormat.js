'use strict';
// The compact numeric cells share one eight-character display limit.
function formatNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);
  if (Object.is(value, -0) || value === 0) return '0';
  const candidates = new Set();
  for (let digits = 0; digits <= 15; digits++) {
    candidates.add(value.toFixed(digits).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''));
    candidates.add(value.toExponential(digits).replace(/(\.\d*?)0+e/, '$1e').replace(/\.e/, 'e').replace(/e\+/, 'e').replace(/e(-?)0+(\d)/, 'e$1$2'));
  }
  let best = null;
  for (const candidate of candidates) {
    if (candidate.length > 8 || !Number.isFinite(Number(candidate))) continue;
    const error = Math.abs(Number(candidate) - value);
    if (!best || error < best.error || (error === best.error && !candidate.includes('e') && best.text.includes('e')) || (error === best.error && candidate.includes('e') === best.text.includes('e') && candidate.length < best.text.length)) best = {text:candidate,error};
  }
  return best?.text ?? value.toExponential(0).replace('e+', 'e');
}
if (typeof module !== 'undefined') module.exports = {formatNumber};
if (typeof window !== 'undefined') window.ViviNumberFormat = {formatNumber};
