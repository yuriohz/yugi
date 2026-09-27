# WordSaffron — launch trailer

A 35.6-second launch film for the WordSaffron Chrome extension, rendered **entirely from
JavaScript** — no After Effects, no Premiere, no video templates.

```bash
cd video
npm install
npm run audio     # trims the VO, composes the score, mixes → out/audio.wav
npm run video     # renders every frame → out/wordsaffron-launch.mp4
```

## What it is

1080p · 30 fps · 1920×1080 · H.264 + AAC · ~36 s

| Scene | Time | Beat |
|---|---|---|
| Cold open | 0.00–3.60 | "Every message is a first impression." |
| Impact | 3.60–5.70 | "Make it land." |
| Wordmark | 5.70–7.90 | "Meet WordSaffron." |
| Select | 7.90–11.00 | "Select any text, anywhere on the web." |
| Rewrite | 11.00–15.30 | "Choose a mode. Watch it sharpen…" |
| Five modes | 15.30–21.10 | Polish · Casual · Polite · Professional & Firm · Technical Review |
| Fidelity | 21.10–25.40 | "Your numbers, names and dates survive the rewrite." |
| Controls | 25.40–29.10 | "Your key. Your provider. Your rules." |
| Outro | 29.10–35.60 | "A pinch of clarity. Still your words." |

## How it is built

Chrome/Chromium cannot be downloaded in this sandbox (Google's CDN is blocked), so
Remotion was not an option. The renderer here is purpose-built:

```
timeline (seconds)  →  scene functions return SVG  →  resvg rasterises  →  ffmpeg encodes
```

- `src/timeline.js` — shot list and voice-line placement, in seconds.
- `src/scenes.js` — the nine shots. Each is a pure function `(t) => svg string`.
- `src/anim.js` — easings, analytic springs, stagger, drift, scrambles.
- `src/theme.js` — brand tokens plus SVG primitives (`rect`, `text`, `mark`, gradients, grain).
- `src/measure.js` — real text metrics: it rasterises a string and scans the ink extents,
  because resvg has no metrics API. Layouts (pills, cards, wrapping, underlines) are built
  from measured ink boxes, so nothing is positioned by guesswork.
- `src/ui.js` — the extension's own components, rebuilt from `design-v2/*.svg` and
  `DESIGN_SYSTEM.md`: browser shell, chat surface, assistant badge, mode cards, rewrite
  panel, comparison view, switches, check chips.
- `src/audio/music.js` — the score is synthesised from oscillators (kick, sub, hats,
  snare, plucks, pads, bells, risers, impacts) into a 124 BPM groove in A minor, with
  Schroeder reverb and ping-pong delay. No samples, no licence.
- `src/build-audio.js` — trims the voice lines, places them, ducks the music under the
  voice, applies a master EQ chain and writes `out/audio.wav`.
- `src/render.js` — frame loop, crossfade transitions, camera drift, grain and vignette,
  parallel chunk rendering and the final mux.

Frames render at 1.5× and are downsampled with Lanczos, so edges stay clean.

## Voiceover

Nine lines in `public/vo/`, generated with a single registered British-English voice so the
narration stays consistent. The mode names in `06.mp3` are detected by silence segmentation
(`voicedSegments`) and the five mode cards snap in on the exact frames the names are spoken.

## Verifying without eyes

```bash
node src/check.js                       # every text node inside the frame? luminance sane?
node src/preview.js 13.4                # ASCII luminance map of a frame
node src/preview.js 14.6 --crop 990,240,720,400   # zoom into a region
node src/render.js --sheet              # contact sheet of 12 key frames
```

## Brand and legal notes

- Every colour, radius, type decision and label comes from `BRAND_GUIDELINES.md`,
  `DESIGN_SYSTEM.md` and `design-v2/`.
- On-screen copy is taken from the real product: mode names, "Meaning preserved",
  "No claims, dates, or commitments were added.", "Conclusion is not yet supported",
  "Original stays available for undo after replacement."
- **Nothing here is a runtime capture.** The extension has never been run in a browser, so
  the end card carries the line "Motion-graphics mockup · not a runtime capture", as
  `BRAND_GUIDELINES.md` requires of unreleased artwork.
- The end card says "Chrome Web Store". The listing is **not submitted** yet — swap or cut
  that card before publishing.
- No claim of free/Pro pricing, undetectable output, or guaranteed correctness appears
  anywhere in the film.
