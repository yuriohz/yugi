import { getProvider, PROVIDERS } from '../core/providers.js';
import { MESSAGES, TASKS } from '../core/constants.js';
import { ask } from './messaging.js';
import { capabilityBadges } from './render.js';

const $ = id => document.getElementById(id);
const setStatus = (id, text, ok = true) => {
  const node = $(id);
  node.textContent = text || '';
  node.style.color = ok ? '#08755f' : '#d43e48';
};

let snapshot = null;
let editingModeId = null;

function splitTerms(value) {
  return String(value || '').split(',').map(s => s.trim()).filter(Boolean);
}

function fillProfileSelect() {
  const select = $('profileSelect');
  select.replaceChildren();
  for (const profile of snapshot.profiles || []) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name;
    if (profile.id === snapshot.settings?.activeProfileId) option.selected = true;
    select.appendChild(option);
  }
  showProfile(select.value);
}

function showProfile(id) {
  const profile = (snapshot.profiles || []).find(p => p.id === id) || snapshot.profiles?.[0];
  if (!profile) return;
  $('profileName').value = profile.name || '';
  $('profileAudience').value = profile.audience || '';
  $('profileLocale').value = ['ar', 'ar-EG'].includes(profile.locale) ? profile.locale : 'en-GB';
  $('profileVoice').value = profile.voiceDescription || '';
  $('profileSamples').value = (profile.samples || []).join('\n\n');
  $('profileProtected').value = (profile.protectedTerms || []).join(', ');
}

function renderFavourites() {
  const list = $('favList');
  list.replaceChildren();
  for (const fav of snapshot.favourites || []) {
    const item = document.createElement('li');
    const label = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = fav.label || fav.id;
    const small = document.createElement('small');
    small.textContent = fav.id;
    label.append(title, small);
    const badges = document.createElement('span');
    badges.className = 'badges';
    for (const badge of capabilityBadges(fav)) {
      const pill = document.createElement('em');
      pill.className = `badge badge-${badge.tone}`;
      pill.textContent = badge.text;
      badges.appendChild(pill);
    }
    label.appendChild(badges);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      await ask(MESSAGES.SET_FAVOURITES, { remove: fav.id });
      snapshot = await ask(MESSAGES.GET_STATE);
      renderFavourites();
    });
    item.append(label, remove);
    list.appendChild(item);
  }
}

function renderModes() {
  const list = $('modeList');
  list.replaceChildren();
  for (const mode of snapshot.modes || []) {
    const item = document.createElement('li');
    const label = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = mode.name + (mode.builtIn ? ' · built-in' : '');
    const small = document.createElement('small');
    small.textContent = mode.summary || mode.description || '';
    label.append(title, small);
    const actions = document.createElement('div');
    if (!mode.builtIn) {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.style.color = '#7D3424';
      edit.addEventListener('click', () => {
        editingModeId = mode.id;
        $('modeName').value = mode.name;
        $('modeSummary').value = mode.summary || '';
        $('modeInstruction').value = mode.instruction || '';
        $('modeMustNot').value = (mode.mustNot || []).join('\n');
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.addEventListener('click', async () => {
        const result = await ask(MESSAGES.DELETE_MODE, { id: mode.id });
        snapshot.modes = result.modes;
        if (editingModeId === mode.id) editingModeId = null;
        renderModes();
      });
      actions.append(edit, remove);
    }
    item.append(label, actions);
    list.appendChild(item);
  }
}

let editingPromptId = null;

function renderPrompts() {
  const list = $('promptList');
  list.replaceChildren();
  for (const prompt of snapshot.prompts || []) {
    const item = document.createElement('li');
    const label = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = prompt.name;
    const small = document.createElement('small');
    small.textContent = String(prompt.body || '').slice(0, 140);
    label.append(title, small);
    const actions = document.createElement('div');
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.style.color = '#7D3424';
    edit.addEventListener('click', () => {
      editingPromptId = prompt.id;
      $('promptName').value = prompt.name;
      $('promptBody').value = prompt.body;
      $('promptMode').value = prompt.modeId || '';
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', async () => {
      const result = await ask(MESSAGES.DELETE_PROMPT, { id: prompt.id });
      snapshot.prompts = result.prompts;
      if (editingPromptId === prompt.id) editingPromptId = null;
      renderPrompts();
    });
    actions.append(edit, remove);
    item.append(label, actions);
    list.appendChild(item);
  }
}

function renderDictionary() {
  const list = $('dictList');
  list.replaceChildren();
  for (const entry of snapshot.dictionary || []) {
    const item = document.createElement('li');
    const label = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = entry.word;
    const small = document.createElement('small');
    small.textContent = entry.note || entry.scope || 'global';
    label.append(title, small);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      const result = await ask(MESSAGES.REMOVE_DICTIONARY, { word: entry.word, options: { scope: entry.scope, scopeId: entry.scopeId } });
      snapshot.dictionary = result.dictionary;
      renderDictionary();
    });
    item.append(label, remove);
    list.appendChild(item);
  }
}

