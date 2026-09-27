/**
 * Model catalogue with a cache and an offline fallback.
 *
 * The catalogue is advisory. A failure here must never stop a rewrite, so every
 * path degrades to "capabilities unknown" rather than throwing.
 */
import { STORAGE_KEYS } from '../core/constants.js';
import { getCollection, setCollection } from '../core/storage.js';
import { fallbackCatalogueFor, getProvider } from '../core/providers.js';
import { FALLBACK_NOTICE } from '../core/model-compat.js';
import { listModels } from './openrouter.js';

const cacheKey = provider => getProvider(provider).id === 'openrouter' ? STORAGE_KEYS.MODEL_CACHE : `${STORAGE_KEYS.MODEL_CACHE}:${getProvider(provider).id}`;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * @returns {Promise<{models: object[], source: 'network'|'cache'|'fallback', notice: string}>}
 */
export async function getCatalogue({ provider = 'openrouter', apiKey = '', fetchImpl, area, now = Date.now, force = false } = {}) {
  const cached = await getCollection(cacheKey(provider), null, area).catch(() => null);
  if (!force && cached?.models?.length && now() - (cached.fetchedAt || 0) < CACHE_TTL_MS) {
    return { models: cached.models, source: 'cache', notice: '' };
  }

  const result = await listModels({ fetchImpl, provider, apiKey });
  if (result.ok && result.models.length) {
    const models = result.models.map(trimEntry);
    await setCollection(cacheKey(provider), { fetchedAt: now(), models }, area).catch(() => {});
    return { models, source: 'network', notice: '' };
  }

  if (cached?.models?.length) {
    return { models: cached.models, source: 'cache', notice: 'Showing the last catalogue WordSaffron downloaded. It may be out of date.' };
  }
  return { models: fallbackCatalogueFor(provider).map(trimEntry), source: 'fallback', notice: FALLBACK_NOTICE.replace('OpenRouter', getProvider(provider).name) };
}

/** Keep only what WordSaffron needs, so the cache stays small. */
function trimEntry(model) {
  return {
    id: model.id,
    name: model.name || model.id,
    context_length: model.context_length ?? null,
    supported_parameters: model.supported_parameters || [],
    architecture: model.architecture ? { modality: model.architecture.modality } : undefined,
    pricing: model.pricing
      ? { prompt: model.pricing.prompt, completion: model.pricing.completion, web_search: model.pricing.web_search }
      : undefined
  };
}

/**
 * Read the catalogue cache without touching the network.
 *
 * Used when building UI state: the snapshot must never issue a request on its
 * own, or opening the panel while WordSaffron is switched off would break the
 * zero-call guarantee. An empty cache means capabilities are unknown, which
 * the UI states honestly instead of guessing.
 *
 * @returns {Promise<{models: object[], fetchedAt: number}>}
 */
export async function getCachedCatalogue({ area, provider = 'openrouter' } = {}) {
  const cached = await getCollection(cacheKey(provider), null, area).catch(() => null);
  if (cached?.models?.length) return { models: cached.models, fetchedAt: cached.fetchedAt || 0 };
  return { models: [], fetchedAt: 0 };
}

/** @returns {Promise<object|null>} the raw catalogue entry, or null when unknown. */
export async function getModelCapabilities(modelId, options = {}) {
  if (!modelId) return null;
  const { models } = await getCatalogue(options);
  return models.find(m => m.id === modelId) || null;
}
