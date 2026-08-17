# Dev Flow

Dev Flow 是一个本地开发流程控制 Monorepo。共享 Go Core 通过本地 STDIO MCP 管理单仓库、
单活动任务；Codex 产品以显式 Skill 调用 Core，Core 仍是任务状态、流程转换、恢复判断与终态的
唯一权威。

当前仓库已经交付：

- Core Contract 0.1：SQLite 持久化、只读 Git 观察、八个正常阶段、五类恢复和恰好六个 MCP 工具；
- Feature 003 Codex 显式产品：Plugin、`dev-flow` Skill、本地 MCP 注册、显式 setup/remove，
  并完成真实 Codex create/restart/resume/`DONE`/remove 验收；
- Feature 005：不确定 mutation 的 read-before-retry 证明与 repository drift 加固；
- Feature 006 的确定性实现：固定 public package 合同、source-free 本地 tgz 安装、兼容升级、
  retained task reopen、两工作树发布准备、验证器、可恢复 publisher、final Journey 合同与
  finalization gate。

Feature 006 的确定性实现与合并前门禁 T001–T046 已通过。`dev-flow-codex@0.1.0` 已采用公开包
元数据，但尚未执行 npm/GitHub 真实发布。public npm publication、registry read-back、最终
registry-package Codex Journey 和公开 GitHub Release 仍由 Feature 006 的 T047–T050 完成。

```text
Codex explicit Skill
        │ local Plugin + STDIO MCP declaration
        ▼
dev-flow Core
        │
Application → Workflow / Recovery → read-only Git + SQLite
```

项目使用 [Apache License 2.0](LICENSE)，产品版本以根 [VERSION](VERSION) 为唯一
repository-visible source。

## 工具链

- Go `>= 1.26`；
- Node.js `>= 24`，且版本仍在官方支持周期；
- pnpm `>= 11 < 12`；
- 官方最新稳定版 Spec Kit。

完整范围见 [工具链兼容策略](docs/TOOLCHAIN-BASELINES.md)。安装根 workspace 时不执行脚本：

```bash
pnpm install --frozen-lockfile --ignore-scripts
```

## 使用边界

Core CLI 只接受 help、version 与精确的本地 STDIO 模式：

```bash
go run ./cmd/dev-flow --help
go run ./cmd/dev-flow version
DEV_FLOW_DATA_DIR="$(mktemp -d)" go run ./cmd/dev-flow mcp --stdio
```

最终公开发布后，标准 Codex 安装入口是：

```bash
npm install -g dev-flow-codex
dev-flow-codex setup
```

这两个 registry 命令是最终用户合同，不是当前发布完成声明；`dev-flow-codex` 的 public npm
publication 仍等待 T047–T050。普通 npm install/update/uninstall 只管理包文件，Codex 注册只能由
显式 `setup`/`remove` 修改，任务数据库默认保留。

Core 公开工具恰好是：

```text
dev_flow_server_info
dev_flow_open_task
dev_flow_get_task
dev_flow_get_next_action
dev_flow_apply_action
dev_flow_cancel_task
```

任务、输入、结果与恢复合同见
[Feature 002 MCP Tools](specs/002-govern-and-resume-single-repository-task/contracts/mcp-tools.md)。

## 证据边界

| 证据 | 当前状态 |
| --- | --- |
| Feature 003 真实 Codex create/restart/resume/`DONE`/remove | 已完成 |
| Feature 005 recovery 与 Feature 006 本地 tgz/lifecycle/upgrade 测试 | 已完成的确定性证据 |
| Feature 006 fake npm/gh publication、resume/conflict、finalization gate | 已完成的确定性 fixture 证据 |
| public npm、registry tarball、最终 registry-package Journey、GitHub assets/Release | 尚未执行 |

fake、fixture、静态合同和本地 tgz 证据不构成 public registry 或真实 Release 证据。

## 验证

本地与 Pull Request CI 共用一个 preparation-safe 入口：

```bash
pnpm run validate
```

当前入口依次检查 toolchain、工作区 whitespace、Go formatting、Codex 源文件和根脚本 allowlist、
DeepSeek zero-diff（提供 `RELEASE_BASE_SHA` 时）、release shell/Node/fake CLI 语法、Go release
contracts、Codex public package contract、`go list`/`go vet`/`go test ./...`、冻结 pnpm install、
workspace inventory，以及 Codex public source package 与 DeepSeek deferred skeleton 的 dry-pack。

该入口不调用 publisher，不读取 npm/GitHub 发布身份，不创建或推送 Tag，不创建/上传/发布
GitHub Release，不执行 npm publish，也不运行真实 Codex/DeepSeek Host Journey。

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
| `protocol/fixtures/` | Codex/DeepSeek 共用的 Core Contract 0.1 fixtures |
| `tests/contract/` | repository、Schema、MCP、package 与 release contracts |
| `packages/codex/` | public package metadata、launcher/lifecycle、Plugin、Skill、MCP 声明、runtime staging 合同与测试 |
| `packages/deepseek/` | deferred、未实现、未发布的私有 skeleton |
| `release/` | Release Schema、bounded fixtures 与 operator 文档；不存放生成制品 |
| `scripts/` | 本地 builder、两工作树 prepare、verifier、resumable publisher 与 final Journey evidence |

详细依赖与权威边界见 [架构文档](docs/ARCHITECTURE.md)，当前能力与非目标见
[产品定义](docs/PRODUCT.md)。

## 当前范围外

- T047–T050 的真实 npm、Git Tag、GitHub Release、registry-package Journey 与公开支持证据；
- DeepSeek product integration、Harness journey 与 publication；
- Linux、Windows、Intel Mac 或其他平台支持；
- Web UI、remote MCP、HTTP/SSE、authentication、telemetry、multi-repository 或 cross-host takeover；
- Core Git mutation、generic shell、自动 repository repair、自动更新、签名或 notarization。

## Spec Kit

活动 Feature 由 `.specify/feature.json` 或 `SPECIFY_FEATURE_DIRECTORY` 选择，不能只从 Git branch
推断。Feature 006 的现有规格包是本轮权威，不应重新生成：

```bash
export SPECIFY_FEATURE_DIRECTORY="$PWD/specs/006-publish-codex-installable-product"
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
- [Release operator 文档](release/README.md)
- [Feature 002 Core Contract 规格](specs/002-govern-and-resume-single-repository-task/spec.md)
- [Feature 003 Codex 产品规格](specs/003-codex-explicit-dev-flow/spec.md)
- [Feature 005 恢复加固规格](specs/005-recover-uncertain-actions-and-drift/spec.md)
- [Feature 006 发布规格包](specs/006-publish-codex-installable-product/README.md)
