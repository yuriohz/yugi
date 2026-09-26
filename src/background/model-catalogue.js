/**
 * Model catalogue with a cache and an offline fallback.
 *
 * The catalogue is advisory. A failure here must never stop a rewrite, so every
 * path degrades to "capabilities unknown" rather than throwing.
 */
import { STORAGE_KEYS } from '../core/constants.js';
import { getCollection, setCollection } from '../core/storage.js';
import { FALLBACK_CATALOGUE, FALLBACK_NOTICE } from '../core/model-compat.js';
import { listModels } from './openrouter.js';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * @returns {Promise<{models: object[], source: 'network'|'cache'|'fallback', notice: string}>}
 */
export async function getCatalogue({ fetchImpl, area, now = Date.now, force = false } = {}) {
  const cached = await getCollection(STORAGE_KEYS.MODEL_CACHE, null, area).catch(() => null);
  if (!force && cached?.models?.length && now() - (cached.fetchedAt || 0) < CACHE_TTL_MS) {
    return { models: cached.models, source: 'cache', notice: '' };
  }

  const result = await listModels({ fetchImpl });
  if (result.ok && result.models.length) {
    const models = result.models.map(trimEntry);
    await setCollection(STORAGE_KEYS.MODEL_CACHE, { fetchedAt: now(), models }, area).catch(() => {});
    return { models, source: 'network', notice: '' };
  }

  if (cached?.models?.length) {
    return { models: cached.models, source: 'cache', notice: 'Showing the last catalogue WriteRight downloaded. It may be out of date.' };
  }
  return { models: FALLBACK_CATALOGUE.map(trimEntry), source: 'fallback', notice: FALLBACK_NOTICE };
}

/** Keep only what WriteRight needs, so the cache stays small. */
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

/** @returns {Promise<object|null>} the raw catalogue entry, or null when unknown. */
export async function getModelCapabilities(modelId, options = {}) {
  if (!modelId) return null;
  const { models } = await getCatalogue(options);
  return models.find(m => m.id === modelId) || null;
}
