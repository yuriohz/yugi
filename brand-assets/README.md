# WordSaffron identity assets — stage 1

These are first editable vector interpretations of the owner-approved Tactile concept 04.

- `word-saffron-mark.svg` / `.png` — speech-bubble/petal symbol master and large preview
- `word-saffron-mark-16.png`, `-32.png`, `-48.png`, `-128.png` — toolbar-size previews
- `word-saffron-lockup.svg` / `.png` — symbol plus WordSaffron wordmark

SVGs are editable source files. PNG previews were rendered in the sandbox and visually
inspected. The lockup preview uses a local DejaVu Serif Bold font; the SVG wordmark uses
system-serif fallbacks, so verify the final chosen typeface before producing release art.

Rollout record: the 16/32/48/128 px mark exports were copied into the extension's
runtime `icons/` folder in Stage 2 (27 September 2026; byte-identical, covered by
`tests/unit/branding.test.js`). The smallest icon was reviewed at 16 px. Obtain
trademark review before public use.
