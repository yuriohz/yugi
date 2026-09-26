/**
 * Storage layer.
 *
 * All persisted state lives in `chrome.storage.local`. Nothing is synchronised,
 * because the API key must not leave the device through Chrome Sync.
 *
 * The module is written against an injectable storage area so it can be unit
 * tested without a browser.
 */
import { SCHEMA_VERSION, DEFAULT_ENDPOINT, DEFAULT_MODEL, DEFAULT_LOCALE, STORAGE_KEYS, LIMITS } from './constants.js';

/** @returns {object} a fresh default settings object. */
export function defaultSettings() {
  return {
    schemaVersion: SCHEMA_VERSION,
    provider: 'openrouter',
    endpoint: DEFAULT_ENDPOINT,
    apiKey: '',
    model: DEFAULT_MODEL,
    locale: DEFAULT_LOCALE,
    enabled: true,
    onboardingComplete: false,
    activeProfileId: 'personal',
    defaultModeId: 'polish',
    research: {
      enabled: false,
      maxResults: 5,
      showCost: true
    },
    context: {
      // Nearby conversation capture is opt-in, per the product contract.
      nearbyEnabled: false,
      maxMessages: 6
    },
    history: {
      // Local history is off by default and expires.
      enabled: false,
      ttlMs: LIMITS.HISTORY_TTL_MS,
      maxEntries: LIMITS.HISTORY_MAX_ENTRIES
    },
    ui: {
      showBadge: true,
      inlineUnderlines: true,
      reducedMotion: false
    }
  };
}

/** In-memory storage area used by tests and as a fallback. */
export class MemoryStorageArea {
  constructor(initial = {}) { this._data = structuredClone(initial); }
  async get(defaults) {
    if (defaults == null) return structuredClone(this._data);
    if (typeof defaults === 'string') {
      return { [defaults]: structuredClone(this._data[defaults]) };
    }
    if (Array.isArray(defaults)) {
      const out = {};
      for (const k of defaults) if (k in this._data) out[k] = structuredClone(this._data[k]);
      return out;
    }
    const out = {};
    for (const [k, v] of Object.entries(defaults)) {
      out[k] = k in this._data ? structuredClone(this._data[k]) : structuredClone(v);
    }
    return out;
  }
  async set(values) { Object.assign(this._data, structuredClone(values)); }
  async remove(keys) { for (const k of [].concat(keys)) delete this._data[k]; }
  async clear() { this._data = {}; }
}

function resolveArea(area) {
  if (area) return area;
  if (typeof chrome !== 'undefined' && chrome?.storage?.local) return chrome.storage.local;
  throw new Error('No storage area available');
}

/** Deep merge that never walks prototype keys. */
export function safeMerge(base, patch) {
  if (patch == null || typeof patch !== 'object') return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (value && typeof value === 'object' && !Array.isArray(value)
        && out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) {
      out[key] = safeMerge(out[key], value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Migrate a v1 settings blob (flat keys, `language: 'English'`) to v2.
 * Idempotent: running it on a v2 object returns the object unchanged.
 */
export function migrateSettings(raw) {
  if (!raw || typeof raw !== 'object') return defaultSettings();
  if (raw.schemaVersion === SCHEMA_VERSION) return safeMerge(defaultSettings(), raw);

  const migrated = safeMerge(defaultSettings(), {
    provider: raw.provider,
    endpoint: raw.endpoint,
    apiKey: raw.apiKey,
    model: raw.model,
    enabled: raw.enabled,
    onboardingComplete: raw.onboardingComplete
  });

  // v1 stored a free-text language name. Map it onto a locale, defaulting to
  // British English per the product contract.
  const language = String(raw.language || '').toLowerCase();
  if (language.includes('arab') || language.includes('عرب')) migrated.locale = 'ar';
  else if (language.includes('american') || language === 'english (us)') migrated.locale = 'en-US';
  else migrated.locale = DEFAULT_LOCALE;

  migrated.schemaVersion = SCHEMA_VERSION;
  return migrated;
}

export async function getSettings(area) {
  const store = resolveArea(area);
  const raw = await store.get({ [STORAGE_KEYS.SETTINGS]: null, ...legacyKeys() });
  const stored = raw[STORAGE_KEYS.SETTINGS];
  if (stored) return safeMerge(defaultSettings(), stored);
  // No v2 blob yet: build one from any v1 flat keys present.
  return migrateSettings(pickLegacy(raw));
}

export async function setSettings(patch, area) {
  const store = resolveArea(area);
  const next = safeMerge(await getSettings(store), patch);
  next.schemaVersion = SCHEMA_VERSION;
  await store.set({ [STORAGE_KEYS.SETTINGS]: next });
  return next;
}

function legacyKeys() {
  return { provider: undefined, endpoint: undefined, apiKey: undefined, model: undefined, language: undefined, enabled: undefined, onboardingComplete: undefined };
}

function pickLegacy(raw) {
  const out = {};
  for (const key of Object.keys(legacyKeys())) if (raw[key] !== undefined) out[key] = raw[key];
  return Object.keys(out).length ? out : null;
}

/** Generic collection helpers used by profiles, modes, prompts and favourites. */
export async function getCollection(key, fallback, area) {
  const store = resolveArea(area);
  const raw = await store.get({ [key]: fallback });
  const value = raw[key];
  return value === undefined || value === null ? fallback : value;
}

export async function setCollection(key, value, area) {
  const store = resolveArea(area);
  await store.set({ [key]: value });
  return value;
}
