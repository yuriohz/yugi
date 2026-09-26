/**
 * Fidelity checker.
 *
 * Extracts the things a rewrite must never silently change, then compares the
 * original against the proposal. This runs locally, after the model responds
 * and before the user can apply anything.
 *
 * It is a safety net, not a proof of correctness. A clean report means nothing
 * mechanically checkable was dropped. It does not mean the meaning survived.
 */

/** Arabic-Indic and Eastern Arabic-Indic digits map onto Western digits. */
const DIGIT_MAP = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
};

/** Normalise digits so ٤٥٠ and 450 compare equal. */
export function normaliseDigits(text) {
  return String(text ?? '').replace(/[٠-٩۰-۹]/g, ch => DIGIT_MAP[ch] ?? ch);
}

/** Arabic presentation and orthographic variants that are not meaning changes. */
export function normaliseArabic(text) {
  return String(text ?? '')
    .replace(/[\u064B-\u065F\u0670]/g, '')   // harakat
    .replace(/\u0640/g, '')                   // tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

const EXTRACTORS = [
  { kind: 'url', label: 'URL', re: /\bhttps?:\/\/[^\s<>"')\]]+/gi },
  { kind: 'email', label: 'email address', re: /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g },
  { kind: 'handle', label: '@handle', re: /(?:^|[\s(])@[A-Za-z0-9_.]{2,30}\b/g },
  { kind: 'currency', label: 'amount', re: /(?:[$£€¥₹]|\b(?:USD|GBP|EUR|AED|SAR|EGP)\b)\s?[\d٠-٩۰-۹][\d٠-٩۰-۹,.\s]*/gi },
  { kind: 'percent', label: 'percentage', re: /[\d٠-٩۰-۹][\d٠-٩۰-۹,.]*\s?%|٪\s?[\d٠-٩۰-۹]+/g },
  { kind: 'time', label: 'time', re: /\b\d{1,2}[:.]\d{2}\s?(?:am|pm|AM|PM)?\b/g },
  { kind: 'date', label: 'date', re: /\b(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g },
  {
    kind: 'date',
    label: 'date',
    re: /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?\b/gi
  },
  {
    kind: 'date',
    label: 'date',
    re: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?\b/gi
  },
  { kind: 'identifier', label: 'identifier', re: /\b[A-Z][A-Z0-9]{1,}-\d+\b/g },
  { kind: 'code', label: 'code', re: /`[^`\n]+`/g },
  { kind: 'number', label: 'number', re: /(?<![\w.$£€¥₹#-])[\d٠-٩۰-۹]+(?:[.,][\d٠-٩۰-۹]+)*(?![\w%])/g }
];

/**
 * @typedef {object} Fact
 * @property {string} kind
 * @property {string} label
 * @property {string} value       normalised for comparison
 * @property {string} raw         as it appeared
 */

/** @returns {Fact[]} */
export function extractFacts(text) {
  const source = String(text ?? '');
  const facts = [];
  const claimed = [];

  for (const { kind, label, re } of EXTRACTORS) {
    const expr = new RegExp(re.source, re.flags);
    let m;
    while ((m = expr.exec(source)) !== null) {
      const raw = m[0].trim();
      if (!raw) continue;
      const start = m.index + m[0].indexOf(raw);
      const end = start + raw.length;
      // A URL already contains digits and dots; do not double-count them.
      if (claimed.some(([a, b]) => start >= a && end <= b)) continue;
      claimed.push([start, end]);
      const trimmed = /^(?:currency|percent|number)$/.test(kind) ? raw.replace(/[.,;:]+$/, '') : raw;
      facts.push({ kind, label, raw: trimmed, value: normaliseFact(kind, trimmed) });
    }
  }
  return facts;
}

function normaliseFact(kind, raw) {
  let value = normaliseDigits(raw).trim();
  switch (kind) {
    case 'url':
      return value.replace(/[.,;:)]+$/, '').toLowerCase();
    case 'email':
    case 'handle':
      return value.replace(/^[\s(]+/, '').toLowerCase();
    case 'currency':
    case 'percent':
    case 'number':
      // Trailing sentence punctuation is not part of the amount.
      return value.replace(/[\s,]/g, '').replace(/[.]+$/, '');
    case 'date':
    case 'time':
      return value.toLowerCase().replace(/\s+/g, ' ');
    default:
      return value;
  }
}

/**
 * Proper nouns: capitalised words that are not sentence-initial, plus any word
 * containing an internal capital or digit (product names, versions, APIs).
 * Deliberately approximate, and reported as advisory rather than blocking.
 */
export function extractNames(text) {
  const source = String(text ?? '');
  const names = new Set();

  for (const m of source.matchAll(/(?<=[a-z,;:]\s|\s{2,})\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*)\b/g)) {
    names.add(m[1]);
  }
  for (const m of source.matchAll(/\b[A-Za-z]+[A-Z0-9][A-Za-z0-9.]*\b/g)) {
    if (m[0].length > 2) names.add(m[0]);
  }
  return [...names];
}

/**
 * Compare the facts in the original against the proposal.
 *
 * @param {string} original
 * @param {string} proposal
 * @param {object} [options]
 * @param {string[]} [options.protectedTerms]
 * @param {boolean} [options.arabic] apply Arabic orthographic normalisation
 * @returns {{ok: boolean, missing: Fact[], added: Fact[], protectedLost: string[],
 *            namesLost: string[], warnings: object[]}}
 */
export function checkFidelity(original, proposal, { protectedTerms = [], arabic = false } = {}) {
  const src = arabic ? normaliseArabic(original) : String(original ?? '');
  const out = arabic ? normaliseArabic(proposal) : String(proposal ?? '');

  const before = extractFacts(src);
  const after = extractFacts(out);

  const afterCounts = countBy(after);
  const beforeCounts = countBy(before);

  const missing = [];
  for (const [key, count] of beforeCounts) {
    const have = afterCounts.get(key) || 0;
    if (have < count) {
      const fact = before.find(f => factKey(f) === key);
      for (let i = 0; i < count - have; i++) missing.push(fact);
    }
  }

  const added = [];
  for (const [key, count] of afterCounts) {
    const had = beforeCounts.get(key) || 0;
    if (had < count) {
      const fact = after.find(f => factKey(f) === key);
      // A number that was spelled out in the source is not an invented fact.
      if (fact.kind === 'number' && spelledOut(src, fact.value)) continue;
      for (let i = 0; i < count - had; i++) added.push(fact);
    }
  }

  const protectedLost = protectedTerms.filter(term => term && src.includes(term) && !out.includes(term));

  const beforeNames = extractNames(src);
  const afterNames = new Set(extractNames(out).map(n => n.toLowerCase()));
  const namesLost = beforeNames.filter(n => !afterNames.has(n.toLowerCase()) && !out.includes(n));

  const warnings = [];
  for (const fact of missing) {
    warnings.push({ code: 'fact_dropped', severity: 'error', message: `The ${fact.label} “${fact.raw}” is missing from the rewrite.` });
  }
  for (const fact of added) {
    warnings.push({ code: 'fact_added', severity: 'error', message: `The rewrite introduces ${article(fact.label)} ${fact.label} that was not in your text: “${fact.raw}”.` });
  }
  for (const term of protectedLost) {
    warnings.push({ code: 'protected_term_lost', severity: 'error', message: `The protected term “${term}” is missing from the rewrite.` });
  }
  for (const name of namesLost) {
    warnings.push({ code: 'name_dropped', severity: 'risk', message: `“${name}” appears in your text but not in the rewrite. Check this is intended.` });
  }

  return {
    ok: missing.length === 0 && added.length === 0 && protectedLost.length === 0,
    missing,
    added,
    protectedLost,
    namesLost,
    warnings
  };
}

function article(word) { return /^[aeiou]/i.test(String(word)) ? 'an' : 'a'; }

function factKey(fact) { return `${fact.kind}:${fact.value}`; }

function countBy(facts) {
  const map = new Map();
  for (const f of facts) map.set(factKey(f), (map.get(factKey(f)) || 0) + 1);
  return map;
}

const WORD_NUMBERS = {
  0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
  6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 12: 'twelve'
};

function spelledOut(source, value) {
  const word = WORD_NUMBERS[Number(value)];
  return Boolean(word) && new RegExp(`\\b${word}\\b`, 'i').test(source);
}
