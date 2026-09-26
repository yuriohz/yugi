/**
 * WriteRight content script entry point.
 *
 * Owns no credentials and makes no network calls. Everything that touches the
 * network goes through the service worker, which enforces the shutdown gate.
 */
import { MESSAGES, TASKS, LOCALES } from '../core/constants.js';
import { resolveDirection } from '../core/bidi.js';
import { withFingerprints, revalidate, applyReplacements } from '../core/ranges.js';
import { makeUndoEntry, UndoStack } from '../core/diff.js';
import { OPERATION, LENGTH, getBuiltInMode } from '../core/modes.js';
import { filterIssues } from '../core/dictionary.js';
import { captureContext, disclosureLine, normaliseHost } from '../core/context-consent.js';
import { drawHighlights, clearHighlights } from './highlight.js';
import { ask } from '../ui/messaging.js';
import {
  renderModeLauncher, renderComposer, renderProofreadBody, renderRewriteBody,
  renderReviewBody, statusBlock, applyRewriteAllowed
} from '../ui/render.js';

if (!window.__writeRightLoaded) {
  window.__writeRightLoaded = true;
  start();
}

const EDITABLE_SELECTOR = [
  'textarea',
  'input:not([type])',
  'input[type="text"]',
  'input[type="search"]',
  'input[type="email"]',
  'input[type="url"]',
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]'
].join(', ');

