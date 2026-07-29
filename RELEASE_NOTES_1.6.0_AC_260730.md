# Reversion 1.6.0

导出新增 Word 与长图两种格式，应用图标更新。

## 新增

**导出为 DOCX（Word）。** 文件 → 导出 → 导出为 DOCX，从 Markdown 源直接转换：标题、列表、表格、引用、代码块转为 Word 原生结构，公式转为 Word 原生公式（OMML，可在 Word 中继续编辑），`[TOC]` 转为 Word 可刷新的目录域，相对路径图片按文档所在目录解析。转换由 pandoc 完成，需自行安装（`brew install pandoc`），未安装时导出会给出提示；Word 文档的排版由 Word 自身决定，导出设置中的页面、主题、字体各项对其不生效。

**导出为 PNG 长图。** 文件 → 导出 → 导出为 PNG 长图，整篇文档渲染成一张不分页的完整长图。导出设置新增「图片」页：图片宽度（400–2000 px）、分辨率（标准 1 倍 / 高清 2 倍）、页边距、背景颜色。样式沿用导出主题与字体设置，与 HTML 导出一致；图片高度按正文实际内容裁切，不留空白。

**应用图标更新。** 新图标为墨绿手写 W 配报纸纸纹，同时用于访达、程序坞与安装包。偏好设置 → 主题的「应用图标」选择器随之增至五款；此前使用默认图标的用户会一并更新为新图标，手动选过其他图标的保持原选择。

## 兼容性

- Apple Silicon（arm64）
- macOS 应用路径：`/Applications/Reversion.app`
- 用户数据目录继续使用 `~/Library/Application Support/marktext`
- Bundle ID 继续使用 `com.github.marktext.marktext`
- 可从 1.2.0 / 1.3.x / 1.5.x 通过应用内更新直接升级
- DOCX 导出需要本机安装 pandoc；其余功能无外部依赖

反文采用稳定 ad-hoc 签名，未经 Apple 公证。首次打开如被 Gatekeeper 阻止，请在访达中按住 Control 点击应用，再选择「打开」。
