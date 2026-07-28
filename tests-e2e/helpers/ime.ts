// E3 task 1 — IME composition simulator.
//
// Drives real DOM `compositionstart`/`compositionupdate`/`compositionend`
// events through Chrome DevTools Protocol's `Input.imeSetComposition` /
// `Input.insertText`, exactly the way a real IME engine talks to the
// renderer (confirmed empirically — see the report's "known fidelity
// limits" section for what this does *not* cover: candidate-window UI,
// system-level key interception).
//
// DOM layout note (from the running app, not guessed): Reversion's editor
// (`packages/muyajs`, the legacy JS engine actually wired into desktop —
// `packages/muya` is an unused TS rewrite, see upstream/marktext/CLAUDE.md)
// renders ONE big `contenteditable` region (`.editor-component`) — there is
// no per-block `contenteditable` boundary. The addressable "leaf content"
// unit is the nearest ancestor carrying one of the `ag-*-content` /
// `ag-atx-line` classes (paragraph text, table cell, code block, heading
// line). All position/selection helpers below key off that.
//
// E3 task 2: the two selectors below no longer hard-code the legacy `ag-*`
// vocabulary — they come from the active engine locating profile
// (helpers/engine-profile.ts, selected with REVERSION_IME_ENGINE) so the
// same matrix can be pointed at upstream's `mu-*` engine without touching a
// single assertion. Default is `legacy`, so behavior is unchanged from what
// task 1 shipped.
import type { CDPSession, ElementHandle, Page } from '@playwright/test'
import { ACTIVE_ENGINE } from './engine-profile'

export const EDITOR_SELECTOR = ACTIVE_ENGINE.editorSelector
export const LEAF_CONTENT_SELECTOR = ACTIVE_ENGINE.leafContentSelector

export type CaretEdge = 'before' | 'after'

/**
 * Click into the paragraph/block containing `marker` (to give the shared
 * contenteditable region real focus), then collapse the DOM selection to
 * the exact character offset immediately before/after `marker` via the
 * Range API. Returns the ElementHandle of the enclosing leaf content span,
 * which callers use both to read text back out and to scope the
 * interruption probe (see `startInterruptionProbe`).
 *
 * Why Range instead of counting arrow-key presses: precise, doesn't depend
 * on a block type's specific arrow-key handling (tables/code blocks
 * override it), and is a single round trip.
 */
export async function placeCaretAtMarker(
  window: Page,
  marker: string,
  edge: CaretEdge = 'after'
): Promise<ElementHandle<Element>> {
  const clickTarget = window.locator(EDITOR_SELECTOR).getByText(marker, { exact: false }).first()
  await clickTarget.scrollIntoViewIfNeeded()
  await clickTarget.click()

  // muyajs's Keyboard.dispatchEditorState() attaches a 'click' handler that
  // schedules `contentState.partialRender()` on a `setTimeout(fn, 0)` when
  // the click lands somewhere needing inline-format re-tokenizing (e.g.
  // near a bold/code/link boundary). Setting our precise Range immediately
  // after `click()` can race that macrotask: the render replaces the DOM
  // out from under a Range we already set, silently dropping the
  // selection. Waiting here (before, not after, the Range set) avoids
  // that — empirically eliminates a class of intermittent "selection ends
  // up nowhere" / composition-lands-in-the-wrong-place flakes that aren't
  // real product bugs.
  await window.waitForTimeout(100)

  const handle = await window.evaluateHandle(
    ({ marker, edge, editorSelector, leafSelector, engineId }) => {
      const container = document.querySelector(editorSelector)
      if (!container) throw new Error(`IME helper: editor root not found (${editorSelector})`)
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      let node: Text | null
      // eslint-disable-next-line no-cond-assign
      while ((node = walker.nextNode() as Text | null)) {
        const idx = node.data.indexOf(marker)
        if (idx === -1) continue
        const offset = edge === 'after' ? idx + marker.length : idx
        const range = document.createRange()
        range.setStart(node, offset)
        range.collapse(true)
        const sel = window.getSelection()
        if (!sel) throw new Error('IME helper: window.getSelection() unavailable')
        sel.removeAllRanges()
        sel.addRange(range)
        const content = node.parentElement?.closest(leafSelector)
        if (!content) {
          throw new Error(`IME helper: marker "${marker}" has no leaf content ancestor matching ${leafSelector}`)
        }
        if (engineId === 'muya2') {
          const block = (content as unknown as {
            __MUYA_BLOCK__?: { text: string; setCursor(start: number, end: number, update: boolean): void }
          }).__MUYA_BLOCK__
          if (!block) throw new Error(`IME helper: marker "${marker}" has no Muya 2 block binding`)
          const modelIndex = block.text.indexOf(marker)
          if (modelIndex === -1) throw new Error(`IME helper: marker "${marker}" missing from Muya 2 model`)
          const modelOffset = edge === 'after' ? modelIndex + marker.length : modelIndex
          block.setCursor(modelOffset, modelOffset, true)
        }
        return content
      }
      throw new Error(`IME helper: marker not found in document: ${marker}`)
    },
    {
      marker,
      edge,
      editorSelector: EDITOR_SELECTOR,
      leafSelector: LEAF_CONTENT_SELECTOR,
      engineId: ACTIVE_ENGINE.id
    }
  )
  return handle.asElement() as ElementHandle<Element>
}

