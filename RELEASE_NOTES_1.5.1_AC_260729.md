# Reversion 1.5.1

侧栏分隔条双击自适应，以及两套内置主题的阅读排版调整。

## 新增

**双击分隔条，侧栏宽度自适应。** 目录（或文件树、搜索）与正文之间的分隔条现在支持双击：侧栏自动调整到当前面板内容的自然宽度——条目完整显示、不再截断。宽度有上限保护：始终为正文预留完整的内容列宽，再长的目录也不会把正文挤窄；下限维持 220px。拖拽调宽的行为不变。

## 调整

**两套内置主题的正文列加宽约 10%。** Lens Design 由 760px 调至 836px，Claude 由 820px 调至 900px。在偏好设置里自定义过编辑区宽度的用户不受影响。

**一级标题字号回落。** 此前 H1 明显大于 H2（Lens Design 2.4em、Claude 2.1em），在长文中过于抢占版面。现在 H1 只比 H2 略大一级：Lens Design 1.9em（H2 1.78em），Claude 1.7em（H2 1.58em）。层级仍可分辨，阅读节奏更稳。

## 兼容性

- Apple Silicon（arm64）
- macOS 应用路径：`/Applications/Reversion.app`
- 用户数据目录继续使用 `~/Library/Application Support/marktext`
- Bundle ID 继续使用 `com.github.marktext.marktext`
- 可从 1.2.0 / 1.3.x / 1.5.0 通过应用内更新直接升级

反文采用稳定 ad-hoc 签名，未经 Apple 公证。首次打开如被 Gatekeeper 阻止，请在访达中按住 Control 点击应用，再选择「打开」。
