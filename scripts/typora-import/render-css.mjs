/**
 * CSS writer — turns the rewritten IR back into the two Reversion theme files.
 * Layout mirrors the two hand-ported themes (themes/*-marktext.css / themes/export/*.css).
 */

import { EDITOR_MEDIA_WRAPPER } from '../typora-map/selectors.mjs'

const INDENT = '  '

function renderRule (rule, indent, forceImportant) {
  const selector = rule.selectors.join(',\n' + indent)
  const decls = rule.decls
    .map(({ prop, value, important }) => {
      const bang = important || (forceImportant && !prop.startsWith('--')) ? ' !important' : ''
      return `${indent}${INDENT}${prop}: ${value}${bang};`
    })
    .join('\n')
  return `${indent}${selector} {\n${decls}\n${indent}}`
}

function groupByAt (rules) {
  const top = []
  const nested = new Map()
  for (const rule of rules) {
    if (!rule.at.length) {
      top.push(rule)
      continue
    }
    const key = rule.at.join(' && ')
    if (!nested.has(key)) nested.set(key, { at: rule.at, rules: [] })
    nested.get(key).rules.push(rule)
  }
  return { top, nested }
}

/**
 * Render `:root`. A variable declared more than once (e.g. --hrColor arriving both
 * from --border-color and from the `hr` rule's own colour) keeps only its LAST
 * definition — the later, more specific source wins.
 */
function renderVarBlock (groups) {
  const lastIndex = new Map()
  let counter = 0
  for (const group of groups) {
    for (const decl of group.decls) lastIndex.set(decl.name, counter++)
  }

  counter = 0
  const lines = []
  for (const group of groups) {
    const kept = group.decls.filter((decl) => lastIndex.get(decl.name) === counter++)
    if (!kept.length) continue
    if (lines.length) lines.push('')
    if (group.title) lines.push(`${INDENT}/* ${group.title} */`)
    for (const { name, value } of kept) lines.push(`${INDENT}${name}: ${value};`)
  }
  if (!lines.length) return ''
  return `:root {\n${lines.join('\n')}\n}`
}

export function renderEditorTheme (model) {
  const chunks = [model.banner]
  for (const params of model.imports) chunks.push(`@import ${params};`)
  chunks.push(renderVarBlock(model.varGroups))
  for (const atRule of model.atRules) chunks.push(atRule.css)

  const { top, nested } = groupByAt(model.rules)
  const inner = []
  for (const rule of top) inner.push(renderRule(rule, INDENT, model.important))
  for (const { at, rules } of nested.values()) {
    const open = at.map((a) => `${INDENT}${a} {`).join('\n')
    const body = rules.map((r) => renderRule(r, INDENT.repeat(at.length + 1), model.important)).join('\n\n')
    const close = at.map((_, i) => `${INDENT.repeat(at.length - i)}}`).join('\n')
    inner.push(`${open}\n${body}\n${close}`)
  }
  chunks.push(`@media ${EDITOR_MEDIA_WRAPPER} {\n${inner.join('\n\n')}\n}`)
  return chunks.filter(Boolean).join('\n\n') + '\n'
}

export function renderExportTheme (model) {
  const chunks = [model.banner]
  for (const params of model.imports) chunks.push(`@import ${params};`)
  chunks.push(renderVarBlock(model.varGroups))
  for (const atRule of model.atRules) chunks.push(atRule.css)

  const { top, nested } = groupByAt(model.rules)
  for (const rule of top) chunks.push(renderRule(rule, '', false))
  for (const { at, rules } of nested.values()) {
    const open = at.map((a, i) => `${INDENT.repeat(i)}${a} {`).join('\n')
    const body = rules.map((r) => renderRule(r, INDENT.repeat(at.length), false)).join('\n\n')
    const close = at.map((_, i) => `${INDENT.repeat(at.length - 1 - i)}}`).join('\n')
    chunks.push(`${open}\n${body}\n${close}`)
  }
  chunks.push(model.printBlock)
  return chunks.filter(Boolean).join('\n\n') + '\n'
}

/** 导出主题的 @media print 块由转译器重新生成（规格 §4）。 */
export function buildPrintBlock () {
  return [
    '@media print {',
    '  html,',
    '  body {',
    '    background: #ffffff;',
    '  }',
    '',
    '  .markdown-body {',
    '    max-width: none;',
    '    padding: 0;',
    '    background: #ffffff;',
    '  }',
    '}'
  ].join('\n')
}
