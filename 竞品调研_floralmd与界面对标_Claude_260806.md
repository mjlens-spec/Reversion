# Reversion 反文 · 竞品调研：FloralMD 与界面对标

日期：2026-08-06
上位文档：[开发规划_Claude_260726.md](开发规划_Claude_260726.md)（路线图与暂缓清单）
调研对象：[yingkaisun-kai/floralmd](https://github.com/yingkaisun-kai/floralmd)（本地检出深读源码）+ 市面界面出众的 Markdown 编辑器（网络调研，来源见文末）
基准：Reversion 1.9.0（MarkText v0.20.0-rc.1 + `@muyajs/core`，仅 macOS arm64）

---

## 〇、TL;DR

1. **FloralMD 是 Swift/TextKit 2 原生路线**，与 Reversion 的 Electron/Muya 路线代码完全不通；它的价值在**三处可移植的设计**：中文双字体设置与双语命令面板、语义缩略图与悬浮便签差异化功能、以及「架构不变量文档 + 重测试 + 严肃发布流水线」的工程纪律。它的短板（几乎无主题系统、行距锁死、导出仅 PDF、无图表）恰是 Reversion 的优势区。
2. **两条战略情报**：① MarkText 上游 2026 年 5 月恢复活跃维护（原作者回归、社区 fork 合并回上游）——应排查上游新合并的修复（尤其 IME/光标类）评估回合；② Bear 团队 2026 年 6 月公测 **Lettera**（本地 .md 文件 + 精致排印 + macOS），与反文定位重叠度极高，是最直接的对标品，建议持续跟踪。
3. **性价比最高的五件事**：CSS `text-autospace` 中西文间距（M6 已规划，Chromium 原生支持、成本极低）、中西文双字体独立设置、Cmd+K 双语命令面板、一键中文自动排版（学妙言）、语义缩略图。

---

## 一、FloralMD 深度研究

### 1.1 项目概况

- **定位**：macOS 原生「文件优先」Markdown 编辑器——直接打开任意位置的单个 `.md`，无 Vault/工作区概念，主打 Typora 式行内实时渲染 + 悬浮便签 + Finder Quick Look。README 自带与 Typora/Obsidian/MarkEdit/**MarkText** 的对比矩阵，明确把 MarkText 当对标。
- **技术栈**：Swift 6 / AppKit / **TextKit 2**（非 Electron、非 Web 内核）。SwiftPM 三 target：`FloralMDCore`（解析/渲染/编辑）、`floralmd`（NSDocument 应用壳）、`FloralMDQuickLook`。依赖仅三个：Apple `swift-markdown`、`SwiftMath`（原生 LaTeX，不用 KaTeX/MathJax）、`Sparkle`。
- **成熟度**：中国独立开发者「凯门见山Kai」单人项目，2026-06-27 首发，6 周约 27 个版本，迭代极快。代码约 3.2 万行，**测试约 2 万行 / 101 个测试文件**，测试纪律罕见地好。公开仓库为按版本 squash 的快照（仅 1 个 commit），外部难以贡献，总线因子为 1。

### 1.2 架构路线对比（与 Reversion 的根本差异）

FloralMD 的两条铁律（`docs/ARCHITECTURE.md` §3）：

1. **文本存储永远等于原始 Markdown 源码**。渲染只改富文本属性：语法标记用近零字号 + 透明色隐藏，不插入删除任何展示字符。展示位置与源码位置一一对应，**保存无需从富文本反向序列化**——从架构上消灭了 Muya「DOM/状态树 → 序列化回 Markdown」这条路线的往返保真问题。
2. 只用 TextKit 2 视口布局，禁止任何触发回退 TextKit 1 的 API。

管线：`BlockParser` 切逻辑块 → `SyntaxHighlighter` 按块产出属性 → 光标所在块显示原始标记（Typora 式活动块），编辑只重解析受影响区域。阅读模式是**第二条独立管线**（JS 全禁的 WKWebView + HTML 消毒），Edit/Read 用源码行锚点做双向滚动同步；PDF/打印/Quick Look 复用同一 HTML 路径。

**对反文的启示**：这条路线光标/IME/保存保真的先天优势明显，但换来的是双渲染管线维护税（每个语法特性写两遍）和 TextKit 2 的大量地雷（其架构文档里几十条踩坑记录）。反文不必羡慕，单一 Web 渲染管线 + 全套导出/图表生态仍是自身优势；真正该搬的是下面的设计层内容。

### 1.3 值得反文借鉴的点（按价值排序，附源码证据）

1. **CJK 双字体设置（对反文最相关）**。西文基础字体 + 独立中文字体两个设置项，通过 `NSFontDescriptor.cascadeList` 级联——**西文字体定 metrics，仅未覆盖字符落到中文字体**（`Sources/FloralMDCore/Model/EditorTheme.swift:86-109`）；「系统默认」模式下用 `CTFontCreateForString` 解析出系统实际生效的中文字体，在设置里诚实显示。反文主题已有三字体槽位 + 中文回退链，但**回退链写死在主题 CSS 里**；把「西文字体 × 中文字体」拆成两个用户可独立选择的设置（每槽位拼接 font-family 栈即可），成本低、对中文用户价值大。
2. **语义缩略图 minimap**（`Sources/floralmd/Views/DocumentMinimapView.swift`，仅 163 行）。不渲染微缩文字，画「结构条」：标题=强调色、代码=橙、引用=紫、列表缩进用 x 偏移表达，叠加光标行与当前视口框，可点击/拖动滚动。成本低、信息密度高，Web 端用 canvas 按块类型画色条即可复刻，长文导航价值大。
3. **命令面板 + 稳定命令 ID 的快捷键目录**。`ShortcutCatalog` 以稳定命令 ID 登记默认值/作用域/可定制性，菜单、命令面板、设置页、快捷键录制**共用同一目录**；命令面板搜索同时索引中英文名 + 命令 ID + 快捷键（`Sources/floralmd/App/CommandPaletteController.swift:161-170`）；无文档时文档级命令置灰而非隐藏。反文目前无命令面板，这套「单一目录、多处消费」的组织方式可直接搬。
4. **悬浮便签三件套**：三态置顶（不置顶/仅当前 Space/所有 Space）；置顶时**只淡化窗口底色（88%），文字、光标、公式保持全不透明**，且尊重系统「减少透明度/增强对比度」；全局热键唤起置顶草稿（用系统离散热键 API，无需辅助功能权限）。Electron 里 `setAlwaysOnTop` + `globalShortcut` + CSS 背景透明都现成，是低成本差异化功能。
5. **未命名草稿自动落盘 Inbox**。用户选一个目录，空白草稿 debounce 后以时间戳名 + `O_EXCL` 原子落盘为普通 md 文件——「快速记录 = 普通文档流程的全局入口」，不引入便签数据库，设计哲学干净（`Model/UntitledDocumentSavePolicy.swift`）。
6. **图片工作流**：粘贴图片 → 可编辑时间戳命名框 → 存入同目录 `assets/` → 插入相对引用；悬停拖拽等比缩放，松手写回 **Obsidian 兼容的 `![说明|480](路径)` 宽度后缀**，编辑/阅读共享该宽度。与 M2 遗留的「图片选中态、拖拽调宽」条目正好衔接，宽度后缀语法建议采纳（生态兼容）。
7. **空白文档欢迎层交互细节**（`Views/UntitledWelcomeView.swift`）：提示贴近插入点而非居中假输入框；开始输入（**含 IME 组合开始**）立即淡出，删空恢复；命中测试穿透，编辑器始终保持第一响应者。
8. **模式切换不跳动的通用原则**：先在隐藏表面完成定位再一次性换视图，绝不先显示旧位置再跳；应用失焦/激活用「源码偏移+屏幕Y」锚点 + 视口快照两轮恢复。反文的源码模式切换、导出预览可对照检查。
9. **工程实践**：① `docs/ARCHITECTURE.md` 是持续积累的「不变量 + 踩坑决策」文档，每条 bug 修复沉淀为一条约束——反文的 `known-issues.ts` + outputs 报告已有此雏形，值得升格为一份长期维护的架构不变量文档；② 进程内按键脚本回放（`App/ReproScript.swift`）复现 IME/光标 bug，与反文 IME 矩阵思路互补；③ 两阶段签名发布流水线（无密钥 test job → 受保护 environment 的 release job → 人工验收 promote）。
10. **README 对比矩阵 + 判定口径文档**（`docs/MARKDOWN_EDITOR_COMPARISON.md`）：诚实标注对比日期与「❌ 不代表插件做不到」，营销方式可学。

### 1.4 不值得学 / 反文的反超空间

1. **几乎没有主题系统**：仅系统明暗 + 少数 hex 设置，无主题文件；甚至因 TextKit 2 光标问题**把行距锁死**（`EditorTheme.swift:216-219` 注释）。反文的双主题 + Typora 主题导入 + 导出主题一致性是显著领先项。
2. **双渲染管线维护税**与原生路线的隐形成本（如「所有 Space 置顶」靠把内容视图临时移进 `nonactivatingPanel` 再移回的高危重排）——实现精巧但脆弱，不可迁移。
3. **功能面窄**：导出仅 PDF/打印、无 Mermaid 等图表、代码高亮仅 15 种语言、无跨文件搜索、无插件。反文的 HTML/PDF/DOCX/PNG 四格式导出 + 图表 + ripgrep 全文搜索全面领先。
4. **CJK 排印并无深度处理**：除双字体外，没有中西文间距、标点挤压、禁则——**这正是反文 M6 可以反超的空间**。

---

## 二、市面界面出众的编辑器对标

### 2.1 标杆产品

**Typora（1.13.x，仍活跃）** — 反文的既定对标，三点再确认：① 「彻底移除模式感」的 WYSIWYM 心智模型仍是行内渲染金标准；② Focus/Typewriter 的细粒度开关（打字机模式提供「仅输入时固定滚动」选项，把强制居中变成可选）；③ 纯 CSS 主题 + [typora-theme-toolkit](https://github.com/typora/typora-theme-toolkit) 静态 HTML 快照调试——反文的主题转译器可参考其 HTML 结构对照表。另外 **[obgnail/typora_plugin](https://github.com/obgnail/typora_plugin)（社区插件集）本身就是一份「Typora 用户用脚投票的缺口清单」**：右侧常驻大纲、命令面板、表格搜索/筛选、中英混排优化——反文可从中挑选原生实现。

**iA Writer** — 排印即界面（定制 duospace 字族 Mono/Duo/Quattro，加粗不换宽度）；**三级 Focus 体系**（句子/段落/打字机），可与词性着色（Syntax Highlight）、赘词检查（Style Check）叠加。「语法结构可视化」是行内渲染编辑器很少做、且与中文写作可结合的差异化方向。

**Bear / Lettera（⚠ 重点）** — Bear 的行内渲染保留半透明轻量语法标记，排印精致。**Lettera（2026-06 公测）**：Bear 团队用同款编辑引擎做的独立 .md 文件编辑器——直接操作文件系统、文件夹即侧栏目录树、标签页、TOC、文档统计、PDF/ePub 导出、可自定义行高的「Advanced Typography」、BIU 浮动格式条。**与反文定位几乎完全重叠**（本地 md + 精致排印 + macOS），且出自 Apple Design Award 团队。行动项：跟踪其 beta 迭代，作为界面打磨的直接参照系。

**Ulysses** — 三栏（库/列表/编辑器）可渐进收纳为两栏、单栏，切换有平滑动画；「内容与样式分离、导出套样式模板」与反文导出主题思路同构。

**Obsidian** — Cmd+P 命令面板是一切操作的统一入口；2025 年的 Footnotes 侧栏视图（编辑脚注不离开正文位置）对长文写作实用且实现成本可控。

### 2.2 上游 MarkText 近况（战略情报）

原仓库 2022–2025 停滞；停滞期最活跃的社区 fork 是 Tkaixiang/marktext（正是反文当前基线的维护者之一）。**2026 年 5 月原作者回归、社区 fork 已合并回上游，MarkText 恢复活跃维护**；另有 Tauri 2 + Rust 重写的「精神续作」出现。

→ **行动项**：排查上游 2026 年新合并的修复（尤其 Muya 光标/中文 IME 类），对照反文的 `known-issues.ts` 缺陷集评估回合；反文自己修复的 IME 问题也具备了回馈上游的通道。

### 2.3 新秀与中文向产品

| 产品 | 界面/交互亮点 | 对反文的参考 |
| --- | --- | --- |
| **MarkFlowy**（Tauri+Prosemirror，<20MB） | 内置 AI 条：选中文本翻译/摘要，以侧栏对话挂载不侵入编辑区 | AI 功能的挂载形态（若未来考虑） |
| **Milkdown / Crepe** | `/` 斜杠菜单插入块、选中浮现行内工具条、块拖拽手柄；菜单分组与键盘导航打磨到位 | 斜杠菜单交互细节的现成参考（反文 1.7.0 已有划选工具条，缺 `/` 菜单） |
| **Vditor**（国产） | WYSIWYG / IR（类 Typora 即时渲染）/ SV 三模式并存；IR 实现思路与 Muya 同类 | 同类引擎的行为参照；大纲/脑图扩展渲染 |
| **思源笔记 SiYuan** | 块手柄三合一（悬停六点手柄：拖拽/折叠/菜单）；中文输入流畅度口碑极好；主题市场 | 块手柄交互；主题市场机制 |
| **妙言 MiaoYan**（Swift 原生，23MB） | **一键中文自动排版**（中英混排空格、全半角标点统一）；PPT 演示模式；「妙美快简」 | 一键排版是最值得直接吸收的单点功能 |
| **Zettlr 4**（2025-12） | CodeMirror 6 重写的表格编辑器：可视化编辑 + 全键盘命令双轨 | M3 表格后续迭代（拖拽手柄）的双轨设计参照 |
| **Ghostwriter**（KDE） | Hemingway 模式（禁退格强制向前写）；双 HUD 浮窗（可读性统计 / 语法速查） | 写作统计 HUD 的形态参考 |

### 2.4 2025–2026 界面趋势小结

1. **命令面板成为标配**（Cmd+K/P，「命令+文件+搜索」统一入口）；
2. **块级操作手柄 + 斜杠菜单**（Notion 范式经 Crepe/SiYuan 进入 Markdown 世界）；
3. **AI 写作条**以「选中文本 → 改写/翻译/摘要」浮条形式出现，而非全局聊天；
4. **Focus/Typewriter 精细化**到句子级，并与语法着色叠加；
5. **低 chrome 无边框窗口**，工具 UI 按需浮现（Typora、妙言、Lettera 均如此）；
6. **本地优先、直接操作文件系统**回潮（Lettera 弃数据库直管 .md 文件夹）——反文在趋势正确的一侧；
7. **Tauri 轻量化**（<20MB）成为新项目默认选择，Electron 应用面临体积/内存口碑压力——反文短期不必换壳，但应关注启动与内存指标，避免口碑侧翻。
8. **中文排印技术面**：CSS `text-autospace` 已获主流浏览器内核原生支持，中西文间距无需 JS 手动处理——与 M6 规划的「CSS text-autospace 优先」判断一致，Chromium 系的反文可低成本吃到；进阶的标点挤压/行尾点号悬挂可参考「赫蹏 Heti」排版增强库的思路。

---

## 三、对反文的改进建议

### 3.1 与现有路线图对齐的确认项（不新增方向，仅补充弹药）

| 路线图条目 | 本次调研补充 |
| --- | --- |
| M6 中西文自动间距 | `text-autospace` 原生支持已落地，优先级可提前；导出 HTML/PDF 同步启用 |
| M6 智能引号/标点 | 增补「一键中文自动排版」（学妙言）：存量文档的混排空格与全半角统一，与输入时自动处理互补 |
| M2 图片拖拽调宽 | 采纳 Obsidian 兼容的 `![说明\|480](路径)` 宽度后缀写回语法 |
| M3 表格后续（拖拽手柄） | 参照 Zettlr 4「可视化 + 全键盘命令」双轨 |
| 行内渲染对齐 Typora | FloralMD 的「活动块」粒度（块级显隐）与反文当前一致；Typora 的细粒度开关（打字机「仅输入时居中」）纳入行为规格表 |
| 主题体系 | 主题定义升级为「明暗双配色一体」（学 Bear/Ghostwriter），修复深色模式短板的根本解法 |

### 3.2 新增建议项（按性价比排序）

1. **中西文双字体独立设置**（源自 FloralMD）：在偏好设置暴露「西文字体 × 中文字体」两项，按三字体槽位拼接 font-family 栈；「系统默认」时显示实际生效的中文字体。CSS 实现成本低，中文写作编辑器的刚需。
2. **Cmd+K 双语命令面板**：统一「命令 + 文件 + 最近打开」，搜索索引中英文名 + 快捷键；底层建「稳定命令 ID 目录」，菜单/面板/未来的快捷键自定义共用。
3. **语义缩略图**：canvas 按块类型画结构条 + 视口框，163 行级别的实现规模，长文导航收益大。
4. **Focus / Typewriter 模式**：先做段落级淡出 + 打字机两档（含「仅输入时居中」开关）；句子级聚焦（iA Writer）作为二期。
5. **斜杠菜单 `/`**：与现有划选工具条互补（划选=改已有内容，斜杠=插入新块），交互细节照 Crepe playground 打磨。
6. **悬浮便签 + 全局快速记录**：置顶三态 + 只淡化底色的半透明 + `globalShortcut` 唤起；配套「未命名草稿自动落盘 Inbox 目录」。差异化功能，Electron 实现成本低。
7. **Footnotes 侧栏**（学 Obsidian 2025）：长文写作者高频，实现成本可控。
8. **空白文档欢迎层打磨**：提示贴插入点、IME 组合开始即淡出、命中穿透保焦点。
9. **写作统计 HUD**（学 Ghostwriter）：现有字数统计扩展为可唤出的浮窗（阅读时长、段落分布）。

### 3.3 工程与战略行动项

1. **上游回合排查**：MarkText 2026 年恢复维护后新合并的 IME/光标修复，对照 `known-issues.ts` 逐项评估 cherry-pick；反文的 IME 修复可评估回馈上游。
2. **跟踪 Lettera beta**：定位重叠度最高的对标品，每次大版本对照一次界面与排印细节。
3. **架构不变量文档**：把散落在 outputs 报告与 `known-issues.ts` 的踩坑决策，升格为一份随代码维护的 `ARCHITECTURE.md`（学 FloralMD：每条 bug 修复沉淀为一条约束）。
4. **发布流水线**：参考 FloralMD 两阶段发布（无密钥测试 job → 受保护 release job → 人工 promote）；ad-hoc 签名策略不变，但流水线的权限隔离值得吸收。
5. **README 对比矩阵**：诚实标注对比日期与口径，把反文的领先项（四格式导出、图表、Typora 主题导入、Quick Look、中文排印路线）摆出来。

### 3.4 建议的版本编排（供排期参考，不构成决策）

- **近期小版本（1.10.x）**：`text-autospace`（编辑器 + 导出）、双字体设置、明暗双配色主题、空白文档欢迎层。
- **中期（1.11–1.12）**：Cmd+K 命令面板（先建命令 ID 目录）、语义缩略图、Focus/Typewriter、一键中文自动排版。
- **随 M2/M3 顺延项**：图片宽度后缀、表格双轨编辑、斜杠菜单。
- **差异化观察项**：悬浮便签 + 快速记录、Footnotes 侧栏、写作统计 HUD——视用户反馈决定是否立项。
- **持续**：上游回合排查、Lettera 跟踪、架构不变量文档。

---

## 附：主要信息来源

- FloralMD：本地源码检出（`Sources/FloralMDCore/`、`Sources/floralmd/`、`docs/ARCHITECTURE.md`、`docs/MARKDOWN_EDITOR_COMPARISON.md`）
- Typora：https://typora.io/ · https://support.typora.io/Focus-and-Typewriter-Mode/ · https://github.com/typora/typora-theme-toolkit · https://github.com/obgnail/typora_plugin
- iA Writer：https://ia.net/writer · https://ia.net/writer/support/editor/syntax-highlight
- Bear / Lettera：https://bear.app/ · https://lettera.md/ · https://9to5mac.com/2026/06/19/bear-app-developers-announce-lettera-a-beautiful-markdown-editor-for-mac/
- Obsidian：https://obsidian.md/changelog/
- MarkText 上游：https://github.com/marktext/marktext/issues/4098 · https://github.com/Tkaixiang/marktext
- 新秀：https://github.com/drl990114/MarkFlowy · https://milkdown.dev/ · https://b3log.org/vditor/ · https://sspai.com/post/93846（思源）· https://zhuanlan.zhihu.com/p/697482317（妙言）· https://zettlr.com/post/zettlr-400-released · https://apps.kde.org/ghostwriter/
- 中文排印：https://zhuanlan.zhihu.com/p/1998845410316403847（CSS text-autospace）· 赫蹏 Heti 排版增强库
