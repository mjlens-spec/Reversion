# Reversion 2.1.5

2.1.5 修复 Claude like 与 Lens Design 在 macOS 夜间深色模式下自动变色的问题。

## 修复

- Claude like 与 Lens Design 恢复为原始浅色外观，不再跟随系统深色模式改变主题配色。
- 编辑器正文、侧栏、标题栏、底部标签区与 macOS 原生窗口底色统一使用主题原始色值，消除上下区域颜色不协调的问题。
- 其他内置浅色、深色主题继续沿用原有外观逻辑；Typora 导入主题和导出主题行为不变。

## 发布范围

- 平台：macOS Apple Silicon（arm64）
- 签名：稳定标识的 ad-hoc 签名
- Apple 公证：未公证
- 更新链：继续使用 `latest-mac.yml`、ZIP SHA-512 与独立 SHA-256 校验文件