function start() {
  const state = {
    active: null,
    issues: [],
    checkedText: '',
    requestSeq: 0,
    timer: null,
    undo: new UndoStack(20),
    tab: 'rewrite',
    view: 'home',
    snapshot: null,
    selectedModeId: 'polish',
    length: LENGTH.SAME,
    research: false,
    includeContext: false,
    lastRewrite: null,
    lastReview: null,
    error: '',
    acknowledged: false,
    running: false
  };

  const root = document.createElement('div');
  root.id = 'wr-root';
  root.setAttribute('data-wr-ignore', '');
  root.innerHTML = shell();
  document.documentElement.appendChild(root);

  const el = {
    badge: root.querySelector('.wr-badge'),
    count: root.querySelector('.wr-badge b'),
    panel: root.querySelector('.wr-panel'),
    body: root.querySelector('.wr-body'),
    tabCount: root.querySelector('[data-tab="suggestions"] em'),
    subtitle: root.querySelector('.wr-brand-copy small'),
    profile: root.querySelector('[data-profile]'),
    model: root.querySelector('[data-model]')
  };

  const readText = node => (node.matches('input, textarea') ? node.value : node.innerText || '');

  function applyDirection(text) {
    const { direction } = resolveDirection(text);
    root.setAttribute('dir', direction);
    el.panel.setAttribute('dir', direction);
    if (direction === 'rtl') root.setAttribute('lang', LOCALES.AR);
    else root.removeAttribute('lang');
    return direction;
  }

  function writeText(node, value) {
    node.focus();
    if (node.matches('input, textarea')) {
      const proto = node.matches('textarea') ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value);
    } else {
      node.textContent = value;
    }
    node.dispatchEvent(new InputEvent('input', {
      bubbles: true, inputType: 'insertReplacementText', data: value
    }));
  }

  function reposition() {
    if (!state.active || !state.active.isConnected) return dismiss();
    const rect = state.active.getBoundingClientRect();
    el.badge.style.left = `${Math.max(8, Math.min(window.innerWidth - 38, rect.right - 34))}px`;
    el.badge.style.top = `${Math.max(8, Math.min(window.innerHeight - 38, rect.bottom - 34))}px`;
  }

  function dismiss() {
    el.badge.hidden = true;
    el.panel.hidden = true;
    clearHighlights();
    state.active = null;
  }

  async function refreshSnapshot() {
    try {
      state.snapshot = await ask(MESSAGES.GET_STATE, { origin: location.origin });
    } catch {
      state.snapshot = state.snapshot || { hasKey: false, shutdown: { allowed: false, reason: 'WriteRight is not reachable.' }, modes: [], profiles: [], favourites: [], dictionary: [], consents: {} };
    }
    fillSelects();
  }

  function fillSelects() {
    const snap = state.snapshot || {};
    const profiles = snap.profiles || [];
    const favourites = snap.favourites || [];
    const settings = snap.settings || {};
    fillSelect(el.profile, profiles.map(p => ({ value: p.id, label: p.name, selected: p.id === settings.activeProfileId })), 'Default');
    const models = favourites.length ? favourites : [{ id: settings.model || '', label: settings.model || 'Default model' }];
    fillSelect(el.model, models.map(m => {
      const id = m.id || m;
      return { value: id, label: m.label || m.displayName || id, selected: id === settings.model };
    }), 'Default model');
  }

  function fillSelect(select, items, fallback) {
    select.replaceChildren();
    if (!items.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = fallback;
      select.appendChild(option);
      return;
    }
    for (const item of items) {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      option.selected = Boolean(item.selected);
      select.appendChild(option);
    }
  }

  function selectedMode() {
    const modes = state.snapshot?.modes || [];
    return modes.find(m => m.id === state.selectedModeId) || getBuiltInMode(state.selectedModeId) || modes[0] || null;
  }

  function schedule(node) {
    state.active = node;
    el.badge.hidden = false;
    reposition();
    clearTimeout(state.timer);
    const text = readText(node);
    root.classList.add('wr-loading');
    el.count.hidden = true;
    if (text.trim().length < 3) {
      state.issues = [];
      state.checkedText = text;
      root.classList.remove('wr-loading');
      paint();
      return;
    }
    state.timer = setTimeout(() => check(text), 700);
  }

  async function check(text) {
    const seq = ++state.requestSeq;
    state.checkedText = text;
    if (state.snapshot && state.snapshot.shutdown && state.snapshot.shutdown.allowed === false) {
      state.issues = [];
      root.classList.remove('wr-loading');
      paint();
      return;
    }
    if (state.snapshot && state.snapshot.hasKey === false) {
      state.issues = [];
      root.classList.remove('wr-loading');
      paint();
      return;
    }
    try {
      const response = await ask(MESSAGES.RUN_TASK, {
        origin: location.origin,
        payload: {
          task: TASKS.PROOFREAD,
          requestId: `wr-${seq}`,
          text,
          origin: location.origin,
          profileId: el.profile.value || undefined,
          model: el.model.value || undefined
        }
      });
      if (seq !== state.requestSeq || !state.active || readText(state.active) !== text) return;
      const raw = response?.result?.issues || [];
      const filtered = filterIssues(raw, state.snapshot?.dictionary || [], { origin: location.origin, profileId: el.profile.value });
      state.issues = withFingerprints(filtered, text);
      paint();
    } catch (error) {
      if (seq !== state.requestSeq) return;
      state.issues = [];
      if (state.tab === 'suggestions') {
        state.error = error.message;
        state.view = 'error';
      }
      paint();
    } finally {
      if (seq === state.requestSeq) root.classList.remove('wr-loading');
    }
  }

  function contextNote() {
    const snap = state.snapshot || {};
    const host = normaliseHost(location.host);
    const globally = snap.settings?.context?.nearbyEnabled === true;
    const consented = Boolean(snap.consents?.[host]);
    if (!globally) return 'Nearby conversation stays off until you switch it on in settings.';
    if (!consented) return 'Allow conversation context for this site in the panel footer if you want it included.';
    const capture = captureContext(document, {
      host: location.host,
      settings: snap.settings,
      consented: true
    });
    return disclosureLine(capture, location.host);
  }

  function paint() {
    applyDirection(state.checkedText || readText(state.active || document.body) || '');
    el.count.textContent = String(state.issues.length);
    el.count.hidden = state.issues.length === 0;
    el.tabCount.textContent = String(state.issues.length);
    el.tabCount.hidden = state.issues.length === 0;
    el.subtitle.textContent = state.running ? 'Working…' : 'Your writing assistant';

    root.querySelectorAll('.wr-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === state.tab);
    });

    if (state.active && state.tab === 'suggestions' && !state.error) {
      drawHighlights(state.active, state.issues, state.checkedText);
    } else {
      clearHighlights();
    }
    state.active?.classList.toggle('wr-has-issues', state.issues.length > 0);

    el.body.innerHTML = bodyHtml();
  }

  function bodyHtml() {
    const snap = state.snapshot || {};
    if (snap.hasKey === false) {
      return statusBlock('error', 'Finish your setup', 'Add an OpenRouter API key in settings. WriteRight has no account of its own.', 'Open settings', 'settings');
    }
    if (snap.shutdown && snap.shutdown.allowed === false) {
      return statusBlock('idle', 'WriteRight is paused', snap.shutdown.reason || 'Nothing leaves this browser while WriteRight is off.', 'Resume', 'resume');
    }
    if (state.running) {
      return statusBlock('idle', 'Working', 'The model is rewriting or reviewing. You can cancel from the badge.');
    }
    if (state.tab === 'suggestions') {
      return renderProofreadBody({
        error: state.view === 'error' ? state.error : '',
        text: state.checkedText,
        issues: state.issues,
        canUndo: state.undo.size > 0
      });
    }
    if (state.view === 'rewrite' && state.lastRewrite) {
      return renderRewriteBody({ original: state.checkedText, result: state.lastRewrite, acknowledged: state.acknowledged });
    }
    if (state.view === 'review' && state.lastReview) {
      return renderReviewBody({ result: state.lastReview, acknowledged: state.acknowledged });
    }
    const mode = selectedMode();
    return renderModeLauncher({ modes: snap.modes || [], selectedId: state.selectedModeId }) +
      renderComposer({
        mode,
        length: state.length,
        research: state.research,
        contextNote: contextNote(),
        canRun: Boolean(state.checkedText && state.checkedText.trim().length >= 3)
      });
  }

  async function runSelected() {
    const mode = selectedMode();
    const text = state.active ? readText(state.active) : state.checkedText;
    if (!mode || !text.trim()) return;
    state.checkedText = text;
    state.running = true;
    state.error = '';
    state.acknowledged = false;
    paint();
    const seq = ++state.requestSeq;
    const requestId = `wr-run-${seq}`;
    const isReview = mode.operation === OPERATION.REVIEW;
    const task = isReview
      ? (state.research ? TASKS.RESEARCH_REVIEW : TASKS.REVIEW)
      : TASKS.REWRITE;

    let untrustedBlocks = [];
    const snap = state.snapshot || {};
    const host = normaliseHost(location.host);
    if (snap.settings?.context?.nearbyEnabled && snap.consents?.[host]) {
      const capture = captureContext(document, { host: location.host, settings: snap.settings, consented: true });
      untrustedBlocks = capture.blocks || [];
    }

    try {
      const response = await ask(MESSAGES.RUN_TASK, {
        origin: location.origin,
        payload: {
          task,
          requestId,
          text,
          origin: location.origin,
          modeId: mode.id,
          profileId: el.profile.value || undefined,
          model: el.model.value || undefined,
          options: {
            length: state.length,
            research: isReview ? state.research : false,
            untrustedBlocks
          }
        }
      });
      if (seq !== state.requestSeq) return;
      if (isReview) {
        state.lastReview = response.result;
        state.view = 'review';
        state.tab = 'rewrite';
      } else {
        state.lastRewrite = response.result;
        state.view = 'rewrite';
        state.tab = 'rewrite';
        ask(MESSAGES.HISTORY_ADD, {
          entry: {
            task,
            modeId: mode.id,
            original: text,
            result: response.result?.proposal || '',
            host: location.host,
            model: response.model,
            usage: response.usage
          }
        }).catch(() => {});
      }
    } catch (error) {
      if (seq !== state.requestSeq) return;
      state.error = error.message;
      state.view = 'error';
      state.tab = 'suggestions';
    } finally {
      if (seq === state.requestSeq) {
        state.running = false;
        root.classList.remove('wr-loading');
        paint();
      }
    }
  }

  function remember(node, label) {
    state.undo.push(makeUndoEntry({
      text: readText(node),
      selectionStart: node.selectionStart ?? null,
      selectionEnd: node.selectionEnd ?? null,
      label
    }));
  }

  function applyOne(index) {
    if (!state.active) return;
    const current = readText(state.active);
    const issue = state.issues[index];
    if (!issue) return;
    const [located] = revalidate([issue], current).live;
    if (!located) return schedule(state.active);
    remember(state.active, 'accept suggestion');
    writeText(state.active, applyReplacements(current, [located]));
    el.panel.hidden = true;
    schedule(state.active);
  }

  function applyAll() {
    if (!state.active) return;
    const current = readText(state.active);
    const { live } = revalidate(state.issues, current);
    if (!live.length) return schedule(state.active);
    remember(state.active, `accept ${live.length} suggestions`);
    writeText(state.active, applyReplacements(current, live));
    el.panel.hidden = true;
    schedule(state.active);
  }

  function applyRewrite() {
    if (!state.active || !applyRewriteAllowed(state.lastRewrite, state.acknowledged)) return;
    remember(state.active, 'apply rewrite');
    writeText(state.active, state.lastRewrite.proposal);
    state.view = 'home';
    state.lastRewrite = null;
    el.panel.hidden = true;
    schedule(state.active);
  }

  function undo() {
    const entry = state.undo.pop();
    if (!entry || !state.active) return;
    writeText(state.active, entry.text);
    if (entry.selectionStart !== null && state.active.setSelectionRange) {
      try { state.active.setSelectionRange(entry.selectionStart, entry.selectionEnd); } catch { /* not supported */ }
    }
    schedule(state.active);
  }

  document.addEventListener('focusin', event => {
    const node = event.target?.closest?.(EDITABLE_SELECTOR);
    if (node && !root.contains(node) && !node.closest('[data-wr-ignore]')) schedule(node);
  }, true);
  document.addEventListener('input', event => {
    if (event.target === state.active) schedule(state.active);
  }, true);
  document.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);

  el.badge.addEventListener('click', async () => {
    el.panel.hidden = !el.panel.hidden;
    if (!el.panel.hidden) {
      await refreshSnapshot();
      if (state.issues.length && state.view === 'home') state.tab = 'suggestions';
      paint();
    }
  });
  root.querySelector('.wr-close').addEventListener('click', () => { el.panel.hidden = true; });

  root.addEventListener('click', event => {
    const tab = event.target.closest('[data-tab]');
    if (tab) {
      state.tab = tab.dataset.tab;
      if (state.tab === 'rewrite' && state.view === 'error') state.view = 'home';
      paint();
      return;
    }
    const modeBtn = event.target.closest('[data-mode]');
    if (modeBtn) {
      state.selectedModeId = modeBtn.dataset.mode;
      state.view = 'home';
      state.lastRewrite = null;
      state.lastReview = null;
      paint();
      return;
    }
    const lengthBtn = event.target.closest('[data-length]');
    if (lengthBtn) {
      state.length = lengthBtn.dataset.length;
      paint();
      return;
    }
    if (event.target.closest('[data-run]')) runSelected();
    if (event.target.closest('[data-back]')) {
      state.view = 'home';
      state.lastRewrite = null;
      state.lastReview = null;
      paint();
    }
    if (event.target.closest('[data-retry]')) runSelected();
    if (event.target.closest('[data-copy]') && state.lastRewrite?.proposal) {
      navigator.clipboard?.writeText(state.lastRewrite.proposal).catch(() => {});
    }
    if (event.target.closest('[data-apply-rewrite]')) applyRewrite();
    const apply = event.target.closest('[data-apply]');
    if (apply) applyOne(Number(apply.dataset.apply));
    if (event.target.closest('[data-apply-all]')) applyAll();
    if (event.target.closest('[data-undo]')) undo();
    if (event.target.closest('[data-settings]')) ask(MESSAGES.OPEN_OPTIONS).catch(() => {});
    if (event.target.closest('[data-resume]')) {
      const scope = state.snapshot?.shutdown?.blockedBy || 'global';
      ask(MESSAGES.SET_SHUTDOWN, { scope, value: false, origin: location.origin }).then(refreshSnapshot).then(paint);
    }
    if (event.target.closest('[data-pause-site]')) {
      ask(MESSAGES.SET_SHUTDOWN, { scope: 'website', value: true, origin: location.origin }).then(refreshSnapshot).then(() => { el.panel.hidden = true; });
    }
    if (event.target.closest('[data-pause-tab]')) {
      ask(MESSAGES.SET_SHUTDOWN, { scope: 'tab', value: true, origin: location.origin }).then(refreshSnapshot).then(() => { el.panel.hidden = true; });
    }
    if (event.target.closest('[data-allow-context]')) {
      ask(MESSAGES.SET_CONSENT, { host: location.host, allowed: true }).then(refreshSnapshot).then(paint);
    }
  });

  root.addEventListener('change', event => {
    if (event.target.matches('[data-research]')) {
      state.research = event.target.checked;
    }
    if (event.target.matches('[data-ack]')) {
      state.acknowledged = event.target.checked;
      paint();
    }
    if (event.target === el.profile) {
      ask(MESSAGES.SET_SETTINGS, { patch: { activeProfileId: el.profile.value } }).catch(() => {});
    }
    if (event.target === el.model) {
      ask(MESSAGES.SET_SETTINGS, { patch: { model: el.model.value } }).catch(() => {});
    }
  });

  refreshSnapshot();
}

