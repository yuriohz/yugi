/**
 * Task router.
 *
 * Every model-backed capability enters here. The router is responsible for:
 *   1. refusing unknown tasks,
 *   2. consulting the shutdown gate before any network call,
 *   3. composing prompts,
 *   4. validating output against the task schema,
 *   5. tracking in-flight requests so they can be cancelled.
 */
import { TASKS, LIMITS } from '../core/constants.js';
import { getSettings } from '../core/storage.js';
import { isAllowed } from '../core/shutdown.js';
import { parseModelJson } from '../core/json.js';
import { chatCompletion, ApiError } from './openrouter.js';

/** requestId -> AbortController */
const inFlight = new Map();

export function cancelTask(requestId) {
  const controller = inFlight.get(requestId);
  if (!controller) return { cancelled: false };
  controller.abort();
  inFlight.delete(requestId);
  return { cancelled: true };
}

export function inFlightCount() { return inFlight.size; }

export const SUPPORTED_TASKS = new Set(Object.values(TASKS));

/**
 * @param {object} payload
 * @param {string} payload.task
 * @param {string} payload.requestId
 * @param {string} payload.text
 * @param {object} [payload.options]
 * @param {object} deps injectable for tests
 */
export async function runTask(payload = {}, deps = {}) {
  const { task, requestId, text = '' } = payload;

  if (!SUPPORTED_TASKS.has(task)) {
    throw new ApiError(`Unsupported task: ${String(task)}`, { code: 'bad_task' });
  }
  if (typeof text !== 'string') {
    throw new ApiError('Task text must be a string.', { code: 'bad_input' });
  }
  if (text.length > LIMITS.MAX_INPUT_CHARS) {
    throw new ApiError(
      `That selection is ${text.length.toLocaleString()} characters. The limit is ${LIMITS.MAX_INPUT_CHARS.toLocaleString()}.`,
      { code: 'too_long' }
    );
  }

  const settings = deps.settings || await getSettings(deps.area);

  // The gate runs before anything else that could touch the network.
  const gate = await isAllowed(
    { origin: payload.origin, tabId: deps.sender?.tab?.id },
    { settings, area: deps.area }
  );
  if (!gate.allowed) {
    throw new ApiError(gate.reason, { code: `shutdown_${gate.blockedBy}` });
  }

  const build = deps.buildRequest || (await import('./tasks.js')).buildRequest;
  const request = await build({ ...payload, settings });

  const controller = new AbortController();
  if (requestId) inFlight.set(requestId, controller);

  try {
    const response = await chatCompletion({
      settings,
      body: request.body,
      signal: controller.signal,
      timeoutMs: request.timeoutMs,
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep
    });
    return finalise(task, response, request, deps);
  } finally {
    if (requestId) inFlight.delete(requestId);
  }
}

function finalise(task, response, request, deps) {
  const message = response?.choices?.[0]?.message;
  const raw = message?.content ?? '';
  const parsed = parseModelJson(raw);
  if (!parsed.ok) {
    throw new ApiError(parsed.error, { code: 'bad_output', body: String(raw).slice(0, 300) });
  }
  const validate = deps.validate || request.validate;
  const result = validate ? validate(parsed.value, request.context) : parsed.value;
  return {
    task,
    result,
    annotations: message?.annotations || [],
    usage: response?.usage || null,
    model: response?.model || request.body?.model || null
  };
}

/** One tiny live call used by onboarding and settings to verify a key. */
export async function testConnection(candidate = {}, deps = {}) {
  const base = deps.settings || await getSettings(deps.area);
  const settings = { ...base, ...candidate };
  if (!settings.apiKey) throw new ApiError('Enter an OpenRouter API key first.', { code: 'no_key' });

  const response = await chatCompletion({
    settings,
    body: {
      model: settings.model,
      max_tokens: 8,
      temperature: 0,
      messages: [{ role: 'user', content: 'Reply with the single word OK.' }]
    },
    timeoutMs: 20_000,
    maxRetries: 1,
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep
  });

  return {
    ok: true,
    model: response?.model || settings.model,
    reply: response?.choices?.[0]?.message?.content?.trim() || ''
  };
}