function cleanEndpoint(value) {
  const endpoint = String(value || '').trim();
  return Object.values(PROVIDERS).some(p => p.defaultEndpoint === endpoint) ? '' : endpoint;
}
function paintProvider() {
  const p = getProvider($('provider').value);
  $('keyLabel').textContent = `${p.name} API key`;
  $('apiKey').placeholder = p.keyPlaceholder;
  $('keyLink').href = p.keyUrl;
  $('keyLink').textContent = `Get a key from ${p.name} ↗`;
  $('endpoint').placeholder = p.defaultEndpoint;
  $('model').placeholder = p.defaultModel;
  $('favId').placeholder = p.modelIdHint;
  $('modelHint').textContent = `Ids look like ${p.modelIdHint}. Save your connection before adding favourites.`;
  $('providerModels').replaceChildren(...p.models.map(m => new Option(m.label, m.id)));
  $('researchNote').textContent = p.supportsResearch ? 'Researched review uses OpenRouter web search.' : 'Web research is not available on Google AI Studio. Switch to OpenRouter for researched review.';
}
$('provider').addEventListener('change', () => {
  $('apiKey').value = '';
  $('model').value = getProvider($('provider').value).defaultModel;
  $('endpoint').value = cleanEndpoint($('endpoint').value);
  paintProvider();
});

async function load() {
  snapshot = await ask(MESSAGES.GET_STATE);
  const s = snapshot.settings || {};
  $('provider').value = getProvider(s.provider).id;
  paintProvider();
  $('endpoint').value = cleanEndpoint(s.endpoint);
  $('model').value = s.model || '';
  $('locale').value = s.locale || 'en-GB';
  $('apiKey').placeholder = snapshot.hasKey ? 'Key saved on this device' : getProvider(s.provider).keyPlaceholder;
  $('enabled').checked = s.enabled !== false;
  $('nearby').checked = Boolean(s.context?.nearbyEnabled);
  $('history').checked = Boolean(s.history?.enabled);
  $('historySummary').textContent = snapshot.history?.detail || '';
  fillProfileSelect();
  renderFavourites();
  renderModes();
  renderPrompts();
  renderDictionary();
}

$('reveal').addEventListener('click', () => {
  const input = $('apiKey');
  input.type = input.type === 'password' ? 'text' : 'password';
  $('reveal').textContent = input.type === 'password' ? 'Show' : 'Hide';
});

$('saveConnection').addEventListener('click', async () => {
  const patch = {
    provider: $('provider').value,
    endpoint: cleanEndpoint($('endpoint').value),
    model: $('model').value.trim(),
    locale: $('locale').value
  };
  if ($('apiKey').value.trim() || patch.provider !== snapshot.settings?.provider) patch.apiKey = $('apiKey').value.trim();
  if (!patch.model) {
    setStatus('connectionStatus', 'Model is required.', false);
    return;
  }
  const result = await ask(MESSAGES.SET_SETTINGS, { patch });
  snapshot.settings = result.settings;
  snapshot.hasKey = result.hasKey;
  setStatus('connectionStatus', 'Saved.');
});

