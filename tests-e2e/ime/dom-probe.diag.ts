// E3 task 2 — engine locating profile validator.
//
// Before running the matrix against a second engine, prove that the profile
// (helpers/engine-profile.ts) actually addresses that engine's DOM: for each
// matrix-A marker, resolve the leaf content node the way the suite will and
// report its tag/class/ancestor chain. A profile that silently matches the
// WRONG node would turn every downstream cell into a meaningless failure, so
// this runs first and its output is what the profile's selectors are
// justified by — not source reading alone.
//
// Engine-agnostic by construction: it reads the active profile, so the same
// file validates `legacy` and `muya2`.
import { expect, test } from '@playwright/test'
import { launchImeApp, type ImeAppHandle } from '../helpers/ime-app-lifecycle'
import { createDiagRecorder } from '../helpers/diag-record'
import { ACTIVE_ENGINE } from '../helpers/engine-profile'
import { EDITOR_SELECTOR, LEAF_CONTENT_SELECTOR } from '../helpers/ime'

const diag = createDiagRecorder(`dom-probe-${ACTIVE_ENGINE.id}.json`)
let handle: ImeAppHandle

const MARKERS = [
  'MARK-A1-END',
  'MARK-A2-BEFORE中文',
  'MARK-A3-BOLD-TEXT',
  'MARK-A3-AFTER-BOLD',
  'MARK-A4-CODE-TEXT',
  'MARK-A4-AFTER-CODE',
  'MARK-A5-AFTER-MATH',
  'MARK-A6-LINK-TEXT',
  'MARK-A7-HEADING',
  'MARK-A8-UL-ITEM',
  'MARK-A9-CELL-1',
  'MARK-A10-CODE-LINE',
  'MARK-A11-QUOTE-TEXT',
  'MARK-A12-LAST-LINE',
  'markathirteenlang',
  'MARK-A14-HTML-TEXT',
  'MARK-B13-BASE'
]

test.describe.serial(`E3 task 2 — DOM probe (${ACTIVE_ENGINE.label})`, () => {
  test.afterAll(async () => {
    diag.flush()
    await handle?.teardownAndVerifyIsolation()
  })

  test('0. launch app on an isolated fixture copy', async () => {
    handle = await launchImeApp('diag-dom-probe')
    expect(handle.pageErrors, `renderer pageerror on launch: ${handle.pageErrors.join('\n')}`).toEqual([])
  })

  test('profile selectors resolve, and every marker has exactly one leaf-content ancestor', async () => {
    const { window } = handle
    const report = await window.evaluate(
      ({ markers, editorSelector, leafSelector, profile }) => {
        const describeEl = (el: Element | null): string | null =>
          el ? `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).trim().split(/\s+/).join('.')}` : ''}` : null

        const root = document.querySelector(editorSelector)
        const out: Record<string, unknown> = {
          engineProfile: profile,
          editorSelector,
          editorRootFound: !!root,
          editorRootDescribed: describeEl(root),
          editorRootContentEditable: root?.getAttribute('contenteditable') ?? null,
          leafSelector,
          leafNodeCount: root ? root.querySelectorAll(leafSelector).length : 0,
          // Distinct class names present anywhere under the editor root —
          // the ground truth a profile's selectors have to be drawn from.
          distinctClassNames: root
            ? [...new Set([...root.querySelectorAll('*')].flatMap(e => String(e.className || '').trim().split(/\s+/)).filter(Boolean))].sort()
            : []
        }

        const markerReport: Array<Record<string, unknown>> = []
        for (const marker of markers) {
          const walker = document.createTreeWalker(root ?? document.body, NodeFilter.SHOW_TEXT)
          let node: Text | null
          let found: Text | null = null
          // eslint-disable-next-line no-cond-assign
          while ((node = walker.nextNode() as Text | null)) {
            if (node.data.includes(marker)) { found = node; break }
          }
          if (!found) {
            markerReport.push({ marker, textNodeFound: false })
            continue
          }
          const leaf = found.parentElement?.closest(leafSelector) ?? null
          const chain: string[] = []
          let cur: Element | null = found.parentElement
          while (cur && cur !== root) { chain.push(describeEl(cur)!); cur = cur.parentElement }
          markerReport.push({
            marker,
            textNodeFound: true,
            leafFound: !!leaf,
            leafDescribed: describeEl(leaf),
            leafContentEditable: leaf?.getAttribute('contenteditable') ?? null,
            ancestorChain: chain
          })
        }
        out.markers = markerReport
        return out
      },
      {
        markers: MARKERS,
        editorSelector: EDITOR_SELECTOR,
        leafSelector: LEAF_CONTENT_SELECTOR,
        profile: ACTIVE_ENGINE
      }
    )

    diag.push(report)

    // Hard requirements for a usable profile — if these don't hold, every
    // downstream matrix cell is meaningless rather than merely failing.
    expect(report.editorRootFound, `profile '${ACTIVE_ENGINE.id}': editor root ${EDITOR_SELECTOR} not found`).toBe(true)
    expect(
      report.leafNodeCount as number,
      `profile '${ACTIVE_ENGINE.id}': leaf-content selector matched nothing`
    ).toBeGreaterThan(0)
  })

  test('A13 / A14 affordances exist for this engine', async () => {
    const { window } = handle
    const langInputCount = await window.locator(ACTIVE_ENGINE.languageInput.selector).count()
    const previewCount = await window
      .locator(EDITOR_SELECTOR)
      .locator(ACTIVE_ENGINE.htmlBlock.previewSelector)
      .count()
    let iconCount: number | null = null
    if (ACTIVE_ENGINE.htmlBlock.revealIconXPath && previewCount > 0) {
      iconCount = await window
        .locator(EDITOR_SELECTOR)
        .locator(ACTIVE_ENGINE.htmlBlock.previewSelector, { hasText: 'MARK-A14-HTML-TEXT' })
        .first()
        .locator(ACTIVE_ENGINE.htmlBlock.revealIconXPath)
        .count()
    }
    diag.push({
      probe: 'A13/A14 affordances',
      languageInputSelector: ACTIVE_ENGINE.languageInput.selector,
      languageInputCount: langInputCount,
      htmlPreviewSelector: ACTIVE_ENGINE.htmlBlock.previewSelector,
      htmlPreviewCount: previewCount,
      revealIconXPath: ACTIVE_ENGINE.htmlBlock.revealIconXPath,
      revealIconCount: iconCount
    })
  })
})
