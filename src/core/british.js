/**
 * British English conventions.
 *
 * WordSaffron defaults to British spelling and punctuation. This module detects
 * Americanisms deterministically so the UI can show them as ordinary issues,
 * with exact offsets, without spending a model call.
 *
 * Deliberate limits:
 *  - words that are correct in both variants are left alone
 *  - -ize verbs of Greek origin that Oxford also accepts are marked advisory
 *  - quoted text, code, URLs and protected terms are never touched
 */
import { protectedRegions } from './slop-detector.js';

/** Suffix rules applied to whole words, preserving capitalisation. */
const SUFFIX_RULES = [
  { id: 'ize', from: /ize\b/, to: 'ise', advisory: true, note: 'British English usually prefers -ise. Oxford style also accepts -ize.' },
  { id: 'izes', from: /izes\b/, to: 'ises', advisory: true, note: 'British English usually prefers -ise.' },
  { id: 'ized', from: /ized\b/, to: 'ised', advisory: true, note: 'British English usually prefers -ised.' },
  { id: 'izing', from: /izing\b/, to: 'ising', advisory: true, note: 'British English usually prefers -ising.' },
  { id: 'ization', from: /ization\b/, to: 'isation', advisory: true, note: 'British English usually prefers -isation.' },
  { id: 'yze', from: /yze\b/, to: 'yse', advisory: false, note: 'British English uses -yse (analyse, paralyse).' },
  { id: 'yzed', from: /yzed\b/, to: 'ysed', advisory: false, note: 'British English uses -ysed.' },
  { id: 'yzing', from: /yzing\b/, to: 'ysing', advisory: false, note: 'British English uses -ysing.' }
];

/** Word-for-word replacements where the American form is simply different. */
export const WORD_MAP = Object.freeze({
  color: 'colour', colors: 'colours', colored: 'coloured', coloring: 'colouring', colorful: 'colourful',
  favor: 'favour', favors: 'favours', favorite: 'favourite', favorites: 'favourites', favorable: 'favourable',
  behavior: 'behaviour', behaviors: 'behaviours', behavioral: 'behavioural',
  honor: 'honour', honored: 'honoured', humor: 'humour', labor: 'labour', neighbor: 'neighbour',
  flavor: 'flavour', flavors: 'flavours', rumor: 'rumour', savior: 'saviour', endeavor: 'endeavour',
  center: 'centre', centers: 'centres', centered: 'centred', theater: 'theatre', meter: 'metre',
  liter: 'litre', fiber: 'fibre', caliber: 'calibre',
  catalog: 'catalogue', catalogs: 'catalogues', dialog: 'dialogue', dialogs: 'dialogues',
  analog: 'analogue', monolog: 'monologue',
  defense: 'defence', offense: 'offence', license: 'licence', pretense: 'pretence',

  traveled: 'travelled', traveling: 'travelling', traveler: 'traveller',
  canceled: 'cancelled', canceling: 'cancelling', modeling: 'modelling', modeled: 'modelled',
  labeled: 'labelled', labeling: 'labelling', signaled: 'signalled', signaling: 'signalling',
  fueled: 'fuelled', fueling: 'fuelling', enrollment: 'enrolment', fulfill: 'fulfil', fulfillment: 'fulfilment',
  skillful: 'skilful', willful: 'wilful', instill: 'instil',
  program: 'programme',
  gray: 'grey', tire: 'tyre', plow: 'plough', mold: 'mould', smolder: 'smoulder',
  draft: 'draught', check: 'cheque',
  aluminum: 'aluminium', jewelry: 'jewellery', pajamas: 'pyjamas', mustache: 'moustache',
  airplane: 'aeroplane', maneuver: 'manoeuvre',
  fall: 'autumn', vacation: 'holiday', apartment: 'flat', elevator: 'lift', truck: 'lorry',
  cellphone: 'mobile', sidewalk: 'pavement', trash: 'rubbish', garbage: 'rubbish',
  math: 'maths', soccer: 'football'
});

/**
 * Words where the British form changes the meaning, so a swap is risky and the
 * suggestion must be advisory with an explanation rather than a silent fix.
 */
const MEANING_SENSITIVE = new Set([
  'program', 'license', 'practise', 'draft', 'check', 'fall', 'soccer', 'math',
  'trash', 'garbage', 'tire', 'mold', 'meter', 'analog'
]);

