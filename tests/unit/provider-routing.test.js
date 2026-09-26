import test from 'node:test';
import assert from 'node:assert/strict';
import { chatCompletion, listModels, describeStatus } from '../../src/background/openrouter.js';
import { runTask, testConnection } from '../../src/background/router.js';
import { baseBody, buildRequest } from '../../src/background/tasks.js';
import { getCatalogue, getCachedCatalogue } from '../../src/background/model-catalogue.js';
import { getProvider } from '../../src/core/providers.js';
import { DEFAULT_ENDPOINT, GOOGLE_CHAT_URL, TASKS, STORAGE_KEYS } from '../../src/core/constants.js';
import { defaultSettings, MemoryStorageArea } from '../../src/core/storage.js';
import { isValidModelId, addFavourite } from '../../src/core/favourites.js';
import { exportToText, planImport } from '../../src/core/transfer.js';
import { researchAvailability, renderComposer } from '../../src/ui/render.js';
import { researchDisclosure } from '../../src/core/research.js';
import { fakeFetch, completion } from '../helpers/fake-transport.js';
function forbiddenFetch(label) {
  const calls = [];
  const fetch = async (...args) => { calls.push(args); throw new Error(label); };
  fetch.calls = calls;
  return fetch;
}
const settings = { ...defaultSettings(), provider: 'google', apiKey: 'test-google-key', model: 'gemini-2.5-flash' };
const response = data => ({ ok: true, json: async () => data });

