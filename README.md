<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="WriteRight logo">
</p>

<h1 align="center">WriteRight</h1>

<p align="center"><strong>Rewrite, review and proofread anywhere you type — in English or Arabic.</strong></p>

<p align="center">
  A Chrome Manifest V3 extension with no backend, powered by your own OpenRouter key.
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#what-it-does">What it does</a> ·
  <a href="#what-it-will-not-do">What it will not do</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#development">Development</a> ·
  <a href="PRIVACY_POLICY.md">Privacy</a> ·
  <a href="EXECUTION_PLAN.md">Plan</a> ·
  <a href="IMPLEMENTATION_STATUS.md">Status</a>
</p>

---

> ### Status
>
> **Version 2.0.0 — built, tested, and not yet released.**
>
> | | |
> |---|---|
> | Automated tests | ✅ 472 unit + 15 integration assertions, green |
> | Build and package | ✅ `npm run package` produces a validated runtime-only ZIP with a SHA-256 |
> | Real Chrome acceptance testing | ❌ **Not performed.** No browser was available in the build environment. See [`docs/MANUAL_TEST_PLAN.md`](docs/MANUAL_TEST_PLAN.md) |
> | Runtime screenshots | ❌ **None exist.** Everything in `store-assets/` and `design-v2/` is a mockup and is labelled as such |
> | Chrome Web Store submission | ❌ **Not submitted.** See [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md) |
> | Public name | ⏳ Unresolved. "WriteRight" has documented conflicts; see [`NAMING_RESEARCH.md`](NAMING_RESEARCH.md) |

---

## What it does

### Five editing modes

| Mode | Promise |
|---|---|
| **Polish** | Same voice, cleaner writing |
| **Casual** | Natural and easygoing |
| **Polite** | Respectful without weakening the message |
| **Professional & Firm** | Direct, confident, and business-ready |
| **Technical Review** | Check the reasoning, then improve the response |

Each mode declares what it must **not** do, and those prohibitions are enforced after the
model answers — not merely asked for in the prompt.

### It removes AI writing patterns without flattening yours

Built on Peter Yang's MIT-licensed [No AI Slop](https://github.com/petergyang/no-ai-slop),
pinned at a specific commit in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Twenty
named patterns are detected **locally**, with no model call — binary contrasts,
throat-clearing openers, colon reveals, weasel attribution, importance puffery,
fake-profound kickers, em-dash overuse and the rest. They are given to the model as
candidates, not orders. Afterwards the result is checked again, and slop the model
*introduced* is treated as a failure.

### It will not invent things

Before you can apply a rewrite, WriteRight extracts every number, amount, percentage,
date, time, URL, email address, @handle, identifier, code span and proper noun from your
original and checks they survived. A dropped fact, an invented deadline, or a refusal
turned into agreement blocks the result and tells you exactly what happened.

### British English and Arabic, properly

- **British English by default** — `-ise`, `-our`, `-re`, `-ogue`, doubled `l`,
  day-month-year dates. Americanisms are found locally, instantly, with no model call.
- **Modern Standard Arabic** for Polish, Polite, Professional & Firm and Technical Review.
- **Natural Egyptian Arabic** for Casual, because MSA reads stiff in a chat.
- Latin runs, URLs and code inside Arabic are bidi-isolated so they cannot be mangled.
- Arabic-Indic digits are preserved: `٤٥٠` stays `٤٥٠`.
- The panel mirrors under RTL.

### Technical Review, in two forms

**Logic only** makes one call, has no web access, and marks every factual claim about the
outside world *Needs verification* — it has no sources, so it cannot support anything.

**Researched** uses OpenRouter's current `openrouter:web_search` server tool. A claim can
only be *Supported* if a source the search actually returned backs it; an invented URL is
stripped and the claim downgraded. A contradiction blocks apply until you open the source.

### Shutdown that actually stops

Three switches — global, per-website, per-tab-session. While any of them applies,
WriteRight makes **no network request of any kind**. The gate runs before a request is
constructed and again inside the router, and switching off cancels work in flight. This is
covered by automated tests that sweep all seven tasks under all three scopes and fail if a
single request is attempted.

### Also

Writing profiles with voice samples, protected terms and per-site rules · personal
dictionary scoped globally, per profile or per site · custom modes and saved prompts with
mode testing · favourite OpenRouter models showing real capabilities · exact-range
underlines via the CSS Custom Highlight API · word-level comparison · exact undo · tone
analysis · reader-reaction readings · disclosed, twice-opt-in conversation context on
WhatsApp Web, Gmail, LinkedIn and Slack · local history that is off by default and expires
· export that contains no API key.

---

## What it will not do

This list is enforced in code and covered by tests, not just stated here.

- It will **not** claim your writing is undetectable, guaranteed human, or guaranteed
  correct. Those claims are false, and the linter fails the build if they appear in any
  shipped file.
- It will **not** tell you that you are right. It says what the text supports, what needs
  verification, and what conflicts with a source.
