# Reversion 1.3.0

本次更新完成编辑器内核迁移，并补齐在线更新过程的可见反馈与文档保护。

## 编辑器内核

- 从旧 Muya 编辑器迁移到 TypeScript 重写的 `@muyajs/core`，与 MarkText 当前开发线重新对齐。
- 合入上游输入法修复：代码块组合输入不再因重高亮丢失锚点；组合态按 Backspace / Delete 时保持正确光标位置。
- 保留既有偏好、历史记录、主题选择、行内实时渲染和 Finder Quick Look。

## 主题与排印

- Lens Design 与 Claude-like 已迁到新的 `.mu-*` DOM 词表。
- Typora 主题导入工具同步更新，生成的编辑器主题不再包含旧 `.ag-*` 选择器。
- 移除 Google Fonts 与 jsDelivr 远程字体引用，离线使用时不再产生相关 CSP 或网络错误。

## 在线更新

- 下载期间显示常驻进度卡，包含百分比、已下载容量、总量、速率与预计剩余时间。
- macOS Dock 同步显示下载进度。
- 支持取消与重新下载。
- 下载完成后不再自动强制退出。点击「重启并安装」时，反文会先提示保存未保存文档；取消保存或保存失败时保持应用打开。
- 新版本首次启动时显示本次更新说明，同一版本只显示一次；离线时使用下载阶段缓存的说明。

## 性能

新增 10,000 行混合文档生产构建基准，包含标题、中文与 Latin 混排段落、表格、公式、图片和代码块。本次发布机实测：

- renderer 就绪：1.019 秒
- 输入延迟 P95：34.9 ms
- 1 秒滚动采样：62 帧

## 兼容性

- Apple Silicon（arm64）
- macOS 应用路径：`/Applications/Reversion.app`
- 用户数据目录继续使用 `~/Library/Application Support/marktext`
- Bundle ID 继续使用 `com.github.marktext.marktext`
- 可从 1.2.0 通过应用内更新直接升级

反文采用稳定 ad-hoc 签名，未经 Apple 公证。首次打开如被 Gatekeeper 阻止，请在访达中按住 Control 点击应用，再选择「打开」。
