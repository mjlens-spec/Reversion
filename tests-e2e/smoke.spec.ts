// E1 task 5 — Reversion e2e smoke suite.
//
// Drives a real built Reversion .app (see helpers/resolve-app.ts for which
// artifact) with Playwright's `_electron.launch`, and checks that the app
// actually runs and that every Reversion source customization from E1 task 3
// (outputs/E1任务3_补丁源码化报告_Claude_260726.md) is live in the running
// process — not just present in the built files.
//
// Tests run in one serial file-level worker (see playwright.config.ts) and
// share the app lifecycle across `test.describe.serial`: launch happens in
// test 2, shutdown in test 9, and every test in between operates on the same
// running window. This is deliberate — a fresh app process per assertion
// would be ~10x slower and wouldn't change what's being verified.
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { FIXTURE_MD_PATH, ISOLATION_BASE_DIR, SCREENSHOT_DIR } from './helpers/config'
import { resolveApp, type ResolvedApp } from './helpers/resolve-app'
import {
  createIsolatedEnvironment,
  realUserDataDir,
  snapshotRealUserData,
  snapshotsEqual,
  type IsolatedEnvironment,
  type UserDataSnapshot
} from './helpers/user-data-guard'

mkdirSync(SCREENSHOT_DIR, { recursive: true })

function screenshotPath(name: string): string {
  return path.join(SCREENSHOT_DIR, name)
}

// Shared across the serial run.
let resolvedApp: ResolvedApp
let isolatedEnv: IsolatedEnvironment
let electronApp: ElectronApplication
let appClosed = false
let window: Page
let baselineUserDataSnapshot: UserDataSnapshot
const consoleErrors: string[] = []
const pageErrors: string[] = []

