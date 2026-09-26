# WriteRight — 16-run production execution plan

**Status:** canonical scope and completion definition for the v2 production build.
**Recreated:** 26 September 2026, after the local commits `e6f74c3` (*feat: implement anti-slop multilingual rewriting suite*) and `9cbe8b3` (*docs: add 16-run production execution plan*) were found to be absent from the `yuriohz/yugi` remote, absent from `master` (`bb404ce`), and unrecoverable from the reflog, stash, or any pull request. The plan below is reconstructed from `PRODUCT_PLAN_V2.md`, `DEBRIEF_FOR_OPUS.md`, `DESIGN_SYSTEM.md`, `README.md`, and the retained `design-v2/` artefacts.

This file is the definition of scope and completion. Runs are executed sequentially, not selectively.

---

## Ground rules for every run

1. Read the run scope and acceptance criteria before touching code.
2. Inspect the existing implementation before editing; never blind-overwrite.
3. Preserve completed work and user changes.
4. Implement the run fully. Partial implementation does not close a run.
5. Add or update automated tests in the same run.
6. Run all relevant validation (`npm run verify`).
7. Fix failures rather than skipping or deleting tests.
8. Update `IMPLEMENTATION_STATUS.md` and every affected document.
9. Commit with a conventional commit message.
10. Push to `arena/01a0dcc7-yugi` and update the pull request.
11. Continue automatically to the next run.

## Non-negotiable product contract

Applies to every run and every generated output.

- **Fidelity.** Preserve meaning, facts, names, numbers, URLs, commitments, technical terms, and the user's real voice.
- **No invention.** Never invent facts, evidence, sources, opinions, deadlines, consequences, or personal experience. Flag gaps instead of filling them.
- **No false assurance.** Never claim output is undetectable, guaranteed human, or guaranteed correct.
- **Locale.** Default to British English spelling and punctuation.
- **Arabic.** Modern Standard Arabic for Polish, Polite, Professional & Firm, and Technical Review. Natural Egyptian Arabic for Casual. Correct RTL and mixed Arabic/English behaviour.
- **Consent.** No silent reading of pages or conversations. Nearby context is disclosed and controllable.
- **Review-first.** No generative rewrite is ever auto-applied.
- **Attribution.** Peter Yang's MIT-licensed [No AI Slop](https://github.com/petergyang/no-ai-slop) is the editing backbone; attribution and the exact upstream commit live in `THIRD_PARTY_NOTICES.md`.
- **Naming.** Do not publish publicly under the WriteRight name without resolving the documented naming conflicts (Run 15).

---

## Run 1 — Recovery, foundation, and third-party integration

**Scope**

- Recreate `EXECUTION_PLAN.md` and open `IMPLEMENTATION_STATUS.md` with the run ledger.
- Restructure the repository into `src/core`, `src/background`, `src/content`, `src/ui`, with a deterministic `build.js` producing a runtime-only `dist/`.
- Vendor and adapt the No AI Slop rule set into `src/core/slop-rules.js`, recording the exact upstream commit.
- Create `THIRD_PARTY_NOTICES.md` with the full upstream MIT licence text, commit SHA, and a statement of what was adapted.
- Establish the test harness (`node:test`), `npm run verify`, and secret scanning.
- Preserve every v1 runtime behaviour that later runs depend on.

**Acceptance criteria**

- `EXECUTION_PLAN.md`, `IMPLEMENTATION_STATUS.md`, `THIRD_PARTY_NOTICES.md` exist and are accurate.
- `THIRD_PARTY_NOTICES.md` names Peter Yang, the MIT licence, the repository URL, and the pinned commit SHA.
- `npm run build` produces a loadable MV3 `dist/` with no source maps, tests, or dev files.
- `npm test` runs and passes.
- No API keys, tokens, or secrets anywhere in the tree.

## Run 2 — Anti-slop engine and layered prompt composition

**Scope**

