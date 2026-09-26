# Opus review decisions

**Date:** 26 September 2026
**Branch:** `arena/01a0de07-yugi`
**Answers to:** §10 of `DEBRIEF_FOR_OPUS.md` (the eight reviewer prompts for Opus)

Each decision below changed code, tests, or both. Nothing here is advisory-only:
every answer points at the module that enforces it and the test that asserts it.

---

## Q1 — Is the guardrail layer the right place to block?

**Decision: keep the hard block, but make the override informed.**

The split stays: dropped or invented facts and reversed positions block;
dropped proper names warn. What changed is that the blocked-apply banner now
lists the exact blocking violations verbatim, instead of a generic sentence
about facts and dates. The override checkbox reads "I have read each warning
above", and the acknowledgement resets on every run, so it cannot be carried
from one result to the next.

- Code: `renderRewriteBody` in `src/ui/render.js`
- Reset: `runSelected` in `src/content/content.js` sets `acknowledged = false`
- Tests: `ui-render.test.js` ("a blocked rewrite names its violations")

## Q2 — Is `stripCertainty` too blunt?

**Decision: yes, so it now works at clause granularity.**

A banned certainty phrase removes only the clause that contains it, provided
the surviving clauses still say something on their own (at least 24
non-punctuation characters). Otherwise the whole sentence is dropped, as
before. A surviving clause must be free of *every* banned phrase, not just the
first one found — a sentence can offend twice, and the old code would have kept
the second offence. Removals are reported exactly as before.

- Code: `stripCertainty` in `src/core/review.js`
- Tests: `review.test.js` (clause-keeping, double-offence, stub-remainder)

## Q3 — Is the two-switch consent model too much friction?

**Decision: keep both switches; show them together where the text is written.**

The global preference and the per-site consent remain independent and both
default off. What changed is the widget: the rewrite composer now shows both
states side by side, with the missing one actionable in place ("Switch on" for
the global preference, "Allow on this site" for the consent). Previously the
footer offered site consent even when the global switch made it meaningless,
with no explanation. The disclosure line still states exactly what would be
sent, and the settings page still holds the global switch.

- Code: `renderContextControls` in `src/ui/render.js`, composer wiring in
  `src/content/content.js`
- Tests: `ui-render.test.js` (three consent states), `ui-protocol.test.js`

## Q4 — Should researched review be permitted on unknown tool support?

**Decision: no — but the refusal moved to the widget and became actionable.**

A silent tool failure would produce uncited claims, the worst outcome in this
product, so unknown stays refused. Two things make the refusal bearable:

1. Favourites are decorated with real capabilities from the cached catalogue,
   shown as badges in settings and in the in-widget model selector. A model
   without tool support is labelled "no web research" before it is picked.
2. The research toggle disables itself up front when the selected model lacks
   tools or its capabilities are unknown, stating the reason and the remedy
   (refresh the catalogue in settings) instead of failing after the click.

Two constraints were honoured. The snapshot reads the catalogue **cache only**,
so opening the panel while switched off issues no request and the zero-call
guarantee holds; an empty cache renders honestly as "capabilities unknown". A
successful key test warms the cache, so badges work immediately after
onboarding.

- Code: `getCachedCatalogue` in `src/background/model-catalogue.js`,
  `researchAvailability` and `capabilityBadges` in `src/ui/render.js`,
  snapshot decoration and cache warming in `src/background/service-worker.js`
- Tests: `ui-render.test.js`, `ui-protocol.test.js` (cache-only snapshot)

## Q5 — Is the Arabic register split right?

**Decision: keep the mode defaults; add per-profile dialect selection.**

Casual still defaults to Egyptian Arabic and the other four to MSA, but a
profile can now pin its Arabic dialect: "Modern Standard Arabic everywhere" or
"Egyptian Arabic everywhere". An explicit profile choice wins over the mode
default; without one, the mode default applies exactly as before. A Gulf or
Maghreb user is therefore not forced into Egyptian Casual, and an Egyptian
user can hold Egyptian across every mode. The script of the text still wins
over every preference: English text never comes back Arabic.

