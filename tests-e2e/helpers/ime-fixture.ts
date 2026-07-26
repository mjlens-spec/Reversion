// Isolated per-run copy of fixtures/ime-matrix.md.
//
// Matrix B10 intentionally turns autoSave on, which writes the open
// document back to disk. If specs opened the checked-in fixture directly,
// that write would land in the repo working tree — the same class of
// problem `helpers/user-data-guard.ts` solves for the app's userData
// directory. So: never open the golden copy, always work on a throwaway
// copy under an isolated temp dir, mirroring that existing pattern.
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import path from 'node:path'
import { E2E_ROOT } from './config'

export const GOLDEN_IME_FIXTURE_PATH = path.join(E2E_ROOT, 'fixtures', 'ime-matrix.md')

export interface IsolatedFixtureCopy {
  path: string
  cleanup(): void
}

export function prepareIsolatedFixtureCopy(baseDir: string): IsolatedFixtureCopy {
  mkdirSync(baseDir, { recursive: true })
  const dir = mkdtempSync(path.join(baseDir, 'ime-fixture-'))
  const copyPath = path.join(dir, 'ime-matrix.md')
  copyFileSync(GOLDEN_IME_FIXTURE_PATH, copyPath)
  return {
    path: copyPath,
    cleanup(): void {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}