test('Google routing resolves legacy endpoint and uses Bearer without attribution', async () => {
  const calls = [];
  const out = await runTask({ task: TASKS.PROOFREAD, text: 'Hello there.' }, {
    settings, area: new MemoryStorageArea(), modelEntry: null,
    fetchImpl: async (url, init) => { calls.push({ url, init }); return completion({ issues: [] }); }
  });
  assert.equal(out.task, TASKS.PROOFREAD);
  assert.deepEqual(out.result.issues, []);
  assert.equal(calls[0].url, GOOGLE_CHAT_URL);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-google-key');
  assert.equal(calls[0].init.headers['X-Title'], undefined);
  assert.equal(JSON.parse(calls[0].init.body).usage, undefined);
});
test('explicit custom endpoint wins and receives no OpenRouter attribution', async () => {
  let seen;
  await chatCompletion({ settings: { ...settings, endpoint: 'https://example.com/chat' }, body: {}, fetchImpl: async (url, init) => { seen = { url, init }; return response({}); } });
  assert.equal(seen.url, 'https://example.com/chat');
  assert.equal(seen.init.headers['X-Title'], undefined);
});
test('OpenRouter retains X-Title, including blank default endpoint', async () => {
  for (const endpoint of ['', DEFAULT_ENDPOINT]) {
    await chatCompletion({ settings: { ...settings, provider: 'openrouter', endpoint }, body: {}, fetchImpl: async (url, init) => {
      assert.equal(url, DEFAULT_ENDPOINT); assert.ok(init.headers['X-Title']); return response({});
    } });
  }
});
test('Google research fails before catalogue lookup or completion', async () => {
  const fetchImpl = forbiddenFetch('Google research');
  await assert.rejects(runTask({ task: TASKS.RESEARCH_REVIEW, text: 'A factual claim.', options: { research: true } }, { settings, fetchImpl, area: new MemoryStorageArea() }), e => e.code === 'provider_no_research');
  assert.equal(fetchImpl.calls.length, 0);
});
test('baseBody omits Google usage but preserves OpenRouter accounting', () => {
  assert.equal(baseBody({ provider: getProvider('google') }).usage, undefined);
  assert.deepEqual(baseBody({ provider: getProvider('openrouter') }).usage, { include: true });
});
test('all seven builders thread the provider to their request body', async () => {
  for (const task of Object.values(TASKS)) {
    const built = await buildRequest({ task, provider: getProvider('google'), text: 'Hello there.', settings,
      model: settings.model, plan: { useTools: true }, mode: { id: 'sample', name: 'Sample', guardrails: {} },
      options: { research: true, testCase: { input: 'Hello there.' } } });
    assert.equal(built.body.usage, undefined, task);
  }
});
test('Google catalogue authenticates with header, never URL', async () => {
  const result = await listModels({ provider: 'google', apiKey: 'private-test-key', fetchImpl: async (url, init) => {
    assert.match(url, /models\?pageSize=100$/);
    assert.ok(!url.includes('private-test-key'));
    assert.equal(init.headers['x-goog-api-key'], 'private-test-key');
    return response({ models: [{ name: 'models/gemini', supportedGenerationMethods: ['generateContent'] }] });
  } });
  assert.equal(result.models[0].id, 'gemini');
});
test('keyless Google catalogue degrades without calling', async () => {
  const fetchImpl = forbiddenFetch('keyless catalogue');
  assert.equal((await listModels({ provider: 'google', fetchImpl })).ok, false);
  const result = await getCatalogue({ provider: 'google', area: new MemoryStorageArea(), fetchImpl });
  assert.equal(result.source, 'fallback');
  assert.ok(result.models.every(m => m.id.startsWith('gemini')));
  assert.equal(fetchImpl.calls.length, 0);
});
test('catalogue caches and cache-only snapshots are isolated by provider', async () => {
  const area = new MemoryStorageArea();
  await getCatalogue({ area, fetchImpl: async () => response({ data: [{ id: 'vendor/model' }] }) });
  await getCatalogue({ area, provider: 'google', apiKey: 'test-key', fetchImpl: async () => response({ models: [{ name: 'models/gemini', supportedGenerationMethods: ['generateContent'] }] }) });
  assert.equal((await getCachedCatalogue({ area })).models[0].id, 'vendor/model');
  assert.equal((await getCachedCatalogue({ area, provider: 'google' })).models[0].id, 'gemini');
  const cached = await getCatalogue({ area, provider: 'google', fetchImpl: forbiddenFetch('cached') });
  assert.equal(cached.source, 'cache');
  assert.ok((await area.get(null))[`${STORAGE_KEYS.MODEL_CACHE}:google`]);
});
test('model ID matrix distinguishes bare Google IDs from vendor/model', () => {
  for (const [id, google, openrouter] of [['gemini-2.5-flash', true, false], ['google/gemini:free', false, true], ['', false, false], ['bad id', false, false], ['../bad', false, false]]) {
    assert.equal(isValidModelId(id, 'google'), google, id);
    assert.equal(isValidModelId(id, 'openrouter'), openrouter, id);
  }
});
test('favourites validate against the selected provider and explain failures', () => {
  assert.equal(addFavourite([], 'gemini-2.5-flash', 'google').ok, true);
  assert.match(addFavourite([], 'vendor/model', 'google').error, /Google AI Studio/);
  assert.match(addFavourite([], 'gemini', 'openrouter').error, /OpenRouter/);
});
test('transfer round-trips provider and skips bogus providers with a warning', () => {
  const { text } = exportToText({ settings: { ...settings, endpoint: '' } });
  assert.equal(planImport(text).plan[STORAGE_KEYS.SETTINGS].provider, 'google');
  assert.equal(planImport(text).plan[STORAGE_KEYS.SETTINGS].endpoint, '');
  assert.ok(!text.includes(settings.apiKey));
  const raw = JSON.parse(text); raw.settings.provider = 'bogus';
  const plan = planImport(JSON.stringify(raw));
  assert.equal(plan.plan[STORAGE_KEYS.SETTINGS].provider, undefined);
  assert.ok(plan.warnings.some(w => /provider/i.test(w)));
});
test('widget provider gate overrides even a research-capable model', () => {
  const gate = researchAvailability({ provider: 'google', providerResearch: false, modelId: 'gemini', favourites: [{ id: 'gemini', available: true, supportsResearch: true }] });
  assert.equal(gate.allowed, false);
  assert.match(gate.reason, /Google AI Studio.*Switch to OpenRouter/);
});
test('research disclosure and composer cost line name the provider', () => {
  assert.match(researchDisclosure({ provider: 'google' }).message, /Google AI Studio/);
  assert.match(renderComposer({ provider: 'google', mode: { name: 'Review', controls: { research: true } } }), /Google AI Studio cost/);
});
test('connection and transport errors name the selected provider', async () => {
  await assert.rejects(testConnection({}, { settings: { ...settings, apiKey: '' } }), /Google AI Studio/);
  await assert.rejects(chatCompletion({ settings: { ...settings, apiKey: '' }, body: {} }), /Google AI Studio/);
  assert.match(describeStatus(401, '', 'Google AI Studio'), /Google AI Studio/);
  const result = await testConnection({ apiKey: undefined }, { settings, fetchImpl: fakeFetch([completion('OK')]) });
  assert.equal(result.reply, 'OK');
});
