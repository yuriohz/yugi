import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILT_IN_MODES, getBuiltInMode, isBuiltIn, duplicateMode,
  lengthInstruction, GUARDRAILS, OPERATION, LENGTH
} from '../../src/core/modes.js';
import { enforceGuardrails, detectPositionFlip } from '../../src/core/guardrails.js';
import { guardrailLayer } from '../../src/background/tasks.js';
import { LOCALES } from '../../src/core/constants.js';

test('exactly the five specified modes ship as built-ins', () => {
  assert.deepEqual(BUILT_IN_MODES.map(m => m.id),
    ['polish', 'casual', 'polite', 'professional-firm', 'technical-review']);
});

test('every mode declares a job, a summary, guardrails and an instruction', () => {
  for (const mode of BUILT_IN_MODES) {
    assert.ok(mode.name && mode.summary && mode.description, `${mode.id} metadata`);
    assert.ok(mode.instruction.includes(`# Mode: ${mode.name}`), `${mode.id} instruction header`);
    assert.ok(mode.guardrails.length, `${mode.id} guardrails`);
    assert.ok(mode.guardrails.includes(GUARDRAILS.NEVER_AUTO_APPLY), `${mode.id} must never auto-apply`);
    assert.ok(mode.guardrails.includes(GUARDRAILS.PRESERVE_FACTS), `${mode.id} must preserve facts`);
  }
});

test('every rewrite mode encodes its must-not list in the instruction', () => {
  for (const mode of BUILT_IN_MODES.filter(m => m.operation === OPERATION.REWRITE)) {
    assert.match(mode.instruction, /Must not:/, `${mode.id} must not list`);
    const bullets = mode.instruction.split('\n').filter(l => l.startsWith('- must not'));
    assert.ok(bullets.length >= 4, `${mode.id} needs an explicit must-not list, found ${bullets.length}`);
  }
});

test('mode-specific prohibitions match the product plan', () => {
  assert.match(getBuiltInMode('polish').instruction, /must not make the writer sound more formal/);
  assert.match(getBuiltInMode('casual').instruction, /must not invent slang, deliberate typos/);
  assert.match(getBuiltInMode('polite').instruction, /must not over-apologise/);
  assert.match(getBuiltInMode('polite').instruction, /still says no/);
  assert.match(getBuiltInMode('professional-firm').instruction, /must not invent a deadline/);
  assert.match(getBuiltInMode('professional-firm').instruction, /Firm means unambiguous, not aggressive/);
});

test('Casual uses Egyptian Arabic and the other four use Modern Standard Arabic', () => {
  assert.equal(getBuiltInMode('casual').arabicRegister, LOCALES.AR_EG);
  for (const id of ['polish', 'polite', 'professional-firm', 'technical-review']) {
    assert.equal(getBuiltInMode(id).arabicRegister, LOCALES.AR, `${id} should be MSA`);
  }
});

test('built-in modes are frozen and identifiable', () => {
  assert.ok(isBuiltIn('polish'));
  assert.ok(!isBuiltIn('my-mode'));
  assert.throws(() => { BUILT_IN_MODES.push({}); });
});

test('a built-in can be duplicated into an editable custom mode', () => {
  const copy = duplicateMode('polish', { newId: 'polish-mine', name: 'My Polish' });
  assert.equal(copy.builtIn, false);
  assert.equal(copy.id, 'polish-mine');
  assert.equal(copy.instruction, getBuiltInMode('polish').instruction);
  assert.equal(getBuiltInMode('polish').name, 'Polish', 'the original is untouched');
});

test('duplicating an unknown mode fails', () => {
  assert.throws(() => duplicateMode('nope'), /Unknown mode/);
});

test('length controls never authorise adding content', () => {
  assert.match(lengthInstruction(LENGTH.SHORTER), /Do not cut facts, conditions, or commitments/);
  assert.match(lengthInstruction(LENGTH.LONGER), /Do not add new claims, examples, or reasons/);
  assert.match(lengthInstruction(LENGTH.SAME), /stay close to the original length/i);
});

