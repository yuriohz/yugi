# WordSaffron design system

**Version:** 4.0 · Stages 3–4 store/release and repo-wide brand rollout
**Status:** tactile concept 04 applied across extension UI, runtime icons, store/release copy, store and design mockups, and all live repository docs; Chrome visual acceptance and runtime screenshots remain pending because no Chrome/Chromium binary is available in this environment.
**Updated:** September 27, 2026

WordSaffron's interface should feel warm, precise, and trustworthy. It appears inside other products, so it must be recognizable without competing with the page. The system favors progressive disclosure, comparison before replacement, explicit AI state, and compact controls that expand only when needed. See [`BRAND_GUIDELINES.md`](BRAND_GUIDELINES.md) for the full identity rules.

## 1. Product principles

### Quiet until useful

The resting control is small. The extension does not cover the editor, animate constantly, or demand attention when writing is already good.

### Review before replacement

Generated text never silently replaces the user's writing. Rewrites open in a comparison surface with Replace, Copy, Retry, and Undo.

### Confidence must be earned

Correctness, logic, and researched facts use different states. The interface says “supported,” “needs verification,” or “conflicts with evidence,” never “you are always right.”

### One obvious next action

Each surface has one primary action. Secondary actions stay visible but visually quieter.

### Context stays visible

Mode, profile, length, model, and research state are visible before generation. Users should know what will happen and where their text goes.

### Human voice over AI spectacle

No magic gradients, sparkle overload, anthropomorphic claims, fake certainty, or “undetectable AI” language. WordSaffron communicates as an editor, not a performer.

## 2. Visual direction

The visual language follows the approved **Tactile** direction:

- creamy paper surfaces, dark cocoa text, restrained terracotta brand controls, saffron-gold logo accents, and soft pistachio support surfaces;
- compact cards with subtle borders rather than heavy shadows or simulated paper stacks in the live UI;
- rounded geometry with controlled radii, not pill shapes everywhere;
- editorial serif only for the wordmark or occasional campaign headline; product UI remains a clear system sans;
- semantic success, warning, error, and information colors remain separate from brand colors;
- saffron gold is decorative/accent color, not small body text;
- dense layouts remain touch-safe, readable, and compatible with Arabic RTL;
- short, functional microcopy;
- motion explains spatial change, never decorates it.

## 3. Brand foundation

### Name

Always write **WordSaffron** as one word with capital W and S.

### Mark

The approved mark is a terracotta speech bubble containing three simple saffron petals/quotation shapes, paired with an editorial serif wordmark. The current vector master is in `brand-assets/`. Keep the symbol legible at 16 px; no gradients, glows, AI stars, or detailed botanical illustration.

### Voice

WordSaffron is:

- warm, not sugary;
- editorial, not academic or corporate;
- direct, not blunt;
- specific, not verbose;
- honest about uncertainty;
- helpful without praising every input.

Example:

- Use: “This claim needs a source.”
- Avoid: “Great job! Your amazing draft could be even better with a source.”

## 4. Color tokens

The visual identity uses warm paper, dark cocoa, terracotta, saffron gold, and pistachio. The exact use rules and contrast rationale are documented in [`BRAND_GUIDELINES.md`](BRAND_GUIDELINES.md).

### Brand and neutral

| Token | Hex | Use |
|---|---:|---|
| `terra-700` | `#7D3424` | pressed state and high-contrast terracotta text |
| `terra-600` | `#9C412B` | primary action / accessible brand text |
| `terra-500` | `#A7472D` | logo and prominent accents |
| `terra-100` | `#F3E2D9` | selected brand surface |
| `saffron-500` | `#D99A21` | logo petals and decorative accents; not small text |
| `saffron-700` | `#805200` | accessible saffron text on light surfaces |
| `pistachio-100` | `#E8EFDC` | calm selected/positive surface |
| `pistachio-600` | `#56704C` | accessible supporting text/icons |
| `cocoa-950` | `#35251F` | primary text, wordmark, primary dark control |
| `cocoa-700` | `#493A33` | secondary headings and labels |
| `cocoa-600` | `#6B5E56` | supporting text |
| `paper-50` | `#FBF5E9` | warm page canvas |
| `white` | `#FFFCF7` | raised card and input surfaces |
| `line-300` | `#D8CABB` | strong field border |
| `line-200` | `#E9E0D4` | card borders and dividers |

### Semantic

| Token | Hex | Use |
|---|---:|---|
| `error-600` | `#B42332` | definite error states |
| `error-50` | `#FFF0F1` | error background |
| `warning-700` | `#805200` | uncertainty and evidence warnings |
| `warning-50` | `#FFF2DF` | warning background |
| `info-700` | `#315B8A` | informational state and citations |
| `info-50` | `#EEF4FF` | informational background |

