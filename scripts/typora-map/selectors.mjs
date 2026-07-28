/**
 * Typora → Reversion theme import: selector mapping tables (data module).
 *
 * Source of truth: outputs/E2任务1_Typora主题映射规格_Claude_260726.md §2 (选择器映射表)
 * and §5 (已核实的三个特例：行内代码 / mark / hr)。
 *
 * 1.3.0 已切换到 `packages/muya`（TS 重写版，`mu-` 前缀）；本表只描述
 * @muyajs/core 的现行 DOM，转译逻辑保持不变。
 *
 * ─── 条目字段 ────────────────────────────────────────────────────────────────
 *  editor / export : string | string[] | null
 *      目标选择器。数组表示一对多（重写时做笛卡尔展开）。null 表示该目标不支持，
 *      整条选择器在该目标里被丢弃并计入报告的「目标不支持」清单。
 *  scope : 'content' (默认) | 'root' | 'app'
 *      'content' 前置根作用域（编辑器 .mu-editor / 导出 .markdown-body）；
 *      'root'    自身即根（只有 #write）；
 *      'app'     不加根作用域（body/#app、CodeMirror、::selection 等应用层选择器）。
 *  absorbAncestors : boolean
 *      为真时，重写会丢弃它前面的所有祖先复合选择器（`.md-fences .cm-keyword` → `.cm-keyword`）。
 *  fontRole : 'title'|'heading'|'body'|'quote'|'mono'|'ui'|null
 *      供 font-slot-injector 决定 font-family 走哪个阅读字体槽位。
 *      可以写成 { editor, export } 形式给两个目标不同角色。
 *  captureVars : { [cssProp]: { marktext?: string, kebab?: string } }
 *      把某个属性值同时提升为反文变量（如 #write 的 max-width → --editorAreaWidth）。
 *  companion : { target: 'editor'|'export', selector: string, props: string[] }
 *      额外产出一条伴生规则，只搬运指定属性（如导出侧的 .hf-container{max-width}）。
 *  propRoutes : Array<{ props, target, renameTo?, variable?, appendDecls? }>
 *      属性级改道（目前只有 hr 用到）。命中 props 的声明搬到 target 上，可改名、
 *      可同时写进一个反文变量。未命中 props 的声明进入 dropProps / 报告。
 *  note : string   报告里展示的说明。
 */

export const ROOT_TARGETS = Object.freeze({
  editor: '.mu-editor',
  export: '.markdown-body'
})

/** 编辑器主题外层包裹（与两份人工移植主题保持一致）。 */
export const EDITOR_MEDIA_WRAPPER = 'not print'

const PASS = (name) => ({ editor: name, export: name })

/**
 * 第一优先级：整条（归一化后的）Typora 选择器精确映射。
 * 用于逐 compound 映射无法正确表达上下文语义的场合。
 */
export const SEQUENCE_MAP = Object.freeze({
  // 代码块内容：块内的 code/tt/pre 不是行内代码，走 .mu-codeblock-content。
  '.md-fences code': { editor: '.mu-codeblock-content', export: 'pre code', fontRole: 'mono' },
  '.md-fences tt': { editor: '.mu-codeblock-content', export: 'pre code', fontRole: 'mono' },
  '.md-fences pre': { editor: '.mu-codeblock-content', export: 'pre', fontRole: 'mono' },
  '.md-fences > code': { editor: '.mu-codeblock-content', export: 'pre > code', fontRole: 'mono' },
  '.md-fences > pre': { editor: '.mu-codeblock-content', export: 'pre', fontRole: 'mono' },
  'pre code': { editor: '.mu-codeblock-content', export: 'pre code', fontRole: 'mono' },
  'pre tt': { editor: '.mu-codeblock-content', export: 'pre code', fontRole: 'mono' }
})

/**
 * 第二优先级：逐 compound（复合选择器）映射。
 * key 是归一化后去掉伪类/伪元素/属性选择器的 compound 文本。
 */
