/**
 * User-journey integration tests.
 *
 * These wire the real modules together the way the extension does at runtime and
 * drive complete journeys. Only the browser and the network are simulated.
 * See ./README.md for what this does and does not cover.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { runTask, cancelTask } from '../../src/background/router.js';
import { isAllowed, setSiteShutdown, setTabShutdown, _resetTabShutdowns } from '../../src/core/shutdown.js';
import { MemoryStorageArea, defaultSettings, setSettings, getSettings } from '../../src/core/storage.js';
import { defaultProfiles, validateProfile } from '../../src/core/profiles.js';
import { getBuiltInMode } from '../../src/core/modes.js';
import { withFingerprints, revalidate, applyReplacements } from '../../src/core/ranges.js';
import { diffTokens, summariseDiff, makeUndoEntry, UndoStack } from '../../src/core/diff.js';
import { captureContext } from '../../src/core/context-consent.js';
import { adapterFor } from '../../src/core/adapters/index.js';
import { record as recordHistory, list as listHistory } from '../../src/core/history.js';
import { exportToText, planImport, applyImport } from '../../src/core/transfer.js';
import { TASKS, VERDICTS } from '../../src/core/constants.js';
import { fakeFetch, completion, forbiddenFetch, recordingSleep } from '../helpers/fake-transport.js';
import { h, doc } from '../helpers/fake-dom.js';

const KEY = 'test-key-value';

function session({ settings, area } = {}) {
  const store = area || new MemoryStorageArea();
  return {
    area: store,
    settings: { ...defaultSettings(), apiKey: KEY, model: 'test/model', ...settings },
    sleep: recordingSleep(),
    modelEntry: { id: 'test/model', name: 'Test', supported_parameters: ['response_format', 'tools'], context_length: 128000 },
    profiles: [],
    customModes: []
  };
}

test.beforeEach(() => _resetTabShutdowns());

// -------------------------------------------------------------------------
test('journey: type, get suggestions, accept one, undo it', async () => {
  const ctx = session();
  const original = 'I has a apple and the color is wrong.';

  const fetchImpl = fakeFetch([completion({
    issues: [{ start: 2, end: 5, original: 'has', replacement: 'have', message: 'Subject-verb agreement', category: 'grammar' }]
  })]);

  const out = await runTask({ task: TASKS.PROOFREAD, text: original }, { ...ctx, fetchImpl });

  // The model issue and the deterministic British-English issue are merged.
  const issues = withFingerprints(out.result.issues, original);
  assert.ok(issues.some(i => i.replacement === 'have' && i.source === 'model'));
  assert.ok(issues.some(i => i.replacement === 'colour' && i.source === 'local'));

  // Accept the first one, remembering the previous state.
  const undo = new UndoStack();
  undo.push(makeUndoEntry({ text: original, selectionStart: original.length, selectionEnd: original.length }));
  const afterOne = applyReplacements(original, [issues[0]]);
  assert.equal(afterOne, 'I have a apple and the color is wrong.');

  // Undo restores the original exactly.
  assert.equal(undo.pop().text, original);
});

// -------------------------------------------------------------------------
test('journey: edit the field mid-flight, then accept — the stale suggestion is discarded', async () => {
  const ctx = session();
  const original = 'I has a apple and teh pear.';
  const fetchImpl = fakeFetch([completion({
    issues: [
      { start: 2, end: 5, original: 'has', replacement: 'have', category: 'grammar' },
      { start: 18, end: 21, original: 'teh', replacement: 'the', category: 'spelling' }
    ]
  })]);
  const out = await runTask({ task: TASKS.PROOFREAD, text: original }, { ...ctx, fetchImpl });
  const issues = withFingerprints(out.result.issues, original);

  // The user keeps typing: text shifts, and one target is edited away.
  const edited = 'Yesterday I has a apple and the pear.';
  const { live, stale } = revalidate(issues, edited);

  assert.ok(stale.some(i => i.original === 'teh'), 'the edited-away suggestion is stale');
  const applied = applyReplacements(edited, live);
  assert.ok(applied.includes('I have a apple'), 'the shifted suggestion still applies at the right place');
  assert.ok(!applied.includes('thehe'), 'the stale suggestion did not corrupt the text');
});

// -------------------------------------------------------------------------
test('journey: rewrite in Polish mode, compare, then apply', async () => {
  const ctx = session();
  const original = 'We must leverage the robust process to deliver 12 units by 14 March 2026.';
  const proposal = 'We must use the new process to deliver 12 units by 14 March 2026.';
  const fetchImpl = fakeFetch([completion({ proposal, whatChanged: ['leverage → use'], meaningChanged: false })]);

  const out = await runTask(
    { task: TASKS.REWRITE, text: original, modeId: 'polish' },
    { ...ctx, fetchImpl, mode: getBuiltInMode('polish') }
  );

  assert.equal(out.result.guardrails.blocked, false);
  assert.equal(out.result.autoApply, false, 'never applied without the user');

  const summary = summariseDiff(diffTokens(original, out.result.proposal));
  assert.equal(summary.identical, false);
  assert.ok(summary.removed.some(r => r.includes('leverage')));

  const undo = new UndoStack();
  undo.push(makeUndoEntry({ text: original }));
  assert.equal(undo.pop().text, original);
});

// -------------------------------------------------------------------------
test('journey: a rewrite that invents a deadline is blocked before the user can apply it', async () => {
  const ctx = session();
  const fetchImpl = fakeFetch([completion({ proposal: 'I will send the contract by 14 March 2026.', meaningChanged: false })]);
  const out = await runTask(
    { task: TASKS.REWRITE, text: 'I will send the contract.', modeId: 'professional-firm' },
    { ...ctx, fetchImpl, mode: getBuiltInMode('professional-firm') }
  );
  assert.equal(out.result.guardrails.blocked, true);
  assert.ok(out.result.guardrails.violations.some(v => /not in your text/.test(v.message)));
});

// -------------------------------------------------------------------------
test('journey: WhatsApp with context consent on — the conversation is disclosed and fenced', async () => {
  const area = new MemoryStorageArea();
  const settings = { ...defaultSettings(), apiKey: KEY, model: 'test/model', context: { nearbyEnabled: true, maxMessages: 6 } };
  const page = doc([
    h('div', { role: 'row' }, [h('div', { class: 'message-in' }, [h('span', { class: 'selectable-text' }, ['Can you send the invoice for 450 dollars?'])])]),
    h('div', { role: 'row' }, [h('div', { class: 'message-out' }, [h('span', { class: 'selectable-text' }, ['Sending it now.'])])])
  ]);

  const capture = captureContext(page, { host: 'web.whatsapp.com', settings, consented: true });
  assert.equal(capture.allowed, true);
  assert.equal(capture.messages.length, 2);

  const adapter = adapterFor('web.whatsapp.com');
  const fetchImpl = fakeFetch([completion({ proposal: 'Sending the invoice now.', meaningChanged: false })]);
  await runTask(
    {
      task: TASKS.REWRITE, text: 'sending it now', modeId: 'casual',
      platform: adapter.platform,
      options: { untrustedBlocks: capture.blocks }
    },
    { ...session({ area }), settings, fetchImpl, mode: getBuiltInMode('casual') }
  );

  const body = fetchImpl.calls[0].body;
  assert.match(body.messages[0].content, /# Untrusted data/);
  assert.match(body.messages[0].content, /Do not return Markdown/);
  assert.match(body.messages[1].content, /<<<WR_UNTRUSTED_DATA>>>/);
  assert.match(body.messages[1].content, /Can you send the invoice for 450 dollars\?/);
});

// -------------------------------------------------------------------------
test('journey: WhatsApp with context consent off — no conversation leaves the page', async () => {
  const page = doc([
    h('div', { role: 'row' }, [h('div', { class: 'message-in' }, [h('span', { class: 'selectable-text' }, ['A private message'])])])
  ]);
  const capture = captureContext(page, { host: 'web.whatsapp.com', settings: defaultSettings(), consented: false });
  assert.deepEqual(capture.blocks, []);

  const fetchImpl = fakeFetch([completion({ proposal: 'ok', meaningChanged: false })]);
  await runTask(
    { task: TASKS.REWRITE, text: 'ok', modeId: 'casual', options: { untrustedBlocks: capture.blocks } },
    { ...session(), fetchImpl, mode: getBuiltInMode('casual') }
  );
  const sent = JSON.stringify(fetchImpl.calls[0].body);
  assert.ok(!sent.includes('A private message'));
  assert.ok(!sent.includes('WR_UNTRUSTED_DATA'));
});

// -------------------------------------------------------------------------
test('journey: technical review, then researched review, then a rewrite from supported claims only', async () => {
  const ctx = session();
  const text = 'Latency fell 12% last quarter, therefore the retry loop is safe.';

  const logicFetch = fakeFetch([completion({
    verdict: VERDICTS.PARTIALLY_SUPPORTED,
    verdictReason: 'The conclusion does not follow from the premise.',
    claims: [{ id: 'c1', text: 'Latency fell 12%.', kind: 'factual', status: VERDICTS.SUPPORTED }],
    findings: [{ severity: 'error', title: 'Non sequitur', detail: 'Latency does not establish retry safety.' }]
  })]);
  const logic = await runTask({ task: TASKS.REVIEW, text }, { ...ctx, fetchImpl: logicFetch, mode: null });
  assert.equal(logicFetch.calls[0].body.tools, undefined, 'the logic-only review searches nothing');
  assert.equal(logic.result.claims[0].status, VERDICTS.NEEDS_VERIFICATION, 'no sources, so no support');

  const researchFetch = fakeFetch([completion({
    verdict: VERDICTS.PARTIALLY_SUPPORTED,
    claims: [{ id: 'c1', text: 'Latency fell 12%.', kind: 'factual', status: VERDICTS.SUPPORTED, citationIds: ['s1'] }],
    citations: [{ id: 's1', title: 'Alpha report', url: 'https://example.test/a', relationship: 'supports' }],
    findings: [], contradictions: []
  }, { annotations: [{ type: 'url_citation', url_citation: { url: 'https://example.test/a', title: 'Alpha report', content: 'Latency fell 12%.' } }] })]);

  const researched = await runTask(
    { task: TASKS.RESEARCH_REVIEW, text, options: { research: true } },
    { ...ctx, fetchImpl: researchFetch, mode: null }
  );
  assert.equal(researchFetch.calls[0].body.tools[0].type, 'openrouter:web_search');
  assert.equal(researched.result.claims[0].status, VERDICTS.SUPPORTED);
  assert.equal(researched.result.applyBlocked, false);
});

// -------------------------------------------------------------------------
test('journey: a contradicting source blocks apply until it is acknowledged', async () => {
  const ctx = session();
  const fetchImpl = fakeFetch([completion({
    verdict: VERDICTS.PARTIALLY_SUPPORTED,
    claims: [{ id: 'c1', text: 'Latency fell 12%.', kind: 'factual', status: VERDICTS.CONFLICTS, citationIds: ['s1'] }],
    citations: [{ id: 's1', url: 'https://other.test/b', relationship: 'conflicts' }],
    contradictions: [{ claimId: 'c1', citationId: 's1', explanation: 'The study reports no change.' }],
    findings: []
  }, { annotations: [{ type: 'url_citation', url_citation: { url: 'https://other.test/b', title: 'Beta study', content: 'No change.' } }] })]);

  const out = await runTask(
    { task: TASKS.RESEARCH_REVIEW, text: 'Latency fell 12%.', options: { research: true } },
    { ...ctx, fetchImpl, mode: null }
  );
  assert.equal(out.result.verdict, VERDICTS.CONFLICTS);
  assert.equal(out.result.applyBlocked, true);

  const { acknowledgeContradiction } = await import('../../src/core/research.js');
  assert.equal(acknowledgeContradiction(out.result, 0).applyBlocked, false);
});

// -------------------------------------------------------------------------
test('journey: switch off for this site, then try to use it — nothing leaves the browser', async () => {
  const area = new MemoryStorageArea();
  await setSiteShutdown('https://mail.google.com', true, area);
  const ctx = session({ area });
  const fetchImpl = forbiddenFetch('site is off');

  for (const task of [TASKS.PROOFREAD, TASKS.REWRITE, TASKS.REVIEW]) {
    await assert.rejects(
      () => runTask({ task, text: 'hello there', origin: 'https://mail.google.com/mail/u/0', modeId: 'polish' },
        { ...ctx, fetchImpl, mode: getBuiltInMode('polish') }),
      e => e.code === 'shutdown_website'
    );
  }
  assert.equal(fetchImpl.calls.length, 0);

  // Re-enable and it works again.
  await setSiteShutdown('https://mail.google.com', false, area);
  const live = fakeFetch([completion({ issues: [] })]);
  await runTask({ task: TASKS.PROOFREAD, text: 'hello there', origin: 'https://mail.google.com' }, { ...ctx, fetchImpl: live });
  assert.equal(live.calls.length, 1);
});

// -------------------------------------------------------------------------
test('journey: switch off for this tab only — other tabs keep working', async () => {
  const ctx = session();
  setTabShutdown(42, true);
  const blocked = forbiddenFetch('tab 42');
  await assert.rejects(
    () => runTask({ task: TASKS.PROOFREAD, text: 'hello there' }, { ...ctx, fetchImpl: blocked, sender: { tab: { id: 42 } } }),
    e => e.code === 'shutdown_tab'
  );
  const other = fakeFetch([completion({ issues: [] })]);
  await runTask({ task: TASKS.PROOFREAD, text: 'hello there' }, { ...ctx, fetchImpl: other, sender: { tab: { id: 43 } } });
  assert.equal(other.calls.length, 1);
});

// -------------------------------------------------------------------------
test('journey: cancel a slow request', async () => {
  const ctx = session();
  let release;
  const gate = new Promise(r => { release = r; });
  const fetchImpl = fakeFetch([async () => { await gate; return completion({ issues: [] }); }]);
  const promise = runTask({ task: TASKS.PROOFREAD, requestId: 'slow-1', text: 'hello there' }, { ...ctx, fetchImpl });
  await new Promise(r => setTimeout(r, 5));
  assert.deepEqual(cancelTask('slow-1'), { cancelled: true });
  release();
  await promise.catch(() => {});
});

// -------------------------------------------------------------------------
test('journey: Arabic message in Casual mode gets Egyptian Arabic and RTL handling', async () => {
  const ctx = session();
  const text = 'ممكن تبعتلي التقرير بكرة على https://example.test/report لو سمحت؟';
  const fetchImpl = fakeFetch([completion({ proposal: 'ابعتلي التقرير بكرة على https://example.test/report لو سمحت.', meaningChanged: false })]);
  const out = await runTask(
    { task: TASKS.REWRITE, text, modeId: 'casual' },
    { ...ctx, fetchImpl, mode: getBuiltInMode('casual') }
  );
  const system = fetchImpl.calls[0].body.messages[0].content;
  assert.match(system, /natural Egyptian Arabic/);
  assert.match(system, /Do not transliterate them into Arabic/);
  assert.equal(out.result.guardrails.blocked, false, 'the URL survived the rewrite');

  const { resolveDirection, isolateRuns, stripIsolates } = await import('../../src/core/bidi.js');
  assert.equal(resolveDirection(out.result.proposal).direction, 'rtl');
  assert.ok(isolateRuns(out.result.proposal).includes('\u2068https://example.test/report\u2069'));
  assert.equal(stripIsolates(isolateRuns(out.result.proposal)), out.result.proposal);
});

// -------------------------------------------------------------------------
test('journey: set up a profile, use it, export and re-import it', async () => {
  const area = new MemoryStorageArea();
  await setSettings({ apiKey: KEY, model: 'test/model', activeProfileId: 'work' }, area);

  const { profile } = validateProfile({
    id: 'work', name: 'Work', audience: 'Clients',
    protectedTerms: ['Yugi-7'], blockedTerms: ['synergy'],
    samples: ['We ship on Thursday. No extension, and no partial release.']
  });
  const profiles = [profile, ...defaultProfiles().filter(p => p.id !== 'work')];

  const fetchImpl = fakeFetch([completion({ proposal: 'Yugi-7 ships on Thursday.', meaningChanged: false })]);
  await runTask(
    { task: TASKS.REWRITE, text: 'Yugi-7 is shipping Thursday I think', modeId: 'professional-firm', profileId: 'work' },
    { ...session({ area }), settings: await getSettings(area), area, fetchImpl, profiles, mode: getBuiltInMode('professional-firm') }
  );
  const system = fetchImpl.calls[0].body.messages[0].content;
  assert.match(system, /PROTECTED TERMS/);
  assert.match(system, /Yugi-7/);
  assert.match(system, /Never use these words or phrases: synergy/);

  // Export, then import into a fresh device.
  const { text: exported } = exportToText({ settings: await getSettings(area), profiles });
  assert.ok(!exported.includes(KEY), 'the export carries no credential');

  const fresh = new MemoryStorageArea();
  const plan = planImport(exported);
  assert.equal(plan.ok, true, JSON.stringify(plan.errors));
  await applyImport(plan.plan, fresh);
  const restored = await getSettings(fresh);
  assert.equal(restored.activeProfileId, 'work');
  assert.equal(restored.apiKey, '', 'the key is never restored from a file');
});

// -------------------------------------------------------------------------
test('journey: history off stores nothing; history on stores and then expires', async () => {
  const area = new MemoryStorageArea();
  const off = defaultSettings();
  await recordHistory({ task: 'rewrite', original: 'a', result: 'b', host: 'https://x.test' }, { area, settings: off });
  assert.deepEqual(await listHistory({ area, settings: off }), []);

  const on = { ...defaultSettings(), history: { enabled: true, ttlMs: 1000, maxEntries: 10 } };
  await recordHistory({ task: 'rewrite', original: 'a', result: 'b', host: 'https://x.test' }, { area, settings: on });
  assert.equal((await listHistory({ area, settings: on })).length, 1);
  assert.equal((await listHistory({ area, settings: on, now: Date.now() + 5000 })).length, 0);
});

// -------------------------------------------------------------------------
test('journey: draft a grounded response from a researched review', async () => {
  const ctx = session();
  const text = 'Latency fell 12% last quarter, so the retry loop is safe.';
  const researchFetch = fakeFetch([completion({
    verdict: VERDICTS.PARTIALLY_SUPPORTED,
    claims: [
      { id: 'c1', text: 'Latency fell 12% last quarter.', kind: 'factual', status: VERDICTS.SUPPORTED, citationIds: ['s1'] },
      { id: 'c2', text: 'The retry loop is safe.', kind: 'logical', status: VERDICTS.CONFLICTS, citationIds: ['s2'] }
    ],
    citations: [
      { id: 's1', title: 'Alpha report', url: 'https://example.test/a', relationship: 'supports' },
      { id: 's2', title: 'Beta study', url: 'https://other.test/b', relationship: 'conflicts' }
    ],
    contradictions: [{ claimId: 'c2', citationId: 's2', explanation: 'The study found retries still fail under load.' }],
    findings: []
  }, {
    annotations: [
      { type: 'url_citation', url_citation: { url: 'https://example.test/a', title: 'Alpha report', content: 'Latency fell 12%.' } },
      { type: 'url_citation', url_citation: { url: 'https://other.test/b', title: 'Beta study', content: 'Retries fail under load.' } }
    ]
  })]);

  const reviewed = await runTask(
    { task: TASKS.RESEARCH_REVIEW, text, options: { research: true } },
    { ...ctx, fetchImpl: researchFetch, mode: null }
  );
  assert.equal(reviewed.result.claims[0].status, VERDICTS.SUPPORTED);

  // What the widget's "Draft response" button sends.
  const { supportedClaimsOnly } = await import('../../src/core/research.js');
  const { supported, excluded } = supportedClaimsOnly(reviewed.result);
  assert.equal(supported.length, 1);
  assert.equal(excluded.length, 1);

  const draftFetch = fakeFetch([completion({
    proposal: 'Latency fell 12% last quarter. The retry loop still needs a load test.',
    meaningChanged: false
  })]);
  const drafted = await runTask(
    {
      task: TASKS.REWRITE,
      text,
      modeId: 'polish',
      options: {
        grounding: {
          supported: supported.map(c => ({ text: c.text })),
          excluded: excluded.map(c => ({ text: c.text }))
        }
      }
    },
    { ...ctx, fetchImpl: draftFetch, mode: getBuiltInMode('polish') }
  );
  const system = draftFetch.calls[0].body.messages[0].content;
  assert.match(system, /Latency fell 12% last quarter/);
  assert.match(system, /Do NOT assert/);
  assert.match(system, /The retry loop is safe/);
  assert.equal(drafted.result.grounded, true);
  assert.equal(drafted.result.guardrails.blocked, false);
});

test('journey: the gate answers consistently for the widget and for the request', async () => {
  const area = new MemoryStorageArea();
  const settings = { ...defaultSettings(), apiKey: KEY, enabled: false };
  // What the widget would show.
  const gate = await isAllowed({ origin: 'https://x.test', tabId: 1 }, { settings, area });
  assert.equal(gate.allowed, false);
  // What the request would do.
  const fetchImpl = forbiddenFetch('globally off');
  await assert.rejects(
    () => runTask({ task: TASKS.PROOFREAD, text: 'hello there', origin: 'https://x.test' }, { ...session({ area }), settings, fetchImpl }),
    e => e.code === `shutdown_${gate.blockedBy}`
  );
  assert.equal(fetchImpl.calls.length, 0);
});
