import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectSlop, detectReport, compareSlop, emDashBudget, protectedRegions, summariseForPrompt
} from '../../src/core/slop-detector.js';
import { SLOPPY, CLEAN, ARABIC_SLOPPY, ARABIC_CLEAN, PROTECTED } from '../fixtures/prose.js';

test('each seeded slop fixture triggers its own rule', () => {
  for (const { ruleId, text } of SLOPPY) {
    const ids = detectSlop(text).map(f => f.ruleId);
    assert.ok(ids.includes(ruleId), `${ruleId} not detected in: ${text}\nfound: ${ids.join(', ')}`);
  }
});

test('clean human prose triggers no high-severity, non-advisory rule', () => {
  for (const text of CLEAN) {
    const hits = detectSlop(text, { includeAdvisory: false })
      .filter(f => f.severity === 'high');
    assert.deepEqual(hits.map(f => `${f.ruleId}:${f.match}`), [], `false positive in: ${text}`);
  }
});

test('Arabic fixtures trigger Arabic rules', () => {
  for (const { ruleId, text } of ARABIC_SLOPPY) {
    const ids = detectSlop(text).map(f => f.ruleId);
    assert.ok(ids.includes(ruleId), `${ruleId} not detected in: ${text}`);
  }
});

test('clean Arabic prose is not flagged', () => {
  for (const text of ARABIC_CLEAN) {
    const hits = detectSlop(text, { includeAdvisory: false });
    assert.deepEqual(hits.map(f => f.ruleId), [], `false positive in: ${text}`);
  }
});

test('script detection keeps Latin rules away from pure Arabic text', () => {
  const findings = detectSlop('جدير بالذكر أن التقرير جاهز.');
  assert.ok(findings.every(f => f.ruleId.startsWith('ar-')));
});

test('quoted text, inline code and URLs are protected from flagging', () => {
  for (const text of PROTECTED) {
    const findings = detectSlop(text, { includeAdvisory: false });
    assert.deepEqual(findings, [], `edited protected region in: ${text}`);
  }
});

test('protectedRegions finds fences, code, URLs, emails and quotes', () => {
  const regions = protectedRegions('a `code` b "quote" c https://x.test d me@x.test');
  assert.equal(regions.length, 4);
});

test('user protected terms suppress matches inside them', () => {
  const text = 'We ship Robust Ledger this week.';
  assert.ok(detectSlop(text).some(f => f.ruleId === 'banned-word'));
  assert.deepEqual(detectSlop(text, { protectedTerms: ['Robust Ledger'] }), []);
});

test('em dash budget is zero for short copy and two for long drafts', () => {
  assert.deepEqual(emDashBudget('a — b'), { count: 1, allowed: 0, words: 3, overBudget: true });
  const long = `${'word '.repeat(150)}— one — two — three`;
  const budget = emDashBudget(long);
  assert.equal(budget.allowed, 2);
  assert.equal(budget.overBudget, true);
});

test('findings are sorted by severity then position', () => {
  const text = 'Just a note. Experts agree the launch marks a pivotal moment.';
  const findings = detectSlop(text);
  const severities = findings.map(f => f.severity);
  const rank = { high: 0, medium: 1, low: 2 };
  for (let i = 1; i < severities.length; i++) {
    assert.ok(rank[severities[i - 1]] <= rank[severities[i]]);
  }
});

test('detectReport names patterns, never scores, never claims authorship', () => {
  const report = detectReport('Here\'s the thing. Experts agree this is transformative.');
  assert.ok(report.findingCount >= 2);
  assert.ok(report.findings.every(f => f.pattern && f.quote && f.fix));
  assert.ok(!('score' in report));
  assert.match(report.disclaimer, /not a score/i);
  assert.match(report.disclaimer, /not a judgement about who or what wrote/i);
});

test('compareSlop separates removed, remaining and introduced', () => {
  const before = 'We should leverage the pipeline.';
  const after = 'We should use the pipeline. In conclusion, it helps.';
  const result = compareSlop(before, after);
  assert.ok(result.removed.some(f => f.match.toLowerCase() === 'leverage'));
  assert.ok(result.introduced.some(f => f.ruleId === 'summary-recap'));
});

test('summariseForPrompt produces compact, rule-tagged guidance', () => {
  const findings = detectSlop('We must leverage and streamline the robust platform.');
  const summary = summariseForPrompt(findings);
  assert.match(summary, /banned-word/);
  assert.ok(summary.split('\n').length <= 8);
});

test('detector is bounded on pathological input', () => {
  const findings = detectSlop('just '.repeat(5000), { maxFindings: 50 });
  assert.ok(findings.length <= 50);
});

test('empty input yields no findings', () => {
  assert.deepEqual(detectSlop(''), []);
  assert.deepEqual(detectSlop('   \n  '), []);
});