export const TOKEN_MAP = Object.freeze({
  // ── 根容器 / 应用壳层 ────────────────────────────────────────────────────
  '#write': {
    scope: 'root',
    editor: ROOT_TARGETS.editor,
    export: ROOT_TARGETS.export,
    captureVars: { 'max-width': { marktext: 'editorAreaWidth' } },
    companion: { target: 'export', selector: '.hf-container', props: ['max-width'] },
    note: '1.3.0：#write → .mu-editor（编辑器）/ .markdown-body（导出）'
  },
  html: {
    scope: 'app',
    editor: ['body', '#app'],
    export: 'html',
    fontRole: { editor: 'ui', export: 'body' },
    note: '编辑器侧壳层选择器 body,#app（编译产物交叉确认）'
  },
  body: {
    scope: 'app',
    editor: ['body', '#app'],
    export: 'body',
    fontRole: { editor: 'ui', export: 'body' },
    note: '同上；Typora 的 --font-ui 按规格 §1.3 内联到这里'
  },

  // ── 标题 ────────────────────────────────────────────────────────────────
  // 标题在 muya2 里是 `hN.mu-atx-heading`（`#` 语法）或 setext 变体，都不带
  // `.mu-paragraph`——沿用 legacy 词表的 `hN.mu-paragraph` 会一条都匹配不上，
  // 转译主题的标题样式全部静默失效。按 blockquote 的写法退回元素选择器，
  // 两种标题语法都覆盖，也与手写内置主题（`.mu-container h1`）一致。
  h1: { editor: '.mu-container h1', export: 'h1', fontRole: 'title' },
  h2: { editor: '.mu-container h2', export: 'h2', fontRole: 'heading' },
  h3: { editor: '.mu-container h3', export: 'h3', fontRole: 'heading' },
  h4: { editor: '.mu-container h4', export: 'h4', fontRole: 'heading' },
  h5: { editor: '.mu-container h5', export: 'h5', fontRole: 'heading' },
  h6: { editor: '.mu-container h6', export: 'h6', fontRole: 'heading' },

  // ── 块级内容 ────────────────────────────────────────────────────────────
  p: { editor: 'p.mu-paragraph', export: 'p', fontRole: 'body' },
  blockquote: { editor: '.mu-container blockquote', export: 'blockquote', fontRole: 'quote' },
  figure: { editor: '.mu-container figure', export: 'figure' },
  figcaption: { editor: null, export: 'figcaption', note: '反文 figure 里没有 figcaption 渲染路径' },
  dl: { editor: null, export: 'dl', note: 'muyajs 无定义列表语法' },
  dt: { editor: null, export: 'dt', note: 'muyajs 无定义列表语法' },
  dd: { editor: null, export: 'dd', note: 'muyajs 无定义列表语法' },

  // ── 列表 ────────────────────────────────────────────────────────────────
  ul: { editor: 'ul.mu-bullet-list', export: 'ul' },
  ol: { editor: 'ol.mu-order-list', export: 'ol' },
  li: { editor: 'li.mu-list-item', export: 'li', fontRole: 'body' },
  '.task-list': { editor: 'ul.mu-task-list', export: 'ul' },
  '.md-task-list-item': { editor: 'li.mu-task-list-item', export: 'li' },
  '.task-list-item': { editor: 'li.mu-task-list-item', export: 'li' },
  input: { editor: '.mu-task-list-checkbox', export: null, note: '任务列表勾选框在 Chromium 为 input，在 Firefox 为 span，共用类名' },

  // ── 表格 ────────────────────────────────────────────────────────────────
  table: { editor: 'table.mu-table-inner', export: 'table' },
  thead: { editor: 'table.mu-table-inner > thead', export: 'thead' },
  tbody: { editor: 'table.mu-table-inner > tbody', export: 'tbody' },
  tfoot: { editor: null, export: 'tfoot', note: 'muyajs 表格无 tfoot' },
  tr: { editor: 'table.mu-table-inner tr', export: 'tr' },
  th: { editor: 'th.mu-table-cell', export: 'th', fontRole: 'body' },
  td: { editor: 'td.mu-table-cell', export: 'td', fontRole: 'body' },
  caption: { editor: null, export: 'caption', note: 'muyajs 表格无 caption' },
  colgroup: { editor: null, export: 'colgroup' },
  col: { editor: null, export: 'col' },

  // ── 行内 ────────────────────────────────────────────────────────────────
  a: { editor: 'a.mu-inline-rule', export: 'a' },
  '.md-link': { editor: 'a.mu-inline-rule', export: 'a' },
  strong: { editor: 'strong.mu-inline-rule', export: 'strong' },
  b: { editor: 'strong.mu-inline-rule', export: 'b' },
  em: { editor: 'em.mu-inline-rule', export: 'em' },
  i: { editor: 'em.mu-inline-rule', export: 'i' },
  del: { editor: 'del.mu-inline-rule', export: 'del' },
  s: { editor: 'del.mu-inline-rule', export: 's' },
  mark: {
    editor: 'mark',
    export: 'mark',
    note: '【已核实】muyajs v0.19.1 没有 ==高亮== 语法；编辑器侧仅对行内 HTML 直写的 <mark> 生效'
  },
  sub: PASS('sub'),
  sup: PASS('sup'),
  small: PASS('small'),
  abbr: PASS('abbr'),
  kbd: PASS('kbd'),
  q: PASS('q'),
  cite: PASS('cite'),
  dfn: PASS('dfn'),
  var: PASS('var'),
  samp: PASS('samp'),
  ins: PASS('ins'),
  u: PASS('u'),
  address: { editor: null, export: 'address', note: 'muyajs 无 address 渲染路径，仅导出侧保留' },
  '*': PASS('*'),
  img: { editor: 'img', export: 'img' },
  code: { editor: 'code.mu-inline-rule', export: 'code', fontRole: 'mono' },
  tt: { editor: 'code.mu-inline-rule', export: 'tt', fontRole: 'mono' },

  // ── 水平线（属性级改道，规格 §5 已核实） ────────────────────────────────
  hr: {
    editor: null,
    export: 'hr',
    propRoutes: [
      {
        props: ['margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right'],
        target: '.mu-thematic-break'
      },
      {
        props: ['background-color', 'background'],
        target: '.mu-thematic-break:not(.mu-active)::before',
        renameTo: 'border-top-color',
        variable: 'hrColor',
        appendDecls: [['border-top-style', 'solid']]
      },
      {
        props: ['border-top-color', 'border-color'],
        target: '.mu-thematic-break:not(.mu-active)::before',
        renameTo: 'border-top-color',
        variable: 'hrColor'
      },
      {
        props: ['height'],
        target: '.mu-thematic-break:not(.mu-active)::before',
        renameTo: 'border-top-width'
      },
      {
        props: ['border-top', 'border-top-width', 'border-top-style', 'opacity'],
        target: '.mu-thematic-break:not(.mu-active)::before'
      }
    ],
    dropProps: ['padding', 'border', 'border-bottom', 'border-left', 'border-right', 'overflow', 'box-sizing', 'width', 'display'],
    note: '【已核实】@muyajs/core 用 .mu-thematic-break:not(.mu-active)::before 画线，颜色走 --hr-color'
  },

  // ── 代码块 ──────────────────────────────────────────────────────────────
  '.md-fences': {
    editor: ['.mu-code-block', '.mu-indented-code'],
    export: ['pre', '.highlight pre'],
    fontRole: 'mono'
  },
  pre: {
    editor: ['.mu-code-block', '.mu-indented-code'],
    export: 'pre',
    fontRole: 'mono'
  },
  '.mu-codeblock-content': { editor: '.mu-codeblock-content', export: 'pre code', fontRole: 'mono' },

  // ── CodeMirror / 语法高亮：应用层，吸收祖先 ────────────────────────────
  '.CodeMirror': { scope: 'app', absorbAncestors: true, editor: '.CodeMirror', export: null, fontRole: 'mono' },
  '.CodeMirror-lines': { scope: 'app', absorbAncestors: true, editor: '.CodeMirror-lines', export: null },
  '.CodeMirror-scroll': { scope: 'app', absorbAncestors: true, editor: '.CodeMirror-scroll', export: null },
  '.CodeMirror-sizer': { scope: 'app', absorbAncestors: true, editor: '.CodeMirror-sizer', export: null },
  '.CodeMirror-gutters': { scope: 'app', absorbAncestors: true, editor: '.CodeMirror-gutters', export: null },
  '.CodeMirror-gutter': { scope: 'app', absorbAncestors: true, editor: '.CodeMirror-gutter', export: null },
  '.CodeMirror-linenumber': { scope: 'app', absorbAncestors: true, editor: '.CodeMirror-linenumber', export: null },
  '.CodeMirror-cursor': { scope: 'app', absorbAncestors: true, editor: '.CodeMirror-cursor', export: null },
  '.CodeMirror-selected': { scope: 'app', absorbAncestors: true, editor: '.CodeMirror-selected', export: null },
  '.CodeMirror-activeline-background': { scope: 'app', absorbAncestors: true, editor: '.CodeMirror-activeline-background', export: null },
  '.cm-s-inner': { scope: 'app', absorbAncestors: true, editor: '.cm-s-inner', export: null },
  '.cm-s-typora-default': { scope: 'app', absorbAncestors: true, editor: '.cm-s-inner', export: null, note: 'Typora 的 CodeMirror 主题类 → MarkText 的 .cm-s-inner' },
  '.CodeMirror.cm-s-typora-default': { scope: 'app', absorbAncestors: true, editor: '.CodeMirror.cm-s-inner', export: null },

  // ── 文内目录（导出侧 .toc-container 与 .markdown-body 平级，不加根作用域） ─
  '.md-toc': {
    scope: { editor: 'content', export: 'app' },
    editor: null,
    export: '.toc-container',
    note: '规格 §5：编辑视图内 [TOC] 无实时渲染能力（figure 的 data-role 只有八种，没有 TOC），MVP 不补'
  },
  '.md-toc-content': { scope: { editor: 'content', export: 'app' }, editor: null, export: '.toc-container ul' },
  '.md-toc-item': { scope: { editor: 'content', export: 'app' }, editor: null, export: '.toc-container ul li' },
  '.md-toc-inner': { scope: { editor: 'content', export: 'app' }, editor: null, export: '.toc-container ul li span a' },

  // ── 脚注 ────────────────────────────────────────────────────────────────
  '.footnotes': { scope: { editor: 'content', export: 'app' }, editor: 'figure.mu-footnote', export: '.footnotes' },

  // ── 应用 chrome：规格 §2 最后一行明确映射的侧边栏容器 ───────────────────
  '#typora-sidebar': {
    scope: 'app',
    editor: ['.side-bar', '.sidebar'],
    export: null,
    note: '规格 §2：Typora 侧边栏容器 → 反文 .side-bar/.sidebar；容器内部结构（文件树/大纲）仍按 §4 剥离'
  }
})

