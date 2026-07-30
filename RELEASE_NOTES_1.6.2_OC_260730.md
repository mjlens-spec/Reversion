# Reversion 1.6.2

本次更新调整目录栏的长标题显示与启动宽度。

## 改进

**目录长标题自动换行。** 标题超出目录栏可用宽度后会继续显示在下一行，完整内容无需悬停即可阅读。目录不再出现横向滚动，长标题也不会以省略号截断。

**启动时恢复白银比例。** 每次打开应用，目录栏与正文栏都会按 `1 : 2.414` 恢复。当前使用期间仍可自由拖动目录宽度；关闭后再次打开，会根据当时的窗口宽度重新计算。窄窗口继续保留 `220 px` 最小目录宽度。

## 兼容性

- Apple Silicon（arm64）
- macOS 应用路径：`/Applications/Reversion.app`
- 用户数据目录继续使用 `~/Library/Application Support/marktext`
- Bundle ID 继续使用 `com.github.marktext.marktext`
- 可从 1.2.0 / 1.3.x / 1.5.x / 1.6.0 / 1.6.1 通过应用内更新直接升级

反文采用稳定 ad-hoc 签名，未经 Apple 公证。首次打开如被 Gatekeeper 阻止，请在访达中按住 Control 点击应用，再选择「打开」。
