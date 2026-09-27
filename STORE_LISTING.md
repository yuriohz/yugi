# Chrome Web Store listing draft — WordSaffron

**Status: WordSaffron draft. Not submitted.** See [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md).

> Reconciled against the Stage 2 implementation on 27 September 2026: the name,
> modes, providers, privacy disclosures and permission justifications below match
> what the build actually does. Runtime screenshots are still outstanding, so this
> listing must not be submitted yet. The former working name is retired; see
> [`NAMING_RESEARCH.md`](NAMING_RESEARCH.md) for the approval record.

---

## Name (max 75 characters)

```
WordSaffron — English & Arabic Writing Assistant
```

*(48 characters)*

## Short description (max 132 characters)

```
Polish, rewrite and review text across the web in English or Arabic. Bring your own OpenRouter or Google AI Studio key.
```

*(119 characters)*

## Category

Productivity → Workflow & Planning

## Language

English (UK), Arabic

---

## Detailed description

```
A little more clarity, while keeping the words yours.

WordSaffron brings writing and review tools into the text fields where you work.
Choose a mode, inspect the proposed change, and apply it only if you want to.

FIVE MODES FOR TEXT YOU ALREADY WROTE

POLISH — same voice, cleaner writing
CASUAL — natural and easygoing
POLITE — respectful without weakening the message
PROFESSIONAL & FIRM — direct, confident, and business-ready
TECHNICAL REVIEW — check the reasoning, then improve the response

Each mode declares what it must not do, and those prohibitions are enforced after
the model answers — not merely requested in the prompt.

IT KEEPS YOUR MEANING

Before you can apply a rewrite, every number, amount, date, URL, email address,
name and technical term from your original is checked against the result. A
dropped fact, an invented deadline, or a refusal turned into agreement is
blocked, and you are told exactly what happened. AI output can still be wrong,
so review it before using it.

IT REMOVES AI WRITING PATTERNS, NOT YOUR VOICE

Built on the MIT-licensed No AI Slop editing rules by Peter Yang. Binary
contrasts, throat-clearing openers, colon reveals, vague "experts agree"
attribution, importance puffery and em-dash overuse are found and removed. Your
bluntness, your humour and your hedging stay.

BRITISH ENGLISH AND ARABIC, PROPERLY

British spelling and punctuation by default. Modern Standard Arabic for
professional modes; natural Egyptian Arabic for Casual, because Standard Arabic
reads stiff in a chat. URLs and English terms inside Arabic keep their direction
instead of being mangled. Arabic-Indic digits stay as you wrote them.

TECHNICAL REVIEW THAT DOES NOT FLATTER YOU

Logic-only review checks the reasoning with no web access, so every factual
claim comes back marked "needs verification" — it has no sources, so it cannot
support anything. Google AI Studio supports logic-only review and the writing
tools. Researched review is OpenRouter-only: it adds real web sources with
clickable links, and a claim is only marked supported if a source actually
returned by the search backs it. If a source contradicts you, you cannot apply
the rewrite until you have looked at it.

It will never tell you that you are right.

CHOOSE YOUR PROVIDER

Use your own OpenRouter or Google AI Studio key, or the explicit endpoint
configured in settings. Your key is stored in local extension storage on this
device and is not synced through Chrome Sync. When you request a rewrite or
review, the text you submit is sent to the selected provider or endpoint and is
handled under its terms. Provider usage charges may apply.

IT STOPS WHEN YOU TELL IT TO

Switch it off for this tab, for this website, or everywhere. While it is off it
makes no network request at all.

YOUR DATA

• No account, no backend, no analytics, no tracking
• Your API key stays in local extension storage and is never synced through Chrome Sync
• Nothing is read unless you are typing in a field
• The conversation around you is never read unless you switch it on AND allow that
  specific site — and you see the exact messages before they are sent
• Local history is off by default and expires automatically
• Exporting your settings never includes your API key

WHAT IT DOES NOT CLAIM

It does not make writing undetectable. It does not guarantee the result is
human, correct, or accurate. AI output can be wrong — review it before you
send it.

REQUIREMENTS

An OpenRouter or Google AI Studio API key. Usage is billed by your selected
provider at its rates. Researched review requires OpenRouter with a compatible
model. This extension charges nothing and takes no commission.
```

