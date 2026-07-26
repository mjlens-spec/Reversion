// E3 task 2 diagnostic — B8 ("commit a composition, then immediately Cmd+Z")
// reproduction rate and trigger conditions on the legacy engine.
//
// Why this file exists: task 1 recorded B8@A3 as "intermittent, ~50%,
// confirmed real" and marked the matrix cell `test.fixme()`. A skipped cell
// produces no data, so rerunning matrix-b N times yields zero additional
// samples — the rate and the trigger both have to be measured here instead.
//
// Every iteration is RECORDED, never asserted, so observing both outcomes
// is possible inside one `describe.serial` chain (an `expect()` failure
// would abort the remaining iterations, which is precisely the data we
// need). The scenario body is a step-for-step copy of matrix-b's B8: begin
// composition, commit '测试', Cmd+Z, compare against the pre-composition
// text.
//
// Condition groups, each in this same single app session but at its own
// fixture position so they cannot contaminate each other:
//   A3 / A4      inline-format positions (bold range, inline code span)
//   A1           plain paragraph, no inline formatting — position control
//   600ms delay  timing hypothesis (is the undo racing the commit's render?)
//   3-step       composition-length hypothesis
//   post-split   A3 AFTER a B1-style Enter-during-composition has split the
//                paragraph and left its `**` unterminated. matrix-b runs B1
//                before B8 at every position, so if the isolated rate here
//                differs from task 1's observed ~50%, this group is where
//                that difference should show up.
import { expect, test } from '@playwright/test'
import { resolveLiveHandle } from '../helpers/ime-cases'
import { launchImeApp, type ImeAppHandle } from '../helpers/ime-app-lifecycle'
import { createDiagRecorder } from '../helpers/diag-record'
import {
  composeCommit,
  composeSteps,
  drainInterruptionEvidence,
  getCaretOffsetInContent,
  readContentText,
  startInterruptionProbe,
  stopInterruptionProbe
} from '../helpers/ime'
import { A3_BOUNDARY_AFTER, A4_BOUNDARY_AFTER, POSITIONS, type PositionSpec } from '../helpers/positions'

const diag = createDiagRecorder('legacy-b8-undo.json')
let handle: ImeAppHandle

