/**
 * Typora → Reversion theme import: strip list (data module).
 *
 * Source of truth: outputs/E2任务1_Typora主题映射规格_Claude_260726.md §4 (剥离清单)
 * plus the Typora 1.13.8 built-in themes surveyed during E2 task 2
 * (github / gothic / newsprint / night / pixyll / whitey).
 *
 * Every entry is pure data. `pattern` is tested against a single, normalised
 * Typora selector (comma-separated lists are split before matching), so one
 * selector inside a rule can be stripped while its siblings survive.
 *
 * 匹配约定：
 *   - class 用 `\.name\b`（前导点已足够界定边界，`.x-name` 不会误命中）
 *   - id 用 `#name\b`
 *   - 元素名必须带边界前缀 `(^|[\s>+~])`，避免误伤 `.foo header` 之外的写法
 *
 * `disposition`:
 *   'drop'   - remove silently, listed in the report's 丢弃清单
 *   'manual' - remove, but escalate into the report's 需人工确认 section
 */

export const STRIP_RULES = Object.freeze([
  {
    id: 'typora-sidebar',
    pattern: /#typora-sidebar-resizer\b|#sidebar-content\b|#sidebar-loading-template\b|#file-library\b|#file-library-list\b|#file-library-tree\b|#outline-content\b|\.sidebar-content\b|\.sidebar-content-content\b|\.sidebar-tabs\b|\.sidebar-footer\b|\.file-list-item[\w-]*\b|\.file-node-[\w-]+\b|\.file-tree-node\b|\.file-library-node\b|\.outline-content\b|\.outline-title\b|\.outline-item\b|\.outline-label\b|\.outline-expander\b|\.ty-side-sort-btn\b|\.active-tab-files\b|\.active-tab-outline\b|#info-panel-tab-[\w-]+\b|#file-info[\w-]*\b|#sidebar-files-menu\b|\.selected-folder-menu-item\b/,
    disposition: 'drop',
    reason: 'Typora 自有文件树/大纲侧边栏；反文侧边栏是完全不同的实现（.side-bar / .side-bar-file / .side-bar-toc）'
  },
  {
    id: 'typora-quick-open',
    pattern: /#typora-quick-open\b|#typora-quick-open-item\b|#recent-file-panel\b|\.auto-suggest-container\b|#spell-check-panel\b/,
    disposition: 'drop',
    reason: 'Typora 快速打开 / 最近文件 / 拼写检查 / 自动补全面板'
  },
  {
    id: 'typora-megamenu',
    pattern: /\.megamenu-[\w-]+\b|\.megamenu-opened\b|#megamenu-[\w-]+\b/,
    disposition: 'drop',
    reason: 'Typora Windows 版大菜单，反文（基于 MarkText/Electron）没有这套菜单结构'
  },
  {
    id: 'typora-os-hooks',
    pattern: /\.os-windows\b|\.os-windows-\d\b|\.os-linux\b|\.mac-os\b|\.mac-seamless-mode\b|\.html-for-mac\b|\.ty-mac-[\w-]+\b/,
    disposition: 'drop',
    reason: 'Typora 平台专有类名钩子（Windows / macOS / Linux）'
  },
  {
    id: 'typora-window-chrome',
    pattern: /(^|[\s>+~])(header|footer|content|iframe|audio|video)\b|#top-titlebar\b|#ty-sidebar-footer\b|#footer-word-count\b|\.context-menu\b|\.ty-footer\b|\.ty-icon\b|\.typora-[\w-]+\b|#toggle-sourceview-btn\b|#typora-source\b|#typora-center-window-title\b|\.toolbar-icon\b|\.mouse-hover\b|#w-(?:full|pin|unpin)\b|\.wp-[\w-]+\b|\.footer-item\b|#ty-tooltip\b|\.clear-btn-icon\b/,
    disposition: 'drop',
    reason: 'Typora 专有窗口 chrome / 源码视图 / 工具条；反文对应部分由 .title-bar / .editor-tabs 覆盖'
  },
  {
    id: 'typora-preferences-and-popups',
    pattern: /\.ty-preferences\b|\.dropdown-menu\b|\.dropdown-toggle\b|\.modal-[\w-]+\b|\.nav-group-item\b|\.menu-item-container\b|\.menu-style-btn\b|\.long-btn\b|\.export-detail\b|\.export-item[\w-]*\b|\.export-items-list-control\b|\.popover\b|\.popover-[\w-]+\b|#md-notification\b|#md-searchpanel\b|\.searchpanel-[\w-]+\b|\.form-control\b|\.form-inline\b|\.input-group\b|\.btn\b|#toc-dropmenu\b|#math-inline-preview\b|(^|[\s>+~])(button|select|textarea)\b|input\[type=["']?(?:text|search|password|number)["']?\]/,
    disposition: 'drop',
    reason: 'Typora 偏好设置 / 下拉菜单 / 通知条 / 搜索面板 / 导出面板 / 通用表单控件'
  },
  {
    id: 'typora-editor-affordances',
    pattern: /\.md-(?:lang|tag|meta|meta-block|image|mathjax-midline|diagram-panel|focus|expand|before|after|footnote|rawblock[\w-]*|inline-math|math-block|toc-tooltip|search[\w-]*|def[\w-]*|attr|content|header-span|plain|raw-inline|emoji|comment|line-height-panel|hover-tip|table-resize-popover|arrow)\b|\.mathjax-block\b|\.MathJax\b|\.MathJax_[\w-]+\b|\.MathJax_SVG\b|(^|[\s>+~])mjx-container\b|\.code-tooltip\b|\.code-tooltip-content\b|\.in-text-selection\b|div\[cid\]|\.anchor\b|\.md-alert[\w-]*\b/,
    disposition: 'drop',
    reason: 'Typora 编辑态专有的语法标记 / 元数据块 / MathJax 辅助 UI；反文用 KaTeX 与不同的行内标记体系'
  },
  {
    id: 'typora-heading-utility-classes',
    pattern: /^\.h[1-6]$|^\.f[1-6]$|^\.p$|(^|[\s>+~])\.h[1-6](?![\w-])|(^|[\s>+~])\.f[1-6](?![\w-])|(^|[\s>+~])\.p(?![\w-])/,
    disposition: 'drop',
    reason: 'Typora 的 .h1-.h6 / .f1-.f6 / .p 工具类（大纲与目录复用），内容标题与段落已由 h1-h6 / p 覆盖'
  },
  {
    id: 'typora-table-edit-ui',
    pattern: /\.ty-table-edit\b|\.ty-table-[\w-]+\b|\.md-table-edit\b/,
    disposition: 'drop',
    reason: 'Typora 表格编辑浮层，反文有自己的 .ag-table-picker / .ag-table-bar-tools'
  },
  {
    id: 'typora-print-block',
    pattern: /^@media\s+print$/,
    disposition: 'drop',
    reason: '导出主题由转译器重新生成独立 @media print 块（规格 §4），不沿用 Typora 原文'
  },
  {
    id: 'typora-focus-mode',
    pattern: /\.on-focus-mode\b/,
    disposition: 'manual',
    reason: '需要人工确认反文专注模式（CLASS_OR_ID.AG_FOCUS_MODE，即 .ag-focus-mode，确认真实存在）的完整选择器组合'
  }
])

/**
 * @param {string} selector normalised single selector
 * @returns {{id:string,disposition:string,reason:string}|null}
 */
export function matchStripRule (selector) {
  for (const rule of STRIP_RULES) {
    if (rule.pattern.test(selector)) {
      return rule
    }
  }
  return null
}
