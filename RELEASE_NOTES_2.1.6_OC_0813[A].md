# Reversion 2.1.6

2.1.6 将反文的正式安装包扩展到 Windows x64 与 Intel Mac，并继续提供 Apple Silicon 版本。

## 新增平台

- Windows 10 / 11 x64：提供可选择安装目录的 NSIS 安装包，并验证静默安装、应用启动与卸载流程。
- Intel Mac：提供原生 x64 DMG 与更新 ZIP，在 Intel runner 上完成构建、架构、版本、Bundle ID、资源与深度签名校验。
- Apple Silicon Mac：继续提供原生 arm64 DMG 与更新 ZIP，保持现有用户的升级路径。

## 更新与完整性

- `latest-mac.yml` 同时列出 arm64 与 x64 ZIP；electron-updater 会按 Mac 处理器选择对应文件。
- Windows 提供 `latest.yml` 与安装包 blockmap，为后续版本保留自动更新与差分下载能力。
- 安装包均提供 SHA-256 校验文件，正式 Release 另附汇总校验表。

## 签名说明

- macOS：稳定标识的 ad-hoc 签名，未经 Apple 公证；首次启动可能需要在访达中按住 Control 点击 →「打开」。
- Windows：本版未使用商业代码签名证书，SmartScreen 可能显示“未知发布者”。请只从本仓库 Releases 下载，并核对 SHA-256。

## 下载选择

- Windows x64：`Reversion-2.1.6-windows-x64-setup.exe`
- Intel Mac：`Reversion-2.1.6-x64.dmg`
- Apple Silicon Mac：`Reversion-2.1.6-arm64.dmg`