- Code: `resolveLocale` in `src/core/locale.js`, profile locale control in
  `src/ui/options.html` / `src/ui/options.js`
- Tests: `locale-bidi.test.js` (precedence matrix)

## Q6 — Is the anti-slop advisory tier calibrated correctly?

**Decision: mostly, with one recalibration — the em-dash budget.**

The advisory rules (`synonym-cycling`, `fake-profound-kicker`,
`formatting-slop`, `empty-adverb`, `empty-phrase`, the Arabic connectives and
padding) stay advisory: mechanical detection of those genuinely produces false
positives. What changed is the post-flight em-dash budget, which failed a
rewrite for a *single* em dash in short copy. A lone em dash is usually
deliberate punctuation, not a crutch, and flagging every one trains the writer
to ignore the warning. The budget now allows one dash anywhere and two in
longer drafts; two dashes in short copy still fail.

- Code: `emDashBudget` in `src/core/slop-detector.js`
- Tests: `slop-detector.test.js`, `slop-eval.test.js` (two-dash short copy
  still fails)

## Q7 — Does the honest-claims posture go far enough, or too far?

**Decision: keep the calibrated vocabulary; explain it in plain language.**

The five verdict labels are unchanged — they are exact, and exactness is the
point. Each now carries a one-line plain-language explainer shown under the
verdict in the review panel ("A factual claim about the outside world that has
not been checked against a source", and so on). `DESIGN_SYSTEM.md` §8, which
listed a different four-label set, was aligned to the five shipped labels.

- Code: `VERDICT_EXPLAINERS` in `src/core/constants.js`, verdict block in
  `renderReviewBody`
- Docs: `DESIGN_SYSTEM.md` §8
- Tests: `ui-render.test.js` (explainer present, no certainty claim)

## Q8 — Is the coverage the right shape?

**Decision: the negative-path bias stays; the new behaviour is covered.**

This change adds 20 unit assertions and 1 integration journey (492 unit + 16
integration, all passing), following the same bias toward refusals and
degradations: unknown capabilities refuse before running, hostile modes and
prompts are skipped on import, stale consent states explain themselves, and a
grounded draft demonstrably carries its supported claims while forbidding the
contradicted ones.

---

## Adjacent gaps closed in the same change

These were not reviewer questions, but the brief's evidence made them visible:

| Gap | Fix |
|---|---|
| Tone and reader-reaction tasks existed with no way to run them | New Insights tab in the widget: Check tone, Preview reader reactions, optional audience; read-only renderers with quoted evidence and the hedged caveat |
| Research ran with no cost disclosure in the widget | The composer shows the research disclosure (searches, OpenRouter charges) when the toggle is on, and a cost line when it is off |
| The review contradiction banner promised per-source acknowledgement but rendered one checkbox gating nothing | Contradictions are a per-source reading checklist; the copy no longer claims to block an apply that does not exist (a review produces no replacement text) |
| Technical Review dead-ended: no way to draft the improved response the product plan requires | "Draft response from N supported claims" runs a rewrite constrained to supported claims via a new grounding layer; the result is labelled with its claim counts |
| Saved prompts had validation but no storage, UI, or transfer path | `WR_SAVE_PROMPT` / `WR_DELETE_PROMPT`, a settings section, and import/export round-trip |
| Imported custom modes and prompts skipped the forbidden-instruction check the settings form enforces | Imports now validate through the same validators; offenders are skipped with a warning |
| `decorateFavourites` and `recordUse` were tested but never called | The snapshot decorates from the cache; task runs record use for selector ordering |
| The popup had two buttons doing the same thing, and the site toggle read like a consent grant | One "Open settings" button; the site toggle reads "Off for {host} only" |
| Stale documentation | Counts, branch references, build sizes, and verdict labels reconciled (see `IMPLEMENTATION_STATUS.md`) |

## Deliberately deferred

- **In-page prompt runner.** Saved prompts persist, validate, export, and
  import; running one from the widget needs a router task that does not exist
  yet. Custom modes already cover reusable instructions in the widget.
- **Real-browser acceptance, runtime screenshots, the public name, and store
  submission.** Unchanged from the brief: impossible from this environment,
  owned elsewhere.
