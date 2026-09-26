import test from 'node:test';
import assert from 'node:assert/strict';
import { capabilitiesFor, planRequest, fitsContext, FALLBACK_CATALOGUE, FALLBACK_NOTICE } from '../../src/core/model-compat.js';
import { getCatalogue, getModelCapabilities } from '../../src/background/model-catalogue.js';
import { MemoryStorageArea } from '../../src/core/storage.js';
import { fakeFetch, jsonResponse } from '../helpers/fake-transport.js';

test('capabilities are derived from supported_parameters', () => {
  const caps = capabilitiesFor({
    id: 'x/y', name: 'X', context_length: 128000,
    supported_parameters: ['response_format', 'tools'],
    pricing: { prompt: '0.000001', completion: '0.000002' }
  });
  assert.equal(caps.structuredOutput, true);
  assert.equal(caps.tools, true);
  assert.equal(caps.longContext, true);
  assert.equal(caps.pricing.prompt, '0.000001');
});

test('a model with no advertised parameters has no capabilities', () => {
  const caps = capabilitiesFor({ id: 'x/y', supported_parameters: [] });
  assert.equal(caps.structuredOutput, false);
  assert.equal(caps.tools, false);
});

test('unknown capabilities still attempt structured output', () => {
  const plan = planRequest(null, { structuredOutput: true });
  assert.equal(plan.useResponseFormat, true);
  assert.deepEqual(plan.blocked, []);
});

test('a model without structured output degrades with a warning, not a failure', () => {
  const caps = capabilitiesFor({ id: 'x/y', supported_parameters: [] });
  const plan = planRequest(caps, { structuredOutput: true });
  assert.equal(plan.useResponseFormat, false);
  assert.match(plan.warnings[0], /repair the response/);
  assert.deepEqual(plan.blocked, []);
});

test('tools are never assumed when capabilities are unknown', () => {
  const plan = planRequest(null, { tools: true });
  assert.equal(plan.useTools, false);
  assert.match(plan.blocked[0], /cannot confirm/);
});

test('a model without tool support blocks research with an explanation', () => {
  const caps = capabilitiesFor({ id: 'x/y', supported_parameters: ['response_format'] });
  const plan = planRequest(caps, { tools: true });
  assert.equal(plan.useTools, false);
  assert.match(plan.blocked[0], /cannot run a web search/);
});

test('a tool-capable model enables research', () => {
  const caps = capabilitiesFor({ id: 'x/y', supported_parameters: ['tools'] });
  const plan = planRequest(caps, { tools: true });
  assert.equal(plan.useTools, true);
  assert.deepEqual(plan.blocked, []);
});

test('context fit is unknown when the catalogue does not say', () => {
  assert.deepEqual(fitsContext(null, { inputChars: 10_000 }), { fits: true, known: false });
});

test('context fit is computed when the window is known', () => {
  const caps = capabilitiesFor({ id: 'x/y', context_length: 4096 });
  const result = fitsContext(caps, { inputChars: 100_000 });
  assert.equal(result.fits, false);
  assert.equal(result.contextLength, 4096);
});

test('the catalogue caches a successful fetch', async () => {
  const area = new MemoryStorageArea();
  const fetchImpl = fakeFetch([jsonResponse({ data: [{ id: 'a/b', supported_parameters: ['tools'] }] })]);
  const first = await getCatalogue({ fetchImpl, area });
  assert.equal(first.source, 'network');
  const second = await getCatalogue({ fetchImpl, area });
  assert.equal(second.source, 'cache');
  assert.equal(fetchImpl.calls.length, 1);
});

test('a stale cache is reused when the network fails', async () => {
  const area = new MemoryStorageArea();
  await getCatalogue({ fetchImpl: fakeFetch([jsonResponse({ data: [{ id: 'a/b' }] })]), area });
  const offline = fakeFetch([new Error('offline')]);
  const result = await getCatalogue({ fetchImpl: offline, area, force: true });
  assert.equal(result.source, 'cache');
  assert.match(result.notice, /may be out of date/);
});

test('the offline fallback catalogue is used when nothing else is available', async () => {
  const area = new MemoryStorageArea();
  const result = await getCatalogue({ fetchImpl: fakeFetch([new Error('offline')]), area });
  assert.equal(result.source, 'fallback');
  assert.equal(result.notice, FALLBACK_NOTICE);
  assert.equal(result.models.length, FALLBACK_CATALOGUE.length);
});

test('capabilities lookup returns null for an unknown model', async () => {
  const area = new MemoryStorageArea();
  const fetchImpl = fakeFetch([jsonResponse({ data: [{ id: 'a/b' }] })]);
  assert.equal(await getModelCapabilities('not/there', { fetchImpl, area }), null);
  assert.ok(await getModelCapabilities('a/b', { fetchImpl, area }));
});

test('the cached entry is trimmed to the fields WriteRight uses', async () => {
  const area = new MemoryStorageArea();
  const fetchImpl = fakeFetch([jsonResponse({ data: [{ id: 'a/b', description: 'x'.repeat(10_000), supported_parameters: [] }] })]);
  const { models } = await getCatalogue({ fetchImpl, area });
  assert.equal(models[0].description, undefined);
});
