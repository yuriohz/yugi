import { getProvider } from '../core/providers.js';
import { MESSAGES } from '../core/constants.js';
import { ask } from './messaging.js';

let current = 1;
const $ = s => document.querySelector(s);

function paintProvider() {
  const p = getProvider($('#provider').value);
  $('#keyLabel').textContent = `${p.name} API key`;
  $('#apiKey').placeholder = p.keyPlaceholder;
  $('#keyLink').href = p.keyUrl;
  $('#keyLink').textContent = `Create one on ${p.name} ↗`;
  $('#model').replaceChildren(...p.models.map(m => new Option(m.label, m.id)));
  $('#researchNote').textContent = p.supportsResearch ? 'Researched review uses OpenRouter web search.' : 'Web research is not available on Google AI Studio. Other writing tools remain available.';
}
$('#provider').addEventListener('change', () => {
  $('#apiKey').value = '';
  $('#connectNext').disabled = true;
  $('#testStatus').hidden = true;
  paintProvider();
});
for (const id of ['apiKey', 'model']) $(`#${id}`).addEventListener('input', () => { $('#connectNext').disabled = true; });
paintProvider();

function show(n) {
  current = n;
  document.querySelectorAll('.screen').forEach(x => x.classList.toggle('active', +x.dataset.screen === n));
  document.querySelectorAll('.step').forEach((x, i) => {
    x.classList.toggle('active', i + 1 === n);
    x.classList.toggle('complete', i + 1 < n);
    x.querySelector('b').textContent = i + 1 < n ? '✓' : String(i + 1);
  });
}

document.querySelectorAll('[data-next]').forEach(button => {
  if (button.id === 'connectNext') return;
  button.addEventListener('click', async () => {
    if (current === 3) {
      await ask(MESSAGES.SET_SETTINGS, {
        patch: {
          locale: $('#locale').value,
          enabled: $('#enabled').checked,
          onboardingComplete: true
        }
      });
    }
    show(Math.min(4, current + 1));
  });
});
document.querySelectorAll('[data-back]').forEach(button => {
  button.addEventListener('click', () => show(Math.max(1, current - 1)));
});

$('#showKey').addEventListener('click', () => {
  const input = $('#apiKey');
  input.type = input.type === 'password' ? 'text' : 'password';
  $('#showKey').textContent = input.type === 'password' ? 'Show' : 'Hide';
});

$('#test').addEventListener('click', async () => {
  const key = $('#apiKey').value.trim();
  const box = $('#testStatus');
  const button = $('#test');
  box.hidden = false;
  box.className = 'test-status';
  box.textContent = 'Testing your connection…';
  button.disabled = true;
  $('#connectNext').disabled = true;
  for (const id of ['provider', 'apiKey', 'model']) $(`#${id}`).disabled = true;
  const settings = {
    provider: $('#provider').value,
    endpoint: '',
    apiKey: key,
    model: $('#model').value
  };
  try {
    await ask(MESSAGES.TEST_CONNECTION, { settings, userInitiated: true });
    await ask(MESSAGES.SET_SETTINGS, { patch: settings });
    box.textContent = 'Connected. Your key is saved on this device.';
    $('#connectNext').disabled = false;
  } catch (error) {
    box.className = 'test-status error';
    box.textContent = error.message;
  } finally {
    button.disabled = false;
    for (const id of ['provider', 'apiKey', 'model']) $(`#${id}`).disabled = false;
  }
});

$('#connectNext').addEventListener('click', async () => {
  await ask(MESSAGES.SET_SETTINGS, {
    patch: {
      provider: $('#provider').value,
      endpoint: '',
      ...($('#apiKey').value.trim() ? { apiKey: $('#apiKey').value.trim() } : {}),
      model: $('#model').value
    }
  });
  show(3);
});

$('#settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('#finish').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://web.whatsapp.com' });
  window.close();
});

(async () => {
  try {
    const state = await ask(MESSAGES.GET_STATE);
    const s = state.settings || {};
    $('#provider').value = getProvider(s.provider).id;
    paintProvider();
    $('#model').value = [...$('#model').options].some(o => o.value === s.model) ? s.model : getProvider(s.provider).defaultModel;
    if (s.locale) $('#locale').value = s.locale.startsWith('ar') ? 'ar' : s.locale;
    $('#enabled').checked = s.enabled !== false;
    if (state.hasKey) $('#connectNext').disabled = false;
  } catch { /* first run, empty storage */ }
})();