test('the guardrail layer renders declared guardrails into the prompt', () => {
  const layer = guardrailLayer(getBuiltInMode('polish').guardrails);
  assert.match(layer, /## Guardrails for this mode/);
  assert.match(layer, /must appear unchanged/);
  assert.match(layer, /A refusal stays a refusal/);
});

// ---- guardrail enforcement ----------------------------------------------

test('dropping a fact blocks the result under preserveFacts', () => {
  const result = enforceGuardrails({
    guardrails: [GUARDRAILS.PRESERVE_FACTS],
    original: 'Send 12 units by 14 March 2026.',
    proposal: 'Send the units soon.'
  });
  assert.equal(result.blocked, true);
  assert.ok(result.violations.some(v => v.guardrail === GUARDRAILS.PRESERVE_FACTS && v.blocking));
});

test('a large length change warns but does not block under preserveLength', () => {
  const result = enforceGuardrails({
    guardrails: [GUARDRAILS.PRESERVE_LENGTH],
    original: 'Please confirm the delivery date for the pallets we discussed on Monday.',
    proposal: 'Confirm the date.'
  });
  const violation = result.violations.find(v => v.guardrail === GUARDRAILS.PRESERVE_LENGTH);
  assert.ok(violation);
  assert.equal(violation.blocking, false);
});

test('reversing a refusal into agreement is blocked', () => {
  const result = enforceGuardrails({
    guardrails: [GUARDRAILS.PRESERVE_POSITION],
    original: 'I cannot take on the extra scope this quarter.',
    proposal: 'I can take on the extra scope this quarter.'
  });
  assert.equal(result.blocked, true);
  assert.match(result.violations[0].message, /reads as agreement/);
});

test('reversing agreement into a refusal is blocked', () => {
  const flip = detectPositionFlip('I will send the report on Friday.', 'I cannot send the report on Friday.');
  assert.match(flip, /reads as a refusal/);
});

test('an unchanged position is not flagged', () => {
  assert.equal(detectPositionFlip('I cannot do this.', 'I am not able to do this.'), null);
  assert.equal(detectPositionFlip('Yes, Friday works.', 'Friday works for me.'), null);
});

test('a position flip is detected in Arabic', () => {
  const flip = detectPositionFlip('لا أستطيع إنهاء التقرير هذا الأسبوع.', 'سأقوم بإنهاء التقرير هذا الأسبوع.');
  assert.ok(flip);
});

test('web results in a no-web mode block the result', () => {
  const result = enforceGuardrails({
    guardrails: [GUARDRAILS.NO_WEB],
    original: 'x', proposal: 'y', usedWeb: true
  });
  assert.equal(result.blocked, true);
  assert.match(result.violations[0].message, /does not use the web/);
});

test('an uncited supported claim is downgraded rather than trusted', () => {
  const claims = [{ text: 'Latency fell by 40%.', status: 'supported', citationIds: [] }];
  const result = enforceGuardrails({
    guardrails: [GUARDRAILS.CITATION_REQUIRED],
    original: 'x', proposal: 'y',
    citations: [{ id: 'c1', url: 'https://example.test' }],
    claims
  });
  assert.equal(claims[0].status, 'needs_verification');
  assert.ok(result.violations.some(v => /no citation/.test(v.message)));
});

test('prohibited assurance language blocks regardless of guardrails', () => {
  const result = enforceGuardrails({
    guardrails: [], original: 'Please review.', proposal: 'Please review. This is undetectable.'
  });
  assert.equal(result.blocked, true);
  assert.ok(result.violations.some(v => v.guardrail === 'prohibitedAssurance'));
});

test('a faithful rewrite passes every guardrail', () => {
  const result = enforceGuardrails({
    guardrails: [GUARDRAILS.PRESERVE_FACTS, GUARDRAILS.PRESERVE_LENGTH, GUARDRAILS.PRESERVE_POSITION, GUARDRAILS.NO_WEB],
    original: 'We must leverage the robust process to deliver 12 units by 14 March 2026.',
    proposal: 'We must use the new process to deliver 12 units by 14 March 2026.'
  });
  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 1));
  assert.equal(result.blocked, false);
});
