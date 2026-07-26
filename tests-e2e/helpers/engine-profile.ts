// E3 task 2 — engine locating profile.
//
// The IME matrix suite has to run unchanged against two editor engines with
// disjoint DOM vocabularies:
//
//   legacy  `packages/muyajs` (@marktext/muyajs, snabbdom) — the engine
//           Reversion's v0.19.1 fork actually ships. One big
//           `contenteditable` region (`#ag-editor-id`); the addressable leaf
//           is whichever ancestor carries an `ag-*-content` / `ag-atx-line`
//           class.
//   muya2   `packages/muya` (@muyajs/core, TypeScript rewrite) — what
//           upstream's desktop app runs from `efcaf0c2` onward, i.e. what
//           v0.20.0-rc.1 ships. `muya.ts::getContainer()` REPLACES the
//           host element with a new div that keeps the host's attributes
//           (so `.editor-component` survives) and adds `mu-editor` +
//           `contenteditable`. Every content block is ALSO its own
//           `contenteditable` span carrying `mu-content` plus a specific
//           `mu-*-content` class (`block/base/content.ts` sets
//           `classList = ['mu-content']`, each subclass appends its own).
//
// This file is deliberately DATA ONLY — selectors and the couple of
// per-position DOM affordances that differ (how the code-fence language box
// and the HTML block's raw-source view are reached). No assertion logic, no
// composition logic, no expectations live here; `ime.ts` / `positions.ts`
// read from the active profile and are otherwise untouched. That keeps the
// graded matrix cells and their assertions identical across both engines,
// which is the whole point of a same-matrix comparison.
//
// Selected with REVERSION_IME_ENGINE=legacy|muya2 (default: legacy, so a
// plain `npm run test:e2e:ime` behaves exactly as task 1 shipped it).

export type EngineId = 'legacy' | 'muya2'

export interface EngineProfile {
  id: EngineId
  /** Human-readable engine label for report/JSON output. */
  label: string
  /** Editor root. Every marker lookup and document-wide read is scoped here. */
  editorSelector: string
  /**
   * Union selector for the "leaf content" node a composition happens
   * inside — the unit the interruption probe observes and the unit whose
   * `textContent` the assertions read. Must match exactly one ancestor of
   * any marker text node.
   */
  leafContentSelector: string
  /** What `ime-app-lifecycle.ts` waits for before declaring the app ready. */
  readySelector: string
  /** Heading elements used by matrix B4 as its "click somewhere else" target. */
  clickAwaySelector: string
  /** A13 — the code-fence language input box. */
  languageInput: {
    /** The language-box element itself (for existence checks). */
    selector: string
    /**
     * Visible text inside the SAME fence's body, clicked first to make the
     * fence the active block (the language box is zero-size until then, so
     * Playwright's actionability check on it can never pass on its own).
     */
    activateByText: string
  }
  /** A14 — the raw HTML block. */
  htmlBlock: {
    /** The non-editable rendered preview shown while the block is inactive. */
    previewSelector: string
    /**
     * The affordance that toggles the block from preview to editable raw
     * source, expressed as an XPath relative to the preview node. `null`
     * means this engine has no such toggle.
     */
    revealIconXPath: string | null
    /**
     * Visible text elsewhere in the document to click first, purely to give
     * the editor DOM focus before the caret is placed by Range API. Needed
     * where the raw-source node is present but zero-size until the block is
     * active (so it can never be clicked directly), and there is no toggle
     * icon to click either. `null` where `revealIconXPath` handles it.
     */
    focusByText: string | null
    /**
     * Scope for the A14 marker lookup. The marker text exists TWICE in an
     * HTML block — once in the rendered preview, once in the raw source —
     * and only the source copy is editable, so whichever appears first in
     * document order decides what an unscoped lookup finds. Legacy muyajs
     * emits `pre > code > span.ag-code-content` before the preview div, so no
     * scope is needed; muya v2's `HTMLBlock.create()` calls
     * `appendAttachment(htmlPreview)` before `append(htmlContainer)`, putting
     * the preview first — so the lookup MUST be scoped to the source
     * container there or it silently lands in the non-editable preview.
     */
    sourceScopeSelector: string | null
  }
}

