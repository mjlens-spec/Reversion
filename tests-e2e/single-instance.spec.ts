import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { ISOLATION_BASE_DIR } from './helpers/config'
import { resolveApp } from './helpers/resolve-app'
import { createIsolatedEnvironment, type IsolatedEnvironment } from './helpers/user-data-guard'

const TEST_DIR = path.join(ISOLATION_BASE_DIR, 'single-instance')
const FIRST_FILE = path.join(TEST_DIR, 'first-instance.md')
const SECOND_FILE = path.join(TEST_DIR, 'second-instance.md')
const SECOND_MARKER = 'SECOND_INSTANCE_HANDOFF_OK'

let app: ElectronApplication
let window: Page
let isolatedEnv: IsolatedEnvironment

test.describe.serial('Reversion single-instance lock', () => {
  test.beforeAll(async () => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
    writeFileSync(FIRST_FILE, '# First instance\n')
    writeFileSync(SECOND_FILE, `# ${SECOND_MARKER}\n`)

    const resolved = resolveApp()
    isolatedEnv = createIsolatedEnvironment(TEST_DIR)
    app = await electron.launch({
      executablePath: resolved.executablePath,
      args: [`--user-data-dir=${isolatedEnv.userDataDir}`, '--disable-gpu', FIRST_FILE],
      env: {
        ...process.env,
        HOME: isolatedEnv.fakeHome,
        NODE_ENV: 'production'
      }
    })
    window = await app.firstWindow()
    await expect(window.locator('.mu-editor')).toBeVisible()
  })

  test.afterAll(async () => {
    await app?.close().catch(() => {})
    isolatedEnv?.cleanup()
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  test('second launch exits and hands the file to the existing focused window', async () => {
    const resolved = resolveApp()
    const secondExit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve, reject) => {
        const child = spawn(
          resolved.executablePath,
          [`--user-data-dir=${isolatedEnv.userDataDir}`, '--disable-gpu', SECOND_FILE],
          {
            cwd: TEST_DIR,
            env: {
              ...process.env,
              HOME: isolatedEnv.fakeHome,
              NODE_ENV: 'production'
            },
            stdio: 'ignore'
          }
        )
        child.once('error', reject)
        child.once('exit', (code, signal) => resolve({ code, signal }))
      }
    )

    await expect(window.locator('.mu-editor')).toContainText(SECOND_MARKER, { timeout: 15_000 })
    await expect.poll(() => app.windows().length).toBe(1)
    await expect.poll(() => window.evaluate(() => document.hasFocus())).toBe(true)
    await expect(secondExit).resolves.toEqual({ code: 0, signal: null })
  })
})
