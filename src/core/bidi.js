/**
 * Bidirectional text handling.
 *
 * Two separate problems:
 *
 *  1. Base direction. An Arabic message must render right-to-left, including
 *     the punctuation at its edges. Getting this wrong moves full stops and
 *     question marks to the wrong end of the line.
 *
 *  2. Embedded runs. A URL, a code identifier, or an English product name
 *     inside Arabic text is a left-to-right run inside a right-to-left
 *     paragraph. Without isolation, the Unicode bidi algorithm reorders the
 *     characters around it and the user sees a mangled URL.
 *
 * WriteRight isolates rather than rewrites: the stored text is never altered,
 * only its presentation.
 */

const RTL_CHARS = /[\u0591-\u07FF\u0860-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
const LTR_CHARS = /[A-Za-z\u00C0-\u024F\u0370-\u058F]/;

/** Unicode isolate controls. */
export const LRI = '\u2066';
export const RLI = '\u2067';
export const FSI = '\u2068';
export const PDI = '\u2069';

/**
 * Resolve the base direction of a string, using the first strong character,
 * with a count-based fallback for strings that begin with punctuation or digits.
 * @returns {'rtl'|'ltr'}
 */
export function baseDirection(text) {
  const source = String(text ?? '');
  for (const ch of source) {
    if (RTL_CHARS.test(ch)) return 'rtl';
    if (LTR_CHARS.test(ch)) return 'ltr';
  }
  return 'ltr';
}

/**
 * Direction for a whole field, which should follow the dominant script rather
 * than the first character: a message that opens with an English product name
 * but is otherwise Arabic still reads right-to-left.
 * @returns {{direction: 'rtl'|'ltr', rtlChars: number, ltrChars: number, mixed: boolean}}
 */
export function resolveDirection(text) {
  const source = String(text ?? '');
  const rtlChars = (source.match(new RegExp(RTL_CHARS, 'g')) || []).length;
  const ltrChars = (source.match(new RegExp(LTR_CHARS, 'g')) || []).length;
  const mixed = rtlChars > 0 && ltrChars > 0;
  if (!rtlChars && !ltrChars) return { direction: 'ltr', rtlChars, ltrChars, mixed };
  return { direction: rtlChars >= ltrChars ? 'rtl' : 'ltr', rtlChars, ltrChars, mixed };
}

/** Patterns that must never be reordered by the bidi algorithm. */
const NEUTRAL_RUNS = [
  /\bhttps?:\/\/[^\s\u0600-\u06FF]+/g,
  /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g,
  /`[^`\n]+`/g,
  /\b[A-Za-z][A-Za-z0-9_.+-]*(?:\/[A-Za-z0-9_.-]+)+/g,
  /(?:^|\s)@[A-Za-z0-9_.]{2,30}\b/g
];

/**
 * Wrap Latin/neutral runs inside RTL text in isolates so they render correctly.
 * Purely presentational: use for display, never for the value written back to
 * the page.
 */
export function isolateRuns(text) {
  const source = String(text ?? '');
  if (!RTL_CHARS.test(source)) return source;

  const spans = [];
  for (const re of NEUTRAL_RUNS) {
    const expr = new RegExp(re.source, re.flags);
    let m;
    while ((m = expr.exec(source)) !== null) {
      const raw = m[0];
      const offset = m.index + m[0].indexOf(raw.trimStart());
      spans.push([offset, offset + raw.trimStart().length]);
    }
  }
  if (!spans.length) return source;

  spans.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push([...span]);
  }

  let out = '';
  let cursor = 0;
  for (const [start, end] of merged) {
    out += source.slice(cursor, start) + FSI + source.slice(start, end) + PDI;
    cursor = end;
  }
  return out + source.slice(cursor);
}

/** Remove isolate controls, for example before writing text back to a page. */
export function stripIsolates(text) {
  return String(text ?? '').replace(/[\u2066-\u2069\u202A-\u202E]/g, '');
}

/**
 * Presentation attributes for a container showing this text.
 * `dir="auto"` is not enough for mixed content, because it uses first-strong.
 */
export function directionAttributes(text) {
  const { direction, mixed } = resolveDirection(text);
  return {
    dir: direction,
    lang: direction === 'rtl' ? 'ar' : undefined,
    style: `direction:${direction};text-align:${direction === 'rtl' ? 'right' : 'left'};unicode-bidi:isolate`,
    mixed
  };
}

/**
 * Does the punctuation sit on the correct side for the base direction?
 * A common failure: Arabic text ending with a Latin full stop that visually
 * jumps to the left-hand edge.
 */
export function checkTerminalPunctuation(text) {
  const source = String(text ?? '').trim();
  if (!source) return { ok: true };
  const { direction } = resolveDirection(source);
  if (direction !== 'rtl') return { ok: true };

  const last = source[source.length - 1];
  if (last === '?') {
    return { ok: false, suggestion: `${source.slice(0, -1)}؟`, message: 'Arabic text uses the Arabic question mark ؟.' };
  }
  if (last === ';') {
    return { ok: false, suggestion: `${source.slice(0, -1)}؛`, message: 'Arabic text uses the Arabic semicolon ؛.' };
  }
  if (last === ',') {
    return { ok: false, suggestion: `${source.slice(0, -1)}،`, message: 'Arabic text uses the Arabic comma ،.' };
  }
  return { ok: true };
}

/** Arabic comma and question mark inside the body, not only at the end. */
export function detectLatinPunctuationInArabic(text) {
  const source = String(text ?? '');
  const issues = [];
  const map = { ',': '،', ';': '؛', '?': '؟' };
  for (const m of source.matchAll(/[,;?]/g)) {
    const before = source.slice(Math.max(0, m.index - 12), m.index);
    const after = source.slice(m.index + 1, m.index + 13);
    // Only when Arabic surrounds it; a comma inside an English clause is fine.
    if (!RTL_CHARS.test(before) || (after.trim() && !RTL_CHARS.test(after) && LTR_CHARS.test(after))) continue;
    issues.push({
      start: m.index,
      end: m.index + 1,
      original: m[0],
      replacement: map[m[0]],
      message: `Arabic text uses ${map[m[0]]} rather than ${m[0]}.`,
      category: 'punctuation',
      advisory: false
    });
  }
  return issues;
}
