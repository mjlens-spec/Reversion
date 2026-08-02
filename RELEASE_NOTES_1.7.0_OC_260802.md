# Reversion 1.7.0

本次版本重做工作区外壳与划选编辑工具，重点调整侧栏、常驻标签栏、导出入口和段落格式菜单。

## 改进

**工作区外壳。** 侧栏改为纸张色的横向「文件 / 搜索 / 目录」入口。活动入口展开文字，其他入口保持图标优先；侧栏开关、标签页、新建标签与导出入口集中到常驻工作区栏。

**导出入口。** 右上角只保留导出操作，继续支持 HTML、PDF、DOCX 与 PNG，并为有无当前文档分别提供清晰的可用状态。

**划选工具条。** 首行段落入口改为整行结构，二级菜单提供普通文本、H1–H6、项目符号、编号、待办、引用和代码等格式；下方按参考样式排列行内格式按钮，链接采用独立浅蓝色。

**选区与输入体验。** 支持跨段落格式转换、反向选区、输入法组合态抑制、Esc 分层关闭、键盘导航与焦点恢复。评论、提升写作和 AI 功能不在本版本范围内。

## 验收

- Muya 单元测试：1478/1478
- Desktop 单元测试：817/817
- Electron GUI 回归：12/12
- 行内格式回归：9/9
- 工具仓契约测试：98/98
- TypeScript、ESLint、Stylelint、production build：通过
- Sol 5.6 X-High 工程 Advisor / 视觉 Supervisor：GO

## 兼容性

- Apple Silicon（arm64）
- macOS 应用路径：\`/Applications/Reversion.app\`
- 用户数据目录继续使用 \`~/Library/Application Support/marktext\`
- Bundle ID 继续使用 \`com.github.marktext.marktext\`
- 反文采用稳定 ad-hoc 签名，未经 Apple 公证
