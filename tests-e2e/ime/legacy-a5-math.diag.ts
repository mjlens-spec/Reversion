// E3 task 2 diagnostic — is A5's failure the product, or task 1's fidelity
// limit #1 (CDP's composition buffer intermittently failing to replace
// itself atomically, leaving a pinyin literal behind)?
//
// Task 1 flagged A5 as "疑似正是命中此局限" and asked task 2 to re-run before
// grading. Three full matrix-a reruns already produced a BYTE-IDENTICAL
// failure (same residual literal, same wrong insertion point, same caret
// offset 85 vs expected 73) — which by itself rules out a 3-8% stochastic
// quirk. This file closes the loop from the other direction: run the SAME
// simulator call pattern (one 'fanwen' composition step, '反文' commit,
// caret placed with edge:'before') at positions that differ from A5 only in
// what surrounds the caret.
//
//   A5-before   the failing matrix-a configuration, repeated
//   A5-after    A5's own marker, caret one marker-length further from the
//               closing `$` — isolates "adjacent to the inline formula"
//               from "inside this paragraph"
//   A1-before   plain paragraph, edge:'before' — isolates the edge:'before'
//               placement itself as a possible cause
//   A11-before  blockquote, edge:'before' — second non-math control
//
// Runs in its own app session (fresh fixture copy) so no other diagnostic's
// accumulated text can shift these offsets.
import { expect, test } from '@playwright/test'
import { resolveLiveHandle } from '../helpers/ime-cases'
import { launchImeApp, type ImeAppHandle } from '../helpers/ime-app-lifecycle'
import { createDiagRecorder } from '../helpers/diag-record'
import { ACTIVE_ENGINE } from '../helpers/engine-profile'
import {
  composeCommit,
  composeSteps,
  drainInterruptionEvidence,
  getCaretOffsetInContent,
  placeCaretAtMarker,
  readContentText,
  startInterruptionProbe,
  stopInterruptionProbe,
  type CaretEdge
} from '../helpers/ime'

const diag = createDiagRecorder(`a5-math-${ACTIVE_ENGINE.id}.json`)
let handle: ImeAppHandle

test.describe.serial(`E3 task 2 — A5 (inline-formula boundary) discrimination [${ACTIVE_ENGINE.id}]`, () => {
  test.afterAll(async () => {
    diag.flush()
    await handle?.teardownAndVerifyIsolation()
  })

  test('0. launch app on an isolated fixture copy', async () => {
    handle = await launchImeApp('diag-a5')
    expect(handle.pageErrors, `renderer pageerror on launch: ${handle.pageErrors.join('\n')}`).toEqual([])
  })

  async function probe(group: string, marker: string, edge: CaretEdge, repeats: number): Promise<void> {
    const { window, cdp } = handle
    for (let i = 1; i <= repeats; i++) {
      // The A5 corruption splits the marker text itself (…MARK-A + 反文 +
      // 5-AFTER-MATH…), so after one reproducing iteration the marker no
      // longer exists as a contiguous string and the lookup can no longer
      // find it. Record that as an outcome rather than letting the locator
      // timeout abort the remaining groups — it is itself evidence about the
      // severity of the corruption, and each full matrix-a rerun supplies an
      // independent first-iteration sample on a pristine fixture anyway.
      let h0: import('@playwright/test').ElementHandle<Element>
      try {
        h0 = await placeCaretAtMarker(window, marker, edge)
      } catch (err) {
        diag.push({
          group,
          iteration: i,
          outcome: 'INCONCLUSIVE-marker-no-longer-locatable',
          detail: (err as Error).message.split('\n')[0]
        })
        return
      }
      await window.waitForTimeout(60)
      const textBefore = await readContentText(h0)
      const caretOffsetBefore = await getCaretOffsetInContent(window, h0)
      if (caretOffsetBefore === null) {
        diag.push({ group, iteration: i, outcome: 'INCONCLUSIVE-no-caret' })
        continue
      }
      await startInterruptionProbe(window, h0)
      await composeSteps(window, cdp, ['fanwen'])
      const midEvidence = await drainInterruptionEvidence(window)
      await composeCommit(window, cdp, '反文')
      await window.waitForTimeout(120)
      await stopInterruptionProbe(window)
      const { handle: fresh } = await resolveLiveHandle(window, h0)
      const textAfter = await readContentText(fresh)
      const caretAfter = await getCaretOffsetInContent(window, fresh)
      const expectedAfter =
        textBefore.slice(0, caretOffsetBefore) + '反文' + textBefore.slice(caretOffsetBefore)
      const textOk = textAfter === expectedAfter
      // Two ENGINE-NEUTRAL checks, needed because the exact-string comparison
      // above is not trustworthy in a block containing inline math: the
      // `$...$` element renders BOTH its source and a KaTeX preview into
      // `textContent`, and which of the two is present flips with whether the
      // caret is inside the token — so committing (which moves the caret)
      // changes the block's textContent length for reasons that have nothing
      // to do with the committed text. Both engines do this, differently.
      // These two checks depend only on the committed text's position
      // relative to the marker and on the absence of leftover pre-edit
      // characters, and are therefore comparable across engines.
      const committedImmediatelyBeforeMarker =
        edge === 'before' ? textAfter.includes(`反文${marker}`) : textAfter.includes(`${marker}反文`)
      diag.push({
        group,
        iteration: i,
        marker,
        edge,
        outcome: textOk ? 'OK' : 'CORRUPT(reproduced)',
        engineNeutralVerdict:
          committedImmediatelyBeforeMarker && !textAfter.includes('fanwen')
            ? 'COMMIT-LANDED-CORRECTLY'
            : 'COMMIT-MISPLACED-OR-RESIDUAL-LITERAL',
        committedImmediatelyBeforeMarker,
        markerStillIntact: textAfter.includes(marker),
        textOk,
        caretOk: caretAfter === caretOffsetBefore + 2,
        residualPinyinLiteral: textAfter.includes('fanwen'),
        midCompositionInterrupted: midEvidence.interrupted,
        midCompositionMutations: midEvidence.mutations,
        expectedAfter,
        textAfter,
        expectedCaret: caretOffsetBefore + 2,
        caretAfter
      })
    }
  }

  test('A1 plain paragraph, edge=before x5 (control runs FIRST, pristine document)', async () => {
    await probe('A1-plain-before', 'MARK-A1-END', 'before', 5)
  })

  test('A11 blockquote, edge=before x5 (second non-math control)', async () => {
    await probe('A11-quote-before', 'MARK-A11-QUOTE-TEXT', 'before', 5)
  })

  test('A5 marker, edge=after x5 (same paragraph, further from the closing $)', async () => {
    await probe('A5-math-after', 'MARK-A5-AFTER-MATH', 'after', 5)
  })

  test('A5 marker, edge=before x5 (the failing matrix-a configuration)', async () => {
    await probe('A5-math-before', 'MARK-A5-AFTER-MATH', 'before', 5)
  })
})
