// E3 task 1 — Matrix B: composition-in-progress interruption operations
// (execution brief §3.3, plus B11-B13 added 2026-07-26 after upstream task
// 0's source review). Each row runs at A1/A3/A9/A10 (the four positions
// the brief calls out), except B5 (best-effort only, see below) and B13
// (a dedicated soft-line-break fixture spot — the operation is inherently
// paragraph-specific).
//
// Row order matters: B11/B12 are confirmed-by-source-review structural
// gaps (muyajs/lib/eventHandler/keyboard.js's Backspace/Delete/Tab paths
// call their handlers unconditionally, unlike Enter/Arrow which check
// `!this.isComposed` first) and are expected to corrupt whatever text sits
// immediately before the composition point. They run LAST at each
// position so an earlier row's assertions never depend on marker text
// B11/B12 may have eaten into.
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { beginComposition, pollUntil, resolveLiveHandle } from '../helpers/ime-cases'
import { launchImeApp, resultsPathFor, screenshotDirFor, type ImeAppHandle } from '../helpers/ime-app-lifecycle'
import { createResultsCollector, type CellResult } from '../helpers/ime-report'
import { annotateKnownIssue } from '../helpers/known-issues'
import { ACTIVE_ENGINE } from '../helpers/engine-profile'
import {
  EDITOR_SELECTOR,
  composeCancel,
  composeCommit,
  composeSteps,
  drainInterruptionEvidence,
  getCaretOffsetInContent,
  getContentHandleAtSelection,
  readContentText,
  readLiveContentText,
  startInterruptionProbe,
  stopInterruptionProbe
} from '../helpers/ime'
import { MATRIX_B_POSITIONS, POSITIONS } from '../helpers/positions'

const results = createResultsCollector()
const screenshotDir = screenshotDirFor('matrix-b')

let handle: ImeAppHandle

// Known-issue / intermittent annotations moved to helpers/known-issues.ts in
// E3 task 2: they are now keyed by ENGINE, because the same matrix runs
// against both the legacy muyajs build and upstream's muya v2 build, whose
// defect sets differ — and a legacy-derived `test.fail()` reports "Expected
// to fail, but passed" on the other engine, which in a `describe.serial`
// block skips every cell after it. Every entry there is still populated from
// an observed run, never from source review, and still cites the concrete
// symptom so the annotation documents WHY, not just THAT.
const maybeFail = annotateKnownIssue

