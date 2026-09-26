import test from 'node:test';
import assert from 'node:assert/strict';
import { runTask, cancelTask, testConnection, inFlightCount, SUPPORTED_TASKS } from '../../src/background/router.js';
import { validateIssues } from '../../src/background/tasks.js';
import { defaultSettings, MemoryStorageArea } from '../../src/core/storage.js';
import { _resetTabShutdowns, setTabShutdown, setSiteShutdown } from '../../src/core/shutdown.js';
import { TASKS } from '../../src/core/constants.js';
import { fakeFetch, completion, forbiddenFetch, recordingSleep } from '../helpers/fake-transport.js';

const settings = { ...defaultSettings(), apiKey: 'test-key-value', model: 'test/model' };
const base = { modelEntry: null, sleep: recordingSleep() };

test('every declared task is routable', () => {
  for (const task of Object.values(TASKS)) assert.ok(SUPPORTED_TASKS.has(task));
});

test('an unknown task is refused before any network call', async () => {
  const fetchImpl = forbiddenFetch('unknown task');
  await assert.rejects(
    () => runTask({ task: 'exfiltrate', text: 'hi' }, { ...base, settings, fetchImpl }),
    e => e.code === 'bad_task'
  );
});

test('non-string and oversized input is refused before any network call', async () => {
  const fetchImpl = forbiddenFetch('bad input');
  await assert.rejects(
    () => runTask({ task: TASKS.PROOFREAD, text: 42 }, { ...base, settings, fetchImpl }),
    e => e.code === 'bad_input'
  );
  await assert.rejects(
    () => runTask({ task: TASKS.PROOFREAD, text: 'x'.repeat(20_001) }, { ...base, settings, fetchImpl }),
    e => e.code === 'too_long'
  );
  await assert.rejects(
    () => runTask({ task: TASKS.PROOFREAD, text: '   ' }, { ...base, settings, fetchImpl }),
    e => e.code === 'empty_input'
  );
});

