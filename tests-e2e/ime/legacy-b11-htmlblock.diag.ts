// E3 task 2 diagnostic — why does B11 (Backspace during composition)
// reproduce at A10 (fenced code block) but PASS at A14 (HTML block), when
// task 0 established the HTML block as upstream issue #4956's own repro
// site?
//
// Source-derived hypothesis. Both A10's code body and A14's raw-source view
// are the SAME kind of leaf in the legacy engine: `containerCtrl.js`'s
// `createPreAndPreview()` gives both `functionType: 'codeContent'`. And
// `backspaceCtrl.js`'s codeContent branch reads the MODEL cursor, not the
// live DOM selection, and guards itself out when that model cursor is
// collapsed at offset 0:
//
//     startBlock.functionType === 'codeContent' &&
//     startBlock.key === endBlock.key &&
//     !(this.cursor.start.offset === 0 && this.cursor.end.offset === 0)
//
// matrix-b reaches A14 by clicking the block's `.ag-container-icon` to
// reveal the raw source — and `containerCtrl.js`'s
// `handleContainerBlockClick()` sets `this.cursor` to `{offset: 0}` on the
// first code line. So the guard above is FALSE and the whole branch (with
// its `preventDefault()` + `singleRender()`) never runs. If that is the
// reason A14 passes, then A14's pass is a property of how the harness got
// there, not of the HTML block — and adding one real click inside the
// revealed source (which makes muyajs recompute a nonzero model cursor)
// should reproduce the A10 failure.
//
// The two groups below differ by exactly that one click, in one app
// session, so app state cannot explain a divergence.
import { expect, test } from '@playwright/test'
import { beginComposition, resolveLiveHandle } from '../helpers/ime-cases'
import { launchImeApp, type ImeAppHandle } from '../helpers/ime-app-lifecycle'
import { createDiagRecorder } from '../helpers/diag-record'
import {
  EDITOR_SELECTOR,
  composeCommit,
  composeSteps,
  drainInterruptionEvidence,
  getCaretOffsetInContent,
  placeCaretAtMarker,
  placeCaretAtMarkerNoClick,
  readContentText,
  startInterruptionProbe,
  stopInterruptionProbe
} from '../helpers/ime'
import { POSITIONS } from '../helpers/positions'

const diag = createDiagRecorder('legacy-b11-htmlblock.json')
let handle: ImeAppHandle

/** Click the HTML block's container icon to reveal its raw-source view —
 * the same two lines POSITIONS.A14 uses, extracted so both groups below
 * share one implementation. No-op if the preview is already toggled away. */
async function revealHtmlSource(window: import('@playwright/test').Page): Promise<boolean> {
  const preview = window
    .locator(EDITOR_SELECTOR)
    .locator('.ag-html-preview', { hasText: 'MARK-A14-HTML-TEXT' })
    .first()
  if ((await preview.count()) === 0) return false
  const icon = preview
    .locator('xpath=preceding-sibling::*[contains(@class, "ag-container-icon")]')
    .first()
  if ((await icon.count()) === 0) return false
  await preview.hover()
  await window.waitForTimeout(100)
  await icon.click({ force: true })
  await window.waitForTimeout(150)
  return true
}

/**
 * Put the HTML block back into its collapsed preview state so the next
 * iteration can go through the container-icon path again. Once the block is
 * active, muyajs renders the editable source and drops the
 * `.ag-html-preview` node entirely — so `POSITIONS.A14.resolve()` (and
 * `revealHtmlSource` above) find nothing on a second call. Clicking a
 * different block deactivates the HTML block and restores the preview.
 */
async function deactivateHtmlBlock(window: import('@playwright/test').Page): Promise<void> {
  await placeCaretAtMarker(window, 'MARK-A1-END', 'after')
  await window.waitForTimeout(200)
}