All text/background pairings must meet WCAG 2.2 AA. Never communicate status using color alone. Saffron gold is not a text color on cream/white; pair gold fills with dark cocoa text.

## 5. Typography

### Font stack

```css
font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;
```

The logo may use Georgia italic as a system-safe display accent. Product text never depends on a remotely hosted font.

### Scale

| Token | Size/line | Weight | Use |
|---|---:|---:|---|
| `display` | 34/40 | 700 | onboarding hero only |
| `heading-1` | 26/32 | 700 | full-page title |
| `heading-2` | 22/28 | 700 | panel title |
| `heading-3` | 16/22 | 700 | card title |
| `body` | 14/21 | 400 | standard content |
| `body-small` | 12/18 | 400 | secondary content |
| `label` | 11/16 | 700 | field labels and tabs |
| `meta` | 10/14 | 500 | timestamps and model metadata |

Headings use sentence case. Avoid all caps except short section eyebrows with letter spacing.

## 6. Spacing, radius, and elevation

### Spacing scale

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`

Component padding should use 8/12/16/24. Major page regions use 32/48/64. Arbitrary spacing values are not allowed unless needed for pixel alignment.

### Radius

| Token | Value | Use |
|---|---:|---|
| `radius-sm` | 6 px | compact controls |
| `radius-md` | 8 px | buttons and inputs |
| `radius-lg` | 11 px | cards |
| `radius-xl` | 14 px | panels |
| `radius-round` | 999 px | avatar, status dot, compact segmented control only |

### Elevation

- Level 0: border only.
- Level 1: `0 2px 8px rgba(16, 44, 38, .06)`.
- Level 2: `0 12px 32px rgba(16, 44, 38, .14)`.
- Level 3: `0 20px 56px rgba(16, 44, 38, .18)` for modal/extension panel only.

Use borders before shadows. Never stack multiple dramatic shadows.

## 7. Layout

### In-page assistant

- Resting badge: 30×30 px, at least 8 px from editable-field edges.
- Selected-text toolbar: maximum 650 px wide; five modes fit at desktop widths.
- Review panel: 420–500 px wide; maximum height `calc(100vh - 32px)`.
- On screens below 520 px, panel becomes an 8 px inset sheet.
- Preserve at least 24 px of the original editor where possible.

### Settings

- Desktop navigation rail: 230–270 px.
- Content maximum: 1040 px.
- Form reading width: 620–720 px.
- Cards may form two or three columns only when content remains readable.

### Onboarding

- Two-column shell above 760 px.
- Step rail is hidden on mobile and replaced by “Step n of n.”
- Primary action remains at the lower-right of the active panel.

## 8. Core components

### Assistant badge

States: idle, checking, issues, rewrite ready, error, disabled. Loading uses a single rotating border and stops under reduced-motion preference.

### Mode card

Contains icon, name, and one short outcome. Selected state uses `terra-100` or `pistachio-100`, a `terra-600` border, and a visible check. Modes must not rely on custom colors for meaning.

### Rewrite comparison

Required areas:

1. mode/profile metadata;
2. proposed rewrite;
3. meaning-preservation and warning state;
4. compact adjustment chips;
5. Retry, Copy, and Replace;
6. post-apply Undo.

For longer text, use synchronized original/proposal blocks with changed spans. Never use red/green alone; add removed/added labels.

### Suggestion card

Contains category, explanation, original, replacement, and Accept. “Why?” expands supporting guidance without moving the primary action unexpectedly.

### Technical verdict

Uses one of five labels, each with a one-line plain-language explainer shown beneath it:

- Supported by the provided context — follows from evidence given in this review.
- Partially supported — partly follows; part of it still needs checking.
- Cannot be verified from available evidence — could not be checked even with sources.
- Needs verification — a factual claim about the outside world that has not been checked against a source.
- Conflicts with the source — contradicts another claim in the text, or a source returned for this review.

The verdict card must show whether web research was used. The labels live in `VERDICT_LABELS` and the explainers in `VERDICT_EXPLAINERS` (`src/core/constants.js`); the UI renders both so the calibrated vocabulary stays exact and legible.

### Source card

Shows source title, domain, date if available, relation to claim, and Open source. A citation cannot appear as an unlabeled number with no destination.

### Prompt card

Shows name, operation/scope, two-line summary, profile, shortcut, pinned state, and overflow actions. Edit and delete live in overflow to avoid accidental activation.

### Profile card

Shows profile name, voice summary, locale, sample count, protected-term count, and assigned sites. It never exposes sample text on the overview screen.

### Empty states

State what is empty, why it matters, and one next action. Avoid mascots and congratulatory filler.

## 9. Interaction and motion

### Timing

| Motion | Duration | Easing |
|---|---:|---|
| hover/focus color | 120 ms | ease-out |
| menu/popover | 160 ms | cubic-bezier(.2,.8,.2,1) |
| panel/sheet | 200 ms | cubic-bezier(.2,.8,.2,1) |
| content crossfade | 140 ms | ease-out |

### Rules

- Animate opacity and transform, not layout dimensions.
- Do not animate rewritten text character by character.
- Loading skeleton appears only after 250 ms to prevent flashing.
- A request taking over 8 seconds shows elapsed state and Cancel.
- `prefers-reduced-motion` removes transforms and continuous rotation.

## 10. Accessibility

- WCAG 2.2 AA contrast at minimum.
- 44×44 px target for primary touch controls; compact desktop controls may be 32 px with adequate separation.
- Visible 3 px focus ring using translucent terracotta plus a solid inner edge.
- Full keyboard navigation and Escape-to-close.
- Focus returns to the invoking element after panel closure.
- Dialogs have name, description, focus trap, and inert background.
- Live regions announce request start, completion, failure, and applied rewrite without reading the entire rewrite automatically.
- Status has icon and text, never color only.
- Text remains usable at 200% zoom and in 320 CSS px viewport.

## 11. Content design

### Buttons

Use specific verbs:

- Rewrite
- Review logic
- Research claims
- Replace selection
- Insert below
- Copy
- Try again
- Undo

Avoid vague labels such as Continue when the actual action can be named.

### AI language

Use:

- “Proposed rewrite”
- “Meaning preserved”
- “This claim needs verification”
- “Research may increase OpenRouter cost”

Avoid:

- “Perfect”
- “Guaranteed correct”
- “Undetectable”
- “100% human”
- “WordSaffron knows”

### Error structure

1. What failed.
2. Whether the original text changed.
3. The useful next action.
4. Technical detail only behind disclosure.

Example: “The rewrite could not be generated. Your text was not changed. Try again or select another model.”

## 12. Privacy UX

- Show the destination provider before the first request.
- Research is off by default and requires explicit activation.
- Voice-sample entry tells users to remove private information.
- API key fields are masked and never shown in screenshots or exports.
- History is optional, local, and off by default.
- Clear history and delete-profile actions explain exactly what is removed.
- Site access should move toward optional, user-approved domains in a future permissions revision.

## 13. Responsive behavior

### Desktop, 1024 px and above

Full mode cards, side-by-side settings, right review panel.

### Compact, 520–1023 px

Mode cards become horizontally scrollable or a two-column grid. Settings rail collapses into a header menu. Comparison stacks original above proposal.

### Narrow, below 520 px

The review panel becomes a bottom sheet/full inset surface. The five modes become a vertical list with descriptions. The primary action is sticky; secondary actions move into an overflow menu.

## 14. Design tokens starter

```css
:root {
  --ws-terra-700: #7d3424;
  --ws-terra-600: #9c412b;
  --ws-terra-500: #a7472d;
  --ws-terra-100: #f3e2d9;
  --ws-saffron-500: #d99a21;
  --ws-saffron-700: #805200;
  --ws-pistachio-100: #e8efdc;
  --ws-pistachio-600: #56704c;
  --ws-cocoa-950: #35251f;
  --ws-cocoa-700: #493a33;
  --ws-cocoa-600: #6b5e56;
  --ws-paper-50: #fbf5e9;
  --ws-white: #fffcf7;
  --ws-line-300: #d8cabb;
  --ws-line-200: #e9e0d4;
  --ws-error-600: #b42332;
  --ws-warning-700: #805200;
  --ws-info-700: #315b8a;
  --ws-radius-sm: 6px;
  --ws-radius-md: 8px;
  --ws-radius-lg: 11px;
  --ws-radius-xl: 14px;
  --ws-focus: 0 0 0 3px rgba(156, 65, 43, .24);
}
```

## 15. Definition of design done

A feature is design-complete only when it has:

- default, hover, focus, pressed, disabled, loading, empty, error, offline, and success states;
- keyboard and screen-reader behavior;
- narrow and 200% zoom behavior;
- privacy disclosure where text leaves the browser;
- cancellation and recovery behavior;
- exact button copy;
- analytics-free success criteria;
- an implementation note tying components to design tokens.
