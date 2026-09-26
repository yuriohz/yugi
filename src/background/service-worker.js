/**
 * WriteRight Manifest V3 service worker.
 *
 * Responsibilities: own the API key, own every network call, route tasks, and
 * enforce the shutdown gate before anything leaves the browser.
 *
 * The zero-call guarantee: while WriteRight is switched off — globally, for a
 * site, or for a tab — it makes no network request of any kind. The only
 * exceptions are requests the user explicitly triggers from the settings page
 * (testing a key, refreshing the model list), which are marked `userInitiated`
 * and are the user asking for a call while the extension is otherwise idle.
 */
import { MESSAGES, STORAGE_KEYS } from '../core/constants.js';
import { getSettings, setSettings, getCollection, setCollection } from '../core/storage.js';
import { isAllowed, setShutdown, clearTabShutdown, getSiteShutdowns, normaliseOrigin, isTabShutdown } from '../core/shutdown.js';
import { runTask, cancelTask, cancelAll, testConnection } from './router.js';
import { getCatalogue, getCachedCatalogue } from './model-catalogue.js';
import { record as recordHistory, list as listHistory, clear as clearHistory, describeHistory } from '../core/history.js';
import { BUILT_IN_MODES } from '../core/modes.js';
import { defaultProfiles, validateProfile, upsertProfile, removeProfile } from '../core/profiles.js';
import { validateCustomMode, validatePrompt } from '../core/custom-modes.js';
import { addFavourite, removeFavourite, isValidModelId, decorateFavourites, recordUse } from '../core/favourites.js';
import { capabilitiesFor } from '../core/model-compat.js';
import { addWord, removeWord } from '../core/dictionary.js';
import { exportToText, planImport, applyImport } from '../core/transfer.js';
import { getConsents, setConsent } from '../core/context-consent.js';

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
});

// A tab-session shutdown lasts for the tab, not for ever.
chrome.tabs?.onRemoved?.addListener(tabId => clearTabShutdown(tabId));
chrome.tabs?.onReplaced?.addListener((added, removed) => clearTabShutdown(removed));

/**
 * Requests that are only permitted while the extension is running, or when the
 * user explicitly asked for them from the settings page.
 */
async function requireEnabled(message, sender, { allowUserInitiated = false } = {}) {
  const settings = await getSettings();
  if (allowUserInitiated && message?.userInitiated === true) return settings;
  const gate = await isAllowed(
    { origin: message?.origin || originOf(sender), tabId: sender?.tab?.id },
    { settings }
  );
  if (!gate.allowed) {
    const error = new Error(gate.reason);
    error.code = `shutdown_${gate.blockedBy}`;
    throw error;
  }
  return settings;
}

function originOf(sender) {
  if (sender?.origin) return sender.origin;
  if (sender?.tab?.url) { try { return new URL(sender.tab.url).origin; } catch { return null; } }
  return null;
}

function fail(message, code = 'invalid', extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  throw error;
}

function withoutKey(settings) {
  const { apiKey, ...safe } = settings || {};
  return { settings: safe, hasKey: Boolean(apiKey) };
}

async function ensureProfiles() {
  const stored = await getCollection(STORAGE_KEYS.PROFILES, []);
  if (Array.isArray(stored) && stored.length) return stored;
  const seeded = defaultProfiles();
  await setCollection(STORAGE_KEYS.PROFILES, seeded);
  return seeded;
}

