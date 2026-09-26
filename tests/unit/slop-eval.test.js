import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRewrite } from '../../src/core/slop-eval.js';

const ok = (r, id) => r.checks.find(c => c.id === id)?.status;

test('a clean minimal edit passes every mechanical check', () => {
  const result = evaluateRewrite({
    original: 'We should leverage the robust pipeline to streamline delivery next week.',
    rewritten: 'We should use the new pipeline to speed up delivery next week.'
  });
  assert.equal(result.passed, true, JSON.stringify(result.failures));
});

test('prohibited assurance language fails', () => {
  const result = evaluateRewrite({
    original: 'Please review the draft.',
    rewritten: 'Please review the draft. This version is undetectable.'
  });
  assert.equal(ok(result, 'no-assurances'), 'fail');
  assert.equal(result.passed, false);
});

test('losing a protected term fails', () => {
  const result = evaluateRewrite({
    original: 'The Yugi-7 controller shipped on Tuesday.',
    rewritten: 'The controller shipped on Tuesday.',
    protectedTerms: ['Yugi-7']
  });
  assert.equal(ok(result, 'protected-terms'), 'fail');
});

test('newly introduced slop fails', () => {
  const result = evaluateRewrite({
    original: 'The build broke twice this morning and I rolled it back.',
    rewritten: 'The build broke twice this morning. In conclusion, I rolled it back.'
  });
  assert.equal(ok(result, 'no-new-slop'), 'fail');
});

test('over-compression is caught as disproportionate editing', () => {
  const result = evaluateRewrite({
    original: 'I spent Tuesday afternoon tracing the deadlock and it turned out to be the retry loop in the queue worker, not the database.',
    rewritten: 'It was the retry loop.'
  });
  assert.equal(ok(result, 'proportional-edit'), 'fail');
});

test('inflation is caught as disproportionate editing', () => {
  const result = evaluateRewrite({
    original: 'Ship it Friday.',
    rewritten: 'We would like to confirm that the team intends to ship the release on Friday afternoon, subject to the completion of testing.'
  });
  assert.equal(ok(result, 'proportional-edit'), 'fail');
});

test('em dash overuse in short copy fails', () => {
  const result = evaluateRewrite({
    original: 'The build failed twice before lunch.',
    rewritten: 'The build failed — twice — before lunch.'
  });
  assert.equal(ok(result, 'em-dash-budget'), 'fail');
});

test('a leaked code fence fails', () => {
  const result = evaluateRewrite({ original: 'Send it.', rewritten: '```\nSend it today.\n```' });
  assert.equal(ok(result, 'no-fence-leak'), 'fail');
});

test('empty output fails', () => {
  const result = evaluateRewrite({ original: 'Send it.', rewritten: '   ' });
  assert.equal(ok(result, 'non-empty'), 'fail');
});

test('voice recognition is reported as undecidable, never auto-passed', () => {
  const result = evaluateRewrite({ original: 'Send it today.', rewritten: 'Send it today, please.' });
  const check = result.checks.find(c => c.id === 'voice-recognisable');
  assert.equal(check.status, 'undecidable');
  assert.match(check.detail, /Only the writer can confirm/);
  // Undecidable must not block, but must not be counted as a pass either.
  assert.equal(result.failures.includes(check), false);
});

test('the comparison breakdown is returned for the UI', () => {
  const result = evaluateRewrite({
    original: 'We must leverage this.',
    rewritten: 'We must use this.'
  });
  assert.equal(result.comparison.before >= 1, true);
  assert.equal(result.comparison.after, 0);
});
