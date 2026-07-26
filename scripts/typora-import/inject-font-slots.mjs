/**
 * Pipeline layer 5 — font-slot-injector (规格 §1.3 / §6).
 *
 * 反文的字体系统是「三槽位 + 运行时覆盖」两层结构：
 *   --reading-font-title / -heading / -body / -quote        主题槽位
 *   --editor-title-font-family / -heading- / -body-          运行时覆盖（主题只提供 fallback）
 *
 * 裁决（规格 §7 问题 2）：默认忠实映射，不做 title/heading「智能拆字体」美化。
 * 但若 Typora 源主题**自己**就给标题写了独立的 font-family，那是源主题的事实，
 * 转译器照搬（这不是美化，是忠实）。
 */

import { READING_FONT_SLOTS, RUNTIME_FONT_OVERRIDES, FALLBACK_FONT_STACKS } from '../typora-map/variables.mjs'
import { splitCompounds, parseCompound } from './selector-syntax.mjs'
import { ROOT_TARGETS, FONT_ANCHOR_SOURCES } from '../typora-map/selectors.mjs'
import { resolveSelector } from './rewrite-selectors.mjs'

const BODY_ANCHORS = new Set(['body', 'html', '#write'])
const HEADING_ANCHORS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const MONO_ANCHORS = new Set(['code', 'tt', 'pre', '.md-fences'])

/**
 * Capture the literal font stacks a Typora theme uses, for themes that do not
 * expose --font-body / --font-ui / --font-mono variables at all.
 * @param {import('./css-ir.mjs').IrRule[]} rules  原始（剥离前）IR 规则
 */
export function captureFontStacks (rules) {
  const found = { body: null, heading: null, mono: null }

  for (const rule of rules) {
    const decl = rule.decls.find((d) => d.prop === 'font-family')
    if (!decl) continue
    for (const selector of rule.selectors) {
      const { compounds } = splitCompounds(selector)
      if (compounds.length !== 1) continue
      const parsed = parseCompound(compounds[0])
      const anchor = `${parsed.element || ''}${parsed.ids.join('')}${parsed.classes.join('')}`
      if (BODY_ANCHORS.has(anchor) && !found.body) found.body = decl.value
      else if (HEADING_ANCHORS.has(anchor) && !found.heading) found.heading = decl.value
      else if (MONO_ANCHORS.has(anchor) && !found.mono) found.mono = decl.value
    }
  }
  return found
}

/**
 * Build the font-related `:root` declarations plus the per-role font expressions.
 * @param {{namespace:string, themeVars:Array, captured:{body,heading,mono}, rewrites:Map}} input
 */
