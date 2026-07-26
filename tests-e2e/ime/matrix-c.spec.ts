// E3 task 1 — Matrix C: input method / language variants (execution brief
// §3.4, 2026-07-26 revision — scope cut to C1 full-pinyin (P0) + C2 voice-
// dictation approximation (P1); shuangpin/kana/wubi/zhuyin dropped).
//
// C1: parameterized full-pinyin sequences, each its own compositionstart
// -> update -> commit cycle, chained back-to-back at one position to catch
// cross-cycle drift (offset carried wrong from one committed word to the
// next).
//
// C2: macOS dictation approximation — large bursts of `Input.insertText`
// with NO composition wrapper (real dictation finalizes recognized
// phrases directly; it doesn't drive the IME candidate-buffer protocol),
// separated by randomized 50-200ms gaps, at A1/A7/A9 per the brief.
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { runBasicComposition } from '../helpers/ime-cases'
import { launchImeApp, resultsPathFor, screenshotDirFor, type ImeAppHandle } from '../helpers/ime-app-lifecycle'
import { createResultsCollector, type CellResult } from '../helpers/ime-report'
import { annotateKnownIssue } from '../helpers/known-issues'
import { burstInsert, getCaretOffsetInContent, getCdpSession, readContentText } from '../helpers/ime'
import { POSITIONS } from '../helpers/positions'

const results = createResultsCollector()
const screenshotDir = screenshotDirFor('matrix-c')

let handle: ImeAppHandle

test.describe.serial('IME matrix C — input method / language variants', () => {
  test.afterAll(async () => {
    results.flush(resultsPathFor('c'))
    await handle?.teardownAndVerifyIsolation()
  })

  test('0. launch app on an isolated fixture copy', async () => {
    handle = await launchImeApp('matrix-c')
    expect(handle.pageErrors, `renderer pageerror on launch: ${handle.pageErrors.join('\n')}`).toEqual([])
  })

  // -- C1: full-pinyin, parameterized sequences, chained cycles ----------
  const C1_SEQUENCES: Array<{ name: string; words: Array<{ step: string; final: string }> }> = [
    {
      name: 'short-two-word',
      words: [
        { step: 'nihao', final: '你好' },
        { step: 'shijie', final: '世界' }
      ]
    },
    {
      name: 'medium-sentence',
      words: [
        { step: 'jinnian', final: '今年' },
        { step: 'shixing', final: '是行' },
        { step: 'reversion', final: '反文' },
        { step: 'diyige', final: '第一个' },
        { step: 'banben', final: '版本' }
      ]
    },
    {
      name: 'with-punctuation-word',
      words: [
        { step: 'ceshi', final: '测试' },
        { step: 'douhao', final: '，' },
        { step: 'wancheng', final: '完成' },
        { step: 'juhao', final: '。' }
      ]
    }
  ]

  for (const { name, words } of C1_SEQUENCES) {
    test(`C1[${name}]: chained full-pinyin composition cycles, no cross-cycle drift`, async () => {
      annotateKnownIssue(`C1[${name}]`)
      const { window, cdp } = handle
      const position = POSITIONS.A1
      const h0 = await position.resolve(window)
      await window.waitForTimeout(60)
      const textBefore = await readContentText(h0)
      const caretOffsetBefore = await getCaretOffsetInContent(window, h0)
      if (caretOffsetBefore === null) throw new Error(`C1[${name}]: could not resolve initial caret`)

      // Every cycle composes at the SAME fixed marker position
      // (right after MARK-A1-END) — including cycles from a PRIOR
      // C1[...] test in this file that already ran at A1, whose committed
      // text still sits there. So the correct expectation is "insert all
      // of this test's words, concatenated, at the one original caret
      // offset" — a prior test's leftover suffix stays at the very end,
      // not appended after (see the identical fix applied to matrix-b's
      // B9 for the same reasoning).
      let allOk = true
      const details: Array<{ word: string; ok: boolean; actual: string; expected: string }> = []
      for (const { step, final } of words) {
        const result = await runBasicComposition(window, cdp, { ...position, resolve: async () => h0 }, [step], final)
        const ok = result.committedTextOk && result.cursorOk && !result.interruptedDuringComposition
        details.push({ word: final, ok, actual: result.textAfter, expected: result.expectedTextAfter })
        if (!ok) allOk = false
      }

      const finalText = await readContentText(h0)
      const expectedFinal =
        textBefore.slice(0, caretOffsetBefore) +
        words.map((w) => w.final).join('') +
        textBefore.slice(caretOffsetBefore)
      const ok = allOk && finalText === expectedFinal
      if (!ok) await handle.window.screenshot({ path: path.join(screenshotDir, `C1-${name}-failure.png`) }).catch(() => {})
      const status: CellResult['status'] = ok ? 'pass' : 'fail'
      results.record({
        cell: `C1[${name}]`,
        description: `C1 全拼序列参数化 — ${name}（${words.length} 个连续组合-提交周期）`,
        status,
        expected: { text: expectedFinal },
        actual: { text: finalText, perWordDetails: details },
        screenshot: status === 'fail' ? path.join(screenshotDir, `C1-${name}-failure.png`) : undefined
      })
      expect(ok, `C1[${name}]: expected "${expectedFinal}", got "${finalText}"; per-word=${JSON.stringify(details)}`).toBe(true)
    })
  }

  // -- C2: voice-dictation burst approximation, at A1/A7/A9 ---------------
  const C2_POSITIONS = ['A1', 'A7', 'A9'] as const
  const C2_CHUNKS = ['今天天气不错，', '我们来测试一下语音听写功能，', '看看大段文本突发插入是否会出现丢字或者顺序错乱的问题。']

  for (const posKey of C2_POSITIONS) {
    test(`C2@${posKey}: voice-dictation burst insertText, multi-segment`, async () => {
      annotateKnownIssue(`C2@${posKey}`)
      const { window } = handle
      const position = POSITIONS[posKey]
      const h0 = await position.resolve(window)
      await window.waitForTimeout(60)
      const textBefore = await readContentText(h0)
      const caretOffsetBefore = await getCaretOffsetInContent(window, h0)
      if (caretOffsetBefore === null) throw new Error(`C2@${posKey}: could not resolve initial caret`)

      const cdp = await getCdpSession(handle.app, window)
      await burstInsert(window, cdp, C2_CHUNKS, [50, 200])
      await window.waitForTimeout(150)

      const textAfter = await readContentText(h0)
      // A1 has likely already accumulated C1's leftovers past the marker
      // (same fixed-insertion-point reasoning as C1/B9 above) — insert at
      // the original caret offset, not appended to the current end.
      const expectedText =
        textBefore.slice(0, caretOffsetBefore) + C2_CHUNKS.join('') + textBefore.slice(caretOffsetBefore)
      const ok = textAfter === expectedText
      if (!ok) await window.screenshot({ path: path.join(screenshotDir, `C2@${posKey}-failure.png`) }).catch(() => {})
      const status: CellResult['status'] = ok ? 'pass' : 'fail'
      results.record({
        cell: `C2@${posKey}`,
        description: `${position.label} — C2 语音听写近似（大块文本突发 insertText，段间 50-200ms）`,
        status,
        expected: { text: expectedText },
        actual: { text: textAfter },
        screenshot: status === 'fail' ? path.join(screenshotDir, `C2@${posKey}-failure.png`) : undefined
      })
      expect(ok, `C2@${posKey}: expected "${expectedText}", got "${textAfter}"`).toBe(true)
    })
  }
})
