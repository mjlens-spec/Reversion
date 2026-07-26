// B1 task 6 — brand-consistency e2e assertions.
//
// Companion to smoke.spec.ts (E1 task 5), which already covers app.getName()
// and the application-menu's compiled label. This spec goes further, at
// the level the B1 audit actually needed:
//
//   1. A whole-menu-tree sweep for literal "MarkText"/"marktext" residue in
//      every native menu item label, with the one intentional exception
//      (Help > Support MarkText) allow-listed by exact label match.
//   2. The title-bar placeholder ("Reversion", not "MarkText") when no file
//      is open -- smoke.spec.ts always opens a fixture file, so this branch
//      is never exercised there.
//   3. The About dialog's actual rendered text: Reversion-attributed
//      copyright, the new "Based on MarkText" upstream-acknowledgment line,
//      and no "Luo Ran"/"luo han" residue.
//   4. The Help-menu Changelog/Report-Bug/License actions really do call
//      `shell.openExternal` with the Reversion-fork URLs at runtime -- not
//      just "the source text contains the right string somewhere" (that's
//      what tests/brand-cleanup.test.mjs already checks), but that the
//      *wired-up, running* menu action fires with the right argument.
//      `shell.openExternal` is monkey-patched in the main process before
//      each click so this never actually opens a real browser tab.
//
// Independent from smoke.spec.ts's serial suite (its own app launch/teardown)
// so a failure here doesn't cascade into or depend on the fixture-editing
// smoke run, matching how tests-e2e/ime/*.spec.ts is kept separate.
//
//   6. (B2, added by the productName migration) The macOS system chrome:
//      the menu-bar application menu title next to the Apple logo, and the
//      LaunchServices display name behind the Dock tile / Force Quit dialog.
//      B1 documented these as an unfixable structural gap -- both read
//      "marktext" in 1.2.0-beta.2 -- on the strength of a reproduced crash
//      when CFBundleName alone was rewritten after packaging. The real fix
//      was to move electron-builder's `productName`, which renames the
//      bundle, the executable, CFBundleName and all four Helper bundles
//      together; B2 did that, and test 6 below is now the permanent guard.
//      It is the only assertion in this suite that reads what a user
//      actually sees rather than a value this codebase sets. See
//      outputs/B2产品名迁移报告_Claude_260726.md.
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { ISOLATION_BASE_DIR, SCREENSHOT_DIR } from './helpers/config'
import { resolveApp, type ResolvedApp } from './helpers/resolve-app'
import { createIsolatedEnvironment, type IsolatedEnvironment } from './helpers/user-data-guard'
import { ACCEPTED_BRAND_NAMES, probeMenuBarNames, readLaunchServicesDisplayName } from './helpers/system-ui'

mkdirSync(SCREENSHOT_DIR, { recursive: true })

// Exactly the strings the B1 audit deliberately kept. Any *other* menu label
// containing "marktext" (case-insensitive) fails the sweep below.
const WHITELISTED_MENU_LABELS = new Set([
  'Support MarkText (Upstream Project)'
])

interface MenuLeaf {
  label: string
  path: string[]
}

