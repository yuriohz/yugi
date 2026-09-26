# WriteRight — Engineering and Product Debrief

**Prepared:** 26 September 2026
**Repository:** `yuriohz/yugi`
**Working branch:** `arena/01a0dcc7-yugi`
**Version:** 2.0.0
**Supersedes:** the v1.0.0 debrief of the same date. §5 answers every question that version asked.

---

## 1. Executive summary

v1 was a proofreader: one prompt, whole-field underlines, English only, roughly 1,400
lines. v2 is a different product built around a single constraint — **the extension must
never put words in your mouth** — and the architecture exists to enforce that rather than
to request it politely in a prompt.

The change in kind, not degree:

| | v1 | v2 |
|---|---|---|
| Capabilities | proofread | proofread, rewrite in 5 modes, logic review, researched review, mode testing, tone, reader reaction |
| Correctness of output | trusted the model | tolerant parse → strict schema → guardrail enforcement → fidelity check, and apply is blocked on failure |
| Underlines | whole field | exact character ranges via the CSS Custom Highlight API |
| Stale suggestions | compared `original` at fixed offsets | fingerprint + relocation; ambiguous targets are discarded, never approximated |
| Languages | English | British English by default, Modern Standard Arabic, Egyptian Arabic, full bidi handling |
| Off switch | one boolean | three independent scopes with a tested zero-call guarantee |
| Context | none | per-site adapters, twice-opt-in, previewed before sending |
| Tests | none | 461 unit + 15 integration assertions |
| Build | copy files into a ZIP | esbuild bundle, allow-listed package, remote-code refusal, SHA-256 |

**Everything the product refuses to claim is enforced in code**: a lint rule fails the
build if "undetectable", "guaranteed human", "guaranteed correct" or "you are right"
appears in any shipped file, outside the modules whose job is to forbid them.

---

## 2. Recovery note

Two commits from a previous session — `e6f74c3` and `9cbe8b3` — were unrecoverable.
Checked before any work began: `git log --all`, `git reflog` (two entries, clone and
checkout), `git stash list`, `gh api .../branches`, `gh pr list --state all`, and
`git cat-file -e` on both hashes. All negative.

`EXECUTION_PLAN.md` was therefore **recreated** from `PRODUCT_PLAN_V2.md`,
`DEBRIEF_FOR_OPUS.md` (v1), `DESIGN_SYSTEM.md`, `README.md` and the retained `design-v2/`
artefacts, and the implementation was rebuilt from it across 16 runs. Evidence table in
`IMPLEMENTATION_STATUS.md`.

---

## 3. Architecture

### 3.1 Layout

```
src/core/         pure logic, no browser API, 100% of the test surface
src/background/   service worker, router, transport, model catalogue
src/content/      in-page widget, exact-range highlighting
src/ui/           popup, options, onboarding
```

`src/core` imports nothing from `chrome.*`. That is what makes 461 unit assertions
possible without a browser, and it is the single most valuable structural decision in the
rebuild.

### 3.2 The five invariants

Each is enforced at a choke point and asserted by tests, not left to convention.

**1. The service worker owns every network call.** The content script holds no key and no
transport. A compromised page can ask for work; it cannot make a request.

**2. The shutdown gate runs first, twice.** Once in the service worker message handler,
once inside `runTask`. Both run before the model catalogue is consulted, so a disabled
extension does not even perform a capability lookup.

**3. Prompt layers are ordered so a later layer cannot relax an earlier one.**

```
safety → fidelity → anti-slop → mode → profile → locale → platform → untrusted → output
```

`composeSystemPrompt` is pure — same inputs, same string — and the ordering is asserted
end to end, including with a hostile custom mode present.

**4. Model output is untrusted.** Tolerant JSON extraction (fences, prose wrappers,
trailing commas, prototype-pollution stripping) → strict schema validation against
`task-schemas.js` → task post-processing → guardrail enforcement. A response that fails
any stage produces an error, never a partial result presented as success.

**5. Nothing generative is ever auto-applied.** `autoApply: false` is on every rewrite
result, and `neverAutoApply` is a guardrail a custom mode cannot switch off.

### 3.3 The guardrail layer

This is where v2 differs most from v1. After the model responds:

- **Fidelity check** extracts numbers, currency, percentages, dates, times, URLs, emails,
  @handles, identifiers, code spans and proper nouns from the original and compares them
  against the proposal. Arabic-Indic digits normalise, so `٤٥٠` and `450` compare equal;
  Arabic orthographic variants normalise, so `إلى` and `الي` do not read as a change.
