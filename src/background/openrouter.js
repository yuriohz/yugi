/**
 * OpenRouter transport.
 *
 * Owns timeouts, cancellation, retry policy, and error classification. The
 * transport is injectable so the unit tests can drive every branch without a
 * network.
 */
import { DEFAULT_ENDPOINT, OPENROUTER_MODELS_URL, OPENROUTER_HEADERS, LIMITS } from '../core/constants.js';

export class ApiError extends Error {
  constructor(message, { code = 'api_error', status = 0, retryable = false, body = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.body = body;
  }
}

/** Only these are safe to retry: the request had no observable side effect. */
export function isRetryableStatus(status) {
  return status === 408 || status === 409 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

export function backoffDelay(attempt, { base = LIMITS.RETRY_BASE_MS, max = LIMITS.RETRY_MAX_MS, random = Math.random } = {}) {
  const exponential = Math.min(max, base * 2 ** attempt);
  // Full jitter: avoids synchronised retries across many tabs.
  return Math.round(exponential * (0.5 + random() * 0.5));
}

function headersFor(settings) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${settings.apiKey}`
  };
  if (String(settings.endpoint || '').includes('openrouter.ai')) {
    Object.assign(headers, OPENROUTER_HEADERS);
  }
  return headers;
}

/**
 * Perform a chat completion with retry, timeout and cancellation.
 *
 * @param {object} args
 * @param {object} args.settings  resolved settings including apiKey and endpoint
 * @param {object} args.body      OpenAI-compatible request body
 * @param {AbortSignal} [args.signal]
 * @param {number} [args.timeoutMs]
 * @param {typeof fetch} [args.fetchImpl]
 * @param {(ms:number)=>Promise<void>} [args.sleep]
 */
export async function chatCompletion({
  settings,
  body,
  signal,
  timeoutMs = LIMITS.REQUEST_TIMEOUT_MS,
  maxRetries = LIMITS.MAX_RETRIES,
  fetchImpl,
  sleep = ms => new Promise(r => setTimeout(r, ms)),
  random = Math.random
}) {
  if (!settings?.apiKey) {
    throw new ApiError('Add your OpenRouter API key in WriteRight settings.', { code: 'no_key' });
  }
  const doFetch = fetchImpl || globalThis.fetch;
  const endpoint = settings.endpoint || DEFAULT_ENDPOINT;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new ApiError('Cancelled.', { code: 'cancelled' });

    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let timedOut = false;
    const timeoutWatch = setTimeout(() => { timedOut = true; }, timeoutMs);

    try {
      const response = await doFetch(endpoint, {
        method: 'POST',
        headers: headersFor(settings),
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (response.ok) return await response.json();

      const text = await safeText(response);
      const error = new ApiError(describeStatus(response.status, text), {
        code: `http_${response.status}`,
        status: response.status,
        retryable: isRetryableStatus(response.status),
        body: text.slice(0, 500)
      });
      if (!error.retryable || attempt === maxRetries) throw error;
      lastError = error;
    } catch (err) {
      if (err instanceof ApiError) {
        if (!err.retryable || attempt === maxRetries) throw err;
        lastError = err;
      } else if (err?.name === 'AbortError') {
        if (signal?.aborted) throw new ApiError('Cancelled.', { code: 'cancelled' });
        const timeoutError = new ApiError(
          `The model did not respond within ${Math.round(timeoutMs / 1000)} seconds.`,
          { code: 'timeout', retryable: true }
        );
        if (attempt === maxRetries) throw timeoutError;
        lastError = timeoutError;
      } else {
        const netError = new ApiError(`Network request failed: ${err?.message || err}`, {
          code: 'network', retryable: true
        });
        if (attempt === maxRetries) throw netError;
        lastError = netError;
      }
    } finally {
      clearTimeout(timer);
      clearTimeout(timeoutWatch);
      signal?.removeEventListener('abort', onAbort);
      void timedOut;
    }

    await sleep(backoffDelay(attempt, { random }));
  }

  throw lastError || new ApiError('Request failed.', { code: 'unknown' });
}

async function safeText(response) {
  try { return await response.text(); } catch { return ''; }
}

export function describeStatus(status, body) {
  let detail = body;
  try { detail = JSON.parse(body)?.error?.message || body; } catch { /* plain text */ }
  const short = String(detail || '').slice(0, 220);
  switch (status) {
    case 401: return `OpenRouter rejected the API key (401). ${short}`;
    case 402: return `Your OpenRouter account has insufficient credit (402). ${short}`;
    case 403: return `Access to this model is not permitted (403). ${short}`;
    case 404: return `The model or endpoint was not found (404). ${short}`;
    case 429: return `OpenRouter is rate limiting this key (429). ${short}`;
    default: return `Request failed (${status}). ${short}`;
  }
}

/** Fetch the OpenRouter model catalogue. Failure degrades, it does not throw. */
export async function listModels({ fetchImpl, timeoutMs = 15_000 } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await doFetch(OPENROUTER_MODELS_URL, { signal: controller.signal });
    if (!response.ok) return { ok: false, models: [], error: `Catalogue unavailable (${response.status}).` };
    const data = await response.json();
    return { ok: true, models: Array.isArray(data?.data) ? data.data : [] };
  } catch (err) {
    return { ok: false, models: [], error: `Catalogue unavailable: ${err?.message || err}` };
  } finally {
    clearTimeout(timer);
  }
}
