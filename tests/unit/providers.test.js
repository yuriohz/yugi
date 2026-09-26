import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDER_IDS, PROVIDERS, getProvider, isKnownProvider, normalizeGoogleModels, GOOGLE_FALLBACK_CATALOGUE, fallbackCatalogueFor } from '../../src/core/providers.js';
import { DEFAULT_ENDPOINT, GOOGLE_CHAT_URL, GOOGLE_MODELS_URL, GOOGLE_KEY_URL } from '../../src/core/constants.js';
import { FALLBACK_CATALOGUE } from '../../src/core/model-compat.js';

test('registry IDs and entries are deeply frozen', () => {
  assert.deepEqual(Object.values(PROVIDER_IDS), ['openrouter', 'google']);
  assert.ok(Object.isFrozen(PROVIDERS));
  assert.ok(Object.isFrozen(PROVIDERS.google.models[0]));
});
test('unknown providers safely resolve to OpenRouter', () => {
  for (const id of [undefined, '', 'bogus', 'constructor', '__proto__']) {
    assert.equal(isKnownProvider(id), false);
    assert.equal(getProvider(id), PROVIDERS.openrouter);
  }
  assert.equal(isKnownProvider('google'), true);
});
test('Google declares endpoint, key auth and feature constraints', () => {
  const p = getProvider('google');
  assert.equal(p.name, 'Google AI Studio');
  assert.equal(p.defaultEndpoint, GOOGLE_CHAT_URL);
  assert.equal(p.keyUrl, GOOGLE_KEY_URL);
  assert.equal(p.catalogueAuth, 'x-goog-api-key');
  assert.equal(p.supportsUsage, false);
  assert.equal(p.supportsResearch, false);
  assert.match(GOOGLE_MODELS_URL, /v1beta\/models$/);
});
test('OpenRouter retains its endpoint and research capabilities', () => {
  const p = getProvider('openrouter');
  assert.equal(p.defaultEndpoint, DEFAULT_ENDPOINT);
  assert.equal(p.supportsUsage, true);
  assert.equal(p.supportsResearch, true);
});
test('onboarding options start with each provider default', () => {
  for (const p of Object.values(PROVIDERS)) {
    assert.equal(p.models[0].id, p.defaultModel);
    assert.ok(p.keyPlaceholder && p.modelIdHint);
  }
  assert.deepEqual(PROVIDERS.google.models.map(m => m.id), ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash']);
});
test('Google normalization keeps only content generation and never advertises tools', () => {
  const models = normalizeGoogleModels({ models: [
    { name: 'models/gemini-2.5-flash', displayName: 'Flash', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] },
    { name: 'models/embedding', supportedGenerationMethods: ['embedContent'] }
  ] });
  assert.deepEqual(models, [{ id: 'gemini-2.5-flash', name: 'Flash', context_length: 1048576, supported_parameters: ['response_format'] }]);
});
test('Google normalization tolerates absent or malformed catalogues', () => {
  for (const raw of [null, {}, { models: null }, [null, {}]]) assert.deepEqual(normalizeGoogleModels(raw), []);
  assert.equal(normalizeGoogleModels([{ name: 'models/gemini', supportedGenerationMethods: ['generateContent'] }])[0].context_length, null);
});
test('fallback catalogues stay provider-specific with no Google research', () => {
  assert.equal(fallbackCatalogueFor('bogus'), FALLBACK_CATALOGUE);
  assert.equal(fallbackCatalogueFor('google'), GOOGLE_FALLBACK_CATALOGUE);
  assert.ok(GOOGLE_FALLBACK_CATALOGUE.every(m => !m.id.includes('/') && !m.supported_parameters.includes('tools')));
});
