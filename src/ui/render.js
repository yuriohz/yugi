/**
 * Pure HTML for the in-page widget and popup copy. Kept free of the DOM so the
 * five modes, the compare view, and the blocked-apply state can be asserted
 * without a browser.
 */
import { escapeHtml, escapeAttr } from '../core/escape.js';
import { VERDICT_LABELS, SEVERITY } from '../core/constants.js';
import { OPERATION, LENGTH } from '../core/modes.js';
import { diffTokens } from '../core/diff.js';

export function publicModes(modes = []) {
  return modes.map(mode => ({
    id: mode.id,
    builtIn: Boolean(mode.builtIn),
    name: mode.name,
    summary: mode.summary || '',
    description: mode.description || '',
    colour: mode.colour || '#12AD89',
    operation: mode.operation || OPERATION.REWRITE,
    researchPolicy: mode.researchPolicy || 'off',
    controls: mode.controls || {},
    icon: mode.icon || 'sparkle'
  }));
}

export function renderModeLauncher({ modes, selectedId }) {
  return `<div class="wr-modes">` + publicModes(modes).map(mode => {
    const on = mode.id === selectedId ? ' wr-mode-on' : '';
    return `<button type="button" class="wr-mode${on}" data-mode="${escapeAttr(mode.id)}" style="--wr-mode:${escapeAttr(mode.colour)}">` +
      `<strong>${escapeHtml(mode.name)}</strong>` +
      `<small>${escapeHtml(mode.summary)}</small>` +
      `</button>`;
  }).join('') + `</div>`;
}

export function renderComposer({ mode, length = LENGTH.SAME, research = false, contextNote = '', canRun = true }) {
  if (!mode) return '';
  const isReview = mode.operation === OPERATION.REVIEW;
  const lengthControl = mode.controls?.length
    ? `<div class="wr-seg" role="group" aria-label="Length">` +
      lengthButton(LENGTH.SHORTER, length, 'Shorter') +
      lengthButton(LENGTH.SAME, length, 'Same length') +
      lengthButton(LENGTH.LONGER, length, 'Longer') +
      `</div>`
    : '';
  const researchControl = mode.controls?.research
    ? `<label class="wr-check"><input type="checkbox" data-research ${research ? 'checked' : ''}><span>Search the web for this review</span></label>`
    : '';
  const context = contextNote
    ? `<p class="wr-context">${escapeHtml(contextNote)}</p>`
    : '';
  const action = isReview ? (research ? 'Review with sources' : 'Review the reasoning') : `Rewrite · ${mode.name}`;
  return `<div class="wr-composer">` +
    `<p class="wr-composer-lead">${escapeHtml(mode.description || mode.summary || '')}</p>` +
    lengthControl + researchControl + context +
    `<button type="button" class="wr-primary" data-run ${canRun ? '' : 'disabled'}>${escapeHtml(action)}</button>` +
    `</div>`;
}

function lengthButton(value, current, label) {
  const on = value === current ? ' wr-seg-on' : '';
  return `<button type="button" class="wr-seg-btn${on}" data-length="${escapeAttr(value)}">${escapeHtml(label)}</button>`;
}

export function renderProofreadBody({ error, text, issues = [], canUndo = false }) {
  if (error) {
    return statusBlock('error', 'We couldn’t check your writing', error, 'Open settings', 'settings');
  }
  if (!String(text || '').trim()) {
    return statusBlock('idle', 'Start writing', 'WriteRight checks spelling and grammar after you pause, and rewrite modes wait until you pick one.');
  }
  if (!issues.length) {
    return statusBlock('ok', 'No issues found', 'Nothing to correct in this text. Review it yourself before sending.');
  }
  const undo = canUndo ? '<button type="button" data-undo>Undo</button>' : '';
  return `<div class="wr-summary"><strong>Review your suggestions</strong>` +
    `<span><button type="button" data-apply-all>Accept all</button>${undo}</span></div>` +
    issues.map((issue, index) => proofreadCard(issue, index)).join('');
}