test.describe.serial('E3 task 2 — legacy B8 (post-commit undo) reproduction rate', () => {
  test.afterAll(async () => {
    diag.flush()
    await handle?.teardownAndVerifyIsolation()
  })

  test('0. launch app on an isolated fixture copy', async () => {
    handle = await launchImeApp('diag-b8')
    expect(handle.pageErrors, `renderer pageerror on launch: ${handle.pageErrors.join('\n')}`).toEqual([])
  })

  async function b8Iteration(
    group: string,
    iteration: number,
    position: PositionSpec,
    steps: readonly string[],
    preUndoDelayMs: number
  ): Promise<void> {
    const { window, cdp } = handle
    const h0 = await position.resolve(window)
    await window.waitForTimeout(60)
    const textBefore = await readContentText(h0)
    const caretOffsetBefore = await getCaretOffsetInContent(window, h0)
    if (caretOffsetBefore === null) {
      diag.push({ group, iteration, outcome: 'INCONCLUSIVE-no-caret' })
      return
    }
    await startInterruptionProbe(window, h0)
    await composeSteps(window, cdp, steps)
    await drainInterruptionEvidence(window)
    await composeCommit(window, cdp, '测试')
    await window.waitForTimeout(120)
    await stopInterruptionProbe(window)
    const { handle: afterCommitHandle } = await resolveLiveHandle(window, h0)
    const textAfterCommit = await readContentText(afterCommitHandle)

    await window.waitForTimeout(preUndoDelayMs)
    await window.keyboard.press('Meta+z')
    await window.waitForTimeout(200)
    const { handle: afterUndoHandle } = await resolveLiveHandle(window, afterCommitHandle)
    const textAfterUndo = await readContentText(afterUndoHandle)

    const expectedAfterCommit =
      textBefore.slice(0, caretOffsetBefore) + '测试' + textBefore.slice(caretOffsetBefore)
    const undoOk = textAfterUndo === textBefore
    const undoWasNoOp = textAfterUndo === textAfterCommit
    diag.push({
      group,
      iteration,
      position: position.key,
      steps: [...steps],
      preUndoDelayMs,
      blockTextLength: textBefore.length,
      caretOffsetBefore,
      commitOk: textAfterCommit === expectedAfterCommit,
      undoOk,
      undoWasNoOp,
      outcome: undoOk ? 'UNDO-OK' : undoWasNoOp ? 'UNDO-NOOP(reproduced)' : 'UNDO-OTHER',
      textBefore,
      textAfterCommit,
      textAfterUndo
    })
  }

  test('B8@A3 x12 — original matrix-b parameters (bold range interior)', async () => {
    for (let i = 1; i <= 12; i++) await b8Iteration('A3-bold-1step-150ms', i, POSITIONS.A3, ['ceshi'], 150)
  })

  test('B8@A1 x12 — plain-paragraph control', async () => {
    for (let i = 1; i <= 12; i++) await b8Iteration('A1-plain-1step-150ms', i, POSITIONS.A1, ['ceshi'], 150)
  })

  test('B8@A4 x8 — inline code span (second inline-format position)', async () => {
    for (let i = 1; i <= 8; i++) await b8Iteration('A4-inlinecode-1step-150ms', i, POSITIONS.A4, ['ceshi'], 150)
  })

  test('B8@A3-boundary x8 — just OUTSIDE the bold range, same paragraph', async () => {
    for (let i = 1; i <= 8; i++)
      await b8Iteration('A3boundary-outside-1step-150ms', i, A3_BOUNDARY_AFTER, ['ceshi'], 150)
  })

  test('B8@A4-boundary x8 — just OUTSIDE the inline code span, same paragraph', async () => {
    for (let i = 1; i <= 8; i++)
      await b8Iteration('A4boundary-outside-1step-150ms', i, A4_BOUNDARY_AFTER, ['ceshi'], 150)
  })

  test('B8@A3 x8 — 600ms pre-undo delay (timing hypothesis)', async () => {
    for (let i = 1; i <= 8; i++) await b8Iteration('A3-bold-1step-600ms', i, POSITIONS.A3, ['ceshi'], 600)
  })

  test('B8@A3 x8 — 3-step composition (composition-length hypothesis)', async () => {
    for (let i = 1; i <= 8; i++)
      await b8Iteration('A3-bold-3step-150ms', i, POSITIONS.A3, ['ce', 'ces', 'ceshi'], 150)
  })

  // Runs LAST: the Enter-during-composition below permanently splits the A3
  // paragraph in this session's document, so every group above must already
  // have run against the intact bold range.
  test('B8@A3 x8 — AFTER a B1-style Enter splits the paragraph (matrix-b ordering)', async () => {
    const { window, cdp } = handle
    // Reproduce matrix-b's B1@A3 exactly: open a composition inside the bold
    // range, then press Enter (which, per task 1's finding, is not swallowed
    // and instead inserts a real paragraph break at the composition point,
    // leaving the leading `**` unterminated).
    const h0 = await POSITIONS.A3.resolve(window)
    await window.waitForTimeout(60)
    const splitTextBefore = await readContentText(h0)
    await composeSteps(window, cdp, ['ceshi'])
    await window.keyboard.press('Enter')
    await window.waitForTimeout(250)
    const { handle: afterSplit } = await resolveLiveHandle(window, h0)
    diag.push({
      group: 'A3-split-precondition',
      note: 'B1-style Enter mid-composition, executed to reproduce matrix-b row ordering',
      textBefore: splitTextBefore,
      textAfterSplit: await readContentText(afterSplit).catch(() => '(handle detached)')
    })

    for (let i = 1; i <= 8; i++)
      await b8Iteration('A3-AFTER-B1-split-1step-150ms', i, POSITIONS.A3, ['ceshi'], 150)
  })
})
