/**
 * Site adapters.
 *
 * Selectors are the fragile part of any extension: sites change their markup
 * without notice. Every adapter therefore lists several candidate selectors
 * and degrades to the generic behaviour when none match, rather than guessing
 * at the wrong element or the wrong person's messages.
 */
import { genericAdapter, tidy, budgetMessages, GENERIC_PLATFORM } from './base.js';

/** Query the first selector that matches, in order of preference. */
function firstMatch(root, selectors) {
  for (const selector of selectors) {
    try {
      const found = root.querySelector(selector);
      if (found) return found;
    } catch { /* an invalid selector must not break the page */ }
  }
  return null;
}

function allMatches(root, selectors) {
  for (const selector of selectors) {
    try {
      const found = root.querySelectorAll(selector);
      if (found.length) return [...found];
    } catch { /* ignore */ }
  }
  return [];
}

// ------------------------------------------------------------- WhatsApp Web

const whatsapp = {
  id: 'whatsapp',
  name: 'WhatsApp Web',
  matches: host => host === 'web.whatsapp.com',
  platform: {
    id: 'whatsapp',
    name: 'WhatsApp',
    plainText: true,
    supportsMarkdown: false,
    singleParagraph: false,
    notes: 'WhatsApp shows each line break as sent. Keep the message compact.'
  },
  contextDescription: 'The last few messages visible in this chat, including who sent each one.',
  composer: el => el.closest('[contenteditable="true"][data-tab]') || el,
  nearbyContext(el, { maxMessages = 6, maxChars = 4000, document: doc } = {}) {
    const root = doc || el?.ownerDocument;
    if (!root) return [];
    const rows = allMatches(root, ['div[role="row"]', '.message-in, .message-out']);
    const messages = [];
    for (const row of rows) {
      const outgoing = Boolean(row.querySelector('.message-out') || row.classList?.contains('message-out'));
      const body = firstMatch(row, ['.selectable-text span', '.selectable-text', '[data-pre-plain-text]']);
      const text = tidy(body?.textContent);
      if (!text) continue;
      messages.push({ direction: outgoing ? 'outgoing' : 'incoming', text });
    }
    return budgetMessages(messages, { maxMessages, maxChars });
  }
};

// -------------------------------------------------------------------- Gmail

const gmail = {
  id: 'gmail',
  name: 'Gmail',
  matches: host => host === 'mail.google.com',
  platform: {
    id: 'gmail',
    name: 'Gmail',
    plainText: false,
    supportsMarkdown: false,
    singleParagraph: false,
    notes: 'Gmail composes rich text. Use plain paragraphs; do not emit Markdown syntax.'
  },
  contextDescription: 'The subject line and the quoted text of the message you are replying to.',
  composer: el => el.closest('div[role="textbox"][g_editable="true"], div[aria-label*="Message Body"]') || el,
  nearbyContext(el, { maxMessages = 4, maxChars = 4000, document: doc } = {}) {
    const root = doc || el?.ownerDocument;
    if (!root) return [];
    const messages = [];
    const subject = firstMatch(root, ['h2[data-thread-perm-id]', 'input[name="subjectbox"]', '.hP']);
    const subjectText = tidy(subject?.value || subject?.textContent);
    if (subjectText) messages.push({ direction: 'unknown', author: 'Subject', text: subjectText });

    for (const node of allMatches(root, ['div.a3s.aiL', 'div.ii.gt div', '[data-message-id] .a3s'])) {
      const text = tidy(node.textContent).slice(0, 2000);
      if (text) messages.push({ direction: 'incoming', text });
    }
    return budgetMessages(messages, { maxMessages, maxChars });
  }
};

// ----------------------------------------------------------------- LinkedIn

const linkedin = {
  id: 'linkedin',
  name: 'LinkedIn',
  matches: host => host.endsWith('linkedin.com'),
  platform: {
    id: 'linkedin',
    name: 'LinkedIn',
    plainText: true,
    supportsMarkdown: false,
    singleParagraph: false,
    maxLength: 3000,
    notes: 'LinkedIn posts and messages are plain text. Comments are limited to 1,250 characters.'
  },
  contextDescription: 'The post or message thread you are replying to.',
  composer: el => el.closest('.msg-form__contenteditable, .ql-editor, div[role="textbox"]') || el,
  nearbyContext(el, { maxMessages = 6, maxChars = 3000, document: doc } = {}) {
    const root = doc || el?.ownerDocument;
    if (!root) return [];
    const messages = [];
    for (const node of allMatches(root, ['.msg-s-event-listitem__body', '.feed-shared-update-v2__description', '.comments-comment-item__main-content'])) {
      const text = tidy(node.textContent);
      if (text) messages.push({ direction: 'unknown', text });
    }
    return budgetMessages(messages, { maxMessages, maxChars });
  }
};

// --------------------------------------------------------------------- Slack

const slack = {
  id: 'slack',
  name: 'Slack',
  matches: host => host.endsWith('slack.com'),
  platform: {
    id: 'slack',
    name: 'Slack',
    plainText: true,
    supportsMarkdown: true,
    singleParagraph: false,
    notes: 'Slack understands *bold* and _italic_, not full Markdown. Never emit headings or tables.'
  },
  contextDescription: 'The recent messages in this channel or thread, including who sent each one.',
  composer: el => el.closest('.ql-editor, div[role="textbox"][data-qa="message_input"]') || el,
  nearbyContext(el, { maxMessages = 8, maxChars = 4000, document: doc } = {}) {
    const root = doc || el?.ownerDocument;
    if (!root) return [];
    const messages = [];
    for (const node of allMatches(root, ['[data-qa="message_content"]', '.c-message_kit__blocks', '.c-message__body'])) {
      const author = tidy(firstMatch(node.parentElement || node, ['[data-qa="message_sender_name"]', '.c-message__sender'])?.textContent);
      const text = tidy(firstMatch(node, ['.p-rich_text_section']) ?.textContent || node.textContent);
      if (text) messages.push({ direction: 'unknown', author: author || undefined, text });
    }
    return budgetMessages(messages, { maxMessages, maxChars });
  }
};

// -------------------------------------------------------------------- Notion

const notion = {
  id: 'notion',
  name: 'Notion',
  matches: host => host.endsWith('notion.so') || host.endsWith('notion.site'),
  platform: {
    id: 'notion',
    name: 'Notion',
    plainText: false,
    supportsMarkdown: true,
    singleParagraph: false,
    notes: 'Notion converts Markdown as you type. Avoid leading # or - unless a heading or list is wanted.'
  },
  // Notion blocks are a document, not a conversation. Reading neighbouring
  // blocks would send unrelated private notes, so this adapter reads none.
  contextDescription: 'No surrounding blocks are read. Notion pages are documents, not conversations, and neighbouring blocks are often unrelated.',
  composer: el => el.closest('[contenteditable="true"].notion-focusable, div[contenteditable="true"]') || el,
  nearbyContext: () => []
};

export const ADAPTERS = Object.freeze([whatsapp, gmail, linkedin, slack, notion]);

/** @returns {import('./base.js').Adapter} */
export function adapterFor(host) {
  const name = String(host ?? '').toLowerCase().replace(/^www\./, '');
  return ADAPTERS.find(a => a.matches(name)) || genericAdapter;
}

export function adapterForUrl(url) {
  try { return adapterFor(new URL(url).host); } catch { return genericAdapter; }
}

export { genericAdapter, GENERIC_PLATFORM };
