# Dev Flow

Dev Flow 是一个 Monorepo，用于共同维护共享 Go Core 和两个宿主产品边界：

```text
dev-flow
├── dev-flow-codex
└── dev-flow-deepseek
```

当前仓库只完成 Feature 001 的工程骨架。根 Go 二进制仅提供有界的 `help` 和 `version`
占位输出；`packages/codex` 与 `packages/deepseek` 只是私有包元数据和说明文档，尚不能安装、
运行或集成宿主。两个产品以后可以独立发布，但共享 Core 只保留一份根 Go Module 源码。

项目使用 [Apache License 2.0](LICENSE)，当前产品版本以根 [VERSION](VERSION) 为唯一来源。

## 工具链要求

- Go `>= 1.26`；
- Node.js `>= 24`，且所用版本仍处于官方支持周期；
- pnpm `>= 11 < 12`；
- 官方最新稳定版 Spec Kit。

兼容性按版本范围检查，不要求某个 Go、Node.js、pnpm 或 Spec Kit 补丁版本。完整策略见
[工具链兼容策略](docs/TOOLCHAIN-BASELINES.md)。

## 准备仓库

在仓库根目录确认 Spec Kit 可用：

```bash
# 仅在尚未安装 Spec Kit 时执行
uv tool install specify-cli

specify self check
# 仅当 self check 报告存在更新时执行
specify self upgrade
```

只有在 `.specify/scripts/`、`.specify/templates/` 或
`.agents/skills/speckit-*/SKILL.md` 等 Spec Kit 生成资产缺失时，才运行初始化：

```bash
specify init --here --integration codex --script sh
```

已有这些资产时不得重复初始化，也不得手工修改 `.agents/skills/speckit-*`。初始化必须保留
现有的 `AGENTS.md`、`README.md`、`docs/`、`specs/` 和 Constitution。

为本仓库选择已经准备好的 Feature 001：

```bash
export SPECIFY_FEATURE_DIRECTORY="$PWD/specs/001-bootstrap-monorepo"
```

活动 Feature 由该环境变量或 Spec Kit 管理的选择状态确定，不能只根据 Git 分支推断。
Feature 001 的规格、计划和任务已经存在，不应重新运行 `speckit-specify`、`speckit-plan`
或 `speckit-tasks` 覆盖它们；实施工作按 [tasks.md](specs/001-bootstrap-monorepo/tasks.md)
的 Phase 顺序分阶段完成。

安装根 Workspace：

```bash
pnpm install --frozen-lockfile --ignore-scripts
```

## 使用占位程序

```bash
go run ./cmd/dev-flow --help
go run ./cmd/dev-flow version
```

这些命令只展示 Feature 001 的帮助和根版本；它们不会启动任务、MCP、Codex 或 DeepSeek。

## 有界验证

本地和 PR CI 共用同一个只读验证入口：

```bash
pnpm run validate
```

根 `package.json` 将该命令直接交给 `scripts/validate-repository.sh`。这个入口负责工具链范围、
当前工作区的 `git diff --check` 空白检查、Go 格式、`go list ./...`、`go vet ./...`、
`go test ./...`、冻结的 pnpm Workspace 安装与清单，以及两个私有产品包的 dry-pack 检查。
Workspace 安装使用 `--ignore-scripts`，dry-pack 通过 pnpm 的 `ignore-scripts` 配置禁用脚本，
因此验证不会执行依赖包或产品包的生命周期脚本。Go 合同测试负责仓库布局、包清单和
Markdown 相对链接。

这里的 `git diff --check` 只检查当前工作区相对索引的未暂存差异，不代表覆盖整个 PR 的提交
范围、已暂存差异或未跟踪文件。

验证不会发布包或 Release，不会运行真实 Codex/DeepSeek，不会修改用户配置，也不覆盖性能、
压力、fuzz、全平台矩阵或真实宿主 journey。`.github/workflows/ci.yml` 只为 pull request
提供只读权限并调用同一入口；它不拥有发布权限或发布凭据。

## 目录所有权

| 路径 | 当前所有权 |
| --- | --- |
| `cmd/dev-flow/` | Feature 001 唯一可执行入口，仅含 help/version 占位程序 |
| `internal/` | 共享 Go Core；当前仅包含骨架所需的版本读取代码 |
| `packages/codex/` | `dev-flow-codex` 私有产品骨架，不含运行时或宿主集成 |
| `packages/deepseek/` | `dev-flow-deepseek` 私有产品骨架，不含 Proxy、运行时或宿主集成 |
| `protocol/fixtures/` | 预留共享公开合同 fixture；当前没有产品协议 Schema |
| `tests/contract/` | 仓库布局、包清单和 Markdown 链接合同测试 |
| `scripts/` | 仓库开发与有界验证，不含安装或发布逻辑 |
| `release/` | 发布边界说明文档；当前不执行发布 |
| `.specify/`、`.agents/`、`specs/` | 单一根 Spec Kit 项目、生成的 Codex integration 与统一 Feature 序列 |
| `.github/workflows/` | 只读 PR 验证 |
| `docs/` | 仓库级产品、架构、工具链与工作流文档 |

详细边界和依赖方向见 [架构文档](docs/ARCHITECTURE.md) 与
[仓库布局合同](specs/001-bootstrap-monorepo/contracts/repository-layout.md)。

## 当前明确未实现

Feature 001 不包含 Feature 002，也没有实现任务状态机、SQLite、MCP、Codex 产品行为、
DeepSeek 产品行为、安装、升级、卸载或发布。两个产品包保持 `private: true`，没有 `bin`、
任何非空 `scripts`、production dependencies、实际宿主功能或 TypeScript Proxy。

本 Feature 也没有建立真实 Codex/DeepSeek journey 或 macOS、Linux、Windows 的宿主与平台
兼容性证据。仓库验证通过只证明本 Feature 的工程合同在实际执行环境中通过，不能解释为
宿主集成或跨平台产品验证。

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
- [Feature 001 实施计划](specs/001-bootstrap-monorepo/plan.md)
- [Feature 001 任务](specs/001-bootstrap-monorepo/tasks.md)
- [Feature 001 Quickstart](specs/001-bootstrap-monorepo/quickstart.md)
- [Feature 001 仓库布局合同](specs/001-bootstrap-monorepo/contracts/repository-layout.md)
- [Feature 001 需求检查表](specs/001-bootstrap-monorepo/checklists/requirements.md)
