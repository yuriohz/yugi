const DEFAULTS = {
  provider: 'openrouter',
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'openai/gpt-4o-mini',
  language: 'English',
  enabled: true
};

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
});

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    return;
  }
  if (message.type === 'CHECK_TEXT') {
    checkText(message.text).then(respond).catch(error => respond({ error: error.message }));
    return true;
  }
  if (message.type === 'TEST_CONNECTION') {
    testConnection(message.settings).then(respond).catch(error => respond({ ok: false, error: error.message }));
    return true;
  }
});

async function checkText(text) {
  const settings = await chrome.storage.local.get(DEFAULTS);
  if (!settings.enabled) return { issues: [] };
  if (!settings.apiKey) throw new Error('Add your API key in WriteRight settings.');

  const response = await fetch(settings.endpoint, {
    method: 'POST',
    headers: apiHeaders(settings),
    body: JSON.stringify({
      model: settings.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `You are a precise ${settings.language} proofreader. Return JSON only: {"issues":[{"start":number,"end":number,"original":string,"replacement":string,"message":string,"category":"spelling|grammar|punctuation|clarity"}]}. Offsets are zero-based JavaScript string offsets into the exact user text. Report only clear errors. Never rewrite for preference. Keep replacements concise.` },
        { role: 'user', content: text }
      ]
    })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI request failed (${response.status}): ${body.slice(0, 180)}`);
  }
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || '{}';
  const parsed = typeof raw === 'string' ? JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')) : raw;
  const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
  return { issues: issues.filter(i => Number.isInteger(i.start) && Number.isInteger(i.end) && i.start >= 0 && i.end <= text.length && i.end > i.start).slice(0, 50) };
}

function apiHeaders(settings) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${settings.apiKey}`
  };
  if ((settings.endpoint || '').includes('openrouter.ai')) {
    headers['HTTP-Referer'] = 'https://writeright.app';
    headers['X-Title'] = 'WriteRight Chrome Extension';
  }
  return headers;
}

async function testConnection(candidate = {}) {
  const settings = { ...DEFAULTS, ...candidate };
  if (!settings.apiKey) throw new Error('Enter an OpenRouter API key first.');
  const response = await fetch(settings.endpoint, {
    method: 'POST',
    headers: apiHeaders(settings),
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 8,
      temperature: 0,
      messages: [{ role: 'user', content: 'Reply with the single word OK.' }]
    })
  });
  if (!response.ok) {
    const raw = await response.text();
    let detail = raw;
    try { detail = JSON.parse(raw).error?.message || raw; } catch (_) {}
    throw new Error(`${response.status}: ${String(detail).slice(0, 220)}`);
  }
  return { ok: true };
}