export function buildFontSlots ({ namespace, themeVars, captured, rewrites }) {
  const ns = namespace
  const has = (suffix) => themeVars.some((v) => v.name === `--${ns}-${suffix}`)
  const extraVars = []
  const decisions = []

  const ensure = (suffix, value, why) => {
    if (has(suffix)) return `var(--${ns}-${suffix})`
    if (!value) return null
    extraVars.push({ name: `--${ns}-${suffix}`, value, strategy: 'font', from: why })
    decisions.push({ slot: suffix, source: why })
    return `var(--${ns}-${suffix})`
  }

  const bodyRef = ensure('font-body', captured.body || FALLBACK_FONT_STACKS.body, captured.body ? '源主题 body/#write 的字面字体栈' : '转译器兜底字体栈')
  const uiRef = ensure('font-ui', FALLBACK_FONT_STACKS.ui, '转译器兜底字体栈（源主题无 --font-ui）')
  const monoRef = ensure('font-mono', captured.mono || FALLBACK_FONT_STACKS.mono, captured.mono ? '源主题 code/.md-fences 的字面字体栈' : '转译器兜底字体栈')

  let headingRef = bodyRef
  if (captured.heading && captured.heading !== captured.body && !/^var\(/.test(captured.heading)) {
    extraVars.push({ name: `--${ns}-font-heading`, value: captured.heading, strategy: 'font', from: '源主题 h1-h6 的字面字体栈' })
    headingRef = `var(--${ns}-font-heading)`
    decisions.push({ slot: 'font-heading', source: '源主题标题自带独立字体栈，忠实照搬' })
  }

  const slotDecls = READING_FONT_SLOTS.map((slot) => ({
    name: slot.name,
    value: slot.role === 'title' || slot.role === 'heading' ? headingRef : bodyRef
  }))

  const stacks = { body: bodyRef, heading: headingRef, ui: uiRef, mono: monoRef }
  void rewrites
  return { extraVars, slotDecls, stacks, decisions }
}

const SLOT_BY_ROLE = {
  title: '--reading-font-title',
  heading: '--reading-font-heading',
  body: '--reading-font-body',
  quote: '--reading-font-quote'
}

/**
 * Rewrite `font-family` declarations of already-rewritten rules so they route
 * through the reading font slots, keeping the source stack as the final fallback
 * (零信息损失)。
 */
export function applyFontRoles (rules, target, stacks) {
  return rules.map((rule) => {
    if (!rule.fontRole) return rule
    const decls = rule.decls.map((decl) => {
      if (decl.prop !== 'font-family') return decl
      const expression = fontExpression(rule.fontRole, target, stacks, decl.value)
      return expression ? { ...decl, value: expression } : decl
    })
    return { ...rule, decls }
  })
}

export function fontExpression (role, target, stacks, originalValue) {
  if (role === 'ui') return dedupe(`${stacks.ui}, ${originalValue}`)
  if (role === 'mono') return dedupe(`${stacks.mono}, ${originalValue}`)

  const slot = SLOT_BY_ROLE[role]
  if (!slot) return null

  const runtime = target === 'editor' ? RUNTIME_FONT_OVERRIDES[role] : null
  const head = runtime ? `var(${runtime}, var(${slot}))` : `var(${slot})`
  return dedupe(`${head}, ${originalValue}`)
}

function dedupe (value) {
  const seen = new Set()
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => {
      if (!part || seen.has(part)) return false
      seen.add(part)
      return true
    })
    .join(', ')
}

/** 生成内容根的字体锚点规则（Typora 的 body 字体必须能到达内容区）。 */
export function contentRootFontRule (target, stacks) {
  const selector = ROOT_TARGETS[target]
  const value = fontExpression('body', target, stacks, stacks.body)
  return {
    selectors: [selector],
    decls: [{ prop: 'font-family', value, important: false }],
    at: [],
    fontRole: 'body',
    origin: '转译器生成：内容根字体锚点',
    generated: true,
    line: 0
  }
}

/**
 * 生成 title / heading / quote 三个槽位的锚点规则。
 * 目标选择器不是写死的，而是把 FONT_ANCHOR_SOURCES 里的 Typora 选择器
 * 通过 selector-rewriter 解析出来 —— 引擎换代时随映射表一起走。
 * 这些锚点排在所有源规则之前，源主题自己写的 font-family 会正常覆盖它们。
 */
export function fontAnchorRules (target, stacks) {
  const byRole = new Map()
  for (const source of FONT_ANCHOR_SOURCES) {
    const resolved = resolveSelector(source, target)
    if (!resolved.ok || !resolved.selectors.length || !resolved.fontRole) continue
    if (!SLOT_BY_ROLE[resolved.fontRole] || resolved.fontRole === 'body') continue
    if (!byRole.has(resolved.fontRole)) byRole.set(resolved.fontRole, [])
    byRole.get(resolved.fontRole).push(...resolved.selectors)
  }

  const fallbackFor = (role) => (role === 'title' || role === 'heading' ? stacks.heading : stacks.body)

  return [...byRole.entries()].map(([role, selectors]) => ({
    selectors: [...new Set(selectors)],
    decls: [{ prop: 'font-family', value: fontExpression(role, target, stacks, fallbackFor(role)), important: false }],
    at: [],
    fontRole: role,
    origin: `转译器生成：${role} 阅读字体槽位锚点`,
    generated: true,
    line: 0
  }))
}
