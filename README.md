# Dev Flow

Dev Flow 是一个本地开发流程控制 Monorepo。当前已实现 Feature 002 的共享 Go Core：它在一个
Git 仓库上维护一个 governed task，通过 SQLite 持久化，并使用官方 Go MCP SDK 在本地 STDIO
上公开 Core Contract 0.1。

```text
Host identity
    ↓ local STDIO MCP
dev-flow Core
    ↓
Application → Workflow / Recovery → read-only Git + SQLite
```

`packages/codex` 与 `packages/deepseek` 仍是私有非功能性边界；当前没有宿主 Skill、安装器、
可分发 runtime 或发布行为。项目使用 [Apache License 2.0](LICENSE)，产品版本以根
[VERSION](VERSION) 为唯一 repository-visible source。

## 工具链

- Go `>= 1.26`；
- Node.js `>= 24`，且版本仍在官方支持周期；
- pnpm `>= 11 < 12`；
- 官方最新稳定版 Spec Kit。

完整范围见 [工具链兼容策略](docs/TOOLCHAIN-BASELINES.md)。安装根 workspace 时不执行脚本：

```bash
pnpm install --frozen-lockfile --ignore-scripts
```

## CLI

```bash
go run ./cmd/dev-flow --help
go run ./cmd/dev-flow version
DEV_FLOW_DATA_DIR="$(mktemp -d)" go run ./cmd/dev-flow mcp --stdio
```

CLI 只接受 help、version 与精确的 `mcp --stdio`。MCP 使用现有 data directory 中的固定内部
SQLite 文件；没有 database-path flag、HTTP/SSE、listener、daemon 或远程 transport。

公开工具恰好是：

```text
dev_flow_server_info
dev_flow_open_task
dev_flow_get_task
dev_flow_get_next_action
dev_flow_apply_action
dev_flow_cancel_task
```

使用 MCP inspector 或合同测试 harness 调用服务。不要把手工 JSON-RPC 可解析当作产品证据。
任务、输入、结果与 recovery contract 见
[Feature 002 MCP Tools](specs/002-govern-and-resume-single-repository-task/contracts/mcp-tools.md)。

## 验证

本地与 Pull Request CI 共用一个入口：

```bash
pnpm run validate
```

该入口执行 toolchain、`git diff --check`、Go format/list/vet/test、repository contracts、冻结
pnpm install、workspace inventory，以及两个私有 host skeleton 的 dry-pack。验证不会发布包或
Release，不会运行真实 Codex/DeepSeek，不会修改用户配置，也不证明 Windows release、真实
宿主 transport 或安装行为。

## 目录边界

| 路径 | 当前所有权 |
| --- | --- |
| `cmd/dev-flow/` | 唯一 CLI 与本地 STDIO server lifecycle |
| `internal/domain/` | Task、Contract、Action、Outcome、稳定错误与 Core Limits |
| `internal/workflow/` | 唯一状态转换与 closed action payload authority |
| `internal/recovery/` | 唯一五类恢复与 repository reconciliation authority |
| `internal/repository/` | read-only Git observation 与 binding digest authority |
| `internal/store/` | SQLite snapshot、migration、CAS 与 repository claim |
| `internal/application/` | Core use-case orchestration |
| `internal/mcp/` | 六工具 thin adapter、strict JSON 与 typed result envelope |
| `protocol/fixtures/` | Codex/DeepSeek 将共用的 Core Contract 0.1 fixtures |
| `tests/contract/` | repository、Schema、MCP 与 fixture contract tests |
| `tests/journeys/` | Core restart/resume journey |
| `packages/codex/` | 非功能性私有 Codex skeleton |
| `packages/deepseek/` | 非功能性私有 DeepSeek skeleton |
| `release/` | 未实施的后续发布边界文档 |

详细依赖与权威边界见 [架构文档](docs/ARCHITECTURE.md)，当前能力与非目标见
[产品定义](docs/PRODUCT.md)。

## 当前范围外

未实现 Codex/DeepSeek product integration、真实 host journey、installation、publication、
Web UI、remote MCP、HTTP/SSE、authentication、telemetry、multi-repository、cross-host takeover、
Git mutation、generic shell、automatic repository repair 或 real-host recovery hardening。

## Spec Kit

活动 Feature 由 `.specify/feature.json` 或 `SPECIFY_FEATURE_DIRECTORY` 选择，不能只从 Git branch
推断。Feature 002 已有规格包，不应重新生成：

```bash
export SPECIFY_FEATURE_DIRECTORY="$PWD/specs/002-govern-and-resume-single-repository-task"
```

不要重复初始化已有 `.specify/` 或修改 `.agents/skills/speckit-*` 生成资产。

## 文档索引

- [贡献与代理规则](AGENTS.md)
- [项目 Constitution](.specify/memory/constitution.md)
- [产品定义](docs/PRODUCT.md)
- [架构与依赖边界](docs/ARCHITECTURE.md)
- [工具链兼容策略](docs/TOOLCHAIN-BASELINES.md)
- [Spec Kit 工作流](docs/SPEC-KIT-WORKFLOW.md)
- [Feature 依赖关系](docs/FEATURE-DEPENDENCIES.md)
- [路线图](docs/ROADMAP.md)
- [发布策略](docs/RELEASE-STRATEGY.md)
- [Feature 001 规格](specs/001-bootstrap-monorepo/spec.md)
- [Feature 001 仓库布局合同](specs/001-bootstrap-monorepo/contracts/repository-layout.md)
- [Feature 002 规格](specs/002-govern-and-resume-single-repository-task/spec.md)
- [Feature 002 实施计划](specs/002-govern-and-resume-single-repository-task/plan.md)
- [Feature 002 任务](specs/002-govern-and-resume-single-repository-task/tasks.md)
- [Feature 002 Quickstart](specs/002-govern-and-resume-single-repository-task/quickstart.md)
- [Feature 002 MCP 合同](specs/002-govern-and-resume-single-repository-task/contracts/mcp-tools.md)
- [Feature 002 状态机合同](specs/002-govern-and-resume-single-repository-task/contracts/state-machine.md)
- [Feature 002 需求检查表](specs/002-govern-and-resume-single-repository-task/checklists/requirements.md)
