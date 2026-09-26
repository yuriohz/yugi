/**
 * Locally detected issues.
 *
 * Some corrections do not need a model: British spelling, Arabic punctuation,
 * and the deterministic slop patterns. Detecting them locally makes them
 * instant, free, and available while the extension is offline — and it keeps
 * the model focused on the things only a model can judge.
 */
import { detectAmericanisms } from './british.js';
import { detectLatinPunctuationInArabic } from './bidi.js';
import { detectScript } from './locale.js';
import { LOCALES } from './constants.js';

/**
 * @param {string} text
 * @param {object} options
 * @param {string} [options.locale]
 * @param {string[]} [options.protectedTerms]
 * @param {string[]} [options.dictionary]
 * @param {boolean} [options.includeAdvisory]
 * @returns {Array<{start:number,end:number,original:string,replacement:string,message:string,category:string,advisory:boolean,source:'local'}>}
 */
export function detectLocalIssues(text, { locale = LOCALES.EN_GB, protectedTerms = [], dictionary = [], includeAdvisory = true } = {}) {
  const source = String(text ?? '');
  if (!source.trim()) return [];

  const { script } = detectScript(source);
  const issues = [];

  if (script !== 'arabic' && String(locale).startsWith('en-GB')) {
    issues.push(...detectAmericanisms(source, { protectedTerms, dictionary, includeAdvisory }));
  }
  if (script === 'arabic' || script === 'mixed') {
    issues.push(...detectLatinPunctuationInArabic(source));
  }

  return issues
    .map(issue => ({ ...issue, source: 'local', advisory: Boolean(issue.advisory) }))
    .sort((a, b) => a.start - b.start);
}

/**
 * Merge local issues with model issues. Model issues win on overlap, because
 * the model saw the sentence and the local rule only saw the token.
 */
export function mergeIssues(modelIssues = [], localIssues = []) {
  const merged = [...modelIssues.map(i => ({ ...i, source: i.source || 'model' }))];
  const occupied = merged.map(i => [i.start, i.end]);

  for (const issue of localIssues) {
    const clashes = occupied.some(([s, e]) => issue.start < e && issue.end > s);
    if (clashes) continue;
    merged.push(issue);
    occupied.push([issue.start, issue.end]);
  }

  return merged.sort((a, b) => a.start - b.start);
}