$('test').addEventListener('click', async () => {
  setStatus('connectionStatus', 'Testing…');
  try {
    const settings = {
      provider: $('provider').value,
      endpoint: cleanEndpoint($('endpoint').value),
      model: $('model').value.trim(),
      apiKey: $('apiKey').value.trim() || ($('provider').value === snapshot.settings?.provider ? undefined : '')
    };
    const result = await ask(MESSAGES.TEST_CONNECTION, { settings, userInitiated: true });
    setStatus('connectionStatus', `Connected · ${result.model || settings.model}`);
  } catch (error) {
    setStatus('connectionStatus', error.message, false);
  }
});

$('addFav').addEventListener('click', async () => {
  try {
    await ask(MESSAGES.SET_FAVOURITES, {
      add: { id: $('favId').value.trim(), label: $('favLabel').value.trim() }
    });
    snapshot = await ask(MESSAGES.GET_STATE);
    $('favId').value = '';
    $('favLabel').value = '';
    renderFavourites();
    setStatus('favStatus', 'Added.');
  } catch (error) {
    setStatus('favStatus', error.message, false);
  }
});

$('refreshModels').addEventListener('click', async () => {
  try {
    const result = await ask(MESSAGES.LIST_MODELS, { userInitiated: true, options: { force: true } });
    setStatus('favStatus', result.notice || `${result.models?.length || 0} models from ${result.source}.`);
  } catch (error) {
    setStatus('favStatus', error.message, false);
  }
});

$('profileSelect').addEventListener('change', () => showProfile($('profileSelect').value));

$('saveProfile').addEventListener('click', async () => {
  try {
    const current = (snapshot.profiles || []).find(p => p.id === $('profileSelect').value) || {};
    const result = await ask(MESSAGES.SAVE_PROFILE, {
      profile: {
        ...current,
        id: current.id,
        name: $('profileName').value,
        audience: $('profileAudience').value,
        locale: $('profileLocale').value,
        voiceDescription: $('profileVoice').value,
        samples: $('profileSamples').value.split(/\n{2,}/).map(s => s.trim()).filter(Boolean),
        protectedTerms: splitTerms($('profileProtected').value)
      }
    });
    snapshot.profiles = result.profiles;
    fillProfileSelect();
    setStatus('profileStatus', 'Saved.');
  } catch (error) {
    setStatus('profileStatus', error.message, false);
  }
});

$('newProfile').addEventListener('click', () => {
  $('profileSelect').value = '';
  $('profileName').value = '';
  $('profileAudience').value = '';
  $('profileLocale').value = 'en-GB';
  $('profileVoice').value = '';
  $('profileSamples').value = '';
  $('profileProtected').value = '';
  setStatus('profileStatus', 'Name the profile, then save.');
});

$('deleteProfile').addEventListener('click', async () => {
  const id = $('profileSelect').value;
  if (!id) return;
  const result = await ask(MESSAGES.DELETE_PROFILE, { id });
  snapshot.profiles = result.profiles;
  fillProfileSelect();
  setStatus('profileStatus', 'Deleted.');
});

$('saveMode').addEventListener('click', async () => {
  try {
    const result = await ask(MESSAGES.SAVE_MODE, {
      mode: {
        id: editingModeId || undefined,
        name: $('modeName').value,
        summary: $('modeSummary').value,
        instruction: $('modeInstruction').value,
        mustNot: $('modeMustNot').value.split('\n').map(s => s.trim()).filter(Boolean)
      }
    });
    snapshot.modes = result.modes;
    editingModeId = null;
    $('modeName').value = '';
    $('modeSummary').value = '';
    $('modeInstruction').value = '';
    $('modeMustNot').value = '';
    renderModes();
    setStatus('modeStatus', result.warnings?.[0] || 'Saved.');
  } catch (error) {
    setStatus('modeStatus', error.message, false);
  }
});

