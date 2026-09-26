# Manual Chrome acceptance test plan

This script exists because the automated suite could not run in a real browser.
The build sandbox has no Chrome or Chromium binary, and the browser download
endpoints are blocked at the network layer. See `tests/browser/README.md` for the
exact command output.

**Nothing in this repository claims these steps have been performed.** Run them, tick
them, and record the result and the build SHA-256 before submitting to the store.

---

## Setup

1. `npm run verify` — must be fully green.
2. `npm run package` — note the SHA-256 it prints.
3. Chrome → `chrome://extensions` → Developer mode on → **Load unpacked** → select `dist/`.
4. Record the Chrome version you tested on.

---

## A. Installation and permissions

| # | Step | Expected | Pass |
|---|---|---|---|
| A1 | Load unpacked | No manifest error, no console error on the extensions page | ☐ |
| A2 | Inspect the service worker | Registers, logs nothing at load, stays alive | ☐ |
| A3 | Check the permission prompt | Lists exactly: read and change your data on all sites | ☐ |
| A4 | Onboarding opens on first install | Four steps, none broken | ☐ |
| A5 | Finish onboarding without a key | Reaches the end; the widget explains the key is missing rather than failing silently | ☐ |

## B. Core proofreading

| # | Step | Expected | Pass |
|---|---|---|---|
| B1 | Type `I has a apple` in a plain `<textarea>` | Badge appears; after the pause, one suggestion | ☐ |
| B2 | Type `The color of the center` | Two British-English suggestions appear **without** a network request (check DevTools Network) | ☐ |
| B3 | Accept one suggestion | Only that span changes; the caret stays sensible | ☐ |
| B4 | Press Undo | The exact previous text and caret return | ☐ |
| B5 | Start typing again mid-check | No stale suggestion is applied; the panel re-checks | ☐ |
| B6 | Edit away the text a suggestion targets, then accept it | The suggestion is discarded, not applied elsewhere | ☐ |

## C. Exact-range underlines — **cannot be verified without a browser**

| # | Step | Expected | Pass |
|---|---|---|---|
| C1 | In a `contenteditable` (e.g. a Notion page), introduce two errors | Only the offending characters are underlined, not the whole field | ☐ |
| C2 | Overlapping issues | One continuous underline, not a doubled one | ☐ |
| C3 | Scroll the page | Underlines stay attached to the text | ☐ |
| C4 | In a `<textarea>` | Field-level marker only; the panel still lists exact text. This is the documented limitation | ☐ |

## D. Modes and guardrails

| # | Step | Expected | Pass |
|---|---|---|---|
| D1 | Polish on a paragraph containing "leverage" and "robust" | Both removed; every number and name intact | ☐ |
| D2 | Professional & Firm on `I will send the contract.` | **No invented date.** If one appears, it must be blocked with a visible warning | ☐ |
| D3 | Polite on `I cannot take on the extra scope.` | Still a refusal. If it flips to agreement, apply must be blocked | ☐ |
| D4 | Casual on a formal note | Natural, no invented slang, no added emoji | ☐ |
| D5 | Any mode | Nothing is ever applied without you pressing a button | ☐ |

## E. Arabic and RTL — **cannot be verified without a browser**

| # | Step | Expected | Pass |
|---|---|---|---|
| E1 | Type Arabic in WhatsApp Web, run Casual | Egyptian Arabic, not MSA | ☐ |
| E2 | Same text, run Polite | Modern Standard Arabic | ☐ |
| E3 | Arabic containing a URL and an English product name | Both render left-to-right, unmangled, and survive the rewrite | ☐ |
| E4 | Open the panel on Arabic text | Panel mirrors: badge counter, accept button and close button all swap sides | ☐ |
| E5 | Arabic diacritics | Not clipped by the line box | ☐ |
| E6 | `٤٥٠` in the source | Still `٤٥٠` in the proposal, not `450` | ☐ |

## F. Technical Review

| # | Step | Expected | Pass |
|---|---|---|---|
| F1 | Logic-only review | **Zero** network requests beyond the single completion (check DevTools) | ☐ |
| F2 | Logic-only review of a factual claim | Marked *Needs verification*, never *Supported* | ☐ |
| F3 | Anywhere in the output | The phrase "You are right" never appears | ☐ |
| F4 | Researched review, switched on for that run | Sources listed with real, clickable URLs | ☐ |
| F5 | Click each source | It opens and actually relates to the claim | ☐ |
| F6 | A contradicted claim | Apply is blocked until the source is acknowledged | ☐ |
| F7 | Researched review on a model without tool support | Refused with an explanation, **before** any request | ☐ |

## G. Shutdown — the zero-call guarantee

| # | Step | Expected | Pass |
|---|---|---|---|
| G1 | Open DevTools Network on the service worker, filter `openrouter.ai` | Baseline | ☐ |
| G2 | Switch off for this tab, then type in a field | **Zero requests** | ☐ |
| G3 | Switch off for this website, reload, type | **Zero requests** | ☐ |
| G4 | Switch off globally, type on three different sites | **Zero requests** | ☐ |
| G5 | Switch off mid-request | The in-flight request is cancelled | ☐ |
| G6 | Re-enable | Works again immediately | ☐ |

## H. Nearby context

