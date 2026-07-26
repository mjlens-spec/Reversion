// E3 task 2 — shared recorder for the `.diag.ts` diagnostic probes.
//
// Deliberately separate from helpers/ime-report.ts: that one models one
// graded MATRIX CELL per record (cell / status / expected / actual), which
// is the wrong shape here — a diagnostic probe records N repetitions of one
// scenario under a named CONDITION GROUP, and its whole point is that an
// individual repetition has no pass/fail verdict attached, only an observed
// outcome. Keeping the two apart means neither file has to grow an
// "actually this row isn't a verdict" escape hatch.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { E2E_ROOT } from './config'

export const DIAG_OUT_DIR =
  process.env.REVERSION_DIAG_OUT ?? path.join(E2E_ROOT, '.artifacts', 'diagnostics')

export interface DiagRecorder {
  push(record: Record<string, unknown>): void
  flush(): void
}

export function createDiagRecorder(fileName: string): DiagRecorder {
  const records: Array<Record<string, unknown>> = []
  return {
    push(record: Record<string, unknown>): void {
      records.push(record)
    },
    flush(): void {
      mkdirSync(DIAG_OUT_DIR, { recursive: true })
      writeFileSync(path.join(DIAG_OUT_DIR, fileName), JSON.stringify(records, null, 2))
    }
  }
}
