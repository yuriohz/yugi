import test from 'node:test';
import assert from 'node:assert/strict';
import { runTask } from '../../src/background/router.js';
import { defaultSettings } from '../../src/core/storage.js';
import { getBuiltInMode } from '../../src/core/modes.js';
import { TASKS } from '../../src/core/constants.js';
import { fakeFetch, completion, recordingSleep, forbiddenFetch } from '../helpers/fake-transport.js';

const settings = { ...defaultSettings(), apiKey: 'test-key-value', model: 'test/model' };
const base = { modelEntry: null, sleep: recordingSleep(), settings, profiles: [], customModes: [] };

function reply(payload) { return fakeFetch([completion(payload)]); }

test('a faithful Polish rewrite returns a proposal with clean guardrails', async () => {
  const text = 'We must leverage the robust process to deliver 12 units by 14 March 2026.';
  const fetchImpl = reply({
    proposal: 'We must use the new process to deliver 12 units by 14 March 2026.',
    summary: 'Removed inflated vocabulary.',
    whatChanged: ['leverage → use', 'robust → new'],
    meaningChanged: false
  });
  const out = await runTask(
    { task: TASKS.REWRITE, text, modeId: 'polish' },
    { ...base, fetchImpl, mode: getBuiltInMode('polish') }
  );
  assert.equal(out.result.modeId, 'polish');
  assert.equal(out.result.guardrails.ok, true, JSON.stringify(out.result.guardrails.violations));
  assert.equal(out.result.fidelity.ok, true);
  assert.equal(out.result.autoApply, false, 'a generative rewrite is never auto-applied');
});

test('a rewrite that drops a number is flagged and blocked', async () => {
  const text = 'Send 12 units by Friday.';
  const fetchImpl = reply({ proposal: 'Send the units by Friday.', meaningChanged: false });
  const out = await runTask(
    { task: TASKS.REWRITE, text, modeId: 'polish' },
    { ...base, fetchImpl, mode: getBuiltInMode('polish') }
  );
  assert.equal(out.result.guardrails.blocked, true);
  assert.ok(out.result.fidelity.missing.some(f => f.raw === '12'));
});

test('a rewrite that invents a deadline is blocked', async () => {
  const text = 'I will send the contract.';
  const fetchImpl = reply({ proposal: 'I will send the contract by 14 March 2026.', meaningChanged: false });
  const out = await runTask(
    { task: TASKS.REWRITE, text, modeId: 'professional-firm' },
    { ...base, fetchImpl, mode: getBuiltInMode('professional-firm') }
  );
  assert.equal(out.result.guardrails.blocked, true);
  assert.ok(out.result.guardrails.violations.some(v => /not in your text/.test(v.message)));
});

test('a rewrite that reverses the writer’s refusal is blocked', async () => {
  const text = 'I cannot take on the extra scope this quarter.';
  const fetchImpl = reply({ proposal: 'I can take on the extra scope this quarter.', meaningChanged: false });
  const out = await runTask(
    { task: TASKS.REWRITE, text, modeId: 'polite' },
    { ...base, fetchImpl, mode: getBuiltInMode('polite') }
  );
  assert.equal(out.result.guardrails.blocked, true);
});

test('the composed prompt carries safety, fidelity, anti-slop, mode and guardrails in order', async () => {
  const fetchImpl = reply({ proposal: 'Ship it today.', meaningChanged: false });
  await runTask(
    { task: TASKS.REWRITE, text: 'We should probably just ship it today.', modeId: 'casual' },
    { ...base, fetchImpl, mode: getBuiltInMode('casual') }
  );
  const system = fetchImpl.calls[0].body.messages[0].content;
  const order = ['# Safety contract', '# Fidelity contract', '# Anti-slop contract', '# Mode: Casual', '## Guardrails for this mode', '# Response contract'];
  let last = -1;
  for (const marker of order) {
    const at = system.indexOf(marker);
    assert.ok(at > last, `${marker} is missing or out of order`);
    last = at;
  }
});

