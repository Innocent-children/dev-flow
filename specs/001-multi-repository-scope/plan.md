# Implementation Plan: 多仓库任务范围与用户配置

**Branch**: `feat/multi-repository-task-scope` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-multi-repository-scope/spec.md`

## Summary

在不改变现有状态图、六个 MCP 工具和 Host/Core 权限边界的前提下，把一个 Task 的单仓库
binding 扩展为一个主仓库加最多七个附加仓库的不可变 Repository Scope。`ProcessTask.Repository`
继续保存主仓库；附加 binding 作为有界、有序集合与其并列。Application 继续逐个调用现有
`RepositoryObserver`，以主仓库优先、附加仓库按 key 排序的固定顺序观察全部仓库。

单仓库 Task 的有效 `repository_binding_digest` 仍等于原 binding digest；多仓库 Task 在同一字段
中使用全部 component binding 的稳定聚合摘要。SQLite 在现有 Task mutation 事务内原子获取、保留
或释放 Scope 的全部 claim。Codex 与 DeepSeek 复用同一 Core 合同，分别在 Host admission 中执行
已有目录权限模型。`$HOME/.dev-flow/config.json` 只读提供可选代码索引偏好，配置和索引能力都不进入
Task、Action、摘要、Recovery 或流程流转。

## Technical Context

**Language/Version**: Go 1.26；Node.js >=24；pnpm >=11 <12
**Primary Dependencies**: Go 标准库、`github.com/modelcontextprotocol/go-sdk` v1.7.0、
`modernc.org/sqlite` v1.56.0；Host 包继续使用现有 Node.js/DSH/Codex 集成

**Storage**: 本地 SQLite；Task snapshot 使用现有 closed JSON codec；用户配置为只读 JSON 文件

**Testing**: Go `go test`、Node.js `node --test`、仓库最终门禁 `pnpm run validate`

**Target Platform**: 当前已支持的本地 STDIO Host 平台；本 Feature 不扩展平台范围

**Project Type**: Go Core/CLI + MCP server + Codex/DeepSeek Host adapters
**Performance Goals**: 无新增吞吐或延迟目标；每次观察最多 8 个仓库，并继续使用现有单仓库超时和
输出上限
**Constraints**: Core 对 Git 只读；Scope 总数 1～8；Scope 创建后不可变；配置最大 16 KiB；
一个 Task 只有一套流程状态；不增加工具、节点、Transition、Provider、DSL 或第二套摘要字段
**Scale/Scope**: 一个活动 Task、一个主仓库、0～7 个附加仓库；验收只覆盖单仓库和一个有界
两仓库代表场景，不构造 3～8 仓库矩阵

## Constitution Check

*GATE: Phase 0 前通过；Phase 1 设计完成后再次通过。*

| Gate | Phase 0 | Phase 1 | 设计依据 |
| --- | --- | --- | --- |
| Core 保持唯一流程权威 | PASS | PASS | Scope 只扩展 Task 的仓库事实；节点、Action、revision、Recovery、Blocker、Outcome 保持单一。 |
| 外部方法和索引工具不复制 Core 状态 | PASS | PASS | codebase-memory 只影响 Host 代码发现，偏好不持久化到 Task。 |
| Core 只读观察 Git，Host 执行授权修改 | PASS | PASS | 复用现有只读 `RepositoryObserver`；Codex/DeepSeek 在调用 Core 前校验自身目录权限。 |
| 基于现有架构增量开发 | PASS | PASS | 复用 `ProcessTask.Repository`、Application Service、SQLite mutation、Recovery classifier 和六工具 catalog。 |
| 可选外部索引与诚实回退 | PASS | PASS | 不安装或管理 codebase-memory；缺失时最多提示一次并回退 Host 内置检索。 |
| 测试直接对应验收且有界 | PASS | PASS | 定向 package/contract 测试；T034 Codex 仅按 raw failure 驱动的单步 repair loop 运行并在首次通过后停止，T035 DeepSeek 与全仓验证仍各最多一次。 |
| Product Feature 与发布分离 | PASS | PASS | 不修改公开版本、npm、Tag、GitHub Release 或发布证据。 |
| 公共合同和持久化先有 Feature | PASS | PASS | 当前 Feature 明确公共输入/结果、旧数据处置、非目标和测试预算。 |

## Project Structure

### Documentation (this feature)

```text
specs/001-multi-repository-scope/
├── README.md
├── spec.md
├── checklists/
│   └── requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   ├── repository-scope.md
│   ├── mcp-tools.md
│   ├── persistence-recovery.md
│   └── host-configuration.md
└── quickstart.md
```

`tasks.md` 由后续 `$speckit-tasks` 单独生成，本计划不创建实现任务。

### Source Code (repository root)

```text
cmd/dev-flow/
├── main.go
└── main_test.go