test.describe.serial('Reversion e2e smoke', () => {
  // Safety net for the case a mid-suite assertion throws: test 9 normally
  // closes the app and test 9's cleanup() removes the isolated $HOME, but a
  // failure in tests 3-8 skips the remaining serial tests (Playwright's
  // serial-mode behavior) without running them. Without this, a failed run
  // would leak a live Electron process and a temp directory under
  // ISOLATION_BASE_DIR on every failure. Guarded by `appClosed` (not
  // `electronApp.process()`) because Playwright tears down its internal
  // channel on close() -- calling `.process()` again afterwards throws.
  test.afterAll(async () => {
    if (electronApp && !appClosed) {
      await electronApp.close().catch(() => {})
    }
    isolatedEnv?.cleanup()
  })

  test('0. resolves the build under test', async () => {
    resolvedApp = resolveApp()
    expect(existsSync(resolvedApp.executablePath)).toBe(true)
    test.info().annotations.push({
      type: 'resolved-app',
      description: `${resolvedApp.source} (branded=${resolvedApp.branded}): ${resolvedApp.appBundlePath}`
    })
  })

  test('1. isolation baseline: snapshot the real userData directory before launch', async () => {
    baselineUserDataSnapshot = snapshotRealUserData()
    // Not a hard requirement that it exists (a from-scratch dev machine
    // wouldn't have it), but on this machine it does, and either way we now
    // have a well-defined "before" state to diff against in test 9.
    test.info().annotations.push({
      type: 'real-userdata-dir',
      description: `${realUserDataDir()} — exists=${baselineUserDataSnapshot.exists}, files=${baselineUserDataSnapshot.fileCount}`
    })
  })

  test('2. launch: app starts, first window appears, no immediate console/page errors', async () => {
    isolatedEnv = createIsolatedEnvironment(ISOLATION_BASE_DIR)

    electronApp = await electron.launch({
      executablePath: resolvedApp.executablePath,
      args: [
        `--user-data-dir=${isolatedEnv.userDataDir}`,
        '--disable-gpu',
        FIXTURE_MD_PATH
      ],
      env: {
        ...process.env,
        // Defense-in-depth isolation layer — see helpers/user-data-guard.ts
        // for why this matters even though --user-data-dir alone is the
        // documented, source-supported mechanism.
        HOME: isolatedEnv.fakeHome,
        NODE_ENV: 'production'
      },
      timeout: 30_000
    })

    electronApp.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[main] ${msg.text()}`)
    })

    window = await electronApp.firstWindow({ timeout: 20_000 })
    window.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[renderer] ${msg.text()}`)
    })
    window.on('pageerror', (err) => {
      pageErrors.push(err.stack ?? err.message)
    })

    await window.waitForLoadState('domcontentloaded')
    expect(window.url()).toBeTruthy()

    await window.screenshot({ path: screenshotPath('01-launch-first-window.png') })

    expect(pageErrors, `uncaught renderer exceptions on launch: ${pageErrors.join('\n')}`).toEqual([])
  })

  test('3. fixture renders: .mu-editor shows heading/list/table/code/formula', async () => {
    const editor = window.locator('.mu-editor')
    await expect(editor, '.mu-editor should exist and mount Muya 2').toBeVisible({ timeout: 15_000 })

    // Give the editor a moment to finish its initial paragraph parse pass
    // (muya renders incrementally); wait for the heading text from the
    // fixture rather than a fixed sleep.
    await expect(editor.locator('h1', { hasText: 'Reversion E2E Smoke Fixture' })).toBeVisible({
      timeout: 15_000
    })

    await expect(editor.locator('li', { hasText: 'first item' }).first()).toBeVisible()
    await expect(editor.locator('table')).toBeVisible()
    await expect(editor.locator('td', { hasText: 'TOC default' })).toBeVisible()
    await expect(editor.locator('code', { hasText: 'const x = 1' }).first()).toBeVisible()
    await expect(editor.locator('.katex').first(), 'inline formula should render via KaTeX').toBeVisible({
      timeout: 15_000
    })

    await window.screenshot({ path: screenshotPath('02-fixture-content-rendered.png'), fullPage: true })

    expect(pageErrors, `uncaught renderer exceptions while rendering fixture: ${pageErrors.join('\n')}`).toEqual([])
  })

  test('4. reversion default: sidebar expanded with TOC panel open', async () => {
    const sideBar = window.locator('.side-bar')
    await expect(sideBar, '.side-bar should be visible by default (showSideBar: true)').toBeVisible({
      timeout: 15_000
    })

    const toc = window.locator('.side-bar-toc')
    await expect(toc, '.side-bar-toc should be mounted (rightColumn: "toc")').toBeVisible({ timeout: 15_000 })

    const sideBarBox = await sideBar.boundingBox()
    expect(sideBarBox?.width ?? 0, 'sidebar should render at its expanded width, not the 45px collapsed strip').toBeGreaterThan(100)

    await window.screenshot({ path: screenshotPath('03-sidebar-toc-default-open.png') })
  })

  test('5. reversion default: Claude-like theme is active', async () => {
    const themeVars = await window.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return {
        accent: style.getPropertyValue('--claude-accent').trim(),
        background: style.getPropertyValue('--claude-bg').trim(),
        columnWidth: style.getPropertyValue('--reading-column-width').trim(),
        readingFontTitle: style.getPropertyValue('--reading-font-title').trim(),
        readingFontHeading: style.getPropertyValue('--reading-font-heading').trim(),
        readingFontBody: style.getPropertyValue('--reading-font-body').trim()
      }
    })

    expect(themeVars.accent.toUpperCase(), 'Claude-like accent (#BC6A3A)').toBe('#BC6A3A')
    expect(themeVars.background.toUpperCase()).toBe('#F7F6F3')
    expect(themeVars.columnWidth).toBe('calc(76% + 100px)')
    expect(themeVars.readingFontTitle, 'title font-role slot should be populated by the theme').not.toBe('')
    expect(themeVars.readingFontHeading, 'heading font-role slot should be populated by the theme').not.toBe('')
    expect(themeVars.readingFontBody, 'body font-role slot should be populated by the theme').not.toBe('')

    await window.screenshot({ path: screenshotPath('04-theme-claude-like-active.png') })
  })

  test('6. reversion default: inline live-render runtime CSS is injected', async () => {
    const rule = await window.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList
        try {
          rules = sheet.cssRules
        } catch {
          continue // cross-origin sheet (e.g. a failed @import), not ours
        }
        for (const cssRule of Array.from(rules)) {
          const rule = cssRule as CSSStyleRule
          if (rule.selectorText?.includes('.mu-editor .mu-hide') && rule.style?.opacity) {
            return {
              selectorText: rule.selectorText,
              opacity: rule.style.getPropertyValue('opacity'),
              opacityPriority: rule.style.getPropertyPriority('opacity')
            }
          }
        }
      }
      return null
    })

    expect(rule, '.mu-editor .mu-hide fade rule should be findable in document.styleSheets').not.toBeNull()
    expect(rule?.opacity.trim()).toBe('0')
    expect(rule?.opacityPriority).toBe('important')
  })

  test('7. branding: app.getName() and the macOS application menu say Reversion', async () => {
    const appName = await electronApp.evaluate(({ app }) => app.getName())
    expect(appName, 'app.setName("Reversion") in main/index.ts').toBe('Reversion')

    // The window's `document.title` is NOT a brand signal here: MarkText's
    // titleBar/index.vue deliberately overwrites it to the active file name
    // ("smoke.md" once our fixture is open) for the macOS dock-hover
    // tooltip, and does so on macOS too (showCustomTitleBar is false on
    // macOS — the native title bar is used, so this is what the OS window
    // title shows). The static `<title>Reversion</title>` in
    // renderer/index.html is a startup default, not the steady-state value.
    // The macOS application menu (top-left, next to the  logo) is the
    // reliable runtime brand surface: its label comes from
    // `menu.marktext.title` (static/locales/en.json), which E1 task 3
    // rebranded to "Reversion" for every non-zh locale.
    const appMenuLabel = await electronApp.evaluate(({ Menu }) => Menu.getApplicationMenu()?.items[0]?.label ?? null)
    expect(appMenuLabel, 'menu.marktext.title (English locale)').toBe('Reversion')

    await window.screenshot({ path: screenshotPath('05-branding.png') })
  })

  test('8. no uncaught exceptions were observed during the run', async () => {
    // Checked as its own assertion (rather than folded into another test)
    // so a leak from any of the interaction steps above is independently
    // diagnosable, per the task's per-assertion diagnosability requirement.
    expect(pageErrors, `renderer pageerror events:\n${pageErrors.join('\n')}`).toEqual([])

    // Known, accepted noise: lens-design.theme.css's two @import statements
    // pull Google Fonts + a jsDelivr-hosted CJK webfont. The app's CSP
    // (style-src 'self' 'unsafe-inline') blocks them, which Chromium reports
    // as a console.error — this is documented in
    // outputs/E1任务3_补丁源码化报告_Claude_260726.md §4.5 as a pre-existing,
    // non-regression limitation (the theme silently falls back to system
    // fonts; it predates this suite and is unrelated to Reversion's source
    // migration). Filtered here by exact origin so any *other* console.error
    // — including a CSP violation from a different, unexpected source —
    // still fails this test.
    const isKnownFontCspNoise = (msg: string): boolean =>
      msg.includes('Content Security Policy directive: "style-src') &&
      (msg.includes('fonts.googleapis.com') || msg.includes('cdn.jsdelivr.net'))
    const unexpectedConsoleErrors = consoleErrors.filter((msg) => !isKnownFontCspNoise(msg))
    if (consoleErrors.length > unexpectedConsoleErrors.length) {
      test.info().annotations.push({
        type: 'known-limitation',
        description: `${consoleErrors.length - unexpectedConsoleErrors.length} filtered: lens-design theme's external font @import blocked by CSP offline (see E1任务3 report §4.5)`
      })
    }
    expect(unexpectedConsoleErrors, `unexpected console.error calls (main + renderer):\n${unexpectedConsoleErrors.join('\n')}`).toEqual([])

    const mainLogPath = path.join(isolatedEnv.userDataDir, 'logs')
    if (existsSync(mainLogPath)) {
      // electron-log nests logs under a per-process-id directory
      // (logs/<pid>/main.log), so walk one level down rather than assuming
      // flat files.
      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
          const full = path.join(dir, entry.name)
          return entry.isDirectory() ? walk(full) : [full]
        })
      for (const logFile of walk(mainLogPath).filter((f) => f.endsWith('.log'))) {
        const logText = readFileSync(logFile, 'utf8')
        expect(logText, `${logFile} should not contain an Uncaught Exception`).not.toMatch(/Uncaught Exception/)
      }
    }
  })

  test('9. shutdown: app closes cleanly', async () => {
    const proc = electronApp.process()
    await electronApp.close()
    appClosed = true
    // Playwright resolves close() once the app has exited; a clean quit
    // (app.quit() during window-all-closed, no crash) exits 0.
    expect(proc.exitCode, 'electron main process should exit 0 on a clean quit').toBe(0)
    isolatedEnv.cleanup()
  })

  test('10. isolation: the real userData directory is byte-for-byte unchanged', async () => {
    const finalSnapshot = snapshotRealUserData()
    const unchanged = snapshotsEqual(baselineUserDataSnapshot, finalSnapshot)
    if (!unchanged) {
      // eslint-disable-next-line no-console
      console.error('userData drift detected', { before: baselineUserDataSnapshot, after: finalSnapshot })
    }
    expect(
      unchanged,
      `${realUserDataDir()} must be untouched by the e2e run (hard constraint). ` +
        `before=${JSON.stringify(baselineUserDataSnapshot)} after=${JSON.stringify(finalSnapshot)}`
    ).toBe(true)
  })
})
