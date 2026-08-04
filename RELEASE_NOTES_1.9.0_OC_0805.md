# Reversion 1.9.0

本次版本重新整理顶部标题栏的信息层级：文件名成为第一视觉重点，所在文件夹压缩为文件名后的浅灰路径标签。

## 改进

**文件名优先显示。** 当前文件名位于标题栏前方，以粗体显示，并隐藏最后一个扩展名。长文件名会在可用宽度内省略，完整文件名仍可通过悬停查看。

**文件夹位置显示为三级路径。** 文件名后方新增浅灰标签，最多展示距离文件最近的 3 级文件夹，并按父目录到子目录的顺序排列。例如：`联合利华 › 2607_OLLY_Y27_IMC › 02_策略与创意`。

**原有交互保持不变。** macOS 点击文件名重命名、未保存状态提示、窗口拖动与双击标题栏切换最大化继续可用。目录不足 3 级时按实际层级显示，Windows 盘符和不同路径分隔符也会正确处理。

## 验收

- Desktop 完整单元测试：846/846
- 标题栏逻辑覆盖率：语句、分支、函数、行均为 100%
- 标题栏真实 Electron 渲染验收：1/1
- 工具仓契约测试：98/98
- TypeScript、ESLint、production build：通过

## 兼容性

- Apple Silicon（arm64）
- macOS 应用路径：`/Applications/Reversion.app`
- 用户数据目录继续使用 `~/Library/Application Support/marktext`
- Bundle ID 继续使用 `com.github.marktext.marktext`
- 反文采用稳定 ad-hoc 签名，未经 Apple 公证