/**
 * Like `placeCaretAtMarker`, but skips the Playwright `.click()` on the
 * marker itself — for markers inside an element that's only made visible
 * (e.g. via a CSS active-state toggle) as a side effect of a PRIOR click
 * elsewhere. `.ag-language-input` (matrix A13, the code-fence language
 * box) is exactly this: hidden (zero-size, `offsetParent === null`) until
 * the fence is the active block, so Playwright's own actionability check
 * on it times out waiting for visibility that a raw `click()` on it will
 * never itself produce. Callers must already have focused the right block
 * (e.g. by clicking some other, visible part of it) before calling this.
 */
export async function placeCaretAtMarkerNoClick(
  window: Page,
  marker: string,
  edge: CaretEdge = 'after',
  /**
   * Narrows the marker search to the first element matching this selector
   * instead of the whole editor root. Needed when the SAME marker text
   * legitimately appears more than once and only one copy is editable — an
   * HTML block renders its content twice (rendered preview + raw source), and
   * which one an unscoped `TreeWalker` reaches first is an engine-specific
   * document-order accident. See `EngineProfile.htmlBlock.sourceScopeSelector`.
   */
  scopeSelector?: string | null
): Promise<ElementHandle<Element>> {
  const handle = await window.evaluateHandle(
    ({ marker, edge, editorSelector, leafSelector, scopeSelector, engineId }) => {
      const root = document.querySelector(editorSelector)
      if (!root) throw new Error(`IME helper: editor root not found (${editorSelector})`)
      const container = scopeSelector ? root.querySelector(scopeSelector) : root
      if (!container) {
        throw new Error(`IME helper: lookup scope not found under the editor root (${scopeSelector})`)
      }
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      let node: Text | null
      // eslint-disable-next-line no-cond-assign
      while ((node = walker.nextNode() as Text | null)) {
        const idx = node.data.indexOf(marker)
        if (idx === -1) continue
        const offset = edge === 'after' ? idx + marker.length : idx
        const range = document.createRange()
        range.setStart(node, offset)
        range.collapse(true)
        const sel = window.getSelection()
        if (!sel) throw new Error('IME helper: window.getSelection() unavailable')
        sel.removeAllRanges()
        sel.addRange(range)
        const content = node.parentElement?.closest(leafSelector)
        if (!content) {
          throw new Error(`IME helper: marker "${marker}" has no leaf content ancestor matching ${leafSelector}`)
        }
        if (engineId === 'muya2') {
          const block = (content as unknown as {
            __MUYA_BLOCK__?: { text: string; setCursor(start: number, end: number, update: boolean): void }
          }).__MUYA_BLOCK__
          if (!block) throw new Error(`IME helper: marker "${marker}" has no Muya 2 block binding`)
          const modelIndex = block.text.indexOf(marker)
          if (modelIndex === -1) throw new Error(`IME helper: marker "${marker}" missing from Muya 2 model`)
          const modelOffset = edge === 'after' ? modelIndex + marker.length : modelIndex
          block.setCursor(modelOffset, modelOffset, true)
        }
        return content
      }
      throw new Error(`IME helper: marker not found in document: ${marker}`)
    },
    {
      marker,
      edge,
      editorSelector: EDITOR_SELECTOR,
      leafSelector: LEAF_CONTENT_SELECTOR,
      scopeSelector: scopeSelector ?? null,
      engineId: ACTIVE_ENGINE.id
    }
  )
  return handle.asElement() as ElementHandle<Element>
}

