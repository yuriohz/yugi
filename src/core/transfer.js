import { isKnownProvider } from './providers.js';
/**
 * Settings import and export.
 *
 * Hard rules, enforced here and asserted by the tests:
 *   1. an export never contains an API key, or anything that looks like one
 *   2. an export never contains the user's drafts, history, or page text
 *   3. an import never writes an API key, whatever the file says
 *   4. an import is validated field by field; unknown fields are dropped
 *   5. an import reports exactly what it will change before it changes it
 */
import { SCHEMA_VERSION, STORAGE_KEYS, LIMITS } from './constants.js';
import { validateProfile } from './profiles.js';
import { validateCustomMode, validatePrompt } from './custom-modes.js';
import { redactSecrets } from './untrusted.js';
import { stripDangerousKeys } from './json.js';

export const EXPORT_FORMAT = 'writeright.settings';
export const EXPORT_VERSION = 2;

/** Keys that must never appear in an export, at any depth. */
export const FORBIDDEN_EXPORT_KEYS = Object.freeze([
  'apikey', 'api_key', 'key', 'token', 'secret', 'password', 'authorization',
  'bearer', 'credential', 'history', 'drafts', 'clipboard'
]);

/**
 * Build an export payload.
 *
 * @param {object} state { settings, profiles, customModes, promptTemplates, dictionary, favouriteModels }
 * @returns {{payload: object, warnings: string[]}}
 */
export function buildExport(state = {}) {
  const warnings = [];
  const settings = { ...(state.settings || {}) };

  // Explicitly drop the credential rather than relying on the key filter.
  delete settings.apiKey;

  const payload = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    // Stated in the file itself, so anyone who opens it can see the promise.
    notice: 'This file contains WriteRight settings only. It does not contain your API key, your drafts, or any text from the pages you visited.',
    settings: {
      provider: settings.provider || 'openrouter',
      endpoint: settings.endpoint,
      model: settings.model,
      locale: settings.locale,
      defaultModeId: settings.defaultModeId,
      activeProfileId: settings.activeProfileId,
      research: settings.research,
      context: settings.context,
      ui: settings.ui,
      // The history *preference* travels under a distinct name; "history" is
      // on the forbidden list precisely so history contents can never leak.
      historyPreferences: settings.history
        ? { enabled: Boolean(settings.history.enabled), ttlMs: settings.history.ttlMs, maxEntries: settings.history.maxEntries }
        : undefined
    },
    profiles: state.profiles || [],
    customModes: (state.customModes || []).filter(m => !m.builtIn),
    promptTemplates: state.promptTemplates || [],
    dictionary: state.dictionary || [],
    favouriteModels: state.favouriteModels || []
  };

  // Redaction runs per string value, never over the serialised document: a
  // 13-digit timestamp is not a card number, and rewriting the JSON text would
  // corrupt the file.
  const redactions = { count: 0 };
  const scrubbed = scrub(payload, warnings, '', redactions);
  if (redactions.count > 0) {
    warnings.push(`${redactions.count} value${redactions.count === 1 ? '' : 's'} that looked like a credential ${redactions.count === 1 ? 'was' : 'were'} removed from the export.`);
  }
  return { payload: scrubbed, warnings };
}

/** Recursively remove forbidden keys and redact credential-shaped strings. */
function scrub(value, warnings, path = '', redactions = { count: 0 }) {
  if (Array.isArray(value)) return value.map((v, i) => scrub(v, warnings, `${path}[${i}]`, redactions));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, sub] of Object.entries(value)) {
      if (sub === undefined) continue;
      if (FORBIDDEN_EXPORT_KEYS.includes(key.toLowerCase())) {
        warnings.push(`“${path ? `${path}.` : ''}${key}” was excluded from the export.`);
        continue;
      }
      out[key] = scrub(sub, warnings, path ? `${path}.${key}` : key, redactions);
    }
    return out;
  }
  if (typeof value === 'string') {
    const result = redactSecrets(value);
    redactions.count += result.redactions;
    return result.text;
  }
  return value;
}

