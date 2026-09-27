# WordSaffron v2 product and implementation plan

> **Rename note (27 September 2026):** this plan was written under the working name
> WriteRight. The approved public name is now **WordSaffron**. The body below is
> preserved as the historical record and still uses the working name.

**Status:** design proposal for approval  
**Date:** September 26, 2026  
**Primary use case:** rewrite existing text into natural, specific, non-generic prose while preserving the user's meaning and helping the user avoid incorrect or weak responses.

## 1. Decisions confirmed

- Five first-class modes will ship: Polish, Casual, Polite, Professional & Firm, and Technical Review.
- Technical Review will be hybrid: logic-only review by default, with an explicit researched review that searches the web and cites sources.
- The prompt system will combine a simple reusable template library with richer personal/work profiles and voice samples.
- Design and actual design screenshots come before implementation. Runtime development starts only after design approval.

## 2. Research basis

### Grammarly capabilities relevant to WriteRight

Grammarly's current writing surface combines real-time correctness with AI Chat, paraphrasing, reader-reaction simulation, humanization, citation discovery, AI-pattern rewriting, plagiarism checking, grading, and authorship tracking. Its extension experience also includes grammar, clarity, tone, word-choice suggestions, sentence rewrites, audience-oriented feedback, and one-click application. See Grammarly's [official Docs feature guide](https://support.grammarly.com/hc/en-us/articles/38552281546765-Docs-Grammarly-s-new-AI-writing-surface) and [official Firefox extension listing](https://addons.mozilla.org/en-US/firefox/addon/grammarly-1/).

The relevant feature families are:

1. Real-time spelling, grammar, punctuation, word choice, and correctness.
2. Clarity, concision, fluency, and full-sentence rewrites.
3. Tone detection and goal-based tone transformation.
4. Contextual drafting and reply generation.
5. Paraphrasing with meaning preservation.
6. Reader reactions and audience interpretation.
7. Humanization and common-AI-pattern rewriting.
8. Fact checking, citation finding, and research assistance.
9. Plagiarism and AI-content checks.
10. Personal voice, brand tones, style guides, and snippets.
11. Explanations that teach why a suggestion is being made.
12. Cross-site operation, document context, undo, and explicit acceptance.

### Current WriteRight gap analysis

| Capability | Current v1 | v2 priority |
|---|---:|---:|
| Basic grammar/spelling suggestions | Yes | Improve |
| Individual and accept-all actions | Yes | Improve |
| Rewrite selected text | No | P0 |
| Five purpose-built modes | No | P0 |
| Before/after comparison | No | P0 |
| Preserve meaning and facts contract | Limited | P0 |
| Anti-slop humanization | No | P0 |
| Saved prompts/custom modes | No | P0 |
| Personal/work writing profiles | No | P0 |
| Technical and logical review | No | P0 |
| Researched review with citations | No | P0 |
| Tone analysis | No | P1 |
| Reader reaction preview | No | P1 |
| Length controls | No | P1 |
| Reply from surrounding context | No | P1 |
| Personal dictionary/style rules | No | P1 |
| Undo and rewrite history | No | P1 |
| Inline exact-range underlines in plain inputs | Partial | P1 |
| Plagiarism database | No | Defer/partner |
| AI detector | No | Defer; unreliable as proof |
| Authorship tracking | No | Defer |
| Team administration/analytics | No | Out of initial scope |

## 3. Anti-slop foundation

**Superseded during implementation.** The anti-slop backbone is [`petergyang/no-ai-slop`](https://github.com/petergyang/no-ai-slop), MIT licensed, pinned at commit `000650b156983f5159695b441477f4e63b25dc85`. Attribution and the mapping from upstream artefacts to vendored files is in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md); the rules are encoded in `src/core/slop-rules.js`. Its rules target banned vocabulary, often-empty adverbs and phrases, binary contrasts, throat-clearing openers, faux-insight setups, colon reveals, superficial participle analysis, importance puffery, interpretive metadiscourse, weasel attribution, fake-strong verbs, synonym cycling, negative listing, dramatic fragmentation, rhetorical setups, fake-profound kickers, summary-recap endings, formatting slop and em-dash overuse. The project explicitly warns against over-correction and preserves meaning when a banned-word rewrite would damage accuracy.

> The earlier draft of this plan named `haidrrrry/humanize-ai-writing` as the starting reference. That was > replaced before implementation began. It is recorded in `THIRD_PARTY_NOTICES.md` under > “referenced but not included”: no code or rule content from it was used.

WriteRight should adapt and attribute the rules rather than copy them silently. The MIT notice must be preserved in `THIRD_PARTY_NOTICES.md`. We should also borrow the stronger safety idea from fidelity-first de-slop systems: if a passage is hollow because it lacks facts, flag it instead of inventing substance.

### Shared rewrite contract

Every mode should inherit these non-negotiable rules:

- Preserve the author's meaning, position, names, numbers, URLs, commitments, and factual claims.
- Do not invent facts, experience, evidence, quotations, urgency, or emotional intent.
- Use plain, specific words instead of inflated language.
- Remove generic AI phrases only when removal preserves meaning.
- Vary sentence rhythm naturally; do not inject fake slang, typos, fragments, or quirks merely to appear human.
- Keep platform-appropriate formatting. Do not return Markdown into a plain WhatsApp message unless requested.
- Return only a proposed rewrite plus machine-readable metadata.
- If the source is ambiguous, identify the ambiguity rather than guessing.
- Never promise that a rewrite is “undetectable.” AI detectors are unreliable.

## 4. The five modes

### Mode 1: Polish

**Job:** Keep the same voice, meaning, directness, and approximate length while fixing grammar, structure, clarity, and flow.

**Must not:** add arguments, make the user sound more formal, remove intentional personality, or turn simple language into corporate prose.

**UI summary:** “Same voice, cleaner writing.”

**Controls:** preserve length by default; optional shorter/same/longer.

### Mode 2: Casual

**Job:** Make the writing sound natural, conversational, and personally written without fake informality.

**Anti-slop emphasis:** contractions where natural, concrete wording, varied cadence, no canned transitions, no forced enthusiasm, no fake slang.

**Must not:** lower competence, introduce errors, add emojis unless the profile permits them, or sound juvenile.

**UI summary:** “Natural and easygoing.”

### Mode 3: Polite

**Job:** Reduce friction and defensiveness while keeping the request or boundary clear.

**Behavior:** acknowledge context briefly, state the request directly, use a respectful close only when appropriate.

**Must not:** become submissive, over-apologize, bury the ask, or add insincere gratitude.

**UI summary:** “Respectful without weakening the message.”

### Mode 4: Professional & Firm

**Job:** Produce a clear, confident business response with an explicit position, request, owner, deadline, or next step when those exist in the source.

**Behavior:** concise opening, evidence before conclusion, direct action language, calibrated certainty.

**Must not:** become hostile, legalistic, threatening, passive-aggressive, or invent deadlines/consequences.

**UI summary:** “Direct, confident, and business-ready.”

### Mode 5: Technical Review

This mode is an analysis workflow, not merely a tone preset.

#### Standard review

- Extract the response's claims and intended conclusion.
- Check internal consistency, causal leaps, unsupported assumptions, missing constraints, terminology, calculations supplied in the text, and whether the response actually answers the other person.
- Separate errors from risks and optional improvements.
- Label factual claims that need external verification.
- Propose an improved response only after the review.

#### Researched review

- The user explicitly enables **Research the web**.
- OpenRouter's current web-search server tool is used, not hidden browsing. Official docs describe `openrouter:web_search` with citation annotations: [OpenRouter Web Search](https://openrouter.ai/docs/api_reference/responses/web-search).
- Sources appear in a dedicated evidence section with title, domain, date when available, and claim relationship: supports, conflicts, or adds context.
- The final rewrite uses calibrated language. It never says the user is “always right.” It says whether the response is supported, contradicted, unclear, or unverifiable from available evidence.
- Sources must be opened by the user before the final rewrite is applied when the review flags a contradiction.

**UI summary:** “Check the reasoning, then improve the response.”

## 5. Prompt library, profiles, and custom modes

### Prompt library

A prompt is a reusable instruction that can be run on selected text without becoming a permanent mode. Fields:

- Name
- Short description
- Prompt body
- Icon/color
- Optional keyboard shortcut
- Input scope: selection, paragraph, full field, surrounding conversation
- Output behavior: replace, compare, review only, or insert below
- Profile override
- Research allowed/required/off
- Pinned state and sort order

Examples: “Shorten without losing detail,” “Reply with a clear deadline,” “Explain for a nontechnical client,” and “Challenge my assumptions.”

### Profiles

Profiles provide defaults shared across modes and prompts:

- Profile name: Personal, Work, Client A, Engineering, etc.
- Audience and relationship
- Voice description
- 1–5 user-written voice samples
- Preferred vocabulary
- Avoided words/phrases
- Formality and directness
- Contractions, emoji, greeting, and sign-off preferences
- Locale and spelling variant
- Personal dictionary and protected terms
- Default mode and model
- Site assignments, such as Work on Gmail and Casual on WhatsApp

### Custom mode builder

“Add mode” creates a mode visible beside the five built-ins. It uses:

1. Name, icon, and one-line purpose.
2. Base behavior: rewrite, review, compose, summarize, or reply.
3. Instruction editor.
4. Guardrails: preserve facts, preserve length, no web, citation required, never auto-apply.
5. Default profile and model.
6. Three test cases with expected characteristics.
7. Test-run preview before save.

Built-in modes can be duplicated but not overwritten. Custom modes can be exported/imported as JSON. API keys are never included in exports.

## 6. Proposed UX

### Entry points

- Focus any editable field: compact WriteRight badge appears.
- Select text: a small contextual toolbar appears with Rewrite, Review, and saved/pinned modes.
- Keyboard shortcut: opens command palette filtered to modes and prompts.
- Toolbar popup: profile, enabled state, recent actions, and settings.

### Rewrite flow

1. Select text or use the current paragraph.
2. Choose a mode.
3. WriteRight shows a skeleton/loading state and keeps the original untouched.
4. Comparison card displays original and proposed text with meaningful changes highlighted.
5. User chooses Replace, Insert below, Copy, Try again, or adjust controls.
6. An undo toast remains available after replacement.

### Technical review flow

1. Choose Technical Review.
2. Select Standard or Research the web.
3. Review panel shows verdict, reasoning issues, claim status, and recommended direction.
4. Researched mode shows citations and confidence per claim.
5. User opens sources if needed.
6. User asks for an improved response based only on supported claims.
7. User approves the final replacement.

### Safety and trust language

- Never display “You are right.” Use “Supported by the provided context,” “Needs verification,” or “Conflicts with source.”
- Never auto-replace text after a generative rewrite.
- Show when web research incurs additional OpenRouter cost.
- Show the active profile, mode, model, and research state before generation.
- Preserve the original until the user accepts and expose one-click undo.

## 7. Data model

`provider` selects `openrouter` (default) or `google` (Google AI Studio).
The registry owns default endpoint, onboarding models, key links and capabilities.
A blank endpoint uses the provider default; an explicit custom endpoint wins.
Google uses its OpenAI-compatible chat API and header-authenticated model catalogue.
Catalogue caches are isolated by provider. Google omits `usage.include` and does not
support the OpenRouter server-side web search tool: researched review is refused
before lookup/send, while logic-only review and all other writing tasks remain available.

```js
settings = {
  provider, endpoint, apiKey, model,
  language, enabled,
  activeProfileId,
  research: { enabled, maxResults, allowedDomains, blockedDomains }
}

profile = {
  id, name, description, audience, voiceDescription,
  samples: [], preferredTerms: [], blockedTerms: [], protectedTerms: [],
  formality, directness, contractions, emoji, greeting, signoff,
  locale, defaultModeId, model, siteRules: []
}

mode = {
  id, builtIn, name, description, icon, color,
  operation, systemInstruction, guardrails,
  researchPolicy, outputBehavior, defaultProfileId,
  testCases: [], createdAt, updatedAt
}

promptTemplate = {
  id, name, description, instruction, icon, color,
  scope, outputBehavior, profileId, researchPolicy,
  shortcut, pinned, order
}

rewriteRecord = {
  id, timestamp, siteOrigin, modeId, profileId,
  inputHash, original, proposal, accepted,
  warnings: [], citations: [], usage
}
```

History should be local, optional, off by default, and automatically expire. Users need a **Clear history** action. Consider storing only enough for undo rather than a permanent text archive.

## 8. API and prompt architecture

- Replace the one-prompt background function with a versioned task router: `proofread`, `rewrite`, `review`, `research_review`, and `test_mode`.
- Use strict JSON schemas for every task and enable OpenRouter response healing where appropriate.
- Compose system instructions in layers: safety contract → anti-slop contract → mode → profile → site/output constraints.
- Treat webpage text and quoted conversation as untrusted data, never as system instructions. Delimit it and explicitly resist prompt injection.
- Return `proposal`, `summary`, `meaningChanged`, `warnings`, `claims`, `citations`, and `confidence`, depending on task.
- Add request cancellation, timeouts, retry only on safe transient errors, and a per-field latest-request token.
- Calculate and display estimated/actual model cost where OpenRouter returns usage.
- For researched review, use the supported OpenRouter web-search tool and preserve citation annotations.

## 9. Exact-range editing strategy

The current field-wide wavy underline is insufficient. v2 should:

- Use the CSS Custom Highlight API for contenteditable elements when available.
- Build a mirror overlay for textarea and plain text inputs to position issue-level underlines.
- Maintain a normalized text-to-DOM range map for rich editors.
- Revalidate original text before every apply.
- Group overlapping issues and prohibit stale batch application.
- Add a site-adapter layer for Gmail, Google Docs, LinkedIn, Slack, Notion, and WhatsApp Web.

Google Docs and canvas-backed editors may require a separate integration and should not be promised until tested.

## 10. Design inventory for approval

The accompanying `design-v2/` package contains actual 1440×900 PNG design screenshots plus editable SVG files:

1. `01-rewrite-modes`: selected-text toolbar and five-mode launcher.
2. `02-rewrite-compare`: Polish result with before/after comparison and rewrite controls.
3. `03-technical-review`: hybrid logic/factual review with sources and calibrated verdict.
4. `04-prompt-library`: searchable prompts and personal/work profiles.
5. `05-custom-mode`: add-mode builder with behavior and guardrails.
6. `06-onboarding`: profile, voice-sample, and default-mode setup.

These are product design mockups, not claims that the runtime already contains the features.

## 11. Delivery plan after design approval

### Phase 0: contracts and tests (2–3 days)

- Freeze schemas and prompt layering.
- Add third-party notices and adapted anti-slop rules.
- Build fixture corpus for all five modes: normal, ambiguous, technical, adversarial, and already-good text.
- Define meaning-preservation, factuality, style, latency, and cost acceptance gates.

### Phase 1: rewrite core (4–6 days)

- Task router and strict schemas.
- Five modes, selected-text capture, comparison view, replace/copy/retry/undo.
- Anti-slop rules and fidelity check.
- Cancellation and stale-response protection.

### Phase 2: prompts and profiles (4–5 days)

- Prompt library CRUD, pinning, search, import/export.
- Profile CRUD, voice samples, terminology, site assignment.
- Custom-mode builder and test-run sandbox.
- Migrate existing v1 settings.

### Phase 3: Technical Review (4–6 days)

- Claim extraction and logic review.
- Explicit OpenRouter web-search flow, source cards, citation mapping, and cost disclosure.
- Contradiction gating and supported-claims-only rewrite.
- Prompt-injection defenses for webpage/source text.

### Phase 4: Grammarly-level UX foundations (5–8 days)

- Exact-range highlights and editor adapters.
- Tone and reader-reaction feedback.
- Length controls, explain-why details, keyboard command palette, history/undo.
- Personal dictionary and protected terminology.

### Phase 5: quality and release (4–6 days)

- Automated unit tests and Playwright Chrome-extension fixtures.
- Manual WhatsApp, Gmail, LinkedIn, Notion, Slack, and standard editor matrix.
- Accessibility and keyboard audit.
- Privacy-policy and store-listing update.
- Replace store screenshots only after the implementation matches approved design.

Estimated engineering range after approval: **21–34 focused working days** for the complete v2 scope, depending on rich-editor compatibility and research-result normalization.

## 12. Acceptance criteria

- In blind fixture review, Polish preserves all source claims and commitments.
- Casual does not add fake slang, mistakes, emojis, or facts.
- Polite retains the user's request and boundary.
- Professional & Firm is direct without hostility or invented consequences.
- Technical Review separates logic concerns from externally verifiable claims.
- Researched Review cites every externally checked claim and never asserts certainty unsupported by sources.
- All modes avoid clusters of known AI-writing tells without destroying valid technical wording.
- Every generative change is previewed; no rewrite auto-applies.
- Custom modes and profiles survive browser restart and export/import correctly.
- API keys never appear in DOM, logs, exports, screenshots, or content-script storage.
- Undo works after replacement on supported editors.

## 13. Explicit non-goals for v2

- Claiming to defeat AI detectors.
- Guaranteeing the user is always right.
- Building a proprietary plagiarism corpus.
- Silently reading entire pages or private conversations without user action.
- Auto-sending messages.
- Copying Grammarly trademarks, proprietary visual assets, or private implementation details.
