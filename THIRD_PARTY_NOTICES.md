# Third-party notices

WriteRight includes work from the projects listed below. Their licences are reproduced in full.

---

## 1. No AI Slop — Peter Yang

- **Project:** No AI Slop
- **Author:** Peter Yang ([@petergyang](https://github.com/petergyang))
- **Source:** https://github.com/petergyang/no-ai-slop
- **Licence:** MIT
- **Exact upstream commit used:** `000650b156983f5159695b441477f4e63b25dc85`
- **Commit subject:** `Drop planning ritual and process self-check; add skill-folder agent metadata (#49)`
- **Commit date:** 1 September 2026
- **Retrieved:** 26 September 2026

### What WriteRight uses

No AI Slop is the editing backbone of WriteRight. The upstream skill is a prose-editing
instruction set written for a general-purpose agent. WriteRight adapts it into structured,
machine-readable data and runtime prompt layers:

| WriteRight artefact | Derived from | Nature of the adaptation |
|---|---|---|
| `src/core/slop-rules.js` | `skills/no-ai-slop/SKILL.md` — *Words to cut*, *Patterns to cut* | Upstream prose rules converted into typed rule records with identifiers, severities, detection expressions, and short fixes. Rule wording is paraphrased or quoted in short fragments for detection and user-facing explanation. |
| `src/core/slop-detector.js` | `skills/no-ai-slop/SKILL.md` — *Patterns to cut* | An original deterministic detector implementing the upstream pattern taxonomy locally, with no model call. |
| `src/core/prompts.js` — anti-slop contract layer | `skills/no-ai-slop/SKILL.md` — *Editing principles*, *Workflow* | Upstream editing principles restated as a prompt layer composed beneath WriteRight's own safety and fidelity contracts. |
| `src/core/slop-eval.js` | `skills/no-ai-slop/eval.md` | Upstream post-edit checklist converted into programmatic post-flight checks. |

### What WriteRight adds on top

The following are WriteRight's own work and are not part of the upstream project: the safety
and fidelity contracts, the five modes, Modern Standard Arabic and Egyptian Arabic handling,
British English defaults, the Technical Review and researched-review workflows, profiles,
prompt library, custom modes, shutdown controls, site adapters, range mapping, and the whole
Chrome extension runtime.

### Upstream licence

```
MIT License

Copyright (c) 2026 Peter Yang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

WriteRight is not affiliated with or endorsed by Peter Yang.

---

## 2. esbuild — Evan Wallace

- **Source:** https://github.com/evanw/esbuild
- **Licence:** MIT
- **Use:** development-time bundling only. esbuild is a `devDependency`. No part of esbuild,
  and no third-party runtime dependency of any kind, is shipped inside the published
  extension package. The packaged extension contains only first-party JavaScript, HTML, CSS,
  and PNG assets, and loads no remotely hosted executable code.

---

## 3. Referenced but not included

The following were consulted during planning and are **not** bundled, vendored, or adapted:

- `haidrrrry/humanize-ai-writing` (MIT) — evaluated in `PRODUCT_PLAN_V2.md` during early
  research. Superseded by No AI Slop as the editing backbone. No code or rule text from this
  project is present in WriteRight.
- Grammarly — referenced only as publicly documented competitive context. No Grammarly code,
  trademark, or proprietary asset is used.
- OpenRouter — a user-configured network API, not bundled code.