test('a global shutdown blocks the request with zero network calls', async () => {
  const fetchImpl = forbiddenFetch('global shutdown');
  await assert.rejects(
    () => runTask({ task: TASKS.PROOFREAD, text: 'hello there' }, { ...base, settings: { ...settings, enabled: false }, fetchImpl }),
    e => e.code === 'shutdown_global'
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('a website shutdown blocks the request with zero network calls', async () => {
  const area = new MemoryStorageArea();
  await setSiteShutdown('https://mail.google.com', true, area);
  const fetchImpl = forbiddenFetch('site shutdown');
  await assert.rejects(
    () => runTask(
      { task: TASKS.PROOFREAD, text: 'hello there', origin: 'https://mail.google.com' },
      { ...base, settings, area, fetchImpl }
    ),
    e => e.code === 'shutdown_website'
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('a tab shutdown blocks the request with zero network calls', async () => {
  _resetTabShutdowns();
  setTabShutdown(7, true);
  const fetchImpl = forbiddenFetch('tab shutdown');
  await assert.rejects(
    () => runTask({ task: TASKS.PROOFREAD, text: 'hello there' }, { ...base, settings, fetchImpl, sender: { tab: { id: 7 } } }),
    e => e.code === 'shutdown_tab'
  );
  assert.equal(fetchImpl.calls.length, 0);
  _resetTabShutdowns();
});

test('proofread returns validated issues and usage', async () => {
  const text = 'I has a apple.';
  const fetchImpl = fakeFetch([completion(
    { issues: [{ start: 2, end: 5, original: 'has', replacement: 'have', message: 'Subject-verb agreement', category: 'grammar' }] },
    { usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, cost: 0.0004 } }
  )]);
  const out = await runTask({ task: TASKS.PROOFREAD, text }, { ...base, settings, fetchImpl });
  assert.equal(out.task, 'proofread');
  assert.equal(out.result.issues.length, 1);
  assert.equal(out.result.issues[0].replacement, 'have');
  assert.equal(out.usage.cost, 0.0004);
  assert.equal(out.usage.costSource, 'reported');
});

test('a model response that is not JSON is rejected, not guessed at', async () => {
  const fetchImpl = fakeFetch([completion('Sure! Here are some thoughts about your text.')]);
  await assert.rejects(
    () => runTask({ task: TASKS.PROOFREAD, text: 'hello there' }, { ...base, settings, fetchImpl }),
    e => e.code === 'bad_output'
  );
});

test('a response that violates the task schema is rejected', async () => {
  const fetchImpl = fakeFetch([completion({ issues: 'not an array' })]);
  await assert.rejects(
    () => runTask({ task: TASKS.PROOFREAD, text: 'hello there' }, { ...base, settings, fetchImpl }),
    e => e.code === 'schema_mismatch'
  );
});

test('response_format is omitted for a model without structured-output support', async () => {
  const fetchImpl = fakeFetch([completion({ issues: [] })]);
  const out = await runTask({ task: TASKS.PROOFREAD, text: 'hello there' }, {
    ...base, settings, fetchImpl,
    modelEntry: { id: 'test/model', supported_parameters: [], context_length: 8000 }
  });
  assert.equal(fetchImpl.calls[0].body.response_format, undefined);
  assert.match(out.warnings.join(' '), /does not advertise structured output/);
});

test('research is blocked on a model without tool support', async () => {
  const fetchImpl = forbiddenFetch('no tools');
  await assert.rejects(
    () => runTask({ task: TASKS.RESEARCH_REVIEW, text: 'check this' }, {
      ...base, settings, fetchImpl,
      modelEntry: { id: 'test/model', supported_parameters: ['response_format'], context_length: 8000 }
    }),
    e => e.code === 'model_incompatible'
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('research is blocked when tool support is unknown rather than assumed', async () => {
  const fetchImpl = forbiddenFetch('unknown tools');
  await assert.rejects(
    () => runTask({ task: TASKS.RESEARCH_REVIEW, text: 'check this' }, { ...base, settings, fetchImpl, modelEntry: null }),
    e => /cannot confirm/.test(e.message)
  );
});

test('text beyond the model context window is refused before the call', async () => {
  const fetchImpl = forbiddenFetch('context');
  await assert.rejects(
    () => runTask({ task: TASKS.PROOFREAD, text: 'x'.repeat(19_000) }, {
      ...base, settings, fetchImpl,
      modelEntry: { id: 'test/model', name: 'Tiny', supported_parameters: ['response_format'], context_length: 4096 }
    }),
    e => e.code === 'context_exceeded'
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('every declared task has a builder, so none can silently fall through', async () => {
  const { registeredTasks } = await import('../../src/background/tasks.js');
  assert.deepEqual(registeredTasks().sort(), Object.values(TASKS).sort());
});

test('a task with no builder fails loudly instead of returning something plausible', async () => {
  const { buildRequest } = await import('../../src/background/tasks.js');
  await assert.rejects(
    () => buildRequest({ task: 'summarise_everything' }),
    e => e.code === 'not_implemented'
  );
});

test('in-flight requests are tracked and cancellable', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const fetchImpl = fakeFetch([async () => { await gate; return completion({ issues: [] }); }]);
  const promise = runTask({ task: TASKS.PROOFREAD, requestId: 'req-1', text: 'hello there' }, { ...base, settings, fetchImpl });
  await new Promise(r => setTimeout(r, 5));
  assert.equal(inFlightCount(), 1);
  assert.deepEqual(cancelTask('req-1'), { cancelled: true });
  release();
  await promise.catch(() => {});
  assert.equal(inFlightCount(), 0);
  assert.deepEqual(cancelTask('req-1'), { cancelled: false });
});

test('testConnection refuses without a key and reports the model on success', async () => {
  await assert.rejects(
    () => testConnection({ apiKey: '' }, { settings: { ...settings, apiKey: '' }, fetchImpl: forbiddenFetch('no key') }),
    e => e.code === 'no_key'
  );
  const fetchImpl = fakeFetch([completion('OK', { model: 'resolved/model' })]);
  const result = await testConnection({}, { settings, fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.model, 'resolved/model');
});

// ---- offset validation ---------------------------------------------------

test('issues with impossible offsets are dropped, not repaired', () => {
  const text = 'hello world';
  const issues = validateIssues([
    { start: -1, end: 3, original: 'hel', replacement: 'Hel' },
    { start: 0, end: 99, original: 'hello', replacement: 'Hello' },
    { start: 5, end: 5, original: '', replacement: 'x' },
    { start: 0, end: 5, original: 'HELLO', replacement: 'Hello' },
    { start: 0, end: 5, original: 'hello', replacement: 'hello' }
  ], text);
  assert.deepEqual(issues, []);
});

test('overlapping issues are reduced to a non-conflicting set', () => {
  const text = 'the quick brown fox';
  const issues = validateIssues([
    { start: 4, end: 9, original: 'quick', replacement: 'fast' },
    { start: 4, end: 15, original: 'quick brown', replacement: 'speedy' }
  ], text);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].replacement, 'fast');
});

test('a correction that would destroy a protected term is dropped', () => {
  const text = 'Deploy Yugi-7 on Friday.';
  const kept = validateIssues([{ start: 7, end: 13, original: 'Yugi-7', replacement: 'Yugi 7' }], text, []);
  assert.equal(kept.length, 1);
  const dropped = validateIssues([{ start: 7, end: 13, original: 'Yugi-7', replacement: 'Yugi 7' }], text, ['Yugi-7']);
  assert.deepEqual(dropped, []);
});

test('duplicate suggestions are collapsed', () => {
  const text = 'teh teh';
  const issues = validateIssues([
    { start: 0, end: 3, original: 'teh', replacement: 'the' },
    { start: 0, end: 3, original: 'teh', replacement: 'the' }
  ], text);
  assert.equal(issues.length, 1);
});