| # | Step | Expected | Pass |
|---|---|---|---|
| H1 | Fresh install, WhatsApp Web | Context is **off**; nothing from the chat is sent | ☐ |
| H2 | Turn the global switch on only | Still off for the site; the reason is shown | ☐ |
| H3 | Allow the site too | The exact messages are previewed before sending | ☐ |
| H4 | Remove a message from the preview | It is absent from the request payload (check DevTools) | ☐ |
| H5 | Paste something key-shaped into the chat, then capture | It is redacted in the preview and in the payload | ☐ |
| H6 | Notion | No surrounding blocks are captured, and the UI says so | ☐ |

## I. Data handling

| # | Step | Expected | Pass |
|---|---|---|---|
| I1 | Export settings | Open the file: **no API key**, no history, no drafts | ☐ |
| I2 | Import that file on a fresh profile | Everything restores except the key | ☐ |
| I3 | Import a file with an `apiKey` field | Ignored, with a visible warning | ☐ |
| I4 | Import a random JSON file | Refused with a specific reason | ☐ |
| I5 | History off | `chrome://extensions` → storage inspection shows no history | ☐ |
| I6 | History on, then off | Existing entries are cleared | ☐ |

## J. Errors and limits

| # | Step | Expected | Pass |
|---|---|---|---|
| J1 | Wrong API key | "OpenRouter rejected the API key (401)", not a stack trace | ☐ |
| J2 | Disconnect the network | A clear failure with a retry, not a hang | ☐ |
| J3 | Select 25,000 characters | Refused before the request, with the limit stated | ☐ |
| J4 | Cancel mid-request | Stops; no result appears afterwards | ☐ |
| J5 | Cost display | Shows a real cost, an explicit estimate, or "not reported" — never a silent zero | ☐ |

## K. Opus-gap surfaces

Added with the reviewer-prompt answers. All automated assertions for these are
in `npm run verify`; this section is the visual and interaction pass.

| # | Step | Expected | Pass |
|---|---|---|---|
| K1 | Open the widget on any text, click the Insights tab | Two read-only actions: Check tone, Preview reader reactions, plus an optional audience field | ☐ |
| K2 | Check tone | Named dimensions with strength and verbatim quoted evidence; no edits offered | ☐ |
| K3 | Preview reader reactions with an audience filled in | Hedged readings tied to quoted wording ("could be read as"), plus the caveat; never a prediction | ☐ |
| K4 | Fresh profile, Technical Review selected | Research toggle is disabled with an explanation until the catalogue is refreshed in settings | ☐ |
| K5 | Refresh the catalogue, pick a favourite labelled "web research" | Toggle enables; checking it shows the cost disclosure before anything runs | ☐ |
| K6 | Pick a favourite labelled "no web research" | Toggle disables again with a model-specific reason | ☐ |
| K7 | Run a researched review that returns a contradiction | Per-source reading checklist with an outstanding count; ticking all clears the banner | ☐ |
| K8 | Review with at least one supported claim | "Draft response from N supported claims" appears and produces a rewrite labelled with its claim counts | ☐ |
| K9 | Trigger a fidelity block (e.g. Professional & Firm inventing a date) | The banner lists the exact violations; Replace enables only after the acknowledgement box is ticked | ☐ |
| K10 | Context controls in the composer | Global and site states shown together; enabling the missing one updates the disclosure line | ☐ |
| K11 | Settings → profiles → Arabic dialect | "Egyptian Arabic everywhere" makes Polish return Egyptian for Arabic text; "MSA everywhere" makes Casual return MSA | ☐ |
| K12 | Settings → saved prompts | Add, edit, delete, export, and re-import a prompt; a prompt asking for invented facts is refused at save | ☐ |
| K13 | Popup | A single "Open settings" button; the site toggle reads "Off for {host} only" | ☐ |

## L. Provider selection

Use your own valid keys; these live checks have not been performed by automation.

| # | Step | Expected | Pass |
|---|---|---|---|
| L1 | Switch provider in onboarding | Key label, link, placeholder, models and research note change; old typed key clears | ☐ |
| L2 | Test Google with Gemini 2.5 Flash, then proofread/rewrite | Google chat endpoint; Bearer auth; no X-Title or usage.include; successful result | ☐ |
| L3 | Select Technical Review with Google | Research disabled with provider-specific reason; forced researched request refused with zero calls | ☐ |
| L4 | Switch back to OpenRouter and enter its key | Attribution and usage accounting remain; research available only for compatible models | ☐ |
| L5 | Blank, known-default and explicit custom endpoints in options | Known defaults display/save blank; blank resolves to provider default; custom URL retained | ☐ |
| L6 | Refresh catalogues, switch provider, then pause extension and open widget | Separate caches; Google header auth without key in URL; cache-only snapshots make no calls while paused | ☐ |
| L7 | Add bare Google/vendor-model OpenRouter favourites; export/import | Provider-specific validation; provider round-trip; bogus provider skipped with warning; no credentials exported | ☐ |

## M. Screenshots for the store

Only after everything above passes:

1. Set the window to 1280 × 800.
2. Capture: the widget with suggestions; the comparison view; a technical review with
   sources; the settings page; Arabic RTL in use.
3. Save them to `store-assets/` with a `-runtime` suffix and record the date and Chrome
   version in `store-assets/README.md`.
4. **Do not** reuse anything from `design-v2/`. Those are mockups.

---

## Sign-off

| Field | Value |
|---|---|
| Tester | |
| Date | |
| Chrome version | |
| Package SHA-256 | |
| Result | |
| Defects raised | |
