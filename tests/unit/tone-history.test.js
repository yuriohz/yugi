import test from 'node:test';
import assert from 'node:assert/strict';
import { runTask } from '../../src/background/router.js';
import { groundEvidence } from '../../src/background/tasks.js';
import { makeEntry, prune, record, list, clear, remove, describeHistory } from '../../src/core/history.js';
import { MemoryStorageArea, defaultSettings, getCollection } from '../../src/core/storage.js';
import { buildExport } from '../../src/core/transfer.js';
import { TASKS, STORAGE_KEYS, LIMITS } from '../../src/core/constants.js';
import { fakeFetch, completion, recordingSleep } from '../helpers/fake-transport.js';

const settings = { ...defaultSettings(), apiKey: 'test-key-value', model: 'test/model' };
const base = { modelEntry: null, sleep: recordingSleep(), settings, profiles: [], customModes: [], mode: null };
const TEXT = 'I need this by Friday. I have asked twice already and I am running out of patience.';

// ---- tone ----------------------------------------------------------------

test('tone analysis returns dimensions grounded in quoted evidence', async () => {
  const fetchImpl = fakeFetch([completion({
    dimensions: [
      { name: 'urgency', strength: 0.8, evidence: ['I need this by Friday.'] },
      { name: 'frustration', strength: 0.6, evidence: ['running out of patience'] }
    ],
    overall: 'Direct and pressed for time.',
    mismatch: ''
  })]);
  const out = await runTask({ task: TASKS.TONE, text: TEXT }, { ...base, fetchImpl });
  assert.equal(out.result.dimensions.length, 2);
  assert.equal(out.result.dropped, 0);
});

test('a tone dimension whose quote is not in the text is dropped and reported', async () => {
  const fetchImpl = fakeFetch([completion({
    dimensions: [
      { name: 'urgency', strength: 0.8, evidence: ['I need this by Friday.'] },
      { name: 'hostility', strength: 0.9, evidence: ['you people never deliver'] }
    ],
    overall: 'x'
  })]);
  const out = await runTask({ task: TASKS.TONE, text: TEXT }, { ...base, fetchImpl });
  assert.deepEqual(out.result.dimensions.map(d => d.name), ['urgency']);
  assert.equal(out.result.dropped, 1);
  assert.match(out.result.note, /quoted evidence was not found in your text/);
});

test('evidence matching tolerates whitespace and case differences', () => {
  const grounded = groundEvidence({ dimensions: [{ name: 'x', evidence: ['I  NEED   this by friday.'] }] }, TEXT);
  assert.equal(grounded.dimensions.length, 1);
});

test('the tone instruction forbids judging the writer and forbids editing', async () => {
  const fetchImpl = fakeFetch([completion({ dimensions: [{ name: 'urgency', evidence: ['I need this by Friday.'] }] })]);
  await runTask({ task: TASKS.TONE, text: TEXT }, { ...base, fetchImpl });
  const system = fetchImpl.calls[0].body.messages[0].content;
  assert.match(system, /must not describe the writer’s character, mood, or intentions/);
  assert.match(system, /Tone analysis is read-only/);
});

// ---- reader reaction -----------------------------------------------------

test('reader reactions are hedged and tied to quoted wording', async () => {
  const fetchImpl = fakeFetch([completion({
    reactions: [
      { audience: 'the supplier', possibleInterpretation: 'Could read as a final warning.', trigger: 'running out of patience', likelihood: 'plausible' }
    ],
    caveat: ''
  })]);
  const out = await runTask(
    { task: TASKS.READER_REACTION, text: TEXT, options: { audiences: ['the supplier'] } },
    { ...base, fetchImpl }
  );
  assert.equal(out.result.reactions.length, 1);
  assert.equal(out.result.isPrediction, false);
  assert.match(out.result.caveat, /not predictions about how any particular person will react/);
  assert.match(fetchImpl.calls[0].body.messages[1].content, /How might this text be read by: the supplier\?/);
});

test('a reaction tied to wording that is not in the text is dropped', async () => {
  const fetchImpl = fakeFetch([completion({
    reactions: [
      { audience: 'the supplier', possibleInterpretation: 'a', trigger: 'running out of patience', likelihood: 'possible' },
      { audience: 'the supplier', possibleInterpretation: 'b', trigger: 'I will escalate to legal', likelihood: 'likely' }
    ]
  })]);
  const out = await runTask({ task: TASKS.READER_REACTION, text: TEXT }, { ...base, fetchImpl });
  assert.equal(out.result.reactions.length, 1);
  assert.equal(out.result.reactions[0].possibleInterpretation, 'a');
});

test('a reaction claiming certainty is rejected by the schema', async () => {
  const fetchImpl = fakeFetch([completion({
    reactions: [{ audience: 'x', possibleInterpretation: 'They will be furious.', likelihood: 'certain' }]
  })]);
  await assert.rejects(
    () => runTask({ task: TASKS.READER_REACTION, text: TEXT }, { ...base, fetchImpl }),
    e => e.code === 'schema_mismatch'
  );
});

