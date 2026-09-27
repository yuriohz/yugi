# WordSaffron brand guidelines

**Brand direction:** Tactile concept 04, approved by the owner 27 September 2026  
**Version:** 1.0 · **Status:** foundation draft for staged rollout  
**Scope:** identity, voice, product language, and asset rules. This does not constitute trademark clearance.

## 1. Brand foundation

### Name

Write **WordSaffron** as one word, with capital W and S. Never write “Word Saffron,” “Word-saffron,” or “Wordsaffron” in customer-facing copy. Pronounce it **word-SAF-ruhn**.

### What it is

A browser writing companion for English and Arabic. It helps users refine text and review reasoning, then lets them decide whether to apply a suggestion.

### Positioning

**For people who write across the web in English or Arabic, WordSaffron offers focused ways to refine wording and review a draft while keeping the writer in control.**

### Brand promise

**A pinch of clarity. Still your words.**

The promise is about assistance and user control, not guaranteed correctness, undetectable AI, or privacy beyond the implemented behavior.

### Personality

- Warm, not sugary
- Editorial, not academic or corporate
- Confident, not overclaiming
- Tactile and memorable, not rustic or food-themed
- Bilingual-aware, without pretending the English brand name is Arabic

## 2. Identity system

### Logo concept

The approved direction is a rounded terracotta speech bubble containing two saffron-colored petals/quotation shapes. It represents a considered suggestion inside a writing conversation. The primary wordmark pairs the mark with a readable editorial serif. The product interface remains sans-serif for legibility.

Use the supplied SVG as the scalable source of truth. PNGs are rendered previews/exports; if the SVG changes, regenerate and inspect its PNG companion in the same change.

### Clear space and minimum size

- Leave at least the width of one inner petal clear around the mark.
- Do not place the mark on visually busy imagery without a solid backing shape.
- The simplified mark should remain recognizable at 16 px. Validate at 16, 32, 48 and 128 px before replacing extension icons.
- Use the full wordmark in store art and documentation; do not squeeze the wordmark into the extension toolbar icon.

### Correct use

- Primary: terracotta speech mark + saffron petals + cocoa wordmark on warm paper.
- Reverse: cream mark details on deep cocoa only if separately redrawn and contrast-tested.
- Keep the mark flat. No gradients, glow, shadows inside the logo, AI stars, robot heads, or extra badges.
- Do not redraw the petals as a literal saffron-food illustration or use a saffron flower photograph as the logo.

## 3. Color system

The palette follows tactile concept 04: creamy paper, terracotta, dark cocoa, and soft pistachio. Gold is an accent, not a small-text color.

| Token | Hex | Role |
|---|---|---|
| `ws-paper` | `#FBF5E9` | Main warm background |
| `ws-white` | `#FFFCF7` | Raised cards and input surfaces |
| `ws-cocoa-950` | `#35251F` | Main text, wordmark, primary dark control |
| `ws-cocoa-700` | `#493A33` | Secondary headings and strong labels |
| `ws-cocoa-600` | `#6B5E56` | Supporting text |
| `ws-terracotta-700` | `#7D3424` | Pressed state and accessible terracotta text |
| `ws-terracotta-600` | `#9C412B` | Primary brand action / key brand text |
| `ws-terracotta-500` | `#A7472D` | Logo and prominent accents |
| `ws-terracotta-100` | `#F3E2D9` | Selected/soft brand surface |
| `ws-saffron-500` | `#D99A21` | Petals, small accents, decorative rules |
| `ws-saffron-700` | `#805200` | Saffron text on light surfaces |
| `ws-pistachio-100` | `#E8EFDC` | Calm selected/positive surface |
| `ws-pistachio-600` | `#56704C` | Supporting green text/icons |
| `ws-line-300` | `#D8CABB` | Strong borders |
| `ws-line-200` | `#E9E0D4` | Dividers and card edges |
| `ws-error-600` | `#B42332` | Errors only |
| `ws-warning-700` | `#805200` | Warnings and uncertainty |
| `ws-info-700` | `#315B8A` | Information and citations |

`ws-cocoa-950`, `ws-cocoa-700`, `ws-cocoa-600`, `ws-terracotta-700`, `ws-terracotta-600`, `ws-saffron-700`, and `ws-pistachio-600` meet WCAG AA for normal text on `ws-paper` (contrast checked during palette setup). Do not use `ws-saffron-500` for small text on cream or white. Status colors remain semantically distinct from the brand palette; never communicate state by color alone.

