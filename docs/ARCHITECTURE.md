# Dev Flow 架构与边界

## 当前实现

共享 Go Core 是任务、流程、恢复和终态的唯一权威。Codex package 提供 host-specific 的注册、
显式 Skill、MCP 声明、launcher/lifecycle 和 bundled runtime；它不持久化 Task，也不复制状态机。

```text
Codex package
  Plugin + explicit Skill + local MCP declaration
                         │ STDIO
                         ▼
                    MCP adapter
                         ▼
                Application Service
                    ┌────┴────┐
                    ▼         ▼
                 Workflow   Recovery
                    └────┬────┘
                         ▼
                       Domain
                    ┌────┴────┐
                    ▼         ▼
             read-only Git   SQLite
```

CLI、MCP、Codex adapter 和 release tooling 都不能选择 Core 转换、推断完成或创建第二套恢复
规则。Application 协调用例，Workflow/Recovery/Domain 保持产品语义权威。

## 源码所有权

```text
cmd/dev-flow/
  Core CLI、version、mcp --stdio 与 SQLite lifecycle

internal/
  domain       Task/Contract/Action/Outcome/Core limits
  workflow     唯一转换表、下一动作与 closed payload
  recovery     唯一五类恢复与 blocker reconciliation
  repository   read-only Git observation 与 binding digest
  store        SQLite migration/snapshot/CAS/repository claim
  application  Core use-case orchestration
  mcp          恰好六个工具、strict JSON 与 typed envelope

packages/codex/
  public-package metadata
  launcher/lifecycle/paths
  Codex plugin
  explicit Skill
  local STDIO MCP declaration
  bundled runtime staging contract
  package/release tests

release/
  schemas
  bounded testdata
  operator documentation

scripts/
  local builder
  two-worktree release preparation
  verifier
  resumable publisher
  final Journey runner/evidence

packages/deepseek/
  deferred private skeleton only
```

仓库仍只有一个根 Go module 和一个 Core 可执行源码根。生产 Go direct dependencies 只有
`modernc.org/sqlite` 与 `github.com/modelcontextprotocol/go-sdk`；Codex package 没有 production
Node dependency。

## Core 权威边界

### Workflow 与 Recovery

`internal/workflow` 的显式转换表是阶段、动作、结果和下一阶段的唯一权威；
`internal/recovery` 是持久任务与新仓库观察之间结构化比较的唯一权威。Codex Skill 只遵循
Core 返回的 action/payload/result，不把模型文本当成完成或恢复事实。

### Repository 与 Store

Core 只通过固定参数执行有界的只读 Git 命令，不执行 checkout、reset、clean、stash、commit、
push、merge、rebase 或 tag。SQLite `tasks` snapshot 是当前状态权威；mutation 在单事务中执行
revision CAS、snapshot、TaskEvent 和 repository claim 更新。

Release Schema 不改变 Core Schema。`release-manifest.json` 与 `publication-record.json` 都不写入
SQLite；publication record 是可变 operator artifact，也不是 GitHub Release asset。

## Codex adapter 边界

`packages/codex` 的 package manifest 固定为 `dev-flow-codex`、`darwin`/`arm64`、一个 bundled
Core、一个 Plugin、一个 `dev-flow` Skill 和一个 local STDIO MCP。npm lifecycle inert；只有
`dev-flow-codex setup`/`remove` 可以修改经 ownership/read-back 证明的 Codex 注册。

Codex adapter 不保存 Task、状态机、repository claim 或 recovery result。Feature 003 的真实
Codex 验收证明 host journey；Feature 006 的本地 tgz、upgrade 和 retention tests 是确定性 package
证据，尚不是 public registry evidence。

## Release operator 边界

publisher 是仓库维护者工具，不是 MCP 工具，也不是 Core runtime。它只能在显式 operator 阶段
针对本仓库创建/复用精确 Tag、GitHub Draft/Release、npm version 与四个 release assets。真实
mutation 要求 reviewed clean `main`、frozen release directory 和精确 `v<VERSION>` confirmation。

Preparation 使用两个 clean worktree；verifier 核对 normalized package tree、Runtime、Schema、
source/version/digest 和 forbidden content。publisher 在每次 mutation 前回读远端，npm 至多发布
一次，冲突时停止；registry package 的 native Journey、四资产回读和全部前置步骤完成后，才允许
finalize GitHub Release。

PR CI 不持有发布凭证，不调用 publisher，不创建 Tag/Release，不执行 npm publish 或真实 Host
Journey。fake npm/gh 与 simulated journey 只验证 publisher 控制流，不能产生公开支持证据。

## 当前发布状态

Feature 006 已实现 public package、preparation/verifier、resumable publisher、final Journey 合同、
finalization gate 与 native-only support matrix，并已通过 T001–T046 确定性门禁。尚无 public npm
read-back、真实 registry-package Journey、GitHub asset read-back 或公开 Release evidence。

DeepSeek 仍是 deferred skeleton；当前没有 DeepSeek runtime、Skill、Harness journey 或 Release
evidence，也没有 Linux、Windows 或 Intel Mac 支持声明。
