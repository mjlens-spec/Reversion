/**
 * Pipeline layer 6 — report-generator (规格 §6).
 *
 * 输出 Markdown 兼容报告，四段：
 *   1. 覆盖率统计
 *   2. 变量对照表（含未映射/丢弃）
 *   3. 规则去向表（编辑器 / 导出 / 双出 / 剥离 / 未映射）
 *   4. 风险提示（对应规格 §5 缺口清单，含 MVP 明确不补的项目）
 */

const STRATEGY_LABEL = {
  'theme-var': '建变量',
  syntax: '变量化（语法高亮/行内代码）',
  font: '字体槽位',
  merge: '并入其他变量',
  passthrough: '直通（映射表未收录）',
  drop: '丢弃（规格裁决）',
  'drop-unused': '丢弃（无引用）',
  'alias-collision': '别名冲突'
}

const REASON_LABEL = {
  unmapped: '未映射（不在权威白名单内）',
  'target-unsupported': '该目标无对应结构',
  unparsed: '选择器语法未能解析'
}

/** 规格 §5 固定风险条目（MVP 明确不补，写进报告避免被当成 bug）。 */
export const KNOWN_GAPS = Object.freeze([
  ['文内 TOC 实时渲染', '编辑视图内 `[TOC]` 无样式：muyajs 的 figure data-role 只有八种，没有 TOC。规格 §7 问题 6 裁决 MVP 不补；导出侧 `.toc-container` 正常生成。'],
  ['`==高亮==` 语法', 'muyajs v0.19.1 分词器没有 `==` 高亮规则，`<mark>` 只能经行内 HTML 出现。编辑器侧 `mark` 规则仅对行内 HTML 直写生效，导出侧正常。'],
  ['任务列表勾选框（导出侧）', 'Typora 导出 HTML 与反文导出主题都没有勾选框样式钩子，转译器不生成导出侧规则。'],
  ['表格斑马纹 / 行悬停', '仅当源主题确有对应规则时才产出；转译器不为悬空变量凭空补规则（规格 §5）。'],
  ['CodeMirror token 覆盖广度', '只搬运源主题写到的 token 类，未覆盖的 token 见下表「编辑器专有」条目，MVP 不补齐。'],
  ['列表标记 `::marker`', 'muyajs 的列表符号由 `.ag-bullet-list-item::before` 绘制，源主题里的 `li::marker` 规则可能不生效，需要人工在真机核实。']
])

const table = (headers, rows) => {
  if (!rows.length) return '_（无）_\n'
  const head = `| ${headers.join(' | ')} |`
  const sep = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map((cells) => `| ${cells.map(cell).join(' | ')} |`).join('\n')
  return `${head}\n${sep}\n${body}\n`
}

const cell = (value) => String(value == null ? '' : value).replace(/\|/g, '\\|').replace(/\n/g, ' ')

const code = (value) => (value ? `\`${String(value).replace(/`/g, '')}\`` : '')

