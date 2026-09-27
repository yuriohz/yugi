# Integration tests

## What these are

End-to-end **journey** tests. They wire the real modules together the way the extension
wires them at runtime — content-script logic → message channel → background router →
prompt composition → transport → validation → guardrails → apply — and drive them
through complete user journeys with a scripted transport.

Everything except the browser itself is the real code. There are no mocks of WordSaffron's
own logic.

## What these are **not**

They are **not** run in Chrome, and they are **not** a substitute for real-browser
acceptance testing.

The sandbox this project was built in has no Chrome or Chromium binary, and the browser
download endpoints are blocked at the network layer:

```
$ npx playwright install chromium
Failed to download Chromium 131.0.6778.33, caused by Error: Download failure, code=1

$ npx playwright install --with-deps chromium
E: Unable to locate package libnss3
E: Unable to locate package libxkbcommon0
...
```

So the following are **not** covered here and must be done manually before release:

- that the extension loads unpacked in Chrome without a manifest error
- that the service worker registers and stays alive
- that the content script attaches on a real page
- that the CSS Custom Highlight API draws where it is expected to
- that the widget positions correctly over a real editor
- that RTL mirroring renders correctly with a real Arabic font stack

`docs/MANUAL_TEST_PLAN.md` is the script for those, and it is written to be executed by a
person in front of a real browser.

## Honest labelling

No screenshot in this repository that was produced without a browser is described as a
runtime screenshot. See `store-assets/README.md`.