function shell() {
  return `<button class="wr-badge" aria-label="Open WriteRight" title="Open WriteRight"><span>W</span><b hidden>0</b></button>
    <section class="wr-panel" role="dialog" aria-label="WriteRight" hidden>
      <header>
        <div class="wr-headline"><div class="wr-brand"><span class="wr-logo">W</span><div class="wr-brand-copy"><strong>WriteRight</strong><small>Your writing assistant</small></div></div><button class="wr-close" aria-label="Close">×</button></div>
        <div class="wr-toolbar">
          <label>Profile <select data-profile></select></label>
          <label>Model <select data-model></select></label>
        </div>
        <nav class="wr-tabs">
          <button type="button" class="wr-tab active" data-tab="rewrite">Rewrite</button>
          <button type="button" class="wr-tab" data-tab="suggestions">Suggestions <em hidden>0</em></button>
        </nav>
      </header>
      <div class="wr-body"></div>
      <footer>
        <span>AI output can be wrong. Review before sending.</span>
        <span class="wr-foot-actions">
          <button type="button" data-allow-context>Allow context</button>
          <button type="button" data-pause-site>Pause site</button>
          <button type="button" data-pause-tab>Pause tab</button>
          <button type="button" data-settings>Settings</button>
        </span>
      </footer>
    </section>`;
}
