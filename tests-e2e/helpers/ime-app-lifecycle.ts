// Shared launch/teardown boilerplate for the three IME matrix spec files
// (matrix-a/b/c). Each spec file gets its OWN app process + its own
// isolated fixture copy (so B10's autoSave writes in matrix-b never touch
// matrix-a/c's documents), but all three reuse the exact same hard
// constraints E1 task 5 established for the smoke suite:
//   - `--user-data-dir` + `HOME` override (helpers/user-data-guard.ts)
//   - before/after snapshot of the REAL userData dir, asserted equal
//   - the same 4-level build resolution (helpers/resolve-app.ts)
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { _electron as electron, expect, type CDPSession, type ElectronApplication, type Page } from '@playwright/test'
import { E2E_ROOT, ISOLATION_BASE_DIR } from './config'
import { ACTIVE_ENGINE } from './engine-profile'
import { prepareIsolatedFixtureCopy, type IsolatedFixtureCopy } from './ime-fixture'
import { resolveApp, type ResolvedApp } from './resolve-app'
import {
  createIsolatedEnvironment,
  snapshotRealUserData,
  snapshotsEqual,
  type IsolatedEnvironment,
  type UserDataSnapshot
} from './user-data-guard'

export interface ImeAppHandle {
  resolvedApp: ResolvedApp
  isolatedEnv: IsolatedEnvironment
  fixtureCopy: IsolatedFixtureCopy
  app: ElectronApplication
  window: Page
  cdp: CDPSession
  baselineUserDataSnapshot: UserDataSnapshot
  consoleErrors: string[]
  pageErrors: string[]
  /** Close the app, verify the real userData dir is untouched, clean up
   * temp dirs. Call from the spec file's `test.afterAll`. */
  teardownAndVerifyIsolation(): Promise<void>
}

export async function launchImeApp(isolationSubdir: string): Promise<ImeAppHandle> {
  const resolvedApp = resolveApp()
  const baselineUserDataSnapshot = snapshotRealUserData()
  const isolatedEnv = createIsolatedEnvironment(path.join(ISOLATION_BASE_DIR, isolationSubdir))
  const fixtureCopy = prepareIsolatedFixtureCopy(path.join(ISOLATION_BASE_DIR, isolationSubdir))

  const app = await electron.launch({
    executablePath: resolvedApp.executablePath,
    args: [`--user-data-dir=${isolatedEnv.userDataDir}`, '--disable-gpu', fixtureCopy.path],
    env: {
      ...process.env,
      HOME: isolatedEnv.fakeHome,
      NODE_ENV: 'production'
    },
    timeout: 30_000
  })

  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  app.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[main] ${msg.text()}`)
  })

  const window = await app.firstWindow({ timeout: 20_000 })
  window.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[renderer] ${msg.text()}`)
  })
  window.on('pageerror', (err) => {
    pageErrors.push(err.stack ?? err.message)
  })

  await window.waitForLoadState('domcontentloaded')
  // Readiness selector comes from the active engine profile: legacy muyajs
  // exposes `#ag-editor-id`, muya v2 replaces editor.vue's host div with
  // `.editor-component.mu-editor`.
  await window
    .locator(ACTIVE_ENGINE.readySelector)
    .waitFor({ state: 'visible', timeout: 15_000 })

  const cdp = await app.context().newCDPSession(window)

  let closed = false
  return {
    resolvedApp,
    isolatedEnv,
    fixtureCopy,
    app,
    window,
    cdp,
    baselineUserDataSnapshot,
    consoleErrors,
    pageErrors,
    async teardownAndVerifyIsolation(): Promise<void> {
      if (!closed) {
        await app.close().catch(() => {})
        closed = true
      }
      const finalSnapshot = snapshotRealUserData()
      const unchanged = snapshotsEqual(baselineUserDataSnapshot, finalSnapshot)
      isolatedEnv.cleanup()
      fixtureCopy.cleanup()
      expect(
        unchanged,
        'hard constraint: the real ~/Library/Application Support/marktext userData dir must be ' +
          `untouched by the IME suite. before=${JSON.stringify(baselineUserDataSnapshot)} ` +
          `after=${JSON.stringify(finalSnapshot)}`
      ).toBe(true)
    }
  }
}

export function screenshotDirFor(subdir: string): string {
  const dir = path.join(E2E_ROOT, '.artifacts', 'screenshots', 'ime', subdir)
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Where a matrix spec file's raw-result JSON (helpers/ime-report.ts) should
 * land. Non-legacy engines get their id appended so a comparison run cannot
 * overwrite the legacy baseline (and so the legacy path stays exactly what
 * task 1's report documented).
 */
export function resultsPathFor(name: string): string {
  const suffix = ACTIVE_ENGINE.id === 'legacy' ? '' : `-${ACTIVE_ENGINE.id}`
  return path.join(E2E_ROOT, '.artifacts', `ime-results-${name}${suffix}.json`)
}

export function ensureExists(p: string): void {
  if (!existsSync(p)) throw new Error(`Expected path to exist: ${p}`)
}
