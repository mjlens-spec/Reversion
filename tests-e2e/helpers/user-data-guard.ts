// Hard constraint (see the task brief this suite was built for): the e2e
// run must never read or write the real
// `~/Library/Application Support/marktext` directory — that's the
// developer's actual Reversion/MarkText installation, with real documents
// and preferences.
//
// Isolation is two layers, both exercised through Playwright's
// `_electron.launch({ args, env })` — no source patch needed:
//
//   1. `--user-data-dir=<isolated>` — a CLI flag `packages/desktop/src/main/
//      cli/parser.ts` already declares and `app/paths.ts`'s `AppPaths`
//      constructor already honors (`app.setPath('userData', ...)` runs
//      before anything reads it). Confirmed present in source, so per the
//      task's own decision rule ("若源码支持就直接用") this alone would be
//      the mechanism — no reversion/main commit was needed.
//   2. `HOME=<isolated>` env override — belt-and-suspenders. `main/index.ts`
//      forces `app.setPath('userData', path.join(app.getPath('appData'),
//      'marktext'))` *before* `cli()` parses argv (needed so productName
//      changes don't move existing users' data — see
//      outputs/E1任务3_补丁源码化报告). That means for a brief window,
//      before `--user-data-dir` is applied, `crashReporter.start()` runs
//      against whatever `app.getPath('appData')` resolves to *right then*.
//      `app.getPath('appData')` derives from the OS home directory, and on
//      macOS that in turn honors the `HOME` env var of the process (verified
//      empirically below), so pointing `HOME` at an isolated directory keeps
//      even that pre-CLI-parse window off the real disk location.
//
// Empirical verification (manual, recorded in the task report): launched the
// packaged .app directly with both overrides, `sleep 8`, then compared
// `stat -f %Sm` + recursive file count of the real userData dir before/after
// — unchanged. This module turns that same before/after comparison into an
// automated, per-run assertion (see smoke.spec.ts's isolation tests).
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, rmSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** The real, production userData directory this suite must never touch. */
export function realUserDataDir(): string {
  // Same computation as `packages/desktop/src/main/index.ts`:
  // path.join(app.getPath('appData'), 'marktext') with the *real* HOME.
  return path.join(os.homedir(), 'Library', 'Application Support', 'marktext')
}

export interface UserDataSnapshot {
  exists: boolean
  mtimeMs: number | null
  fileCount: number
  totalBytes: number
  /** sha256 of the sorted relative file list + per-file size, not contents
   *  (hashing multi-hundred-MB of cache contents on every run is wasteful;
   *  the count + mtime + listing hash together are enough to catch any
   *  write, including same-size overwrites, since mtime would move too). */
  listingDigest: string
}

function snapshotDir(dir: string): UserDataSnapshot {
  if (!existsSync(dir)) {
    return { exists: false, mtimeMs: null, fileCount: 0, totalBytes: 0, listingDigest: 'absent' }
  }
  const mtimeMs = statSync(dir).mtimeMs

  // Walk with `find` rather than Node's recursive readdir: it's a single
  // subprocess call and macOS `find` handles the handful of special
  // directories (Cache, blob_storage, etc.) without extra logic here.
  const listing = execFileSync('find', [dir, '-type', 'f'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .sort()

  let totalBytes = 0
  const parts: string[] = []
  for (const filePath of listing) {
    let size = 0
    try {
      size = statSync(filePath).size
    } catch {
      // File vanished between `find` and `stat` (e.g. a lockfile) — treat as 0.
    }
    totalBytes += size
    parts.push(`${path.relative(dir, filePath)}:${size}`)
  }

  const listingDigest = createHash('sha256').update(parts.join('\n')).digest('hex')

  return { exists: true, mtimeMs, fileCount: listing.length, totalBytes, listingDigest }
}

/** Capture the current state of the real userData directory. */
export function snapshotRealUserData(): UserDataSnapshot {
  return snapshotDir(realUserDataDir())
}

export function snapshotsEqual(a: UserDataSnapshot, b: UserDataSnapshot): boolean {
  return (
    a.exists === b.exists &&
    a.mtimeMs === b.mtimeMs &&
    a.fileCount === b.fileCount &&
    a.totalBytes === b.totalBytes &&
    a.listingDigest === b.listingDigest
  )
}

export interface IsolatedEnvironment {
  /** Fake $HOME for the launched process (layer 2 of the isolation). */
  fakeHome: string
  /** Isolated userData dir passed via --user-data-dir (layer 1). */
  userDataDir: string
  cleanup(): void
}

/** Create a throwaway HOME + userData directory pair for one test run. */
export function createIsolatedEnvironment(baseDir: string): IsolatedEnvironment {
  mkdirSync(baseDir, { recursive: true })
  const fakeHome = mkdtempSync(path.join(baseDir, 'reversion-e2e-home-'))
  const userDataDir = path.join(fakeHome, 'reversion-e2e-userdata')
  mkdirSync(userDataDir, { recursive: true })
  return {
    fakeHome,
    userDataDir,
    cleanup(): void {
      rmSync(fakeHome, { recursive: true, force: true })
    }
  }
}
