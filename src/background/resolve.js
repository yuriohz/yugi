/**
 * Resolve the runtime context for a task: which mode, which profile, which
 * locale layer, and which platform constraints apply.
 *
 * Kept separate from the router so it can be unit tested without a transport.
 */
import { STORAGE_KEYS } from '../core/constants.js';
import { getCollection } from '../core/storage.js';
import { BUILT_IN_MODES, getBuiltInMode } from '../core/modes.js';

/**
 * Storage may be unavailable (no browser, or a locked profile). Custom
 * collections are then treated as empty rather than failing the whole task,
 * because built-in modes must keep working.
 */
async function safeCollection(key, area) {
  try {
    const value = await getCollection(key, [], area);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/** @returns {Promise<object|null>} */
export async function resolveMode(modeId, { area, customModes } = {}) {
  if (!modeId) return null;
  const builtIn = getBuiltInMode(modeId);
  if (builtIn) return builtIn;
  const custom = customModes || await safeCollection(STORAGE_KEYS.MODES, area);
  return custom.find(m => m.id === modeId) || null;
}

export async function listModes({ area, customModes } = {}) {
  const custom = customModes || await safeCollection(STORAGE_KEYS.MODES, area);
  return [...BUILT_IN_MODES, ...custom];
}

/** @returns {Promise<object|null>} */
export async function resolveProfile(profileId, { area, profiles, settings } = {}) {
  const all = profiles || await safeCollection(STORAGE_KEYS.PROFILES, area);
  const wanted = profileId || settings?.activeProfileId;
  return all.find(p => p.id === wanted) || all[0] || null;
}

/**
 * Site rules on a profile can pin a mode or another profile per origin, for
 * example Work on Gmail and Personal on WhatsApp.
 */
export function applySiteRules(profile, origin) {
  if (!profile?.siteRules?.length || !origin) return { modeId: null, profileId: null };
  let host = origin;
  try { host = new URL(origin).host; } catch { /* already a host */ }
  const rule = profile.siteRules.find(r => r.host && host.endsWith(r.host));
  return { modeId: rule?.modeId || null, profileId: rule?.profileId || null };
}