test('the reader instruction forbids diagnosing or inventing facts about the reader', async () => {
  const fetchImpl = fakeFetch([completion({ reactions: [{ audience: 'x', possibleInterpretation: 'y', likelihood: 'possible' }] })]);
  await runTask({ task: TASKS.READER_REACTION, text: TEXT }, { ...base, fetchImpl });
  const system = fetchImpl.calls[0].body.messages[0].content;
  assert.match(system, /must not state what the reader will think, feel, or do/);
  assert.match(system, /must not diagnose, psychoanalyse, or attribute motives/);
  assert.match(system, /"certain" is not available/);
});

// ---- history -------------------------------------------------------------

const ENTRY = { task: 'rewrite', modeId: 'polish', original: 'before text', result: 'after text', host: 'https://web.whatsapp.com/x', model: 'a/b', usage: { cost: 0.001, totalTokens: 300 } };

test('history is off by default and stores nothing', async () => {
  const area = new MemoryStorageArea();
  const result = await record(ENTRY, { area, settings: defaultSettings() });
  assert.equal(result.stored, false);
  assert.deepEqual(await getCollection(STORAGE_KEYS.HISTORY, [], area), []);
});

test('switching history off clears what was already stored', async () => {
  const area = new MemoryStorageArea();
  const on = { ...defaultSettings(), history: { enabled: true, ttlMs: LIMITS.HISTORY_TTL_MS, maxEntries: 50 } };
  await record(ENTRY, { area, settings: on });
  assert.equal((await getCollection(STORAGE_KEYS.HISTORY, [], area)).length, 1);
  await record(ENTRY, { area, settings: defaultSettings() });
  assert.deepEqual(await getCollection(STORAGE_KEYS.HISTORY, [], area), []);
});

test('an entry stores the origin host, never the full URL', () => {
  const entry = makeEntry({ ...ENTRY, host: 'https://mail.google.com/mail/u/0/#inbox/SECRET_THREAD_ID' });
  assert.equal(entry.host, 'mail.google.com');
  assert.ok(!JSON.stringify(entry).includes('SECRET_THREAD_ID'));
});

test('credentials are redacted before anything is stored', () => {
  const fake = ['sk', 'or', 'v1', 'e'.repeat(40)].join('-');
  const entry = makeEntry({ ...ENTRY, original: `my key is ${fake}` });
  assert.ok(!entry.original.includes(fake));
  assert.equal(entry.redactions, 1);
});

test('long text is truncated and flagged rather than archived whole', () => {
  const entry = makeEntry({ ...ENTRY, original: 'x'.repeat(5000) });
  assert.ok(entry.original.length <= 2001);
  assert.equal(entry.truncated, true);
});

test('entries expire on read, not only on write', async () => {
  const area = new MemoryStorageArea();
  const on = { ...defaultSettings(), history: { enabled: true, ttlMs: 1000, maxEntries: 50 } };
  await record(ENTRY, { area, settings: on });
  assert.equal((await list({ area, settings: on })).length, 1);
  const later = Date.now() + 5000;
  assert.equal((await list({ area, settings: on, now: later })).length, 0);
  assert.deepEqual(await getCollection(STORAGE_KEYS.HISTORY, [], area), [], 'the expired entry is deleted, not just hidden');
});

test('the entry cap is enforced and the newest survive', () => {
  const entries = Array.from({ length: 80 }, (_, i) => ({ id: `h${i}`, at: Date.now() - i * 1000 }));
  const pruned = prune(entries, { maxEntries: 10 });
  assert.equal(pruned.length, 10);
  assert.equal(pruned[0].id, 'h0');
});

test('history can be cleared in one action, and single entries removed', async () => {
  const area = new MemoryStorageArea();
  const on = { ...defaultSettings(), history: { enabled: true, ttlMs: LIMITS.HISTORY_TTL_MS, maxEntries: 50 } };
  const first = await record(ENTRY, { area, settings: on });
  await record(ENTRY, { area, settings: on });
  assert.equal((await list({ area, settings: on })).length, 2);
  await remove(first.entries[0].id, area);
  assert.equal((await list({ area, settings: on })).length, 1);
  await clear(area);
  assert.equal((await list({ area, settings: on })).length, 0);
});

test('history never appears in an export', async () => {
  const area = new MemoryStorageArea();
  const on = { ...defaultSettings(), history: { enabled: true, ttlMs: LIMITS.HISTORY_TTL_MS, maxEntries: 50 } };
  await record({ ...ENTRY, original: 'a private draft nobody should export' }, { area, settings: on });
  const entries = await getCollection(STORAGE_KEYS.HISTORY, [], area);
  const { payload } = buildExport({ settings: on, history: entries });
  const text = JSON.stringify(payload);
  assert.ok(!text.includes('a private draft nobody should export'));
  assert.equal(payload.history, undefined);
});

test('the settings description tells the truth in both states', () => {
  const off = describeHistory(defaultSettings(), []);
  assert.equal(off.enabled, false);
  assert.match(off.summary, /Nothing you write is being stored/);

  const on = describeHistory({ history: { enabled: true, ttlMs: 7 * 86_400_000, maxEntries: 50 } }, [{}, {}]);
  assert.equal(on.enabled, true);
  assert.match(on.summary, /2 items stored on this device/);
  assert.match(on.detail, /deleted after 7 days/);
  assert.match(on.detail, /never leaves this device and is never included in an export/);
});