- Implement the adapted No AI Slop rules as structured, testable data: banned words, empty adverbs, empty phrases, and named patterns with detect/fix guidance.
- Implement a deterministic local slop detector used for pre-flight hints, post-flight verification, and offline tests.
- Implement layered prompt composition: safety contract → fidelity contract → anti-slop contract → mode → profile → locale → platform/output constraints.
- Treat page text and quoted conversation as untrusted data with explicit prompt-injection resistance.

**Acceptance criteria**

- Every upstream rule family is represented and attributed.
- The detector finds seeded slop in fixtures and does not fire on clean human prose.
- Prompt composition is pure, ordered, and snapshot-tested.
- Untrusted content is delimited and never promoted to instructions.

## Run 3 — Task router, OpenRouter client, and request lifecycle

**Scope**

- Versioned task router: `proofread`, `rewrite`, `review`, `research_review`, `test_mode`, `tone`, `reader_reaction`.
- Strict JSON schemas and validation for every task, with tolerant parsing and repair of fenced/partial JSON.
- OpenRouter client: timeouts, cancellation, retry only on safe transient errors, exponential backoff with jitter, latest-request tokens.
- Model compatibility probing (structured output, tool support) with graceful degradation.
- Usage and cost extraction and display.

**Acceptance criteria**

- Unknown tasks and malformed payloads are rejected, not forwarded.
- Every schema rejects invalid output and accepts valid output.
- Timeout, cancel, and retry behaviour is unit-tested against a fake transport.
- 4xx responses are not retried; 429/5xx/network errors are, up to the cap.
- Cost is computed from OpenRouter usage when present and marked unavailable otherwise.

## Run 4 — The five modes and guardrails

**Scope**

- Implement Polish, Casual, Polite, Professional & Firm, and Technical Review as first-class mode definitions with instruction bodies, guardrails, UI summaries, and controls.
- Implement guardrail enforcement: preserve facts, preserve length, no-web, citation-required, never-auto-apply.
- Implement the fidelity checker: numbers, URLs, emails, @handles, dates, currency, and proper nouns present in the source must survive the rewrite.

**Acceptance criteria**

- Five built-in modes exist, are immutable, and are duplicable.
- Each mode's "must not" list is encoded in its instruction and its guardrails.
- The fidelity checker flags dropped or altered numbers, URLs, and named entities.
- Guardrail violations surface as warnings and block auto-apply.

## Run 5 — Multilingual: British English, MSA, Egyptian Arabic, RTL

**Scope**

- British English as the default spelling and punctuation variant, with an Americanism detector and converter.
- Script and language detection for Arabic, English, and mixed content.
- Modern Standard Arabic register for Polish, Polite, Professional & Firm, and Technical Review; natural Egyptian Arabic for Casual.
- Arabic-specific anti-slop rules and an Arabic fidelity checker covering Arabic-Indic digits.
- RTL direction resolution, base direction, bidi isolation of embedded Latin runs, and mirrored UI.

**Acceptance criteria**

- Default locale is `en-GB`; `-ize`, `color`, `analyze` style Americanisms are corrected.
- Arabic text is detected, and mixed Arabic/English resolves to the dominant base direction.
- Casual mode targets Egyptian Arabic; the other four target MSA.
- Latin/URL/number runs inside Arabic are bidi-isolated so they render correctly.
- Arabic-Indic and Western digits are treated as equivalent by the fidelity checker.

## Run 6 — Technical Review, logic-only

**Scope**

- Claim extraction, conclusion identification, and internal-consistency analysis.
- Separate errors, risks, and optional improvements.
- Label claims that require external verification.
- Calibrated verdict vocabulary; never "you are right".
- Propose an improved response only after the review.

**Acceptance criteria**

- Logic-only review performs zero web requests.
- Output separates findings by severity and marks each claim's verification status.
- Banned certainty phrasing is rejected by validation.
- The improved response is a separate, explicit step.