export function exportToText(state) {
  const { payload, warnings } = buildExport(state);
  return { text: `${JSON.stringify(payload, null, 2)}\n`, warnings };
}

/**
 * Parse and validate an import file. This does not write anything: it returns
 * the changes so the user can confirm them first.
 *
 * @returns {{ok: boolean, errors: string[], warnings: string[], plan: object|null, summary: object|null}}
 */
export function planImport(text, current = {}) {
  const errors = [];
  const warnings = [];

  if (typeof text !== 'string' || !text.trim()) {
    return fail(['The file is empty.']);
  }
  if (text.length > LIMITS.MAX_IMPORT_BYTES) {
    return fail([`That file is ${Math.round(text.length / 1024)} kB. The limit is ${Math.round(LIMITS.MAX_IMPORT_BYTES / 1024)} kB.`]);
  }

  let parsed;
  try {
    parsed = stripDangerousKeys(JSON.parse(text));
  } catch {
    return fail(['That file is not valid JSON.']);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fail(['That file does not contain WriteRight settings.']);
  }
  if (parsed.format !== EXPORT_FORMAT) {
    return fail([`That file is not a WriteRight settings export (format: ${String(parsed.format || 'missing')}).`]);
  }
  if (Number(parsed.version) > EXPORT_VERSION) {
    return fail([`That file was written by a newer version of WriteRight (file version ${parsed.version}, this build reads ${EXPORT_VERSION}).`]);
  }

  // Rule 3: an import can never set a credential, whatever the file contains.
  if (containsKey(parsed, 'apiKey') || containsKey(parsed, 'api_key')) {
    warnings.push('The file contained an API key field. It was ignored. WriteRight never imports credentials.');
  }

  const plan = {};
  const summary = { settings: 0, profiles: 0, customModes: 0, promptTemplates: 0, dictionary: 0, favouriteModels: 0 };

  const settings = importSettings(parsed.settings, warnings);
  if (Object.keys(settings).length) {
    plan[STORAGE_KEYS.SETTINGS] = settings;
    summary.settings = Object.keys(settings).length;
  }

  const profiles = [];
  for (const raw of arrayOf(parsed.profiles)) {
    const result = validateProfile(raw);
    if (!result.ok) { warnings.push(`A profile was skipped: ${result.errors[0]}`); continue; }
    warnings.push(...result.warnings);
    profiles.push(result.profile);
  }
  if (profiles.length) { plan[STORAGE_KEYS.PROFILES] = profiles; summary.profiles = profiles.length; }

  // Custom modes and saved prompts pass the same forbidden-instruction check
  // as the settings form, so a hostile file cannot smuggle in an instruction
  // the UI would refuse. Offenders are skipped with a warning, never imported.
  const modes = [];
  for (const raw of arrayOf(parsed.customModes).slice(0, 50)) {
    const result = validateCustomMode({ ...(raw && typeof raw === 'object' ? raw : {}), builtIn: false }, { existing: modes });
    if (!result.ok) { warnings.push(`A custom mode was skipped: ${result.errors[0]}`); continue; }
    warnings.push(...result.warnings);
    modes.push(result.mode);
  }
  if (modes.length) { plan[STORAGE_KEYS.MODES] = modes; summary.customModes = modes.length; }

  const prompts = [];
  for (const raw of arrayOf(parsed.promptTemplates).slice(0, 100)) {
    const result = validatePrompt(raw && typeof raw === 'object' ? raw : {}, { existing: prompts });
    if (!result.ok) { warnings.push(`A saved prompt was skipped: ${result.errors[0]}`); continue; }
    prompts.push(result.prompt);
  }
  if (prompts.length) { plan[STORAGE_KEYS.PROMPTS] = prompts; summary.promptTemplates = prompts.length; }

  const dictionary = arrayOf(parsed.dictionary)
    .filter(e => e && typeof e.word === 'string' && e.word.trim())
    .map(e => ({ word: String(e.word).trim().slice(0, 80), scope: e.scope || 'global', scopeId: e.scopeId || null, caseSensitive: Boolean(e.caseSensitive), note: String(e.note || '').slice(0, 200), addedAt: Number(e.addedAt) || Date.now() }))
    .slice(0, 2000);
  if (dictionary.length) { plan[STORAGE_KEYS.DICTIONARY] = dictionary; summary.dictionary = dictionary.length; }

  const favourites = arrayOf(parsed.favouriteModels)
    .filter(f => typeof f === 'string' || (f && typeof f.id === 'string'))
    .map(f => (typeof f === 'string' ? { id: f } : { id: f.id, label: String(f.label || '').slice(0, 60) }))
    .slice(0, 50);
  if (favourites.length) { plan[STORAGE_KEYS.FAVOURITE_MODELS] = favourites; summary.favouriteModels = favourites.length; }

  if (!Object.keys(plan).length) errors.push('That file contained nothing WriteRight could import.');

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    plan: errors.length ? null : plan,
    summary: errors.length ? null : { ...summary, replaces: describeReplacements(plan, current) }
  };
}

