# Chrome Web Store submission checklist

**Current status: NOT SUBMITTED.**

This build has never been uploaded to the Chrome Web Store. No submission has been made
through any publisher account. Submission requires credentials, which this process will
never request and does not have.

---

## 1. Automated, and already green

These run in CI and in `npm run verify`. Re-run them on the exact commit you submit.

| # | Check | Command | Status |
|---|---|---|---|
| 1.1 | Project lint, syntax, manifest validity | `npm run lint` | ✅ clean |
| 1.2 | No prohibited assurance claims in any shipped file | included in lint | ✅ clean |
| 1.3 | No credentials anywhere in the tree | `npm run scan:secrets` | ✅ clean |
| 1.4 | Deterministic build; manifest references resolve | `npm run build` | ✅ 16 files |
| 1.5 | Unit tests | `npm test` | ✅ 461 assertions |
| 1.6 | Integration journeys | `npm run test:browser` | ✅ 15 journeys |
| 1.7 | Package contains only allow-listed runtime files | `npm run package` | ✅ 17 entries |
| 1.8 | No remote code: no remote `<script src>`, no URL `import()`, no `importScripts` from a URL, no `eval`, no `new Function` | enforced in `tools/package.js` | ✅ refused if found |
| 1.9 | Every manifest permission has a written rationale | enforced in `tools/package.js` against `docs/PERMISSIONS.md` | ✅ |
| 1.10 | SHA-256 and file manifest produced | `release/*.sha256`, `release/MANIFEST.txt` | ✅ |

## 2. Content of the package, verified

| # | Requirement | How it is enforced | Status |
|---|---|---|---|
| 2.1 | No API keys | Allow-list plus a credential re-scan of every shipped file | ✅ |
| 2.2 | No private or user text | Only built source is packaged | ✅ |
| 2.3 | No generated secrets | Credential scan | ✅ |
| 2.4 | No unrelated files | Allow-list refuses anything not on it | ✅ |
| 2.5 | No source maps, tests, dotfiles, Markdown, `node_modules` | Explicit forbidden list | ✅ |
| 2.6 | No remotely hosted executable code | Pattern check across all shipped JS, HTML and CSS | ✅ |
| 2.7 | No mock or placeholder capability in the shipped UI | Every task is implemented; a task with no builder throws rather than returning a plausible stub | ✅ |

## 3. Blocked — requires a real browser

Nothing below can be ticked from this build process. Work through
`docs/MANUAL_TEST_PLAN.md` in Chrome.

| # | Item | Status |
|---|---|---|
| 3.1 | Extension loads unpacked with no manifest or console error | ☐ |
| 3.2 | Service worker registers and survives | ☐ |
| 3.3 | Full manual test plan passes, sections A–J | ☐ |
| 3.4 | Exact-range underlines verified visually in a contenteditable | ☐ |
| 3.5 | RTL mirroring verified visually with a real Arabic font stack | ☐ |
| 3.6 | Zero-call guarantee verified in DevTools Network under all three shutdown scopes | ☐ |
| 3.7 | Researched review verified against live OpenRouter web search with real, clickable sources | ☐ |
| 3.8 | **Five runtime screenshots captured at 1280 × 800** | ☐ |
| 3.9 | Mockup-derived images removed from the submission set | ☐ |

## 4. Blocked — requires your decision

| # | Item | Why it is yours | Status |
|---|---|---|---|
| 4.1 | Final public name chosen | Brand decision. `NAMING_RESEARCH.md` gives an evidence-backed shortlist of three | ☐ |
| 4.2 | Trademark clearance obtained for that name | A legal opinion. No register could be queried from this environment | ☐ |
| 4.3 | Domain purchased | Costs money. Candidates and their RDAP status are in `NAMING_RESEARCH.md` §6 | ☐ |
| 4.4 | Social handles registered | Requires accounts | ☐ |
| 4.5 | Manifest `name`, `homepage_url` and store listing updated to the final name | Follows 4.1 | ☐ |
| 4.6 | Icons and promo art redrawn for the final name | Follows 4.1 | ☐ |

## 5. Blocked — requires a publisher account

| # | Item | Status |
|---|---|---|
| 5.1 | Chrome Web Store developer account, one-off fee paid | ☐ |
| 5.2 | Publisher identity verified | ☐ |
| 5.3 | Privacy policy hosted at a public URL | ☐ |
| 5.4 | Single purpose declared | ☐ |
| 5.5 | Permission justifications entered in the dashboard (copy from `docs/PERMISSIONS.md`) | ☐ |
| 5.6 | Data-use disclosures completed (see §6) | ☐ |
| 5.7 | ZIP uploaded and submitted for review | ☐ |

## 6. Data-use disclosures to enter in the dashboard

Answer exactly this. These statements are backed by the code and by tests.

| Dashboard question | Answer | Basis |
|---|---|---|
| Does it collect personally identifiable information? | **No** | No backend exists |
| Health information? | **No** | — |
| Financial and payment information? | **No** | The user's own OpenRouter key is stored locally and sent only to OpenRouter |
| Authentication information? | **Yes — stored locally, not collected** | The OpenRouter API key is held in `chrome.storage.local` and never sent anywhere except OpenRouter's API in the `Authorization` header |
| Personal communications? | **Yes — transmitted to the user's chosen model, not collected** | Text the user selects is sent to the model. Nearby conversation only with two explicit opt-ins |
| Location? | **No** | — |
| Web history? | **No** | — |
| User activity (clicks, mouse, keystrokes)? | **No** | No analytics or telemetry of any kind |
| Website content? | **Yes — only the field the user is editing** | Plus nearby conversation, only with both opt-ins on |

Required certifications:

- ☐ I do not sell or transfer user data to third parties, outside of approved use cases — **true**
- ☐ I do not use or transfer user data for purposes unrelated to the single purpose — **true**
- ☐ I do not use or transfer user data to determine creditworthiness or for lending — **true**

## 7. Single-purpose statement

> WriteRight helps you improve text you are writing in any web text field: it proofreads,
> rewrites in a mode you choose, and reviews the reasoning in what you wrote. Every
> capability serves that one purpose. It uses your own OpenRouter API key, has no backend,
> and collects no analytics.

## 8. Final gate before you click Submit

- ☐ `npm run verify` green on the exact commit being submitted
- ☐ `npm run package` run from a clean tree; SHA-256 recorded below
- ☐ `release/MANIFEST.txt` reviewed line by line
- ☐ Manual test plan signed off, with the Chrome version recorded
- ☐ Screenshots are real runtime captures, not mockups
- ☐ Store listing text matches what the build actually does
- ☐ No claim of undetectability, guaranteed human output, or guaranteed correctness anywhere in the listing
- ☐ Name conflicts resolved

| Field | Value |
|---|---|
| Commit | |
| Package SHA-256 | |
| Submitted by | |
| Submission date | |
| Review outcome | |

---

## Statement of record

As of the last commit in this repository, items 3, 4 and 5 are **not complete**. This
extension has **not** been submitted to the Chrome Web Store. Any statement to the
contrary would be false.
