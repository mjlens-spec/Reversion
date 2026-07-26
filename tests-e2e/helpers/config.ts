import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const E2E_ROOT = path.resolve(__dirname, '..')

export const FIXTURE_MD_PATH = path.join(E2E_ROOT, 'fixtures', 'smoke.md')

// Where per-assertion screenshots land. Configurable so this suite can be
// pointed at a different capture location per session/CI run (e.g. this
// task's scratchpad directory) without editing source. Defaults to a
// gitignored folder inside tests-e2e/ for a plain `npm run test:e2e`.
export const SCREENSHOT_DIR =
  process.env.REVERSION_E2E_SCREENSHOT_DIR ?? path.join(E2E_ROOT, '.artifacts', 'screenshots')

// Base temp directory for the isolated $HOME / --user-data-dir pair created
// per test run. Defaults next to the screenshot dir; override together with
// it if you want everything under one scratch location.
export const ISOLATION_BASE_DIR =
  process.env.REVERSION_E2E_ISOLATION_DIR ?? path.join(E2E_ROOT, '.artifacts', 'isolated-home')
