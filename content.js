(() => {
  if (window.__writeRightLoaded) return;
  window.__writeRightLoaded = true;
  const EDITABLE = 'textarea, input:not([type]), input[type="text"], input[type="search"], input[type="email"], [contenteditable="true"], [contenteditable="plaintext-only"]';
  let active = null, issues = [], checkedText = '', timer, requestId = 0;

  const root = document.createElement('div');
  root.id = 'wr-root';
  root.innerHTML = `<button class="wr-badge" aria-label="Open WriteRight" title="Open writing suggestions"><span>W</span><b hidden>0</b></button>
    <section class="wr-panel" role="dialog" aria-label="WriteRight suggestions" hidden>
      <header>
        <div class="wr-headline"><div class="wr-brand"><span class="wr-logo">W</span><div class="wr-brand-copy"><strong>WriteRight</strong><small>Your writing assistant</small></div></div><button class="wr-close" aria-label="Close suggestions">×</button></div>
        <div class="wr-overview"><div class="wr-score"><span>100</span></div><div class="wr-overview-copy"><strong>Your writing</strong><p>Clear, correct, and ready to send.</p></div></div>
        <nav class="wr-tabs"><button class="wr-tab">Suggestions <em hidden>0</em></button></nav>
      </header>
      <div class="wr-body"></div>
      <footer><span>AI suggestions may be inaccurate</span><button data-settings>Settings</button></footer>
    </section>`;
  document.documentElement.appendChild(root);
  const badge = root.querySelector('.wr-badge'), count = badge.querySelector('b'), tabCount = root.querySelector('.wr-tab em'), score = root.querySelector('.wr-score'), scoreText = score.querySelector('span'), overviewText = root.querySelector('.wr-overview-copy p'), panel = root.querySelector('.wr-panel'), body = root.querySelector('.wr-body');

  const getText = el => el.matches('input,textarea') ? el.value : (el.innerText || '');
  function setText(el, value) {
    el.focus();
    if (el.matches('input,textarea')) {
      const proto = el.matches('textarea') ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    } else {
      el.textContent = value;
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: value }));
  }
  function position() {
    if (!active || !active.isConnected) return hide();
    const r = active.getBoundingClientRect();
    badge.style.left = `${Math.max(8, Math.min(innerWidth - 38, r.right - 34))}px`;
    badge.style.top = `${Math.max(8, Math.min(innerHeight - 38, r.bottom - 34))}px`;
  }
  function hide() { badge.hidden = true; panel.hidden = true; active = null; }
  function schedule(el) {
    active = el; badge.hidden = false; position(); clearTimeout(timer);
    const text = getText(el);
    root.classList.add('wr-loading'); count.hidden = true;
    if (text.trim().length < 3) { issues = []; checkedText = text; render(); root.classList.remove('wr-loading'); return; }
    timer = setTimeout(() => check(text), 700);
  }
  async function check(text) {
    const id = ++requestId; checkedText = text;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'CHECK_TEXT', text });
      if (id !== requestId || !active || getText(active) !== text) return;
      if (result.error) throw new Error(result.error);
      issues = result.issues || []; render();
    } catch (e) { issues = []; render(e.message); }
    finally { if (id === requestId) root.classList.remove('wr-loading'); }
  }
  function render(error) {
    const quality = error ? 0 : Math.max(42, 100 - issues.length * 9);
    count.textContent = issues.length; count.hidden = !issues.length;
    tabCount.textContent = issues.length; tabCount.hidden = !issues.length;
    score.style.setProperty('--score', `${quality}%`); scoreText.textContent = quality;
    overviewText.textContent = error ? 'Connect your AI provider to continue.' : issues.length ? `${issues.length} improvement${issues.length === 1 ? '' : 's'} before you send.` : 'Clear, correct, and ready to send.';
    active?.classList.toggle('wr-has-issues', issues.length > 0);
    if (error) body.innerHTML = `<div class="wr-state wr-error"><i>!</i><strong>We couldn't check your writing</strong><p>${escapeHtml(error)}</p><button data-settings>Open settings</button></div>`;
    else if (!checkedText.trim()) body.innerHTML = `<div class="wr-state"><i>✎</i><strong>Start writing</strong><p>We'll check your spelling and grammar as you type.</p></div>`;
    else if (!issues.length) body.innerHTML = `<div class="wr-state"><i>✓</i><strong>Your text looks polished</strong><p>No spelling or grammar issues found. You're ready to send.</p></div>`;
    else body.innerHTML = `<div class="wr-summary"><strong>Review your suggestions</strong><button data-apply-all>Accept all</button></div>` + issues.map((x, i) => `<article><small>${escapeHtml(x.category || 'grammar')}</small><p>${escapeHtml(x.message || 'Suggested correction')}</p><div class="wr-replacement"><del>${escapeHtml(x.original || checkedText.slice(x.start,x.end))}</del><span>→</span><ins>${escapeHtml(x.replacement)}</ins></div><button class="wr-accept" data-apply="${i}">Accept</button></article>`).join('');
  }
  function matchesIssue(text, issue) {
    const expected = issue.original || checkedText.slice(issue.start, issue.end);
    return text.slice(issue.start, issue.end) === expected;
  }
  function apply(index) {
    if (!active) return;
    const issue = issues[index], current = getText(active);
    if (!matchesIssue(current, issue)) { schedule(active); return; }
    const next = current.slice(0, issue.start) + issue.replacement + current.slice(issue.end);
    setText(active, next); panel.hidden = true; schedule(active);
  }
  function applyAll() {
    if (!active) return;
    let next = getText(active);
    const valid = [...issues].sort((a,b) => b.start-a.start).filter(x => matchesIssue(next, x));
    if (!valid.length) { schedule(active); return; }
    valid.forEach(x => next = next.slice(0,x.start)+x.replacement+next.slice(x.end));
    setText(active, next); panel.hidden = true; schedule(active);
  }
  const escapeHtml = s => String(s || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  document.addEventListener('focusin', e => { const el = e.target.closest?.(EDITABLE); if (el && !root.contains(el) && !el.closest('[data-wr-ignore]')) schedule(el); }, true);
  document.addEventListener('input', e => { if (e.target === active) schedule(active); }, true);
  document.addEventListener('scroll', position, true); addEventListener('resize', position);
  badge.onclick = () => { panel.hidden = !panel.hidden; if (!panel.hidden) render(); };
  root.querySelector('.wr-close').onclick = () => panel.hidden = true;
  root.addEventListener('click', e => { const a = e.target.closest('[data-apply]'); if (a) apply(+a.dataset.apply); if (e.target.closest('[data-apply-all]')) applyAll(); if (e.target.closest('[data-settings]')) chrome.runtime.sendMessage({type:'OPEN_OPTIONS'}); });
})();
