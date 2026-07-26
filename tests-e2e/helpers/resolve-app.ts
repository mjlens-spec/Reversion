// Resolves the Reversion .app bundle to drive with Playwright's
// `_electron.launch`, and returns the path to its native executable
// (Contents/MacOS/<bin>) plus a `branded` flag describing which build was
// picked. See tests-e2e/playwright.config.ts and tests-e2e/smoke.spec.ts.
//
// Resolution order (first match wins):
//   1. REVERSION_E2E_APP_PATH env var — points directly at a `.app` bundle
//      or its Contents/MacOS/<bin> executable. Escape hatch for reusing this
//      suite against an arbitrary build (e.g. E2 task 4's per-theme builds).
//   2. The newest `.tmp/reversion-release-*/Reversion.app` staged build —
//      this is the fully branded + ad-hoc signed bundle produced by
//      `scripts/build-release-from-source.sh` right before it gets zipped
//      into `releases/<version>/`. Closest thing to "what ships."
//   3. Extracted from the newest `releases/<version>/Reversion-*-arm64-mac.zip`
//      release artifact — same bundle as #2, sourced from the durable
//      release directory instead of the scratch `.tmp/` workspace (which
//      gets cleaned periodically). Extraction is cached under
//      `tests-e2e/.cache/` (gitignored) so repeat runs don't re-extract.
//   4. `upstream/marktext/dist/mac-arm64/Reversion.app` — the raw
//      `electron-builder --dir` output, before `brand-app.sh` adds the
//      localized display names and the Markdown UTI declarations and before
//      the Quick Look extension, icon and ad-hoc re-signing are applied.
//      Since the B2 productName migration this bundle is already named
//      Reversion end to end (bundle dir, CFBundleName, CFBundleDisplayName,
//      CFBundleExecutable, all four Helper bundles) because electron-builder
//      derives all of them from `productName`, so the macOS menu-bar and Dock
//      names are correct here too. Still flagged `branded: false` and logged
//      loudly: it is not the artifact that ships.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(__dirname, '..', '..')

export interface ResolvedApp {
  /** Path to the `.app` bundle. */
  appBundlePath: string
  /** Path to the native executable inside `Contents/MacOS/`. */
  executablePath: string
  /** Which resolution strategy matched. */
  source: 'env-override' | 'staged-tmp' | 'release-zip' | 'unpacked-dir-build'
  /** False for the unbranded `--dir` build fallback (source #4 above). */
  branded: boolean
}

function findExecutableInBundle(appBundlePath: string): string {
  const macOsDir = path.join(appBundlePath, 'Contents', 'MacOS')
  if (!existsSync(macOsDir)) {
    throw new Error(`Not a valid .app bundle (missing Contents/MacOS): ${appBundlePath}`)
  }
  const entries = readdirSync(macOsDir)
  if (entries.length !== 1) {
    throw new Error(
      `Expected exactly one executable in ${macOsDir}, found: ${entries.join(', ') || '(none)'}`
    )
  }
  return path.join(macOsDir, entries[0])
}