/** Punctuation conventions. */
const PUNCTUATION_RULES = [
  {
    id: 'honorific-full-stop',
    re: /\b(Mr|Mrs|Ms|Dr|Prof|St)\.(?=\s+[A-Z])/g,
    replace: (_m, title) => title,
    message: 'British style omits the full stop in contractions such as Mr and Dr.'
  },
  {
    id: 'american-date',
    re: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/g,
    replace: (_m, month, day, year) => `${day} ${month} ${year}`,
    message: 'British style writes the day before the month: 14 March 2026.'
  },
  {
    id: 'oxford-comma-list',
    re: /,\s+and\s+(?=[a-z])/g,
    replace: ' and ',
    message: 'British house style usually omits the serial comma before "and".',
    advisory: true
  }
];

/**
 * @typedef {object} BritishIssue
 * @property {number} start
 * @property {number} end
 * @property {string} original
 * @property {string} replacement
 * @property {string} message
 * @property {'spelling'|'punctuation'} category
 * @property {boolean} advisory
 */

/**
 * @param {string} text
 * @param {object} [options]
 * @param {string[]} [options.protectedTerms]
 * @param {boolean} [options.includeAdvisory]
 * @param {Set<string>|string[]} [options.dictionary] personal dictionary words to skip
 * @returns {BritishIssue[]}
 */
export function detectAmericanisms(text, { protectedTerms = [], includeAdvisory = true, dictionary = [] } = {}) {
  const source = String(text ?? '');
  if (!source) return [];

  const skip = protectedRegions(source);
  for (const term of protectedTerms) {
    if (!term) continue;
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    for (const m of source.matchAll(re)) skip.push([m.index, m.index + m[0].length]);
  }
  const allowed = new Set([...dictionary].map(w => String(w).toLowerCase()));
  const covered = (a, b) => skip.some(([s, e]) => a >= s && b <= e);

  const issues = [];

  for (const m of source.matchAll(/[A-Za-z][A-Za-z'-]*/g)) {
    const word = m[0];
    const start = m.index;
    const end = start + word.length;
    if (covered(start, end)) continue;
    if (allowed.has(word.toLowerCase())) continue;

    const direct = WORD_MAP[word.toLowerCase()];
    if (direct && direct.toLowerCase() !== word.toLowerCase()) {
      const sensitive = MEANING_SENSITIVE.has(word.toLowerCase());
      if (sensitive && !includeAdvisory) continue;
      issues.push({
        start, end, original: word,
        replacement: matchCase(word, direct),
        message: sensitive
          ? `British English uses “${direct}” here, but the two words can mean different things. Check before accepting.`
          : `British English spelling: “${direct}”.`,
        category: 'spelling',
        advisory: sensitive
      });
      continue;
    }

    for (const rule of SUFFIX_RULES) {
      if (!rule.from.test(word.toLowerCase())) continue;
      if (rule.advisory && !includeAdvisory) break;
      const replacement = word.replace(new RegExp(rule.from.source, 'i'), matchCaseSuffix(word, rule));
      if (replacement === word) break;
      issues.push({
        start, end, original: word, replacement,
        message: rule.note, category: 'spelling', advisory: Boolean(rule.advisory)
      });
      break;
    }
  }

  for (const rule of PUNCTUATION_RULES) {
    if (rule.advisory && !includeAdvisory) continue;
    const re = new RegExp(rule.re.source, rule.re.flags);
    let m;
    while ((m = re.exec(source)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (covered(start, end)) continue;
      const replacement = typeof rule.replace === 'function'
        ? rule.replace(...m)
        : m[0].replace(new RegExp(rule.re.source), rule.replace);
      if (replacement === m[0]) continue;
      issues.push({
        start, end, original: m[0], replacement,
        message: rule.message, category: 'punctuation', advisory: Boolean(rule.advisory)
      });
    }
  }

  return dedupe(issues).sort((a, b) => a.start - b.start);
}

/** Apply the non-advisory conversions. Advisory ones need a human decision. */
export function britishise(text, options = {}) {
  const issues = detectAmericanisms(text, { ...options, includeAdvisory: false })
    .filter(i => !i.advisory)
    .sort((a, b) => b.start - a.start);
  let out = String(text ?? '');
  for (const issue of issues) out = out.slice(0, issue.start) + issue.replacement + out.slice(issue.end);
  return out;
}

function matchCase(source, replacement) {
  if (source === source.toUpperCase() && source.length > 1) return replacement.toUpperCase();
  if (source[0] === source[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

function matchCaseSuffix(word, rule) {
  const tail = word.slice(-rule.to.length);
  return tail === tail.toUpperCase() && /[A-Z]/.test(tail) ? rule.to.toUpperCase() : rule.to;
}

function dedupe(issues) {
  const seen = new Set();
  const out = [];
  for (const issue of issues) {
    const key = `${issue.start}:${issue.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue);
  }
  return out;
}
