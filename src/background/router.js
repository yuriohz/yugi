/**
 * Task router.
 *
 * Every model-backed capability enters here. The router is responsible for:
 *   1. refusing unknown tasks and malformed payloads,
 *   2. consulting the shutdown gate before any network call,
 *   3. planning the request against the model's advertised capabilities,
 *   4. composing the prompt,
 *   5. validating output against the task schema,
 *   6. summarising usage and cost,
 *   7. tracking in-flight requests so they can be cancelled.
 */
import { TASKS, LIMITS } from '../core/constants.js';
import { getSettings } from '../core/storage.js';
import { isAllowed } from '../core/shutdown.js';
import { parseModelJson } from '../core/json.js';
import { validateTaskResult } from '../core/task-schemas.js';
import { summariseUsage } from '../core/cost.js';
import { capabilitiesFor, planRequest, fitsContext } from '../core/model-compat.js';
import { chatCompletion, ApiError } from './openrouter.js';
import { buildRequest } from './tasks.js';
import { getModelCapabilities } from './model-catalogue.js';

/** requestId -> AbortController */
const inFlight = new Map();

export function cancelTask(requestId) {
  const controller = inFlight.get(requestId);
  if (!controller) return { cancelled: false };
  controller.abort();
  inFlight.delete(requestId);
  return { cancelled: true };
}

export function cancelAll() {
  const n = inFlight.size;
  for (const controller of inFlight.values()) controller.abort();
  inFlight.clear();
  return { cancelled: n };
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
  if (!text.trim() && task !== TASKS.TEST_MODE) {
    throw new ApiError('There is no text to work on.', { code: 'empty_input' });
  }
  if (text.length > LIMITS.MAX_INPUT_CHARS) {
    throw new ApiError(
      `That selection is ${text.length.toLocaleString()} characters. The limit is ${LIMITS.MAX_INPUT_CHARS.toLocaleString()}.`,
      { code: 'too_long' }
    );
  }

  const settings = deps.settings || await getSettings(deps.area);

  // The gate runs before anything that could touch the network.
  const gate = await isAllowed(
    { origin: payload.origin, tabId: deps.sender?.tab?.id },
    { settings, area: deps.area }
  );
  if (!gate.allowed) {
    throw new ApiError(gate.reason, { code: `shutdown_${gate.blockedBy}` });
  }

  const model = payload.model || settings.model;
  const rawModel = deps.modelEntry !== undefined
    ? deps.modelEntry
    : await getModelCapabilities(model, { fetchImpl: deps.fetchImpl, area: deps.area }).catch(() => null);
  const caps = rawModel ? capabilitiesFor(rawModel) : null;

  const wants = deps.wants || { structuredOutput: true, tools: task === TASKS.RESEARCH_REVIEW };
  const plan = planRequest(caps, wants);
  if (plan.blocked.length) {
    throw new ApiError(plan.blocked[0], { code: 'model_incompatible', blocked: plan.blocked });
  }

  const context = fitsContext(caps, { inputChars: text.length });
  if (context.known && !context.fits) {
    throw new ApiError(
      `This text needs roughly ${context.estimatedTokens.toLocaleString()} tokens but ${caps.name} accepts ${context.contextLength.toLocaleString()}. Select less text or choose a larger model.`,
      { code: 'context_exceeded' }
    );
  }

  const build = deps.buildRequest || buildRequest;
  const request = await build({ ...payload, model, settings, plan, capabilities: caps });

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
    return finalise({ task, response, request, caps, warnings: plan.warnings });
  } finally {
    if (requestId) inFlight.delete(requestId);
  }
}

function finalise({ task, response, request, caps, warnings }) {
  const message = response?.choices?.[0]?.message;
  const raw = message?.content ?? '';
  const parsed = parseModelJson(raw);
  if (!parsed.ok) {
    throw new ApiError(parsed.error, { code: 'bad_output', body: String(raw).slice(0, 300) });
  }

  const validated = validateTaskResult(task, parsed.value);
  if (!validated.ok) {
    throw new ApiError(
      `The model's response did not match the ${task} contract: ${validated.errors.slice(0, 3).join('; ')}`,
      { code: 'schema_mismatch', errors: validated.errors }
    );
  }

  // Task-specific post-processing (offset checks, citation gating, and so on).
  const result = request.postProcess ? request.postProcess(validated.value, request.context) : validated.value;

  return {
    task,
    result,
    warnings: [...warnings, ...(request.warnings || [])],
    annotations: message?.annotations || [],
    usage: summariseUsage(response?.usage, caps?.pricing),
    model: response?.model || request.body?.model || null,
    finishReason: response?.choices?.[0]?.finish_reason || null
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
    reply: response?.choices?.[0]?.message?.content?.trim() || '',
    usage: summariseUsage(response?.usage)
  };
}
