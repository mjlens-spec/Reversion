# Reversion 2.1.7

2.1.7 修复了点击导出后整个窗口变成白屏、看不到导出设置和进度的问题。

## 修复内容

- 修复 PDF、HTML、DOCX 与 PNG 导出对话框打开后，应用正文被错误设为透明且无法点击的问题。
- 正确限定模态窗口打开时的语义缩略图隐藏规则，只影响缩略图，不再影响整个应用页面。

## 验证

- 新增生产构建级的视觉回归测试，同时检查导出对话框的真实像素、顶层命中元素和点击行为。
- 验证 PDF 文件实际生成、导出成功回调、取消保存与连续两次导出。
- 完成 macOS Apple Silicon 安装包实机验证，并由 GitHub Actions 分别构建 macOS Apple Silicon、macOS Intel 与 Windows x64 正式产物。

## 下载选择

- Windows x64：`Reversion-2.1.7-windows-x64-setup.exe`
- Intel Mac：`Reversion-2.1.7-x64.dmg`
- Apple Silicon Mac：`Reversion-2.1.7-arm64.dmg`
