/**
 * Local history.
 *
 * Rules, in order of importance:
 *   1. off by default
 *   2. never leaves the device
 *   3. expires automatically, and the expiry is enforced on read as well as on
 *      write, so a disabled or dormant extension cannot retain old drafts
 *   4. stores what the user needs to recover a rewrite, not their whole draft
 *   5. credential-shaped strings are redacted before anything is stored
 *   6. one action clears everything
 */
import { STORAGE_KEYS, LIMITS } from './constants.js';
import { getCollection, setCollection, getSettings } from './storage.js';
import { redactSecrets } from './untrusted.js';

/** Text longer than this is stored truncated: history is for recovery, not archiving. */
const MAX_STORED_CHARS = 2000;

export function makeEntry({ task, modeId, original, result, host, model, usage, at = Date.now() }) {
  const originalRedacted = redactSecrets(truncate(original));
  const resultRedacted = redactSecrets(truncate(result));
  return {
    id: `h-${at.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at,
    task: String(task || '').slice(0, 40),
    modeId: modeId ? String(modeId).slice(0, 60) : null,
    // The origin, not the URL: a URL can carry a token or a document title.
    host: hostOf(host),
    model: model ? String(model).slice(0, 120) : null,
    original: originalRedacted.text,
    result: resultRedacted.text,
    truncated: (original || '').length > MAX_STORED_CHARS || (result || '').length > MAX_STORED_CHARS,
    redactions: originalRedacted.redactions + resultRedacted.redactions,
    cost: Number.isFinite(usage?.cost) ? usage.cost : null,
    tokens: Number.isFinite(usage?.totalTokens) ? usage.totalTokens : null
  };
}

function truncate(value) {
  const s = String(value ?? '');
  return s.length > MAX_STORED_CHARS ? `${s.slice(0, MAX_STORED_CHARS)}…` : s;
}

function hostOf(input) {
  if (!input) return null;
  try { return new URL(input.includes('://') ? input : `https://${input}`).host; } catch { return null; }
}

/** Remove anything past its time-to-live or beyond the entry cap. */
export function prune(entries, { ttlMs = LIMITS.HISTORY_TTL_MS, maxEntries = LIMITS.HISTORY_MAX_ENTRIES, now = Date.now() } = {}) {
  const cutoff = now - ttlMs;
  return (Array.isArray(entries) ? entries : [])
    .filter(entry => entry && Number(entry.at) > cutoff)
    .sort((a, b) => b.at - a.at)
    .slice(0, maxEntries);
}

/**
 * Add an entry. A no-op when history is switched off — and, importantly, the
 * store is also pruned on that path, so switching history off does not leave
 * old entries sitting on disk for ever.
 */
export async function record(entryInput, { area, settings } = {}) {
  const resolved = settings || await getSettings(area);
  const config = resolved?.history || {};
  const existing = await getCollection(STORAGE_KEYS.HISTORY, [], area).catch(() => []);

  if (config.enabled !== true) {
    if (existing.length) await setCollection(STORAGE_KEYS.HISTORY, [], area);
    return { stored: false, reason: 'History is switched off.', entries: [] };
  }

  const entries = prune([makeEntry(entryInput), ...existing], {
    ttlMs: config.ttlMs || LIMITS.HISTORY_TTL_MS,
    maxEntries: config.maxEntries || LIMITS.HISTORY_MAX_ENTRIES
  });
  await setCollection(STORAGE_KEYS.HISTORY, entries, area);
  return { stored: true, reason: '', entries };
}

/** Read, pruning on the way out so expiry does not depend on a later write. */
export async function list({ area, settings, now = Date.now() } = {}) {
  const resolved = settings || await getSettings(area);
  const config = resolved?.history || {};
  const stored = await getCollection(STORAGE_KEYS.HISTORY, [], area).catch(() => []);

  if (config.enabled !== true) {
    if (stored.length) await setCollection(STORAGE_KEYS.HISTORY, [], area);
    return [];
  }

  const pruned = prune(stored, {
    ttlMs: config.ttlMs || LIMITS.HISTORY_TTL_MS,
    maxEntries: config.maxEntries || LIMITS.HISTORY_MAX_ENTRIES,
    now
  });
  if (pruned.length !== stored.length) await setCollection(STORAGE_KEYS.HISTORY, pruned, area);
  return pruned;
}

export async function clear(area) {
  await setCollection(STORAGE_KEYS.HISTORY, [], area);
  return { cleared: true };
}

export async function remove(id, area) {
  const stored = await getCollection(STORAGE_KEYS.HISTORY, [], area).catch(() => []);
  const next = stored.filter(entry => entry.id !== id);
  await setCollection(STORAGE_KEYS.HISTORY, next, area);
  return next;
}

/** What the settings page shows about history, in plain words. */
export function describeHistory(settings, entries = []) {
  const config = settings?.history || {};
  if (config.enabled !== true) {
    return {
      enabled: false,
      summary: 'History is off. Nothing you write is being stored.',
      detail: 'When history is on, WriteRight keeps your recent rewrites on this device only, so you can recover one you dismissed.'
    };
  }
  const days = Math.round((config.ttlMs || LIMITS.HISTORY_TTL_MS) / 86_400_000);
  return {
    enabled: true,
    summary: `${entries.length} item${entries.length === 1 ? '' : 's'} stored on this device.`,
    detail: `Entries are deleted after ${days} day${days === 1 ? '' : 's'}, and at most ${config.maxEntries || LIMITS.HISTORY_MAX_ENTRIES} are kept. History never leaves this device and is never included in an export.`
  };
}
