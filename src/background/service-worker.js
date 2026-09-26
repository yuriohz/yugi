/**
 * WriteRight Manifest V3 service worker.
 *
 * Responsibilities: own the API key, own every network call, route tasks, and
 * enforce the shutdown gate before anything leaves the browser.
 *
 * The zero-call guarantee: while WriteRight is switched off — globally, for a
 * site, or for a tab — it makes no network request of any kind. The only
 * exceptions are requests the user explicitly triggers from the settings page
 * (testing a key, refreshing the model list), which are marked `userInitiated`
 * and are the user asking for a call while the extension is otherwise idle.
 */
import { MESSAGES } from '../core/constants.js';
import { getSettings } from '../core/storage.js';
import { isAllowed, setShutdown, clearTabShutdown, getSiteShutdowns, normaliseOrigin, isTabShutdown } from '../core/shutdown.js';
import { runTask, cancelTask, cancelAll, testConnection } from './router.js';
import { getCatalogue } from './model-catalogue.js';
import { record as recordHistory, list as listHistory, clear as clearHistory } from '../core/history.js';

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
});

// A tab-session shutdown lasts for the tab, not for ever.
chrome.tabs?.onRemoved?.addListener(tabId => clearTabShutdown(tabId));
chrome.tabs?.onReplaced?.addListener((added, removed) => clearTabShutdown(removed));

/**
 * Requests that are only permitted while the extension is running, or when the
 * user explicitly asked for them from the settings page.
 */
async function requireEnabled(message, sender, { allowUserInitiated = false } = {}) {
  const settings = await getSettings();
  if (allowUserInitiated && message?.userInitiated === true) return settings;
  const gate = await isAllowed(
    { origin: message?.origin || originOf(sender), tabId: sender?.tab?.id },
    { settings }
  );
  if (!gate.allowed) {
    const error = new Error(gate.reason);
    error.code = `shutdown_${gate.blockedBy}`;
    throw error;
  }
  return settings;
}

function originOf(sender) {
  if (sender?.origin) return sender.origin;
  if (sender?.tab?.url) { try { return new URL(sender.tab.url).origin; } catch { return null; } }
  return null;
}

const handlers = {
  [MESSAGES.RUN_TASK]: async (msg, sender) => {
    // runTask re-checks the gate itself; this is the outer, cheaper refusal.
    await requireEnabled(msg, sender);
    return runTask({ ...msg.payload, origin: msg.payload?.origin || originOf(sender) }, { sender });
  },

  [MESSAGES.CANCEL_TASK]: async msg => (msg.requestId ? cancelTask(msg.requestId) : cancelAll()),

  // Explicit user actions from the settings and onboarding pages.
  [MESSAGES.TEST_CONNECTION]: async (msg, sender) => {
    await requireEnabled(msg, sender, { allowUserInitiated: true });
    return testConnection(msg.settings);
  },
  [MESSAGES.LIST_MODELS]: async (msg, sender) => {
    await requireEnabled(msg, sender, { allowUserInitiated: true });
    return getCatalogue(msg.options || {});
  },

  [MESSAGES.GET_STATE]: async (msg, sender) => {
    const settings = await getSettings();
    const origin = msg.origin || originOf(sender);
    const { apiKey, ...safe } = settings;
    const gate = await isAllowed({ origin, tabId: sender?.tab?.id }, { settings });
    return {
      // The key itself never leaves the service worker.
      settings: safe,
      hasKey: Boolean(apiKey),
      shutdown: {
        global: settings.enabled === false,
        website: (await getSiteShutdowns()).includes(normaliseOrigin(origin)),
        tab: isTabShutdown(sender?.tab?.id),
        allowed: gate.allowed,
        blockedBy: gate.blockedBy,
        reason: gate.reason
      }
    };
  },

  [MESSAGES.SET_SHUTDOWN]: async (msg, sender) => {
    const result = await setShutdown({
      scope: msg.scope,
      value: msg.value,
      origin: msg.origin || originOf(sender),
      tabId: sender?.tab?.id ?? msg.tabId
    });
    // Switching off must stop work already in flight, not just future work.
    if (msg.value) cancelAll();
    return result;
  },

  // Local history. Off by default; the module itself refuses to store when off.
  [MESSAGES.HISTORY_ADD]: async msg => recordHistory(msg.entry || {}),
  [MESSAGES.HISTORY_LIST]: async () => listHistory(),
  [MESSAGES.HISTORY_CLEAR]: async () => clearHistory(),

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