function proofreadCard(issue, index) {
  return `<article><small>${escapeHtml(issue.category || 'grammar')}</small>` +
    `<p>${escapeHtml(issue.message || 'Suggested correction')}</p>` +
    `<div class="wr-replacement"><del class="wr-bidi">${escapeHtml(issue.original || '')}</del><span>→</span>` +
    `<ins class="wr-bidi">${escapeHtml(issue.replacement || '')}</ins></div>` +
    `<button type="button" class="wr-accept" data-apply="${index}">Accept</button></article>`;
}

export function renderRewriteBody({ original, result, acknowledged = false }) {
  if (!result) return statusBlock('idle', 'No rewrite yet', 'Pick a mode and run it. Nothing is applied until you accept.');
  const blocked = Boolean(result.guardrails?.blocked) && !acknowledged;
  const proposal = result.proposal || '';
  const ops = diffTokens(original || '', proposal);
  const violations = result.guardrails?.violations || [];
  const missing = result.fidelity?.missing || [];
  const added = result.fidelity?.added || [];
  const warnings = [
    ...(result.warnings || []).map(w => w.message || w),
    ...violations.map(v => v.message || v),
    ...missing.map(f => `Dropped ${f.kind}: ${f.label || f.raw}`),
    ...added.map(f => `Added ${f.kind}: ${f.label || f.raw}`)
  ].filter(Boolean);

  const banner = blocked
    ? `<div class="wr-blocked"><strong>Apply is blocked</strong><p>This proposal changed a fact, a date, or a position that was not in your text. Tick the box only if you have read the warning and still want to replace your writing.</p>` +
      `<label class="wr-check"><input type="checkbox" data-ack><span>I have read the warning</span></label></div>`
    : warnings.length
      ? `<div class="wr-warn"><strong>Check before you apply</strong><ul>` +
        warnings.slice(0, 8).map(w => `<li>${escapeHtml(w)}</li>`).join('') + `</ul></div>`
      : '';

  const changed = (result.whatChanged || []).filter(Boolean);
  const list = changed.length
    ? `<ul class="wr-changed">` + changed.map(item => `<li>${escapeHtml(item)}</li>`).join('') + `</ul>`
    : '';

  return `<div class="wr-compare">` +
    banner +
    `<div class="wr-diff wr-bidi" dir="auto">${renderDiff(ops)}</div>` +
    list +
    `<div class="wr-actions">` +
    `<button type="button" class="wr-ghost" data-back>Back</button>` +
    `<button type="button" class="wr-ghost" data-copy>Copy</button>` +
    `<button type="button" class="wr-ghost" data-retry>Retry</button>` +
    `<button type="button" class="wr-primary" data-apply-rewrite ${blocked ? 'disabled' : ''}>Replace original</button>` +
    `</div></div>`;
}

export function renderDiff(ops = []) {
  return ops.map(op => {
    if (op.type === 'equal') return `<span class="wr-eq">${escapeHtml(op.after)}</span>`;
    if (op.type === 'insert') return `<ins class="wr-ins">${escapeHtml(op.after)}</ins>`;
    if (op.type === 'delete') return `<del class="wr-del">${escapeHtml(op.before)}</del>`;
    return `<del class="wr-del">${escapeHtml(op.before)}</del><ins class="wr-ins">${escapeHtml(op.after)}</ins>`;
  }).join('');
}

