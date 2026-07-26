/**
 * Typora → Reversion theme transpiler — pipeline orchestration.
 *
 * 六层 pipeline（规格 §6）：
 *   1. variable-extractor   extract-variables.mjs
 *   2. variable-mapper      map-variables.mjs
 *   3. selector-rewriter    rewrite-selectors.mjs   （两路并行：编辑器 / 导出）
 *   4. stripper             strip-rules.mjs         （按规格先于 3 跑）
 *   5. font-slot-injector   inject-font-slots.mjs
 *   6. report-generator     generate-report.mjs
 *
 * 映射数据一律来自 scripts/typora-map/*.mjs，本文件不含任何映射项。
 */

import postcss from 'postcss'

import { extractVariables, collectVariableReferences, findVarReferences } from './extract-variables.mjs'
import { flatten } from './css-ir.mjs'
import { stripRules } from './strip-rules.mjs'
import { mapVariables, rewriteValue } from './map-variables.mjs'
import { rewriteRules } from './rewrite-selectors.mjs'
import { captureFontStacks, buildFontSlots, applyFontRoles, contentRootFontRule, fontAnchorRules } from './inject-font-slots.mjs'
import { renderEditorTheme, renderExportTheme, buildPrintBlock } from './render-css.mjs'
import { generateReport } from './generate-report.mjs'
import { camelToKebabVar } from '../typora-map/variables.mjs'

export function normaliseNamespace (themeName) {
  const ns = String(themeName).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (!ns) throw new Error(`Invalid theme name: ${themeName}`)
  return ns
}

/**
 * @param {string} css Typora theme source
 * @param {{themeName:string, namespace?:string, sourcePath?:string, important?:boolean, now?:string}} options
 */
export function translateTyporaTheme (css, options) {
  const themeName = options.themeName
  const namespace = options.namespace || normaliseNamespace(themeName)
  const important = options.important !== false
  const generatedAt = options.now || new Date().toISOString().slice(0, 10)

  const root = postcss.parse(css)

  // ── layer 1: variable-extractor ─────────────────────────────────────────
  const extracted = extractVariables(root)

  // ── IR + layer 4: stripper（规格要求先于 selector-rewriter） ────────────
  const ir = flatten(root)
  const { kept, stripped, manualReview } = stripRules(ir.rules)

  // Variable references surviving the strip pass decide 直通 vs 丢弃.
  const survivingRefs = new Map()
  for (const rule of kept) {
    for (const decl of rule.decls) {
      for (const name of findVarReferences(decl.value)) {
        survivingRefs.set(name, (survivingRefs.get(name) || 0) + 1)
      }
    }
  }
  for (const [name, count] of collectVariableReferences(root)) {
    if (!survivingRefs.has(name) && extracted.values.has(name)) {
      // referenced only from :root itself (variable chaining) — keep it alive
      const fromRootOnly = [...extracted.values.values()].some((v) => findVarReferences(v).includes(name))
      if (fromRootOnly) survivingRefs.set(name, count)
    }
  }

  // ── layer 2: variable-mapper ────────────────────────────────────────────
  const variables = mapVariables(extracted, survivingRefs, { namespace })

  // Rewrite every var() reference in the surviving rules.
  const rewritten = kept.map((rule) => ({
    ...rule,
    decls: rule.decls.map((decl) => ({ ...decl, value: rewriteValue(decl.value, variables.rewrites) }))
  }))

  // ── layer 5 (part 1): font stacks ───────────────────────────────────────
  const capturedRaw = captureFontStacks(kept)
  const captured = {
    body: capturedRaw.body ? rewriteValue(capturedRaw.body, variables.rewrites) : null,
    heading: capturedRaw.heading ? rewriteValue(capturedRaw.heading, variables.rewrites) : null,
    mono: capturedRaw.mono ? rewriteValue(capturedRaw.mono, variables.rewrites) : null
  }
  const fonts = buildFontSlots({ namespace, themeVars: variables.themeVars, captured, rewrites: variables.rewrites })

  // ── layer 3: selector-rewriter（两路并行） ──────────────────────────────
  const editor = rewriteRules(rewritten, 'editor')
  const exportTarget = rewriteRules(rewritten, 'export')

  // ── layer 5 (part 2): font role wiring ──────────────────────────────────
  const editorRules = [
    contentRootFontRule('editor', fonts.stacks),
    ...fontAnchorRules('editor', fonts.stacks),
    ...applyFontRoles(editor.rules, 'editor', fonts.stacks)
  ]
  const exportRules = [
    contentRootFontRule('export', fonts.stacks),
    ...fontAnchorRules('export', fonts.stacks),
    ...applyFontRoles(exportTarget.rules, 'export', fonts.stacks)
  ]

  // Captured MarkText variables (e.g. #write{max-width} → --editorAreaWidth, hr → --hrColor).
  const capturedVarDecls = []
  const seenCaptured = new Set()
  for (const captureEntry of editor.capturedVars) {
    if (!captureEntry.marktext || seenCaptured.has(captureEntry.marktext)) continue
    seenCaptured.add(captureEntry.marktext)
    capturedVarDecls.push({ name: `--${captureEntry.marktext}`, value: captureEntry.value })
    const kebab = `--${camelToKebabVar(captureEntry.marktext)}`
    if (kebab !== `--${captureEntry.marktext}`) capturedVarDecls.push({ name: kebab, value: `var(--${captureEntry.marktext})` })
  }

  const themeVarDecls = [...variables.themeVars, ...fonts.extraVars].map(({ name, value }) => ({ name, value }))

  const banner = (kind) => [
    `/* ${themeName} — Reversion ${kind}`,
    ` * 由 scripts/import-typora-theme.mjs 从 Typora 主题自动转译生成，请勿手工编辑；`,
    ` * 需要调整请改源主题或映射表（scripts/typora-map/*.mjs）后重新生成。`,
    options.sourcePath ? ` * 源文件：${options.sourcePath}` : null,
    ` * 生成时间：${generatedAt}`,
    ' */'
  ].filter(Boolean).join('\n')

  const editorCss = renderEditorTheme({
    banner: banner('编辑器主题'),
    imports: ir.imports,
    atRules: ir.atRules,
    varGroups: [
      { title: '主题调色板（来自 Typora 变量）', decls: themeVarDecls },
      { title: '阅读字体槽位（规格 §1.3）', decls: fonts.slotDecls },
      { title: 'MarkText/muya 变量（骆峰层）', decls: [...variables.marktextVars, ...capturedVarDecls.filter((d) => !/^--[a-z0-9]+(-[a-z0-9]+)+$/.test(d.name))] },
      { title: 'kebab-case 别名层（规格 §1.4）', decls: [...variables.kebabVars, ...capturedVarDecls.filter((d) => /^--[a-z0-9]+(-[a-z0-9]+)+$/.test(d.name))] }
    ],
    rules: editorRules,
    important
  })

  const exportCss = renderExportTheme({
    banner: banner('导出主题'),
    imports: [...ir.imports, ...ir.includeWhenExport],
    atRules: ir.atRules,
    varGroups: [
      { title: '主题调色板（来自 Typora 变量）', decls: themeVarDecls },
      { title: '阅读字体槽位（规格 §1.3）', decls: fonts.slotDecls }
    ],
    rules: exportRules,
    printBlock: buildPrintBlock()
  })

  const stats = buildStats({ ir, kept, stripped, editor, exportTarget, variables, extracted })

  const report = generateReport({
    themeName,
    sourcePath: options.sourcePath || '(inline)',
    namespace,
    stats,
    variables,
    stripped,
    manualReview,
    editor,
    exportTarget,
    fontDecisions: fonts.decisions,
    includeWhenExport: ir.includeWhenExport,
    unsupportedAtRules: ir.unsupportedAtRules,
    generatedAt
  })

  return { editorCss, exportCss, report, stats, variables, editor, exportTarget, stripped, manualReview, fonts, ir }
}

