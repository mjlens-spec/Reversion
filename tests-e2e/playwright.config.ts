import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// E1 task 5 smoke suite: drives a built Reversion .app via
// `_electron.launch`. No browser project/device matrix is declared — this
// suite never touches Chromium/Firefox/WebKit, only the Electron binary
// inside the app bundle we resolve ourselves (see helpers/resolve-app.ts),
// so `npx playwright install` is never required.
//
// Serial, single-worker by design: each spec launches a real desktop app
// process, and the userData-isolation guard (helpers/user-data-guard.ts)
// compares a single before/after snapshot of the real
// `~/Library/Application Support/marktext` directory across the *whole*
// run. Parallel workers would interleave unrelated filesystem activity and
// make that comparison meaningless.
export default defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.ts/,
  // E3 task 1 added tests-e2e/ime/*.spec.ts (its own suite, its own
  // playwright.ime.config.ts, its own `npm run test:e2e:ime` entry point).
  // Excluded here so a plain `npm run test:e2e` keeps running exactly the
  // E1 task 5 smoke suite, unchanged.
  testIgnore: /ime\/.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: path.join(__dirname, '.artifacts', 'test-results')
})
