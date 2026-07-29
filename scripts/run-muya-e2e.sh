#!/usr/bin/env bash
# Reversion gate wrapper for the muya engine's own Playwright suite
# (`upstream/marktext/packages/muya/e2e`, ~106 cases, Chromium ~4 s).
#
# That suite drives @muyajs/core in a plain browser page rather than the
# Electron app, so it is the fast, direct verification for inline-render and
# table work — the Electron e2e suite only covers those indirectly. It sat
# outside the Reversion gate until 1.5.0.
#
# Chromium only, matching the upstream CI matrix: Firefox and WebKit are
# configured in playwright.config.ts but still carry engine-specific skips.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E_DIR="$REPO_ROOT/upstream/marktext/packages/muya/e2e"

if [ ! -d "$E2E_DIR/node_modules" ]; then
  echo "error: $E2E_DIR/node_modules is missing — install the upstream workspace first." >&2
  exit 1
fi

cd "$E2E_DIR"

# See the `retries` comment in playwright.config.ts: one retry absorbs the
# upstream selection flake in inline/format-toolbar.spec.ts without hiding a
# genuine regression, which would fail both attempts.
export PW_RETRIES="${PW_RETRIES:-1}"

exec ./node_modules/.bin/playwright test --project=chromium "$@"
