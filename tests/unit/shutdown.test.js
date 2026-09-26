import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAllowed, setShutdown, setTabShutdown, isTabShutdown, clearTabShutdown,
  setSiteShutdown, getSiteShutdowns, normaliseOrigin, _resetTabShutdowns, SCOPES
} from '../../src/core/shutdown.js';
import { runTask, cancelAll, inFlightCount } from '../../src/background/router.js';
import { getCatalogue } from '../../src/background/model-catalogue.js';
import { MemoryStorageArea, defaultSettings, getSettings } from '../../src/core/storage.js';
import { TASKS } from '../../src/core/constants.js';
import { forbiddenFetch, fakeFetch, completion, recordingSleep } from '../helpers/fake-transport.js';

const settings = { ...defaultSettings(), apiKey: 'test-key-value', model: 'test/model' };

test.beforeEach(() => _resetTabShutdowns());

// ---- scopes --------------------------------------------------------------

test('origins are normalised, and rubbish is rejected', () => {
  assert.equal(normaliseOrigin('https://mail.google.com/mail/u/0'), 'https://mail.google.com');
  assert.equal(normaliseOrigin('mail.google.com'), 'https://mail.google.com');
  assert.equal(normaliseOrigin(''), null);
  assert.equal(normaliseOrigin('not a url at all'), null);
});

test('a global shutdown blocks every origin and tab', async () => {
  const gate = await isAllowed({ origin: 'https://a.test', tabId: 1 }, { settings: { ...settings, enabled: false } });
  assert.equal(gate.allowed, false);
  assert.equal(gate.blockedBy, SCOPES.GLOBAL);
  assert.match(gate.reason, /switched off everywhere/);
});

test('a website shutdown blocks only that origin', async () => {
  const area = new MemoryStorageArea();
  await setSiteShutdown('https://mail.google.com', true, area);
  assert.deepEqual(await getSiteShutdowns(area), ['https://mail.google.com']);

  const blocked = await isAllowed({ origin: 'https://mail.google.com' }, { settings, area });
  assert.equal(blocked.blockedBy, SCOPES.WEBSITE);
  const allowed = await isAllowed({ origin: 'https://web.whatsapp.com' }, { settings, area });
  assert.equal(allowed.allowed, true);
});

test('a website shutdown can be reversed', async () => {
  const area = new MemoryStorageArea();
  await setSiteShutdown('https://a.test', true, area);
  await setSiteShutdown('https://a.test', false, area);
  assert.deepEqual(await getSiteShutdowns(area), []);
});

test('an invalid origin cannot be switched off', async () => {
  await assert.rejects(() => setSiteShutdown('!!!', true, new MemoryStorageArea()), /valid site origin/);
});

test('a tab shutdown blocks only that tab and is cleared when the tab closes', async () => {
  setTabShutdown(7, true);
  assert.equal(isTabShutdown(7), true);
  assert.equal((await isAllowed({ tabId: 7 }, { settings })).blockedBy, SCOPES.TAB);
  assert.equal((await isAllowed({ tabId: 8 }, { settings })).allowed, true);
  clearTabShutdown(7);
  assert.equal(isTabShutdown(7), false);
});

test('precedence is global, then website, then tab', async () => {
  const area = new MemoryStorageArea();
  await setSiteShutdown('https://a.test', true, area);
  setTabShutdown(3, true);
  assert.equal((await isAllowed({ origin: 'https://a.test', tabId: 3 }, { settings: { ...settings, enabled: false }, area })).blockedBy, SCOPES.GLOBAL);
  assert.equal((await isAllowed({ origin: 'https://a.test', tabId: 3 }, { settings, area })).blockedBy, SCOPES.WEBSITE);
  assert.equal((await isAllowed({ origin: 'https://b.test', tabId: 3 }, { settings, area })).blockedBy, SCOPES.TAB);
});

test('setShutdown writes each scope and rejects an unknown one', async () => {
  const area = new MemoryStorageArea();
  await setShutdown({ scope: SCOPES.GLOBAL, value: true }, area);
  assert.equal((await getSettings(area)).enabled, false);
  await setShutdown({ scope: SCOPES.GLOBAL, value: false }, area);
  assert.equal((await getSettings(area)).enabled, true);
  await setShutdown({ scope: SCOPES.WEBSITE, value: true, origin: 'https://a.test' }, area);
  assert.deepEqual(await getSiteShutdowns(area), ['https://a.test']);
  await setShutdown({ scope: SCOPES.TAB, value: true, tabId: 4 }, area);
  assert.equal(isTabShutdown(4), true);
  await assert.rejects(() => setShutdown({ scope: 'planet', value: true }, area), /Unknown shutdown scope/);
});