- It will **not** invent facts, sources, statistics, deadlines, consequences, or personal
  experience — including when a custom mode asks it to. Such a mode is refused at save
  time with a reason.
- It will **not** apply anything without you.
- It will **not** send anything while it is switched off.
- It will **not** read the conversation around you unless you switch that on, allow the
  specific site, and see the exact text first.

---

## Install

There is no Chrome Web Store listing yet. Install from source:

```bash
git clone https://github.com/yuriohz/yugi.git
cd yugi
git checkout arena/01a0dcc7-yugi
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the **`dist/`** directory
4. Complete onboarding: paste your key from
   [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys), pick a model, test
   the connection

> Load `dist/`, not the repository root. `dist/` is the runtime; the repository contains
> sources, tests and tooling that must never ship.

---

## Architecture

```
src/
  core/                 pure logic, no browser APIs, fully unit tested
    constants.js        shared vocabulary, limits, prohibited phrases
    storage.js          settings with v1 → v2 migration
    slop-rules.js       No AI Slop rules, vendored and attributed
    slop-detector.js    local pattern detection
    slop-eval.js        post-rewrite evaluation
    prompts.js          eight-layer prompt composer, safety first
    untrusted.js        fencing and redaction for page and search content
    fidelity.js         what must survive a rewrite
    guardrails.js       enforcement after the model answers
    modes.js            the five built-in modes
    locale.js  british.js  bidi.js     language, spelling, direction
    review.js  research.js             technical review, with and without the web
    profiles.js  dictionary.js  transfer.js  custom-modes.js  favourites.js
    ranges.js  diff.js  history.js  schema.js  task-schemas.js  cost.js
    adapters/           per-site composer and context adapters
  background/           service worker, router, transport, catalogue
  content/              in-page widget and exact-range highlighting
  ui/                   popup, options, onboarding
```

Design rules that are enforced, not merely intended:

- **The service worker owns every network call.** The content script has no key and no
  transport.
- **The shutdown gate runs before anything else**, in two places.
- **Prompt layers are ordered** so a later layer cannot relax an earlier one. Safety comes
  first, always, and the ordering is asserted end to end.
- **Model output is untrusted.** Tolerant JSON parsing, strict schema validation, then
  guardrail enforcement.
- **Zero runtime dependencies.** The only devDependency is esbuild.

---

## Development

```bash
npm run build          # bundle src/ into a loadable dist/
npm test               # 461 unit assertions
npm run test:browser   # 15 integration journeys
npm run lint           # project rules, syntax, manifest, prohibited claims
npm run scan:secrets   # credential scan over the whole tree
npm run verify         # all of the above
npm run package        # validated runtime ZIP + SHA-256 in release/
```

`npm run package` refuses to produce an archive that contains a source map, a test, a
dotfile, a credential, a file not on the runtime allow-list, a manifest reference that
does not resolve, remotely hosted executable code, or a permission with no written
rationale in [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md).

---

## Known limitations

1. Exact-range underlines need text nodes and the CSS Custom Highlight API. `<input>` and
   `<textarea>` get a field-level marker; the panel still lists the exact text.
2. Site adapters depend on selectors that sites change. A failed capture yields **no**
   context and says so, rather than guessing.
3. Proper-noun detection is approximate, so a dropped name warns rather than blocks.
4. The position-flip detector catches explicit reversals, not subtle softening.
5. Custom-mode validation is pattern-based; prompt layer ordering is the real protection.
6. Some native-search providers return no citation annotations. The verdict then degrades
   to *unverifiable* rather than trusting uncited claims.
7. `<all_urls>` is requested. Optional per-site permissions are the better shape and are
   **not** implemented in this version — see [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md).
8. No real-browser acceptance testing has been performed in this environment.

---

## Documents

| Document | What it is |
|---|---|
| [`EXECUTION_PLAN.md`](EXECUTION_PLAN.md) | The 16-run plan. The definition of scope and completion |
| [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) | Run-by-run ledger with tests, evidence and remaining issues |
| [`PRODUCT_PLAN_V2.md`](PRODUCT_PLAN_V2.md) | The product thinking behind v2 |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Visual and interaction rules |
| [`PRIVACY_POLICY.md`](PRIVACY_POLICY.md) | What is processed, and what never is |
| [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) | Attribution, licences, pinned commits |
| [`NAMING_RESEARCH.md`](NAMING_RESEARCH.md) | 42 candidates, evidence, a shortlist of three, and no claim of legal clearance |
| [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md) | Every permission, justified |
| [`docs/MANUAL_TEST_PLAN.md`](docs/MANUAL_TEST_PLAN.md) | The Chrome acceptance script that still has to be run |
| [`docs/RELEASE_NOTES.md`](docs/RELEASE_NOTES.md) | v2.0.0 release notes |
| [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md) | What is done and what is blocked before submission |
| [`store-assets/README.md`](store-assets/README.md) | Provenance of every image. Nothing is passed off as a screenshot |

---

## Licence

MIT — see [`LICENSE`](LICENSE). Third-party attribution in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
