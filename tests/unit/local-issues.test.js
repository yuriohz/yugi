import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLocalIssues, mergeIssues } from '../../src/core/local-issues.js';

test('British spellings are detected locally for en-GB', () => {
  const issues = detectLocalIssues('The color of the center is wrong.');
  assert.deepEqual(issues.map(i => i.replacement), ['colour', 'centre']);
  assert.ok(issues.every(i => i.source === 'local'));
});

test('no British conversion runs when the locale is American', () => {
  assert.deepEqual(detectLocalIssues('The color is wrong.', { locale: 'en-US' }), []);
});

test('Arabic punctuation is detected locally', () => {
  const issues = detectLocalIssues('أرسلت التقرير, وأرفقت الفاتورة.');
  assert.equal(issues[0].replacement, '،');
});

test('mixed content gets both Arabic punctuation and no false British hits', () => {
  const issues = detectLocalIssues('راجع التقرير على https://example.test, ثم أرسله.');
  assert.ok(issues.some(i => i.replacement === '،'));
  assert.ok(issues.every(i => i.category === 'punctuation'));
});

test('offsets point at the exact slice', () => {
  const text = 'The color is wrong.';
  const [issue] = detectLocalIssues(text);
  assert.equal(text.slice(issue.start, issue.end), issue.original);
});

test('protected terms and dictionary words are respected', () => {
  assert.deepEqual(detectLocalIssues('Open Color Center now.', { protectedTerms: ['Color Center'] }), []);
  assert.deepEqual(detectLocalIssues('The Analyzer is up.', { dictionary: ['analyzer'] }), []);
});

test('empty text yields nothing', () => {
  assert.deepEqual(detectLocalIssues('  '), []);
});

test('model issues win where they overlap a local issue', () => {
  const model = [{ start: 4, end: 9, original: 'color', replacement: 'colours', source: 'model' }];
  const local = [{ start: 4, end: 9, original: 'color', replacement: 'colour', source: 'local' }];
  const merged = mergeIssues(model, local);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].replacement, 'colours');
});

test('non-overlapping local issues are kept and the result stays sorted', () => {
  const model = [{ start: 20, end: 26, original: 'center', replacement: 'centre' }];
  const local = [{ start: 4, end: 9, original: 'color', replacement: 'colour', source: 'local' }];
  const merged = mergeIssues(model, local);
  assert.deepEqual(merged.map(i => i.start), [4, 20]);
});

test('merging with no model issues keeps every local issue', () => {
  const local = [{ start: 0, end: 5, original: 'color', replacement: 'colour', source: 'local' }];
  assert.equal(mergeIssues([], local).length, 1);
});