// ---- the zero-call guarantee --------------------------------------------

const EVERY_TASK = Object.values(TASKS);

test('while globally off, no task makes any network call', async () => {
  for (const task of EVERY_TASK) {
    const fetchImpl = forbiddenFetch(`global off: ${task}`);
    await assert.rejects(
      () => runTask({ task, text: 'some text to work on', options: { research: true, testCase: { input: 'x' } } },
        { settings: { ...settings, enabled: false }, fetchImpl, modelEntry: null, profiles: [], customModes: [], mode: null, sleep: recordingSleep() }),
      e => e.code === 'shutdown_global',
      `task ${task} must be blocked`
    );
    assert.equal(fetchImpl.calls.length, 0, `task ${task} made a request while switched off`);
  }
});

test('while a website is off, no task makes any network call on that site', async () => {
  const area = new MemoryStorageArea();
  await setSiteShutdown('https://mail.google.com', true, area);
  for (const task of EVERY_TASK) {
    const fetchImpl = forbiddenFetch(`site off: ${task}`);
    await assert.rejects(
      () => runTask({ task, text: 'some text to work on', origin: 'https://mail.google.com/mail/u/0', options: { research: true, testCase: { input: 'x' } } },
        { settings, area, fetchImpl, modelEntry: null, profiles: [], customModes: [], mode: null, sleep: recordingSleep() }),
      e => e.code === 'shutdown_website'
    );
    assert.equal(fetchImpl.calls.length, 0);
  }
});

test('while a tab is off, no task makes any network call in that tab', async () => {
  setTabShutdown(11, true);
  for (const task of EVERY_TASK) {
    const fetchImpl = forbiddenFetch(`tab off: ${task}`);
    await assert.rejects(
      () => runTask({ task, text: 'some text to work on', options: { research: true, testCase: { input: 'x' } } },
        { settings, fetchImpl, sender: { tab: { id: 11 } }, modelEntry: null, profiles: [], customModes: [], mode: null, sleep: recordingSleep() }),
      e => e.code === 'shutdown_tab'
    );
    assert.equal(fetchImpl.calls.length, 0);
  }
});

test('the gate runs before the model catalogue is consulted', async () => {
  const fetchImpl = forbiddenFetch('catalogue');
  await assert.rejects(
    () => runTask({ task: TASKS.PROOFREAD, text: 'hello there' },
      { settings: { ...settings, enabled: false }, fetchImpl, sleep: recordingSleep() }),
    e => e.code === 'shutdown_global'
  );
  assert.equal(fetchImpl.calls.length, 0, 'not even a catalogue lookup is permitted');
});

test('switching off cancels work already in flight', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const fetchImpl = fakeFetch([async () => { await gate; return completion({ issues: [] }); }]);
  const promise = runTask({ task: TASKS.PROOFREAD, requestId: 'live-1', text: 'hello there' },
    { settings, fetchImpl, modelEntry: null, profiles: [], customModes: [], sleep: recordingSleep() });
  await new Promise(r => setTimeout(r, 5));
  assert.equal(inFlightCount(), 1);
  assert.deepEqual(cancelAll(), { cancelled: 1 });
  release();
  await promise.catch(() => {});
  assert.equal(inFlightCount(), 0);
});

test('a cached catalogue is served without a network call', async () => {
  const area = new MemoryStorageArea();
  await getCatalogue({ fetchImpl: fakeFetch([completion('{}')]), area });
  const forbidden = forbiddenFetch('cached catalogue');
  const result = await getCatalogue({ fetchImpl: forbidden, area });
  assert.equal(forbidden.calls.length, 0);
  assert.ok(['cache', 'fallback'].includes(result.source));
});

test('re-enabling restores normal operation', async () => {
  const area = new MemoryStorageArea();
  await setShutdown({ scope: SCOPES.GLOBAL, value: true }, area);
  await setShutdown({ scope: SCOPES.GLOBAL, value: false }, area);
  const fetchImpl = fakeFetch([completion({ issues: [] })]);
  const out = await runTask({ task: TASKS.PROOFREAD, text: 'hello there' },
    { settings: { ...(await getSettings(area)), apiKey: 'test-key-value' }, area, fetchImpl, modelEntry: null, profiles: [], customModes: [], sleep: recordingSleep() });
  assert.equal(fetchImpl.calls.length, 1);
  assert.deepEqual(out.result.issues, []);
});
