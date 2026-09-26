# Privacy policy

**Last updated: 26 September 2026 · applies to version 2.0.0**

WriteRight is a browser extension that improves text you are writing. It uses **your own**
OpenRouter or Google AI Studio API key. There is no WriteRight server, no WriteRight account, and no analytics.

---

## The short version

| Question | Answer |
|---|---|
| Is there a WriteRight backend? | **No.** There is nowhere for us to send your data, because there is no "us" in the data path |
| Does WriteRight collect analytics or telemetry? | **No.** None, of any kind |
| Where does your API key live? | `chrome.storage.local` on this device. It is **never** synced to Google |
| What leaves your browser? | Only text you explicitly ask WriteRight to work on, sent to the model you chose, using your key |
| Does it read pages you are not typing in? | **No** |
| Does it read your conversations? | Only if you switch nearby context on **and** allow it for that specific site. Both are off by default |
| Can you stop it completely? | Yes. Three switches — global, per-site, per-tab. While any applies, WriteRight makes **no network request at all** |

---

## What is processed, and when

### Text you are editing

When you trigger a check, a rewrite, or a review, the text in the field — or the portion
you selected — is sent over HTTPS to the endpoint you configured, which is
`https://openrouter.ai/api/v1/chat/completions` by default.

WriteRight does not send anything on page load, on navigation, or in the background. A
request is made only in response to something you did.

**Password fields are never read.** The content script attaches only to text inputs,
search, email and URL inputs, textareas, and contenteditable regions.

### Nearby conversation context — opt-in twice

On WhatsApp Web, Gmail, LinkedIn and Slack, WriteRight can include the surrounding
conversation so a reply fits the thread. This is off by default and needs **both**:

1. the global "nearby context" preference switched on, and
2. explicit consent for that specific website.

Before anything is sent, WriteRight shows you the exact messages it would include, tells
you how many and from which site, and lets you remove any of them. Anything that looks
like a credential is redacted first, and the count of redactions is shown. Notion reads
no surrounding blocks at all, because a page is a document and neighbouring blocks are
usually unrelated notes.

### Your API key

Stored in `chrome.storage.local`. It is sent to your configured endpoint in the
`Authorization` header so the provider can authenticate the request. It goes nowhere else.

WriteRight deliberately does **not** use `chrome.storage.sync`, because that would copy
your key to Google's servers.

### Local history — off by default

If you switch it on, WriteRight keeps recent rewrites on this device so you can recover
one you dismissed. When it is on:

- it stores the **site origin**, never the full URL, so a document title or a thread id in
  a URL cannot be retained
- credential-shaped strings are redacted before anything is written
- long text is truncated
- entries expire automatically, by default after 7 days, and expiry is applied when
  history is read as well as when it is written
- at most 50 entries are kept
- you can delete a single entry or clear everything in one action
- **history never leaves your device and is never included in an export**

Switching history off deletes what was already stored.

---

## What is never collected

- Analytics, telemetry, usage statistics, crash reports
- Your browsing history, tab list, page titles or URLs of pages you are not typing in
- Your clipboard. Copy is a one-way write; WriteRight never reads the clipboard
- Cookies
- Any personal identifier. There is no account and no identifier assigned to you

---

## Third parties

### OpenRouter, Google AI Studio, or whichever endpoint you configure

The text you submit is processed by your selected provider: OpenRouter (and its selected model provider) or Google AI Studio. With a custom endpoint, that endpoint processes it. Google model catalogue requests send the API key in a header, never a URL.
Their handling is governed by their policies, not this one:

- <https://openrouter.ai/privacy>
- <https://openrouter.ai/terms>

Google API data handling is governed by [Google’s Gemini API terms](https://ai.google.dev/gemini-api/terms); review the terms for your account tier before sending sensitive text.

If you use **researched Technical Review** (OpenRouter only), OpenRouter additionally performs a web search
on your behalf using its `openrouter:web_search` server tool, which involves a search
provider. This never runs unless you switch research on for that specific run, and the
cost and the tool are disclosed to you before it runs.

If you point WriteRight at a different endpoint, that operator's policies apply instead.

### Nobody else

WriteRight contacts no other service. It loads no remote script, no font, no tracking
pixel and no analytics SDK. This is enforced at build time: the packaging step refuses to
produce an archive containing remotely hosted executable code.

---

## Export and import

- An export contains your settings, profiles, custom modes, saved prompts, dictionary and
  favourite models.
- An export contains **no API key**, **no history** and **no drafts**. The key is deleted
  explicitly, credential-shaped fields are stripped at every depth, settings are built
  from a whitelist, and every remaining string is scanned and redacted. The file states
  this promise in its own header.
- An import **never** writes a credential, whatever the file claims. If a file contains an
  API key field it is ignored and you are told.

---

## Your control

| Control | Effect |
|---|---|
| Turn off for this tab | Nothing is sent from this tab for the rest of the session |
| Turn off for this website | Nothing is sent from that site until you turn it back on |
| Turn off everywhere | WriteRight makes no network request at all |
| Revoke site context consent | That site's conversation is no longer read |
| Clear history | Deletes every stored entry immediately |
| Remove the extension | Deletes all local data, including your key |

The only requests possible while WriteRight is switched off are ones you trigger yourself
from the settings page — testing your API key, or refreshing the model list. Those are
you asking for a call.

---

## Children

WriteRight is not directed at children under 13 and collects no information from anyone.

---

## Changes

Material changes will be reflected here and in the release notes, with the date above
updated. The version this policy applies to is stated at the top.

---

## Contact

Open an issue: <https://github.com/yuriohz/yugi/issues>
