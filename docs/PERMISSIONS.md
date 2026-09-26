# Permission rationale

Every permission WriteRight requests, why it is needed, and what would break without it.
This file is checked by `npm run package`: if the manifest asks for a permission that is
not explained here, the package is refused.

---

## `storage`

**What it does.** Reads and writes `chrome.storage.local`.

**Why WriteRight needs it.** To keep your settings, writing profiles, protected terms,
custom modes, saved prompts, personal dictionary and favourite models on your device
between sessions, and to hold your OpenRouter API key.

**Scope.** `chrome.storage.local` only. WriteRight does **not** use `chrome.storage.sync`,
specifically so that your API key is never copied to Google's servers through Chrome Sync.

**Without it.** You would re-enter your API key and every preference on every page load.

---

## `activeTab`

**What it does.** Grants temporary access to the tab you are currently using, at the
moment you invoke the extension.

**Why WriteRight needs it.** To read the text in the field you are editing, and to write
the corrected text back when you accept a suggestion.

**Without it.** WriteRight could not see what you typed or apply a correction.

---

## `scripting`

**What it does.** Allows the extension to run its content script in a page.

**Why WriteRight needs it.** The suggestion widget runs inside the page so it can attach
to the field you are writing in and position itself next to it.

**Without it.** There would be no in-page widget and no inline underlines.

---

## `<all_urls>` (host permission)

**What it does.** Allows the content script to run on any website.

**Why WriteRight needs it.** WriteRight is a general writing assistant. People write in
text fields on sites nobody can enumerate in advance: a client's ticketing system, an
internal wiki, a university portal, a government form. A fixed site list would make the
extension silently useless on exactly the sites where someone most needs help.

**What this does *not* mean.**

- WriteRight does **not** read pages you are not typing in. The content script attaches
  to an editable field only when you focus it.
- WriteRight does **not** read the surrounding conversation unless you switch nearby
  context on **and** allow it for that specific site. Both switches are off by default,
  and the exact text is shown to you before it is sent.
- WriteRight does **not** send anything anywhere while it is switched off — globally,
  for a site, or for a tab. This is enforced in the service worker before any request is
  constructed, and is covered by automated tests that fail if any network call is
  attempted while disabled.
- WriteRight does **not** collect analytics, telemetry, or usage statistics.

**Narrower alternatives considered and why they were rejected.**

| Alternative | Why it was rejected |
|---|---|
| A fixed list of supported sites | Breaks on every internal tool, intranet and unlisted site — which is most professional writing |
| `activeTab` alone, no host permission | The widget could not appear until the toolbar icon was clicked every time, on every page, which defeats inline proofreading |
| Optional host permissions requested per site | Genuinely considered, and it is the right long-term shape. It is recorded as a planned change in `README.md`; it is not implemented in this version, and this document does not claim otherwise |

---

## Permissions WriteRight deliberately does **not** request

| Permission | Why not |
|---|---|
| `tabs` | WriteRight never needs your tab list, titles, or URLs. It knows only the origin of the tab you are typing in |
| `history` | Never needed |
| `cookies` | Never needed |
| `webRequest` | WriteRight does not intercept or modify any other traffic |
| `clipboardRead` | WriteRight never reads your clipboard. Copy is a one-way write |
| `storage` sync | Would place your API key on Google's servers |
| `identity` | There is no WriteRight account. You use your own OpenRouter key |

---

## Where data goes

| Data | Destination | When |
|---|---|---|
| The text in the field you are editing | Your chosen OpenRouter model, over HTTPS | Only when you trigger a check or a rewrite |
| Nearby conversation, if you allowed it for that site | The same request | Only with both switches on, and shown to you first |
| Your API key | OpenRouter, in the `Authorization` header | On each request you trigger |
| Everything else — profiles, dictionary, history, settings | Nowhere. `chrome.storage.local` only | — |

WriteRight has no backend of its own. There is no WriteRight server to send anything to.