function newestMatchingDir(parentDir: string, pattern: RegExp): string | null {
  if (!existsSync(parentDir)) return null
  const candidates = readdirSync(parentDir)
    .filter((name) => pattern.test(name))
    .map((name) => {
      const full = path.join(parentDir, name)
      return { full, mtimeMs: statSync(full).mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
  return candidates.length > 0 ? candidates[0].full : null
}

function resolveFromEnvOverride(): ResolvedApp | null {
  const override = process.env.REVERSION_E2E_APP_PATH
  if (!override) return null
  const resolved = path.resolve(override)
  if (!existsSync(resolved)) {
    throw new Error(`REVERSION_E2E_APP_PATH does not exist: ${resolved}`)
  }
  if (resolved.endsWith('.app')) {
    return {
      appBundlePath: resolved,
      executablePath: findExecutableInBundle(resolved),
      source: 'env-override',
      branded: true
    }
  }
  // Assume it's already the Contents/MacOS/<bin> executable.
  const appBundlePath = resolved.includes('.app/')
    ? resolved.slice(0, resolved.indexOf('.app/') + 4)
    : path.dirname(path.dirname(path.dirname(resolved)))
  return { appBundlePath, executablePath: resolved, source: 'env-override', branded: true }
}

function resolveFromStagedTmp(): ResolvedApp | null {
  const tmpDir = path.join(REPO_ROOT, '.tmp')
  const stagedDir = newestMatchingDir(tmpDir, /^reversion-release-.+/)
  if (!stagedDir) return null
  const appBundlePath = path.join(stagedDir, 'Reversion.app')
  if (!existsSync(appBundlePath)) return null
  return {
    appBundlePath,
    executablePath: findExecutableInBundle(appBundlePath),
    source: 'staged-tmp',
    branded: true
  }
}

function resolveFromReleaseZip(): ResolvedApp | null {
  const releasesDir = path.join(REPO_ROOT, 'releases')
  if (!existsSync(releasesDir)) return null
  const versionDir = newestMatchingDir(releasesDir, /^\d+\.\d+\.\d+/)
  if (!versionDir) return null
  const zipEntry = readdirSync(versionDir).find(
    (name) => name.endsWith('-arm64-mac.zip') && name.startsWith('Reversion-')
  )
  if (!zipEntry) return null
  const zipPath = path.join(versionDir, zipEntry)

  const cacheDir = path.join(__dirname, '..', '.cache', 'extracted-release')
  const appBundlePath = path.join(cacheDir, 'Reversion.app')
  const marker = path.join(cacheDir, '.source-zip')
  const alreadyExtracted = existsSync(appBundlePath) && existsSync(marker)
  const markerMatches = alreadyExtracted && readFileSync(marker, 'utf8').trim() === zipPath
  if (!markerMatches) {
    rmSync(cacheDir, { recursive: true, force: true })
    mkdirSync(cacheDir, { recursive: true })
    // -q quiet, -o overwrite without prompting; skip the __MACOSX AppleDouble
    // sidecar tree, we only need the bundle itself.
    execFileSync('unzip', ['-q', '-o', zipPath, 'Reversion.app/*', '-d', cacheDir])
    writeFileSync(marker, zipPath)
  }
  if (!existsSync(appBundlePath)) return null
  // Re-sign ad-hoc: unzip does not preserve the extended attributes/flags
  // codesign relies on reliably, and Gatekeeper's quarantine bit on a
  // freshly unzipped bundle can block launch. Re-apply the same ad-hoc
  // identity the release pipeline used (harmless if already valid).
  try {
    execFileSync('xattr', ['-cr', appBundlePath])
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appBundlePath])
  } catch {
    // Best-effort; if this fails the launch step below will surface it.
  }
  return {
    appBundlePath,
    executablePath: findExecutableInBundle(appBundlePath),
    source: 'release-zip',
    branded: true
  }
}

function resolveFromUnpackedDirBuild(): ResolvedApp | null {
  const appBundlePath = path.join(
    REPO_ROOT,
    'upstream',
    'marktext',
    'dist',
    'mac-arm64',
    'Reversion.app'
  )
  if (!existsSync(appBundlePath)) return null
  return {
    appBundlePath,
    executablePath: findExecutableInBundle(appBundlePath),
    source: 'unpacked-dir-build',
    branded: false
  }
}

export function resolveApp(): ResolvedApp {
  const resolved =
    resolveFromEnvOverride() ??
    resolveFromStagedTmp() ??
    resolveFromReleaseZip() ??
    resolveFromUnpackedDirBuild()

  if (!resolved) {
    throw new Error(
      [
        'Could not find a Reversion build to drive. Checked (in order):',
        '  - REVERSION_E2E_APP_PATH env var',
        '  - .tmp/reversion-release-*/Reversion.app',
        '  - releases/*/Reversion-*-arm64-mac.zip',
        '  - upstream/marktext/dist/mac-arm64/Reversion.app',
        '',
        'Build one with scripts/build-release-from-source.sh <version>, or',
        '`cd upstream/marktext/packages/desktop && pnpm exec electron-builder --mac --arm64 --dir --publish never`.'
      ].join('\n')
    )
  }
  if (resolved.source === 'unpacked-dir-build') {
    console.warn(
      '[tests-e2e] WARNING: falling back to the unbranded --dir build ' +
        `(${resolved.appBundlePath}). Brand checks still pass (they read source-set ` +
        'values, not Info.plist), but this is not the artifact that ships. ' +
        'Run scripts/build-release-from-source.sh to produce a branded build.'
    )
  }
  return resolved
}
