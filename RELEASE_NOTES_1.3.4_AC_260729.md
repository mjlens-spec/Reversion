# Reversion 1.3.4

修复 Finder Quick Look 预览中的表格排版。

## 修复

**Quick Look 表格错位。** 此前预览把表格的每一行原样打印在等宽字体里，靠字符宽度自行对齐——而等宽字体只对拉丁字母等宽，含中文的单元格必然错开列；较长的行会折到下一行，`| --- | --- |` 这样的分隔行也会作为正文显示出来。

现在按 GFM 规则解析表格：表头行、决定列数与每列对齐方式的分隔行、正文行（列数不足补空、超出截断），再交由系统的文本表格排版，自动计算列宽、在单元格内折行并绘制边框。表头以浅底加粗区分，`:---` / `---:` / `:---:` 的左中右对齐均生效。

没有合法分隔行的管道符行在 GFM 中本就不是表格，仍按原文显示，不会被误判成表格。

## 兼容性

- Apple Silicon（arm64）
- macOS 应用路径：`/Applications/Reversion.app`
- 用户数据目录继续使用 `~/Library/Application Support/marktext`
- Bundle ID 继续使用 `com.github.marktext.marktext`
- 可从 1.2.0 / 1.3.x 通过应用内更新直接升级

反文采用稳定 ad-hoc 签名，未经 Apple 公证。首次打开如被 Gatekeeper 阻止，请在访达中按住 Control 点击应用，再选择「打开」。