export function renderReviewBody({ result, acknowledged = false }) {
  if (!result) return statusBlock('idle', 'No review yet', 'Technical Review checks the reasoning first. It does not rewrite.');
  const blocked = Boolean(result.applyBlocked) && !acknowledged;
  const verdict = VERDICT_LABELS[result.verdict] || result.verdict || 'Needs verification';
  const findings = result.findings || [];
  const claims = result.claims || [];
  const citations = result.citations || [];
  const contradictions = result.contradictions || [];

  const banner = blocked
    ? `<div class="wr-blocked"><strong>A source contradicts this text</strong><p>Apply stays blocked until you acknowledge each contradiction.</p>` +
      `<label class="wr-check"><input type="checkbox" data-ack><span>I have read the contradicting source</span></label></div>`
    : '';

  const findingCards = findings.map(finding => {
    const sev = finding.severity || SEVERITY.IMPROVEMENT;
    return `<article class="wr-finding wr-${escapeAttr(sev)}"><small>${escapeHtml(sev)}</small>` +
      `<p><strong>${escapeHtml(finding.title || '')}</strong> ${escapeHtml(finding.detail || '')}</p>` +
      (finding.quote ? `<blockquote class="wr-bidi">${escapeHtml(finding.quote)}</blockquote>` : '') +
      `</article>`;
  }).join('');

  const claimList = claims.length
    ? `<ul class="wr-claims">` + claims.map(claim =>
      `<li><span class="wr-pill">${escapeHtml(VERDICT_LABELS[claim.status] || claim.status)}</span> ${escapeHtml(claim.text || '')}</li>`
    ).join('') + `</ul>`
    : '';

  const sources = citations.length
    ? `<ul class="wr-cites">` + citations.map(cite =>
      `<li><a href="${escapeAttr(cite.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(cite.title || cite.url)}</a>` +
      ` <em>${escapeHtml(cite.relationship || '')}</em></li>`
    ).join('') + `</ul>`
    : '';

  const contra = contradictions.length
    ? `<ul class="wr-contra">` + contradictions.map(item => `<li>${escapeHtml(item.explanation || '')}</li>`).join('') + `</ul>`
    : '';

  return `<div class="wr-review">` +
    banner +
    `<div class="wr-verdict"><strong>${escapeHtml(verdict)}</strong><p>${escapeHtml(result.verdictReason || '')}</p></div>` +
    (result.recommendedDirection ? `<p class="wr-direction">${escapeHtml(result.recommendedDirection)}</p>` : '') +
    findingCards + claimList + contra + sources +
    `<div class="wr-actions"><button type="button" class="wr-ghost" data-back>Back</button>` +
    `<button type="button" class="wr-ghost" data-retry>Run again</button></div></div>`;
}

export function statusBlock(kind, title, message, actionLabel, action) {
  const extra = actionLabel
    ? `<button type="button" data-${escapeAttr(action || 'settings')}>${escapeHtml(actionLabel)}</button>`
    : '';
  return `<div class="wr-state wr-${escapeAttr(kind)}"><i>${kind === 'error' ? '!' : kind === 'ok' ? '✓' : '✎'}</i>` +
    `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>${extra}</div>`;
}

export function popupCopy({ hasKey, shutdown = {} }) {
  if (!hasKey) {
    return { title: 'Finish your setup', detail: 'Add an OpenRouter key to get started.', icon: '!', paused: false };
  }
  if (shutdown.global) {
    return { title: 'WriteRight is off', detail: 'Switched off everywhere. Nothing leaves this browser.', icon: 'Ⅱ', paused: true };
  }
  if (shutdown.website) {
    return { title: 'Off on this site', detail: shutdown.reason || 'WriteRight is switched off for this website.', icon: 'Ⅱ', paused: true };
  }
  if (shutdown.tab) {
    return { title: 'Off in this tab', detail: 'Other tabs keep working.', icon: 'Ⅱ', paused: true };
  }
  return { title: 'Ready to rewrite', detail: 'Pick a mode from the green W, or let proofreading run as you type.', icon: '✓', paused: false };
}

export function applyRewriteAllowed(result, acknowledged = false) {
  if (!result) return false;
  if (result.autoApply === true) return false;
  if (result.guardrails?.blocked && !acknowledged) return false;
  if (result.applyBlocked && !acknowledged) return false;
  return Boolean(result.proposal);
}
