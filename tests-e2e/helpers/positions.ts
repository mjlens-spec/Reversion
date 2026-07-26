// Matrix A position registry (E3 execution brief §3.2) against
// fixtures/ime-matrix.md's MARK-* tokens.
import type { ElementHandle, Page } from '@playwright/test'
import { ACTIVE_ENGINE } from './engine-profile'
import { EDITOR_SELECTOR, getContentHandleAtSelection, placeCaretAtMarker, placeCaretAtMarkerNoClick } from './ime'

export type PositionKey =
  | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7' | 'A8' | 'A9' | 'A10' | 'A11' | 'A12' | 'A13' | 'A14'

export interface PositionSpec {
  key: PositionKey
  label: string
  /** Whether this position also has a manual-track (M) checklist item per §3.2's A+M column. */
  manualTrack: boolean
  /** Places the caret and returns the leaf content handle to compose into. */
  resolve(window: Page): Promise<ElementHandle<Element>>
}

const byMarker = (marker: string, edge: 'before' | 'after' = 'after') => (window: Page) =>
  placeCaretAtMarker(window, marker, edge)

export const POSITIONS: Record<PositionKey, PositionSpec> = {
  A1: {
    key: 'A1',
    label: '段落正文，句末追加',
    manualTrack: true,
    resolve: byMarker('MARK-A1-END', 'after')
  },
  A2: {
    key: 'A2',
    label: '段落正文，句中插入（前后均有中文）',
    manualTrack: true,
    // Cursor lands between the existing 中文 run and "MARK-A2-AFTER" — both
    // sides already have CJK text, matching "前后均有中文."
    resolve: byMarker('MARK-A2-BEFORE中文', 'after')
  },
  A3: {
    key: 'A3',
    label: '粗体/斜体范围内部',
    manualTrack: true,
    resolve: byMarker('MARK-A3-BOLD-TEXT', 'after')
  },
  A4: {
    key: 'A4',
    label: '行内代码内部（内容末尾，紧邻收尾反引号左侧）',
    manualTrack: true,
    resolve: byMarker('MARK-A4-CODE-TEXT', 'after')
  },
  A5: {
    key: 'A5',
    label: '行内公式边界（紧随公式之后，验证不误入公式）',
    manualTrack: false,
    resolve: byMarker('MARK-A5-AFTER-MATH', 'before')
  },
  A6: {
    key: 'A6',
    label: '链接文字内部',
    manualTrack: false,
    resolve: byMarker('MARK-A6-LINK-TEXT', 'after')
  },
  A7: {
    key: 'A7',
    label: '标题（H1–H3）行',
    manualTrack: true,
    resolve: byMarker('MARK-A7-HEADING', 'after')
  },
  A8: {
    key: 'A8',
    label: '无序列表项（代表 无序/有序/任务 三种）',
    manualTrack: false,
    resolve: byMarker('MARK-A8-UL-ITEM', 'after')
  },
  A9: {
    key: 'A9',
    label: '表格单元格',
    manualTrack: true,
    resolve: byMarker('MARK-A9-CELL-1', 'after')
  },
  A10: {
    key: 'A10',
    label: '代码块内部（对照上游 #4851）',
    manualTrack: true,
    resolve: byMarker('MARK-A10-CODE-LINE', 'after')
  },
  A11: {
    key: 'A11',
    label: '引用块内部',
    manualTrack: false,
    resolve: byMarker('MARK-A11-QUOTE-TEXT', 'after')
  },
  A12: {
    key: 'A12',
    label: '文档末尾空段落（Enter 后新建的空段落）',
    manualTrack: false,
    resolve: async (window: Page) => {
      await placeCaretAtMarker(window, 'MARK-A12-LAST-LINE', 'after')
      await window.keyboard.press('Enter')
      return getContentHandleAtSelection(window)
    }
  },
  A13: {
    key: 'A13',
    label: '代码块语言输入框（legacy .ag-language-input / muya2 .mu-language-input）',
    manualTrack: false,
    resolve: async (window: Page) => {
      // The language box (legacy `.ag-language-input` / muya2
      // `.mu-language-input`) is only rendered visible (non-zero-size) once
      // its fence is the active block — click into the fence's CODE
      // CONTENT first (a marker that's visible from the start) to
      // activate it, then place the caret in the now-visible language
      // box without going through a second `.click()` (which would fail
      // Playwright's actionability/visibility check if fired too early).
      await window
        .locator(EDITOR_SELECTOR)
        .getByText(ACTIVE_ENGINE.languageInput.activateByText, { exact: false })
        .first()
        .click()
      await window.waitForTimeout(100)
      return placeCaretAtMarkerNoClick(window, 'markathirteenlang', 'after')
    }
  },
  A14: {
    key: 'A14',
    label: 'HTML 块内部',
    manualTrack: false,
    resolve: async (window: Page) => {
      // An HTML block renders as a non-editable preview (legacy
      // `.ag-html-preview` / muya2 `.mu-html-preview`) by default; the
      // editable raw-source view is zero-size until toggled via the block's
      // container icon (legacy: eventHandler/clickEvent.js matches
      // `.ag-container-icon` and calls
      // `contentState.handleContainerBlockClick(...)`). Both the preview
      // selector and the icon's relative XPath come from the active engine
      // profile; a profile may set `revealIconXPath: null` for an engine
      // where no toggle is needed.
      const { previewSelector, revealIconXPath, focusByText, sourceScopeSelector } =
        ACTIVE_ENGINE.htmlBlock
      if (revealIconXPath) {
        const preview = window
          .locator(EDITOR_SELECTOR)
          .locator(previewSelector, { hasText: 'MARK-A14-HTML-TEXT' })
          .first()
        const icon = preview.locator(revealIconXPath).first()
        // The edit icon is only revealed on hover (opacity/visibility CSS),
        // so hover the figure first; if it's still not "visible" per
        // Playwright's actionability check, force the click through.
        await preview.hover()
        await window.waitForTimeout(100)
        await icon.click({ force: true })
        await window.waitForTimeout(150)
      } else if (focusByText) {
        // No toggle affordance on this engine: the raw-source node is always
        // in the DOM but zero-size until its block is active, and "active"
        // follows the selection. So give the editor real DOM focus by
        // clicking a visible neighbour, then let the scoped Range placement
        // below both reveal the block and land the caret.
        await window
          .locator(EDITOR_SELECTOR)
          .getByText(focusByText, { exact: false })
          .first()
          .click()
        await window.waitForTimeout(120)
      }
      return placeCaretAtMarkerNoClick(window, 'MARK-A14-HTML-TEXT', 'after', sourceScopeSelector)
    }
  }
}

/** The 4 positions matrix B's interruption operations run against (§3.3). */
export const MATRIX_B_POSITIONS: PositionKey[] = ['A1', 'A3', 'A9', 'A10']

/**
 * §3.2's A3/A4 rows call for coverage of both the interior AND "边界前后 1
 * 字符" (the boundary ±1 character) of the styled range. POSITIONS.A3/A4
 * above cover the interior; these two cover composing immediately after
 * the range closes (back in plain paragraph text).
 */
export const A3_BOUNDARY_AFTER: PositionSpec = {
  key: 'A3',
  label: '粗体范围边界（紧随 ** 之后 1 字符，回到普通段落文本）',
  manualTrack: true,
  resolve: byMarker('MARK-A3-AFTER-BOLD', 'after')
}

export const A4_BOUNDARY_AFTER: PositionSpec = {
  key: 'A4',
  label: '行内代码边界（紧随反引号之后 1 字符，回到普通段落文本）',
  manualTrack: true,
  resolve: byMarker('MARK-A4-AFTER-CODE', 'after')
}
