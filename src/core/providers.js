/** Provider capabilities are explicit; OpenAI-compatible does not imply server tools. */
import { DEFAULT_ENDPOINT, DEFAULT_MODEL, GOOGLE_CHAT_URL, GOOGLE_KEY_URL } from './constants.js';
import { FALLBACK_CATALOGUE } from './model-compat.js';

export const PROVIDER_IDS = Object.freeze({ OPENROUTER: 'openrouter', GOOGLE: 'google' });
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const PROVIDERS = freeze({
  openrouter: {
    id: 'openrouter', name: 'OpenRouter', defaultEndpoint: DEFAULT_ENDPOINT,
    keyUrl: 'https://openrouter.ai/settings/keys', keyPlaceholder: 'sk-or-v1-…',
    defaultModel: DEFAULT_MODEL, modelIdHint: 'vendor/model', catalogueAuth: null,
    supportsUsage: true, supportsResearch: true,
    models: [
      { id: DEFAULT_MODEL, label: 'GPT-4o mini — fast and affordable' },
      { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku' },
      { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct' }
    ]
  },
  google: {
    id: 'google', name: 'Google AI Studio', defaultEndpoint: GOOGLE_CHAT_URL,
    keyUrl: GOOGLE_KEY_URL, keyPlaceholder: 'AIza…', defaultModel: 'gemini-2.5-flash',
    modelIdHint: 'gemini-2.5-flash', catalogueAuth: 'x-goog-api-key',
    supportsUsage: false, supportsResearch: false,
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — fast default' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — most capable' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' }
    ]
  }
});
export function isKnownProvider(id) { return Object.hasOwn(PROVIDERS, id); }
export function getProvider(id) { return PROVIDERS[isKnownProvider(id) ? id : 'openrouter']; }
export function normalizeGoogleModels(data) {
  return (Array.isArray(data) ? data : Array.isArray(data?.models) ? data.models : [])
    .filter(m => typeof m?.name === 'string' && m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => ({ id: m.name.replace(/^models\//, ''), name: m.displayName || m.name.replace(/^models\//, ''),
      context_length: m.inputTokenLimit ?? null, supported_parameters: ['response_format'] }));
}
export const GOOGLE_FALLBACK_CATALOGUE = freeze(PROVIDERS.google.models.map(m => ({
  id: m.id, name: m.label, supported_parameters: ['response_format'], context_length: null
})));
export function fallbackCatalogueFor(provider) {
  return getProvider(provider).id === 'google' ? GOOGLE_FALLBACK_CATALOGUE : FALLBACK_CATALOGUE;
}
