/**
 * Site adapter contract.
 *
 * An adapter knows three things about a site:
 *   1. which element the user is actually writing in
 *   2. what the destination can render (plain text, Markdown, length limits)
 *   3. where the nearby conversation lives, if the user has asked for it
 *
 * Nearby context is opt-in, per site, and always disclosed. An adapter that
 * cannot find context returns none rather than guessing, because guessing here
 * means sending the wrong person's messages to a model.
 */

/**
 * @typedef {object} ContextMessage
 * @property {'incoming'|'outgoing'|'unknown'} direction
 * @property {string} text
 * @property {string} [author]
 *
 * @typedef {object} Adapter
 * @property {string} id
 * @property {string} name
 * @property {(host: string) => boolean} matches
 * @property {object} platform            platform constraints for the prompt
 * @property {(el: Element) => Element|null} [composer]
 * @property {(el: Element, opts: object) => ContextMessage[]} [nearbyContext]
 * @property {string} contextDescription  what the adapter would read, in plain words
 */

export const GENERIC_PLATFORM = Object.freeze({
  id: 'generic',
  name: 'this text field',
  plainText: true,
  supportsMarkdown: false,
  singleParagraph: false
});

/** Default adapter: works anywhere, reads no conversation. */
export const genericAdapter = Object.freeze({
  id: 'generic',
  name: 'Standard editor',
  matches: () => true,
  platform: GENERIC_PLATFORM,
  contextDescription: 'No surrounding conversation is read on this site.',
  nearbyContext: () => []
});

/** Strip zero-width characters and collapse whitespace in captured text. */
export function tidy(text) {
  return String(text ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Trim a captured conversation to the configured budget, keeping the most
 * recent messages, because the reply responds to the end of a thread.
 */
export function budgetMessages(messages, { maxMessages = 6, maxChars = 4000 } = {}) {
  const recent = messages.slice(-maxMessages);
  const out = [];
  let total = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const message = recent[i];
    const text = tidy(message.text);
    if (!text) continue;
    if (total + text.length > maxChars) break;
    total += text.length;
    out.unshift({ ...message, text });
  }
  return out;
}

/** Render captured context for the disclosure panel and for the prompt. */
export function renderContext(messages) {
  return messages
    .map(m => `${m.direction === 'outgoing' ? 'You' : m.author || 'Them'}: ${m.text}`)
    .join('\n');
}
