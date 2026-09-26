/**
 * Favourite OpenRouter models.
 *
 * The in-widget selector must be fast and must not lie: it shows the model's
 * real capabilities from the catalogue, and marks a favourite as unavailable
 * rather than hiding it, so the user understands why a model disappeared.
 */
import { capabilitiesFor } from './model-compat.js';

export const FAVOURITES_LIMIT = 20;

export function makeFavourite(input) {
  const id = typeof input === 'string' ? input : String(input?.id ?? '');
  return {
    id: id.trim().slice(0, 120),
    label: String((typeof input === 'object' && input?.label) || '').trim().slice(0, 60),
    addedAt: Number(input?.addedAt) || Date.now(),
    useCount: Number(input?.useCount) || 0,
    lastUsedAt: Number(input?.lastUsedAt) || 0
  };
}

/** OpenRouter model ids are `vendor/model` with optional `:variant`. */
export function isValidModelId(id) {
  return /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(?::[a-z0-9-]+)*$/i.test(String(id ?? '').trim());
}

export function addFavourite(favourites, input) {
  const favourite = makeFavourite(input);
  if (!favourite.id) return { ok: false, favourites: list(favourites), error: 'Choose a model first.' };
  if (!isValidModelId(favourite.id)) {
    return { ok: false, favourites: list(favourites), error: `“${favourite.id}” is not a valid OpenRouter model id. Ids look like vendor/model.` };
  }
  const current = list(favourites);
  if (current.some(f => f.id === favourite.id)) {
    return { ok: false, favourites: current, error: 'That model is already a favourite.' };
  }
  if (current.length >= FAVOURITES_LIMIT) {
    return { ok: false, favourites: current, error: `You can keep up to ${FAVOURITES_LIMIT} favourites. Remove one first.` };
  }
  return { ok: true, favourites: [...current, favourite], error: '' };
}

export function removeFavourite(favourites, id) {
  return list(favourites).filter(f => f.id !== id);
}

export function reorderFavourites(favourites, fromIndex, toIndex) {
  const current = list(favourites);
  if (fromIndex < 0 || fromIndex >= current.length || toIndex < 0 || toIndex >= current.length) return current;
  const next = [...current];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function renameFavourite(favourites, id, label) {
  return list(favourites).map(f => (f.id === id ? { ...f, label: String(label ?? '').trim().slice(0, 60) } : f));
}

export function recordUse(favourites, id, now = Date.now()) {
  return list(favourites).map(f => (f.id === id ? { ...f, useCount: f.useCount + 1, lastUsedAt: now } : f));
}

/**
 * Join favourites against the catalogue for display.
 *
 * A favourite that is no longer in the catalogue is kept and marked
 * unavailable, because silently dropping it would leave the user wondering
 * where their model went.
 */
export function decorateFavourites(favourites, catalogue = [], { currentModel = null } = {}) {
  const byId = new Map(catalogue.map(m => [m.id, m]));
  return list(favourites).map(favourite => {
    const entry = byId.get(favourite.id);
    const caps = entry ? capabilitiesFor(entry) : null;
    return {
      ...favourite,
      available: Boolean(entry),
      displayName: favourite.label || caps?.name || favourite.id,
      capabilities: caps,
      selected: favourite.id === currentModel,
      unavailableReason: entry ? '' : 'This model is not in the current OpenRouter catalogue. It may have been renamed or withdrawn.',
      supportsResearch: caps ? caps.tools : null,
      contextLength: caps?.contextLength ?? null
    };
  });
}

/**
 * Suggest favourites for a first-time user, filtered against the live
 * catalogue so nothing is offered that cannot actually be selected.
 */
export const SUGGESTED = Object.freeze([
  { id: 'openai/gpt-4o-mini', label: 'Fast and cheap' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Careful editing' },
  { id: 'google/gemini-2.0-flash-001', label: 'Long documents' }
]);

export function suggestions(catalogue = [], favourites = []) {
  const have = new Set(list(favourites).map(f => f.id));
  const ids = new Set(catalogue.map(m => m.id));
  return SUGGESTED.filter(s => !have.has(s.id) && (!catalogue.length || ids.has(s.id)));
}

/** Most-used first, then most-recently used, then insertion order. */
export function sortByUse(favourites) {
  return list(favourites).slice().sort((a, b) =>
    b.useCount - a.useCount || b.lastUsedAt - a.lastUsedAt || a.addedAt - b.addedAt);
}

function list(favourites) {
  return (Array.isArray(favourites) ? favourites : []).map(makeFavourite).filter(f => f.id);
}
