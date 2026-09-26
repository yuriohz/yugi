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
| **Status** | not started |

### Run 4 — The five modes and guardrails

| Field | Value |
|---|---|
| **Status** | not started |

### Run 5 — Multilingual: British English, MSA, Egyptian Arabic, RTL

| Field | Value |
|---|---|
| **Status** | not started |

### Run 6 — Technical Review, logic-only

| Field | Value |
|---|---|
| **Status** | not started |

### Run 7 — Researched Technical Review with OpenRouter web search

| Field | Value |
|---|---|
| **Status** | not started |

### Run 8 — Profiles, voice samples, terminology, dictionary, import/export

| Field | Value |
|---|---|
| **Status** | not started |

### Run 9 — Saved prompts, custom modes, and mode testing

| Field | Value |
|---|---|
| **Status** | not started |

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