/**
 * 需要接线到阅读字体槽位的「Typora 侧锚点选择器」。
 * font-slot-injector 会把这些选择器解析成目标选择器，产出槽位锚点规则，
 * 保证 --reading-font-title/-heading/-quote 在任何源主题下都真实生效（规格 §1.3）。
 */
export const FONT_ANCHOR_SOURCES = Object.freeze(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'])

/**
 * `.cm-*` 语法高亮 token 的通配处理：所有 `.cm-xxx` 都当作应用层、吸收祖先。
 * 单独抽出来是因为 CodeMirror 的 token class 是开放集合（各语言 mode 自带）。
 */
export const CM_TOKEN_PATTERN = /^\.cm-[\w-]+$/

export const CM_TOKEN_ENTRY = Object.freeze({
  scope: 'app',
  absorbAncestors: true,
  editorFromToken: true,
  export: null,
  note: 'CodeMirror token；导出 HTML 不含 CodeMirror，仅编辑器侧产出'
})

/**
 * 纯伪元素选择器（`::selection` 等），不加根作用域，双目标直通。
 */
export const PSEUDO_ONLY_ENTRY = Object.freeze({
  scope: 'app',
  passthrough: true,
  note: '纯伪元素选择器，两个目标均直通'
})

/**
 * 查表：返回 compound 对应的映射条目，未命中返回 null。
 * @param {string} compound 归一化、去掉伪类/伪元素/属性选择器后的 compound
 */
export function lookupToken (compound) {
  if (Object.prototype.hasOwnProperty.call(TOKEN_MAP, compound)) {
    return TOKEN_MAP[compound]
  }
  if (CM_TOKEN_PATTERN.test(compound)) {
    return { ...CM_TOKEN_ENTRY, editor: compound }
  }
  return null
}

export function resolveFontRole (entry, target) {
  if (!entry || !entry.fontRole) return null
  if (typeof entry.fontRole === 'string') return entry.fontRole
  return entry.fontRole[target] || null
}

export function resolveScope (entry, target) {
  if (!entry || !entry.scope) return 'content'
  if (typeof entry.scope === 'string') return entry.scope
  return entry.scope[target] || 'content'
}
