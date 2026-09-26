/**
 * Deterministic local slop detector.
 *
 * Implements the No AI Slop pattern taxonomy (see src/core/slop-rules.js and
 * THIRD_PARTY_NOTICES.md) without a model call. Three jobs:
 *
 *   1. pre-flight  — tell the model which patterns are actually present
 *   2. post-flight — verify the rewrite did not introduce new slop
 *   3. detect mode — the upstream "detect" job: name the pattern, quote the
 *                    line, give the fix, and do not rewrite
 *
 * Upstream is explicit that detectors guess and named patterns are evidence.
 * This module therefore reports findings. It never scores a draft and never
 * claims a text was written by AI.
 */
import { SLOP_RULES, ARABIC_SLOP_RULES } from './slop-rules.js';

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

/**
 * Text regions that must never be flagged: fenced code, inline code, URLs, and
 * quoted material. Editing inside them would damage meaning.
 */
export function protectedRegions(text) {
  const regions = [];
  const push = re => {
    for (const m of text.matchAll(re)) regions.push([m.index, m.index + m[0].length]);
  };
  push(/```[\s\S]*?```/g);
  push(/`[^`\n]+`/g);
  push(/\bhttps?:\/\/\S+/gi);
  push(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g);
  push(/"[^"\n]{1,300}"/g);
  push(/“[^”\n]{1,300}”/g);
  return regions.sort((a, b) => a[0] - b[0]);
}

function inProtected(regions, start, end) {
  return regions.some(([a, b]) => start >= a && end <= b);
}

function lineAt(text, index) {
  const start = text.lastIndexOf('\n', index - 1) + 1;
  let end = text.indexOf('\n', index);
  if (end === -1) end = text.length;
  return { line: text.slice(start, end).trim(), lineStart: start };
}

/**
 * @typedef {object} Finding
 * @property {string} ruleId
 * @property {string} title
 * @property {string} why
 * @property {string} fix
 * @property {'high'|'medium'|'low'} severity
 * @property {boolean} advisory
 * @property {number} start
 * @property {number} end
 * @property {string} match   the exact offending text
 * @property {string} quote   the line it appeared on
 */

/**
 * @param {string} text
 * @param {object} [options]
 * @param {string[]} [options.protectedTerms] terms the user has protected; matches inside them are skipped
 * @param {boolean} [options.includeAdvisory] include low-confidence advisory rules (default true)
 * @param {'auto'|'latin'|'arabic'|'both'} [options.script]
 * @returns {Finding[]}
 */
export function detectSlop(text, options = {}) {
  const source = String(text ?? '');
  if (!source.trim()) return [];

  const {
    protectedTerms = [],
    includeAdvisory = true,
    script = 'auto',
    maxFindings = 200
  } = options;

  const useArabic = script === 'arabic' || script === 'both'
    || (script === 'auto' && /[\u0600-\u06FF]/.test(source));
  const useLatin = script === 'latin' || script === 'both'
    || (script === 'auto' && /[A-Za-z]/.test(source));

  const rules = [
    ...(useLatin ? SLOP_RULES : []),
    ...(useArabic ? ARABIC_SLOP_RULES : [])
  ];

  const regions = protectedRegions(source);
  const termRegions = [];
  for (const term of protectedTerms) {
    if (!term) continue;
    const re = new RegExp(escapeRe(term), 'gi');
    for (const m of source.matchAll(re)) termRegions.push([m.index, m.index + m[0].length]);
  }

  const findings = [];
  const seen = new Set();

  for (const rule of rules) {
    if (rule.advisory && !includeAdvisory) continue;
    for (const detector of rule.detect) {
      const re = new RegExp(detector.source, detector.flags);
      let match;
      while ((match = re.exec(source)) !== null) {
        if (match[0].length === 0) { re.lastIndex++; continue; }
        const start = match.index;
        const end = start + match[0].length;
        if (inProtected(regions, start, end)) continue;
        if (inProtected(termRegions, start, end)) continue;
        const key = `${rule.id}:${start}:${end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const { line } = lineAt(source, start);
        findings.push({
          ruleId: rule.id,
          title: rule.titleEn || rule.title,
          why: rule.why,
          fix: rule.fix,
          severity: rule.severity,
          advisory: Boolean(rule.advisory),
          start,
          end,
          match: match[0],
          quote: line.length > 240 ? `${line.slice(0, 237)}…` : line
        });
        if (findings.length >= maxFindings) break;
      }
      if (findings.length >= maxFindings) break;
    }
    if (findings.length >= maxFindings) break;
  }

  return findings.sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.start - b.start
  );
}

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * Em dashes are allowed sparingly in longer drafts and not at all in short copy.
 * Upstream: "In short copy, use none. In longer drafts, 1-2 are fine."
 */
export function emDashBudget(text) {
  const source = String(text ?? '');
  const count = (source.match(/—/g) || []).length;
  const words = (source.match(/\S+/g) || []).length;
  const allowed = words < 120 ? 0 : 2;
  return { count, allowed, words, overBudget: count > allowed };
}

/**
 * Summarise findings for a prompt: which patterns are present, by name.
 * Keeping this short matters — the prompt should point at real problems, not
 * recite the whole rule book.
 */
export function summariseForPrompt(findings, { limit = 8 } = {}) {
  if (!findings.length) return '';
  const byRule = new Map();
  for (const f of findings) {
    if (!byRule.has(f.ruleId)) byRule.set(f.ruleId, { title: f.title, fix: f.fix, count: 0, example: f.match });
    byRule.get(f.ruleId).count++;
  }
  return [...byRule.entries()]
    .slice(0, limit)
    .map(([id, v]) => `- ${v.title} (${id}) ×${v.count}: “${truncate(v.example, 60)}” → ${v.fix}`)
    .join('\n');
}

function truncate(s, n) {
  const str = String(s).replace(/\s+/g, ' ').trim();
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

/**
 * The upstream "detect" job. Returns a report and never a rewrite.
 */
export function detectReport(text, options = {}) {
  const findings = detectSlop(text, options);
  const dashes = emDashBudget(text);
  return {
    // Explicitly not a score, and explicitly not an authorship judgement.
    disclaimer:
      'These are named patterns you can check yourself. This is not a score and not a judgement about who or what wrote the text.',
    findingCount: findings.length,
    findings: findings.map(f => ({
      pattern: f.title,
      ruleId: f.ruleId,
      quote: f.quote,
      match: f.match,
      fix: f.fix,
      severity: f.severity,
      advisory: f.advisory
    })),
    emDashes: dashes
  };
}

/**
 * Post-flight comparison. Slop the rewrite introduced is worse than slop it
 * failed to remove, so the two are reported separately.
 */
export function compareSlop(original, rewritten, options = {}) {
  const before = detectSlop(original, options);
  const after = detectSlop(rewritten, options);
  const key = f => `${f.ruleId}:${f.match.toLowerCase()}`;
  const beforeKeys = new Set(before.map(key));
  const afterKeys = new Set(after.map(key));

  return {
    before: before.length,
    after: after.length,
    removed: before.filter(f => !afterKeys.has(key(f))),
    introduced: after.filter(f => !beforeKeys.has(key(f))),
    remaining: after.filter(f => beforeKeys.has(key(f)))
  };
}
