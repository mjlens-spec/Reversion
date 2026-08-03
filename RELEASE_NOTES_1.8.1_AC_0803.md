# Reversion 1.8.1

本次版本继续调整左侧侧栏的视觉密度：内容区四周增加统一留白，并将侧栏所有视图的字号整体缩小 1 px。

## 改进

**侧栏内容四周统一留白。** 文件、搜索与目录视图现在都位于 8 px 的内容边距内，侧栏上下左右不再紧贴边缘；侧栏本身的外部宽度保持不变。

**侧栏字号整体缩小 1 px。** 顶部入口、文件与文件夹、搜索框与搜索结果、目录标题与条目、Element Plus 按钮，以及底部字数统计均在原有字号基础上缩小 1 px，原有层级关系保持不变。

**自适应与滚动行为保持稳定。** 双击分隔条自动适配宽度时会计入新增的 16 px 横向留白；文件树、搜索与目录继续在各自内容区内滚动，文件选中态、当前态和不支持格式的暗灰禁用态均未改变。

## 验收

- Desktop 完整单元测试：838/838
- 侧栏定向单元测试：21/21
- 侧栏真实渲染验收：1/1，逐项核对四边 8 px、三个视图及 Element Plus 控件的计算后字号
- 正式打包应用 E2E：20/20
- 工具仓契约测试：98/98
- TypeScript、ESLint、production build：通过
- DMG 与更新 ZIP 的 SHA-256、ZIP 完整性、DMG 校验、`latest-mac.yml` 的版本/大小/SHA-512：通过
- 正式应用版本、arm64 架构、指定要求与深度签名：通过
- Sol 5.6 X-High 最终工程审查：APPROVED

## 兼容性

- Apple Silicon（arm64）
- macOS 应用路径：`/Applications/Reversion.app`
- 用户数据目录继续使用 `~/Library/Application Support/marktext`
- Bundle ID 继续使用 `com.github.marktext.marktext`
- 反文采用稳定 ad-hoc 签名，未经 Apple 公证