async function loadSnapshot(origin, tabId) {
  const settings = await getSettings();
  const { apiKey, ...safe } = settings;
  const gate = await isAllowed({ origin, tabId }, { settings });
  const profiles = await ensureProfiles();
  const customModes = await getCollection(STORAGE_KEYS.MODES, []);
  const prompts = await getCollection(STORAGE_KEYS.PROMPTS, []);
  const dictionary = await getCollection(STORAGE_KEYS.DICTIONARY, []);
  const favouriteModels = await getCollection(STORAGE_KEYS.FAVOURITE_MODELS, []);
  const historyEntries = await listHistory({ settings });
  const consents = await getConsents();
  // Capabilities come from the cache only. Reading the network here would
  // issue a request every time the panel opens — including while the
  // extension is switched off, which the zero-call guarantee forbids.
  const { models: cachedModels } = await getCachedCatalogue().catch(() => ({ models: [] }));
  const favourites = decorateFavourites(
    Array.isArray(favouriteModels) ? favouriteModels : [],
    cachedModels,
    { currentModel: settings.model }
  );
  const defaultEntry = cachedModels.find(m => m.id === settings.model);
  const defaultCaps = defaultEntry ? capabilitiesFor(defaultEntry) : null;
  return {
    settings: safe,
    hasKey: Boolean(apiKey),
    shutdown: {
      global: settings.enabled === false,
      website: (await getSiteShutdowns()).includes(normaliseOrigin(origin)),
      tab: isTabShutdown(tabId),
      allowed: gate.allowed,
      blockedBy: gate.blockedBy,
      reason: gate.reason
    },
    profiles,
    modes: [...BUILT_IN_MODES, ...(Array.isArray(customModes) ? customModes : [])],
    prompts: Array.isArray(prompts) ? prompts : [],
    dictionary: Array.isArray(dictionary) ? dictionary : [],
    favourites,
    modelCapabilities: {
      id: settings.model,
      known: Boolean(defaultCaps),
      supportsResearch: defaultCaps ? defaultCaps.tools : null,
      contextLength: defaultCaps?.contextLength ?? null
    },
    catalogueCached: cachedModels.length > 0,
    history: describeHistory(settings, historyEntries),
    historyEntries,
    consents
  };
}

