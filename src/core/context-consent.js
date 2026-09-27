/**
 * Nearby-context consent and disclosure.
 *
 * Reading the conversation around a text box is the most privacy-sensitive
 * thing this extension can do. The rules:
 *
 *   1. off by default, everywhere
 *   2. enabled per site, by the user, never inferred
 *   3. the exact text that would be sent is shown before it is sent
 *   4. credential-shaped strings are redacted first
 *   5. the captured text is data, never instruction
 *   6. the user can drop any message from the capture
 */
import { STORAGE_KEYS, LIMITS } from './constants.js';
import { getCollection, setCollection, getSettings } from './storage.js';
import { adapterFor } from './adapters/index.js';
import { renderContext } from './adapters/base.js';
import { wrapUntrusted, redactSecrets } from './untrusted.js';

const CONSENT_KEY = 'contextConsent';

/** @returns {Promise<Record<string, boolean>>} host -> allowed */
export async function getConsents(area) {
  const value = await getCollection(CONSENT_KEY, {}, area).catch(() => ({}));
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export async function setConsent(host, allowed, area) {
  const key = normaliseHost(host);
  if (!key) throw new Error('A valid site is required.');
  const consents = await getConsents(area);
  if (allowed) consents[key] = true; else delete consents[key];
  await setCollection(CONSENT_KEY, consents, area);
  return consents;
}

export async function hasConsent(host, area) {
  const key = normaliseHost(host);
  if (!key) return false;
  return Boolean((await getConsents(area))[key]);
}

export function normaliseHost(input) {
  if (!input) return null;
  let host = String(input).trim().toLowerCase();
  try { host = new URL(host.includes('://') ? host : `https://${host}`).host; } catch { return null; }
  return /^[a-z0-9.-]+$/.test(host) ? host.replace(/^www\./, '') : null;
}

/**
 * What would be captured on this site, and whether it is currently permitted.
 * Called before any capture so the UI can explain itself.
 */
export async function describeCapture(host, { area, settings } = {}) {
  const adapter = adapterFor(host);
  const resolved = settings || await getSettings(area);
  const consented = await hasConsent(host, area);
  const globallyEnabled = resolved?.context?.nearbyEnabled === true;

  return {
    adapterId: adapter.id,
    adapterName: adapter.name,
    description: adapter.contextDescription,
    // Both switches must be on. The global switch is the master; the per-site
    // consent is the specific permission.
    enabled: globallyEnabled && consented,
    globallyEnabled,
    consented,
    supportsContext: typeof adapter.nearbyContext === 'function' && adapter.id !== 'generic' && adapter.id !== 'notion',
    maxMessages: Math.min(Number(resolved?.context?.maxMessages) || 6, LIMITS.MAX_CONTEXT_MESSAGES),
    reason: !globallyEnabled
      ? 'Nearby conversation context is switched off in WordSaffron settings.'
      : !consented
        ? `WordSaffron has not been allowed to read the conversation on ${normaliseHost(host)}.`
        : ''
  };
}

/**
 * Capture the nearby conversation, redact it, and produce both the preview the
 * user sees and the prompt block that would be sent. They are built from the
 * same array, so the preview cannot understate what is sent.
 *
 * @returns {{allowed: boolean, reason: string, messages: object[], preview: string,
 *            blocks: string[], redactions: number, adapterName: string}}
 */
export function captureContext(element, { host, adapter, settings, consented, excluded = [] } = {}) {
  const resolved = adapter || adapterFor(host);
  const globallyEnabled = settings?.context?.nearbyEnabled === true;

  if (!globallyEnabled || !consented) {
    return {
      allowed: false,
      reason: !globallyEnabled
        ? 'Nearby conversation context is switched off in WordSaffron settings.'
        : `WordSaffron has not been allowed to read the conversation on ${normaliseHost(host)}.`,
      messages: [], preview: '', blocks: [], redactions: 0, adapterName: resolved.name
    };
  }

  const maxMessages = Math.min(Number(settings?.context?.maxMessages) || 6, LIMITS.MAX_CONTEXT_MESSAGES);
  let captured = [];
  try {
    captured = resolved.nearbyContext?.(element, { maxMessages, maxChars: LIMITS.MAX_CONTEXT_CHARS }) || [];
  } catch {
    // A site changed its markup. Send nothing rather than something wrong.
    return {
      allowed: true, reason: 'WordSaffron could not read the conversation on this page, so none was included.',
      messages: [], preview: '', blocks: [], redactions: 0, adapterName: resolved.name
    };
  }

  const excludedSet = new Set(excluded);
  let redactions = 0;
  const messages = captured
    .map((message, index) => {
      const redacted = redactSecrets(message.text);
      redactions += redacted.redactions;
      return { ...message, index, text: redacted.text, excluded: excludedSet.has(index) };
    })
    .filter(Boolean);

  const included = messages.filter(m => !m.excluded);
  const preview = renderContext(included);
  const blocks = preview
    ? [wrapUntrusted(preview, { label: 'nearby conversation', source: normaliseHost(host) || 'unknown', maxChars: LIMITS.MAX_CONTEXT_CHARS }).block]
    : [];

  return {
    allowed: true,
    reason: '',
    messages,
    preview,
    blocks,
    redactions,
    adapterName: resolved.name
  };
}

/** The sentence shown next to the capture, every time. */
export function disclosureLine(capture, host) {
  if (!capture.allowed) return capture.reason;
  const count = capture.messages.filter(m => !m.excluded).length;
  if (!count) return 'No nearby conversation is being sent.';
  const redacted = capture.redactions
    ? ` ${capture.redactions} value${capture.redactions === 1 ? '' : 's'} that looked like a credential ${capture.redactions === 1 ? 'was' : 'were'} removed.`
    : '';
  return `${count} message${count === 1 ? '' : 's'} from ${normaliseHost(host) || 'this page'} will be sent with your text as background.${redacted} You can remove any of them below.`;
}
