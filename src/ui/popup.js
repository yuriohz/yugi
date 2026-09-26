import { MESSAGES } from '../core/constants.js';
import { ask } from './messaging.js';
import { popupCopy } from './render.js';

const status = document.getElementById('status');
const detail = document.getElementById('detail');
const icon = document.getElementById('icon');
const card = document.getElementById('card');
const globalBtn = document.getElementById('global');
const siteBtn = document.getElementById('site');
const tabBtn = document.getElementById('tab');
const siteLabel = document.getElementById('siteLabel');

let origin = null;
let tabId = null;
let snapshot = null;

async function currentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch {
    return null;
  }
}

function paint() {
  const copy = popupCopy({
    hasKey: Boolean(snapshot?.hasKey),
    shutdown: snapshot?.shutdown || {}
  });
  status.textContent = copy.title;
  detail.textContent = copy.detail;
  icon.textContent = copy.icon;
  card.classList.toggle('paused', copy.paused);
  card.classList.toggle('setup', !snapshot?.hasKey);
  globalBtn.setAttribute('aria-pressed', snapshot?.shutdown?.global ? 'false' : 'true');
  siteBtn.setAttribute('aria-pressed', snapshot?.shutdown?.website ? 'false' : 'true');
  tabBtn.setAttribute('aria-pressed', snapshot?.shutdown?.tab ? 'false' : 'true');
  siteBtn.disabled = !origin;
  tabBtn.disabled = !origin;
  if (origin) {
    try { siteLabel.textContent = `Allow WriteRight on ${new URL(origin).host}`; }
    catch { siteLabel.textContent = 'Allow WriteRight on the current site'; }
  }
}

async function load() {
  const tab = await currentTab();
  origin = null;
  tabId = tab?.id ?? null;
  if (tab?.url) {
    try { origin = new URL(tab.url).origin; } catch { origin = null; }
  }
  snapshot = await ask(MESSAGES.GET_STATE, { origin, tabId });
  paint();
}

async function toggle(scope, button) {
  const currentlyOn = button.getAttribute('aria-pressed') === 'true';
  await ask(MESSAGES.SET_SHUTDOWN, { scope, value: currentlyOn, origin, tabId });
  await load();
}

globalBtn.addEventListener('click', () => toggle('global', globalBtn));
siteBtn.addEventListener('click', () => toggle('website', siteBtn));
tabBtn.addEventListener('click', () => toggle('tab', tabBtn));

const open = () => chrome.runtime.openOptionsPage();
document.getElementById('settings').addEventListener('click', open);
document.getElementById('options').addEventListener('click', open);

load().catch(error => {
  status.textContent = 'WriteRight could not load';
  detail.textContent = error.message;
  icon.textContent = '!';
});
