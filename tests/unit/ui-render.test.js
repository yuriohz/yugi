import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_MODES, getBuiltInMode } from '../../src/core/modes.js';
import {
  renderModeLauncher, renderComposer, renderRewriteBody, renderReviewBody,
  renderProofreadBody, renderInsightsHome, renderToneBody, renderReaderBody,
  renderContextControls, researchAvailability, capabilityBadges,
  popupCopy, applyRewriteAllowed, renderDiff
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
  assert.match(html, /A factual claim about the outside world/);
  assert.match(html, /1 of 1 contradicting source unread/);
  assert.match(html, /data-contra="0"/);
  assert.doesNotMatch(html, /you are right/i);
});

test('contradictions are a per-source checklist, not a single gate', () => {
  const result = {
    verdict: VERDICTS.CONFLICTS,
    verdictReason: 'Two sources disagree.',
    contradictions: [{ explanation: 'Source A disagrees.' }, { explanation: 'Source B disagrees.' }]
  };
  const partial = renderReviewBody({ result, acked: [0] });
  assert.match(partial, /1 of 2 contradicting sources unread/);
  assert.match(partial, /data-contra="0" checked/);
  assert.doesNotMatch(partial, /data-contra="1" checked/);
  const done = renderReviewBody({ result, acked: [0, 1] });
  assert.match(done, /Contradictions reviewed/);
  assert.doesNotMatch(done, /unread/);
});

test('a review with supported claims offers a grounded draft', () => {
  const html = renderReviewBody({
    result: {
      verdict: VERDICTS.PARTIALLY_SUPPORTED,
      verdictReason: 'One claim held.',
      claims: [
        { text: 'The deadline is 14 March.', status: 'supported' },
        { text: 'Everyone agreed.', status: 'needs_verification' }
      ]
    }
  });
  assert.match(html, /data-draft-grounded/);
  assert.match(html, /Draft response from 1 supported claim/);
  const none = renderReviewBody({
    result: { verdict: VERDICTS.NEEDS_VERIFICATION, claims: [{ text: 'Maybe.', status: 'needs_verification' }] }
  });
  assert.doesNotMatch(none, /data-draft-grounded/);
  assert.match(none, /nothing to draft from yet/);
});

test('a blocked rewrite names its violations, so the override is informed', () => {
  const html = renderRewriteBody({
    original: 'I will send the contract.',
    acknowledged: false,
    result: {
      proposal: 'I will send the contract by 14 March 2026.',
      autoApply: false,
      guardrails: {
        blocked: true,
        violations: [
          { message: 'The rewrite introduces a date that was not in your text: “14 March 2026”.', blocking: true },
          { message: 'Slop count did not increase.', blocking: false }
        ]
      }
    }
  });
  assert.match(html, /Apply is blocked/);
  assert.match(html, /14 March 2026/);
  assert.match(html, /I have read each warning above/);
});

test('a grounded rewrite says which claims it was drafted from', () => {
  const html = renderRewriteBody({
    original: 'The deadline is soon.',
    acknowledged: true,
    result: {
      proposal: 'The deadline is 14 March.',
      autoApply: false,
      grounded: true,
      groundingCounts: { supported: 2, excluded: 1 },
      guardrails: { blocked: false, violations: [] }
    }
  });
  assert.match(html, /Drafted from 2 supported claims/);
  assert.match(html, /1 unchecked or contradicted claim excluded/);
});

test('context controls show both switches and offer the missing one', () => {
  const off = renderContextControls({ globallyEnabled: false, consented: false, host: 'web.whatsapp.com' });
  assert.match(off, /Nearby conversation/);
  assert.match(off, /Off/);
  assert.match(off, /data-enable-context-global/);

  const needsSite = renderContextControls({ globallyEnabled: true, consented: false, host: 'web.whatsapp.com' });
  assert.match(needsSite, /Not allowed on web\.whatsapp\.com/);
  assert.match(needsSite, /data-allow-context/);

  const on = renderContextControls({ globallyEnabled: true, consented: true, host: 'web.whatsapp.com', disclosure: '2 messages will be sent.' });
  assert.match(on, /On for web\.whatsapp\.com/);
  assert.match(on, /2 messages will be sent/);
  assert.doesNotMatch(on, /data-allow-context/);
});