$('testMode').addEventListener('click', async () => {
  const input = $('modeTest').value.trim();
  if (!input) {
    setStatus('modeStatus', 'Add a test input first.', false);
    return;
  }
  if (!editingModeId) {
    setStatus('modeStatus', 'Save the mode, then test it. Built-in modes can be duplicated by saving a custom copy.', false);
    return;
  }
  setStatus('modeStatus', 'Running test…');
  try {
    const result = await ask(MESSAGES.RUN_TASK, {
      payload: {
        task: TASKS.TEST_MODE,
        text: input,
        modeId: editingModeId,
        options: {
          testCase: { input, expectations: ['Preserve facts from the input.'] }
        }
      }
    });
    const out = $('modeTestOut');
    out.hidden = false;
    out.textContent = result.result?.output || JSON.stringify(result.result, null, 2);
    setStatus('modeStatus', 'Test finished. Check the output below — WordSaffron, not the model, decides whether it passed.');
  } catch (error) {
    setStatus('modeStatus', error.message, false);
  }
});

$('savePrompt').addEventListener('click', async () => {
  try {
    const result = await ask(MESSAGES.SAVE_PROMPT, {
      prompt: {
        id: editingPromptId || undefined,
        name: $('promptName').value,
        body: $('promptBody').value,
        modeId: $('promptMode').value.trim() || null
      }
    });
    snapshot.prompts = result.prompts;
    editingPromptId = null;
    $('promptName').value = '';
    $('promptBody').value = '';
    $('promptMode').value = '';
    renderPrompts();
    setStatus('promptStatus', 'Saved.');
  } catch (error) {
    setStatus('promptStatus', error.message, false);
  }
});

$('addDict').addEventListener('click', async () => {
  try {
    const result = await ask(MESSAGES.ADD_DICTIONARY, {
      word: $('dictWord').value,
      options: { note: $('dictNote').value }
    });
    snapshot.dictionary = result.dictionary;
    $('dictWord').value = '';
    $('dictNote').value = '';
    renderDictionary();
    setStatus('dictStatus', 'Added.');
  } catch (error) {
    setStatus('dictStatus', error.message, false);
  }
});

$('savePrivacy').addEventListener('click', async () => {
  await ask(MESSAGES.SET_SHUTDOWN, { scope: 'global', value: !$('enabled').checked });
  const result = await ask(MESSAGES.SET_SETTINGS, {
    patch: {
      context: { nearbyEnabled: $('nearby').checked },
      history: { enabled: $('history').checked }
    }
  });
  snapshot.settings = result.settings;
  setStatus('historySummary', 'Saved.');
});

$('clearHistory').addEventListener('click', async () => {
  await ask(MESSAGES.HISTORY_CLEAR);
  setStatus('historySummary', 'History cleared.');
});

$('exportBtn').addEventListener('click', async () => {
  const result = await ask(MESSAGES.EXPORT_SETTINGS);
  const blob = new Blob([result.text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'writeright-settings.json';
  a.click();
  URL.revokeObjectURL(url);
  setStatus('dataStatus', result.warnings?.[0] || 'Downloaded. The file does not contain your API key.');
});

$('importFile').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    const preview = await ask(MESSAGES.IMPORT_SETTINGS, { text, confirm: false });
    const ok = window.confirm(`Import ${JSON.stringify(preview.summary)} ? This replaces matching lists.`);
    if (!ok) return;
    await ask(MESSAGES.IMPORT_SETTINGS, { text, confirm: true });
    await load();
    setStatus('dataStatus', 'Imported. Your API key was not changed.');
  } catch (error) {
    setStatus('dataStatus', error.message, false);
  }
});

load().catch(error => setStatus('connectionStatus', error.message, false));
