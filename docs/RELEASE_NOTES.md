# Release notes — v2.0.0

**Status: prepared, not submitted.** This build has not been uploaded to the Chrome Web
Store. See `docs/SUBMISSION_CHECKLIST.md` for what remains.

**Public name: WordSaffron** (approved 27 September 2026; tactile concept 04).
The extension UI, icons, store listing, privacy policy and permissions copy use
the approved name. The former working name survives only in preserved technical
identifiers (settings export format, internal flags) and in the historical
research record. No trademark clearance has been performed.

---

## Google AI Studio as a second provider

Choose OpenRouter or Google AI Studio during onboarding or in settings. Google defaults
to Gemini 2.5 Flash, with Gemini 2.5 Pro and Gemini 2.0 Flash also offered. Availability
is ultimately controlled by the provider; the catalogue can be refreshed with your key.
Keys stay in local extension storage and are sent to your selected provider or custom
endpoint. A blank endpoint means the selected provider's default.

Google supports the writing tools and logic-only review, but **not researched review**:
that feature uses OpenRouter's server-side web search. Google requests omit OpenRouter
usage extensions, and unknown costs are not invented. Model caches and ID validation
are provider-aware. Settings exports include the provider, never credentials.

## What changed since v1

v1 was a single-purpose proofreader: one prompt, whole-field underlines, English only.
v2 is a different product built around one idea — **the extension must never put words in
your mouth**.

### Five editing modes

| Mode | What it does |
|---|---|
| **Polish** | Same voice, cleaner writing |
| **Casual** | Natural and easygoing |
| **Polite** | Respectful without weakening the message |
| **Professional & Firm** | Direct, confident, and business-ready |
| **Technical Review** | Check the reasoning, then improve the response |

Each mode carries an explicit list of things it must not do, and those prohibitions are
enforced after the model responds, not merely requested in the prompt.

### Anti-slop editing

Built on [No AI Slop](https://github.com/petergyang/no-ai-slop) by Peter Yang, MIT
licensed, pinned at commit `000650b`. Twenty named patterns — binary contrasts,
throat-clearing openers, colon reveals, weasel attribution, importance puffery,
fake-profound kickers, em-dash overuse and the rest — are detected locally, without a
model call, and fed to the model as candidates rather than orders. After the rewrite, the
result is checked again: slop the model *introduced* is treated as a failure.

Four Arabic-specific patterns were added by this project and are marked as such.

### It will not invent things

Before a rewrite can be applied, WordSaffron extracts every number, amount, percentage,
date, time, URL, email address, @handle, identifier, code span and proper noun from your
original and checks they survived. A dropped fact or an invented deadline blocks the
result and tells you why. So does a rewrite that turns your refusal into agreement.

### British English by default

`-ise`, `-our`, `-re`, `-ogue`, doubled `l`, day-month-year dates, and British
punctuation. Americanisms are detected locally with exact offsets and no model call, so
they are instant and free. Where the two variants mean different things —
`programme`/`program`, `licence`/`license` — the suggestion is advisory and says so.

### Arabic as a first-class language

- **Modern Standard Arabic** for Polish, Polite, Professional & Firm and Technical Review.
- **Natural Egyptian Arabic** for Casual, because MSA reads stiff in a chat.
- Latin runs, URLs, code and product names inside Arabic are isolated so the bidi
  algorithm cannot mangle them.
- Arabic-Indic digits are preserved, and `٤٥٠` and `450` compare equal in the fidelity
  check.
- The panel mirrors under RTL.

### Technical Review, in two forms

**Logic only** makes exactly one call and has no web access. Every factual claim about
the outside world comes back as *Needs verification*, never *Supported* — it has no
sources, so it cannot support anything.

**Researched** uses OpenRouter's current `openrouter:web_search` server tool. Citations
come from the returned `url_citation` annotations. A claim can only be *Supported* if a
source the search actually returned backs it; a URL the model invented is stripped and
the claim downgraded. A contradiction blocks apply until you acknowledge the source.

Neither form will tell you that you are right. It reports what the evidence supports,
what it contradicts, and what is still unchecked.

### Shutdown that actually stops

Three independent switches — global, per-website, per-tab-session. While any of them is
off, WordSaffron makes **no network request of any kind**. The gate runs in the service
worker before a request is even constructed, and again inside the router, so a
compromised page cannot route around it. Switching off also cancels work already in
flight.

### Privacy

- No backend. There is no WordSaffron server.
- No analytics, no telemetry.
- Your API key stays in `chrome.storage.local` and is never synced to Google.
- Nearby conversation context is off by default and needs two switches: the global
  preference and per-site consent. The exact text is shown to you before it is sent, and
  you can drop any message from it.
- Local history is off by default, stores the site origin rather than the URL, expires
  automatically, and never appears in an export.
- Export contains no API key, no history and no drafts. Import never writes a credential.

### Also new

Writing profiles with voice samples, protected terms and per-site rules · personal
dictionary scoped globally, per profile or per site · custom modes and saved prompts with
mode testing · favourite models from your selected provider with real capability display · exact-range
underlines via the CSS Custom Highlight API · word-level comparison · exact undo · tone
analysis · reader-reaction readings · cost reported, estimated, or honestly labelled
unknown.

---

## What this release does **not** claim

- It does not make writing undetectable.
- It does not guarantee output is human, correct, or accurate.
- It does not guarantee the review is right. Review its output before you send anything.
- It has **not** been acceptance-tested in Chrome by this build process. See
  `docs/MANUAL_TEST_PLAN.md`.
- It has **not** been submitted to the Chrome Web Store.
- The public name is approved (WordSaffron, 27 September 2026), but trademark
  clearance and the domain purchase are still open. See `NAMING_RESEARCH.md`.

---

## Known limitations

| # | Limitation |
|---|---|
| 1 | Exact-range underlines need the CSS Custom Highlight API and text nodes. `<input>` and `<textarea>` get a field-level marker instead, and the panel lists the exact text |
| 2 | Site adapters depend on selectors that sites change without notice. A failed capture yields no context and says so, rather than guessing |
| 3 | Proper-noun detection is approximate, so a dropped name is a warning rather than a block |
| 4 | The position-flip detector catches explicit reversals, not subtle softening |
| 5 | Custom-mode validation is pattern-based; the primary protection is prompt layer ordering |
| 6 | Some native-search providers return no citation annotations. The verdict then degrades to unverifiable rather than trusting uncited claims |
| 7 | `<all_urls>` is requested. Optional per-site permissions are the better shape and are not implemented in this version |
| 8 | No real-browser acceptance testing has been performed |

---

## Verification

```
npm run verify     # lint, secret scan, build, 522 unit + 16 integration assertions
npm run package    # runtime-only ZIP plus SHA-256
```

The package checksum is written to `release/*.zip.sha256` and the file list to
`release/MANIFEST.txt`.
