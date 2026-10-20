#!/usr/bin/env sh
# Full e2e matrix (Chromium + WebKit) inside Microsoft's Playwright image, which
# ships the Ubuntu libraries WebKit needs. Uses the host's node_modules; the
# image's Playwright version must match package.json.
set -eu
PW_VERSION=$(node -p "require('@playwright/test/package.json').version")
exec docker run --rm --init --ipc=host --network host \
  --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI=1 \
  -v "$PWD":/work -w /work \
  "mcr.microsoft.com/playwright:v${PW_VERSION}-noble" \
  npx playwright test "$@"
