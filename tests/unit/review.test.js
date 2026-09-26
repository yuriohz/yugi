import test from 'node:test';
import assert from 'node:assert/strict';
import { calibrateReview, stripCertainty, findCertaintyClaims, REVIEW_INSTRUCTION, BANNED_CERTAINTY } from '../../src/core/review.js';
import { runTask } from '../../src/background/router.js';
import { defaultSettings } from '../../src/core/storage.js';
import { TASKS, VERDICTS, SEVERITY } from '../../src/core/constants.js';
import { fakeFetch, completion, recordingSleep } from '../helpers/fake-transport.js';

const settings = { ...defaultSettings(), apiKey: 'test-key-value', model: 'test/model' };
const base = { modelEntry: null, sleep: recordingSleep(), settings, profiles: [], customModes: [], mode: null };

const REVIEW = {
  verdict: VERDICTS.PARTIALLY_SUPPORTED,
  verdictReason: 'The conclusion follows for the first case but not the second.',
  answersTheQuestion: true,
  claims: [
    { id: 'c1', text: 'The queue drains in under a minute.', kind: 'factual', status: VERDICTS.NEEDS_VERIFICATION, reasoning: '' },
    { id: 'c2', text: 'Therefore the retry loop is safe.', kind: 'logical', status: VERDICTS.PARTIALLY_SUPPORTED, reasoning: 'Only if the queue is the bottleneck.' }
  ],
  findings: [
    { severity: SEVERITY.ERROR, title: 'The conclusion does not follow', detail: 'Queue latency does not establish retry safety.', quote: 'Therefore the retry loop is safe.' },
    { severity: SEVERITY.RISK, title: 'Unstated assumption', detail: 'Assumes a single consumer.', quote: '' },
    { severity: SEVERITY.IMPROVEMENT, title: 'Name the measurement window', detail: '', quote: '' }
  ],
  needsExternalVerification: ['The queue drains in under a minute.'],
  recommendedDirection: 'State the measured window, then draw the narrower conclusion.'
};

// ---- instruction ---------------------------------------------------------

test('the review instruction forbids rewriting and forbids web claims', () => {
  assert.match(REVIEW_INSTRUCTION, /Do not produce a rewrite in this task/);
  assert.match(REVIEW_INSTRUCTION, /You have no web access and no sources in this task/);
  assert.match(REVIEW_INSTRUCTION, /Never tell the writer they are right/);
  assert.match(REVIEW_INSTRUCTION, /internally consistent .* different statement from saying it is true/);
});

test('the instruction covers the full analysis checklist', () => {
  for (const item of [
    'internal consistency', 'causal chain', 'unstated assumptions',
    'missing constraints', 'terminology', 'calculation', 'actually answers the question'
  ]) {
    assert.ok(REVIEW_INSTRUCTION.toLowerCase().includes(item.toLowerCase()), `missing: ${item}`);
  }
});

test('the instruction separates errors, risks and improvements', () => {
  assert.match(REVIEW_INSTRUCTION, /- error:/);
  assert.match(REVIEW_INSTRUCTION, /- risk:/);
  assert.match(REVIEW_INSTRUCTION, /- improvement:/);
});

// ---- calibration ---------------------------------------------------------

test('a factual claim cannot be supported without evidence', () => {
  const out = calibrateReview({
    ...REVIEW,
    claims: [{ id: 'c1', text: 'Latency fell 40%.', kind: 'factual', status: VERDICTS.SUPPORTED }]
  });
  assert.equal(out.claims[0].status, VERDICTS.NEEDS_VERIFICATION);
  assert.ok(out.corrections.some(c => c.code === 'unsupported_factual_claim'));
});

test('a logical claim may be supported without evidence', () => {
  const out = calibrateReview({
    ...REVIEW,
    verdict: VERDICTS.SUPPORTED,
    claims: [{ id: 'c1', text: 'B follows from A.', kind: 'logical', status: VERDICTS.SUPPORTED }]
  });
  assert.equal(out.claims[0].status, VERDICTS.SUPPORTED);
  assert.equal(out.verdict, VERDICTS.SUPPORTED, 'no factual claims, so no downgrade');
});

test('a citation in a logic-only review is removed', () => {
  const out = calibrateReview({
    ...REVIEW,
    claims: [{ id: 'c1', text: 'x', kind: 'logical', status: VERDICTS.SUPPORTED, citationIds: ['c9'] }]
  });
  assert.deepEqual(out.claims[0].citationIds, []);
  assert.ok(out.corrections.some(c => c.code === 'citation_without_source'));
});

