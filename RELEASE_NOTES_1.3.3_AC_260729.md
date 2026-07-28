# Reversion 1.3.3

三项修复，均为 1.3.2 使用中反馈的问题。

## 修复

- **打开文件后立即显示字数。** 此前字数只在内容发生变化时才写入，因此打开一份文档后标题栏一直显示 0，直到敲下第一个字。现在文档载入时即完成统计。
- **偏好设置窗口标题不再被窗口按钮遮挡。** 左栏内容此前从距顶 24 像素处开始，落在窗口为标题栏预留的 32 像素区域内——macOS 正是在这条区域绘制红黄绿按钮，因而压在「偏好设置」四个字上。现改为从该区域下方开始排布。
- **偏好设置窗口的分类图标统一为 Material Symbols。** 通用、编辑器、Markdown、拼写、主题、图片、快捷键七项此前仍是另一套图标，与主窗口侧栏和编辑器工具条不一致。

## 兼容性

- Apple Silicon（arm64）
- macOS 应用路径：`/Applications/Reversion.app`
- 用户数据目录继续使用 `~/Library/Application Support/marktext`
- Bundle ID 继续使用 `com.github.marktext.marktext`
- 可从 1.2.0 / 1.3.x 通过应用内更新直接升级

反文采用稳定 ad-hoc 签名，未经 Apple 公证。首次打开如被 Gatekeeper 阻止，请在访达中按住 Control 点击应用，再选择「打开」。
