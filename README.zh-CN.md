# Reversion · 反文

[English](README.md) | **简体中文**

<img src="icon/lens-marktext-icon.png" alt="反文图标" width="128" align="right" />

Reversion 的中文名称是「反文」，是一款面向中文写作的 macOS 所见即所得 Markdown 编辑器。它基于 [MarkText](https://github.com/marktext/marktext) `v0.20.0-rc.1` 与 TypeScript 编辑器引擎 `@muyajs/core`，加入行内实时渲染、原生 Finder Quick Look 扩展、两套排印主题、Typora 主题导入工具，以及书法「攵」应用图标。

当前版本：**1.3.4**（Apple Silicon）。反文沿用 MarkText 的应用数据目录与 Bundle ID，因此从旧版本迁移时设置、历史记录与自动更新链均可延续。

## 核心功能

- **行内实时渲染** — 默认进入 Muya 所见即所得模式。粗体、斜体、链接、行内代码、数学公式随输入实时排版；光标进入语法范围时显示 Markdown 标记，移开后自动隐藏。
- **排印优先的主题** — 内置两套主题，各有三个独立的阅读字体槽位，可分别设定大标题、小标题与正文字体，并带一条不破坏西文字形度量的中文回退链。
- **Typora 主题导入** — 「主题 ▸ 导入主题（Typora 兼容）」在应用内把 Typora 主题的 CSS 转译为反文的编辑器主题与配套 HTML/PDF 导出主题，并输出兼容报告列出无法映射的规则。同一条流水线也以 `scripts/import-typora-theme.mjs` 形式提供。已在 Typora 六套内置主题上验证。
- **Finder Quick Look** — 应用内置原生 macOS Quick Look 预览扩展。在访达中选中 Markdown 文件按空格，即可预览标题、列表、引用、代码块、表格与行内格式。
- **图表与公式** — Mermaid 11、Vega-Lite、PlantUML、flowchart.js 与 KaTeX。
- **全文搜索** — 基于 ripgrep 的项目内搜索，支持排除规则与符号链接处理。
- **双语产品名称** — 英文系统显示 `Reversion`，简体与繁体中文系统显示「反文」。关于页面使用 `Reversion · 反文`。

## 下载

预构建的 `arm64` DMG 发布在 [Releases 页面](https://github.com/mjlens-spec/Reversion/releases)。每个版本同时提供 `Reversion-<版本>-arm64.dmg`、更新用 ZIP、`latest-mac.yml` 与 SHA-256 校验文件。

应用会在首个窗口打开 15 秒后检查本仓库是否有更新的稳定版，没有新版时不打扰。发现新版后，右下方常驻进度卡会显示百分比、已下载容量、速率与预计剩余时间，不阻塞编辑。重启安装前会先处理未保存文档；新版本启动后，更新说明只显示一次。也可随时使用「Reversion → 检查更新」。

应用采用带稳定应用标识的 ad-hoc 签名，**未经 Apple 公证**。该稳定标识用于让相邻版本互相校验；下载另有 GitHub HTTPS 与 `latest-mac.yml` 中的 SHA-512 校验保护。首次启动时，macOS Gatekeeper 可能要求在访达中按住 Control 点击 →「打开」。

## 1.3.4 更新内容

- **Quick Look 表格排版。** 预览此前把表格每一行原样打印在等宽字体里靠字符宽度对齐——等宽字体只对拉丁字母等宽，含中文的单元格必然错列，长行会折到下一行，`| --- | --- |` 分隔行也被当作正文显示。现按 GFM 规则解析并交由系统文本表格排版：自动计算列宽、单元格内折行、绘制边框、表头浅底加粗，分隔行中的 `:---` / `---:` / `:---:` 对齐方式生效。

1.3.3 已修复打开文件不显示字数、偏好设置标题被 macOS 窗口按钮遮挡，并统一了偏好设置分类图标。

完整说明见 [Releases](https://github.com/mjlens-spec/Reversion/releases/tag/v1.3.4)。

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
./scripts/build-release-from-source.sh 1.3.4
```

产物落在 `releases/<版本>/`：DMG、更新用 ZIP、`latest-mac.yml` 与 SHA-256 校验文件。

测试：

```bash
npm test          # 契约测试：源码化迁移、品牌、发布管线、主题转译器
npm run test:e2e  # Playwright：对打包后的 .app 跑启动冒烟与品牌断言
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