internal/
├── application/          # 顺序观察、Scope 创建/恢复、Action 与 Recovery 协调
├── domain/               # Repository Scope、聚合摘要、scoped path 和 Task 不变量
├── mcp/                  # open_task/server_info 输入结果与六工具闭合集合
├── recovery/             # 多 binding relation/effect 汇总，复用现有分类器
├── repository/           # 原有单仓库只读 Observer 和 component binding
├── store/                # SQLite snapshot、claim 集合和 reject-and-reset preflight
├── userconfig/           # 固定只读用户配置；无 Provider、registry 或写 API
└── workflow/             # 现有图与 payload；只接收 Scope-aware path/digest 校验

packages/
├── codex/
│   ├── bin/dev-flow-codex.mjs
│   ├── plugin/skills/dev-flow/
│   └── tests/
└── deepseek/
    ├── lib/authorization.mjs
    ├── skills/dev-flow/
    └── tests/

protocol/fixtures/        # 当前 graph MCP 合同样例；不恢复历史 Feature 文档
tests/contract/           # MCP、持久化和 result envelope 定向合同
tests/journeys/           # 每个 Host 一个有界两仓库 Journey
docs/                     # 双语产品、架构、命令、路线图和 Host 文档
README*.md                # 9 个维护 locale
```

**Structure Decision**: 保留当前分层和依赖方向。Repository Scope 是 `domain.ProcessTask` 的有界
值对象；Application 直接循环调用既有单仓库 Observer；SQLite Store 仍提交一个 Task mutation；
Host 仅做授权与执行。唯一新增包是窄化的 `internal/userconfig`，负责一次性读取固定配置文件，不
承载扩展点。

## Implementation Strategy

### 1. Domain 与路径合同

- 在 `internal/domain/repository.go` 和 `internal/domain/task.go` 增加主 key、0～7 个有序附加
  binding，以及只计算不持久化第二字段的有效 Scope digest accessor。
- 默认主 key 为 `primary`。所有 key 使用闭合的 ASCII semantic identifier 规则，最长 128 字节，
  在 Scope 内唯一；additional 按 key 排序并持久化。
- 单仓库的 Artifact、expected path、implementation/refactor changed path 继续使用普通相对路径；
  多仓库的上述路径全部使用 `<repository-key>::<repository-relative-path>`。Task 级校验负责确认
  key 属于 Scope，RepositoryBinding 自身的 `ChangedPaths` 始终保持仓库内普通相对路径。
- 将 Action、OperationReference、Implementation/Test/Comprehension、Blocker condition 和 Outcome
  的现有摘要比较统一改为有效 Scope digest；不新增 `repository_scope_digest`。

### 2. Application、Drift 与 Recovery

- `OpenTask` 新建时先观察主仓库，再按 key 排序观察附加仓库；全部观察、identity 去重和 Scope
  校验成功后才构造一次 `TaskMutation`。任一步失败都不写 Task、event 或 claim。
- 恢复时先观察调用者传入路径并按其 identity 查询现有 claim，因此主仓库或任一附加仓库都返回
  同一 Task；恢复不得重排或改写持久化 Scope。
- 标准 apply 和 uncertainty probe 观察完整 Scope，按 key 把 payload scoped paths 分派到每个
  binding，再复用现有单仓库 relation/effect 比较。
- 任一仓库出现 forbidden change 或未声明路径即整体零写入。多仓库 partial 只表示保留 payload
  声明的仓库 effect 已完成一个非空严格子集、其余仍未开始且无冲突；现有
  `partially_completed` / `conflicting` 分类、directive、Blocker 和恢复节点保持不变。

### 3. SQLite、MCP 与配置

- 保留 `tasks.repository_identity` 作为主仓库镜像；移除 `repository_claims.task_id` 的唯一约束，
  让同一 Task 在现有事务内持有多行 claim，同时保持 `repository_identity` 全局唯一。
- Acquire/Retain/Release 都处理完整、规范排序的 identity 集。preflight 对活动 Task 要求 claim 集
  精确相等，对终态 Task 要求零 claim。内部 SQLite schema identity 前进到不兼容的新值；旧数据
  在 writable open 之前零写入拒绝，不提供 migration、旧 decoder 或双 runtime。
- `dev_flow_open_task` 只新增可选 `primary_repository_key` 和最多 7 项的 closed
  `additional_repositories`；其余工具输入保持不变。Task 结果保留主 `repository`，并投影主 key
  和有序附加仓库；所有 Action/probe/apply/recovery 继续只使用 `repository_binding_digest`。
- `internal/userconfig` 在 `store.Open` 前一次读取 `$HOME/.dev-flow/config.json`。文件或目录不存在
  返回 false/false；不可读、超过 16 KiB、重复字段、未知字段、trailing JSON 或非布尔值明确失败。
  有效快照通过现有 `dev_flow_server_info` 的 `host_preferences` 返回，不增加配置 CLI 或 MCP 工具。

### 4. Host 权限与可选检索

- Codex Skill 将当前 Git 仓库作为主仓库，只接受用户启动会话时已经授权的 additional writable
  roots；不修改 sandbox。真实 Journey 仅用现有 `--sandbox workspace-write`、`--cd` 和用户授权的
  `--add-dir`。
- DeepSeek 在现有 admission/authorization guard 中以当前 Workspace Root 为边界，创建前拒绝
  root 外路径和 symlink escape；Workspace Root 可以是非 Git 的共同父目录。
- 两个 Host 从 server info 读取自己的 `codebase_memory` 偏好。false 时只用内置文件/文本检索；
  true 时仅在能力已经可见时优先使用，缺失时本会话最多提示一次并回退。Host 不安装、配置、
  启动、升级或卸载该工具。

## Planned Change Surface

实施阶段只允许从下列现有边界选择本 Feature 确实需要的文件；后续 `tasks.md` 必须把每项收窄到
精确文件，不得据此整理整个目录。

| 边界 | 预期文件 |
| --- | --- |
| Domain/Workflow | `internal/domain/repository.go`, `internal/domain/task.go`, `internal/domain/baselines.go`, `internal/domain/limits.go`, `internal/workflow/payloads.go`, `internal/workflow/engine.go` 及直接对应测试 |
| Application/Recovery | `internal/application/open_task.go`, `types.go`, `apply_action.go`, `apply_action_results.go`, `cancel_task.go`, `get_task.go`, `internal/recovery/reconcile.go`, `types.go`, `classify.go` 及直接对应测试 |
| Store | `internal/store/store.go`, `migrations.go`, `sqlite.go`, `codec.go` 及 claim/schema/codec 定向测试；`tests/contract/current_storage_contract_test.go` |
| Config/Core startup | `internal/userconfig/config.go`, `internal/userconfig/config_test.go`, `cmd/dev-flow/main.go`, `cmd/dev-flow/main_test.go` |
| MCP/fixtures | `internal/mcp/schemas.go`, `tools.go`, `server.go`, `results.go` 及定向测试；`tests/contract/mcp_contract_test.go`, `fixture_contract_test.go`, `protocol/fixtures/graph-server-info.json`, `protocol/fixtures/graph-multi-repository-open.json`, `protocol/fixtures/README.md` |
| Codex Host | `packages/codex/bin/dev-flow-codex.mjs`, `packages/codex/plugin/skills/dev-flow/SKILL.md`, 其 `references/method-profiles.md`, `references/node-payloads.md`, `packages/codex/tests/launcher.test.mjs`, `skill-contract.test.mjs`, `journey-harness.test.mjs`, `scripts/write-codex-journey-evidence.mjs` |
| DeepSeek Host | `packages/deepseek/lib/authorization.mjs`, `packages/deepseek/skills/dev-flow/SKILL.md`, 其 `references/method-profiles.md`, `references/node-payloads.md`, `packages/deepseek/tests/authorization.test.mjs`, `skill-contract.test.mjs`, `tests/journeys/deepseek/simulated-graph-journey.test.mjs` |

不修改 `packages/*/package.json`、`CORE_VERSION`、release contracts/scripts/evidence、npm、Tag、GitHub
Release、`.agents/skills/` 或 `.specify/templates/`。

## Test Budget

按实现 checkpoint 运行对应定向测试，不强制 TDD，也不在每次修改后运行全仓门禁：

1. Domain/Repository：1、8、9 个仓库边界，key/identity 去重，排序、单仓摘要兼容和多仓摘要稳定，
   单仓/多仓 scoped path 校验。
2. Application/Recovery：一个两仓库创建与恢复、一个附加 claim 冲突、一个附加仓库 drift、一个
   partial 与一个 conflicting uncertainty 场景。
3. Store/MCP/Config：多 claim 原子事务、preflight 与旧 schema 零写拒绝、closed open input、
   server-info 有效偏好、配置 missing/valid/invalid。
4. Host：Codex 和 DeepSeek 的 Skill/guard/launcher 定向合同；未授权目录由确定性测试证明。
5. Journey：T034 Attempts 1～5 作为不可覆盖的历史证据保留；后续采用单步 repair loop，每次只验证
   上一份 raw failure 直接支持的精确修复，首次通过后停止。DeepSeek 真实两仓库 Journey 仍最多调用一次。
6. 完成全部定向检查后，最终 `pnpm run validate` 最多调用一次。

Attempt 1 source commit 为 `1176809054e814d7d163ef7eef0243b1538a71a3`，状态为 failed，原始
evidence `tests/journeys/codex/evidence/feature-001-multi-repository.json` 不得修改、覆盖或删除。
原始输出未保留，不能断言唯一运行时原因；静态确认的 runner 缺陷是实际 Dev Flow 产品没有绑定
该 source commit。source-bound runner 已修复为 source-local build → isolated install → setup →
registration/Core readback → Codex，确定性测试 46/46 通过。

Attempt 2 已基于 `c150f281beae12dba222e8758be5cb3ec80d2a44` 启动并消费最后
一次原预算，独立 evidence 为
`tests/journeys/codex/evidence/feature-001-multi-repository-attempt-2.json`。source-bound build、install、
setup 与 readback 通过，但 post-session evidence validation 未能证明从附加仓库恢复
同一 Task，runner 返回 1。Attempt 3 将恢复提前到创建后并基于
`eee0950d24315aaee6562d112b7717303c946059` 通过，独立 evidence 为
`tests/journeys/codex/evidence/feature-001-multi-repository-attempt-3.json`，但没有证明
mutation 后由新的附加仓 Host session 恢复。runner 现使用两个独立 Codex session：第一段从
主仓创建、修改并成功 apply，第二段以附加仓为 `--cd` 恢复，并将结果与第一段最后一次成功
apply 对比；直接 harness 47/47 通过。Attempt 4 基于
`4ce6be92fd2d664ccb77ecbcb72b5386606642d6` 启动，在第一段首次 apply 因缺少顶层
`request_id` 失败，evidence 为
`tests/journeys/codex/evidence/feature-001-multi-repository-attempt-4.json`。通用 apply
request-binding 规则现由 multi-repository 与 final-registry Prompt 共享。Attempt 5 启动后
request binding 不再报错，但后续 apply 返回 `INVALID_ARGUMENT`；旧 failure evidence 没有保留
失败调用详情。multi-repository 现也共享既有完整 apply payload 规则，并分别保留 substantive 与
resume session 的本地 raw JSONL；闭合 failure evidence 仍为最小可提交字段。Attempt 5 evidence 为
`tests/journeys/codex/evidence/feature-001-multi-repository-attempt-5.json`。用户已授权读取和存储 raw
transcript，并授权由失败证据驱动的 source-bound repair loop 继续到首次通过。Attempt 6 evidence
确认失败 payload 在正常 `implementation_ready_for_test` 分支错误携带非空 `findings`；共享规则
现统一 `problem_class`/`findings` 的分支语义，并将 TEST 验证留给后续 session。Attempt 7 基于
`6279ac8ffaf2a5e5c26a2dc457d2b31096399a78` 通过最终双 session 合同，T034 已完成。
T035 已基于 source commit `14b8669bc331b88a6ccef3888d8c553a54c2bcc5` 执行唯一一次真实
DeepSeek Journey。DSH exit code 为 0，但 post-session evidence validation 失败，Task 仅停在
`REQUIREMENTS`、revision 1，未证明双仓修改、附加仓恢复或终态。用户已授权与 Codex 相同的
evidence-driven repair loop。Attempt 2 已证明 create-to-DESIGN、implement-to-TEST、附加仓恢复到
COMPREHENSION_REVIEW 均通过，Task 在最后一段推进到 DELIVERY revision 7 后超时。runner 现将
accept-to-DELIVERY 与 deliver-to-DONE 分成单节点 checkpoint，并在超时清理前保存当前 raw session。
T035 总预算为 2/3 consumed，Attempt 3 尚未启动；T040 仍为 0/1 且不得提前执行。

明确不建立 3～8 仓库、节点、平台或配置排列组合；不做压力、性能、fuzz、版本矩阵；不安装或
测试真实 codebase-memory；T034 之外的真实 Host Journey 不得扩大既定预算。

## Documentation Scope

同一实现 checkpoint 更新：

- 全部根 README locale：`README.md`, `README_en.md`, `README_zh-TW.md`, `README_ja.md`,
  `README_ko.md`, `README_es.md`, `README_fr.md`, `README_de.md`, `README_pt-BR.md`；
- `docs/PRODUCT.md`, `docs/PRODUCT_en.md`, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE_en.md`,
  `docs/COMMANDS.md`, `docs/COMMANDS_en.md`, `docs/ROADMAP.md`, `docs/ROADMAP_en.md`；
- `packages/codex/README.md`, `docs/CODEX_en.md`, `packages/deepseek/README.md`,
  `docs/DEEPSEEK_en.md`。

内容必须包含配置样例、单仓库兼容、两种 Host 的 Scope 声明与权限边界、scoped path、索引缺失
回退和 reject-and-reset。`docs/SUPPORT-MATRIX*` 保持已发布证据不变，本 Feature 不制造未发布的
版本支持声明。
