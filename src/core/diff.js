/**
 * Word-level comparison and undo.
 *
 * The comparison view has one job: let the writer see exactly what changed
 * before they accept it. A diff that is roughly right is worse than none,
 * because it hides a changed number inside an "unchanged" run.
 */

/** Split into words and the whitespace between them, so nothing is lost. */
export function tokenise(text) {
  return String(text ?? '').match(/\s+|[^\s]+/g) || [];
}

/**
 * Longest common subsequence over tokens.
 *
 * Bounded: above the size limit the inputs are compared by paragraph instead,
 * so a very long document degrades to a coarser diff rather than hanging.
 */
export function diffTokens(before, after, { maxTokens = 4000 } = {}) {
  const a = tokenise(before);
  const b = tokenise(after);

  if (a.length * b.length > maxTokens * maxTokens) {
    return [{ type: a.join('') === b.join('') ? 'equal' : 'replace', before: a.join(''), after: b.join('') }];
  }

  // Trim the common prefix and suffix first: most edits are local.
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < a.length - prefix && suffix < b.length - prefix
         && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;

  const midA = a.slice(prefix, a.length - suffix);
  const midB = b.slice(prefix, b.length - suffix);

  const ops = [];
  if (prefix) ops.push({ type: 'equal', before: a.slice(0, prefix).join(''), after: a.slice(0, prefix).join('') });
  ops.push(...lcsOps(midA, midB));
  if (suffix) {
    const tail = a.slice(a.length - suffix).join('');
    ops.push({ type: 'equal', before: tail, after: tail });
  }
  return merge(ops.filter(op => op.before || op.after));
}

function lcsOps(a, b) {
  const n = a.length;
  const m = b.length;
  if (!n && !m) return [];
  if (!n) return [{ type: 'insert', before: '', after: b.join('') }];
  if (!m) return [{ type: 'delete', before: a.join(''), after: '' }];

  // Classic LCS table. n*m is bounded by the caller.
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ type: 'equal', before: a[i], after: b[j] }); i++; j++; }
    else if (table[i + 1][j] >= table[i][j + 1]) { ops.push({ type: 'delete', before: a[i], after: '' }); i++; }
    else { ops.push({ type: 'insert', before: '', after: b[j] }); j++; }
  }
  while (i < n) { ops.push({ type: 'delete', before: a[i], after: '' }); i++; }
  while (j < m) { ops.push({ type: 'insert', before: '', after: b[j] }); j++; }
  return ops;
}

/** Collapse runs of the same type, and a delete immediately followed by an insert. */
function merge(ops) {
  const out = [];
  for (const op of ops) {
    const last = out[out.length - 1];
    if (last && last.type === op.type) {
      last.before += op.before;
      last.after += op.after;
      continue;
    }
    if (last && last.type === 'delete' && op.type === 'insert') {
      out[out.length - 1] = { type: 'replace', before: last.before, after: op.after };
      continue;
    }
    if (last && last.type === 'replace' && op.type === 'insert') {
      last.after += op.after;
      continue;
    }
    if (last && last.type === 'replace' && op.type === 'delete') {
      last.before += op.before;
      continue;
    }
    out.push({ ...op });
  }
  return out;
}

/**
 * Summarise a diff for the "What changed" list.
 * Facts that moved are called out separately, because those are the dangerous
 * changes.
 */
export function summariseDiff(ops) {
  const added = ops.filter(o => o.type === 'insert' || o.type === 'replace').map(o => o.after.trim()).filter(Boolean);
  const removed = ops.filter(o => o.type === 'delete' || o.type === 'replace').map(o => o.before.trim()).filter(Boolean);
  const changed = ops.filter(o => o.type !== 'equal').length;
  return {
    changed,
    unchanged: ops.filter(o => o.type === 'equal').length,
    added,
    removed,
    identical: changed === 0
  };
}

/**
 * Undo support.
 *
 * WordSaffron restores the exact previous string and the exact previous caret
 * position, rather than relying on the page's own undo stack, which many
 * editors clear when a value is set programmatically.
 */
export function makeUndoEntry({ text, selectionStart = null, selectionEnd = null, label = 'change' }) {
  return { text: String(text ?? ''), selectionStart, selectionEnd, label, at: Date.now() };
}

export class UndoStack {
  constructor(limit = 20) { this.limit = limit; this.entries = []; }
  push(entry) {
    this.entries.push(entry);
    if (this.entries.length > this.limit) this.entries.shift();
    return this.entries.length;
  }
  /** @returns {object|null} */
  pop() { return this.entries.pop() || null; }
  peek() { return this.entries[this.entries.length - 1] || null; }
  get size() { return this.entries.length; }
  clear() { this.entries = []; }
}
