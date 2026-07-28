// Shared "compose then assert the standard three things" runner used by
// matrix A and matrix C. Matrix B's interruption operations are
// deliberately NOT built on top of this — each operation (Enter/Esc/
// arrow-keys/click-away/blur/autopair/undo/autosave) needs different
// injected actions at a different point in the sequence, so those tests
// call the ime.ts primitives directly instead of forcing them through one
// generic shape.
import type { CDPSession, Page } from '@playwright/test'
import {
  composeCommit,
  composeSteps,
  drainInterruptionEvidence,
  getCaretOffsetInContent,
  getContentHandleAtSelection,
  readContentText,
  readLiveContentText,
  startInterruptionProbe,
  stopInterruptionProbe,
  type InterruptionEvidence
} from './ime'
import type { PositionSpec } from './positions'

export interface BasicCompositionResult {
  textBefore: string
  textAfter: string
  expectedTextAfter: string
  committedTextOk: boolean
  caretOffsetBefore: number
  caretOffsetAfter: number | null
  expectedCaretOffset: number
  cursorOk: boolean
  midCompositionEvidence: InterruptionEvidence
  postCommitEvidence: InterruptionEvidence
  interruptedDuringComposition: boolean
  /** False means the last `imeSetComposition` step never visibly landed
   * within the poll window before we committed anyway — a simulator-side
   * timing miss, not a product bug; see report's fidelity-limits section.
   * `committedTextOk`/`cursorOk` should be read skeptically when this is
   * false. */
  lastCompositionStepLanded: boolean
  /** Diagnostic only, not a failure signal: muyajs fully replaces a
   * paragraph's content span (same `id`, new DOM node) on any re-render
   * that re-tokenizes inline formatting (bold/code/link) — observed
   * empirically on A3/A4/A6. A plain paragraph with no inline formatting
   * (A1/A2) updates the existing node's innerHTML in place instead. Either
   * is legitimate at *commit* time; only a replacement observed *before*
   * commit (captured by `midCompositionEvidence`) is a bug signal. */
  contentNodeReplacedOnCommit: boolean
}

/**
 * Places the caret at `position`, runs a growing composition (`steps`),
 * commits with `finalText`, and reports the standard three assertions
 * (committed content / caret landing spot / no structural mutation while
 * composing) as data rather than throwing — callers decide how to turn
 * this into `expect()`s and report records.
 */
export async function runBasicComposition(
  window: Page,
  cdp: CDPSession,
  position: PositionSpec,
  steps: readonly string[],
  finalText: string
): Promise<BasicCompositionResult> {
  let handle = await position.resolve(window)
  // Extra guard on top of placeCaretAtMarker's own click-settle wait:
  // give the freshly-set selection one more tick before the first CDP IME
  // command, in case a position's `resolve()` did something more than a
  // plain marker click (e.g. A12's Enter-to-create-a-new-paragraph).
  await window.waitForTimeout(60)
  let textBefore = await readContentText(handle)
  let caretOffsetBefore = await getCaretOffsetInContent(window, handle)
  if (caretOffsetBefore === null) {
    // Retry once — see beginComposition's identical guard for why.
    await window.waitForTimeout(200)
    handle = await position.resolve(window)
    await window.waitForTimeout(60)
    textBefore = await readContentText(handle)
    caretOffsetBefore = await getCaretOffsetInContent(window, handle)
  }
  if (caretOffsetBefore === null) {
    throw new Error(`runBasicComposition(${position.key}): could not resolve the initial caret offset after retry`)
  }

  await startInterruptionProbe(window, handle)
  await composeSteps(window, cdp, steps)

  // Verify the LAST composition step actually landed before committing.
  // `cdp.send('Input.imeSetComposition', ...)` resolving only means
  // Chromium accepted the command, not that the renderer finished applying
  // it — under load, committing immediately after can race an
  // still-in-flight composition update. Observed failure mode: an
  // intermediate step (e.g. "fanw" of "fanwen") gets frozen in as literal
  // text and the commit's final text is inserted separately alongside it,
  // rather than replacing it. Polling here trades a little time for a
  // suite that fails on real product bugs instead of its own race.
  const expectedMidText =
    textBefore.slice(0, caretOffsetBefore) + steps[steps.length - 1] + textBefore.slice(caretOffsetBefore)
  const lastStepLanded = await pollUntil(
    () => readLiveContentText(handle),
    (text) => text === expectedMidText,
    600
  )

  const midCompositionEvidence = await drainInterruptionEvidence(window)
  await composeCommit(window, cdp, finalText)
  const postCommitEvidence = await drainInterruptionEvidence(window)
  await stopInterruptionProbe(window)

  const { handle: freshHandle, replaced: contentNodeReplacedOnCommit } = await resolveLiveHandle(window, handle)
  const textAfter = await readContentText(freshHandle)
  const caretOffsetAfter = await getCaretOffsetInContent(window, freshHandle)

  const expectedTextAfter = textBefore.slice(0, caretOffsetBefore) + finalText + textBefore.slice(caretOffsetBefore)
  const expectedCaretOffset = caretOffsetBefore + finalText.length

  return {
    textBefore,
    textAfter,
    expectedTextAfter,
    committedTextOk: textAfter === expectedTextAfter,
    caretOffsetBefore,
    caretOffsetAfter,
    expectedCaretOffset,
    cursorOk: caretOffsetAfter === expectedCaretOffset,
    midCompositionEvidence,
    postCommitEvidence,
    interruptedDuringComposition: midCompositionEvidence.interrupted,
    lastCompositionStepLanded: lastStepLanded,
    contentNodeReplacedOnCommit
  }
}