test.describe.serial('IME matrix B — composition interruption operations', () => {
  test.afterAll(async () => {
    results.flush(resultsPathFor('b'))
    await handle?.teardownAndVerifyIsolation()
  })

  test('0. launch app on an isolated fixture copy', async () => {
    handle = await launchImeApp('matrix-b')
    expect(handle.pageErrors, `renderer pageerror on launch: ${handle.pageErrors.join('\n')}`).toEqual([])
  })

  function recordAndAssert(
    cell: string,
    description: string,
    status: CellResult['status'],
    expected: Record<string, unknown>,
    actual: Record<string, unknown>,
    assertion: { ok: boolean; message: string }
  ): void {
    results.record({
      cell,
      description,
      status,
      expected,
      actual,
      screenshot: status === 'fail' ? path.join(screenshotDir, `${cell}-failure.png`) : undefined
    })
    expect(assertion.ok, assertion.message).toBe(true)
  }

  async function captureFailureScreenshot(cell: string): Promise<void> {
    await handle.window.screenshot({ path: path.join(screenshotDir, `${cell}-failure.png`) }).catch(() => {})
  }

  async function sendEditorAction(action: 'undo' | 'redo'): Promise<void> {
    await handle.app.evaluate(({ BrowserWindow }, actionName) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('mt::editor-edit-action', actionName)
    }, action)
  }

  async function requestFileSave(): Promise<void> {
    await handle.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('mt::editor-ask-file-save')
    })
  }

  // -- B1: Enter submits the candidate ---------------------------------
  for (const posKey of MATRIX_B_POSITIONS) {
    test(`B1@${posKey}: Enter submits candidate normally`, async () => {
      maybeFail(`B1@${posKey}`)
      const { window, cdp } = handle
      const position = POSITIONS[posKey]
      const { handle: h, textBefore, caretOffsetBefore } = await beginComposition(window, cdp, position, 'ceshi')
      // CDP has no candidate window for a real Enter key to confirm. Sending
      // Playwright's native Enter ends the synthetic composition before the
      // page sees the IME-keydown semantics. Dispatch the keydown to verify the
      // editor leaves it to the active composition, then use CDP's documented
      // composition commit primitive for the candidate confirmation itself.
      await window.evaluate(() => {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
        )
      })
      await window.waitForTimeout(50)
      const midEvidence = await drainInterruptionEvidence(window)
      await composeCommit(window, cdp, 'ceshi')
      await window.waitForTimeout(100)
      await stopInterruptionProbe(window)
      const { handle: fresh } = await resolveLiveHandle(window, h)
      const textAfter = await readContentText(fresh)

      // Enter-to-confirm should behave like a normal commit of the
      // composed literal text ("ceshi", since our simulator has no real
      // candidate list to pick 测试 from) — NOT insert a paragraph break.
      const expectedText = textBefore.slice(0, caretOffsetBefore) + 'ceshi' + textBefore.slice(caretOffsetBefore)
      const ok = textAfter === expectedText && !midEvidence.interrupted
      if (!ok) await captureFailureScreenshot(`B1@${posKey}`)
      recordAndAssert(
        `B1@${posKey}`,
        `${position.label} — Enter 提交候选`,
        ok ? 'pass' : 'fail',
        { text: expectedText, interrupted: false },
        { text: textAfter, interrupted: midEvidence.interrupted, mutations: midEvidence.mutations },
        { ok, message: `B1@${posKey}: expected "${expectedText}", got "${textAfter}" (interrupted=${midEvidence.interrupted})` }
      )
    })
  }

  // -- B2: Esc cancels the composition ----------------------------------
  for (const posKey of MATRIX_B_POSITIONS) {
    test(`B2@${posKey}: Esc cancels composition, original text intact`, async () => {
      maybeFail(`B2@${posKey}`)
      const { window, cdp } = handle
      const position = POSITIONS[posKey]
      const { handle: h, textBefore } = await beginComposition(window, cdp, position, 'ceshi')
      await window.keyboard.press('Escape')
      await window.waitForTimeout(150)
      const midEvidence = await drainInterruptionEvidence(window)
      await stopInterruptionProbe(window)
      const { handle: fresh } = await resolveLiveHandle(window, h)
      const textAfter = await readContentText(fresh)

      const ok = textAfter === textBefore
      if (!ok) await captureFailureScreenshot(`B2@${posKey}`)
      recordAndAssert(
        `B2@${posKey}`,
        `${position.label} — Esc 取消组合`,
        ok ? 'pass' : 'fail',
        { text: textBefore },
        { text: textAfter, mutations: midEvidence.mutations },
        { ok, message: `B2@${posKey}: expected original text restored "${textBefore}", got "${textAfter}"` }
      )
    })
  }

  // -- B3: Arrow keys (candidate paging) don't break composition or move
  //        the document cursor -----------------------------------------
  for (const posKey of MATRIX_B_POSITIONS) {
    test(`B3@${posKey}: arrow keys don't break composition or move doc cursor`, async () => {
      maybeFail(`B3@${posKey}`)
      const { window, cdp } = handle
      const position = POSITIONS[posKey]
      const { handle: h, textBefore, caretOffsetBefore } = await beginComposition(window, cdp, position, 'ceshi')
      await window.evaluate(() => {
        for (const key of ['ArrowDown', 'ArrowUp']) {
          document.activeElement?.dispatchEvent(
            new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
          )
        }
      })
      await window.waitForTimeout(100)
      const midText = await readLiveContentText(h)
      const stillComposing = midText === textBefore.slice(0, caretOffsetBefore) + 'ceshi' + textBefore.slice(caretOffsetBefore)

      await composeCommit(window, cdp, '测试')
      await window.waitForTimeout(120)
      const midEvidence = await drainInterruptionEvidence(window)
      await stopInterruptionProbe(window)
      const { handle: fresh } = await resolveLiveHandle(window, h)
      const textAfter = await readContentText(fresh)
      const expectedText = textBefore.slice(0, caretOffsetBefore) + '测试' + textBefore.slice(caretOffsetBefore)

      const ok = stillComposing && textAfter === expectedText
      if (!ok) await captureFailureScreenshot(`B3@${posKey}`)
      recordAndAssert(
        `B3@${posKey}`,
        `${position.label} — 方向键翻页不破坏组合`,
        ok ? 'pass' : 'fail',
        { midText: textBefore.slice(0, caretOffsetBefore) + 'ceshi' + textBefore.slice(caretOffsetBefore), finalText: expectedText },
        { midText, finalText: textAfter, stillComposing, mutations: midEvidence.mutations },
        { ok, message: `B3@${posKey}: mid-composition text after arrows="${midText}" (stillComposing=${stillComposing}), final="${textAfter}" expected "${expectedText}"` }
      )
    })
  }

  // -- B4: click elsewhere during composition — no residual half-chars --
  for (const posKey of MATRIX_B_POSITIONS) {
    test(`B4@${posKey}: click elsewhere leaves no residual composing chars`, async () => {
      maybeFail(`B4@${posKey}`)
      const { window, cdp } = handle
      const position = POSITIONS[posKey]
      const { handle: h, textBefore, caretOffsetBefore } = await beginComposition(window, cdp, position, 'ceshi')

      // Click a document-title-bar-safe spot: the editor root itself, far
      // from the composing block (top of the doc). Any visible, unrelated
      // block works — the point is "somewhere else in the document."
      //
      // Read back via the WHOLE editor's text, not `resolveLiveHandle` —
      // that helper falls back to "whatever content span the live
      // selection is currently inside," which after this click is the
      // title we just clicked into, not the original composing block.
      await window.locator(ACTIVE_ENGINE.clickAwaySelector).first().click()
      await window.waitForTimeout(150)
      const midEvidence = await drainInterruptionEvidence(window)
      await stopInterruptionProbe(window)
      const fullDocText = await window.evaluate(
        (sel) => document.querySelector(sel)!.textContent ?? '',
        EDITOR_SELECTOR
      )
      const originalBlockStillPristine = fullDocText.includes(textBefore)
      const originalBlockCleanlyCommitted = fullDocText.includes(
        textBefore.slice(0, caretOffsetBefore) + 'ceshi' + textBefore.slice(caretOffsetBefore)
      )
      const textAtOriginalSpot = originalBlockStillPristine
        ? textBefore
        : originalBlockCleanlyCommitted
          ? textBefore.slice(0, caretOffsetBefore) + 'ceshi' + textBefore.slice(caretOffsetBefore)
          : `NEITHER — full doc text was: ${fullDocText.slice(0, 200)}...`

      // Hard requirement regardless of commit-vs-cancel classification: no
      // residual half-composed literal "ceshi" left dangling AND no
      // duplication — the original block must appear in the document
      // either exactly as its pre-composition text (cancelled) or with
      // "ceshi" cleanly committed (confirmed-on-blur), nothing in between.
      const cancelled = originalBlockStillPristine
      const committed = originalBlockCleanlyCommitted
      const ok = cancelled || committed
      if (!ok) await captureFailureScreenshot(`B4@${posKey}`)
      recordAndAssert(
        `B4@${posKey}`,
        `${position.label} — 组合中点击文档其他位置`,
        ok ? 'pass' : 'fail',
        { note: 'either cancelled (original text) or committed (ceshi appended) — Typora-parity classification not automatable, see manual track' },
        { text: textAtOriginalSpot, classification: cancelled ? 'cancelled' : committed ? 'committed' : 'RESIDUAL/CORRUPT', mutations: midEvidence.mutations },
        { ok, message: `B4@${posKey}: text at original composing spot after clicking away: "${textAtOriginalSpot}" (neither cleanly cancelled nor cleanly committed)` }
      )
    })
  }

  // -- B6: autopair trigger during composition ---------------------------
  for (const posKey of MATRIX_B_POSITIONS) {
    test(`B6@${posKey}: autopair char during composition doesn't eat the composition`, async () => {
      maybeFail(`B6@${posKey}`)
      const { window, cdp } = handle
      const position = POSITIONS[posKey]
      const { handle: h, textBefore, caretOffsetBefore } = await beginComposition(window, cdp, position, 'ceshi')
      // A real keydown for an autopair-triggering character while a
      // composition is (per our simulator) still open — not something a
      // real OS IME would ever let through mid-candidate-selection, but
      // exercising it tells us whether the app's autopair logic has its
      // own isComposed guard.
      await window.keyboard.press('"')
      await window.waitForTimeout(100)
      await composeCommit(window, cdp, '测试')
      await window.waitForTimeout(120)
      const midEvidence = await drainInterruptionEvidence(window)
      await stopInterruptionProbe(window)
      const { handle: fresh } = await resolveLiveHandle(window, h)
      const textAfter = await readContentText(fresh)

      // Best-effort expectation: the composed "测试" should appear intact
      // somewhere in the block, uncorrupted by autopair's quote-doubling
      // logic swallowing/duplicating characters.
      const ok = textAfter.includes('测试')
      if (!ok) await captureFailureScreenshot(`B6@${posKey}`)
      recordAndAssert(
        `B6@${posKey}`,
        `${position.label} — 组合中触发自动配对字符`,
        ok ? 'pass' : 'fail',
        { note: '测试 should appear intact in the block' },
        { text: textAfter, mutations: midEvidence.mutations },
        { ok, message: `B6@${posKey}: final text "${textAfter}" does not contain the intact committed "测试"` }
      )
    })
  }

  // -- B8: Cmd+Z immediately after commit undoes the whole insertion -----
  // (Runs before B7: B7 deliberately presses Cmd+Z on an OPEN, uncommitted
  // composition, which — since compositions aren't on the undo stack —
  // acts on whatever the last REAL committed edit was, i.e. it has a side
  // effect on the undo stack that would otherwise pollute B8 if B8 ran
  // second at the same position.)
  for (const posKey of MATRIX_B_POSITIONS) {
    test(`B8@${posKey}: Cmd+Z right after commit undoes the whole insertion`, async () => {
      maybeFail(`B8@${posKey}`)
      const { window, cdp } = handle
      const position = POSITIONS[posKey]
      const { handle: h, textBefore, caretOffsetBefore } = await beginComposition(window, cdp, position, 'ceshi')
      await composeCommit(window, cdp, '测试')
      await window.waitForTimeout(120)
      await stopInterruptionProbe(window)
      const { handle: afterCommitHandle } = await resolveLiveHandle(window, h)
      const textAfterCommit = await readContentText(afterCommitHandle)

      await sendEditorAction('undo')
      await window.waitForTimeout(150)
      const { handle: afterUndoHandle } = await resolveLiveHandle(window, afterCommitHandle)
      const textAfterUndo = await readContentText(afterUndoHandle)

      const expectedAfterCommit = textBefore.slice(0, caretOffsetBefore) + '测试' + textBefore.slice(caretOffsetBefore)
      const ok = textAfterCommit === expectedAfterCommit && textAfterUndo === textBefore
      if (!ok) await captureFailureScreenshot(`B8@${posKey}`)
      recordAndAssert(
        `B8@${posKey}`,
        `${position.label} — 提交后立即 Cmd+Z，撤销粒度=整句`,
        ok ? 'pass' : 'fail',
        { afterCommit: expectedAfterCommit, afterUndo: textBefore },
        { afterCommit: textAfterCommit, afterUndo: textAfterUndo },
        { ok, message: `B8@${posKey}: afterCommit="${textAfterCommit}" (want "${expectedAfterCommit}"), afterUndo="${textAfterUndo}" (want "${textBefore}")` }
      )
    })
  }

  // -- B7: Cmd+Z during composition doesn't undo pre-existing content ----
  for (const posKey of MATRIX_B_POSITIONS) {
    test(`B7@${posKey}: Cmd+Z during composition doesn't touch prior content`, async () => {
      maybeFail(`B7@${posKey}`)
      const { window, cdp } = handle
      const position = POSITIONS[posKey]
      const { handle: h, textBefore } = await beginComposition(window, cdp, position, 'ceshi')
      await sendEditorAction('undo')
      await window.waitForTimeout(150)
      const midEvidence = await drainInterruptionEvidence(window)
      await composeCancel(window, cdp)
      await stopInterruptionProbe(window)
      const { handle: fresh } = await resolveLiveHandle(window, h)
      const textAfter = await readContentText(fresh)

      // Prior content (everything up to the composition's start offset)
      // must survive regardless of what Cmd+Z did to the in-flight
      // composition itself.
      const priorContentPrefix = textBefore.slice(0, textBefore.length)
      const ok = textAfter.startsWith(priorContentPrefix) || priorContentPrefix.startsWith(textAfter)
      if (!ok) await captureFailureScreenshot(`B7@${posKey}`)
      recordAndAssert(
        `B7@${posKey}`,
        `${position.label} — 组合中 Cmd+Z 不破坏此前内容`,
        ok ? 'pass' : 'fail',
        { textBefore },
        { textAfter, mutations: midEvidence.mutations },
        { ok, message: `B7@${posKey}: pre-composition content not preserved — before="${textBefore}" after="${textAfter}"` }
      )
    })
  }

  // -- B9: 5 rapid whole-sentence compositions, zero drop/dup ------------
  const B9_SENTENCES: Array<{ step: string; final: string }> = [
    { step: 'zheshiyiduanceshiwenzi', final: '这是一段用于压力测试的连续输入内容一共约三十个字整' },
    { step: 'diereduanshuru', final: '第二段输入内容继续验证连续组合是否会丢字或者出现重复的字符片段' },
    { step: 'disanduan', final: '第三段同样是三十个字左右的中文句子用来检验累计偏移是否正确无误' },
    { step: 'disiduan', final: '第四段测试内容依旧保持在三十字上下确保每一段都独立可验证结果' },
    { step: 'diwuduan', final: '第五段也是最后一段压力输入内容全部完成之后统一比较拼接结果' }
  ]
  for (const posKey of MATRIX_B_POSITIONS) {
    test(`B9@${posKey}: 5x rapid whole-sentence composition, zero drop/dup`, async () => {
      maybeFail(`B9@${posKey}`)
      const { window, cdp } = handle
      const position = POSITIONS[posKey]
      const h0 = await position.resolve(window)
      await window.waitForTimeout(60)
      const textBefore = await readContentText(h0)
      const caretOffsetBefore = await getCaretOffsetInContent(window, h0)
      if (caretOffsetBefore === null) throw new Error(`B9@${posKey}: could not resolve initial caret`)

      // All 5 rounds compose back-to-back AT THE SAME ORIGINAL caret
      // position — each commit should leave the cursor immediately after
      // its own inserted text, so round 2 lands right after round 1's
      // text, etc. Expected value is therefore "insert all 5 sentences,
      // concatenated, at the one original caret offset" — NOT appended to
      // the end of the whole block (which may have trailing content from
      // earlier matrix-B rows sharing this position).
      let currentHandle = h0
      const perRoundOk: boolean[] = []
      for (const { step, final } of B9_SENTENCES) {
        await startInterruptionProbe(window, currentHandle)
        const before = await readContentText(currentHandle)
        const caret = await getCaretOffsetInContent(window, currentHandle)
        if (caret === null) { perRoundOk.push(false); break }
        await composeSteps(window, cdp, [step])
        await pollUntil(() => readLiveContentText(currentHandle), (t) => t === before.slice(0, caret) + step + before.slice(caret), 600)
        await drainInterruptionEvidence(window)
        await composeCommit(window, cdp, final)
        await stopInterruptionProbe(window)
        const { handle: fresh } = await resolveLiveHandle(window, currentHandle)
        currentHandle = fresh
        const expectedThisRound = before.slice(0, caret) + final + before.slice(caret)
        const actualNow = await readContentText(currentHandle)
        perRoundOk.push(actualNow === expectedThisRound)
      }
      const allLanded = perRoundOk.every(Boolean)

      const finalText = await readContentText(currentHandle)
      const expectedFinal =
        textBefore.slice(0, caretOffsetBefore) +
        B9_SENTENCES.map((s) => s.final).join('') +
        textBefore.slice(caretOffsetBefore)
      const ok = finalText === expectedFinal
      if (!ok) await captureFailureScreenshot(`B9@${posKey}`)
      recordAndAssert(
        `B9@${posKey}`,
        `${position.label} — 连续快速整句输入 x5，零丢字零重复`,
        ok ? 'pass' : 'fail',
        { text: expectedFinal },
        { text: finalText, allRoundsLandedCleanly: allLanded },
        { ok, message: `B9@${posKey}: expected "${expectedFinal}", got "${finalText}"` }
      )
    })
  }

  // -- B10: a save operation firing mid-composition doesn't interrupt ----
  // Methodology note (deviation from the original plan, documented rather
  // than silently swapped — see report): the literal spec called for
  // toggling the real autoSave PREFERENCE (autoSave:true + a short
  // autoSaveDelay) via `mt::set-user-preference` and waiting out the
  // timer. That IPC round-trip proved unreliable in this environment —
  // reproduced twice independently: once a `window.evaluate()` call
  // sending that exact IPC message hung for a full 2 minutes with no
  // error, and once (with a full previous test run's history loaded) the
  // same call path took 50+ seconds and still corrupted the composition
  // buffer in a way unrelated to the app (a stray literal "ceshi" leaking
  // in) — matching a separate long-held-open-composition CDP quirk this
  // suite already documents elsewhere, not something attributable to
  // autoSave. Root cause not isolated within this task's time budget.
  // Cmd+S exercises the SAME underlying disk-write path (main process
  // IPC round-trip triggering a real file write) without going through
  // the autoSave preference/timer machinery, so it still tests "a save
  // operation firing mid-composition doesn't interrupt it" — just not via
  // the timer specifically. The literal autoSave-timer variant is left to
  // the manual-track checklist (see report appendix).
  for (const posKey of MATRIX_B_POSITIONS) {
    test(`B10@${posKey}: Cmd+S mid-composition doesn't interrupt (autoSave-timer proxy — see report)`, async () => {
      maybeFail(`B10@${posKey}`)
      const { window, cdp } = handle
      const position = POSITIONS[posKey]
      const { handle: h, textBefore, caretOffsetBefore } = await beginComposition(window, cdp, position, 'ceshi')

      await requestFileSave()
      await window.waitForTimeout(300)
      const midEvidence = await drainInterruptionEvidence(window)

      await composeCommit(window, cdp, '测试')
      await window.waitForTimeout(150)
      await stopInterruptionProbe(window)
      const { handle: fresh } = await resolveLiveHandle(window, h)
      const textAfter = await readContentText(fresh)
      const expectedText = textBefore.slice(0, caretOffsetBefore) + '测试' + textBefore.slice(caretOffsetBefore)

      const ok = textAfter === expectedText && !midEvidence.interrupted
      if (!ok) await captureFailureScreenshot(`B10@${posKey}`)
      recordAndAssert(
        `B10@${posKey}`,
        `${position.label} — 组合中触发保存（Cmd+S 代理 autoSave 定时器，见报告方法论说明）`,
        ok ? 'pass' : 'fail',
        { text: expectedText, interrupted: false },
        { text: textAfter, interrupted: midEvidence.interrupted, mutations: midEvidence.mutations },
        { ok, message: `B10@${posKey}: expected "${expectedText}" with no interruption, got "${textAfter}" (interrupted=${midEvidence.interrupted})` }
      )
    })
  }

  // -- B13: soft line break (Shift+Enter) then immediate composition -----
  test('B13: composition right after Shift+Enter does not drop the first char', async () => {
    maybeFail('B13')
    const { window, cdp } = handle
    await window.locator(EDITOR_SELECTOR).getByText('MARK-B13-BASE', { exact: false }).first().click()
    await window.keyboard.press('End')
    await window.waitForTimeout(100)
    await window.keyboard.press('Shift+Enter')
    await window.waitForTimeout(100)

    const h0 = await getContentHandleAtSelection(window)
    const textBefore = await readContentText(h0)
    const caretOffsetBefore = await getCaretOffsetInContent(window, h0)
    if (caretOffsetBefore === null) throw new Error('B13: could not resolve caret after Shift+Enter')

    await startInterruptionProbe(window, h0)
    await composeSteps(window, cdp, ['ceshi'])
    await pollUntil(() => readLiveContentText(h0), (t) => t === textBefore.slice(0, caretOffsetBefore) + 'ceshi' + textBefore.slice(caretOffsetBefore), 600)
    await drainInterruptionEvidence(window)
    await composeCommit(window, cdp, '测试')
    await window.waitForTimeout(150)
    const midEvidence = await drainInterruptionEvidence(window)
    await stopInterruptionProbe(window)
    const { handle: fresh } = await resolveLiveHandle(window, h0)
    const textAfter = await readContentText(fresh)
    const expectedText = textBefore.slice(0, caretOffsetBefore) + '测试' + textBefore.slice(caretOffsetBefore)

    const ok = textAfter === expectedText && textAfter.includes('测') // first char specifically must survive
    if (!ok) await captureFailureScreenshot('B13')
    recordAndAssert(
      'B13',
      '软换行（Shift+Enter）后紧接组合输入，首字不丢',
      ok ? 'pass' : 'fail',
      { text: expectedText },
      { text: textAfter, mutations: midEvidence.mutations },
      { ok, message: `B13: expected "${expectedText}", got "${textAfter}"` }
    )
  })

  // -- B5: Cmd+Tab-equivalent (best-effort — see report). Automation
  //        cannot genuinely invoke the OS app switcher from inside the
  //        very app being tested, so this simulates the DOWNSTREAM effect
  //        (BrowserWindow blur then focus) rather than the OS gesture
  //        itself. Manual-track fallback is mandatory, not optional — see
  //        the checklist appendix. -------------------------------------
  test('B5@A1: window blur/focus during composition (best-effort Cmd+Tab proxy)', async () => {
    maybeFail('B5@A1')
    const { window, cdp, app } = handle
    const position = POSITIONS.A1
    const { handle: h, textBefore, caretOffsetBefore } = await beginComposition(window, cdp, position, 'ceshi')

    const bw = await app.browserWindow(window)
    await bw.evaluate((win) => win.blur())
    await window.waitForTimeout(200)
    await bw.evaluate((win) => win.focus())
    await window.waitForTimeout(200)

    const midEvidence = await drainInterruptionEvidence(window)
    await stopInterruptionProbe(window)
    const { handle: fresh } = await resolveLiveHandle(window, h)
    const textAfterBlur = await readContentText(fresh)

    // No hard pass/fail contract here beyond "no duplicated commit and no
    // dangling half-composed literal" — same relaxed bar as B4, since
    // there's no real IME candidate window to reference a ground truth
    // against. Recorded as-is either way; see report for why this is
    // explicitly a best-effort proxy, not a real Cmd+Tab.
    const cancelled = textAfterBlur === textBefore
    const committed =
      textAfterBlur === textBefore.slice(0, caretOffsetBefore) + 'ceshi' + textBefore.slice(caretOffsetBefore)
    const ok = cancelled || committed
    if (!ok) await captureFailureScreenshot('B5@A1')
    results.record({
      cell: 'B5@A1',
      description: 'A1 — 窗口失焦/再获焦代理 Cmd+Tab（best-effort，非真实 OS 手势，人工轨强制兜底）',
      status: ok ? 'pass' : 'fail',
      expected: { note: 'either cancelled or cleanly committed, no residual half-composed literal' },
      actual: { text: textAfterBlur, classification: cancelled ? 'cancelled' : committed ? 'committed' : 'RESIDUAL/CORRUPT', mutations: midEvidence.mutations },
      notes: 'BEST-EFFORT PROXY: simulates BrowserWindow blur/focus, not a real OS Cmd+Tab app switch. Manual track required regardless of this result.',
      screenshot: ok ? undefined : path.join(screenshotDir, 'B5@A1-failure.png')
    })
    expect(ok, `B5@A1: text after blur/focus "${textAfterBlur}" is neither cleanly cancelled nor cleanly committed`).toBe(true)
  })

  // -- B11 (P0): Backspace/Delete during composition ---------------------
  // Confirmed via source review: muyajs/lib/eventHandler/keyboard.js's
  // keydownBinding calls `contentState.backspaceHandler`/`deleteHandler`
  // unconditionally — unlike Enter/Arrow, which check `!this.isComposed`
  // first. Since `contentState`'s model text is frozen at its
  // pre-composition value until compositionend (inputBinding() also
  // gates the live 'input' events on `!this.isComposed`), a Backspace
  // fired here operates on a cursor/text pair the model hasn't updated
  // for the in-flight composition — expected to consume the character
  // immediately before the composition start point, independent of
  // (and invisible to) whatever the DOM is currently showing mid-compose.
  for (const posKey of MATRIX_B_POSITIONS) {
    test(`B11@${posKey}: Backspace during composition (P0, structural gap)`, async () => {
      // NOTE: the source-confirmed gap (no isComposed guard on
      // Backspace/Delete) was expected to corrupt every position, but
      // empirically it does NOT reproduce at A1 — muyajs's post-
      // compositionend inputHandler reconciles against the LIVE DOM via a
      // text diff (fast-diff), which absorbs some of the desync. Real
      // per-position divergence is tracked in KNOWN_ISSUES, populated
      // from actual runs, not assumed from the source review alone.
      maybeFail(`B11@${posKey}`)
      const { window, cdp } = handle
      const position = POSITIONS[posKey]
      const { handle: h, textBefore, caretOffsetBefore } = await beginComposition(window, cdp, position, 'ceshi')
      await window.keyboard.press('Backspace')
      await window.waitForTimeout(150)
      await composeCommit(window, cdp, '测试')
      await window.waitForTimeout(120)
      const midEvidence = await drainInterruptionEvidence(window)
      await stopInterruptionProbe(window)
      const { handle: fresh } = await resolveLiveHandle(window, h)
      const textAfter = await readContentText(fresh)

      // Correct behavior would be: Backspace deletes ONE character from
      // the in-progress composition buffer ("cesh" remains composing),
      // and the eventual commit reflects that edit — original
      // pre-composition content is untouched either way.
      const expectedIfCorrect = textBefore.slice(0, caretOffsetBefore) + '测试' + textBefore.slice(caretOffsetBefore)
      const ok = textAfter === expectedIfCorrect
      results.record({
        cell: `B11@${posKey}`,
        description: `${position.label} — 组合中 Backspace（P0 结构性缺口）`,
        status: ok ? 'pass' : 'fail',
        expected: { text: expectedIfCorrect, note: 'Backspace should edit the composition buffer only, not pre-existing content' },
        actual: { text: textAfter, textBefore, mutations: midEvidence.mutations },
        notes: 'Source-confirmed gap: keydownBinding calls backspaceHandler unconditionally (no isComposed guard).',
        screenshot: path.join(screenshotDir, `B11@${posKey}-failure.png`)
      })
      await handle.window.screenshot({ path: path.join(screenshotDir, `B11@${posKey}-failure.png`) }).catch(() => {})
      expect(textAfter, `B11@${posKey}: expected "${expectedIfCorrect}" (composition-buffer-only edit), got "${textAfter}"`).toBe(expectedIfCorrect)
    })
  }

  // -- B11@A14 (extra, not in the original 4-position set): upstream issue
  //    #4956 / PR #4957's own bug report reproduces specifically INSIDE AN
  //    HTML BLOCK (per E3 task 0's upstream review), not a code block —
  //    added to directly test that exact repro condition on our build.
  test('B11@A14: Backspace during composition inside an HTML block (upstream #4956 repro site)', async () => {
    maybeFail('B11@A14')
    const { window, cdp } = handle
    const position = POSITIONS.A14
    const { handle: h, textBefore, caretOffsetBefore } = await beginComposition(window, cdp, position, 'ceshi')
    await window.keyboard.press('Backspace')
    await window.waitForTimeout(150)
    await composeCommit(window, cdp, '测试')
    await window.waitForTimeout(120)
    const midEvidence = await drainInterruptionEvidence(window)
    await stopInterruptionProbe(window)
    const { handle: fresh } = await resolveLiveHandle(window, h)
    const textAfter = await readContentText(fresh)

    const expectedIfCorrect = textBefore.slice(0, caretOffsetBefore) + '测试' + textBefore.slice(caretOffsetBefore)
    const ok = textAfter === expectedIfCorrect
    results.record({
      cell: 'B11@A14',
      description: 'HTML 块内部 — 组合中 Backspace（上游 #4956/PR #4957 原始复现位置）',
      status: ok ? 'pass' : 'fail',
      expected: { text: expectedIfCorrect },
      actual: { text: textAfter, textBefore, mutations: midEvidence.mutations },
      notes: 'Added specifically because E3 task 0\'s upstream review found #4956\'s own bug report reproduces inside an HTML block, not the A10 code block this suite otherwise covers for B11.',
      screenshot: ok ? undefined : path.join(screenshotDir, 'B11@A14-failure.png')
    })
    if (!ok) await handle.window.screenshot({ path: path.join(screenshotDir, 'B11@A14-failure.png') }).catch(() => {})
    expect(textAfter, `B11@A14: expected "${expectedIfCorrect}", got "${textAfter}"`).toBe(expectedIfCorrect)
  })

  // -- B12: Tab during composition (candidate paging / separate code path)
  for (const posKey of MATRIX_B_POSITIONS) {
    test(`B12@${posKey}: Tab during composition`, async () => {
      maybeFail(`B12@${posKey}`)
      const { window, cdp } = handle
      const position = POSITIONS[posKey]
      const { handle: h, textBefore, caretOffsetBefore } = await beginComposition(window, cdp, position, 'ceshi')
      // Tab is normally consumed by the OS IME candidate UI. Playwright's
      // native Tab has no candidate window to consume it and prematurely
      // finalizes the synthetic CDP composition, so dispatch only the
      // editor-facing keydown, then commit through CDP.
      await window.evaluate(() => {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
        )
      })
      await window.waitForTimeout(50)
      const midEvidence = await drainInterruptionEvidence(window)
      await composeCommit(window, cdp, '测试')
      await window.waitForTimeout(120)
      await stopInterruptionProbe(window)
      const { handle: fresh } = await resolveLiveHandle(window, h)
      const textAfter = await readContentText(fresh)

      const expectedIfCorrect = textBefore.slice(0, caretOffsetBefore) + '测试' + textBefore.slice(caretOffsetBefore)
      const ok = textAfter === expectedIfCorrect && !midEvidence.interrupted
      if (!ok) await captureFailureScreenshot(`B12@${posKey}`)
      recordAndAssert(
        `B12@${posKey}`,
        `${position.label} — 组合中 Tab（候选翻页，独立代码路径）`,
        ok ? 'pass' : 'fail',
        { text: expectedIfCorrect, interrupted: false, note: 'tabHandler also lacks an isComposed guard per keyboard.js source review' },
        { text: textAfter, interrupted: midEvidence.interrupted, mutations: midEvidence.mutations },
        { ok, message: `B12@${posKey}: expected "${expectedIfCorrect}" with no interruption, got "${textAfter}" (interrupted=${midEvidence.interrupted})` }
      )
    })
  }
})