test.describe.serial('B1 brand checks', () => {
  let resolvedApp: ResolvedApp
  let isolatedEnv: IsolatedEnvironment
  let electronApp: ElectronApplication
  let appClosed = false
  let window: Page

  test.afterAll(async () => {
    if (electronApp && !appClosed) {
      await electronApp.close().catch(() => {})
    }
    isolatedEnv?.cleanup()
  })

  test('0. resolves the build under test and launches with no file argument', async () => {
    resolvedApp = resolveApp()
    expect(existsSync(resolvedApp.executablePath)).toBe(true)

    isolatedEnv = createIsolatedEnvironment(ISOLATION_BASE_DIR)

    // Deliberately no fixture path argument (unlike smoke.spec.ts): this
    // suite needs the "no file open" state to exercise the title-bar
    // placeholder branch (titleBar/index.vue: `v-if="!filename"`).
    electronApp = await electron.launch({
      executablePath: resolvedApp.executablePath,
      args: [`--user-data-dir=${isolatedEnv.userDataDir}`, '--disable-gpu'],
      env: { ...process.env, HOME: isolatedEnv.fakeHome, NODE_ENV: 'production' },
      timeout: 30_000
    })

    window = await electronApp.firstWindow({ timeout: 20_000 })
    await window.waitForLoadState('domcontentloaded')
    expect(window.url()).toBeTruthy()
  })

  test('1. app.getName() and the compiled application-menu label both say Reversion', async () => {
    const appName = await electronApp.evaluate(({ app }) => app.getName())
    expect(appName).toBe('Reversion')

    const appMenuLabel = await electronApp.evaluate(
      ({ Menu }) => Menu.getApplicationMenu()?.items[0]?.label ?? null
    )
    expect(appMenuLabel).toBe('Reversion')
  })

  test('2. no unreviewed "MarkText" residue anywhere in the native menu tree', async () => {
    const leaves: MenuLeaf[] = await electronApp.evaluate(({ Menu }) => {
      const out: { label: string; path: string[] }[] = []
      const walk = (items: Electron.MenuItem[], trail: string[]): void => {
        for (const item of items) {
          const here = [...trail, item.label]
          if (item.label) out.push({ label: item.label, path: here })
          if (item.submenu) walk(item.submenu.items, here)
        }
      }
      const menu = Menu.getApplicationMenu()
      if (menu) walk(menu.items, [])
      return out
    })

    expect(leaves.length, 'expected the running app to expose a non-empty menu tree').toBeGreaterThan(0)

    const offenders = leaves.filter(
      (leaf) => /marktext/i.test(leaf.label) && !WHITELISTED_MENU_LABELS.has(leaf.label)
    )
    expect(
      offenders,
      `unreviewed "MarkText" menu labels: ${offenders.map((o) => o.path.join(' > ')).join('; ')}`
    ).toEqual([])

    // Regression guard for the deliberate keep: it must still be there
    // (not silently dropped) and still carry the "upstream" annotation.
    const supportLeaf = leaves.find((leaf) => leaf.path.includes('Support MarkText (Upstream Project)'))
    expect(supportLeaf, 'Help > Support MarkText (Upstream Project) should still exist').toBeTruthy()
  })

  test('3. main window (title bar, sidebar, tab) has no "MarkText"/"luo han" residue in its visible text', async () => {
    // The app auto-opens a blank "Untitled-1" tab on a from-scratch userData
    // dir (startUpAction defaults to "restoreAll", which falls back to a
    // blank tab when there's nothing to restore) -- so titleBar/index.vue's
    // `v-if="!filename"` "Reversion" placeholder branch (verified statically
    // in tests/brand-cleanup.test.mjs, since the app doesn't reach a truly
    // filename-less state in normal startup) isn't exercised here. This
    // test instead does the broader "key interface" sweep the task called
    // for: the whole main window's visible text, as actually rendered,
    // contains no unreviewed "MarkText"/"luo han" string.
    const titleBar = window.locator('.title-bar .title')
    await expect(titleBar).toBeVisible({ timeout: 15_000 })

    const bodyText = await window.locator('body').innerText()
    expect(bodyText).not.toMatch(/marktext/i)
    expect(bodyText).not.toMatch(/luo han/i)
    expect(bodyText).not.toMatch(/luo ran/i)

    await window.screenshot({ path: path.join(SCREENSHOT_DIR, 'brand-01-main-window.png') })
  })

  test('4. About dialog: Reversion-attributed copyright, upstream acknowledgment, no Luo Ran residue', async () => {
    // Same trigger the Help/marktext menu actions use (actions/help.ts:
    // `win.webContents.send('mt::about-dialog')`) -- exercises the real
    // main -> preload -> renderer-bus -> Vue wiring, not just the component
    // in isolation.
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      win.webContents.send('mt::about-dialog')
    })

    // `.about-dialog` (the SFC's own root wrapper div) collapses to 0
    // height in the accessibility tree once its child `.el-overlay` goes
    // `position: fixed` (a normal, harmless CSS characteristic -- a real
    // user still sees the full-viewport overlay just fine), which makes
    // Playwright's strict `toBeVisible()` bounding-box check false-negative
    // on the wrapper itself. Assert visibility on the actual dialog body
    // instead, and read text from that.
    const dialogBody = window.locator('.about-dialog .el-dialog__body')
    await expect(dialogBody).toBeVisible({ timeout: 10_000 })

    const text = await dialogBody.innerText()
    expect(text).toContain('Reversion')
    expect(text).toMatch(/Copyright © Reversion \d{4}-\d{4}/)
    expect(text).toContain('Based on MarkText (MIT License)')
    expect(text).not.toMatch(/Luo Ran/i)
    expect(text).not.toMatch(/luo han/i)

    await window.screenshot({ path: path.join(SCREENSHOT_DIR, 'brand-02-about-dialog.png') })
  })

  test('5. Help menu: Changelog / Report Bug / License open the Reversion-fork URLs at runtime', async () => {
    // Intercept shell.openExternal in the main process instead of letting it
    // actually spawn a browser. Attached once; each sub-case resets the log.
    await electronApp.evaluate(({ shell }) => {
      const anyShell = shell as unknown as { openExternal: (...a: unknown[]) => Promise<void> }
      if (!(globalThis as Record<string, unknown>).__brandCheckOriginalOpenExternal) {
        ;(globalThis as Record<string, unknown>).__brandCheckOriginalOpenExternal = anyShell.openExternal
      }
      ;(globalThis as Record<string, unknown>).__brandCheckOpenedUrls = []
      anyShell.openExternal = (url: unknown) => {
        ;((globalThis as Record<string, unknown>).__brandCheckOpenedUrls as unknown[]).push(url)
        return Promise.resolve()
      }
    })

    const findAndClick = async (label: string): Promise<void> => {
      await electronApp.evaluate(({ Menu }, targetLabel) => {
        const findItem = (items: Electron.MenuItem[]): Electron.MenuItem | undefined => {
          for (const item of items) {
            if (item.label === targetLabel) return item
            if (item.submenu) {
              const found = findItem(item.submenu.items)
              if (found) return found
            }
          }
          return undefined
        }
        const menu = Menu.getApplicationMenu()
        const item = menu ? findItem(menu.items) : undefined
        if (!item) throw new Error(`menu item not found: ${targetLabel}`)
        item.click()
      }, label)
    }

    await findAndClick('Changelog')
    await findAndClick('Report Bug')
    await findAndClick('License')

    const openedUrls = await electronApp.evaluate(
      () => (globalThis as Record<string, unknown>).__brandCheckOpenedUrls as string[]
    )

    expect(openedUrls).toEqual([
      'https://github.com/mjlens-spec/Reversion/releases',
      'https://github.com/mjlens-spec/Reversion/issues',
      'https://github.com/mjlens-spec/Reversion/blob/main/LICENSE'
    ])

    // Restore the real implementation so later tests (and app teardown)
    // don't run with the monkey-patch attached.
    await electronApp.evaluate(({ shell }) => {
      const anyShell = shell as unknown as { openExternal: (...a: unknown[]) => Promise<void> }
      const original = (globalThis as Record<string, unknown>).__brandCheckOriginalOpenExternal as typeof anyShell.openExternal
      if (original) anyShell.openExternal = original
    })
  })

  test('6. macOS system chrome: the menu-bar app menu and the Dock/Force-Quit name say Reversion, not marktext', async () => {
    const pid = electronApp.process().pid
    expect(pid, 'the Electron main process should have a pid').toBeTruthy()

    // LaunchServices display name first: no accessibility permission needed, so
    // this half of the assertion always runs. It is `NSRunningApplication
    // .localizedName` -- the Dock tile, Force Quit dialog and Activity Monitor
    // name -- and it honours the localized CFBundleDisplayName that
    // brand-app.sh installs, hence the accepted-name set rather than one string.
    const displayName = await readLaunchServicesDisplayName(pid as number)
    expect(displayName, 'lsappinfo should report an LSDisplayName for the running app').toBeTruthy()
    expect(displayName).not.toMatch(/marktext/i)
    expect(ACCEPTED_BRAND_NAMES).toContain(displayName)

    // Menu bar: driven by CFBundleName, and the whole point of the B2 rename.
    const probe = await probeMenuBarNames(pid as number, 'Reversion')
    if (!probe.ok && probe.reason === 'accessibility-denied') {
      // Not a pass and not a failure: this machine has not granted the test
      // runner Accessibility permission, so the menu bar simply cannot be read.
      // The LSDisplayName assertions above already ran.
      test.skip(
        true,
        'System Events accessibility permission is not granted to the test runner; ' +
          'grant it under System Settings > Privacy & Security > Accessibility to ' +
          `assert the menu-bar title. Detail: ${probe.detail}`
      )
      return
    }
    expect(probe.ok, `menu-bar probe failed: ${probe.ok ? '' : `${probe.reason} -- ${probe.detail}`}`).toBe(true)
    if (!probe.ok) return

    expect(
      probe.names.menuBarAppMenuTitle,
      `menu bar items were: ${probe.names.menuBarItems.join(', ')}`
    ).toBe('Reversion')
    // The whole menu bar, as macOS renders it, must be free of the old name.
    for (const item of probe.names.menuBarItems) {
      expect(item, 'no macOS-rendered menu-bar title may say marktext').not.toMatch(/marktext/i)
    }
    // System Events' process name comes from the same CFBundleName.
    expect(probe.names.processName).toBe('Reversion')

    await window.screenshot({ path: path.join(SCREENSHOT_DIR, 'brand-03-system-chrome.png') })
  })

  test('7. shutdown: app closes cleanly', async () => {
    const proc = electronApp.process()
    await electronApp.close()
    appClosed = true
    expect(proc.exitCode, 'electron main process should exit 0 on a clean quit').toBe(0)
    isolatedEnv.cleanup()
  })
})