const handlers = {
  [MESSAGES.RUN_TASK]: async (msg, sender) => {
    const settings = await requireEnabled(msg, sender);
    // Record which favourite was used so the in-widget selector can order by
    // recency. Best effort: usage accounting must never break a request.
    const usedModel = msg.payload?.model || settings.model;
    if (usedModel) {
      try {
        const current = await getCollection(STORAGE_KEYS.FAVOURITE_MODELS, []);
        const idOf = f => (typeof f === 'string' ? f : f?.id);
        const before = Array.isArray(current) ? current.find(f => idOf(f) === usedModel) : null;
        const next = recordUse(current, usedModel);
        const after = next.find(f => f.id === usedModel);
        if (after && after.useCount !== (Number(before?.useCount) || 0)) {
          await setCollection(STORAGE_KEYS.FAVOURITE_MODELS, next);
        }
      } catch { /* usage is advisory */ }
    }
    return runTask({ ...msg.payload, origin: msg.payload?.origin || originOf(sender) }, { sender });
  },

  [MESSAGES.CANCEL_TASK]: async msg => (msg.requestId ? cancelTask(msg.requestId) : cancelAll()),

  [MESSAGES.TEST_CONNECTION]: async (msg, sender) => {
    await requireEnabled(msg, sender, { allowUserInitiated: true });
    const result = await testConnection(msg.settings);
    // A successful key test is an explicit user action, so warming the model
    // catalogue here is within the user's request — and it means capability
    // badges and researched review work immediately after onboarding.
    try { await getCatalogue({ force: true }); } catch { /* advisory only */ }
    return result;
  },
  [MESSAGES.LIST_MODELS]: async (msg, sender) => {
    await requireEnabled(msg, sender, { allowUserInitiated: true });
    return getCatalogue(msg.options || {});
  },

  [MESSAGES.GET_STATE]: async (msg, sender) => loadSnapshot(msg.origin || originOf(sender), msg.tabId ?? sender?.tab?.id),

  [MESSAGES.SET_SETTINGS]: async msg => {
    const patch = msg.patch && typeof msg.patch === 'object' ? msg.patch : {};
    const next = await setSettings(patch);
    return withoutKey(next);
  },

  [MESSAGES.SET_SHUTDOWN]: async (msg, sender) => {
    const result = await setShutdown({
      scope: msg.scope,
      value: msg.value,
      origin: msg.origin || originOf(sender),
      tabId: sender?.tab?.id ?? msg.tabId
    });
    if (msg.value) cancelAll();
    return result;
  },

  [MESSAGES.SAVE_PROFILE]: async msg => {
    const existing = await ensureProfiles();
    const checked = validateProfile(msg.profile || {});
    if (!checked.ok) fail(checked.errors[0] || 'That profile is not valid.', 'invalid_profile', { errors: checked.errors });
    const profiles = upsertProfile(existing, checked.profile);
    await setCollection(STORAGE_KEYS.PROFILES, profiles);
    return { profiles, warnings: checked.warnings };
  },

  [MESSAGES.DELETE_PROFILE]: async msg => {
    const profiles = removeProfile(await ensureProfiles(), msg.id);
    await setCollection(STORAGE_KEYS.PROFILES, profiles);
    return { profiles };
  },

  [MESSAGES.SAVE_MODE]: async msg => {
    const existing = await getCollection(STORAGE_KEYS.MODES, []);
    const checked = validateCustomMode(msg.mode || {}, { existing });
    if (!checked.ok) fail(checked.errors[0] || 'That mode is not valid.', 'invalid_mode', { errors: checked.errors });
    const list = Array.isArray(existing) ? [...existing] : [];
    const index = list.findIndex(m => m.id === checked.mode.id);
    if (index >= 0) list[index] = checked.mode;
    else list.push(checked.mode);
    await setCollection(STORAGE_KEYS.MODES, list);
    return { modes: [...BUILT_IN_MODES, ...list], warnings: checked.warnings };
  },

  [MESSAGES.DELETE_MODE]: async msg => {
    if (BUILT_IN_MODES.some(m => m.id === msg.id)) fail('Built-in modes cannot be deleted.', 'built_in');
    const existing = await getCollection(STORAGE_KEYS.MODES, []);
    const list = (Array.isArray(existing) ? existing : []).filter(m => m.id !== msg.id);
    await setCollection(STORAGE_KEYS.MODES, list);
    return { modes: [...BUILT_IN_MODES, ...list] };
  },

  [MESSAGES.SAVE_PROMPT]: async msg => {
    const existing = await getCollection(STORAGE_KEYS.PROMPTS, []);
    const checked = validatePrompt(msg.prompt || {}, { existing: Array.isArray(existing) ? existing : [] });
    if (!checked.ok) fail(checked.errors[0] || 'That prompt is not valid.', 'invalid_prompt', { errors: checked.errors });
    const list = Array.isArray(existing) ? [...existing] : [];
    const index = list.findIndex(p => p.id === checked.prompt.id);
    if (index >= 0) list[index] = checked.prompt;
    else list.push(checked.prompt);
    await setCollection(STORAGE_KEYS.PROMPTS, list);
    return { prompts: list };
  },

  [MESSAGES.DELETE_PROMPT]: async msg => {
    const existing = await getCollection(STORAGE_KEYS.PROMPTS, []);
    const prompts = (Array.isArray(existing) ? existing : []).filter(p => p.id !== msg.id);
    await setCollection(STORAGE_KEYS.PROMPTS, prompts);
    return { prompts };
  },

  [MESSAGES.SET_FAVOURITES]: async msg => {
    if (Array.isArray(msg.favourites)) {
      const invalid = msg.favourites.find(f => !isValidModelId(typeof f === 'string' ? f : f?.id));
      if (invalid) fail('A favourite was not a valid OpenRouter model id.', 'invalid_model');
      await setCollection(STORAGE_KEYS.FAVOURITE_MODELS, msg.favourites);
      return { favourites: msg.favourites };
    }
    const current = await getCollection(STORAGE_KEYS.FAVOURITE_MODELS, []);
    if (msg.add) {
      const result = addFavourite(current, msg.add);
      if (!result.ok) fail(result.error, 'invalid_favourite');
      await setCollection(STORAGE_KEYS.FAVOURITE_MODELS, result.favourites);
      return { favourites: result.favourites };
    }
    if (msg.remove) {
      const favourites = removeFavourite(current, msg.remove);
      await setCollection(STORAGE_KEYS.FAVOURITE_MODELS, favourites);
      return { favourites };
    }
    return { favourites: current };
  },

  [MESSAGES.ADD_DICTIONARY]: async msg => {
    const current = await getCollection(STORAGE_KEYS.DICTIONARY, []);
    const result = addWord(current, msg.word, msg.options || {});
    if (!result.ok) fail(result.error, 'invalid_word');
    await setCollection(STORAGE_KEYS.DICTIONARY, result.dictionary);
    return { dictionary: result.dictionary };
  },

  [MESSAGES.REMOVE_DICTIONARY]: async msg => {
    const current = await getCollection(STORAGE_KEYS.DICTIONARY, []);
    const dictionary = removeWord(current, msg.word, msg.options || {});
    await setCollection(STORAGE_KEYS.DICTIONARY, dictionary);
    return { dictionary };
  },

  [MESSAGES.SET_CONSENT]: async msg => {
    const consents = await setConsent(msg.host, Boolean(msg.allowed));
    return { consents };
  },

  [MESSAGES.EXPORT_SETTINGS]: async () => {
    const settings = await getSettings();
    const state = {
      settings,
      profiles: await getCollection(STORAGE_KEYS.PROFILES, []),
      customModes: await getCollection(STORAGE_KEYS.MODES, []),
      promptTemplates: await getCollection(STORAGE_KEYS.PROMPTS, []),
      dictionary: await getCollection(STORAGE_KEYS.DICTIONARY, []),
      favouriteModels: await getCollection(STORAGE_KEYS.FAVOURITE_MODELS, [])
    };
    return exportToText(state);
  },

  [MESSAGES.IMPORT_SETTINGS]: async msg => {
    const current = {
      [STORAGE_KEYS.SETTINGS]: await getSettings(),
      [STORAGE_KEYS.PROFILES]: await getCollection(STORAGE_KEYS.PROFILES, []),
      [STORAGE_KEYS.MODES]: await getCollection(STORAGE_KEYS.MODES, []),
      [STORAGE_KEYS.PROMPTS]: await getCollection(STORAGE_KEYS.PROMPTS, []),
      [STORAGE_KEYS.DICTIONARY]: await getCollection(STORAGE_KEYS.DICTIONARY, []),
      [STORAGE_KEYS.FAVOURITE_MODELS]: await getCollection(STORAGE_KEYS.FAVOURITE_MODELS, [])
    };
    const planned = planImport(String(msg.text || ''), current);
    if (!planned.ok) fail(planned.errors[0] || 'That file could not be imported.', 'invalid_import', { errors: planned.errors });
    if (!msg.confirm) return { needsConfirm: true, summary: planned.summary, warnings: planned.warnings };
    await applyImport(planned.plan);
    return { applied: true, summary: planned.summary, warnings: planned.warnings };
  },

  [MESSAGES.HISTORY_ADD]: async msg => recordHistory(msg.entry || {}),
  [MESSAGES.HISTORY_LIST]: async () => listHistory(),
  [MESSAGES.HISTORY_CLEAR]: async () => clearHistory(),

  [MESSAGES.OPEN_OPTIONS]: async () => { chrome.runtime.openOptionsPage(); return { ok: true }; }
};

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const handler = handlers[message?.type];
  if (!handler) return false;
  Promise.resolve(handler(message, sender))
    .then(result => respond({ ok: true, result }))
    .catch(error => respond({ ok: false, error: serialiseError(error) }));
  return true;
});

function serialiseError(error) {
  return {
    message: error?.message || String(error),
    code: error?.code || 'unknown',
    retryable: Boolean(error?.retryable)
  };
}