---

## Permission justification (paste into the dashboard)

Full reasoning, including alternatives that were considered and rejected, is in
[`docs/PERMISSIONS.md`](docs/PERMISSIONS.md).

**`storage`**
> Stores the user's own provider API key, writing profiles, protected terms, custom
> modes, dictionary and preferences on their device. `chrome.storage.local` only —
> deliberately not `storage.sync`, so the key is never copied to Google's servers.

**`activeTab`**
> Reads the text in the field the user is editing and writes the corrected text back when
> they accept a suggestion.

**`scripting`**
> Runs the suggestion widget inside the page so it can attach to the field being edited.

**`<all_urls>`**
> People write in text fields on sites that cannot be enumerated in advance: internal
> ticketing systems, intranets, university portals, government forms. A fixed site list
> would make the extension useless on exactly the sites where it is most needed. The
> content script attaches only when the user focuses an editable field. It does not read
> pages the user is not typing in, does not read the surrounding conversation unless the
> user enables it and allows that specific site, and makes no request at all while the
> extension is switched off.

---

## Data-use disclosures

See §6 of [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md) for the exact
answer to every dashboard question, with the basis for each.

Summary: **authentication information** (the user's own provider key, stored locally,
sent only to the configured endpoint), **personal communications** and **website
content** (only the text the user submits) are transmitted. Nothing is *collected* —
there is no backend to collect it.

---

## Single purpose

> WordSaffron helps you improve text you are writing in any web text field: it proofreads,
> rewrites in a mode you choose, and reviews the reasoning in what you wrote. Every
> capability serves that one purpose. It uses your own provider API key, has no backend,
> and collects no analytics.

---

## Visual assets

> ⚠️ **No runtime screenshots exist yet.** `screenshot-1-whatsapp.png`,
> `screenshot-2-setup.png` and `screenshot-3-privacy.png` are WordSaffron Tactile
> mockups with an on-image disclaimer. Chrome Web Store policy requires screenshots
> to show the actual product. Five real runtime captures must replace them — see
> [`store-assets/README.md`](store-assets/README.md) and §M of
> [`docs/MANUAL_TEST_PLAN.md`](docs/MANUAL_TEST_PLAN.md).

| Asset | Size | Status |
|---|---|---|
| Screenshot 1 — widget with real suggestions | 1280×800 | ❌ to capture |
| Screenshot 2 — comparison view | 1280×800 | ❌ to capture |
| Screenshot 3 — technical review with sources | 1280×800 | ❌ to capture |
| Screenshot 4 — settings and favourite models | 1280×800 | ❌ to capture |
| Screenshot 5 — Arabic RTL in use | 1280×800 | ❌ to capture |
| Small promo tile | 440×280 | ⚠️ redrawn for WordSaffron (27 Sep 2026); review before use |
| Marquee promo tile | 1400×560 | ⚠️ redrawn for WordSaffron (27 Sep 2026); review before use |
| Icon | 128×128 | ✅ WordSaffron mark, matches runtime `icons/` (Stage 2) |

---

## Publisher dashboard items

- Privacy policy URL: `https://github.com/yuriohz/yugi/blob/master/PRIVACY_POLICY.md`
  — must be a stable public URL at submission time
- Support: `https://github.com/yuriohz/yugi/issues`
- Complete the privacy-practices questionnaire using §6 of the submission checklist
- Public name decided (WordSaffron, 27 September 2026); trademark clearance, domain
  purchase and publisher-domain verification are still open
