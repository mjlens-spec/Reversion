# Reversion 1.9.1

本次版本完成工作区顶部与底部布局调整，让侧栏、正文标题、分隔线和标签页形成更清晰的空间层级。

## 改进

**目录位置上移。** 左侧「目录」入口与内容区域向上微调，减少顶部空隙。

**分栏按钮移入侧栏。** 分栏按钮从正文顶部移到侧栏右上角，和侧栏本身的控制范围保持一致。

**标签页移至正文底部。** 标签栏固定在整个正文区域的下方，正文顶部保留给标题与写作内容。

**横线统一对齐。** 正文区域的横向分隔线与左侧分栏页的横线使用同一条工作区基准线。

**标题居中。** 当前文档标题在正文区域内水平居中，并在顶部工作区栏中调整到合适的垂直位置。

## 验收

- Desktop 完整单元测试：850/850
- 布局相关 Electron E2E：17/17
- 工具仓契约测试：98/98
- TypeScript、ESLint、production build：通过
- arm64 DMG、更新 ZIP、`latest-mac.yml`：已生成并完成 SHA-256 / SHA-512 / ZIP / DMG 校验
- 正式包内版本号：`1.9.1`

## 兼容性

- Apple Silicon（arm64）
- macOS 应用路径：`/Applications/Reversion.app`
- 用户数据目录继续使用 `~/Library/Application Support/marktext`
- Bundle ID 继续使用 `com.github.marktext.marktext`
- 反文采用稳定 ad-hoc 签名，未经 Apple 公证
