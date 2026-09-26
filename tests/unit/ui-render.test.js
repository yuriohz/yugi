import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_MODES, getBuiltInMode } from '../../src/core/modes.js';
import {
  renderModeLauncher, renderComposer, renderRewriteBody, renderReviewBody,
  renderProofreadBody, popupCopy, applyRewriteAllowed, renderDiff
} from '../../src/ui/render.js';
import { VERDICTS } from '../../src/core/constants.js';

test('mode launcher lists every built-in mode and marks the selection', () => {
  const html = renderModeLauncher({ modes: BUILT_IN_MODES, selectedId: 'polish' });
  for (const mode of BUILT_IN_MODES) {
    assert.match(html, new RegExp(`data-mode="${mode.id}"`));
    assert.match(html, new RegExp(mode.name.replace(/&/g, '&amp;')));
  }
  assert.match(html, /wr-mode-on/);
  assert.match(html, /data-mode="polish"/);
});

test('composer shows length controls for Polish and a research toggle for Technical Review', () => {
  const polish = renderComposer({ mode: getBuiltInMode('polish'), length: 'same', canRun: true });
  assert.match(polish, /data-run/);
  assert.match(polish, /Rewrite · Polish/);
  assert.match(polish, /data-length="shorter"/);

  const review = renderComposer({ mode: getBuiltInMode('technical-review'), research: true, canRun: true });
  assert.match(review, /data-research/);
  assert.match(review, /Review with sources/);
  assert.doesNotMatch(review, /data-length=/);
});

test('a rewrite that invents a deadline cannot be applied until acknowledged', () => {
  const result = {
    proposal: 'I will send the contract by 14 March 2026.',
    autoApply: false,
    guardrails: { blocked: true, violations: [{ message: '14 March 2026 is not in your text.' }] },
    whatChanged: ['added a date']
  };
  const html = renderRewriteBody({ original: 'I will send the contract.', result, acknowledged: false });
  assert.match(html, /Apply is blocked/);
  assert.match(html, /data-apply-rewrite/);
  assert.match(html, /disabled/);
  assert.match(html, /data-ack/);
  assert.equal(applyRewriteAllowed(result, false), false);
  assert.equal(applyRewriteAllowed(result, true), true);

  const after = renderRewriteBody({ original: 'I will send the contract.', result, acknowledged: true });
  assert.doesNotMatch(after, /disabled/);
});

test('word-level diff never hides a changed number in an equal run', () => {
  const html = renderDiff([
    { type: 'equal', before: 'pay ', after: 'pay ' },
    { type: 'delete', before: '12', after: '' },
    { type: 'insert', before: '', after: '13' }
  ]);
  assert.match(html, /<del[^>]*>12<\/del>/);
  assert.match(html, /<ins[^>]*>13<\/ins>/);
});

test('proofread cards include accept actions and escape markup', () => {
  const html = renderProofreadBody({
    text: 'I has a apple',
    issues: [{ category: 'grammar', message: 'Subject-verb <agreement>', original: 'has', replacement: 'have' }]
  });
  assert.match(html, /data-apply="0"/);
  assert.match(html, /Subject-verb &lt;agreement&gt;/);
  assert.doesNotMatch(html, /Subject-verb <agreement>/);
});

test('review uses calibrated verdict labels and never a certainty claim', () => {
  const html = renderReviewBody({
    result: {
      verdict: VERDICTS.NEEDS_VERIFICATION,
      verdictReason: 'The claim is about the outside world.',
      findings: [{ severity: 'risk', title: 'Unsourced figure', detail: '450 is not checked.', quote: '450' }],
      applyBlocked: true,
      contradictions: [{ explanation: 'The cited source disagrees.' }]
    }
  });
  assert.match(html, /Needs verification/);
  assert.match(html, /A source contradicts this text/);
  assert.doesNotMatch(html, /you are right/i);
});

test('popup copy tells the truth about setup and shutdown', () => {
  assert.equal(popupCopy({ hasKey: false }).title, 'Finish your setup');
  assert.equal(popupCopy({ hasKey: true, shutdown: { global: true } }).title, 'WriteRight is off');
  assert.equal(popupCopy({ hasKey: true, shutdown: { website: true, reason: 'Off for https://example.com' } }).detail, 'Off for https://example.com');
  assert.match(popupCopy({ hasKey: true, shutdown: {} }).title, /Ready to rewrite/);
});
