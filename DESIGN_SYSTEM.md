# WriteRight design system

**Version:** 2.0 proposal  
**Status:** design specification for approval  
**Updated:** September 26, 2026

WriteRight's interface should feel calm, precise, and trustworthy. It appears inside other products, so it must be visually distinct without competing with the page. The system favors progressive disclosure, comparison before replacement, explicit AI state, and compact controls that expand only when needed.

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

No magic gradients, sparkle overload, anthropomorphic claims, fake certainty, or “undetectable AI” language. WriteRight communicates as an editor, not a performer.

## 2. Visual direction

The visual language is a restrained 2026 productivity aesthetic:

- warm neutral surfaces rather than stark blue-white software chrome;
- compact cards with subtle borders instead of heavy shadows;
- rounded geometry with controlled radii, not pill shapes everywhere;
- typography-led hierarchy;
- green reserved for progress, approval, and brand recognition;
- amber for review and uncertainty, red for definite errors, blue for information;
- dense desktop layouts that remain touch-safe and readable;
- short, functional microcopy;
- motion used to explain spatial change, never as decoration.

## 3. Brand foundation

### Name

Always write **WriteRight** as one word with two capital letters.

### Mark

The primary mark is a white italic serif `W` inside a solid green circle. It must remain legible at 16 px. Do not add gradients, glows, or separate AI badges to the mark.

### Voice

WriteRight is:

- direct, not blunt;
- calm, not cheerful by default;
- specific, not verbose;
- honest about uncertainty;
- helpful without praising every input.

Example:

- Use: “This claim needs a source.”
- Avoid: “Great job! Your amazing draft could be even better with a source.”

## 4. Color tokens

### Brand

| Token | Hex | Use |
|---|---:|---|
| `brand-700` | `#08755F` | pressed controls, dark text accents |
| `brand-600` | `#0B9377` | labels and accessible links |
| `brand-500` | `#12AD89` | primary actions |
| `brand-400` | `#15C39A` | logo and active indicators |
| `brand-100` | `#DFF6EF` | selected cards and positive backgrounds |
| `brand-50` | `#EFFBF7` | canvas tint |

### Neutral

| Token | Hex | Use |
|---|---:|---|
| `ink-950` | `#172E29` | primary headings |
| `ink-800` | `#243430` | primary body text |
| `ink-600` | `#51625E` | secondary text |
| `ink-500` | `#74817E` | metadata |
| `line-300` | `#CAD3D0` | strong field border |
| `line-200` | `#DFE5E2` | card borders and dividers |
| `surface-100` | `#F3F7F5` | muted controls |
| `surface-50` | `#FBFCFC` | settings canvas |
| `white` | `#FFFFFF` | elevated surfaces |

### Semantic

| Token | Hex | Use |
|---|---:|---|
| `error-600` | `#D43E48` | definite grammar/error states |
| `error-50` | `#FFF0F1` | error background |
| `warning-600` | `#C07816` | uncertainty and evidence warnings |
| `warning-400` | `#EFA83F` | warning icon |
| `warning-50` | `#FFF2DF` | warning background |
| `info-600` | `#3A65B8` | informational state and citations |
| `info-50` | `#EEF4FF` | informational background |

All text/background pairings must meet WCAG 2.2 AA. Never communicate status using color alone.

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

Contains icon, name, and one short outcome. Selected state uses `brand-100`, `brand-500` border, and a visible check. Modes must not rely on custom colors for meaning.

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
- Visible 3 px focus ring using translucent brand green plus a solid inner edge.
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
- “WriteRight knows”

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
  --wr-brand-700: #08755f;
  --wr-brand-600: #0b9377;
  --wr-brand-500: #12ad89;
  --wr-brand-400: #15c39a;
  --wr-brand-100: #dff6ef;
  --wr-brand-50: #effbf7;
  --wr-ink-950: #172e29;
  --wr-ink-800: #243430;
  --wr-ink-600: #51625e;
  --wr-ink-500: #74817e;
  --wr-line-300: #cad3d0;
  --wr-line-200: #dfe5e2;
  --wr-surface-100: #f3f7f5;
  --wr-surface-50: #fbfcfc;
  --wr-error-600: #d43e48;
  --wr-warning-600: #c07816;
  --wr-info-600: #3a65b8;
  --wr-radius-sm: 6px;
  --wr-radius-md: 8px;
  --wr-radius-lg: 11px;
  --wr-radius-xl: 14px;
  --wr-focus: 0 0 0 3px rgba(18, 173, 137, .22);
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
