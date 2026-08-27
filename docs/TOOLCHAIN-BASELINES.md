# Toolchain Compatibility Policy

**Policy reviewed on**: 2026-08-14

工具链要求使用最低版本或兼容主版本范围。开发机、CI 和宿主不得通过“版本必须等于某个补丁号”的方式判断可用性。

实际解析版本仍会出现在 `go.mod`、`go.sum`、`pnpm-lock.yaml`、构建日志和发布清单中；这些是复现与证据记录，不是对兼容补丁或次版本的拒绝规则。

## Go

- Minimum: `>= 1.26`；
- `go.mod` language floor: `go 1.26`；
- Release history: <https://go.dev/doc/devel/release>。

开发机可使用任何受官方支持且不低于最低版本的稳定 Go。CI 默认使用当前稳定版，并依靠 `go.mod` 的语言版本约束避免意外使用更高语言级别。不要写入精确 `toolchain goX.Y.Z`，除非独立规格证明必须这样做。

## Node.js

- Minimum: `>= 24`；
- Requirement: 所用版本仍处于官方 Current、Active LTS 或 Maintenance LTS 支持周期；
- Release schedule: <https://nodejs.org/en/about/previous-releases>。

Node.js 只用于 Monorepo 包工具和宿主适配，不是共享流程 Runtime。CI 使用当前 LTS，而不是固定一个补丁版本。

## pnpm

- Supported range: `>= 11 < 12`；
- Registry: <https://www.npmjs.com/package/pnpm>。

根 `package.json` 使用 `engines.pnpm` 表达范围，不要求精确 `packageManager` 补丁号。CI 选择当前 11.x 稳定版；`pnpm-lock.yaml` 记录实际解析结果。升级到新的主版本需要独立审查。

## Model Context Protocol Go SDK

- Minimum compatible line: `github.com/modelcontextprotocol/go-sdk >= v1.7.0 < v2.0.0`；
- Releases: <https://github.com/modelcontextprotocol/go-sdk/releases>。

Feature `002` 实施时解析当时最新稳定的 v1 版本，并由 `go.mod`/`go.sum` 记录实际版本。运行时和宿主适配不得通过精确 SDK 补丁号判断 Dev Flow 兼容性；Dev Flow 自己的工具合同独立版本化。

Dev Flow 首版只使用本地 STDIO Tools。不要因为 SDK 提供 HTTP、OAuth、Sampling 或其他能力就扩大产品范围。

## SQLite Driver

- Module line: `modernc.org/sqlite v1`；
- Selection: Feature `002` 实施时使用与最低 Go 版本兼容的最新稳定 v1 版本；
- Package: <https://pkg.go.dev/modernc.org/sqlite>。

该驱动通过 `database/sql` 提供无需 CGo 的 SQLite。`go.mod` 和 `go.sum` 记录实际解析版本；规格和运行时不做补丁版本相等判断。

## Host Compatibility

Codex 与 DeepSeek Harness 的宿主功能规格必须在各自 `plan.md` 中定义：

1. 最低支持宿主版本；
2. 允许的兼容范围；
3. 当前最新稳定宿主版本的真实 journey；
4. 触发重新验证的宿主契约变化。

真实 journey 要记录实际宿主版本作为证据，但产品不得仅因为后来出现兼容的补丁或次版本就拒绝启动。若宿主公共契约发生不兼容变化，应通过新的规格调整最低版本或兼容范围。

## Revalidation Rules

工具链更新不能与无关产品功能混合。评审材料至少记录：

1. 当前最低版本或兼容范围；
2. 实际解析/测试版本；
3. 更新原因；
4. 与 Dev Flow 有关的 API 或行为变化；
5. 需要更新的源码、合同和测试；
6. 是否要重跑真实宿主证据；
7. 确认未顺带引入产品能力。