const LEGACY: EngineProfile = {
  id: 'legacy',
  label: 'legacy muyajs (Reversion 1.2.0-beta.2 / v0.19.1 fork)',
  editorSelector: '#ag-editor-id',
  leafContentSelector:
    '.ag-paragraph-content, .ag-cell-content, .ag-code-content, .ag-atx-line, .ag-language-input',
  readySelector: '#ag-editor-id',
  clickAwaySelector: '#ag-editor-id h1, #ag-editor-id h2',
  languageInput: {
    selector: '.ag-language-input',
    activateByText: 'A13 covers the code-fence'
  },
  htmlBlock: {
    previewSelector: '.ag-html-preview',
    revealIconXPath: 'xpath=preceding-sibling::*[contains(@class, "ag-container-icon")]',
    focusByText: null,
    sourceScopeSelector: null
  }
}

const MUYA2: EngineProfile = {
  id: 'muya2',
  label: 'muya v2 @muyajs/core (upstream v0.20.0-rc.1)',
  // `getContainer()` copies the host div's attributes onto its replacement,
  // so editor.vue's `class="editor-component"` survives and `mu-editor` is
  // added alongside it. Requiring both pins the match to the real editor
  // root rather than any other `.mu-editor`-styled node.
  editorSelector: '.editor-component.mu-editor',
  // Every Content subclass appends to the base `['mu-content']`, so this one
  // class covers paragraph / atx heading / setext heading / code block /
  // table cell / language input uniformly — the per-type classes
  // (`mu-paragraph-content`, `mu-codeblock-content`, `mu-table-cell-content`,
  // `mu-atxheading-content`, `mu-language-input`) are listed after it so a
  // future base-class rename degrades to a partial match instead of matching
  // nothing.
  leafContentSelector:
    '.mu-content, .mu-paragraph-content, .mu-atxheading-content, .mu-setextheading-content,'
    + ' .mu-codeblock-content, .mu-table-cell-content, .mu-language-input',
  readySelector: '.editor-component.mu-editor',
  clickAwaySelector: '.editor-component.mu-editor h1, .editor-component.mu-editor h2',
  languageInput: {
    selector: '.mu-language-input',
    // Same gating as legacy: blockSyntax.css only gives the language box a
    // size under `.mu-code-block.mu-active`.
    activateByText: 'A13 covers the code-fence'
  },
  htmlBlock: {
    previewSelector: '.mu-html-preview',
    // muya v2 has no container-icon affordance at all (confirmed against the
    // running v0.20.0-rc.1 build: 0 matches for any `mu-container-icon`).
    // Preview-vs-source is driven purely by `figure.mu-html-block.mu-active`,
    // and `mu-active` follows which content block holds the selection
    // (`block/scrollPage/index.ts` sets `b.active` from blur/focus) — so
    // placing the caret in the source IS the reveal action.
    revealIconXPath: null,
    focusByText: 'MARK-B13-BASE',
    sourceScopeSelector: '.mu-html-container'
  }
}

const PROFILES: Record<EngineId, EngineProfile> = { legacy: LEGACY, muya2: MUYA2 }

export function engineIdFromEnv(): EngineId {
  const raw = process.env.REVERSION_IME_ENGINE
  if (!raw) return 'legacy'
  if (raw !== 'legacy' && raw !== 'muya2') {
    throw new Error(
      `REVERSION_IME_ENGINE must be 'legacy' or 'muya2' (got '${raw}'). ` +
        'See tests-e2e/helpers/engine-profile.ts.'
    )
  }
  return raw
}

export const ACTIVE_ENGINE: EngineProfile = PROFILES[engineIdFromEnv()]

export function profileFor(id: EngineId): EngineProfile {
  return PROFILES[id]
}
