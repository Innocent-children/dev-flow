# 工具链兼容策略

[中文](TOOLCHAIN-BASELINES.md) | [English](TOOLCHAIN-BASELINES_en.md)

本页说明仓库开发、构建与 Host 兼容要求。最低版本或兼容主版本范围用于判断可用性；锁文件、构建日志和发布记录保存实际解析版本。具体 CI 选择由工作流配置决定，固定构建工具版本不等于拒绝其他兼容补丁版本。

## 开发工具链

| 工具 | 要求 | 维护位置 |
| --- | --- | --- |
| Go | `>=1.26`；使用受支持的稳定版本 | `go.mod` 声明语言下限，`go.sum` 记录依赖；非必要不指定精确 toolchain 补丁号 |
| Node.js | 仓库开发与 Host Adapter 使用 `>=24`，且处于官方支持周期 | 对应 `package.json` 声明范围，CI 配置选择执行版本 |
| pnpm | `>=11 <12` | 根 `package.json` 声明范围，`pnpm-lock.yaml` 记录实际依赖 |

Node.js 承担包工具和 Host 适配，Go Core 承担共享任务运行时。各公开包的运行环境见[支持矩阵](SUPPORT-MATRIX.md)，不从仓库工具链推导稳定支持。

## 平台构建与原生验证

当前构建目标是两个精确 runtime pair：Go `darwin/arm64` 对应 Node `darwin-arm64`，Go `windows/amd64` 对应 Node `win32-x64`。npm 的 `os` 与 `cpu` 只能独立预筛选，运行时选择器核对实际配对。

`scripts/build-core-runtimes.mjs` 负责双 runtime 构建，报告产物路径、GOOS、GOARCH、Core 版本、大小与 SHA-256。本地打包和发布 staging 在仓库外构建产物，源码包不保留预编译 Core。

macOS 与 Windows 的原生检查分别执行。交叉编译证明产物可构建，不代表目标系统或实际 Host 已完成运行验证；Windows CI runner 也不构成 Windows Server 支持声明。检查入口见[脚本说明](../scripts/README.md)，正式发布要求见[发布说明](../release/README.md)。

## Core 依赖

| 依赖 | 兼容范围与用途 |
| --- | --- |
| `github.com/modelcontextprotocol/go-sdk` | `>=v1.7.0 <v2.0.0`；提供本地 STDIO Tools 接入 |
| `modernc.org/sqlite` | `v1`；通过 `database/sql` 提供无需 CGo 的 SQLite |

在兼容范围内选择符合最低 Go 要求的稳定依赖，由 `go.mod` 和 `go.sum` 记录实际版本。运行时不按精确 SDK 或驱动补丁号判断 Dev Flow 兼容性。Dev Flow 的工具、字段与行为以当前 Core 接口为准；SDK 提供的其他能力不自动成为产品功能。

## Host 兼容与重新验证

Host 技术说明和包配置记录最低支持版本及兼容范围，验证记录保存实际使用的 Codex 或 DSH 版本。兼容补丁或次版本本身不构成拒绝启动的理由。接口发生不兼容变化时，更新受影响的实现、版本范围、技术说明及针对性验证。

工具链或 Host 依赖变更应说明：当前范围、实际测试版本、变更原因、影响的接口与行为、对应源码和检查，以及是否需要真实 Host 流程验证。只验证本次变更影响的范围，不附带引入无关产品功能。

## 桌面宠物构建

macOS arm64 本地构建需要 Node.js `>=24` 和 Xcode `>=27`（包含 macOS SDK `>=27`）。构建前输出并检查所选 Xcode、Swift 和 SDK；命令失败时保留标准输出和标准错误。Swift Package 与应用 metadata 的部署目标是 macOS 14；最低系统运行尚未验证。构建器装配素材、保留原生执行权限并进行 ad-hoc 签名；安装后的运行不依赖 Swift/Xcode。

Windows x64 桌面构建需要 Node.js `>=24`，Electron 和素材解析依赖由 `packages/desktop-pet/windows/package-lock.json` 锁定。这些依赖只进入 Windows 桌面包。构建步骤见[桌面宠物指南](DESKTOP-PETS.md)。