- **Position-flip detection** in English and Arabic. A refusal rewritten into agreement
  blocks apply.
- **Anti-slop re-evaluation.** Slop the model *introduced* is a failure, weighted
  separately from slop it failed to remove.
- **Proportional-edit bounds.** A rewrite at 40% of the original length usually means
  character was stripped; at 220% it usually means material was added.
- **Prohibited-assurance scan** on the output text itself.

A dropped fact, an invented date, a reversed position or an assurance claim sets
`blocked: true`, and the UI cannot apply a blocked result.

### 3.4 Untrusted content

Page text, quoted conversation and web-search results all pass through
`src/core/untrusted.js`: credential redaction, injection neutralisation, and an envelope
the content cannot close because the fence is escaped inside it. The accompanying prompt
clause states the content is data and must never be followed as instruction.

This reduces prompt injection. It does not eliminate it, and nothing in the product says
otherwise.

---

## 4. Verification

```
npm run verify     # lint, secret scan, build, unit tests, integration journeys
npm run package    # validated runtime archive + SHA-256
```

| Stage | Result |
|---|---|
| Lint — syntax, manifest validity, prohibited assurance claims, `console.log` ban | clean, 136 files |
| Secret scan over the whole tree | clean |
| Build | 16 files, 204.3 kB |
| Unit | **461 assertions, 0 failures** |
| Integration journeys | **15, 0 failures** |
| Package | 17 entries, 68.2 kB, allow-list enforced |

The tests that matter most are the negative ones:

- **Zero-call sweep.** All seven tasks × three shutdown scopes, driven through a fetch spy
  that throws on any call. 21 assertions that nothing left the browser.
- **Invented-citation stripping.** A researched review citing a URL the search never
  returned has the citation removed and the claim downgraded, end to end.
- **Model self-assessment overruled.** A mode test where the model marks its own output as
  passing, on an output that invented a date, still fails.
- **Export contains no key.** Asserted against an explicit delete, a depth-wise key strip,
  a settings whitelist, and a per-string credential redaction — four independent
  mechanisms, each tested.
- **Import never writes a key**, and an existing key survives an import rather than being
  cleared.

---

## 5. Answers to the v1 reviewer questions

v1 §9 asked seven questions. Each now has an implementation and a location.

### 5.1 Is broad host permission justified, or should it become optional per-site?

**Justified for this version; optional per-site is the correct next step and is not
implemented.** Reasoning, alternatives considered, and the rejection of each are written
up in `docs/PERMISSIONS.md`, which the packaging step checks against the manifest and
refuses to package without.

The honest position: a fixed site list breaks on internal tooling, which is where most
professional writing happens. `activeTab` alone would require a toolbar click on every
page. Optional host permissions are the right long-term shape, and the README lists this
as limitation 7 rather than pretending it is done.

What blunts the permission in practice: the content script attaches only on focus of an
editable field; nearby context needs two opt-ins; and the zero-call guarantee means a
disabled extension with `<all_urls>` makes no requests at all.

### 5.2 Is `chrome.storage.local` acceptable for BYOK credentials?

**Yes, for this threat model, and the alternative is worse.** `storage.sync` would copy
the key to Google's servers, which is a real and avoidable exposure; the extension
deliberately does not use it. There is no OS keychain available to an extension.

What was added in v2 beyond v1: the key is never returned to any UI surface
(`GET_STATE` strips it and returns only `hasKey`), it is excluded from exports by four
independent mechanisms, it is never written by an import, and the credential scanner runs
over the repository, over every packaged file, over exports, over captured page context
and over history entries.

The residual risk — local malware or profile access — is stated in §7 rather than
engineered away, because it cannot be.

### 5.3 Does the prompt/output contract handle enough model variation?

**Yes, and it degrades rather than failing.** `src/core/model-compat.js` derives
capabilities from the catalogue's `supported_parameters`:

- No `response_format`? The field is omitted — some providers reject it outright — the
  prompt asks for JSON in prose, and the tolerant parser recovers it. A warning is
  surfaced.
- No tool support? Researched review is **blocked with an explanation**, before any
  request. Capability unknown is treated the same as absent, because a silent tool failure
  produces uncited claims, which is the worst outcome in the product.
- Context window known and too small? Refused before the call, with the numbers stated.
- Catalogue unreachable? Network → cache → offline fallback list, with a visible notice
  saying the data may be stale.

