// Shared raw-result collector for the IME matrix suites.
//
// Independent of Playwright's own pass/fail bookkeeping: this exists so
// the E3 task-1 report can list every matrix cell's *actual observed*
// behavior (expected vs. actual, event/mutation evidence, screenshot path)
// regardless of whether the test assertion itself was left red, converted
// to `test.fail()`, or passed outright. One JSON file per spec file
// (matrix-a/b/c each own their collector instance and flush independently
// in their own `test.afterAll`) — avoids any cross-file ordering
// assumption about when Playwright loads/runs each file's module.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export interface CellResult {
  /** e.g. "A1", "A3-boundary", "B3@A9", "C2@A7" */
  cell: string
  description: string
  status: 'pass' | 'fail' | 'known-issue'
  expected: Record<string, unknown>
  actual: Record<string, unknown>
  notes?: string
  screenshot?: string
}

export interface ResultsCollector {
  record(result: CellResult): void
  flush(outPath: string): void
  all(): CellResult[]
}

export function createResultsCollector(): ResultsCollector {
  const results: CellResult[] = []
  return {
    record(result: CellResult): void {
      results.push(result)
    },
    flush(outPath: string): void {
      mkdirSync(path.dirname(outPath), { recursive: true })
      writeFileSync(outPath, JSON.stringify(results, null, 2))
    },
    all(): CellResult[] {
      return results
    }
  }
}
