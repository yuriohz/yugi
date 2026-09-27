import { getProvider } from '../core/providers.js';
/**
 * Pure HTML for the in-page widget and popup copy. Kept free of the DOM so the
 * five modes, the compare view, and the blocked-apply state can be asserted
 * without a browser.
 */
import { escapeHtml, escapeAttr } from '../core/escape.js';
import { VERDICT_LABELS, VERDICT_EXPLAINERS, SEVERITY } from '../core/constants.js';
import { OPERATION, LENGTH } from '../core/modes.js';
import { diffTokens } from '../core/diff.js';

export function publicModes(modes = []) {
  return modes.map(mode => ({
    id: mode.id,
    builtIn: Boolean(mode.builtIn),
    name: mode.name,
    summary: mode.summary || '',
    description: mode.description || '',
    colour: mode.colour || '#9C412B',
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

export function renderComposer({ provider = 'openrouter', mode, length = LENGTH.SAME, research = false, contextNote = '', contextControls = '', researchNote = '', researchState = null, canRun = true }) {
  if (!mode) return '';
  const isReview = mode.operation === OPERATION.REVIEW;
  const lengthControl = mode.controls?.length
    ? `<div class="wr-seg" role="group" aria-label="Length">` +
      lengthButton(LENGTH.SHORTER, length, 'Shorter') +
      lengthButton(LENGTH.SAME, length, 'Same length') +
      lengthButton(LENGTH.LONGER, length, 'Longer') +
      `</div>`
    : '';
  let researchControl = '';
  if (mode.controls?.research) {
    // The toggle is disabled up front when the selected model cannot search,
    // with the reason stated, rather than failing after the click.
    const gated = researchState ? researchState.allowed === false : false;
    researchControl = `<label class="wr-check"><input type="checkbox" data-research ${research && !gated ? 'checked' : ''}${gated ? ' disabled' : ''}><span>Search the web for this review</span></label>`;
    if (gated && researchState.reason) {
      researchControl += `<p class="wr-cap">${escapeHtml(researchState.reason)}</p>`;
    } else if (research && researchNote) {
      researchControl += `<p class="wr-research-note">${escapeHtml(researchNote)}</p>`;
    } else {
      researchControl += `<p class="wr-research-note">Research may increase ${escapeHtml(getProvider(provider).name)} cost.</p>`;
    }
  }
  const context = contextControls || (contextNote
    ? `<p class="wr-context">${escapeHtml(contextNote)}</p>`
    : '');
  const action = isReview ? (research ? 'Review with sources' : 'Review the reasoning') : `Rewrite · ${mode.name}`;
  return `<div class="wr-composer">` +
    `<p class="wr-composer-lead">${escapeHtml(mode.description || mode.summary || '')}</p>` +
    lengthControl + researchControl + context +
    `<button type="button" class="wr-primary" data-run ${canRun ? '' : 'disabled'}>${escapeHtml(action)}</button>` +
    `</div>`;
}

/**
 * The two nearby-context switches, shown together where the text is written.
 *
 * Review decision Q3: the global preference lives in settings and the per-site
 * consent lives here, and neither works alone. Showing both states side by
 * side — with the missing one actionable — keeps the conservative default
 * without making the feature undiscoverable or the states contradictory.
 */
export function renderContextControls({ globallyEnabled = false, consented = false, host = '', disclosure = '' } = {}) {
  const site = host || 'this site';
  let state;
  let action = '';
  if (globallyEnabled && consented) {
    state = `<span class="wr-ctx-on">On for ${escapeHtml(site)}</span>`;
  } else if (!globallyEnabled) {
    state = `<span class="wr-ctx-off">Off</span>`;
    action = `<button type="button" class="wr-ghost" data-enable-context-global>Switch on</button>`;
  } else {
    state = `<span class="wr-ctx-off">Not allowed on ${escapeHtml(site)}</span>`;
    action = `<button type="button" class="wr-ghost" data-allow-context>Allow on ${escapeHtml(site)}</button>`;
  }
  const line = disclosure ? `<p class="wr-context">${escapeHtml(disclosure)}</p>` : '';
  return `<div class="wr-ctx"><div class="wr-ctx-row"><span><strong>Nearby conversation</strong> · ${state}</span>${action}</div>${line}</div>`;
}

/** Short capability badges for a favourite model, from the cached catalogue. */
export function capabilityBadges(favourite = {}) {
  if (favourite.available === false) return [{ text: 'unavailable', tone: 'bad' }];
  if (favourite.supportsResearch == null && !favourite.capabilities) {
    return [{ text: 'capabilities unknown', tone: 'muted' }];
  }
  const out = [];
  out.push(favourite.supportsResearch
    ? { text: 'web research', tone: 'good' }
    : { text: 'no web research', tone: 'bad' });
  if (favourite.contextLength) {
    out.push({ text: `${formatK(favourite.contextLength)} context`, tone: 'muted' });
  }
  return out;
}

function formatK(n) {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

/**
 * Whether researched review can run on the selected model.
 *
 * Review decision Q4: unknown tool support stays refused — a silent tool
 * failure would produce uncited claims, the worst outcome in this product —
 * but the refusal happens here, in the widget, with instructions, instead of
 * after the user waits for a request that was never going to run.
 */
export function researchAvailability({ favourites = [], modelId = '', provider = 'openrouter', providerResearch } = {}) {
  if (providerResearch === false) return { allowed: false, known: true, reason: `Web research is not available on ${getProvider(provider).name}. Switch to OpenRouter for researched review.` };
  const match = favourites.find(f => f && typeof f === 'object' && f.id === modelId);
  if (!match) {
    return {
      allowed: false,
      known: false,
      reason: 'WordSaffron has not confirmed that this model can search the web. Refresh the model catalogue in settings, then try again.'
    };
  }
  if (match.available === false) {
    return {
      allowed: false,
      known: true,
      reason: 'This model is not in the current provider catalogue. Pick a favourite that is still listed.'
    };
  }
  if (match.supportsResearch === true) return { allowed: true, known: true, reason: '' };
  if (match.supportsResearch === false) {
    return {
      allowed: false,
      known: true,
      reason: 'This model cannot search the web. Pick a favourite with web research support to use researched review.'
    };
  }
  return {
    allowed: false,
    known: false,
    reason: 'WordSaffron has not confirmed that this model can search the web. Refresh the model catalogue in settings, then try again.'
  };
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
    return statusBlock('idle', 'Start writing', 'WordSaffron checks spelling and grammar after you pause, and rewrite modes wait until you pick one.');
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

  // Review decision Q1: the block stays hard, but the override is informed —
  // the banner names the exact violations rather than gesturing at them.
  const blocking = violations.filter(v => v.blocking);
  const banner = blocked
    ? `<div class="wr-blocked"><strong>Apply is blocked</strong><p>This proposal changed something checkable in your text. Read each item below. Tick the box only if you have read them and still want to replace your writing.</p><ul>` +
      blocking.slice(0, 5).map(v => `<li>${escapeHtml(v.message || v)}</li>`).join('') + `</ul>` +
      `<label class="wr-check"><input type="checkbox" data-ack><span>I have read each warning above</span></label></div>`
    : warnings.length
      ? `<div class="wr-warn"><strong>Check before you apply</strong><ul>` +
        warnings.slice(0, 8).map(w => `<li>${escapeHtml(w)}</li>`).join('') + `</ul></div>`
      : '';

  const changed = (result.whatChanged || []).filter(Boolean);
  const list = changed.length
    ? `<ul class="wr-changed">` + changed.map(item => `<li>${escapeHtml(item)}</li>`).join('') + `</ul>`
    : '';
  const grounded = result.grounded
    ? `<p class="wr-grounded">Drafted from ${result.groundingCounts?.supported ?? 0} supported claim${(result.groundingCounts?.supported ?? 0) === 1 ? '' : 's'}${result.groundingCounts?.excluded ? ` (${result.groundingCounts.excluded} unchecked or contradicted ${(result.groundingCounts?.excluded ?? 0) === 1 ? 'claim' : 'claims'} excluded)` : ''}.</p>`
    : '';

  return `<div class="wr-compare">` +
    banner +
    grounded +
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

export function renderReviewBody({ result, acked = [] }) {
  if (!result) return statusBlock('idle', 'No review yet', 'Technical Review checks the reasoning first. It does not rewrite.');
  const verdict = VERDICT_LABELS[result.verdict] || result.verdict || 'Needs verification';
  const explainer = VERDICT_EXPLAINERS[result.verdict] || '';
  const findings = result.findings || [];
  const claims = result.claims || [];
  const citations = result.citations || [];
  const contradictions = result.contradictions || [];
  const read = new Set(acked);
  const outstanding = contradictions.filter((item, index) => !read.has(index)).length;

  // A review produces no replacement text, so there is no apply to gate. The
  // previous single checkbox pretended otherwise. Contradictions are now a
  // per-source reading checklist: honest about what it is, and each source is
  // opened from the citation list below.
  const banner = contradictions.length && outstanding > 0
    ? `<div class="wr-blocked"><strong>${outstanding} of ${contradictions.length} contradicting source${contradictions.length === 1 ? '' : 's'} unread</strong><p>A source disagrees with this text. Read each one below, then tick it. The review itself changes nothing.</p></div>`
    : contradictions.length
      ? `<div class="wr-warn"><strong>Contradictions reviewed</strong><p>You have read each contradicting source. Decide what to change before drafting anything from this review.</p></div>`
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
    ? `<ul class="wr-contra">` + contradictions.map((item, index) =>
      `<li><label class="wr-check"><input type="checkbox" data-contra="${index}"${read.has(index) ? ' checked' : ''}><span>${escapeHtml(item.explanation || '')}</span></label></li>`
    ).join('') + `</ul>`
    : '';

  const supported = claims.filter(c => c.status === 'supported').length;
  const draft = supported
    ? `<button type="button" class="wr-primary" data-draft-grounded>Draft response from ${supported} supported claim${supported === 1 ? '' : 's'}</button>`
    : claims.length
      ? `<p class="wr-context">No claim was supported, so there is nothing to draft from yet.</p>`
      : '';

  return `<div class="wr-review">` +
    banner +
    `<div class="wr-verdict"><strong>${escapeHtml(verdict)}</strong>${explainer ? `<p class="wr-explainer">${escapeHtml(explainer)}</p>` : ''}<p>${escapeHtml(result.verdictReason || '')}</p></div>` +
    (result.recommendedDirection ? `<p class="wr-direction">${escapeHtml(result.recommendedDirection)}</p>` : '') +
    findingCards + claimList + contra + sources +
    `<div class="wr-actions"><button type="button" class="wr-ghost" data-back>Back</button>` +
    `<button type="button" class="wr-ghost" data-retry>Run again</button>${draft}</div></div>`;
}

/**
 * Read-only views of how the text lands. Tone and reader reactions were
 * engine-complete with no way to reach them; this is their surface. Nothing
 * here edits, and the hedged contract is shown, not implied.
 */
export function renderInsightsHome({ canRun = true, audience = '' } = {}) {
  return `<div class="wr-insights">` +
    `<p class="wr-composer-lead">Read-only views of how your text lands. Nothing here changes your writing.</p>` +
    `<label class="wr-audience">Audience (optional)<input type="text" data-audience value="${escapeAttr(audience)}" placeholder="Clients, colleagues…" maxlength="120"></label>` +
    `<div class="wr-actions"><button type="button" class="wr-ghost" data-insight="tone"${canRun ? '' : ' disabled'}>Check tone</button>` +
    `<button type="button" class="wr-ghost" data-insight="reader"${canRun ? '' : ' disabled'}>Preview reader reactions</button></div></div>`;
}

export function renderToneBody({ result } = {}) {
  if (!result) return statusBlock('idle', 'No tone check yet', 'Check tone to see how the wording reads, with quoted evidence.');
  const dimensions = (result.dimensions || []).map(d => {
    const strength = Math.max(0, Math.min(1, Number(d.strength) || 0));
    const evidence = (d.evidence || []).map(q => `<blockquote class="wr-bidi">“${escapeHtml(q)}”</blockquote>`).join('');
    return `<article class="wr-tone"><small>${escapeHtml(d.name || 'tone')}</small>` +
      `<div class="wr-meter" role="img" aria-label="Strength ${Math.round(strength * 100)} percent"><i style="width:${Math.round(strength * 100)}%"></i></div>` +
      evidence + `</article>`;
  }).join('');
  const overall = result.overall ? `<p class="wr-direction">${escapeHtml(result.overall)}</p>` : '';
  const mismatch = result.mismatch ? `<div class="wr-warn"><strong>Possible mismatch</strong><p>${escapeHtml(result.mismatch)}</p></div>` : '';
  const note = result.note ? `<p class="wr-context">${escapeHtml(result.note)}</p>` : '';
  return `<div class="wr-insight-result">${overall}${dimensions}${mismatch}${note}` +
    `<div class="wr-actions"><button type="button" class="wr-ghost" data-back>Back</button>` +
    `<button type="button" class="wr-ghost" data-insight="tone">Run again</button></div></div>`;
}

export function renderReaderBody({ result } = {}) {
  if (!result) return statusBlock('idle', 'No reactions yet', 'Preview how the wording could be read by someone else.');
  const reactions = (result.reactions || []).map(r =>
    `<article class="wr-reaction"><small>${escapeHtml(r.audience || 'reader')} · ${escapeHtml(r.likelihood || 'possible')}</small>` +
    `<p>${escapeHtml(r.possibleInterpretation || '')}</p>` +
    (r.trigger ? `<blockquote class="wr-bidi">“${escapeHtml(r.trigger)}”</blockquote>` : '') + `</article>`
  ).join('');
  const caveat = result.caveat ? `<p class="wr-caveat">${escapeHtml(result.caveat)}</p>` : '';
  return `<div class="wr-insight-result">${reactions}${caveat}` +
    `<div class="wr-actions"><button type="button" class="wr-ghost" data-back>Back</button>` +
    `<button type="button" class="wr-ghost" data-insight="reader">Run again</button></div></div>`;
}

export function statusBlock(kind, title, message, actionLabel, action) {
  const extra = actionLabel
    ? `<button type="button" data-${escapeAttr(action || 'settings')}>${escapeHtml(actionLabel)}</button>`
    : '';
  return `<div class="wr-state wr-${escapeAttr(kind)}"><i>${kind === 'error' ? '!' : kind === 'ok' ? '✓' : '✎'}</i>` +
    `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>${extra}</div>`;
}

export function popupCopy({ provider = 'openrouter', hasKey, shutdown = {} }) {
  if (!hasKey) {
    return { title: 'Finish your setup', detail: `Add a ${getProvider(provider).name} key to get started.`, icon: '!', paused: false };
  }
  if (shutdown.global) {
    return { title: 'WordSaffron is off', detail: 'Switched off everywhere. Nothing leaves this browser.', icon: 'Ⅱ', paused: true };
  }
  if (shutdown.website) {
    return { title: 'Off on this site', detail: shutdown.reason || 'WordSaffron is switched off for this website.', icon: 'Ⅱ', paused: true };
  }
  if (shutdown.tab) {
    return { title: 'Off in this tab', detail: 'Other tabs keep working.', icon: 'Ⅱ', paused: true };
  }
  return { title: 'Ready to rewrite', detail: 'Pick a mode from the WordSaffron button, or let proofreading run as you type.', icon: '✓', paused: false };
}

export function applyRewriteAllowed(result, acknowledged = false) {
  if (!result) return false;
  if (result.autoApply === true) return false;
  if (result.guardrails?.blocked && !acknowledged) return false;
  if (result.applyBlocked && !acknowledged) return false;
  return Boolean(result.proposal);
}
