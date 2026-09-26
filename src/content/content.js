/**
 * WriteRight content script entry point.
 *
 * Owns no credentials and makes no network calls. Everything that touches the
 * network goes through the service worker, which enforces the shutdown gate.
 */
import { MESSAGES, TASKS } from '../core/constants.js';
import { escapeHtml } from '../core/escape.js';

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
    disabledReason: ''
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
    tabCount: root.querySelector('.wr-tab em'),
    score: root.querySelector('.wr-score'),
    scoreText: root.querySelector('.wr-score span'),
    overview: root.querySelector('.wr-overview-copy p')
  };

  const readText = node => (node.matches('input, textarea') ? node.value : node.innerText || '');

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
    state.active = null;
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
      render();
      return;
    }
    state.timer = setTimeout(() => check(text), 700);
  }

  async function check(text) {
    const seq = ++state.requestSeq;
    state.checkedText = text;
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGES.RUN_TASK,
        payload: {
          task: TASKS.PROOFREAD,
          requestId: `wr-${seq}`,
          text,
          origin: location.origin
        }
      });
      if (seq !== state.requestSeq || !state.active || readText(state.active) !== text) return;
      if (!response?.ok) throw new Error(response?.error?.message || 'Request failed.');
      state.issues = response.result?.result?.issues || [];
      render();
    } catch (error) {
      state.issues = [];
      render(error.message);
    } finally {
      if (seq === state.requestSeq) root.classList.remove('wr-loading');
    }
  }

  function render(error) {
    const quality = error ? 0 : Math.max(42, 100 - state.issues.length * 9);
    el.count.textContent = String(state.issues.length);
    el.count.hidden = state.issues.length === 0;
    el.tabCount.textContent = String(state.issues.length);
    el.tabCount.hidden = state.issues.length === 0;
    el.score.style.setProperty('--score', `${quality}%`);
    el.scoreText.textContent = String(quality);
    el.overview.textContent = error
      ? 'WriteRight could not check this text.'
      : state.issues.length
        ? `${state.issues.length} suggestion${state.issues.length === 1 ? '' : 's'} before you send.`
        : 'Clear, correct, and ready to send.';
    state.active?.classList.toggle('wr-has-issues', state.issues.length > 0);

    if (error) {
      el.body.innerHTML =
        `<div class="wr-state wr-error"><i>!</i><strong>We couldn’t check your writing</strong>` +
        `<p>${escapeHtml(error)}</p><button data-settings>Open settings</button></div>`;
    } else if (!state.checkedText.trim()) {
      el.body.innerHTML =
        `<div class="wr-state"><i>✎</i><strong>Start writing</strong>` +
        `<p>WriteRight checks spelling and grammar after you pause.</p></div>`;
    } else if (!state.issues.length) {
      el.body.innerHTML =
        `<div class="wr-state"><i>✓</i><strong>No issues found</strong>` +
        `<p>Nothing to correct in this text. Review it yourself before sending.</p></div>`;
    } else {
      el.body.innerHTML =
        `<div class="wr-summary"><strong>Review your suggestions</strong>` +
        `<button data-apply-all>Accept all</button></div>` +
        state.issues.map((issue, index) => card(issue, index)).join('');
    }
  }

  function card(issue, index) {
    return `<article><small>${escapeHtml(issue.category)}</small>` +
      `<p>${escapeHtml(issue.message)}</p>` +
      `<div class="wr-replacement"><del>${escapeHtml(issue.original)}</del><span>→</span>` +
      `<ins>${escapeHtml(issue.replacement)}</ins></div>` +
      `<button class="wr-accept" data-apply="${index}">Accept</button></article>`;
  }

  /** Stale-range protection: the text at the offsets must still be what we analysed. */
  function stillValid(text, issue) {
    return text.slice(issue.start, issue.end) === issue.original;
  }

  function applyOne(index) {
    if (!state.active) return;
    const issue = state.issues[index];
    const current = readText(state.active);
    if (!issue || !stillValid(current, issue)) return schedule(state.active);
    writeText(state.active, current.slice(0, issue.start) + issue.replacement + current.slice(issue.end));
    el.panel.hidden = true;
    schedule(state.active);
  }

  function applyAll() {
    if (!state.active) return;
    let text = readText(state.active);
    const valid = [...state.issues].sort((a, b) => b.start - a.start).filter(i => stillValid(text, i));
    if (!valid.length) return schedule(state.active);
    for (const issue of valid) {
      text = text.slice(0, issue.start) + issue.replacement + text.slice(issue.end);
    }
    writeText(state.active, text);
    el.panel.hidden = true;
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

  el.badge.addEventListener('click', () => {
    el.panel.hidden = !el.panel.hidden;
    if (!el.panel.hidden) render();
  });
  root.querySelector('.wr-close').addEventListener('click', () => { el.panel.hidden = true; });
  root.addEventListener('click', event => {
    const apply = event.target.closest('[data-apply]');
    if (apply) applyOne(Number(apply.dataset.apply));
    if (event.target.closest('[data-apply-all]')) applyAll();
    if (event.target.closest('[data-settings]')) {
      chrome.runtime.sendMessage({ type: MESSAGES.OPEN_OPTIONS });
    }
  });
}

function shell() {
  return `<button class="wr-badge" aria-label="Open WriteRight" title="Open writing suggestions"><span>W</span><b hidden>0</b></button>
    <section class="wr-panel" role="dialog" aria-label="WriteRight suggestions" hidden>
      <header>
        <div class="wr-headline"><div class="wr-brand"><span class="wr-logo">W</span><div class="wr-brand-copy"><strong>WriteRight</strong><small>Your writing assistant</small></div></div><button class="wr-close" aria-label="Close suggestions">×</button></div>
        <div class="wr-overview"><div class="wr-score"><span>100</span></div><div class="wr-overview-copy"><strong>Your writing</strong><p>Clear, correct, and ready to send.</p></div></div>
        <nav class="wr-tabs"><button class="wr-tab">Suggestions <em hidden>0</em></button></nav>
      </header>
      <div class="wr-body"></div>
      <footer><span>AI suggestions can be wrong. Review before sending.</span><button data-settings>Settings</button></footer>
    </section>`;
}