test('locally detected patterns are attached to the prompt as candidates', async () => {
  const fetchImpl = reply({ proposal: 'We should use it.', meaningChanged: false });
  await runTask(
    { task: TASKS.REWRITE, text: 'We should leverage this to streamline the robust workflow.', modeId: 'polish' },
    { ...base, fetchImpl, mode: getBuiltInMode('polish') }
  );
  const system = fetchImpl.calls[0].body.messages[0].content;
  assert.match(system, /# Patterns detected locally in this text/);
  assert.match(system, /banned-word/);
});

test('a rewrite with no mode is refused before the network', async () => {
  const fetchImpl = forbiddenFetch('no mode');
  await assert.rejects(
    () => runTask({ task: TASKS.REWRITE, text: 'hello there' }, { ...base, fetchImpl, mode: null }),
    e => e.code === 'no_mode'
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('a review-only mode cannot be used for a rewrite', async () => {
  const fetchImpl = forbiddenFetch('wrong operation');
  await assert.rejects(
    () => runTask({ task: TASKS.REWRITE, text: 'hello there', modeId: 'technical-review' },
      { ...base, fetchImpl, mode: getBuiltInMode('technical-review') }),
    e => e.code === 'wrong_operation'
  );
});

test('the length control reaches the prompt', async () => {
  const fetchImpl = reply({ proposal: 'Ship it.', meaningChanged: false });
  await runTask(
    { task: TASKS.REWRITE, text: 'We should probably ship this today if nothing breaks.', modeId: 'polish', options: { length: 'shorter' } },
    { ...base, fetchImpl, mode: getBuiltInMode('polish') }
  );
  assert.match(fetchImpl.calls[0].body.messages[0].content, /Do not cut facts, conditions, or commitments/);
});

test('an Arabic rewrite selects Egyptian Arabic for Casual and MSA for Polite', async () => {
  const text = 'ممكن تبعتلي التقرير بكرة لو سمحت؟';
  const casualFetch = reply({ proposal: 'ابعتلي التقرير بكرة لو سمحت.', meaningChanged: false });
  await runTask({ task: TASKS.REWRITE, text, modeId: 'casual' }, { ...base, fetchImpl: casualFetch, mode: getBuiltInMode('casual') });
  assert.match(casualFetch.calls[0].body.messages[0].content, /Egyptian Arabic/);

  const politeFetch = reply({ proposal: 'أرجو إرسال التقرير غداً.', meaningChanged: false });
  await runTask({ task: TASKS.REWRITE, text, modeId: 'polite' }, { ...base, fetchImpl: politeFetch, mode: getBuiltInMode('polite') });
  assert.match(politeFetch.calls[0].body.messages[0].content, /Modern Standard Arabic/);
});

test('British English is the default instruction for English text', async () => {
  const fetchImpl = reply({ proposal: 'We recognise the issue.', meaningChanged: false });
  await runTask(
    { task: TASKS.REWRITE, text: 'We recognize the issue and will organize a fix.', modeId: 'polish' },
    { ...base, fetchImpl, mode: getBuiltInMode('polish') }
  );
  const system = fetchImpl.calls[0].body.messages[0].content;
  assert.match(system, /Write in British English/);
  assert.match(system, /-ise and -isation rather than -ize/);
});

test('platform constraints reach the prompt', async () => {
  const fetchImpl = reply({ proposal: 'Ship it.', meaningChanged: false });
  await runTask(
    { task: TASKS.REWRITE, text: 'We should ship this today.', modeId: 'polish', platform: { name: 'WhatsApp Web', plainText: true } },
    { ...base, fetchImpl, mode: getBuiltInMode('polish') }
  );
  assert.match(fetchImpl.calls[0].body.messages[0].content, /Do not return Markdown/);
});