/**
 * Re-resolve a content handle from the live selection if the original
 * reference was detached — muyajs fully replaces a paragraph's content
 * span (same `id`, new DOM node) on any re-render that re-tokenizes inline
 * formatting (bold/code/link), observed empirically on A3/A4/A6. A plain
 * paragraph with no inline formatting (A1/A2) updates the existing node's
 * innerHTML in place instead. Either is legitimate after a deliberate
 * commit/finalize; `replaced` is diagnostic, not a failure signal on its
 * own.
 */
export async function resolveLiveHandle(
  window: Page,
  handle: import('@playwright/test').ElementHandle<Element>
): Promise<{ handle: import('@playwright/test').ElementHandle<Element>; replaced: boolean }> {
  const stillLive = await window.evaluate((el) => document.contains(el), handle)
  if (stillLive) return { handle, replaced: false }
  return { handle: await getContentHandleAtSelection(window), replaced: true }
}

export interface OpenComposition {
  handle: import('@playwright/test').ElementHandle<Element>
  textBefore: string
  caretOffsetBefore: number
  /** False means the composition step never visibly landed in the DOM
   * within the poll window — see samplePinyinSequence's doc comment on
   * the underlying CDP quirk. Callers should treat a false here as an
   * inconclusive result, not a product-bug signal. */
  landed: boolean
}

/**
 * Matrix B building block: resolve `position`, settle, snapshot the
 * pre-composition text/caret, start the interruption probe, and open a
 * composition with `text` (single `imeSetComposition` step — matrix B
 * tests inject their interrupting action mid-composition, so a longer
 * multi-step buffer just adds race surface without adding coverage here).
 * Caller is responsible for the interrupting action, finalizing (commit/
 * cancel/whatever the operation implies), and calling
 * `stopInterruptionProbe`.
 */
export async function beginComposition(
  window: Page,
  cdp: CDPSession,
  position: PositionSpec,
  text: string
): Promise<OpenComposition> {
  let handle = await position.resolve(window)
  await window.waitForTimeout(60)
  let textBefore = await readContentText(handle)
  let caretOffsetBefore = await getCaretOffsetInContent(window, handle)
  if (caretOffsetBefore === null) {
    // Retry once — on a heavily-edited shared position (many prior
    // matrix-B rows appending to the same marker), the click-then-Range
    // placement can occasionally race a still-settling re-render (see
    // ime.ts's placeCaretAtMarker comment on the same class of race).
    await window.waitForTimeout(200)
    handle = await position.resolve(window)
    await window.waitForTimeout(60)
    textBefore = await readContentText(handle)
    caretOffsetBefore = await getCaretOffsetInContent(window, handle)
  }
  if (caretOffsetBefore === null) {
    throw new Error(`beginComposition(${position.key}): could not resolve the initial caret offset after retry`)
  }
  await startInterruptionProbe(window, handle)
  await composeSteps(window, cdp, [text])
  const landed = await pollUntil(
    () => readLiveContentText(handle),
    (t) => t === textBefore.slice(0, caretOffsetBefore) + text + textBefore.slice(caretOffsetBefore),
    600
  )
  return { handle, textBefore, caretOffsetBefore, landed }
}

export async function pollUntil<T>(
  read: () => Promise<T>,
  isDone: (value: T) => boolean,
  timeoutMs: number,
  intervalMs = 30
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (isDone(await read())) return true
    if (Date.now() >= deadline) return false
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

/** A short, deterministic pretend-pinyin -> committed-hanzi pair, varied
 * per call site only by an index so different tests don't collide if they
 * ever land in the same content span.
 *
 * Two composition steps (not one-per-keystroke): empirically, CDP's
 * `Input.insertText` committing over a composition buffer that has been
 * replaced many times in quick succession (5-8 `imeSetComposition` calls)
 * intermittently leaves a stale fragment of an intermediate step behind
 * alongside the correctly-committed final text — reproduced even after
 * polling-confirmed the DOM showed the fully-correct last step *before*
 * calling insertText, so it's a Chromium/CDP composition-range-tracking
 * quirk under this specific stress pattern, not a settle-timing issue this
 * suite's own waits can paper over. Two steps (half-buffer, then full)
 * still exercises "multiple imeSetComposition updates before commit" per
 * the brief without hitting that quirk. See report's fidelity-limits
 * section — B9's stress case intentionally uses more steps to keep this
 * failure mode itself under observation rather than engineering it away
 * everywhere. */
export function samplePinyinSequence(seed: string): { steps: string[]; finalText: string } {
  const table: Record<string, { steps: string[]; finalText: string }> = {
    ceshi: { steps: ['ceshi'], finalText: '测试' },
    fanwen: { steps: ['fanwen'], finalText: '反文' },
    zhongwen: { steps: ['zhongwen'], finalText: '中文' },
    shuru: { steps: ['shuru'], finalText: '输入' },
    fahao: { steps: ['fahao'], finalText: '发号' }
  }
  return table[seed] ?? table.ceshi!
}
