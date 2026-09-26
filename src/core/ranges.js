/**
 * Exact issue ranges.
 *
 * v1 underlined the whole field, which told the user something was wrong but
 * not where. This module maps character offsets in the plain text of a field
 * onto the DOM positions needed to draw an underline over exactly the offending
 * characters — and, critically, detects when the text has moved underneath a
 * range so a stale suggestion can never be applied to the wrong words.
 */

/**
 * A fingerprint of a range that survives unrelated edits elsewhere in the text.
 * It records the exact slice plus a short window either side.
 */
export function fingerprint(text, start, end, window = 12) {
  const source = String(text ?? '');
  return {
    start,
    end,
    slice: source.slice(start, end),
    before: source.slice(Math.max(0, start - window), start),
    after: source.slice(end, Math.min(source.length, end + window)),
    length: source.length
  };
}

/**
 * Re-locate a range in edited text.
 *
 * Returns the new offsets when the exact slice can still be found with its
 * surroundings intact, and null when it cannot. Null means the suggestion is
 * stale and must be discarded, never "applied anyway".
 *
 * @returns {{start:number,end:number,moved:boolean}|null}
 */
export function relocate(text, print) {
  const source = String(text ?? '');
  if (!print || typeof print.slice !== 'string' || !print.slice) return null;

  // 1. Unchanged in place.
  if (source.slice(print.start, print.end) === print.slice
      && source.slice(Math.max(0, print.start - print.before.length), print.start) === print.before) {
    return { start: print.start, end: print.end, moved: false };
  }

  // 2. The surrounding text still matches somewhere: the range shifted.
  const needle = print.before + print.slice + print.after;
  if (needle !== print.slice) {
    const at = indexOfUnique(source, needle);
    if (at >= 0) {
      const start = at + print.before.length;
      return { start, end: start + print.slice.length, moved: true };
    }
  }

  // 3. The slice alone appears exactly once: safe to move to it.
  const sliceAt = indexOfUnique(source, print.slice);
  if (sliceAt >= 0) return { start: sliceAt, end: sliceAt + print.slice.length, moved: true };

  // 4. Ambiguous or gone. Discard.
  return null;
}

/** Index of `needle` if and only if it occurs exactly once. */
function indexOfUnique(haystack, needle) {
  const first = haystack.indexOf(needle);
  if (first === -1) return -1;
  return haystack.indexOf(needle, first + 1) === -1 ? first : -1;
}

/**
 * Decorate issues with fingerprints so they can be re-validated later.
 */
export function withFingerprints(issues, text) {
  return (issues || []).map(issue => ({ ...issue, print: fingerprint(text, issue.start, issue.end) }));
}

/**
 * Re-validate a set of issues against the current text.
 * @returns {{live: object[], stale: object[]}}
 */
export function revalidate(issues, text) {
  const live = [];
  const stale = [];
  for (const issue of issues || []) {
    const print = issue.print || fingerprint(issue.original ? issue.original : '', 0, (issue.original || '').length);
    const located = issue.print
      ? relocate(text, issue.print)
      : (text.slice(issue.start, issue.end) === issue.original ? { start: issue.start, end: issue.end, moved: false } : null);
    if (!located) { stale.push(issue); continue; }
    live.push({ ...issue, start: located.start, end: located.end, moved: located.moved, print: fingerprint(text, located.start, located.end) });
    void print;
  }
  return { live, stale };
}

/**
 * Turn overlapping issue ranges into a flat, non-overlapping list of segments
 * for rendering. Each segment knows which issues cover it, so an underline can
 * show a combined state without drawing twice.
 *
 * @returns {Array<{start:number,end:number,issues:number[]}>}
 */
export function toSegments(issues, textLength) {
  const edges = new Set([0, textLength]);
  for (const issue of issues) {
    edges.add(Math.max(0, Math.min(textLength, issue.start)));
    edges.add(Math.max(0, Math.min(textLength, issue.end)));
  }
  const points = [...edges].sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    const covering = issues
      .map((issue, index) => ({ issue, index }))
      .filter(({ issue }) => issue.start < end && issue.end > start)
      .map(({ index }) => index);
    if (covering.length) segments.push({ start, end, issues: covering });
  }
  return segments;
}

/**
 * Map a character offset in the plain text of a contenteditable element onto
 * the text node and offset that contain it. Returns null when the offset is
 * outside the element's text.
 */
export function locateInNode(root, offset) {
  if (!root || offset < 0) return null;
  let remaining = offset;
  const walk = node => {
    if (node.nodeType === 3) {
      const length = node.nodeValue.length;
      if (remaining <= length) return { node, offset: remaining };
      remaining -= length;
      return null;
    }
    for (const child of node.childNodes || []) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  return walk(root);
}

/**
 * Apply a set of non-overlapping replacements to a string.
 * Applied from the end so earlier offsets stay valid.
 */
export function applyReplacements(text, replacements) {
  const source = String(text ?? '');
  const sorted = [...replacements].sort((a, b) => b.start - a.start);
  let out = source;
  let lastStart = source.length + 1;
  for (const r of sorted) {
    if (r.end > lastStart) continue; // overlapping: skip rather than corrupt
    out = out.slice(0, r.start) + r.replacement + out.slice(r.end);
    lastStart = r.start;
  }
  return out;
}
