# Store assets — provenance

**Every image in this folder is labelled by how it was produced. Nothing that was not
captured from a running browser is described as a runtime screenshot.**

## Current state

| File | What it actually is | Store-ready? |
|---|---|---|
| `screenshot-1-whatsapp.png` (+ `.svg`) | Rendered from the `design-v2/` mockups. **Not a runtime screenshot.** | ❌ No |
| `screenshot-2-setup.png` (+ `.svg`) | Rendered from the `design-v2/` mockups. **Not a runtime screenshot.** | ❌ No |
| `screenshot-3-privacy.png` (+ `.svg`) | Rendered from the `design-v2/` mockups. **Not a runtime screenshot.** | ❌ No |
| `promo-small.png` (+ `.svg`) | Designed promotional artwork. Legitimate as promotional art | ⚠️ Review before use |
| `promo-marquee.png` (+ `.svg`) | Designed promotional artwork. Legitimate as promotional art | ⚠️ Review before use |

## Why there are no runtime screenshots

The environment this build was produced in has **no Chrome or Chromium binary**, and the
browser download endpoints are blocked at the network layer:

```
$ which google-chrome chromium chromium-browser
(no output)

$ npx playwright install chromium
Failed to download Chromium 131.0.6778.33, caused by Error: Download failure, code=1

$ npx playwright install --with-deps chromium
E: Unable to locate package libnss3
E: Unable to locate package libxkbcommon0
E: Unable to locate package xvfb
...
```

Producing a store screenshot therefore requires either running the extension in Chrome by
hand, or rendering a mockup and calling it a screenshot. **The second is not acceptable**,
so it was not done, and the mockup-derived files above are marked not store-ready.

## What has to happen before submission

1. Load `dist/` unpacked in Chrome.
2. Work through `docs/MANUAL_TEST_PLAN.md`.
3. Capture at 1280 × 800 (the Chrome Web Store's preferred size):
   - the widget open on a real page with real suggestions
   - the comparison view showing a real before and after
   - a technical review with real, clickable sources
   - the settings page with real model data from the OpenRouter catalogue
   - Arabic RTL in a real editor
4. Save each as `<name>-runtime.png` in this folder.
5. Replace the table above with the capture date and the Chrome version used.
6. Delete the three mockup-derived screenshots, or keep them out of the submission.

## The rule

Chrome Web Store policy requires screenshots to depict the actual product experience. A
mockup passed off as a screenshot is a policy violation and, more simply, a false
statement about the product. The labelling in this file exists so that cannot happen by
accident.

### Provider refresh — 26 September 2026

All SVG/PNG pairs remain **design mockups**, with an on-image disclaimer. Setup
mentions OpenRouter and Google AI Studio and shows the provider selector. Promos
use provider-neutral copy. Re-rendered every PNG using `@resvg/resvg-js` with
`{ font: { loadSystemFonts: true } }`; renderer dependencies were kept outside the
extension package. Runtime screenshots must still follow manual-test section M.
