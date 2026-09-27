import test from 'node:test';
import assert from 'node:assert/strict';
import { chatCompletion, listModels, isRetryableStatus, backoffDelay, describeStatus, ApiError } from '../../src/background/openrouter.js';
import { fakeFetch, completion, textResponse, jsonResponse, abortError, recordingSleep } from '../helpers/fake-transport.js';

const settings = { apiKey: 'test-key-value', endpoint: 'https://openrouter.ai/api/v1/chat/completions', model: 'test/model' };
const body = { model: 'test/model', messages: [] };

test('a missing key fails before any request is made', async () => {
  const fetchImpl = fakeFetch([completion('{}')]);
  await assert.rejects(
    () => chatCompletion({ settings: { ...settings, apiKey: '' }, body, fetchImpl }),
    e => e.code === 'no_key'
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('OpenRouter attribution headers are sent', async () => {
  const fetchImpl = fakeFetch([completion('{}')]);
  await chatCompletion({ settings, body, fetchImpl });
  const headers = fetchImpl.calls[0].init.headers;
  assert.equal(headers.Authorization, 'Bearer test-key-value');
  assert.equal(headers['X-Title'], 'WordSaffron Chrome Extension');
  assert.ok(headers['HTTP-Referer']);
});

test('attribution headers are not sent to a non-OpenRouter endpoint', async () => {
  const fetchImpl = fakeFetch([completion('{}')]);
  await chatCompletion({ settings: { ...settings, endpoint: 'https://self-hosted.test/v1/chat' }, body, fetchImpl });
  assert.equal(fetchImpl.calls[0].init.headers['X-Title'], undefined);
});

test('4xx errors are not retried', async () => {
  const fetchImpl = fakeFetch([textResponse('{"error":{"message":"bad key"}}', { status: 401 })]);
  await assert.rejects(
    () => chatCompletion({ settings, body, fetchImpl, sleep: recordingSleep() }),
    e => e.code === 'http_401' && /rejected the API key/.test(e.message)
  );
  assert.equal(fetchImpl.calls.length, 1, '401 must not be retried');
});

test('429 is retried up to the cap, then surfaces', async () => {
  const fetchImpl = fakeFetch([textResponse('rate limited', { status: 429 })]);
  const sleep = recordingSleep();
  await assert.rejects(
    () => chatCompletion({ settings, body, fetchImpl, sleep, maxRetries: 2 }),
    e => e.code === 'http_429'
  );
  assert.equal(fetchImpl.calls.length, 3, 'initial attempt plus two retries');
  assert.equal(sleep.delays.length, 2);
});

test('a transient 503 then success resolves', async () => {
  const fetchImpl = fakeFetch([
    textResponse('upstream down', { status: 503 }),
    completion('{"ok":true}')
  ]);
  const result = await chatCompletion({ settings, body, fetchImpl, sleep: recordingSleep() });
  assert.equal(fetchImpl.calls.length, 2);
  assert.match(result.choices[0].message.content, /"ok":true/);
});

test('network errors are retried and classified', async () => {
  const fetchImpl = fakeFetch([new TypeError('Failed to fetch')]);
  await assert.rejects(
    () => chatCompletion({ settings, body, fetchImpl, sleep: recordingSleep(), maxRetries: 1 }),
    e => e.code === 'network'
  );
  assert.equal(fetchImpl.calls.length, 2);
});

test('cancellation before the first attempt makes no request', async () => {
  const controller = new AbortController();
  controller.abort();
  const fetchImpl = fakeFetch([completion('{}')]);
  await assert.rejects(
    () => chatCompletion({ settings, body, fetchImpl, signal: controller.signal }),
    e => e.code === 'cancelled'
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('an abort during the request reports cancellation, not timeout', async () => {
  const controller = new AbortController();
  const fetchImpl = fakeFetch([async () => { controller.abort(); throw abortError(); }]);
  await assert.rejects(
    () => chatCompletion({ settings, body, fetchImpl, signal: controller.signal }),
    e => e.code === 'cancelled'
  );
});

test('an abort with no user cancellation is reported as a timeout and retried', async () => {
  const fetchImpl = fakeFetch([async () => { throw abortError(); }]);
  const sleep = recordingSleep();
  await assert.rejects(
    () => chatCompletion({ settings, body, fetchImpl, sleep, maxRetries: 1, timeoutMs: 1000 }),
    e => e.code === 'timeout' && /did not respond within 1 seconds/.test(e.message)
  );
  assert.equal(fetchImpl.calls.length, 2);
});

test('retry backoff is bounded and jittered', () => {
  assert.equal(backoffDelay(0, { base: 1000, max: 8000, random: () => 0 }), 500);
  assert.equal(backoffDelay(0, { base: 1000, max: 8000, random: () => 1 }), 1000);
  assert.equal(backoffDelay(10, { base: 1000, max: 8000, random: () => 1 }), 8000);
});

test('retryable status classification', () => {
  for (const s of [408, 429, 500, 502, 503, 504]) assert.equal(isRetryableStatus(s), true, String(s));
  for (const s of [400, 401, 402, 403, 404, 422]) assert.equal(isRetryableStatus(s), false, String(s));
});

test('status messages are actionable', () => {
  assert.match(describeStatus(402, ''), /insufficient credit/);
  assert.match(describeStatus(404, ''), /not found/);
  assert.match(describeStatus(429, ''), /rate limiting/);
});

test('the model catalogue degrades instead of throwing', async () => {
  const failing = fakeFetch([new Error('offline')]);
  const result = await listModels({ fetchImpl: failing });
  assert.equal(result.ok, false);
  assert.deepEqual(result.models, []);
  assert.match(result.error, /Catalogue unavailable/);
});

test('the model catalogue returns entries on success', async () => {
  const fetchImpl = fakeFetch([jsonResponse({ data: [{ id: 'a/b' }] })]);
  const result = await listModels({ fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.models[0].id, 'a/b');
});

test('ApiError carries a code and retryable flag', () => {
  const err = new ApiError('x', { code: 'timeout', retryable: true });
  assert.equal(err.name, 'ApiError');
  assert.equal(err.retryable, true);
});
