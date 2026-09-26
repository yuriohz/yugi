import { MESSAGES } from '../core/constants.js';
import { ask } from './messaging.js';

let current = 1;
const $ = s => document.querySelector(s);

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
  const settings = {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
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
  }
});

$('#connectNext').addEventListener('click', async () => {
  await ask(MESSAGES.SET_SETTINGS, {
    patch: {
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: $('#apiKey').value.trim(),
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
    $('#model').value = [...$('#model').options].some(o => o.value === s.model) ? s.model : 'openai/gpt-4o-mini';
    if (s.locale) $('#locale').value = s.locale.startsWith('ar') ? 'ar' : s.locale;
    $('#enabled').checked = s.enabled !== false;
    if (state.hasKey) $('#connectNext').disabled = false;
  } catch { /* first run, empty storage */ }
})();
