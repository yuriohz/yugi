/**
 * Tolerant JSON extraction for model output.
 *
 * Models wrap JSON in fences, prepend prose, or emit trailing commas. This
 * recovers the payload without ever using `eval`.
 */

export function stripFences(text) {
  return String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/^\s*```(?:json|JSON)?\s*/, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

/** Find the first balanced `{...}` or `[...]` region, ignoring braces in strings. */
export function extractBalanced(text) {
  const source = String(text ?? '');
  const openers = { '{': '}', '[': ']' };
  for (let i = 0; i < source.length; i++) {
    const open = source[i];
    if (!openers[open]) continue;
    const close = openers[open];
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = i; j < source.length; j++) {
      const ch = source[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return source.slice(i, j + 1);
      }
    }
  }
  return null;
}

function removeTrailingCommas(text) {
  return text.replace(/,\s*([}\]])/g, '$1');
}

/**
 * @param {string|object} raw
 * @returns {{ok: true, value: any} | {ok: false, error: string}}
 */
export function parseModelJson(raw) {
  if (raw && typeof raw === 'object') return { ok: true, value: raw };
  const text = stripFences(raw);
  if (!text) return { ok: false, error: 'The model returned an empty response.' };

  const attempts = [text, extractBalanced(text), removeTrailingCommas(text)];
  const balanced = extractBalanced(text);
  if (balanced) attempts.push(removeTrailingCommas(balanced));

  for (const candidate of attempts) {
    if (!candidate) continue;
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === 'object') return { ok: true, value: stripDangerousKeys(value) };
    } catch { /* try the next strategy */ }
  }
  return { ok: false, error: 'The model did not return usable JSON.' };
}

const DANGEROUS = new Set(['__proto__', 'constructor', 'prototype']);

/** Remove prototype-pollution vectors from anything parsed from an untrusted source. */
export function stripDangerousKeys(value) {
  if (Array.isArray(value)) return value.map(stripDangerousKeys);
  if (value && typeof value === 'object') {
    const out = Object.create(null);
    for (const [k, v] of Object.entries(value)) {
      if (DANGEROUS.has(k)) continue;
      out[k] = stripDangerousKeys(v);
    }
    // Return a plain object literal so downstream code can use normal semantics.
    return Object.assign({}, out);
  }
  return value;
}
