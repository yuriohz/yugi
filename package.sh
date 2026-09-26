#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 -m json.tool manifest.json >/dev/null
for f in *.js; do node --check "$f"; done
if grep -R --exclude='package.sh' --exclude='writeright-extension.zip' --exclude-dir='.git' --exclude-dir='.venv' --exclude-dir='store-assets' -E 'sk-or-v1-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9_-]{20,}' .; then
  echo 'Refusing to package: a possible API key was found.' >&2
  exit 1
fi
rm -f writeright-extension.zip
zip -q writeright-extension.zip manifest.json background.js content.js content.css popup.html popup.js options.html options.js options.css onboarding.html onboarding.js onboarding.css icons/*.png
echo 'Created writeright-extension.zip'
