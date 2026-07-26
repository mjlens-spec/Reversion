/**
 * Typora → Reversion theme import: CSS variable mapping table (data module).
 *
 * Source of truth: outputs/E2任务1_Typora主题映射规格_Claude_260726.md §3（变量映射表）、
 * §1.3（字体槽位）、§1.4（双层转发）、§7（裁决记录 2/3/4/5）。
 *
 * ARCHITECTURE CONTRACT (规格 §6 / §7 问题 5)：别名表与映射表都是纯数据，
 * E2 任务 4 多主题验证阶段直接扩表即可，不需要动转译逻辑。
 *
 * ─── 策略（strategy） ────────────────────────────────────────────────────────
 *  'theme-var'  结构语义变量：生成 --<ns>-<themeVar>，并按 marktext/kebabOnly 双层转发
 *  'syntax'     语法高亮 / 行内代码细粒度颜色：同 'theme-var'，但单独归类统计
 *               （规格 §7 问题 4 定案：一律变量化，不硬编码字面值）
 *  'font'       字体栈：交给 font-slot-injector（slot: body|ui|mono）
 *  'merge'      并入另一个 Typora 变量的目标（into）；目标缺席时退回 fallbackThemeVar
 *  'drop'       显式丢弃（规格已裁决的悬空变量）
 *
 * 未列入本表的 Typora 变量：
 *  - 被保留下来的规则引用过 → 'passthrough'，生成 --<ns>-<原名> 保证 CSS 可解析
 *  - 没有任何引用          → 'drop-unused'，不生成，进报告
 */

/** 反文主题里 MarkText/muya 侧的骆峰变量 → kebab 别名（规格 §1.4 双层转发）。 */
export function camelToKebabVar (camelName) {
  return camelName
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .toLowerCase()
}

/**
 * Typora 变量同义词 → 本表规范名。
 * 种子数据来自 Typora 1.13.8 内置主题（github/night/newsprint/pixyll/whitey/gothic）
 * 与 claude-like 主题族；广度补全留给 E2 任务 4。
 */
export const VARIABLE_ALIASES = Object.freeze({
  '--main-bg-color': '--bg-color',
  '--primary-color': '--accent-color',
  '--theme-color': '--accent-color',
  '--link-color': '--accent-color',
  '--body-color': '--text-color',
  '--font-color': '--text-color',
  '--text-color-secondary': '--control-text-color',
  '--meta-content-color': '--control-text-color',
  '--base-font': '--font-body',
  '--font-family': '--font-body',
  '--body-font': '--font-body',
  '--monospace': '--font-mono',
  '--font-monospace': '--font-mono',
  '--code-font': '--font-mono',
  '--ui-font': '--font-ui',
  '--code-color': '--code-text-color',
  '--pre-bg-color': '--code-bg-color',
  '--blockquote-color': '--quote-text-color',
  '--blockquote-border-color': '--quote-border-color',
  '--table-border': '--border-color'
})

