// E3 task 1 — Matrix A: input position x basic composition (execution
// brief §3.2). One shared app + one shared isolated fixture copy for the
// whole file (test.describe.serial), same lifecycle pattern as
// tests-e2e/smoke.spec.ts / helpers/ime-app-lifecycle.ts.
//
// Each of the 12 positions (plus 2 boundary sub-cases for A3/A4) gets its
// own paragraph/block in fixtures/ime-matrix.md, so committing text in one
// test can never shift another test's marker offsets.
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { runBasicComposition, samplePinyinSequence } from '../helpers/ime-cases'
import { launchImeApp, resultsPathFor, screenshotDirFor, type ImeAppHandle } from '../helpers/ime-app-lifecycle'
import { createResultsCollector, type CellResult } from '../helpers/ime-report'
import { annotateKnownIssue } from '../helpers/known-issues'
import { A3_BOUNDARY_AFTER, A4_BOUNDARY_AFTER, POSITIONS, type PositionSpec } from '../helpers/positions'

const results = createResultsCollector()
const screenshotDir = screenshotDirFor('matrix-a')

let handle: ImeAppHandle

test.describe.serial('IME matrix A — input positions', () => {
  test.afterAll(async () => {
    results.flush(resultsPathFor('a'))
    await handle?.teardownAndVerifyIsolation()
  })

  test('0. launch app on an isolated fixture copy', async () => {
    handle = await launchImeApp('matrix-a')
    expect(handle.pageErrors, `renderer pageerror on launch: ${handle.pageErrors.join('\n')}`).toEqual([])
  })

  async function runCell(cell: string, position: PositionSpec, seed: string): Promise<void> {
    // Known-issue annotations are per-engine data (helpers/known-issues.ts) as
    // of E3 task 2 — the legacy defect set and the muya v2 defect set differ,
    // and a stale `test.fail()` reports "Expected to fail, but passed", which
    // in a serial block skips every cell after it.
    annotateKnownIssue(cell)
    const { window, cdp } = handle
    // Let the previous cell's post-commit re-render fully settle before
    // this cell starts resolving its own position — two cells sharing a
    // paragraph (A3/A3-boundary, A4/A4-boundary) otherwise risk clicking
    // into a node that's mid-replacement from the prior cell's commit.
    await window.waitForTimeout(100)
    const { steps, finalText } = samplePinyinSequence(seed)
    const result = await runBasicComposition(window, cdp, position, steps, finalText)

    const status: CellResult['status'] =
      result.committedTextOk && result.cursorOk && !result.interruptedDuringComposition ? 'pass' : 'fail'

    if (status === 'fail') {
      await window.screenshot({ path: path.join(screenshotDir, `${cell}-failure.png`) })
    }

    results.record({
      cell,
      description: position.label,
      status,
      expected: { text: result.expectedTextAfter, caretOffset: result.expectedCaretOffset },
      actual: {
        text: result.textAfter,
        caretOffset: result.caretOffsetAfter,
        midCompositionMutations: result.midCompositionEvidence.mutations,
        postCommitMutations: result.postCommitEvidence.mutations
      },
      screenshot: status === 'fail' ? path.join(screenshotDir, `${cell}-failure.png`) : undefined
    })

    expect(result.textAfter, `${cell}: committed content`).toBe(result.expectedTextAfter)
    expect(result.caretOffsetAfter, `${cell}: caret landing spot`).toBe(result.expectedCaretOffset)
    expect(
      result.interruptedDuringComposition,
      `${cell}: structural (childList) mutation observed mid-composition: ${JSON.stringify(result.midCompositionEvidence.mutations)}`
    ).toBe(false)
  }

  test('A1: paragraph body, append at end of sentence', async () => {
    await runCell('A1', POSITIONS.A1, 'ceshi')
  })

  test('A2: paragraph body, mid-sentence insertion (CJK on both sides)', async () => {
    await runCell('A2', POSITIONS.A2, 'fanwen')
  })

  test('A3: bold range interior', async () => {
    await runCell('A3', POSITIONS.A3, 'zhongwen')
  })

  test('A3-boundary: immediately after a bold range closes', async () => {
    await runCell('A3-boundary', A3_BOUNDARY_AFTER, 'shuru')
  })

  test('A4: inline code interior', async () => {
    await runCell('A4', POSITIONS.A4, 'fahao')
  })

  test('A4-boundary: immediately after inline code closes', async () => {
    await runCell('A4-boundary', A4_BOUNDARY_AFTER, 'ceshi')
  })

  test('A5: inline formula boundary (must not enter the formula)', async () => {
    await runCell('A5', POSITIONS.A5, 'fanwen')
  })

  test('A6: link text interior', async () => {
    await runCell('A6', POSITIONS.A6, 'zhongwen')
  })

  test('A7: heading (H2) line', async () => {
    await runCell('A7', POSITIONS.A7, 'shuru')
  })

  test('A8: unordered list item', async () => {
    await runCell('A8', POSITIONS.A8, 'fahao')
  })

  test('A9: table cell', async () => {
    await runCell('A9', POSITIONS.A9, 'ceshi')
  })

  test('A10: code block interior (cf. upstream #4851)', async () => {
    await runCell('A10', POSITIONS.A10, 'fanwen')
  })

  test('A11: blockquote interior', async () => {
    await runCell('A11', POSITIONS.A11, 'zhongwen')
  })

  test('A12: document-end empty paragraph', async () => {
    await runCell('A12', POSITIONS.A12, 'shuru')
  })

  test('A13: code-fence language-input box', async () => {
    await runCell('A13', POSITIONS.A13, 'ceshi')
  })

  test('A14: HTML block interior', async () => {
    await runCell('A14', POSITIONS.A14, 'fanwen')
  })
})