/** The leaf content span currently containing the live DOM selection (used
 * after a structural op like Enter creates a *new* block with no marker of
 * its own — e.g. matrix A12's "compose into the freshly created empty
 * paragraph"). */
export async function getContentHandleAtSelection(window: Page): Promise<ElementHandle<Element>> {
  const handle = await window.evaluateHandle(({ leafSelector }) => {
    const sel = window.getSelection()
    const anchor = sel?.anchorNode
    if (!anchor) throw new Error('IME helper: no live selection to resolve a content handle from')
    const el = anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as Element)
    const content = el?.closest(leafSelector)
    if (!content) throw new Error('IME helper: selection has no leaf content ancestor')
    return content
  }, { leafSelector: LEAF_CONTENT_SELECTOR })
  return handle.asElement() as ElementHandle<Element>
}

export async function readContentText(handle: ElementHandle<Element>): Promise<string> {
  return handle.evaluate((el, engineId) => {
    if (engineId === 'muya2') {
      const block = (el as unknown as { __MUYA_BLOCK__?: { text: string } }).__MUYA_BLOCK__
      if (block) return block.text
    }
    return el.textContent ?? ''
  }, ACTIVE_ENGINE.id)
}

/** Read the browser's live contenteditable text while an IME composition is
 * still open. Muya 2 deliberately keeps intermediate composition text out of
 * its persisted block model, so mid-composition polling must inspect the DOM.
 * Render-only math/ruby previews are removed to keep offsets in the same
 * logical Markdown coordinate system as the block model. */
export async function readLiveContentText(handle: ElementHandle<Element>): Promise<string> {
  return handle.evaluate((el, engineId) => {
    const clone = el.cloneNode(true) as Element
    const ignored =
      engineId === 'muya2'
        ? '.mu-math-render, .mu-ruby-render'
        : '.ag-math-render, .ag-ruby-render'
    clone.querySelectorAll(ignored).forEach((node) => node.remove())
    return clone.textContent ?? ''
  }, ACTIVE_ENGINE.id)
}

/** Character offset of the live caret within `handle`'s full text content
 * (flattened across its text-node descendants), or null if the current
 * selection isn't inside `handle` at all. Used for the "光标落点正确"
 * assertion leg. */
export async function getCaretOffsetInContent(
  window: Page,
  handle: ElementHandle<Element>
): Promise<number | null> {
  return window.evaluate(({ content, engineId }) => {
    if (engineId === 'muya2') {
      const block = (content as unknown as {
        __MUYA_BLOCK__?: { getCursor(): { start: { offset: number } } | null }
      }).__MUYA_BLOCK__
      return block?.getCursor()?.start.offset ?? null
    }
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    if (!content.contains(range.startContainer)) return null
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
    let total = 0
    let node: Text | null
    // eslint-disable-next-line no-cond-assign
    while ((node = walker.nextNode() as Text | null)) {
      if (node === range.startContainer) return total + range.startOffset
      total += node.data.length
    }
    return null
  }, { content: handle, engineId: ACTIVE_ENGINE.id })
}

// ---------------------------------------------------------------------------
// Composition primitives (CDP)
// ---------------------------------------------------------------------------

export async function getCdpSession(app: { context(): { newCDPSession(page: Page): Promise<CDPSession> } }, window: Page): Promise<CDPSession> {
  return app.context().newCDPSession(window)
}

/**
 * Feed a sequence of growing composition strings through
 * `Input.imeSetComposition` — the CDP equivalent of an IME engine posting
 * successive candidate-buffer updates (compositionupdate). Leaves the
 * composition ACTIVE (uncommitted) when it returns; caller must follow up
 * with `composeCommit` or `composeCancel`.
 */
export async function composeSteps(
  window: Page,
  cdp: CDPSession,
  steps: readonly string[],
  stepDelayMs = 60
): Promise<void> {
  for (const step of steps) {
    await cdp.send('Input.imeSetComposition', {
      text: step,
      selectionStart: step.length,
      selectionEnd: step.length
    })
    if (stepDelayMs > 0) await window.waitForTimeout(stepDelayMs)
  }
}

