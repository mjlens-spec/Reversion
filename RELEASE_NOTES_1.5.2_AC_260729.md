# Reversion 1.5.2

引用块视觉修复，以及可在设置中切换的应用图标。

## 新增

**应用图标可切换。** 偏好设置 → 主题新增「应用图标」：内置四款——反 · 书法（默认，即当前图标）、手写线稿、W · 深色、W · 浅色。选择后立即生效，作用于程序坞（Dock）、Cmd+Tab 应用切换器与调度中心；访达中的应用图标由安装包固定，不随此设置变化。

## 修复

**引用块不再显示两根竖线。** 此前引擎默认竖线与主题左边框叠加，引用块左侧会出现两根线；现在只保留一根 4px 粗线。同时压缩了引用块的整体高度：单行引用上下各留约一个行高（块高约 54px，此前约 82px）。两套内置主题（Lens Design / Claude）同步修正。

## 兼容性

- Apple Silicon（arm64）
- macOS 应用路径：`/Applications/Reversion.app`
- 用户数据目录继续使用 `~/Library/Application Support/marktext`
- Bundle ID 继续使用 `com.github.marktext.marktext`
- 可从 1.2.0 / 1.3.x / 1.5.x 通过应用内更新直接升级

反文采用稳定 ad-hoc 签名，未经 Apple 公证。首次打开如被 Gatekeeper 阻止，请在访达中按住 Control 点击应用，再选择「打开」。
