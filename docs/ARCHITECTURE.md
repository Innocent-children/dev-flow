# Dev Flow 架构与边界

## 当前结构

当前源码使用一个共享 Go Core 和一个薄 Host Adapter。公开传输仍是 local STDIO，MCP
Contract 0.2 恰好包含六个工具。

```text
Host Adapter
    │ explicit selector / closed payload / read-before-retry
    ▼
Six-tool MCP Contract 0.2
    ▼
Application Service
    ▼
Workflow / standard-development@1
    ▼
ProcessTask / TaskIntent / Baselines
    ▼
SQLite Schema 2
```

三个旁路组件各有单一职责：

```text
Read-only Git Repository Observer ──► RepositoryBinding
Recovery Classifier              ──► five-class Assessment / Blocker
Codex method-profile renderer    ──► user-visible operations / evidence
```

Application Service 协调读取、观察、工作流验证和 Store CAS；它不拥有另一套流程语义。

## Go Core 权威

Core 唯一管理：

- Task identity、immutable `TaskIntent` 和 repository claim；
- process definition/version/digest、current node 和 resume node；
- node purpose、entry/completion obligations、allowed effects 和 required evidence；
- 全部 legal transitions、guard、reason rule 和 Core-derived destination；
- requirements/design/task-plan baseline authority 和 invalidation；
- current action、revision CAS、evidence 和 verification budget；
- graph-native recovery classification、blocker 和 resolution；
- terminal `DONE`/`CANCELLED` outcome。

`internal/workflow/standard_process.go` 定义唯一的 `standard-development@1`。它有 11 个节点、
29 条正常流转，无 runtime graph parser、registry、DSL 或 compatibility process。精确合同见
[process-graph.md](../specs/008-refactor-to-development-process-graph/contracts/process-graph.md)。

## Adapter 权威

Codex Adapter 只负责：

- 精确 selector `$dev-flow-codex:dev-flow` 和请求 admission；
- Core Contract 0.2 handshake 与 capability availability；
- 将 Core semantic method steps 渲染成 `plain`、`spec-kit` 或 `openspec` 操作；
- 呈现当前节点、全部合法 transitions 和 developer comprehension request；
- 转发 closed node-specific payload；
- 在不确定 mutation 后保留 operation 并 read-before-retry。

Adapter 不保存 Task、current node、transition table、baseline、repository claim 或 recovery
classification。它不能发明 destination、推断 completion 或把 Host command success 当作 Core
mutation。

Spec Kit/OpenSpec 是方法工具。它们产生的 spec、plan、tasks、delta 或 archive 可以成为
repository artifact/evidence，但不成为 Core 的 process cursor，也不是 Go Core 生产依赖。

## 数据模型

Schema 2 的 strict snapshot-v2 持久化一个 `ProcessTask` 聚合，主要 authority 为：

```text
TaskIntent
RequirementsBaseline
DesignBaseline
TaskPlanBaseline
ImplementationRecord
TestRecord
ComprehensionAssessment
ProcessOutcome
```

`TaskIntent` 保留初始授权与 immutable method profile；Requirements、Design 和 TaskPlan 是递增
revision 的当前 authority。新 requirements 会使 design 及下游失效，新 design 会使 task plan
及下游失效，repository-changing implementation/refactor 会使 test、comprehension 和 delivery
readiness 失效。`TEST` 创建 current `TestRecord`，用户确认后才创建 current
`ComprehensionAssessment`。完整字段和 current-node authority matrix 见
[data-model.md](../specs/008-refactor-to-development-process-graph/data-model.md)。

## Storage

`internal/store` 只支持：

```text
SQLite Schema 2
Snapshot Version 2
standard-development@1 exact definition digest
```

Fresh directory 直接 bootstrap Schema 2；不会先创建 Schema 1，也没有 `ALTER TABLE` migration、
snapshot-v1 decoder、dual projection 或 `legacy-linear`。Store 在暴露写能力前只读验证 schema、
task row/snapshot、node authority 和 Task/Event/Claim cardinality。Schema 1/pre-graph 数据返回
`SCHEMA_UNSUPPORTED` 并保持零写入；corrupt current-generation state safe-stop。用户自己选择新
目录或在 Core 外部处理旧目录，任何 lifecycle 命令都不自动删除。

Task snapshot 是当前状态 authority，TaskEvent 是 append-only audit，不用于普通读取的 event
replay。正常 mutation 在一个事务中更新 snapshot、event、evidence 和 repository claim，并以
revision CAS 保证最多一次提交。

## Recovery

`internal/recovery` 接收 Core 生成的 operation identity、当前 Task/LastOperation 和一次只读 Git
observation，返回五类 Assessment：

```text
not_started
completed_and_recorded
completed_but_unrecorded
partially_completed
conflicting
```

Probe 始终零写入。显式 recovery apply 会重新观察，并且只能按 Core 内部 directive 完成一次
原 transition，或为 partial/conflicting 创建一个 graph-native `BLOCKED`。Blocker 保存原 source
作为 resume node，解除后只回到该节点。Adapter 永远不选择分类或 recovery destination。

## Read-only Git

`internal/repository` 只读取 canonical repository identity、branch、HEAD、index/worktree 与
bounded changed paths。Core 不执行 checkout、reset、clean、stash、commit、merge、rebase、
push、tag、publish，也不暴露 generic shell。Action 的 `allowed_effects` 约束 Host 可执行的已授权
工作，不授予 Core 操作系统能力。

## 源码所有权

| 路径 | 责任 |
| --- | --- |
| `cmd/dev-flow/` | CLI、version、STDIO server lifecycle |
| `internal/domain/` | ProcessTask、baselines、actions、evidence、outcome、limits |
| `internal/workflow/` | static process、node/transition、payload/guard/invalidation |
| `internal/recovery/` | operation reconciliation、assessment、blocker |
| `internal/repository/` | read-only Git observer |
| `internal/store/` | Schema 2 bootstrap、strict codec、CAS、events、claims |
| `internal/application/` | use-case orchestration |
| `internal/mcp/` | six tools、closed JSON、typed Result Envelope |
| `packages/codex/` | explicit Adapter、Skill、method rendering、lifecycle/package |
| `protocol/fixtures/` | historical/current public contract fixtures |
| `tests/contract/`, `tests/journeys/` | deterministic contract and process evidence |

## 发布边界

当前图实现是 source-local、unreleased behavior。已发布 `0.3.0` 历史不变，Feature 008 不修改
版本、npm、Tag 或 GitHub Release。release schemas、publisher 和远端 artifact 属于维护者 Release
Change，不进入 Core 或 SQLite，也不能改变当前产品语义。
