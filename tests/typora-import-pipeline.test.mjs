/**
 * E2 任务 2 —— Typora 主题转译器：六层 pipeline 分层单测（fixture 驱动）。
 * 规格：outputs/E2任务1_Typora主题映射规格_Claude_260726.md
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import postcss from 'postcss'

import { extractVariables, findVarReferences } from '../scripts/typora-import/extract-variables.mjs'
import { flatten } from '../scripts/typora-import/css-ir.mjs'
import { stripRules } from '../scripts/typora-import/strip-rules.mjs'
import { mapVariables, rewriteValue } from '../scripts/typora-import/map-variables.mjs'
import { resolveSelector, rewriteRules } from '../scripts/typora-import/rewrite-selectors.mjs'
import { captureFontStacks, buildFontSlots, fontExpression, fontAnchorRules } from '../scripts/typora-import/inject-font-slots.mjs'
import { generateReport } from '../scripts/typora-import/generate-report.mjs'
import { splitSelectorList, splitCompounds, parseCompound, expandSelector } from '../scripts/typora-import/selector-syntax.mjs'
import { matchStripRule, STRIP_RULES } from '../scripts/typora-map/strip.mjs'
import { camelToKebabVar, canonicalVariableName, VARIABLE_MAP } from '../scripts/typora-map/variables.mjs'
import { TOKEN_MAP, ROOT_TARGETS } from '../scripts/typora-map/selectors.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixturePath = path.join(root, 'tests/typora-import-fixtures/sample-typora-theme.css')
const fixtureCss = fs.readFileSync(fixturePath, 'utf8')

const parsed = () => postcss.parse(fixtureCss, { from: fixturePath })

const NS = 'sample'

function pipelineUpToStrip () {
  const ast = parsed()
  const extracted = extractVariables(ast)
  const ir = flatten(ast)
  const stripped = stripRules(ir.rules)
  return { ast, extracted, ir, ...stripped }
}

function fullVariablePass () {
  const { extracted, kept } = pipelineUpToStrip()
  const refs = new Map()
  for (const rule of kept) {
    for (const decl of rule.decls) {
      for (const name of findVarReferences(decl.value)) refs.set(name, (refs.get(name) || 0) + 1)
    }
  }
  return { extracted, kept, variables: mapVariables(extracted, refs, { namespace: NS }) }
}

// ── 选择器语法工具 ────────────────────────────────────────────────────────
test('selector syntax: 顶层逗号切分与复合选择器拆解', () => {
  assert.deepEqual(splitSelectorList('a, b:not(.x, .y), c[d=","]'), ['a', 'b:not(.x, .y)', 'c[d=","]'])

  const { compounds, combinators } = splitCompounds('#write   >   ul:first-child   li')
  assert.deepEqual(compounds, ['#write', 'ul:first-child', 'li'])
  assert.deepEqual(combinators, ['>', ''])

  const compound = parseCompound('li.mu-list-item[data-x]:nth-child(2n)::before')
  assert.equal(compound.element, 'li')
  assert.deepEqual(compound.classes, ['.mu-list-item'])
  assert.deepEqual(compound.attrs, ['[data-x]'])
  assert.deepEqual(compound.pseudos, [':nth-child(2n)', '::before'])

  assert.deepEqual(expandSelector([['pre.a', 'pre.b'], ['code']], ['']), ['pre.a code', 'pre.b code'])
})

// ── layer 1: variable-extractor ───────────────────────────────────────────
test('layer 1 variable-extractor: 只读 :root，保留声明顺序', () => {
  const { extracted, ir } = pipelineUpToStrip()

  assert.equal(extracted.rootRules, 1)
  assert.equal(extracted.order[0], '--bg-color')
  assert.equal(extracted.order.at(-1), '--font-mono')
  assert.equal(extracted.values.get('--accent-color'), '#0066cc')
  assert.equal(extracted.values.size, 18)

  // :root 变量块不能泄漏进规则 IR
  assert.ok(!ir.rules.some((rule) => rule.selectors.includes(':root')))
  assert.deepEqual(findVarReferences('1px solid var(--a, var(--b))'), ['--a', '--b'])
})

// ── layer 4: stripper ─────────────────────────────────────────────────────
test('layer 4 stripper: Typora 专有 UI 与 @media print 被剥离，内容规则留存', () => {
  const { kept, stripped, manualReview } = pipelineUpToStrip()

  const strippedSelectors = stripped.flatMap((entry) => entry.selectors)
  assert.ok(strippedSelectors.includes('#file-library-list'))
  assert.ok(strippedSelectors.includes('.megamenu-content'))
  assert.ok(strippedSelectors.includes('.on-focus-mode blockquote'))
  assert.ok(strippedSelectors.includes('pre'), 'Typora 的 @media print 块整块剥离（规格 §4）')

  // 剥离原因必须随记录一起给出，供报告使用
  assert.ok(stripped.every((entry) => typeof entry.reason === 'string' && entry.reason.length > 0))

  // .on-focus-mode 走「需人工确认」通道而不是静默丢弃
  assert.equal(manualReview.length, 1)
  assert.match(manualReview[0].reason, /专注模式/)

  const keptSelectors = kept.flatMap((rule) => rule.selectors)
  for (const selector of ['blockquote', 'h1', '.md-fences', 'hr', 'mark', '#typora-sidebar']) {
    assert.ok(keptSelectors.includes(selector), `${selector} 不应被剥离`)
  }
})

test('layer 4 stripper: 剥离清单是纯数据，且不误伤内容选择器', () => {
  assert.ok(STRIP_RULES.every((rule) => rule.pattern instanceof RegExp && rule.id && rule.reason))
  for (const selector of ['h1', 'blockquote', 'table th', 'code', '.md-fences', 'hr', 'ul li::marker', 'a:hover', '#write']) {
    assert.equal(matchStripRule(selector), null, `${selector} 不应命中剥离清单`)
  }
  for (const selector of ['#outline-content', '.os-windows header', '.ty-preferences .btn', '.md-tag', '@media print']) {
    assert.notEqual(matchStripRule(selector), null, `${selector} 应命中剥离清单`)
  }
})

// ── layer 2: variable-mapper ──────────────────────────────────────────────
test('layer 2 variable-mapper: 三种策略 + 双层转发', () => {
  const { variables } = fullVariablePass()
  const byName = new Map(variables.entries.map((e) => [e.typoraName, e]))

  // 建变量 + 骆峰/kebab 双层转发（规格 §1.4）
  const bg = byName.get('--bg-color')
  assert.equal(bg.strategy, 'theme-var')
  assert.equal(bg.target, `--${NS}-bg`)
  assert.ok(bg.forwarded.includes('--editorBgColor'))
  assert.ok(variables.themeVars.some((v) => v.name === `--${NS}-bg` && v.value === '#ffffff'))
  assert.ok(variables.marktextVars.some((v) => v.name === '--editorBgColor' && v.value === `var(--${NS}-bg)`))
  assert.ok(variables.kebabVars.some((v) => v.name === '--editor-bg-color' && v.value === 'var(--editorBgColor)'))

  // 语法高亮变量化（规格 §7 问题 4：固定策略，不再硬编码字面值）
  const keyword = byName.get('--code-keyword-color')
  assert.equal(keyword.strategy, 'syntax')
  assert.equal(keyword.target, `--${NS}-code-keyword-color`)
  assert.ok(keyword.forwarded.includes('--codeKeywordColor'))
  assert.ok(variables.kebabVars.some((v) => v.name === '--code-keyword-color'))

  // 规格裁决丢弃
  assert.equal(byName.get('--window-bg-color').strategy, 'drop')
  assert.equal(byName.get('--table-alt-color').strategy, 'drop')
  assert.ok(!variables.themeVars.some((v) => v.name === `--${NS}-window`))

  // 并入策略：--code-border-color 并入 --border-color 的目标
  const codeBorder = byName.get('--code-border-color')
  assert.equal(codeBorder.strategy, 'merge')
  assert.equal(codeBorder.target, `--${NS}-line`)

  // 字体变量交给 font-slot-injector，但命名空间变量在这一层就落地
  assert.equal(byName.get('--font-body').strategy, 'font')
  assert.ok(variables.themeVars.some((v) => v.name === `--${NS}-font-mono`))
})

test('layer 2 variable-mapper: 别名机制与 kebab 推导', () => {
  assert.equal(canonicalVariableName('--primary-color'), '--accent-color')
  assert.equal(canonicalVariableName('--main-bg-color'), '--bg-color')
  assert.equal(canonicalVariableName('--not-a-known-var'), '--not-a-known-var')

  assert.equal(camelToKebabVar('editorBgColor'), 'editor-bg-color')
  assert.equal(camelToKebabVar('editorColor80'), 'editor-color-80')
  assert.equal(camelToKebabVar('hrColor'), 'hr-color')

  // 别名走到同一个映射条目
  const extracted = { order: ['--primary-color'], values: new Map([['--primary-color', '#ff0000']]) }
  const mapped = mapVariables(extracted, new Map(), { namespace: NS })
  assert.equal(mapped.entries[0].canonical, '--accent-color')
  assert.equal(mapped.entries[0].target, `--${NS}-accent`)
  assert.ok(mapped.marktextVars.some((v) => v.name === '--themeColor'))
})

test('layer 2 variable-mapper: 未收录变量按「被引用→直通 / 无引用→丢弃」分流', () => {
  const extracted = {
    order: ['--custom-used', '--custom-unused'],
    values: new Map([['--custom-used', '#123456'], ['--custom-unused', '#654321']])
  }
  const mapped = mapVariables(extracted, new Map([['--custom-used', 2]]), { namespace: NS })
  const byName = new Map(mapped.entries.map((e) => [e.typoraName, e]))

  assert.equal(byName.get('--custom-used').strategy, 'passthrough')
  assert.equal(byName.get('--custom-used').target, `--${NS}-custom-used`)
  assert.equal(byName.get('--custom-unused').strategy, 'drop-unused')
  assert.ok(!mapped.themeVars.some((v) => v.name === `--${NS}-custom-unused`))

  assert.equal(
    rewriteValue('1px solid var(--custom-used)', mapped.rewrites),
    `1px solid var(--${NS}-custom-used)`
  )
})

// ── layer 3: selector-rewriter ────────────────────────────────────────────
test('layer 3 selector-rewriter: 基础映射与两路根作用域', () => {
  assert.deepEqual(resolveSelector('h1', 'editor').selectors, ['.mu-editor .mu-container h1'])
  assert.deepEqual(resolveSelector('h1', 'export').selectors, ['.markdown-body h1'])
  assert.deepEqual(resolveSelector('blockquote', 'editor').selectors, ['.mu-editor .mu-container blockquote'])
  assert.deepEqual(resolveSelector('table th', 'editor').selectors, ['.mu-editor table.mu-table-inner th.mu-table-cell'])
  assert.deepEqual(resolveSelector('a:hover', 'editor').selectors, ['.mu-editor a.mu-inline-rule:hover'])
  assert.deepEqual(resolveSelector('strong', 'editor').selectors, ['.mu-editor strong.mu-inline-rule'])

  // #write 是根，不再额外加作用域
  assert.deepEqual(resolveSelector('#write', 'editor').selectors, [ROOT_TARGETS.editor])
  assert.deepEqual(resolveSelector('#write > ul:first-child', 'export').selectors, ['.markdown-body > ul:first-child'])

  // html/body → 应用壳层，不加作用域
  assert.deepEqual(resolveSelector('body', 'editor').selectors, ['body', '#app'])

  // 一对多展开
  assert.deepEqual(resolveSelector('.md-fences', 'editor').selectors, [
    '.mu-editor .mu-code-block',
    '.mu-editor .mu-indented-code'
  ])
})

test('layer 3 selector-rewriter: 规格 §5 已核实的三个特例', () => {
  // ① 行内代码 → code.mu-inline-rule（与代码块内的 code 区分）
  assert.deepEqual(resolveSelector('code', 'editor').selectors, ['.mu-editor code.mu-inline-rule'])
  assert.deepEqual(resolveSelector('tt', 'editor').selectors, ['.mu-editor code.mu-inline-rule'])
  assert.deepEqual(resolveSelector('.md-fences code', 'editor').selectors, ['.mu-editor .mu-codeblock-content'])

  // ② <mark> 仅行内 HTML：两个目标都保留 mark 选择器，映射条目里带说明
  const mark = resolveSelector('mark', 'editor')
  assert.deepEqual(mark.selectors, ['.mu-editor mark'])
  assert.deepEqual(resolveSelector('mark', 'export').selectors, ['.markdown-body mark'])
  assert.match(TOKEN_MAP.mark.note, /行内 HTML/)

  // ③ hr：编辑器走属性改道 + --hrColor；导出仍是真实 <hr>
  const hrEditor = resolveSelector('hr', 'editor')
  assert.ok(hrEditor.propRoutes, 'hr 在编辑器侧应触发属性改道')
  assert.deepEqual(hrEditor.prefixes, ['.mu-editor'])
  assert.deepEqual(resolveSelector('hr', 'export').selectors, ['.markdown-body hr'])

  const hrRule = {
    selectors: ['hr'],
    decls: [
      { prop: 'height', value: '1px', important: false },
      { prop: 'margin', value: '20px 0', important: false },
      { prop: 'background-color', value: 'var(--x-line)', important: false },
      { prop: 'border', value: '0 none', important: false }
    ],
    at: [],
    line: 1
  }
  const routed = rewriteRules([hrRule], 'editor')
  const selectors = routed.rules.flatMap((r) => r.selectors)
  assert.ok(selectors.includes('.mu-editor .mu-thematic-break'))
  assert.ok(selectors.includes('.mu-editor .mu-thematic-break:not(.mu-active)::before'))

  const beforeRule = routed.rules.find((r) => r.selectors[0].endsWith('::before'))
  const props = beforeRule.decls.map((d) => d.prop)
  assert.ok(props.includes('border-top-color'))
  assert.ok(props.includes('border-top-width'))
  assert.ok(props.includes('border-top-style'))
  assert.ok(routed.capturedVars.some((v) => v.marktext === 'hrColor' && v.value === 'var(--x-line)'))
  // `border: 0 none` 属于 dropProps，不应变成「未搬运」告警
  assert.equal(routed.routedPropIssues.length, 0)
})

test('layer 3 selector-rewriter: CodeMirror 祖先吸收与目标不支持', () => {
  const keyword = resolveSelector('.md-fences .cm-keyword', 'editor')
  assert.deepEqual(keyword.selectors, ['.cm-keyword'], 'CodeMirror token 吸收 .md-fences 祖先且不加作用域')

  const nested = resolveSelector('.md-fences .CodeMirror pre', 'editor')
  assert.deepEqual(nested.selectors, ['.CodeMirror pre'], 'CodeMirror 子树内的标签原样直通')

  const exported = resolveSelector('.md-fences .cm-keyword', 'export')
  assert.equal(exported.ok, false)
  assert.equal(exported.reason, 'target-unsupported')

  const toc = resolveSelector('.md-toc', 'editor')
  assert.equal(toc.ok, false)
  assert.match(toc.detail, /TOC/)
  assert.deepEqual(resolveSelector('.md-toc', 'export').selectors, ['.toc-container'])
})

test('layer 3 selector-rewriter: 严格白名单，不做启发式猜测', () => {
  const unmapped = resolveSelector('li p.first', 'editor')
  assert.equal(unmapped.ok, false)
  assert.equal(unmapped.reason, 'unmapped')
  assert.match(unmapped.detail, /\.first/)

  for (const dead of ['.ag-blockquote', '.ag-hr', '.ag-mark', '.mu-container', '.ag-heading-1', '.ag-table']) {
    assert.equal(resolveSelector(dead, 'editor').ok, false, `${dead} 属于判死选择器，不应被映射表接受`)
  }
})

test('layer 3 selector-rewriter: #write 的变量提升与导出伴生规则', () => {
  const rule = {
    selectors: ['#write'],
    decls: [{ prop: 'max-width', value: '700px', important: false }, { prop: 'padding', value: '24px', important: false }],
    at: [],
    line: 1
  }
  const editor = rewriteRules([rule], 'editor')
  assert.ok(editor.capturedVars.some((v) => v.marktext === 'editorAreaWidth' && v.value === '700px'))

  const exported = rewriteRules([rule], 'export')
  const companion = exported.rules.find((r) => r.selectors.includes('.hf-container'))
  assert.ok(companion, '导出侧应产出 .hf-container 伴生规则')
  assert.deepEqual(companion.decls.map((d) => d.prop), ['max-width'], '伴生规则只搬运 max-width')
})

test('layer 3 selector-rewriter: 侧边栏容器按规格 §2 映射到 .side-bar/.sidebar', () => {
  assert.deepEqual(resolveSelector('#typora-sidebar', 'editor').selectors, ['.side-bar', '.sidebar'])
  assert.equal(resolveSelector('#typora-sidebar', 'export').ok, false)
})

// ── layer 5: font-slot-injector ───────────────────────────────────────────
test('layer 5 font-slot-injector: 四槽位 + 运行时覆盖 fallback（规格 §1.3）', () => {
  const { variables, kept } = fullVariablePass()
  const captured = captureFontStacks(kept)
  const fonts = buildFontSlots({ namespace: NS, themeVars: variables.themeVars, captured, rewrites: variables.rewrites })

  assert.deepEqual(
    fonts.slotDecls.map((d) => d.name),
    ['--reading-font-title', '--reading-font-heading', '--reading-font-body', '--reading-font-quote']
  )
  // 裁决 §7 问题 2：默认不做 title/heading 智能拆分
  assert.equal(fonts.slotDecls[0].value, fonts.slotDecls[2].value)

  assert.equal(
    fontExpression('title', 'editor', fonts.stacks, `var(--${NS}-font-body)`),
    `var(--editor-title-font-family, var(--reading-font-title)), var(--${NS}-font-body)`
  )
  assert.equal(
    fontExpression('title', 'export', fonts.stacks, `var(--${NS}-font-body)`),
    `var(--reading-font-title), var(--${NS}-font-body)`
  )
  assert.equal(fontExpression('mono', 'editor', fonts.stacks, 'x'), `var(--${NS}-font-mono), x`)

  // 槽位锚点从映射表解析出来，不是写死的选择器
  const anchors = fontAnchorRules('editor', fonts.stacks)
  const anchorSelectors = anchors.flatMap((r) => r.selectors)
  assert.ok(anchorSelectors.includes('.mu-editor .mu-container h1'))
  assert.ok(anchorSelectors.includes('.mu-editor .mu-container blockquote'))
  assert.ok(anchors.every((r) => r.decls.length === 1 && r.decls[0].prop === 'font-family'))
})

test('layer 5 font-slot-injector: 无字体变量的主题从字面字体栈兜底', () => {
  const rules = [
    { selectors: ['body'], decls: [{ prop: 'font-family', value: '"Vollkorn", Palatino' }], at: [], line: 1 },
    { selectors: ['h1'], decls: [{ prop: 'font-family', value: '"Lucida Grande"' }], at: [], line: 2 },
    { selectors: ['code'], decls: [{ prop: 'font-family', value: 'Consolas' }], at: [], line: 3 }
  ]
  const captured = captureFontStacks(rules)
  assert.equal(captured.body, '"Vollkorn", Palatino')
  assert.equal(captured.heading, '"Lucida Grande"')
  assert.equal(captured.mono, 'Consolas')

  const fonts = buildFontSlots({ namespace: 'x', themeVars: [], captured, rewrites: new Map() })
  assert.ok(fonts.extraVars.some((v) => v.name === '--x-font-body' && v.value === '"Vollkorn", Palatino'))
  assert.ok(fonts.extraVars.some((v) => v.name === '--x-font-heading'))
  assert.ok(fonts.extraVars.some((v) => v.name === '--x-font-ui'), '源主题无 --font-ui 时使用兜底字体栈')
  assert.equal(fonts.slotDecls.find((d) => d.name === '--reading-font-heading').value, 'var(--x-font-heading)')
  assert.equal(fonts.slotDecls.find((d) => d.name === '--reading-font-body').value, 'var(--x-font-body)')
})

// ── layer 6: report-generator ─────────────────────────────────────────────
test('layer 6 report-generator: 四段结构 + 丢弃/未映射/覆盖率', () => {
  const { extracted, kept, variables } = fullVariablePass()
  const { stripped, manualReview } = pipelineUpToStrip()
  const editor = rewriteRules(kept, 'editor')
  const exportTarget = rewriteRules(kept, 'export')

  const report = generateReport({
    themeName: 'sample',
    sourcePath: fixturePath,
    namespace: NS,
    stats: {
      sourceRules: 22, sourceSelectors: 26, strippedSelectors: 4, translatable: 22,
      editorMapped: 20, exportMapped: 18, bothMapped: 17, eitherMapped: 21, neitherMapped: 1,
      sourceVariables: extracted.order.length, mappedVariables: 16, passthroughVariables: 0, droppedVariables: 2
    },
    variables,
    stripped,
    manualReview,
    editor,
    exportTarget,
    fontDecisions: [{ slot: 'font-ui', source: '转译器兜底字体栈' }],
    includeWhenExport: [],
    unsupportedAtRules: [],
    generatedAt: '2026-07-26'
  })

  assert.match(report, /## 1\. 覆盖率统计/)
  assert.match(report, /## 2\. 变量对照表/)
  assert.match(report, /## 3\. 规则去向/)
  assert.match(report, /## 4\. 风险提示/)

  assert.match(report, /### 3\.1 剥离清单/)
  assert.match(report, /#file-library-list/)
  assert.match(report, /### 3\.2 未映射选择器/)
  assert.match(report, /li p\.first/)
  assert.match(report, /### 3\.5 需人工确认/)
  assert.match(report, /on-focus-mode/)

  // 已知缺口必须写进报告，避免被当成 bug（规格 §5 / §7 问题 6）
  assert.match(report, /文内 TOC 实时渲染/)
  assert.match(report, /==高亮==/)
  assert.match(report, /--window-bg-color/)
})

// ── 架构契约（规格 §6 前瞻风险）────────────────────────────────────────────
test('架构契约：映射项只能出现在 scripts/typora-map/，转译逻辑不得硬编码', () => {
  const logicModules = [
    'scripts/typora-import/rewrite-selectors.mjs',
    'scripts/typora-import/map-variables.mjs',
    'scripts/typora-import/strip-rules.mjs',
    'scripts/typora-import/inject-font-slots.mjs',
    'scripts/typora-import/index.mjs',
    'scripts/import-typora-theme.mjs'
  ]
  for (const relative of logicModules) {
    const code = fs.readFileSync(path.join(root, relative), 'utf8').replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, '')
    assert.doesNotMatch(code, /['"`][^'"`]*\.ag-[\w-]/, `${relative} 不应残留旧 ag- 选择器`)
    assert.doesNotMatch(code, /['"`]#ag-editor-id/, `${relative} 不应残留旧根选择器`)
    assert.doesNotMatch(code, /['"`]\.markdown-body/, `${relative} 不应硬编码根选择器`)
  }

  // 三张表都必须是可整表替换的独立数据模块
  assert.ok(Object.keys(TOKEN_MAP).length > 30)
  assert.ok(Object.keys(VARIABLE_MAP).length > 20)
  assert.ok(STRIP_RULES.length > 5)
})