/** Commit the active composition with `finalText` (CDP `Input.insertText`
 * on an active composition fires compositionupdate(finalText) →
 * beforeinput/input → compositionend, i.e. a real IME commit sequence —
 * confirmed empirically, see report). */
export async function composeCommit(window: Page, cdp: CDPSession, finalText: string, settleMs = 80): Promise<void> {
  await cdp.send('Input.insertText', { text: finalText })
  if (settleMs > 0) await window.waitForTimeout(settleMs)
}

/** Cancel the active composition (Esc-equivalent from the CDP side): set
 * the composition buffer to empty. No text is inserted. */
export async function composeCancel(window: Page, cdp: CDPSession, settleMs = 80): Promise<void> {
  await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 })
  if (settleMs > 0) await window.waitForTimeout(settleMs)
}

/**
 * C2 voice-dictation approximation: successive `Input.insertText` calls
 * with NO active composition wrapper (macOS dictation finalizes recognized
 * phrases directly, it doesn't drive the IME candidate-buffer protocol),
 * separated by randomized 50–200ms gaps mimicking speech-recognition
 * segment boundaries.
 */
export async function burstInsert(
  window: Page,
  cdp: CDPSession,
  chunks: readonly string[],
  gapRangeMs: readonly [number, number] = [50, 200]
): Promise<void> {
  const [min, max] = gapRangeMs
  for (const chunk of chunks) {
    await cdp.send('Input.insertText', { text: chunk })
    const gap = min + Math.random() * (max - min)
    await window.waitForTimeout(gap)
  }
}

// ---------------------------------------------------------------------------
// Interruption probe ("组合期间无渲染打断")
// ---------------------------------------------------------------------------
//
// A composing IME only ever mutates the underlying text node's
// `characterData` (that's how the browser shows uncommitted candidate
// text natively in a contenteditable). Any `childList` mutation on the
// leaf content span while composition is still logically in flight means
// something re-rendered that block's DOM out from under the composition —
// exactly the class of bug upstream #4851 describes for code blocks.
// `MutationObserver.takeRecords()` gives a synchronous drain point so we
// can snapshot "what happened structurally so far" at any moment we
// choose (right before committing/cancelling), rather than racing the
// async callback against the app's own legitimate post-commit re-render.

export interface InterruptionEvidence {
  interrupted: boolean
  mutations: Array<{ type: string; added: number; removed: number }>
}

declare global {
  interface Window {
    __imeProbe?: { log: Array<{ type: string; added: number; removed: number }> }
    __imeProbeObserver?: MutationObserver
  }
}

export async function startInterruptionProbe(window: Page, handle: ElementHandle<Element>): Promise<void> {
  await window.evaluate((el) => {
    window.__imeProbe = { log: [] }
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        window.__imeProbe!.log.push({ type: r.type, added: r.addedNodes.length, removed: r.removedNodes.length })
      }
    })
    mo.observe(el, { childList: true, subtree: true, characterData: false, attributes: false })
    window.__imeProbeObserver = mo
  }, handle)
}

/** Drain whatever structural mutations have been recorded on the probed
 * node SO FAR (and reset the log) — call this right before every CDP call
 * that ends/commits a composition, to attribute mutations to "during
 * composition" vs "as part of committing." */
export async function drainInterruptionEvidence(window: Page): Promise<InterruptionEvidence> {
  return window.evaluate(() => {
    const probe = window.__imeProbe
    const observer = window.__imeProbeObserver
    const pending = observer ? observer.takeRecords() : []
    const combined = [
      ...(probe?.log ?? []),
      ...pending.map((r) => ({ type: r.type, added: r.addedNodes.length, removed: r.removedNodes.length }))
    ]
    if (probe) probe.log = []
    const structural = combined.filter((m) => m.type === 'childList')
    return { interrupted: structural.length > 0, mutations: combined }
  })
}

export async function stopInterruptionProbe(window: Page): Promise<void> {
  await window.evaluate(() => {
    window.__imeProbeObserver?.disconnect()
    delete window.__imeProbeObserver
    delete window.__imeProbe
  })
}