test.describe.serial('E3 task 2 — legacy B11@A14 vs B11@A10 divergence', () => {
  test.afterAll(async () => {
    diag.flush()
    await handle?.teardownAndVerifyIsolation()
  })

  test('0. launch app on an isolated fixture copy', async () => {
    handle = await launchImeApp('diag-b11')
    expect(handle.pageErrors, `renderer pageerror on launch: ${handle.pageErrors.join('\n')}`).toEqual([])
  })

  test('baseline: B11@A14 reached via the container icon only, x3 (matrix-b behavior)', async () => {
    const { window, cdp } = handle
    for (let i = 1; i <= 3; i++) {
      if (i > 1) await deactivateHtmlBlock(window)
      const { handle: h, textBefore, caretOffsetBefore } = await beginComposition(
        window,
        cdp,
        POSITIONS.A14,
        'ceshi'
      )
      await window.keyboard.press('Backspace')
      await window.waitForTimeout(150)
      await composeCommit(window, cdp, '测试')
      await window.waitForTimeout(150)
      const midEvidence = await drainInterruptionEvidence(window)
      await stopInterruptionProbe(window)
      const { handle: fresh } = await resolveLiveHandle(window, h)
      const textAfter = await readContentText(fresh)
      const expectedIfCorrect =
        textBefore.slice(0, caretOffsetBefore) + '测试' + textBefore.slice(caretOffsetBefore)
      diag.push({
        group: 'A14-icon-only(model cursor pinned at 0)',
        iteration: i,
        outcome: textAfter === expectedIfCorrect ? 'OK' : 'CORRUPT(reproduced)',
        expectedIfCorrect,
        textBefore,
        textAfter,
        mutations: midEvidence.mutations
      })
    }
  })

  test('variant: B11@A14 with ONE added click inside the revealed source, x3', async () => {
    const { window, cdp } = handle
    for (let i = 1; i <= 3; i++) {
      await deactivateHtmlBlock(window)
      const revealed = await revealHtmlSource(window)
      // THE ONE ADDED ACTION vs the baseline group: a real click on the
      // revealed source text, so muyajs's own click handler recomputes a
      // nonzero model cursor instead of leaving the offset-0 value
      // handleContainerBlockClick() wrote.
      await placeCaretAtMarker(window, 'MARK-A14-HTML-TEXT', 'after')
      await window.waitForTimeout(120)

      const h0 = await placeCaretAtMarkerNoClick(window, 'MARK-A14-HTML-TEXT', 'after')
      await window.waitForTimeout(60)
      const textBefore = await readContentText(h0)
      const caretOffsetBefore = await getCaretOffsetInContent(window, h0)
      if (caretOffsetBefore === null) {
        diag.push({ group: 'A14-with-content-click', iteration: i, outcome: 'INCONCLUSIVE-no-caret' })
        continue
      }
      await startInterruptionProbe(window, h0)
      await composeSteps(window, cdp, ['ceshi'])
      await window.keyboard.press('Backspace')
      await window.waitForTimeout(150)
      await composeCommit(window, cdp, '测试')
      await window.waitForTimeout(150)
      const midEvidence = await drainInterruptionEvidence(window)
      await stopInterruptionProbe(window)
      const { handle: fresh } = await resolveLiveHandle(window, h0)
      const textAfter = await readContentText(fresh)
      const expectedIfCorrect =
        textBefore.slice(0, caretOffsetBefore) + '测试' + textBefore.slice(caretOffsetBefore)
      diag.push({
        group: 'A14-with-content-click(nonzero model cursor)',
        iteration: i,
        revealedViaIcon: revealed,
        outcome: textAfter === expectedIfCorrect ? 'OK' : 'CORRUPT(reproduced)',
        expectedIfCorrect,
        textBefore,
        textAfter,
        mutations: midEvidence.mutations
      })
    }
  })

  // Same probe at A13 (the code-fence LANGUAGE INPUT box). Its content
  // block is `functionType: 'languageInput'`, NOT 'codeContent', so the
  // branch under test should not apply there at all — a negative control
  // that the divergence really tracks functionType + model cursor rather
  // than "anything reached without a direct content click."
  test('control: B11@A13 language-input box, x3 (functionType languageInput, not codeContent)', async () => {
    const { window, cdp } = handle
    for (let i = 1; i <= 3; i++) {
      const { handle: h, textBefore, caretOffsetBefore } = await beginComposition(
        window,
        cdp,
        POSITIONS.A13,
        'ceshi'
      )
      await window.keyboard.press('Backspace')
      await window.waitForTimeout(150)
      await composeCommit(window, cdp, '测试')
      await window.waitForTimeout(150)
      const midEvidence = await drainInterruptionEvidence(window)
      await stopInterruptionProbe(window)
      const { handle: fresh } = await resolveLiveHandle(window, h)
      const textAfter = await readContentText(fresh)
      const expectedIfCorrect =
        textBefore.slice(0, caretOffsetBefore) + '测试' + textBefore.slice(caretOffsetBefore)
      diag.push({
        group: 'A13-languageInput',
        iteration: i,
        outcome: textAfter === expectedIfCorrect ? 'OK' : 'CORRUPT(reproduced)',
        expectedIfCorrect,
        textBefore,
        textAfter,
        mutations: midEvidence.mutations
      })
    }
  })
})