export const VARIABLE_MAP = Object.freeze({
  // ── 结构语义变量 ────────────────────────────────────────────────────────
  '--bg-color': {
    strategy: 'theme-var',
    themeVar: 'bg',
    marktext: ['editorBgColor'],
    note: '编辑器背景 / 导出 html,body 背景'
  },
  '--window-bg-color': {
    strategy: 'drop',
    note: '规格 §7 问题 5 裁决：MVP 不生成未使用变量，chrome 背景沿样本先例走直接规则'
  },
  '--side-bar-bg-color': {
    strategy: 'theme-var',
    themeVar: 'side-bar-bg',
    marktext: ['sideBarBgColor']
  },
  '--control-text-color': {
    strategy: 'theme-var',
    themeVar: 'text-muted',
    marktext: ['sideBarColor', 'iconColor'],
    note: '规格 §3 标注为一对多、无强 1:1；转译器保留原始颗粒度，接 chrome 文字/图标色'
  },
  '--text-color': {
    strategy: 'theme-var',
    themeVar: 'text',
    marktext: ['editorColor']
  },
  '--select-text-bg-color': {
    strategy: 'theme-var',
    themeVar: 'selection',
    marktext: ['selectionColor']
  },
  '--item-hover-bg-color': {
    strategy: 'theme-var',
    themeVar: 'item-hover',
    marktext: ['sideBarItemHoverBgColor', 'floatHoverColor'],
    note: '规格 §7 问题 3 裁决：两个反文变量填同一值'
  },
  '--code-bg-color': {
    strategy: 'theme-var',
    themeVar: 'code-bg',
    marktext: ['codeBgColor', 'codeBlockBgColor']
  },
  '--code-text-color': {
    strategy: 'theme-var',
    themeVar: 'code-text'
  },
  '--code-border-color': {
    strategy: 'merge',
    into: '--border-color',
    fallbackThemeVar: 'code-border',
    note: '规格 §3：并入通用边框变量；--border-color 缺席时退回自有变量'
  },
  '--border-color': {
    strategy: 'theme-var',
    themeVar: 'line',
    marktext: ['tableBorderColor', 'hrColor']
  },
  '--accent-color': {
    strategy: 'theme-var',
    themeVar: 'accent',
    marktext: ['themeColor', 'focusColor'],
    kebabOnly: ['link-color', 'list-marker-color']
  },
  '--heading-color': {
    strategy: 'theme-var',
    themeVar: 'heading',
    kebabOnly: ['h1-color', 'h2-color', 'h3-color', 'h4-color', 'strong-color']
  },
  '--quote-bg-color': {
    strategy: 'theme-var',
    themeVar: 'surface-muted'
  },
  '--quote-border-color': {
    strategy: 'theme-var',
    themeVar: 'line-strong',
    marktext: ['blockquoteBorderColor']
  },
  '--quote-text-color': {
    strategy: 'theme-var',
    themeVar: 'quote-text',
    marktext: ['blockquoteTextColor'],
    kebabOnly: ['h5-color', 'h6-color']
  },
  '--table-alt-color': {
    strategy: 'drop',
    note: '规格 §3：Typora 原版这个变量实际也没被启用（斑马纹关闭），反文样本亦无对应'
  },
  '--table-border-strong-color': {
    strategy: 'merge',
    into: '--border-color',
    fallbackThemeVar: 'table-border-strong',
    note: '规格 §3：并入 --tableBorderColor（--claude-line），未保留「强边框」细分档'
  },
  '--table-row-border-color': {
    strategy: 'theme-var',
    themeVar: 'table-row-border',
    note: '规格 §3：反文侧无对应变量，仅作为规则内引用保留'
  },
  '--table-hover-color': {
    strategy: 'theme-var',
    themeVar: 'table-hover',
    note: '规格 §3/§5：反文两个目标原本都没有表格 hover 规则；本变量只在源文件确有 hover 规则时随规则一起产出'
  },
  '--md-char-color': {
    strategy: 'theme-var',
    themeVar: 'md-char',
    manualReview: '反文的 markdown 语法字符色由 .ag-gray / patches/reversion-runtime.css 控制，本变量未接线，需人工确认'
  },

  // ── 语法高亮 / 行内代码（规格 §7 问题 4：固定变量化策略） ────────────────
  '--code-muted-color': { strategy: 'syntax', themeVar: 'code-muted-color', marktext: ['codeMutedColor'] },
  '--code-keyword-color': { strategy: 'syntax', themeVar: 'code-keyword-color', marktext: ['codeKeywordColor'] },
  '--code-string-color': { strategy: 'syntax', themeVar: 'code-string-color', marktext: ['codeStringColor'] },
  '--code-number-color': { strategy: 'syntax', themeVar: 'code-number-color', marktext: ['codeNumberColor'] },
  '--code-symbol-color': { strategy: 'syntax', themeVar: 'code-symbol-color', marktext: ['codeSymbolColor'] },
  '--inline-code-color': { strategy: 'syntax', themeVar: 'inline-code-color', marktext: ['inlineCodeColor'] },
  '--inline-code-bg-color': { strategy: 'syntax', themeVar: 'inline-code-bg-color', marktext: ['inlineCodeBgColor'] },
  '--inline-code-border-color': { strategy: 'syntax', themeVar: 'inline-code-border-color', marktext: ['inlineCodeBorderColor'] },

  // ── 字体（规格 §1.3） ───────────────────────────────────────────────────
  '--font-body': { strategy: 'font', slot: 'body', themeVar: 'font-body' },
  '--font-ui': { strategy: 'font', slot: 'ui', themeVar: 'font-ui' },
  '--font-mono': { strategy: 'font', slot: 'mono', themeVar: 'font-mono' }
})

/**
 * 阅读字体槽位（规格 §1.3）。
 * 裁决（§7 问题 2）：默认忠实映射，不做 title/heading 智能拆分——四个槽位统一取 --font-body。
 */
export const READING_FONT_SLOTS = Object.freeze([
  { name: '--reading-font-title', from: 'body', role: 'title' },
  { name: '--reading-font-heading', from: 'body', role: 'heading' },
  { name: '--reading-font-body', from: 'body', role: 'body' },
  { name: '--reading-font-quote', from: 'body', role: 'quote' }
])

/** 运行时覆盖变量（规格 §1.3：主题只提供 fallback，不定义默认值）。 */
export const RUNTIME_FONT_OVERRIDES = Object.freeze({
  title: '--editor-title-font-family',
  heading: '--editor-heading-font-family',
  body: '--editor-body-font-family'
})

/** 兜底字体栈（无 --font-body/--font-mono 时使用）。 */
export const FALLBACK_FONT_STACKS = Object.freeze({
  body: '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif',
  ui: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif',
  mono: '"SF Mono", Menlo, Monaco, Consolas, "Sarasa Mono SC", monospace'
})

/** 把任意 Typora 变量名解析成本表的规范名（走别名表）。 */
export function canonicalVariableName (name) {
  return VARIABLE_ALIASES[name] || name
}

export function lookupVariable (name) {
  const canonical = canonicalVariableName(name)
  return { canonical, entry: VARIABLE_MAP[canonical] || null }
}
