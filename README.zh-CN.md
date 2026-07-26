# Reversion · 反文

[English](README.md) | **简体中文**

<img src="icon/lens-marktext-icon.png" alt="反文图标" width="128" align="right" />

Reversion 的中文名称是「反文」。它是一款面向 macOS 的所见即所得 Markdown 编辑器，以 [MarkText](https://github.com/marktext/marktext) `0.19.1` 为基础，加入行内实时渲染、Finder Quick Look、两套编辑器与导出主题，以及书法「攵」应用图标。Reversion `1.1.0` 通过本仓库的 GitHub Release 提供后续自动更新。

本项目继续复用 MarkText 的应用数据目录和 Bundle ID，以保留已有设置、历史记录和自动更新连续性。源码仓库不提交 MarkText 二进制文件或 `app.asar`，预构建 DMG 见[下载](#下载)。

## 核心功能

- **行内实时渲染**：默认进入 Muya 所见即所得编辑器。粗体、斜体、链接、行内代码、数学公式等内容实时排版；光标进入语法范围时显示 Markdown 标记，移开后自动隐藏。
- **Finder Quick Look**：`Reversion.app` 内置原生 macOS Quick Look Preview Extension。Finder 选中 Markdown 文件并按空格即可查看标题、列表、引用、代码块、表格和行内格式。
- **双语产品名称**：英文系统显示 `Reversion`，简体与繁体中文系统显示「反文」。About 页面保留 `Reversion · 反文` 双语标识。

## 下载

预构建的 `arm64` macOS DMG 发布在 [Releases 页面](https://github.com/mjlens-spec/Reversion/releases)。`1.1.0` 起的文件名使用 `Reversion-<版本>-arm64.dmg`，内含 Reversion 应用、Quick Look 扩展、许可证与声明文件。

应用会在首个窗口打开 15 秒后静默检查本仓库的最新稳定版。发现新版时会询问是否下载并安装；没有新版时不打扰。也可以随时使用 Reversion 菜单中的「检查更新」。

应用仅做了带稳定应用标识的 ad-hoc 签名，**未经 Apple 公证**。该标识供同一应用的更新包互相校验；更新文件同时使用 GitHub HTTPS 和 `latest-mac.yml` 中的 SHA-512 校验。首次启动时，macOS Gatekeeper 可能要求在访达中按住 Control 点击 → 打开。

## 主题

| 主题 | 风格 |
| --- | --- |
| **Lens Design** | 冷调纸面上的孔雀蓝 / 酒红 / 金色点缀，基于 Lens Design 色彩与排印体系。大标题使用 Cormorant Garamond，中文回退到霞鹜文楷（LXGW WenKai）；小标题使用 Spectral，中文同样回退到霞鹜文楷；正文使用 Noto Sans / Noto Sans SC；正文为 17 px、行高 1.7。 |
| **Claude-like** | 暖调米白纸面配陶土色强调色，改编自 Typora 的 [Claude-like 主题](https://github.com/Muyiiiii/Typora_Claude-Like_Theme)。标题使用 Source Serif 4，中文回退到霞鹜文楷（LXGW WenKai），正文使用思源黑体 / Noto Sans SC。 |

两套主题各有两种形态：

- 内置编辑器主题（`themes/lens-design-marktext.css`、`themes/claude-like-marktext.css`），注入 Reversion 的主题选择器。
- HTML/PDF 导出主题（`themes/export/lens-design.css`、`themes/export/claude-like.css`）。
- 阅读排版提供 `--reading-font-title`、`--reading-font-heading`、`--reading-font-body` 三个独立字体槽位，主题可以分别设定大标题、小标题和正文。
- 启动时默认展开左侧侧栏，并打开当前文档的目录（TOC）。

## 仓库结构

- `themes/` — 编辑器与导出 CSS 主题。
- `icon/` — 应用图标的源文件与成品：`lens-marktext-pu-v1-source.png`（原始生成稿）、`lens-marktext-pu-v1-alpha.png`（带透明圆角的生产源文件）、`lens-marktext-icon.png`（1024 px）、`lens-marktext-icon.icns`、1.0 生产规范，以及留作参考的早期草稿。
- `patches/` — 行内实时渲染所需的运行时 CSS。
- `quicklook/` — 原生 Finder Quick Look Preview Extension 的 Swift 源码和 XcodeGen 工程定义。
- `scripts/install-builtin-themes.sh` — 备份 `app.asar`，安装 Reversion 运行时、主题、双语品牌名称和 Quick Look 扩展，再做 ad-hoc 签名。
- `scripts/install-theme.sh` — 备份 `preferences.json`，安装导出主题，清空 Custom CSS，并选中 `lens-design`。
- `scripts/build-icon.sh` — 从 PNG 源图构建 `.icns`（需要 ImageMagick：`brew install imagemagick`）。
- `scripts/install-icon.sh` — 备份 Reversion 应用图标文件并替换，对应用做 ad-hoc 签名，刷新图标缓存。
- `scripts/build-release.sh` — 构建带稳定应用标识签名的应用、自动更新 ZIP、`latest-mac.yml`、DMG 与校验文件。

## 从源码安装

安装 Reversion 运行时、内置主题、品牌名称和 Quick Look 扩展：

```bash
./scripts/install-builtin-themes.sh
```

安装用户偏好设置与导出主题：

```bash
./scripts/install-theme.sh
```

构建并安装图标：

```bash
./scripts/build-icon.sh
./scripts/install-icon.sh
```

默认图标源文件已切换为 1.0 版书法「攵」资产。需要构建其他图标时，可以向 `build-icon.sh` 传入另一张 PNG 或 SVG，不影响默认版本。

安装后请重启 Reversion。访达与程序坞的图标缓存可能滞后；如果仍显示旧图标，退出并重新启动一次 Reversion 即可。

## Lens Design 色彩体系

- 孔雀蓝：`#1F566B`
- 酒红：`#8E3B46`
- 金色：`#B0883E`
- 纸面：`#F4F6F8`
- 文字：`#15181C`
- 中文排印字体：`LXGW WenKai`（霞鹜文楷，兼容中文字体名写法），回退 `Noto Serif SC`、`Songti SC`
- 标题字体：`Cormorant Garamond`；小标题字体：`Spectral`；两者的中文字符均回退到霞鹜文楷
- 正文字体：`Noto Sans`、`Noto Sans SC`，回退 Apple/苹方
- 等宽字体：`JetBrains Mono`、`SF Mono`，回退 Menlo
- 阅读映射：大标题使用字标字体，小标题使用 display 字体，正文使用无衬线字体；编辑器默认值为 `Cormorant Garamond`、`Spectral`、`Noto Sans SC`，并保留主题自己的霞鹜文楷中文回退链。修改三个 `--reading-font-*` 变量即可独立换字。
- Lens Design 编辑器 H1 使用 700 粗体，确保英文标题与霞鹜文楷中文标题的视觉重量一致。

## 兼容性

Reversion `1.1.0` 以 macOS 上 MarkText `0.19.1` 的应用包结构为基础：

- 默认应用路径：`/Applications/Reversion.app`，首次迁移时也接受 `/Applications/MarkText.app`
- 用户数据：`~/Library/Application Support/marktext`
- 内置应用归档：`/Applications/Reversion.app/Contents/Resources/app.asar`

保留原用户数据路径与 Bundle ID 是兼容性选择。如果上游 MarkText 更改应用包结构，升级前需先检查补丁脚本。

## 许可证与声明

本项目使用 MIT 许可证。上游版权、许可证、字体与商标说明见 [`LICENSE`](LICENSE) 与 [`NOTICE.md`](NOTICE.md)。

来源：

- MarkText: https://github.com/marktext/marktext
- Typora Claude-like 主题页: https://theme.typora.io/theme/Claude-Theme/
- Claude-like 源主题: https://github.com/Muyiiiii/Typora_Claude-Like_Theme
