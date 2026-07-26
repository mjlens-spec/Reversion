import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// E3 task 2 diagnostics config. Drives the `.diag.ts` files under ime/,
// which the graded IME config (playwright.ime.config.ts,
// `testMatch: /.*\.spec\.ts/`) deliberately ignores — so the matrix suite
// task 1 shipped stays byte-for-byte unchanged while task 2 can run
// repeat-count / condition-variant probes against the same helpers.
export default defineConfig({
  testDir: path.join(__dirname, 'ime'),
  testMatch: /.*\.diag\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: path.join(__dirname, '.artifacts', 'test-results-diag')
})
