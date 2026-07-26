// Reads the macOS system-chrome names an app presents to the user, neither of
// which is reachable from inside Electron:
//
//   * the menu-bar application menu title -- the bold item immediately right of
//     the Apple menu -- read through System Events' accessibility API;
//   * the LaunchServices display name (`NSRunningApplication.localizedName`),
//     which is what the Dock tile, the Force Quit dialog and Activity Monitor
//     show, read through `lsappinfo`.
//
// Why this exists (B2 productName migration): both surfaces are driven by
// `CFBundleName` / the bundle's localized display names, not by `app.setName()`.
// 1.2.0-beta.2 had every Electron-level signal correct (`app.getName()`,
// `Menu.getApplicationMenu().items[0].label`, the crash reporter's productName,
// CFBundleDisplayName) and yet the menu bar still read "marktext", because
// CFBundleName was pinned to the pre-rename `marktext Helper*.app` directory
// names. B2 moved electron-builder's `productName`, renaming the bundle, the
// executable, CFBundleName and all four Helper bundles as one unit. These
// probes are the acceptance criterion for that change: they are the only
// assertions in the suite that look at what the user actually sees.
//
// Implementation notes:
//   * Both probes address the app by its unix pid (from
//     `electronApp.process().pid`), never by name or by scanning a global list.
//     That matters in practice: a Dock-tile sweep picks up any other
//     Electron/marktext build a concurrent job happens to be running, and the
//     assertion would then be about the wrong process.
//   * The menu bar only exposes the *frontmost* process's menus, so the probe
//     activates the target and retries until macOS has swapped the menu bar
//     over.
//   * System Events needs the *calling* process (the terminal / CI agent running
//     Playwright) to hold Accessibility permission. Without it the probe
//     reports `accessibility-denied` instead of throwing, and the caller decides
//     whether to skip -- `lsappinfo` needs no such permission and is still
//     asserted.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Brand names the OS may legitimately show. The menu bar is driven by
 * CFBundleName ("Reversion"); the LaunchServices display name additionally
 * honours the localized CFBundleDisplayName that scripts/brand-app.sh installs,
 * so on a Chinese system it reads "反文". Anything containing "marktext" is the
 * regression this guards against.
 */
export const ACCEPTED_BRAND_NAMES = ['Reversion', '反文']

export interface SystemUiNames {
  /** Title of the application menu: the bold item right after the Apple menu. */
  menuBarAppMenuTitle: string
  /** Every menu-bar item title, in order, for diagnostics on failure. */
  menuBarItems: string[]
  /** System Events' process name for the app. */
  processName: string
}

export type SystemUiProbeFailure = 'accessibility-denied' | 'process-not-found' | 'unavailable'

export type SystemUiProbe =
  | { ok: true; names: SystemUiNames }
  | { ok: false; reason: SystemUiProbeFailure; detail: string }

const ACCESSIBILITY_DENIED = /not allowed assistive access|-1719|-25211|-1743/

type ScriptResult = { ok: true; out: string } | { ok: false; reason: SystemUiProbeFailure; detail: string }

async function runOsascript(script: string): Promise<ScriptResult> {
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 20_000 })
    return { ok: true, out: stdout.trim() }
  } catch (error) {
    const detail = [(error as { stderr?: string }).stderr ?? '', (error as { message?: string }).message ?? '']
      .join(' ')
      .trim()
    if (ACCESSIBILITY_DENIED.test(detail)) return { ok: false, reason: 'accessibility-denied', detail }
    if (/unix id|Can.t get process|isn't running/i.test(detail)) {
      return { ok: false, reason: 'process-not-found', detail }
    }
    return { ok: false, reason: 'unavailable', detail }
  }
}

/** osascript renders AppleScript lists as ", "-joined text. */
const splitList = (out: string): string[] =>
  out
    .split(', ')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The LaunchServices display name for a running pid: exactly the string the Dock
 * tile, the Force Quit dialog and Activity Monitor show
 * (`NSRunningApplication.localizedName`). Needs no accessibility permission.
 */
export async function readLaunchServicesDisplayName(pid: number): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('lsappinfo', ['info', '-only', 'name', '-app', String(pid)], {
      timeout: 10_000
    })
    // Output form: "LSDisplayName"="Reversion"
    const match = stdout.match(/"LSDisplayName"\s*=\s*"([^"]*)"/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/**
 * Brings the app with the given pid to the front and reads back the menu-bar
 * titles macOS presents for it.
 */
export async function probeMenuBarNames(pid: number, expectedTitle: string): Promise<SystemUiProbe> {
  const activate = await runOsascript(
    `tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true`
  )
  if (!activate.ok) return activate

  let menuBarItems: string[] = []
  let processName = ''
  let lastDetail = ''
  // macOS swaps the menu bar asynchronously after an activation, and an Electron
  // app that has only just finished loading may still be installing its menu.
  for (let attempt = 0; attempt < 12; attempt++) {
    await sleep(500)
    const probe = await runOsascript(
      `tell application "System Events" to tell (first process whose unix id is ${pid})
         return {name, name of every menu bar item of menu bar 1}
       end tell`
    )
    if (!probe.ok) {
      if (probe.reason === 'accessibility-denied') return probe
      lastDetail = probe.detail
      continue
    }
    // parts: [processName, "Apple", <app menu title>, "File", ...]
    const parts = splitList(probe.out)
    if (parts.length < 3) continue
    processName = parts[0]
    menuBarItems = parts.slice(1)
    if (menuBarItems[1] === expectedTitle) break
  }

  if (menuBarItems.length < 2) {
    return {
      ok: false,
      reason: 'unavailable',
      detail: `menu bar never reported at least two items (got: ${menuBarItems.join(', ') || '(none)'}) ${lastDetail}`.trim()
    }
  }

  return { ok: true, names: { menuBarAppMenuTitle: menuBarItems[1], menuBarItems, processName } }
}