## Run 7 — Researched Technical Review with OpenRouter web search

**Scope**

- Use OpenRouter's current `openrouter:web_search` server tool, explicitly enabled by the user.
- Normalise citation annotations into source cards: title, URL, domain, date when available, and claim relationship (supports / conflicts / adds context / unverifiable).
- Cost disclosure before running research.
- Contradiction gating: if research flags a contradiction, the user must open or acknowledge the source before the rewrite can be applied.
- Supported-claims-only rewrite.

**Acceptance criteria**

- Research is off by default and never runs implicitly.
- Every externally checked claim carries at least one visible citation.
- Uncited claims cannot be marked supported.
- Contradictions block apply until acknowledged.
- Search results are handled as untrusted data.

## Run 8 — Profiles, voice samples, terminology, dictionary, import/export

**Scope**

- Profile CRUD with audience, voice description, 1–5 voice samples, preferred/avoided/protected terms, formality, directness, contractions, emoji, greeting, sign-off, locale, default mode, model, and site rules.
- Protected terms are never altered by any rewrite.
- Personal dictionary that suppresses repeat suggestions.
- Safe JSON import/export with schema validation, version migration, size limits, and guaranteed secret stripping.

**Acceptance criteria**

- Profiles survive a browser restart and round-trip through export/import.
- Exports never contain API keys, endpoints with credentials, or history text.
- Imports reject unknown versions, oversized payloads, and prototype-pollution keys.
- Protected terms survive rewriting; violations are reported.

## Run 9 — Saved prompts, custom modes, and mode testing

**Scope**

- Prompt library CRUD with scope, output behaviour, profile override, research policy, shortcut, pinning, ordering, and search.
- Custom mode builder: name, icon, purpose, base behaviour, instruction, guardrails, default profile and model.
- Mode testing sandbox: up to three test cases with expected characteristics and a test-run preview before save.
- Built-in modes duplicable but not overwritable.

**Acceptance criteria**

- Prompts and custom modes persist, export, and import.
- Mode tests execute and report pass/fail per expected characteristic.
- Attempting to overwrite a built-in mode fails with a clear error.
- Custom mode instructions are still subject to the safety and fidelity contracts.

## Run 10 — Favourite OpenRouter model management

**Scope**

- Settings UI to search the OpenRouter model catalogue, add favourites, reorder them, annotate capabilities, and set a default.
- In-widget favourite-model selector for per-request model choice.
- Capability badges: structured output, tool use, context length, pricing.
- Offline fallback catalogue when the model list cannot be fetched.

**Acceptance criteria**

- Favourites persist and reorder.
- The in-widget selector changes the model for the next request only, unless pinned.
- Selecting a model that lacks tool support disables researched review with an explanation.
- The catalogue fetch failure path degrades without breaking settings.

## Run 11 — Shutdown controls and the zero-call guarantee

**Scope**

- Three levels: tab-session shutdown, per-website shutdown, and global shutdown.
- A single authoritative gate consulted before any network call, in both the content script and the service worker.
- Visible state in the popup, the badge, and the in-page widget.
- Tab-session shutdown clears on tab close; website shutdown persists; global shutdown overrides everything.

**Acceptance criteria**

- When disabled at any level, zero extension API calls are issued — asserted by a transport spy in tests.
- Precedence is global > website > tab > enabled.
- Disabled state is visible without opening settings.
- Listeners and timers are torn down, not merely ignored.

## Run 12 — Site adapters and nearby conversation context

**Scope**

- Adapters for WhatsApp Web, Gmail, LinkedIn, Slack, Notion, and a standard-editor fallback.
- Each adapter resolves the composer element, platform formatting rules, and optional nearby-conversation extraction.
- Nearby context is off by default, disclosed in the widget, limited in size, redacted of obvious secrets, and individually revocable.
- Platform formatting: no Markdown into plain WhatsApp messages, etc.

**Acceptance criteria**

