import test from 'node:test';
import assert from 'node:assert/strict';
import { t, validate } from '../../src/core/schema.js';
import { validateTaskResult, schemaDescriptionFor, TASK_SCHEMAS } from '../../src/core/task-schemas.js';
import { TASKS, VERDICTS } from '../../src/core/constants.js';

test('required fields are enforced', () => {
  const r = validate({}, t.object({ a: t.string() }));
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /\$\.a is required/);
});

test('defaults fill missing fields', () => {
  const r = validate({}, t.object({ a: t.string({ default: 'x' }) }));
  assert.equal(r.ok, true);
  assert.equal(r.value.a, 'x');
});

test('unknown keys are dropped', () => {
  const r = validate({ a: 'y', evil: 1 }, t.object({ a: t.string() }));
  assert.deepEqual(r.value, { a: 'y' });
});

test('prototype keys never reach the output', () => {
  const r = validate(JSON.parse('{"a":"y","__proto__":{"p":1}}'), t.object({ a: t.string() }));
  assert.equal(r.value.p, undefined);
  assert.equal({}.p, undefined);
});

test('enums reject values outside the set', () => {
  assert.equal(validate('maybe', t.enumOf(['yes', 'no'])).ok, false);
  assert.equal(validate('yes', t.enumOf(['yes', 'no'])).ok, true);
});

test('numeric bounds and integer-ness are enforced', () => {
  assert.equal(validate(1.5, t.integer()).ok, false);
  assert.equal(validate(11, t.number({ max: 10 })).ok, false);
  assert.equal(validate('7', t.integer()).value, 7);
});

test('strings are trimmed and truncated, not rejected, when too long', () => {
  const r = validate('  abcdef  ', t.string({ maxLength: 3 }));
  assert.equal(r.value, 'abc');
});

test('arrays drop unusable items instead of failing the whole response', () => {
  const r = validate([{ a: 'ok' }, { b: 'bad' }], t.array(t.object({ a: t.string() })));
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, [{ a: 'ok' }]);
});

test('arrays honour maxItems and minItems', () => {
  assert.equal(validate([1, 2, 3], t.array(t.number(), { maxItems: 2 })).value.length, 2);
  assert.equal(validate([], t.array(t.number(), { minItems: 1 })).ok, false);
});

// ---- task contracts ------------------------------------------------------

test('every task has a schema and a prompt description', () => {
  for (const task of Object.values(TASKS)) {
    assert.ok(TASK_SCHEMAS[task], `no schema for ${task}`);
    assert.ok(schemaDescriptionFor(task).length > 40, `no description for ${task}`);
  }
});

test('rewrite output requires a proposal', () => {
  assert.equal(validateTaskResult(TASKS.REWRITE, { summary: 'x' }).ok, false);
  const good = validateTaskResult(TASKS.REWRITE, { proposal: 'hello' });
  assert.equal(good.ok, true);
  assert.equal(good.value.meaningChanged, false);
  assert.deepEqual(good.value.warnings, []);
});

test('review output only accepts calibrated verdicts', () => {
  assert.equal(validateTaskResult(TASKS.REVIEW, { verdict: 'you are right' }).ok, false);
  assert.equal(validateTaskResult(TASKS.REVIEW, { verdict: VERDICTS.NEEDS_VERIFICATION }).ok, true);
});

test('research review accepts citations with relationships', () => {
  const r = validateTaskResult(TASKS.RESEARCH_REVIEW, {
    verdict: VERDICTS.CONFLICTS,
    citations: [{ id: 'c1', url: 'https://example.test/a', relationship: 'conflicts' }],
    claims: [{ text: 'x', status: VERDICTS.CONFLICTS, citationIds: ['c1'] }]
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.citations[0].relationship, 'conflicts');
});

test('a citation without a URL is dropped', () => {
  const r = validateTaskResult(TASKS.RESEARCH_REVIEW, {
    verdict: VERDICTS.UNVERIFIABLE,
    citations: [{ id: 'c1', title: 'no url' }]
  });
  assert.deepEqual(r.value.citations, []);
});

test('tone output requires at least one dimension', () => {
  assert.equal(validateTaskResult(TASKS.TONE, { dimensions: [] }).ok, false);
  assert.equal(validateTaskResult(TASKS.TONE, { dimensions: [{ name: 'direct', evidence: ['ship it'] }] }).ok, true);
});

test('reader reaction likelihood is hedged by contract', () => {
  const r = validateTaskResult(TASKS.READER_REACTION, {
    reactions: [{ possibleInterpretation: 'could read as curt', likelihood: 'certain' }]
  });
  // "certain" is not in the enum, so the item is dropped and the minimum fails.
  assert.equal(r.ok, false);
});

test('reader reaction descriptions forbid asserting the reader’s state of mind', () => {
  assert.match(schemaDescriptionFor(TASKS.READER_REACTION), /Never state what the reader will think, feel, or do/);
});

test('research review description forbids inventing URLs', () => {
  assert.match(schemaDescriptionFor(TASKS.RESEARCH_REVIEW), /Never write a URL you did not receive/);
});

test('an unregistered task yields an explicit error', () => {
  const r = validateTaskResult('nope', {});
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /No schema registered/);
});
