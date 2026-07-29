# Reversion 1.6.1

导出弹窗的两处修复。

## 修复

**表格工具条不再盖在导出弹窗上。** 打开导出设置后，鼠标划过弹窗时，若弹窗背后正好是表格，编辑器的表格列工具条会浮在弹窗最上层，挡住标签页与选项。编辑器的浮动工具条挂在页面顶层且按坐标命中判定，不受弹窗遮挡影响；现在弹窗打开期间编辑器不再参与命中判定，工具条不会再冒出来。

**导出弹窗新增取消按钮。** 此前只能按 Esc 或点击弹窗外部退出。取消按钮采用弱化配色，位于「导出」左侧；已调整的导出设置照常保留。

## 兼容性

- Apple Silicon（arm64）
- macOS 应用路径：`/Applications/Reversion.app`
- 用户数据目录继续使用 `~/Library/Application Support/marktext`
- Bundle ID 继续使用 `com.github.marktext.marktext`
- 可从 1.2.0 / 1.3.x / 1.5.x / 1.6.0 通过应用内更新直接升级

反文采用稳定 ad-hoc 签名，未经 Apple 公证。首次打开如被 Gatekeeper 阻止，请在访达中按住 Control 点击应用，再选择「打开」。