test('an overall supported verdict is downgraded when factual claims are unchecked', () => {
  const out = calibrateReview({ ...REVIEW, verdict: VERDICTS.SUPPORTED });
  assert.equal(out.verdict, VERDICTS.PARTIALLY_SUPPORTED);
  assert.ok(out.corrections.some(c => c.code === 'verdict_downgraded'));
});

test('certainty language is stripped and reported', () => {
  const out = calibrateReview({ ...REVIEW, verdictReason: 'You are right. The logic holds for the first case.' });
  assert.ok(!out.verdictReason.toLowerCase().includes('you are right'));
  assert.match(out.verdictReason, /The logic holds for the first case/);
  assert.ok(out.corrections.some(c => c.code === 'certainty_removed'));
});

test('stripCertainty removes only the offending sentence', () => {
  const { text, stripped } = stripCertainty('This is correct. The window is five minutes.');
  assert.equal(text, 'The window is five minutes.');
  assert.deepEqual(stripped, ['this is correct']);
});

test('the banned certainty list covers assurance and correctness claims', () => {
  for (const phrase of ['undetectable', 'you are right', 'proves that', 'factually correct']) {
    assert.ok(BANNED_CERTAINTY.includes(phrase), `missing: ${phrase}`);
  }
});

test('findCertaintyClaims searches every free-text field', () => {
  assert.deepEqual(findCertaintyClaims({ claims: [{ reasoning: 'This proves that the retry is safe.' }] }), ['proves that']);
  assert.deepEqual(findCertaintyClaims({ findings: [{ title: 'ok', detail: 'entirely accurate' }] }), ['entirely accurate']);
  assert.deepEqual(findCertaintyClaims(REVIEW), []);
});

test('findings are counted by severity', () => {
  const out = calibrateReview(REVIEW);
  assert.deepEqual(out.counts, { errors: 1, risks: 1, improvements: 1, needsVerification: 1 });
});

test('an unknown severity degrades to improvement rather than being trusted', () => {
  const out = calibrateReview({ ...REVIEW, findings: [{ severity: 'critical', title: 'x', detail: '' }] });
  assert.equal(out.findings[0].severity, SEVERITY.IMPROVEMENT);
});

test('the calibrated review carries a human-readable verdict label and produces no rewrite', () => {
  const out = calibrateReview(REVIEW);
  assert.equal(out.verdictLabel, 'Partially supported');
  assert.equal(out.producesRewrite, false);
  assert.equal(out.evidenceUsed, false);
});

// ---- end to end ----------------------------------------------------------

test('a logic-only review makes exactly one call and sends no tools', async () => {
  const fetchImpl = fakeFetch([completion(REVIEW)]);
  const out = await runTask(
    { task: TASKS.REVIEW, text: 'The queue drains fast, therefore the retry loop is safe.' },
    { ...base, fetchImpl }
  );
  assert.equal(fetchImpl.calls.length, 1, 'logic-only review performs no web request');
  assert.equal(fetchImpl.calls[0].body.tools, undefined, 'no tools are offered');
  assert.equal(out.result.evidenceUsed, false);
  assert.equal(out.result.counts.errors, 1);
});

test('the review prompt tells the model it has no sources', async () => {
  const fetchImpl = fakeFetch([completion(REVIEW)]);
  await runTask({ task: TASKS.REVIEW, text: 'Some reasoning to check.' }, { ...base, fetchImpl });
  const system = fetchImpl.calls[0].body.messages[0].content;
  assert.match(system, /You have no sources in this task/);
  assert.match(system, /Do not include a "proposal" field/);
});

test('the question being replied to is passed as context', async () => {
  const fetchImpl = fakeFetch([completion(REVIEW)]);
  await runTask(
    { task: TASKS.REVIEW, text: 'Yes, that works.', options: { question: 'Can you deliver by 14 March?' } },
    { ...base, fetchImpl }
  );
  assert.match(fetchImpl.calls[0].body.messages[1].content, /It is a reply to: Can you deliver by 14 March\?/);
});

test('a review that claims certainty is corrected before it reaches the user', async () => {
  const fetchImpl = fakeFetch([completion({
    ...REVIEW,
    verdict: VERDICTS.SUPPORTED,
    verdictReason: 'You are right, the response is factually correct.'
  })]);
  const out = await runTask({ task: TASKS.REVIEW, text: 'Some reasoning to check.' }, { ...base, fetchImpl });
  assert.equal(findCertaintyClaims(out.result).length, 0);
  assert.notEqual(out.result.verdict, VERDICTS.SUPPORTED);
});
