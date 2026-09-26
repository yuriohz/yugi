# WriteRight Extension — Engineering and Product Debrief

**Prepared:** September 26, 2026  
**Repository:** `yuriohz/yugi`  
**Working branch:** `arena/01a0dbec-yugi`  
**Release:** 1.0.0

## 1. Executive summary

WriteRight is a Chrome Manifest V3 proofreading extension inspired by the interaction model of modern writing assistants, while retaining original branding and visual assets. It operates in text inputs, textareas, and contenteditable regions, including WhatsApp Web. Users connect their own OpenRouter API key and review AI-generated spelling, grammar, punctuation, and clarity suggestions before applying them.

The repository includes the runtime extension, a four-step onboarding wizard, settings and popup interfaces, marketing artwork, Chrome Web Store copy, a privacy policy, packaging automation, and a validated upload ZIP.

## 2. Product decisions

- **Bring-your-own-key:** avoids operating a credential-bearing proxy or billing backend.
- **OpenRouter default:** provides one endpoint and access to multiple compatible models.
- **Review-first UX:** no correction is applied without the user's explicit action.
- **Cross-site operation:** `<all_urls>` provides the requested “anywhere” experience.
- **Original identity:** the visual hierarchy is familiar to writing-assistant users, but the name, logo, palette, copy, and implementation are WriteRight assets rather than copied Grammarly assets.
- **No account system:** settings remain in `chrome.storage.local`; WriteRight has no first-party database.

## 3. Architecture

### Manifest and service worker

`manifest.json` declares Manifest V3, a background service worker, a toolbar popup, an options page, local storage access, and content-script access across sites.

`background.js`:

1. Opens onboarding after first install.
2. Receives text from the isolated content script.
3. Reads API configuration from local extension storage.
4. Sends an OpenAI-compatible request to OpenRouter.
5. Adds OpenRouter attribution headers (`HTTP-Referer` and `X-Title`).
6. Parses and validates structured issue offsets.
7. Supports a setup-time connection test.

### Content integration

`content.js` discovers supported editable elements using event delegation. After a 700 ms pause, text is checked through the service worker. The script injects a high-z-index assistant button and review panel, supports individual and bulk acceptance, and dispatches a bubbling `InputEvent` after replacement so frameworks such as WhatsApp's UI can observe the edit.

### User interfaces

- `onboarding.*`: four-step setup and connection-testing wizard.
- `popup.*`: compact status and settings launcher.
- `options.*`: persistent endpoint, key, model, language, and enable/disable controls.
- `content.css`: responsive in-page review UI, focus states, and reduced-motion handling.

## 4. Privacy and security assessment

### Implemented protections

- Password fields are absent from the editable selector.
- API keys are not placed in content scripts or page DOM.
- Credentials are stored in `chrome.storage.local`, not sync storage.
- API calls occur in the extension service worker.
- Model output is escaped before insertion into UI HTML.
- Suggestions are range-validated against the submitted text.
- Packaging refuses likely embedded OpenAI/OpenRouter secrets.
- There is no remotely hosted executable code.
- Content Security Policy remains Chrome's Manifest V3 default.

### Material caveats for review

- `chrome.storage.local` is appropriate for this BYOK design but is not an operating-system secrets vault. Malware or an attacker with local browser-profile access may obtain stored values.
- The full current field is sent to OpenRouter after a typing pause. This is disclosed in onboarding, README, and privacy policy.
- OpenRouter and the selected upstream model may have their own logging and retention policies.
- `<all_urls>` is a powerful permission. It matches the product requirement but will receive additional Web Store review. A least-privilege alternative would use optional host permissions and per-site activation.
- AI output is untrusted and can be wrong. Users are reminded to review suggestions.

## 5. UX behavior

1. Installation launches onboarding.
2. The user creates/pastes an OpenRouter key, selects a model, and runs a live connection test.
3. The user selects language and proofreading preference.
4. In an editable field, a green WriteRight control appears.
5. After a typing pause, the assistant displays issue count and writing quality status.
6. Opening the panel reveals categorized correction cards.
7. The user accepts one suggestion or all current suggestions.

Empty, loading, success, and API-error states are implemented. Layout adapts below 440 px, keyboard focus is visible, and animation honors `prefers-reduced-motion`.

## 6. Distribution and marketing deliverables

- `STORE_LISTING.md`: title, short copy, long copy, category, permission rationale, and submission checklist.
- `PRIVACY_POLICY.md`: data handling, storage, sharing, retention, permissions, and contact route.
- `store-assets/screenshot-1-whatsapp.png`: 1280×800 primary workflow.
- `store-assets/screenshot-2-setup.png`: 1280×800 OpenRouter onboarding.
- `store-assets/screenshot-3-privacy.png`: 1280×800 privacy positioning.
- `store-assets/promo-small.png`: 440×280 promotional tile.
- `store-assets/promo-marquee.png`: 1400×560 marquee artwork.
- Editable SVG sources accompany every marketing image.
- `package.sh`: repeatable validator and Chrome upload ZIP builder.

## 7. Validation completed

- All extension JavaScript parses with `node --check`.
- `manifest.json` parses as valid JSON.
- `git diff --check` reports no whitespace errors.
- Packaging scans for likely embedded API keys.
- ZIP integrity is checked with `unzip -t`.
- Marketing PNG dimensions match Chrome Web Store asset dimensions.

## 8. Known limitations and recommended next work

1. **Real-browser QA:** This environment did not provide a Chrome binary, so the extension was not end-to-end exercised inside WhatsApp Web. Perform a manual acceptance pass in current Chrome before store submission.
2. **Rich editors:** Editors that use nested iframes, canvas rendering, closed shadow roots, or custom state reconciliation can require site-specific adapters.
3. **Underline precision:** Native plain inputs do not expose styleable text ranges. The current MVP marks a field with issue styling and shows precise issue ranges in the review panel; a future mirror-layer renderer could underline exact ranges in textarea/input controls.
4. **Offset robustness:** If a page changes text between analysis and acceptance, current text is rechecked after edits, but a stronger implementation should verify `original` at the returned range before applying.
5. **Model compatibility:** OpenRouter models differ in JSON-mode behavior. The default is designed for OpenAI-compatible structured output, but arbitrary model choices should be compatibility-tested.
6. **Automated tests:** Add unit tests for issue validation/replacement and Playwright extension tests against textarea, input, contenteditable, and a controlled WhatsApp-like editor fixture.
7. **Store privacy form:** The publisher must answer Chrome's privacy-practices questionnaire and provide the public privacy-policy URL. These dashboard actions cannot be completed from source code.
8. **Support identity:** GitHub Issues is the current contact route. A monitored support email and verified domain would improve store trust.

## 9. Reviewer prompts for Opus

Please review specifically:

- Whether broad host permission is justified or should become optional per-site access.
- Whether storing BYOK credentials in `chrome.storage.local` is acceptable for the target audience.
- Whether the prompt/output contract handles enough OpenRouter model variation.
- Whether contenteditable replacement is sufficiently safe for React-controlled editors and WhatsApp Web.
- Whether exact-range verification should block stale suggestions before v1 release.
- Whether privacy disclosures satisfy Chrome Web Store Limited Use expectations.
- Whether a first-party proxy is warranted for abuse controls, schema normalization, and key isolation.

## 10. Release recommendation

**Recommendation: release-candidate, not yet unconditional production approval.** The code and listing package are complete enough for local installation and Web Store upload. Before public launch, complete one manual Chrome/WhatsApp acceptance pass, confirm the selected default model remains available in OpenRouter, host the privacy policy at a stable public URL, and complete the Web Store privacy questionnaire.
