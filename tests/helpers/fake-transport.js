/**
 * A scripted fetch replacement plus a call spy.
 *
 * Used to assert the request lifecycle, the retry policy, and — critically —
 * the zero-call guarantee when WordSaffron is switched off.
 */

export function jsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
    async text() { return typeof body === 'string' ? body : JSON.stringify(body); }
  };
}

export function textResponse(text, { status = 500 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return JSON.parse(text); },
    async text() { return text; }
  };
}

/** Wrap a model message payload in an OpenAI-compatible completion envelope. */
export function completion(content, { usage = null, model = 'test/model', annotations = [], finishReason = 'stop' } = {}) {
  return jsonResponse({
    id: 'gen-test',
    model,
    choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content), annotations }, finish_reason: finishReason }],
    usage
  });
}

/**
 * @param {Array<Response|Error|((url, init)=>any)>} script consumed in order; the
 *        last entry repeats once exhausted.
 */
export function fakeFetch(script) {
  const calls = [];
  let index = 0;
  const impl = async (url, init) => {
    calls.push({ url, init, body: safeParse(init?.body) });
    const entry = script[Math.min(index, script.length - 1)];
    index++;
    if (typeof entry === 'function') return entry(url, init);
    if (entry instanceof Error) throw entry;
    return entry;
  };
  impl.calls = calls;
  return impl;
}

function safeParse(body) {
  try { return typeof body === 'string' ? JSON.parse(body) : body; } catch { return body; }
}

/** A fetch that fails the test if it is ever called. */
export function forbiddenFetch(label = 'network') {
  const impl = async () => { throw new Error(`${label}: no request should have been made`); };
  impl.calls = [];
  return impl;
}

/** An AbortError, as a real fetch would raise on abort. */
export function abortError() {
  const err = new Error('The operation was aborted.');
  err.name = 'AbortError';
  return err;
}

/** Deterministic sleep that records delays instead of waiting. */
export function recordingSleep() {
  const delays = [];
  const sleep = async ms => { delays.push(ms); };
  sleep.delays = delays;
  return sleep;
}
