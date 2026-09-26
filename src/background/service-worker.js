/**
 * WriteRight Manifest V3 service worker.
 *
 * Responsibilities: own the API key, own every network call, route tasks, and
 * enforce the shutdown gate before anything leaves the browser.
 */
import { MESSAGES } from '../core/constants.js';
import { getSettings, setSettings } from '../core/storage.js';
import { runTask, cancelTask, testConnection } from './router.js';
import { listModels } from './openrouter.js';

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
});

/** Message handlers, each returning a promise resolved back to the caller. */
const handlers = {
  [MESSAGES.RUN_TASK]: (msg, sender) => runTask(msg.payload, { sender }),
  [MESSAGES.CANCEL_TASK]: msg => cancelTask(msg.requestId),
  [MESSAGES.TEST_CONNECTION]: msg => testConnection(msg.settings),
  [MESSAGES.LIST_MODELS]: msg => listModels(msg.options),
  [MESSAGES.GET_STATE]: async () => {
    const settings = await getSettings();
    // Never return the key to a content script or UI surface.
    const { apiKey, ...safe } = settings;
    return { settings: safe, hasKey: Boolean(apiKey) };
  },
  [MESSAGES.SET_SHUTDOWN]: async msg => {
    const { scope, value, origin } = msg;
    const { setShutdown } = await import('../core/shutdown.js');
    return setShutdown({ scope, value, origin });
  },
  [MESSAGES.OPEN_OPTIONS]: async () => { chrome.runtime.openOptionsPage(); return { ok: true }; }
};

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const handler = handlers[message?.type];
  if (!handler) return false;
  Promise.resolve(handler(message, sender))
    .then(result => respond({ ok: true, result }))
    .catch(error => respond({ ok: false, error: serialiseError(error) }));
  return true;
});

function serialiseError(error) {
  return {
    message: error?.message || String(error),
    code: error?.code || 'unknown',
    retryable: Boolean(error?.retryable)
  };
}

export { setSettings };
