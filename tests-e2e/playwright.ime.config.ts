import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// E3 task 1: IME matrix suite. Separate config/entry point
// (`npm run test:e2e:ime`) from the E1 task 5 smoke suite so the two never
// interleave in one run — each of matrix-a/b/c.spec.ts launches and tears
// down its own Reversion.app process (see helpers/ime-app-lifecycle.ts),
// same reasoning as playwright.config.ts: `workers: 1` + serial so the
// real-userData-dir before/after snapshot comparison in each file's
// `afterAll` stays meaningful.
//
// Longer default timeouts than the smoke suite: several matrix cells
// intentionally run multi-step composition sequences (B9's 5×30-character
// bursts, C1's multi-cycle sentence) that take longer than a single
// interaction.
export default defineConfig({
  testDir: path.join(__dirname, 'ime'),
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: path.join(__dirname, '.artifacts', 'test-results-ime')
})