### 5.4 Is contenteditable replacement safe for React-controlled editors and WhatsApp Web?

**Improved, and still the weakest area.** The native setter is invoked through the
prototype descriptor so React's value tracker sees the change, and a bubbling
`InputEvent` with `inputType: 'insertReplacementText'` is dispatched. Highlighting uses
the CSS Custom Highlight API specifically so the page's own DOM is never mutated — the
alternative, wrapping text in spans, breaks controlled editors.

**This cannot be verified without a browser, and has not been.** It is section C of
`docs/MANUAL_TEST_PLAN.md`.

### 5.5 Should exact-range verification block stale suggestions before release?

**Yes, and it does.** `src/core/ranges.js` fingerprints every issue — the exact slice plus
a window either side — and relocates it against the current text before applying. Three
outcomes: unchanged in place; found shifted, and applied at the new offsets; or **not
uniquely locatable, and discarded**. The third case is the important one. Applying an
approximate range edits the wrong words, which is worse than doing nothing.

Undo restores the exact previous string and caret from WriteRight's own bounded stack,
because many editors clear their native undo when a value is set programmatically.

### 5.6 Do the privacy disclosures satisfy Limited Use expectations?

**They are written to.** `PRIVACY_POLICY.md` was rewritten for v2, and
`docs/SUBMISSION_CHECKLIST.md` §6 pre-answers every dashboard question with the basis for
each answer. The three Limited Use certifications are all truthfully "yes" — there is no
backend, so there is nothing to sell, transfer or repurpose.

Whether a reviewer agrees is their call, not something this repository can assert.

### 5.7 Is a first-party proxy warranted?

**No, and it would make the product worse.** A proxy would create exactly the thing the
architecture avoids: a server that sees every user's writing and holds credentials.
"There is no WriteRight server" is a stronger privacy statement than any policy text, and
it is only true because there is no proxy.

The things a proxy would have bought were solved locally instead: schema normalisation in
`task-schemas.js`, model variation in `model-compat.js`, and abuse control is moot when
the user pays their own OpenRouter bill.

---

## 6. Status of the eight v1 limitations

| # | v1 limitation | v2 status |
|---|---|---|
| 1 | No real-browser QA | **Still open.** No Chrome binary here and browser downloads are blocked at the network layer. `docs/MANUAL_TEST_PLAN.md` written for a human to run |
| 2 | Rich editors need site adapters | **Addressed.** Adapters for WhatsApp Web, Gmail, LinkedIn, Slack, Notion, plus a generic fallback, each with multiple candidate selectors and a fail-safe that returns no context rather than the wrong context |
| 3 | Underline precision | **Addressed for contenteditable** via the CSS Custom Highlight API, with severity colours and overlap flattening. `<input>`/`<textarea>` keep a field marker — they contain no text nodes — and the panel lists the exact text. Documented, not hidden |
| 4 | Offset robustness | **Addressed.** See §5.5 |
| 5 | Model compatibility | **Addressed.** See §5.3 |
| 6 | No automated tests | **Addressed.** 461 unit + 15 integration assertions. Playwright extension tests remain impossible here for the same reason as #1 |
| 7 | Store privacy form | **Prepared.** Every answer pre-written with its basis in `docs/SUBMISSION_CHECKLIST.md` §6. The dashboard action itself needs a publisher account |
| 8 | Support identity | **Still open.** GitHub Issues remains the contact route. Depends on the naming decision |

---

## 7. Known limitations, current

1. **No real-browser acceptance testing.** The largest gap. Nothing in §5.4, and nothing
   visual, has been confirmed in Chrome.
2. **Exact-range underlines need text nodes.** Plain inputs and textareas get a
   field-level marker.
3. **Site adapters depend on selectors that sites change without notice.** Mitigated by
   multiple candidates and a fail-safe, not eliminated.
4. **Proper-noun extraction is approximate**, so a dropped name warns rather than blocks.
   Blocking on an approximate signal would train users to ignore the warning.
5. **Position-flip detection is narrow by design.** It catches explicit reversals, not
   subtle softening of a boundary.
6. **Custom-mode validation is pattern-based** and cannot catch every paraphrase. It is a
   second line of defence; prompt layer ordering is the first.
7. **Prompt injection is reduced, not solved.**
8. **Some native-search providers return no citation annotations** (Anthropic and Google
   native search). The verdict then degrades to *unverifiable* rather than trusting the
   model's uncited claims.
