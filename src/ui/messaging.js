/**
 * Talk to the service worker. Every UI surface uses this so a renamed message
 * type cannot silently fall back to the v1 protocol.
 */
export function ask(type, extra = {}) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      reject(new Error('WordSaffron is not running as an extension.'));
      return;
    }
    chrome.runtime.sendMessage({ type, ...extra }, response => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      if (!response?.ok) {
        const error = new Error(response?.error?.message || 'Request failed.');
        error.code = response?.error?.code || 'unknown';
        error.retryable = Boolean(response?.error?.retryable);
        reject(error);
        return;
      }
      resolve(response.result);
    });
  });
}