const IMPORTABLE_SETTINGS = ['provider', 'endpoint', 'model', 'locale', 'defaultModeId', 'activeProfileId', 'research', 'context', 'ui', 'historyPreferences'];

function importSettings(raw, warnings) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const key of IMPORTABLE_SETTINGS) {
    if (raw[key] === undefined) continue;
    if (key === 'provider' && !isKnownProvider(raw.provider)) {
      warnings.push('Unknown provider was ignored.');
      continue;
    }
    if (key === 'endpoint') {
      const endpoint = String(raw.endpoint);
      if (endpoint && !/^https:\/\//i.test(endpoint)) {
        warnings.push('The endpoint in that file was ignored because it is not an https URL.');
        continue;
      }
      out.endpoint = endpoint.slice(0, 500);
      continue;
    }
    if (key === 'historyPreferences') {
      const prefs = raw.historyPreferences;
      if (prefs && typeof prefs === 'object') {
        out.history = {
          enabled: Boolean(prefs.enabled),
          ttlMs: Number(prefs.ttlMs) || undefined,
          maxEntries: Number(prefs.maxEntries) || undefined
        };
      }
      continue;
    }
    out[key] = raw[key];
  }
  // Belt and braces: never let a credential through under any name.
  delete out.apiKey;
  return out;
}

function describeReplacements(plan, current) {
  const replaced = [];
  for (const key of Object.keys(plan)) {
    const existing = current[key];
    if (Array.isArray(existing) && existing.length) replaced.push(`${existing.length} existing ${label(key)}`);
    else if (existing && typeof existing === 'object' && Object.keys(existing).length) replaced.push(`your current ${label(key)}`);
  }
  return replaced;
}

function label(key) {
  return {
    [STORAGE_KEYS.SETTINGS]: 'settings',
    [STORAGE_KEYS.PROFILES]: 'profiles',
    [STORAGE_KEYS.MODES]: 'custom modes',
    [STORAGE_KEYS.PROMPTS]: 'saved prompts',
    [STORAGE_KEYS.DICTIONARY]: 'dictionary entries',
    [STORAGE_KEYS.FAVOURITE_MODELS]: 'favourite models'
  }[key] || key;
}

function containsKey(value, key, depth = 0) {
  if (depth > 6 || !value || typeof value !== 'object') return false;
  if (!Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, key)) return true;
  return Object.values(value).some(v => containsKey(v, key, depth + 1));
}

function arrayOf(value) { return Array.isArray(value) ? value : []; }

function fail(errors) { return { ok: false, errors, warnings: [], plan: null, summary: null }; }

/** Apply a validated plan. The API key is never touched. */
export async function applyImport(plan, area) {
  if (!plan) throw new Error('There is nothing to import.');
  const safe = { ...plan };
  if (safe[STORAGE_KEYS.SETTINGS]) delete safe[STORAGE_KEYS.SETTINGS].apiKey;
  const { setSettings, setCollection } = await import('./storage.js');
  for (const [key, value] of Object.entries(safe)) {
    if (key === STORAGE_KEYS.SETTINGS) await setSettings(value, area);
    else await setCollection(key, value, area);
  }
  return { applied: Object.keys(safe) };
}
