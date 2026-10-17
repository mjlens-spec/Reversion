# Reversion 2.1.8

2.1.8 修复行内公式不显示、单行 `$$` 公式不渲染，以及从网页复制公式后粘贴成乱码的问题（[#31](https://github.com/mjlens-spec/Reversion/issues/31)）。

## 修复内容

- 光标离开后，行内公式、注音、emoji 短代码与 HTML 实体恢复正常显示，不再只留下空白
- 行内公式完整显示，不再被截断并出现横向滚动条；编辑公式时的预览弹层同样修复
- 单行书写的 `$$…$$` 按展示公式渲染，与 HTML 导出一致，单独成段时居中显示；Markdown 源文保持原样
- 从 ChatGPT、Gemini、DeepSeek 等使用 KaTeX 渲染的网页以及维基百科复制公式，粘贴后还原为 `$…$` 或 `$$` 公式块，不再变成「3P」这类乱码

## 验证

- 编辑器引擎单元测试 1492 项、CommonMark / GFM 规范一致性 1347 项、桌面端单元测试 897 项、输入法矩阵 72 项全部通过
- 新增回归测试：打包版公式不透明度断言、单行 `$$` 渲染与居中、百分比版心下公式与预览弹层不截断、KaTeX 与 MathML 网页公式粘贴还原
- 完成 macOS Apple Silicon 构建实机验证，并由 GitHub Actions 分别构建 macOS Apple Silicon、macOS Intel 与 Windows x64 正式产物

## 下载选择

- Windows x64：`Reversion-2.1.8-windows-x64-setup.exe`
- Intel Mac：`Reversion-2.1.8-x64.dmg`
- Apple Silicon Mac：`Reversion-2.1.8-arm64.dmg`
