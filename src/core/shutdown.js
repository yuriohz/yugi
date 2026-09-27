/**
 * Shutdown gate.
 *
 * Three independent levels, checked in precedence order before any network call:
 *
 *   global  — user switched the extension off entirely; persisted
 *   website — user switched it off for one origin; persisted
 *   tab     — user switched it off for this tab session; cleared when the tab closes
 *
 * `isAllowed()` is the single authoritative answer. Both the content script and
 * the service worker must call it, and the service worker's check is the one
 * that actually protects the network, because a compromised page cannot reach it.
 */
import { STORAGE_KEYS } from './constants.js';
import { getSettings, setSettings, getCollection, setCollection } from './storage.js';

export const SCOPES = Object.freeze({ GLOBAL: 'global', WEBSITE: 'website', TAB: 'tab' });

/** Tab-session shutdowns live only in memory, keyed by tab id. */
const tabShutdowns = new Set();

export function normaliseOrigin(input) {
  if (!input) return null;
  try {
    const url = input.includes('://') ? new URL(input) : new URL(`https://${input}`);
    // URL() is permissive about hostnames; require something that looks like a
    // real host or an explicit localhost/IP, so rubbish cannot be stored.
    if (!/^(?:\[[0-9a-f:]+\]|localhost|[a-z0-9-]+(?:\.[a-z0-9-]+)+|\d{1,3}(?:\.\d{1,3}){3})$/i.test(url.hostname)) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function setTabShutdown(tabId, value) {
  if (typeof tabId !== 'number') return false;
  if (value) tabShutdowns.add(tabId); else tabShutdowns.delete(tabId);
  return value;
}

export function isTabShutdown(tabId) {
  return typeof tabId === 'number' && tabShutdowns.has(tabId);
}

export function clearTabShutdown(tabId) { tabShutdowns.delete(tabId); }

/** Exposed for tests. */
export function _resetTabShutdowns() { tabShutdowns.clear(); }

export async function getSiteShutdowns(area) {
  const list = await getCollection(STORAGE_KEYS.SITE_SHUTDOWN, [], area);
  return Array.isArray(list) ? list : [];
}

export async function setSiteShutdown(origin, value, area) {
  const normalised = normaliseOrigin(origin);
  if (!normalised) throw new Error('A valid site origin is required.');
  const current = new Set(await getSiteShutdowns(area));
  if (value) current.add(normalised); else current.delete(normalised);
  await setCollection(STORAGE_KEYS.SITE_SHUTDOWN, [...current], area);
  return [...current];
}

/**
 * @returns {Promise<{allowed: boolean, blockedBy: 'global'|'website'|'tab'|null, reason: string}>}
 */
export async function isAllowed({ origin, tabId } = {}, deps = {}) {
  const area = deps.area;
  const settings = deps.settings || await getSettings(area);

  if (settings.enabled === false) {
    return { allowed: false, blockedBy: SCOPES.GLOBAL, reason: 'WordSaffron is switched off everywhere.' };
  }

  const normalised = normaliseOrigin(origin);
  if (normalised) {
    const sites = deps.siteShutdowns || await getSiteShutdowns(area);
    if (sites.includes(normalised)) {
      return { allowed: false, blockedBy: SCOPES.WEBSITE, reason: `WordSaffron is switched off for ${normalised}.` };
    }
  }

  if (isTabShutdown(tabId)) {
    return { allowed: false, blockedBy: SCOPES.TAB, reason: 'WordSaffron is switched off for this tab.' };
  }

  return { allowed: true, blockedBy: null, reason: '' };
}

/** Apply a shutdown change from the UI. */
export async function setShutdown({ scope, value, origin, tabId }, area) {
  switch (scope) {
    case SCOPES.GLOBAL:
      await setSettings({ enabled: !value }, area);
      return { scope, value: Boolean(value) };
    case SCOPES.WEBSITE:
      await setSiteShutdown(origin, value, area);
      return { scope, value: Boolean(value), origin: normaliseOrigin(origin) };
    case SCOPES.TAB:
      setTabShutdown(tabId, Boolean(value));
      return { scope, value: Boolean(value), tabId };
    default:
      throw new Error(`Unknown shutdown scope: ${scope}`);
  }
}
