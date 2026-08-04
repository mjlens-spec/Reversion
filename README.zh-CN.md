# Reversion · 反文

[English](README.md) | **简体中文**

<img src="icon/lens-marktext-icon.png" alt="反文图标" width="128" align="right" />

Reversion 的中文名称是「反文」，是一款面向中文写作的 macOS 所见即所得 Markdown 编辑器。它基于 [MarkText](https://github.com/marktext/marktext) `v0.20.0-rc.1` 与 TypeScript 编辑器引擎 `@muyajs/core`，加入行内实时渲染、原生 Finder Quick Look 扩展、两套排印主题、Typora 主题导入工具，以及 HTML / PDF / DOCX / PNG 长图四种导出格式。

当前版本：**1.9.0**（Apple Silicon）。反文沿用 MarkText 的应用数据目录与 Bundle ID，因此从旧版本迁移时设置、历史记录与自动更新链均可延续。

## 核心功能

- **行内实时渲染** — 默认进入 Muya 所见即所得模式。粗体、斜体、链接、行内代码、数学公式随输入实时排版；光标进入语法范围时显示 Markdown 标记，移开后自动隐藏。
- **排印优先的主题** — 内置两套主题，各有三个独立的阅读字体槽位，可分别设定大标题、小标题与正文字体，并带一条不破坏西文字形度量的中文回退链。
- **Typora 主题导入** — 「主题 ▸ 导入主题（Typora 兼容）」在应用内把 Typora 主题的 CSS 转译为反文的编辑器主题与配套 HTML/PDF 导出主题，并输出兼容报告列出无法映射的规则。同一条流水线也以 `scripts/import-typora-theme.mjs` 形式提供。已在 Typora 六套内置主题上验证。
- **导出** — HTML、PDF、DOCX 与 PNG 长图四种格式。HTML 与 PDF 沿用导出主题、字体、目录与页眉页脚设置；DOCX 经 pandoc 转为 Word 原生结构；PNG 把整篇文档渲染成一张不分页长图。
- **Finder Quick Look** — 应用内置原生 macOS Quick Look 预览扩展。在访达中选中 Markdown 文件按空格，即可预览标题、列表、引用、代码块、表格与行内格式。
- **图表与公式** — Mermaid 11、Vega-Lite、PlantUML、flowchart.js 与 KaTeX。
- **全文搜索** — 基于 ripgrep 的项目内搜索，支持排除规则与符号链接处理。
- **双语产品名称** — 英文系统显示 `Reversion`，简体与繁体中文系统显示「反文」。关于页面使用 `Reversion · 反文`。

## 下载

预构建的 `arm64` DMG 发布在 [Releases 页面](https://github.com/mjlens-spec/Reversion/releases)。每个版本同时提供 `Reversion-<版本>-arm64.dmg`、更新用 ZIP、`latest-mac.yml` 与 SHA-256 校验文件。

应用会在首个窗口打开 15 秒后检查本仓库是否有更新的稳定版，没有新版时不打扰。发现新版后，右下方常驻进度卡会显示百分比、已下载容量、速率与预计剩余时间，不阻塞编辑。重启安装前会先处理未保存文档；新版本启动后，更新说明只显示一次。也可随时使用「Reversion → 检查更新」。

应用采用带稳定应用标识的 ad-hoc 签名，**未经 Apple 公证**。该稳定标识用于让相邻版本互相校验；下载另有 GitHub HTTPS 与 `latest-mac.yml` 中的 SHA-512 校验保护。首次启动时，macOS Gatekeeper 可能要求在访达中按住 Control 点击 →「打开」。

## 1.9.0 更新内容

- **标题栏优先显示文档名称。** 当前文件名改为粗体，并隐藏最后一个扩展名，打开文档后可以先看到最重要的信息。
- **文件夹位置压缩为清晰的路径标签。** 文件名后方使用浅灰标签，按父目录到子目录的顺序展示距离文件最近的 3 级文件夹，并用轻量箭头分隔。
- **长路径不会挤出窗口。** 文件名与各级目录会根据可用宽度分别省略；macOS 点击文件名重命名和未保存状态提示保持不变。

## 1.8.1 更新内容

- **侧栏内容四周统一留白。** 文件、搜索与目录视图的内容区四边均增加 8 px 间距，与标注稿的边距基准一致，不改变侧栏外部宽度。
- **侧栏整体字号缩小 1 px。** 入口文字、文件与文件夹、搜索框与搜索结果、目录条目、按钮及底部字数统计都按原有层级统一缩小。
- **自适应宽度与滚动保持稳定。** 双击分隔条计算宽度时会计入新增边距，现有选中态、禁用态与溢出滚动行为保持不变。

## 1.8.0 更新内容

- **「文件」改为目录树。** 打开单个文档后，侧栏会显示该文件所在的文件夹结构，不再只是平铺已打开的标签；可继续向上浏览，也可按需展开子文件夹。
- **文件状态清楚区分。** 支持打开的文档保持正常颜色，不支持的格式以暗灰色显示并禁用，当前文档持续保留选中高亮。
- **大型目录保持顺畅。** 目录条目采用批量读取，同一文件夹内切换文档会复用结果，子目录仅在展开时加载。
- **文件系统边界更加稳健。** Windows 盘符根目录、UNC 共享路径、符号链接、无权读取的文件夹与重试状态均有明确处理。
- **键盘操作与多语言补齐。** 文件树支持键盘导航，并提供当前项与禁用项的无障碍语义；新增提示与错误文案已覆盖 10 种界面语言。

## 1.7.2 更新内容

- **侧栏按钮准确居中。**「文件 / 搜索 / 目录」的图标与色块重新对齐到几何中心，当前入口仍会展开文字。
- **底部工具区恢复。** 设置入口回到侧栏左下角，右下角恢复实时中文与英文计数，并可通过 Tooltip 查看完整字数、字符数与段落数。
- **设置符号更加简洁。** 原齿轮替换为圆角线性调节图标，与工作区的克制线框语言保持一致。
- **导出入口改为纯图标。** 右上角以「箭头离开托盘」符号配合紧凑的下拉箭头表达导出，闲置时保持透明且无边框，悬停或菜单展开时才显示轻量高亮。
- **标签栏保持在可用宽度内。** 常驻标签栏会在工作区宽度内滚动，新建标签的「+」仍紧邻最后一个可见标签；切换到溢出区域的标签时，会自动把它带回视野。

## 1.7.0 更新内容

- **工作区外壳全面调整。** 侧栏改为纸张色横向「文件 / 搜索 / 目录」入口，当前入口展开文字，其余入口保持图标优先；新增常驻工作区栏，统一放置侧栏开关、标签页、新建标签与导出入口。
- **导出入口重新聚焦。** 页面右上角只保留「导出」，并明确区分可用与禁用状态，继续承载 HTML、PDF、DOCX 与 PNG 四种导出路径。
- **划选工具条围绕写作重做。** 浮动工具条新增整行段落入口，二级菜单支持普通文本、标题、列表、待办、引用与代码；下方保留紧凑的行内格式按钮，链接使用独立浅蓝色。评论与 AI 写作入口本版不加入。
- **划选编辑更加稳健。** 跨段落格式、反向选区、输入法组合态、Esc 分层关闭与键盘焦点行为统一到选区感知流程中。

## 1.6.2 更新内容

- **目录长标题自动换行。** 标题超出目录栏可用宽度后会继续显示在下一行，不再以省略号截断，也不会产生横向溢出。
- **启动时恢复白银比例。** 每次打开应用，目录栏与正文栏都会恢复为 `1 : 2.414`。本次使用期间仍可自由拖动宽度，窄窗口继续保留 `220 px` 最小目录宽度。

## 1.6.1 更新内容

- **表格工具条不再盖在导出弹窗上。** 打开导出设置后，鼠标划过弹窗时，若弹窗背后正好是表格，编辑器的表格列工具条会浮在最上层挡住标签页与选项。现在弹窗打开期间编辑器不再参与坐标命中判定。
- **导出弹窗新增取消按钮。** 此前只能按 Esc 或点击弹窗外部退出；取消按钮采用弱化配色置于「导出」左侧，已调整的设置照常保留。

## 1.6.0 更新内容

- **导出为 DOCX。** 文件 → 导出 → 导出为 DOCX，从 Markdown 源直接转换：标题、列表、表格、引用、代码块转为 Word 原生结构，公式转为可继续编辑的 Word 原生公式（OMML），`[TOC]` 转为 Word 目录域，相对路径图片按文档所在目录解析。转换由 pandoc 完成，需自行安装（`brew install pandoc`），未安装时导出会提示。Word 文档的排版由 Word 自身决定，导出设置中的页面、主题、字体各项对其不生效。
- **导出为 PNG 长图。** 文件 → 导出 → 导出为 PNG 长图，整篇文档渲染成一张不分页的完整长图。导出设置新增「图片」页：图片宽度（400–2000 px）、分辨率（标准 1 倍 / 高清 2 倍）、页边距、背景颜色。样式沿用导出主题与字体设置，与 HTML 导出一致；图片高度按正文实际内容裁切。
- **应用图标更新。** 新图标为墨绿手写 W 配报纸纸纹，访达、程序坞与安装包统一使用。「应用图标」选择器增至五款；此前使用默认图标的用户一并更新，手动选过其他图标的保持原选择。

1.5.2 带来了应用图标选择器与引用块单竖线修正；1.5.1 带来了侧栏分隔条双击自适应与两套主题的阅读排版调整。

完整说明见 [Releases](https://github.com/mjlens-spec/Reversion/releases/tag/v1.9.0)。

## 开发计划

**后续。** 行内实时渲染的行为对齐 Typora（光标锚定、点击落点、链接编辑）、表格编辑（行列拖拽手柄、Excel/CSV 粘贴成表、宽表格滚动）、PDF 导出的大纲书签与分页控制，以及中文排印细化（中西文间距、标点挤压、智能引号）。

已知限制记录在仓库的规划文档中；少数输入法边缘用例连同复现说明记录在 `tests-e2e/helpers/known-issues.ts`。

## 主题

| 主题 | 风格 |
| --- | --- |
| **Lens Design** | 冷调纸面上的孔雀蓝 / 酒红 / 金色点缀，基于 Lens Design 排印体系。大标题使用 Cormorant Garamond，中文回退到霞鹜文楷（LXGW WenKai）；小标题使用 Spectral，中文同样回退霞鹜文楷；正文使用 Noto Sans / Noto Sans SC，17 px、行高 1.7。 |
| **Claude-like** | 暖调米白纸面配陶土色强调色，改编自 Typora 的 [Claude-like 主题](https://github.com/Muyiiiii/Typora_Claude-Like_Theme)。标题使用 Source Serif 4，中文回退霞鹜文楷；正文使用思源黑体 / Noto Sans SC。 |

两套主题各有两种形态：主题选择器中的内置编辑器主题，以及 `themes/export/` 下的 HTML/PDF 导出主题。两者都提供 `--reading-font-title`、`--reading-font-heading`、`--reading-font-body` 三个变量，覆写这三个即可分别更换大标题、小标题与正文字体。启动时侧栏默认展开并打开当前文档的目录。

### 导入 Typora 主题

```bash
node scripts/import-typora-theme.mjs <typora主题.css> --name <名称> --out-dir <目录>
```

会产出 `<名称>-marktext.css`（编辑器）、`export/<名称>.css`（HTML/PDF）与 `<名称>-report.md`——报告列出被丢弃的规则、未映射的选择器与变量，以及覆盖率数字。依赖 Typora 特有 DOM 结构或自带 JavaScript 的主题需要人工微调，报告会指明具体是哪些规则。选择器、变量与剥离三张表以纯数据模块的形式放在 `scripts/typora-map/`，便于在编辑器引擎更换时整表替换。

## 从源码构建

构建流程会取得上游源码树、应用反文的 commit，并产出已签名的发布产物。Node 版本钉在上游发布所用的版本（见 `.nvmrc`），pnpm 钉在上游 `packageManager` 字段声明的版本。

```bash
./scripts/build-release-from-source.sh 1.9.0
```

产物落在 `releases/<版本>/`：DMG、更新用 ZIP、`latest-mac.yml` 与 SHA-256 校验文件。

测试：

```bash
npm test               # 契约测试：源码化迁移、品牌、发布管线、主题转译器
npm run test:e2e       # Playwright：对打包后的 .app 跑启动冒烟与品牌断言
npm run test:muya-e2e  # Playwright：编辑器引擎自带的用例集（Chromium）
```

e2e 套件驱动的是真实打包应用，并会断言用户实际的 `~/Library/Application Support/marktext` 目录逐字节未被改动。

## 仓库结构

- `themes/` — 编辑器与导出 CSS 主题。
- `scripts/build-release-from-source.sh` — 源码 → DMG / ZIP / `latest-mac.yml` / 校验文件。
- `scripts/import-typora-theme.mjs`、`scripts/typora-import/`、`scripts/typora-map/` — Typora 主题转译器：六层 pipeline 与可替换的映射数据。
- `scripts/brand-app.sh`、`scripts/build-icon.sh`、`scripts/install-icon.sh` — 应用包本地化与图标工具。
- `quicklook/` — Finder Quick Look 预览扩展的 Swift 源码与 XcodeGen 工程定义。
- `icon/` — 应用图标源文件与成品，含 1.0 生产规范与留作参考的早期草稿。
- `tests/`、`tests-e2e/` — 契约测试与 Playwright 套件。
- `config/` — `app-update.yml`（更新源的唯一事实来源）与应用包的本地化 `InfoPlist` 字符串。
- `patches/` — 行内实时渲染的运行时 CSS，与源码树保持同步。

编辑器源码位于一份未提交到此处的上游 MarkText fork；本仓库存放定制、主题、工具链、测试与发布管线。

## Lens Design 色彩体系

- 孔雀蓝 `#1F566B` · 酒红 `#8E3B46` · 金色 `#B0883E` · 纸面 `#F4F6F8` · 文字 `#15181C`
- 中文排印字体：`LXGW WenKai`（霞鹜文楷），回退 `Noto Serif SC`、`Songti SC`
- 标题字体 `Cormorant Garamond`、小标题字体 `Spectral`——两者的中文字符均回退到霞鹜文楷
- 正文 / 界面：`Noto Sans`、`Noto Sans SC`，回退苹方 · 等宽：`JetBrains Mono`、`SF Mono`、Menlo
- Lens Design 的 H1 使用 700 粗体，确保西文标题与霞鹜文楷中文标题的视觉重量一致

## 兼容性

- 应用路径：`/Applications/Reversion.app`
- 用户数据：`~/Library/Application Support/marktext`——刻意与 MarkText 保持一致，这是既有设置与更新链得以延续的原因
- Bundle ID：`com.github.marktext.marktext`，出于同样原因保持不变
- 仅 Apple Silicon；目前不产出 Intel 与 Universal 构建

## 许可证与声明

本项目使用 MIT 许可证。上游版权、许可证、字体与商标说明见 [`LICENSE`](LICENSE) 与 [`NOTICE.md`](NOTICE.md)。

来源：

- MarkText: https://github.com/marktext/marktext
- Typora Claude-like 主题页: https://theme.typora.io/theme/Claude-Theme/
- Claude-like 源主题: https://github.com/Muyiiiii/Typora_Claude-Like_Theme