export function generateReport (ctx) {
  const {
    themeName, sourcePath, namespace, stats, variables, stripped, manualReview,
    editor, exportTarget, fontDecisions, includeWhenExport, unsupportedAtRules, generatedAt
  } = ctx

  const lines = []
  const push = (...items) => lines.push(...items)

  push(`# ${themeName} — Typora 主题转译兼容报告`)
  push('')
  push(`- 源文件：\`${sourcePath}\``)
  push(`- 变量命名空间：\`--${namespace}-*\``)
  push(`- 生成时间：${generatedAt}`)
  push(`- 生成器：\`scripts/import-typora-theme.mjs\`（映射规格 v2，E2 任务 1）`)
  push('')

  push('## 1. 覆盖率统计')
  push('')
  push(table(
    ['指标', '数量', '说明'],
    [
      ['源规则块', stats.sourceRules, '含 @media 内的规则'],
      ['源选择器', stats.sourceSelectors, '逗号分隔后逐条计'],
      ['剥离选择器', stats.strippedSelectors, 'Typora 专有 UI / 打印块（规格 §4）'],
      ['可转译选择器', stats.translatable, '源选择器 − 剥离'],
      ['编辑器命中', `${stats.editorMapped}（${pct(stats.editorMapped, stats.translatable)}）`, '成功重写到 #ag-editor-id 体系'],
      ['导出命中', `${stats.exportMapped}（${pct(stats.exportMapped, stats.translatable)}）`, '成功重写到 .markdown-body 体系'],
      ['双目标命中', `${stats.bothMapped}（${pct(stats.bothMapped, stats.translatable)}）`, '两份产物都拿到规则'],
      ['任一目标命中', `${stats.eitherMapped}（${pct(stats.eitherMapped, stats.translatable)}）`, '总体覆盖率'],
      ['两目标均未命中', stats.neitherMapped, '需人工处理，见第 3 节'],
      ['源变量', stats.sourceVariables, ':root 里的自定义属性'],
      ['已映射变量', stats.mappedVariables, '建变量 / 变量化 / 字体 / 并入'],
      ['直通变量', stats.passthroughVariables, '映射表未收录但被引用'],
      ['丢弃变量', stats.droppedVariables, '规格裁决丢弃 + 剥离后无引用']
    ]
  ))

  push('## 2. 变量对照表')
  push('')
  push(table(
    ['Typora 变量', '策略', '反文目标', '双层转发', '取值', '说明'],
    variables.entries.map((e) => [
      code(e.typoraName),
      STRATEGY_LABEL[e.strategy] || e.strategy,
      code(e.target),
      (e.forwarded || []).map(code).join(' '),
      code(e.value),
      e.note || ''
    ])
  ))

  if (variables.aliasCollisions.length) {
    push('### 2.1 别名冲突')
    push('')
    push(table(['变量', '规范名', '已被占用者'], variables.aliasCollisions.map((c) => [code(c.typoraName), code(c.canonical), code(c.winner)])))
  }

  push('### 2.2 字体槽位决策')
  push('')
  push(table(['槽位', '取值来源'], fontDecisions.map((d) => [code(`--${namespace}-${d.slot}`), d.source])))

  push('## 3. 规则去向')
  push('')
  push('### 3.1 剥离清单')
  push('')
  push(table(
    ['源行', '剥离规则', '选择器', '原因'],
    stripped.map((s) => [s.line, code(s.ruleId), s.selectors.map(code).join(', '), s.reason])
  ))

  push('### 3.2 未映射选择器（需人工处理）')
  push('')
  const unmappedRows = mergeOutcomes(editor.unmapped, exportTarget.unmapped)
  push(table(['源行', '选择器', '编辑器', '导出'], unmappedRows))

  push('### 3.3 单目标产出（另一目标无对应结构）')
  push('')
  push(table(
    ['源行', '选择器', '缺席目标', '原因'],
    [...editor.targetUnsupported, ...exportTarget.targetUnsupported]
      .sort((a, b) => a.line - b.line)
      .map((r) => [r.line, code(r.selector), r.target === 'editor' ? '编辑器' : '导出', r.detail])
  ))

  if (editor.routedPropIssues.length) {
    push('### 3.4 属性改道未覆盖的声明')
    push('')
    push(table(['源行', '属性', '取值', '说明'], editor.routedPropIssues.map((i) => [i.line, code(i.prop), code(i.value), i.detail])))
  }

  if (manualReview.length) {
    push('### 3.5 需人工确认')
    push('')
    push(table(['源行', '选择器', '原因'], manualReview.map((m) => [m.line, m.selectors.map(code).join(', '), m.reason])))
  }

  push('## 4. 风险提示（规格 §5 已知缺口，MVP 明确不补）')
  push('')
  push(table(['项目', '说明'], KNOWN_GAPS.map(([k, v]) => [k, v])))

  const extraRisks = []
  if (includeWhenExport.length) {
    extraRisks.push(['`@include-when-export`', `源主题有 ${includeWhenExport.length} 条 Typora 专有导出字体引入，已转成导出主题的 \`@import\`；网络字体在离线/受限网络下不可达，建议改为自托管子集。`])
  }
  if (unsupportedAtRules.length) {
    extraRisks.push(['未处理的 at-rule', unsupportedAtRules.map((a) => `\`${a}\``).join('、')])
  }
  const manualVars = variables.entries.filter((e) => e.manualReview)
  for (const v of manualVars) extraRisks.push([`变量 \`${v.typoraName}\``, v.manualReview])
  if (extraRisks.length) {
    push('### 4.1 本主题特有风险')
    push('')
    push(table(['项目', '说明'], extraRisks))
  }

  return lines.join('\n')
}

function mergeOutcomes (editorUnmapped, exportUnmapped) {
  const map = new Map()
  for (const r of editorUnmapped) {
    if (!map.has(r.selector)) map.set(r.selector, { line: r.line, editor: '', export: '' })
    map.get(r.selector).editor = REASON_LABEL[r.reason] || r.reason
  }
  for (const r of exportUnmapped) {
    if (!map.has(r.selector)) map.set(r.selector, { line: r.line, editor: '', export: '' })
    map.get(r.selector).export = REASON_LABEL[r.reason] || r.reason
  }
  return [...map.entries()]
    .sort((a, b) => a[1].line - b[1].line)
    .map(([selector, v]) => [v.line, code(selector), v.editor || '已产出', v.export || '已产出'])
}

function pct (value, total) {
  if (!total) return '—'
  return `${((value / total) * 100).toFixed(1)}%`
}