test('research availability refuses unknown models and explains itself', () => {
  const unknown = researchAvailability({ favourites: [], modelId: 'x/y' });
  assert.equal(unknown.allowed, false);
  assert.match(unknown.reason, /Refresh the model catalogue/);

  const noTools = researchAvailability({
    favourites: [{ id: 'x/y', available: true, supportsResearch: false }],
    modelId: 'x/y'
  });
  assert.equal(noTools.allowed, false);
  assert.match(noTools.reason, /cannot search the web/);

  const ok = researchAvailability({
    favourites: [{ id: 'x/y', available: true, supportsResearch: true }],
    modelId: 'x/y'
  });
  assert.equal(ok.allowed, true);
});

test('capability badges never claim what the cache does not know', () => {
  assert.deepEqual(capabilityBadges({ available: false }), [{ text: 'unavailable', tone: 'bad' }]);
  assert.deepEqual(capabilityBadges({ id: 'x/y' }), [{ text: 'capabilities unknown', tone: 'muted' }]);
  const badges = capabilityBadges({ id: 'x/y', available: true, supportsResearch: true, contextLength: 128000 });
  assert.ok(badges.some(b => b.text === 'web research'));
  assert.ok(badges.some(b => b.text === '128k context'));
});

test('the composer gates research and discloses its cost', () => {
  const gated = renderComposer({
    mode: getBuiltInMode('technical-review'),
    researchState: { allowed: false, known: false, reason: 'Refresh the model catalogue in settings.' }
  });
  assert.match(gated, /data-research[^>]*disabled/);
  assert.match(gated, /Refresh the model catalogue/);

  const disclosed = renderComposer({
    mode: getBuiltInMode('technical-review'),
    research: true,
    researchNote: 'Researched review sends your text and runs up to 5 web searches. Web search is charged by OpenRouter.',
    researchState: { allowed: true, known: true, reason: '' }
  });
  assert.match(disclosed, /charged by OpenRouter/);
});

test('insights explain tone with quoted evidence and hedge reader reactions', () => {
  const home = renderInsightsHome({ canRun: true });
  assert.match(home, /data-insight="tone"/);
  assert.match(home, /data-insight="reader"/);
  assert.match(home, /Nothing here changes your writing/);

  const tone = renderToneBody({
    result: {
      dimensions: [{ name: 'directness', strength: 0.8, evidence: ['Send it by Friday.'] }],
      overall: 'Reads direct.',
      mismatch: '',
      note: ''
    }
  });
  assert.match(tone, /directness/);
  assert.match(tone, /Send it by Friday/);
  assert.match(tone, /width:80%/);

  const reader = renderReaderBody({
    result: {
      reactions: [{ audience: 'clients', possibleInterpretation: 'Could read as curt.', trigger: 'Send it.', likelihood: 'possible' }],
      caveat: 'These are possible readings of the wording.'
    }
  });
  assert.match(reader, /Could read as curt/);
  assert.match(reader, /possible readings/);
  assert.doesNotMatch(reader, /will think/);
});

test('popup copy tells the truth about setup and shutdown', () => {
  assert.equal(popupCopy({ hasKey: false }).title, 'Finish your setup');
  assert.equal(popupCopy({ hasKey: true, shutdown: { global: true } }).title, 'WordSaffron is off');
  assert.equal(popupCopy({ hasKey: true, shutdown: { website: true, reason: 'Off for https://example.com' } }).detail, 'Off for https://example.com');
  assert.match(popupCopy({ hasKey: true, shutdown: {} }).title, /Ready to rewrite/);
});