9. **`<all_urls>`.** See §5.1.
10. **`chrome.storage.local` is not an OS secrets vault.** See §5.2.
11. **The public name is unresolved.** See §9.

---

## 8. Release recommendation

**Do not publish yet.** Three blockers, in order:

1. **Run `docs/MANUAL_TEST_PLAN.md` in Chrome.** Sections C (exact ranges) and E (Arabic
   RTL) cover behaviour that has no automated coverage at all. Sections F and G verify the
   two claims the product makes most loudly — that logic review searches nothing, and that
   a disabled extension calls nothing — in DevTools rather than in a test double.
2. **Capture five real runtime screenshots.** The three currently in `store-assets/` are
   mockup-derived and labelled not store-ready. Shipping a mockup as a screenshot is both
   a store policy violation and a false statement about the product.
3. **Resolve the name.** See §9.

Everything else is done: the package validates, the checksum is emitted, the permission
rationale is written and machine-checked against the manifest, the privacy disclosures
are pre-answered, and the submission checklist distinguishes what is complete from what
is blocked and on whom.

**The extension has not been submitted to the Chrome Web Store.** No upload has been made
through any publisher account.

---

## 9. Naming — to be redone

Run 15 produced `NAMING_RESEARCH.md`: 42 candidates, screened against nine criteria
including Arabic phonology, with a shortlist of **Saqel**, **Tanqih** and **Sabk**, and
live ICANN RDAP evidence for 14 domains.

**This run is being redone in a separate session**, so treat the current shortlist as
provisional input rather than a conclusion. Two things from it are worth carrying forward
regardless:

- **The method held up.** RDAP is queryable and gives real registration dates and
  registrar nameservers, which is what exposed `usewazn.com` as an active project and
  killed that candidate.
- **The gap is real and must be closed elsewhere.** No trademark register could be queried
  from this environment — USPTO, UK IPO, EUIPO and WIPO all require JavaScript or an
  authenticated session. **No trademark search has been performed, and no claim of legal
  clearance is made anywhere in this repository.** A redo should either run from an
  environment with register access or hand that step to a professional.

Until a name is chosen, `src/core/constants.js` carries
`PUBLIC_NAME_STATUS = 'provisional'` so the state is visible in the code rather than only
in a document. The working name must not be published: its conflicts are documented in
`NAMING_RESEARCH.md` §1.

---

## 10. Reviewer prompts for Opus

The v1 questions are answered in §5. These are the ones v2 raises.

1. **Is the guardrail layer the right place to block?** A dropped number blocks apply. Is
   hard blocking correct, or should a fidelity failure be a prominent warning the user can
   override, given that a false positive on an approximate extractor trains people to
   ignore it? The current split — facts block, names warn — is a judgement call.

2. **Is `stripCertainty` too blunt?** It removes a whole sentence containing a banned
   certainty phrase and tells the user it did. Sentence granularity is the safe direction,
   but it can remove useful content around the offending phrase.

3. **Is the two-switch consent model for nearby context too much friction?** Global
   preference *and* per-site consent. It is deliberately conservative. Does it make a
   genuinely useful feature undiscoverable?

4. **Should researched review be permitted on a model with unknown tool support?**
   Currently it is refused, because a silent tool failure yields uncited claims. The cost
   is that a legitimate model missing from the catalogue cannot be used for research at
   all.

5. **Is the Arabic register split right?** Egyptian Arabic for Casual, MSA for the other
   four. Correct for Egypt and defensible across the Levant; a Gulf or Maghreb user may
   find Egyptian colloquial as foreign as MSA is stiff. Is per-profile dialect selection
   needed before launch, or after?

6. **Is the anti-slop advisory tier calibrated correctly?** `synonym-cycling`,
   `fake-profound-kicker`, `formatting-slop`, `em-dash-crutch`, `-ize` spellings and
   meaning-sensitive word pairs are advisory because mechanical detection produces false
   positives. Too cautious, or not cautious enough?

7. **Does the honest-claims posture go far enough, or too far?** The product refuses to
   say output is undetectable, human, or correct, and refuses to tell the user they are
   right. Commercially this is unusual. Is the calibrated-verdict vocabulary
   (*Supported by the provided context* / *Needs verification* / *Conflicts with the
   source*) clear enough to a non-technical user, or does it read as evasive?

8. **Is 461 unit assertions the right shape of coverage?** The bias is heavily toward
   negative paths and refusals. Is anything important untested that is *not* blocked on a
   browser?