function buildStats ({ ir, kept, stripped, editor, exportTarget, variables, extracted }) {
  const sourceSelectors = ir.rules.reduce((sum, rule) => sum + rule.selectors.length, 0)
  const strippedSelectors = stripped.reduce((sum, entry) => sum + entry.selectors.length, 0)
  const translatable = kept.reduce((sum, rule) => sum + rule.selectors.length, 0)

  const failed = (result) => new Set([...result.unmapped, ...result.targetUnsupported].map((r) => r.selector))
  const editorFailed = failed(editor)
  const exportFailed = failed(exportTarget)

  const allSelectors = new Set()
  for (const rule of kept) for (const selector of rule.selectors) allSelectors.add(selector)

  let editorMapped = 0
  let exportMapped = 0
  let bothMapped = 0
  let eitherMapped = 0
  let neitherMapped = 0
  for (const rule of kept) {
    for (const selector of rule.selectors) {
      const inEditor = !editorFailed.has(selector)
      const inExport = !exportFailed.has(selector)
      if (inEditor) editorMapped += 1
      if (inExport) exportMapped += 1
      if (inEditor && inExport) bothMapped += 1
      if (inEditor || inExport) eitherMapped += 1
      else neitherMapped += 1
    }
  }

  const byStrategy = (predicate) => variables.entries.filter(predicate).length

  return {
    sourceRules: ir.rules.length,
    sourceSelectors,
    strippedSelectors,
    translatable,
    editorMapped,
    exportMapped,
    bothMapped,
    eitherMapped,
    neitherMapped,
    distinctSelectors: allSelectors.size,
    sourceVariables: extracted.order.length,
    mappedVariables: byStrategy((e) => ['theme-var', 'syntax', 'font', 'merge'].includes(e.strategy)),
    passthroughVariables: byStrategy((e) => e.strategy === 'passthrough'),
    droppedVariables: byStrategy((e) => e.strategy === 'drop' || e.strategy === 'drop-unused')
  }
}