- Adapter selection is host-based and unit-tested with DOM fixtures.
- Context capture never runs without explicit opt-in.
- The widget states exactly how many nearby messages will be sent, before sending.
- The standard fallback handles `input`, `textarea`, and `contenteditable`.

## Run 13 — Exact ranges, comparison, and safe application

**Scope**

- Exact issue-range underlines: CSS Custom Highlight API where available, mirror overlay for `textarea`/`input`, normalised text-to-DOM range mapping for rich editors.
- Word-level comparison view between original and proposal.
- Selection replacement, stale-range protection, Copy, Insert below, Retry, Replace, and exact Undo.
- Revalidate the original text at the range immediately before every apply.

**Acceptance criteria**

- Underlines cover the exact issue range, not the whole field.
- A stale range is detected and refuses to apply.
- Undo restores the exact prior text and caret position.
- Overlapping issues are grouped and cannot be batch-applied when stale.

## Run 14 — Tone, reader reactions, dictionary surface, and local history

**Scope**

- Tone analysis with named tone dimensions and evidence spans from the text.
- Reader-reaction simulation for a chosen audience, phrased as possible interpretations, never as fact.
- Personal dictionary management UI.
- Privacy-conscious local history: off by default, capped, auto-expiring, clearable, never exported.

**Acceptance criteria**

- Tone output cites spans from the source text.
- Reader reactions use hedged language and never assert the reader's state of mind.
- History is disabled by default, expires on a fixed TTL, and has a working Clear action.
- History never leaves the device and is excluded from exports.

## Run 15 — Naming research and evidence-backed shortlist

**Scope**

- Generate 30–50 distinctive replacement candidates.
- Check English and Arabic pronunciation and negative meanings.
- Research Chrome Web Store, app stores, GitHub, Product Hunt, general search, domains, and major social handles.
- Search USPTO, UK IPO, EUIPO, WIPO, and UAE trademark resources where publicly accessible.
- Produce an evidence-backed shortlist of three in `NAMING_RESEARCH.md`.
- Do not claim legal clearance. Pause for the owner's decision on the final name, domains, and handles, and continue all name-independent work meanwhile.

**Acceptance criteria**

- 30–50 candidates with pronunciation and Arabic-meaning notes.
- Each shortlisted name has dated, linked evidence per checked surface.
- Explicit statement that this is research, not legal clearance.
- A clear decision request for the owner.

## Run 16 — Release engineering, evidence, and store package

**Scope**

- Full test pass: unit plus browser integration.
- Real Chrome acceptance testing wherever the environment supports it; otherwise record the exact blocker and provide a reproducible manual script.
- Capture actual runtime screenshots. Never present mockups as runtime evidence.
- Validated runtime-only ZIP, SHA-256 checksum, release notes, permission rationale, privacy disclosures, final artwork, and submission checklist.
- Update `README.md`, `DEBRIEF_FOR_OPUS.md`, `PRODUCT_PLAN_V2.md`, `DESIGN_SYSTEM.md`, `PRIVACY_POLICY.md`, `STORE_LISTING.md`, `THIRD_PARTY_NOTICES.md`, design documentation, and `IMPLEMENTATION_STATUS.md`.
- Keep documentation strictly consistent with the runtime.

**Acceptance criteria**

- `npm run verify` passes end to end.
- The ZIP contains runtime files only: no keys, private text, generated secrets, unrelated files, remotely hosted executable code, or mock capabilities.
- SHA-256 checksum is published and reproducible.
- Every screenshot presented as runtime evidence was captured from the running extension, and mockups are labelled as mockups.
- Submission is described as prepared, not completed, unless it was actually submitted through an authorised publisher account.

---

## Completion definition

All 16 runs are closed only when each run's acceptance criteria are met, `npm run verify` passes, the run ledger in `IMPLEMENTATION_STATUS.md` records evidence for every run, and the documentation set matches the runtime exactly. Unfinished or failing work is not merged.
