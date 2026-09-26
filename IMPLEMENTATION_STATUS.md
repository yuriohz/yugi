# Implementation status — WriteRight v2

**Branch:** `arena/01a0dcc7-yugi`
**Plan of record:** [`EXECUTION_PLAN.md`](EXECUTION_PLAN.md)
**Last updated:** 26 September 2026

## Recovery note

The local commits `e6f74c3` (*feat: implement anti-slop multilingual rewriting suite*) and
`9cbe8b3` (*docs: add 16-run production execution plan*) are **not recoverable** in this
checkout. Evidence gathered before any work began:

| Check | Result |
|---|---|
| `git log --all` | single commit `bb404ce` (merge of PR #1) |
| `git reflog` | clone + checkout only; no prior local work |
| `git stash list` | empty |
| `gh api repos/yuriohz/yugi/branches` | `master`, `arena/01a0dbec-yugi` only |
| `gh pr list --state all` | PR #1 only, merged, no `EXECUTION_PLAN.md` |
| `git cat-file -e e6f74c3` / `9cbe8b3` | objects absent |

`EXECUTION_PLAN.md` was therefore **recreated** from `PRODUCT_PLAN_V2.md`,
`DEBRIEF_FOR_OPUS.md`, `DESIGN_SYSTEM.md`, `README.md`, the retained `design-v2/`
artefacts, and the stated core product requirements. The implementation is being rebuilt
from that recreated plan.

## Run ledger

Status values: `complete`, `in progress`, `blocked`, `not started`.

### Run 1 — Recovery, foundation, and third-party integration

| Field | Value |
|---|---|
| **Status** | complete |
| **Commit** | `aef6f3b` |
| **Tests performed** | `npm run verify` — lint (project rules, syntax, manifest, prohibited-assurance scan), secret scan over the whole tree, deterministic build, 29 unit assertions across `storage.test.js`, `json.test.js`, `slop-rules.test.js`, `scan-secrets.test.js`. |
| **Acceptance criteria** | ✅ `EXECUTION_PLAN.md`, `IMPLEMENTATION_STATUS.md`, `THIRD_PARTY_NOTICES.md` exist and are accurate. ✅ Notices name Peter Yang, MIT, the repository URL, and pinned commit `000650b156983f5159695b441477f4e63b25dc85`. ✅ `npm run build` emits a loadable MV3 `dist/` with no source maps, tests, or dev files, and fails the build if the manifest references a missing file or any remotely hosted script. ✅ `npm test` passes. ✅ Secret scan is clean. |
| **Remaining issues** | Tasks other than `proofread` intentionally raise `not_implemented` until their runs. `src/ui/*.js` are still v1 code and are rewritten in Runs 10–14. |
| **Evidence** | `dist/.build-info.json` (16 files, 71 kB); verify output recorded in the run commit. |

### Run 2 — Anti-slop engine and layered prompt composition

| Field | Value |
|---|---|
| **Status** | complete |
| **Commit** | `1ba9263` |
| **Tests performed** | `npm run verify`; 77 unit assertions total. New: `slop-detector.test.js` (15), `prompts.test.js` (14), `untrusted.test.js` (8), `slop-eval.test.js` (11), against the fixture corpus in `tests/fixtures/prose.js`. |
| **Acceptance criteria** | ✅ Every upstream rule family is represented and attributed — `slop-rules.test.js` asserts all 20 English families plus 4 WriteRight-original Arabic rules exist, and that `UPSTREAM.commit` matches the SHA pinned in `THIRD_PARTY_NOTICES.md`. ✅ The detector finds seeded slop in all 16 English and 4 Arabic fixtures and fires no high-severity rule on 5 clean human samples or 2 clean Arabic samples. ✅ Prompt composition is pure (same inputs, same string), ordered (safety → fidelity → anti-slop → mode → profile → locale → platform → output), and asserted layer by layer. ✅ Untrusted content is fenced, credential-redacted, injection-neutralised, and cannot close its own envelope. |
| **Remaining issues** | The detector is deliberately conservative: `synonym-cycling`, `fake-profound-kicker` and `formatting-slop` are marked advisory because mechanical detection produces false positives on legitimate prose. The model layer still carries those rules. |
| **Evidence** | Fixture corpus `tests/fixtures/prose.js`; detector protects fenced code, inline code, URLs, emails, quoted text and user protected terms (`protectedRegions`, asserted). |

### Run 3 — Task router, OpenRouter client, and request lifecycle

| Field | Value |
|---|---|
| **Status** | complete |
| **Commit** | `2a5ff75` |
| **Tests performed** | `npm run verify`; 155 unit assertions total. New: `openrouter.test.js` (16), `router.test.js` (20), `schema.test.js` (19), `cost.test.js` (9), `model-compat.test.js` (14). Every lifecycle branch is driven through an injected fake transport; the shutdown and compatibility paths use a `forbiddenFetch` spy that fails the test if any request is attempted. |
| **Acceptance criteria** | ✅ Unknown tasks, non-string text, empty text and oversized text are rejected before any network call. ✅ All seven tasks have strict schemas and prompt descriptions generated from the same source. ✅ Timeout, cancel and retry are unit-tested: cancellation before the first attempt makes zero calls; an abort with no user cancellation is reported as a timeout, not a cancel. ✅ 4xx is never retried (401 → 1 call); 429/5xx/network are retried to the cap with full-jitter backoff. ✅ Cost is `reported` from OpenRouter usage, `estimated` from catalogue pricing, or explicitly `unknown` — never silently zero. |
| **Remaining issues** | `rewrite`, `review`, `research_review`, `test_mode`, `tone` and `reader_reaction` builders are registered in Runs 4, 6, 7, 9 and 14. Until then they raise `not_implemented` rather than returning a plausible stub. |
| **Evidence** | Zero-call assertions in `router.test.js` for global, website and tab shutdown, model incompatibility and context overflow. Catalogue degradation path asserted: network → cache → offline fallback with a visible notice. |

### Run 4 — The five modes and guardrails

| Field | Value |
|---|---|
| **Status** | complete |
| **Commit** | `86eec69` |
| **Tests performed** | `npm run verify`; 203 unit assertions total. New: `fidelity.test.js` (16), `modes.test.js` (20), `rewrite-task.test.js` (12) driving a full rewrite through the router with a fake transport. |
| **Acceptance criteria** | ✅ Exactly five built-in modes exist, are frozen (`Object.freeze` push throws), and are duplicable into editable copies without mutating the original. ✅ Each rewrite mode carries an explicit `Must not:` list of at least four prohibitions, asserted per mode against the product plan. ✅ The fidelity checker extracts numbers, currency, percentages, dates, times, URLs, emails, @handles, identifiers, inline code and proper nouns, and flags dropped or invented instances — including Arabic-Indic digits and Arabic orthographic variants. ✅ Guardrail violations surface as warnings and block apply: dropped facts, invented deadlines, reversed positions and prohibited assurance language all set `blocked: true`; length drift and dropped proper nouns warn without blocking. ✅ `autoApply` is `false` on every rewrite result. |
| **Remaining issues** | Proper-noun extraction is deliberately approximate, so dropped names are reported as a risk rather than an error. The position-flip detector is narrow by design: it catches explicit reversals in English and Arabic, not subtle softening. |
| **Evidence** | `rewrite-task.test.js` asserts prompt layer ordering end to end (safety → fidelity → anti-slop → mode → guardrails → response contract), Egyptian Arabic for Casual, MSA for Polite, British English by default, and plain-text platform constraints reaching the prompt. |

### Run 5 — Multilingual: British English, MSA, Egyptian Arabic, RTL

| Field | Value |
|---|---|
| **Status** | complete |
| **Commit** | `ff77c74`, fixed in `30db363` |
| **Tests performed** | `npm run verify`; 254 unit assertions total, all passing. New: `british.test.js` (17), `locale-bidi.test.js` (24), `local-issues.test.js` (10). |
| **Acceptance criteria** | ✅ Default locale is `en-GB`; `color`, `center`, `catalog`, `analyze`, `traveled` and American date order are corrected with exact offsets, capitalisation preserved. `-ize` is advisory because Oxford style accepts it; meaning-sensitive pairs (`program`/`programme`, `license`/`licence`, `check`/`cheque`) are advisory with an explanation rather than a silent swap. ✅ Arabic, Latin and mixed content are detected; mixed content resolves to the dominant script rather than first-strong. ✅ Casual targets Egyptian Arabic (`ar-EG`), the other four target MSA (`ar`); the script of the text overrides the configured locale. ✅ Latin runs, URLs, emails, code spans, paths and @handles inside Arabic are wrapped in FSI/PDI isolates; isolation is presentational and reversible via `stripIsolates`. ✅ Arabic-Indic and Western digits compare equal in the fidelity checker, and Arabic orthographic variants are not treated as meaning changes. |
| **Remaining issues** | Latin punctuation inside Arabic is corrected only where Arabic surrounds it, so a comma inside an embedded English clause is left alone. This is deliberate and asserted. |
| **Evidence** | `content.css` mirrors the badge, panel, tab counter, accept button and mobile layout under `[dir="rtl"]`, sets an Arabic-capable font stack with a larger line box, and applies `unicode-bidi:isolate` to every element that renders user text. `content.js` sets the widget direction from the dominant script on every render and escapes isolated text through `escapeHtml`. |

### Run 6 — Technical Review, logic-only

| Field | Value |
|---|---|
| **Status** | complete |
| **Commit** | `d9625a7` |
| **Tests performed** | `npm run verify`; 272 unit assertions total. New: `review.test.js` (18), including four end-to-end runs through the router with a fake transport. |
| **Acceptance criteria** | ✅ Logic-only review performs exactly one call and offers no tools, asserted by call count and by `body.tools === undefined`, even when the model supports tools. ✅ Output separates findings into error / risk / improvement with counts, and each claim carries a verification status. ✅ Calibration only ever downgrades: a factual claim cannot be `supported` without evidence, citations in a sourceless review are removed, and an overall `supported` verdict is downgraded when unchecked factual claims are present. ✅ Banned certainty phrasing is stripped sentence by sentence and reported as a correction; `findCertaintyClaims` returns empty on the corrected result. ✅ The review sets `producesRewrite: false` — the improved response is a separate, explicit step. |
| **Remaining issues** | Certainty stripping is sentence-granular, so a certainty phrase embedded mid-sentence removes the whole sentence. That is the safe direction, and the removal is reported to the user. |
| **Evidence** | `REVIEW_INSTRUCTION` asserted to cover internal consistency, causal chain, unstated assumptions, missing constraints, terminology, supplied calculations, and whether the text answers the message it replies to. |

### Run 7 — Researched Technical Review with OpenRouter web search

| Field | Value |
|---|---|
| **Status** | complete |
| **Commit** | `0272f0f` |
| **Tests performed** | `npm run verify`; 300 unit assertions total. New: `research.test.js` (28), including six end-to-end runs through the router. |
| **Acceptance criteria** | ✅ Uses the current `openrouter:web_search` **server tool** via the `tools` array, not the deprecated `plugins: [{id:"web"}]` surface. Verified against OpenRouter's server-tool documentation on 26 September 2026. ✅ Citations are parsed from `message.annotations[].url_citation`, tolerating both the nested and flat shapes, with `[...]` excerpt markers normalised; `usage.server_tool_use.web_search_requests` is surfaced. ✅ A claim can only be `supported` if a citation the search actually returned backs it — an invented URL is stripped and the claim downgraded, asserted end to end. ✅ Non-HTTP schemes (`javascript:`, `data:`) are rejected. ✅ Contradictions set `applyBlocked: true` until each is acknowledged. ✅ Research never runs implicitly: a run without `options.research === true` is refused with zero network calls. ✅ Source snippets are wrapped as untrusted data. |
| **Remaining issues** | Some native-search providers return no annotations at all (Anthropic and Google native search). When that happens there are no usable sources, the verdict degrades to `unverifiable`, and the user is told — rather than the model's uncited claims being trusted. |
| **Evidence** | Sources the model ignored are still displayed so the user can see what was searched, but are excluded from the evidence count. `supportedClaimsOnly` gates which claims may feed a later rewrite and returns a reason for every exclusion. |

### Run 8 — Profiles, voice samples, terminology, dictionary, import/export

| Field | Value |
|---|---|
| **Status** | complete |
| **Commit** | `5a6e864` |
| **Tests performed** | `npm run verify`; 347 unit assertions total. New: `profiles.test.js` (25), `transfer.test.js` (22). |
| **Acceptance criteria** | ✅ Profiles validate name, audience, relationship, voice description, formality and directness scales, greeting, sign-off, preferred/blocked/protected terms, voice samples and per-site rules. Control characters are stripped from every text field before it can reach a prompt. ✅ Contradictions are refused: a term cannot be both preferred and blocked, or protected and blocked. ✅ Voice description reports measured counts with an explicit `basis` line stating they are counts, not a judgement. ✅ Dictionary entries are scoped global / per-profile / per-site, support case sensitivity, are capped, and suppress matching issues. ✅ **Export never contains the API key**: it is deleted explicitly, `apikey`/`token`/`secret`/`password`/`history` are stripped at any depth, settings are exported from a whitelist, and every remaining string value is credential-redacted. The exported file states this promise in its own `notice` field. ✅ **Import never writes a credential**, rejects non-https endpoints, drops unknown fields, neutralises prototype pollution, refuses foreign/oversized/newer-version files with a specific reason, and reports what it will replace before anything is written. |
| **Remaining issues** | Voice samples are capped at 5 × 1,200 characters to bound prompt size. Longer samples are truncated rather than rejected, and the truncation is reported. |
| **Evidence** | `planImport` is pure — asserted to write nothing to storage. `applyImport` preserves an existing API key rather than overwriting or clearing it, also asserted. |

### Run 9 — Saved prompts, custom modes, and mode testing

| Field | Value |
|---|---|
| **Status** | complete |
| **Commit** | `83070b3` |
| **Tests performed** | `npm run verify`; 369 unit assertions total. New: `custom-modes.test.js` (22), including four end-to-end runs. |
| **Acceptance criteria** | ✅ Custom modes validate name, summary, description, colour, operation, Arabic register, research policy, guardrails, instruction, must-not list and test cases. ✅ **A custom mode cannot relax safety.** Six classes of escape attempt are refused with a specific reason: overriding prior instructions, asking for invented facts or sources, asking for undetectability, asking to reveal the system prompt or key, asking to impersonate, and asking to always agree with the writer. An ordinary instruction that merely mentions facts is not refused. ✅ `preserveFacts` and `neverAutoApply` are forced on and cannot be switched off. ✅ Built-ins cannot be overwritten or shadowed by name; duplicating one produces a valid custom mode. ✅ Saved prompts run through the same forbidden-instruction check, support `{{placeholder}}` substitution, and leave unknown placeholders visible rather than silently emptying them. ✅ Mode testing runs the mode and returns **WriteRight's own** guardrail and fidelity verdict alongside the model's self-assessment, with `passed` decided by the deterministic check — asserted by a case where the model claims success on an output that invented a date. |
| **Remaining issues** | The forbidden-instruction check is pattern-based and cannot catch every paraphrase. It is a second line of defence; the primary protection is prompt layer ordering, asserted end to end in this run. |
| **Evidence** | `custom-modes.test.js` asserts that in a real rewrite the safety contract still precedes the custom mode text in the composed prompt. |

### Run 10 — Favourite OpenRouter model management

| Field | Value |
|---|---|
| **Status** | not started |

### Run 11 — Shutdown controls and the zero-call guarantee

| Field | Value |
|---|---|
| **Status** | not started |

### Run 12 — Site adapters and nearby conversation context

| Field | Value |
|---|---|
| **Status** | not started |

### Run 13 — Exact ranges, comparison, and safe application

| Field | Value |
|---|---|
| **Status** | not started |

### Run 14 — Tone, reader reactions, dictionary surface, and local history

| Field | Value |
|---|---|
| **Status** | not started |

### Run 15 — Naming research and evidence-backed shortlist

| Field | Value |
|---|---|
| **Status** | not started |

### Run 16 — Release engineering, evidence, and store package

| Field | Value |
|---|---|
| **Status** | not started |

## Environment constraints

| Constraint | Effect | Recorded |
|---|---|---|
| No Chrome or Chromium binary is installed in the sandbox | Real-browser acceptance testing cannot run here. Browser-integration tests use a DOM harness; a reproducible manual Chrome script is provided instead. | Run 1 |

## Honest claims register

Statements this project will not make, and how they are enforced:

| Claim | Enforcement |
|---|---|
| Output is undetectable / guaranteed human / guaranteed correct | `tools/lint.js` prohibited-assurance scan over all shipped JS, HTML and Markdown |
| "You are right" | `VERDICTS`/`VERDICT_LABELS` vocabulary in `src/core/constants.js`; validation in later runs |
| Chrome Web Store submission is complete | Submission is described as *prepared*. It is not complete unless actually submitted through an authorised publisher account. |
| The product is legally cleared to use a given name | Run 15 produces research, not legal clearance. |