## 4. Typography

- **Wordmark/display accent:** Georgia or another locally available editorial serif; do not download fonts at runtime.
- **Product UI:** system sans stack (`Inter`, `ui-sans-serif`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, sans-serif).
- **Arabic UI:** use platform Arabic-capable sans fallbacks such as `"Noto Sans Arabic"`, `"Segoe UI"`, `Tahoma`, sans-serif. No remote font requests.
- Use sentence case, short headings, and clear line spacing. Avoid decorative scripts for functional text.
- Keep Arabic line-height generous and test mixed-direction text, numerals, URLs, and English model names in real RTL layout.

## 5. Voice and copy rules

### Sound like

A careful editor who respects the writer. Name the action, disclose uncertainty, and keep the next step clear.

- “Review the suggestion before applying it.”
- “This claim needs verification.”
- “Your text is sent to the provider you selected when you request a rewrite.”

### Avoid

- “Perfect writing,” “guaranteed correct,” “human-proof,” “undetectable,” or “100% private.”
- Calling a user's draft “slop,” “bad,” or “broken.”
- Saying that research is available through Google AI Studio; researched Technical Review is OpenRouter-only.
- Saying “your text never leaves your device”; the selected provider/endpoint processes text the user submits.
- “Unlimited AI,” “lifetime updates,” or “one-time fee includes AI usage” unless those exact commercial terms are implemented and approved.

### Product terminology

Use the actual built-in mode names: **Polish**, **Casual**, **Polite**, **Professional & Firm**, and **Technical Review**. Do not replace them in the UI with “Naturalize” or “Formalize.” Use **suggestion** or **proposed rewrite**, not “answer” or “fix,” when describing generated text.

## 6. Bilingual and inclusive design

- British English is the default spelling style; Arabic modes use the product's supported MSA/Egyptian behavior as appropriate to the mode.
- RTL is a layout mode, not a decorative theme. Mirror layout where appropriate but do not reverse brand glyphs, icons, numbers, URLs, or code.
- Never publish AI-generated Arabic copy without fluent human review. Generated concept boards are visual references only.
- Use icons and text together; do not rely on color alone.
- Preserve the original text and show a comparison before replacement. The user always decides whether to apply a change.

## 7. Motion, surfaces, and imagery

- Favor tactile paper-like surfaces, restrained borders, and soft depth; avoid heavy drop shadows and skeuomorphic stationery clutter.
- Keep the extension popup compact and functional. Brand warmth belongs in surfaces, iconography, and headings—not extra decoration around every control.
- Motion is brief and functional; respect `prefers-reduced-motion`.
- Avoid literal spice jars, food photography, generic AI sparkles, robots, brains, and stock-photo people pointing at screens.
- Any proposed extension/store artwork is a **mockup** until replaced with a verified runtime capture where required.

## 8. One-time Pro messaging guardrail

The planned business model is a one-time purchase for the extension's Pro tier, with users supplying their own supported API key. Copy must clearly separate the one-time extension purchase from model-provider charges. Do not claim “lifetime use,” “lifetime updates,” or included AI usage unless the owner defines and implements those terms.

Suggested disclosure, for use only after the payment model is implemented:

> **One-time purchase for WordSaffron Pro. Bring your own AI provider key; provider usage charges are separate and set by your provider.**

## 9. Rollout status

- Approved visual direction: concept 04, Tactile.
- Brand foundation and copy pack: complete (Stage 1).
- Extension UI, manifest display metadata, OpenRouter display title, and runtime PNG icons: updated for WordSaffron (Stage 2; 27 September 2026). Historical protocol, storage, settings-export, and content-script identifiers remain unchanged.
- Store listing, privacy policy, permissions, submission checklist, release notes, and all five store-asset SVG/PNG pairs: reconciled/redrawn for WordSaffron (Stage 3; 27 September 2026). Store images remain labelled mockups; no runtime screenshots exist.
- Repository-wide sweep complete (Stage 4; 27 September 2026): README, package metadata, third-party notices, design-v2 mockups, and remaining live docs use WordSaffron. Historical planning bodies keep the working name under rename notes. Concept boards are exploratory/mockup material, not runtime captures.
- Trademark and final registrar checkout clearance: not performed.
