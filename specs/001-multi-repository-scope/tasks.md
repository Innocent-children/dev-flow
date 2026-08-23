---

description: "Implementation tasks for bounded multi-repository Task scope and read-only Host preferences"
---

# Tasks: 多仓库任务范围与用户配置

**Input**: Design documents from `specs/001-multi-repository-scope/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: 只增加 Feature 验收直接要求的定向测试。测试与对应实现处于同一阶段，但不强制先写测试或采用 TDD。

**Execution rule**: 严格按阶段执行。每个阶段 checkpoint 都是强制停止点；Codex 完成 checkpoint 前的任务和定向检查后 MUST 停止并等待用户明确授权，MUST NOT 自动进入下一阶段。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 在同一阶段内可与标记任务并行，文件互不重叠且不依赖未完成任务。
- **[Story]**: 对应 `spec.md` 的 User Story。
- 每个任务只产生一个可判断结果，并列出当前仓库中的精确文件路径及 FR、SC 或合同条款。

---

## Phase 1: Repository Scope 与配置读取基础

**Purpose**: 建立后续创建、持久化、Recovery 和 Host 行为共同依赖的最小 Domain Scope、唯一摘要、scoped path 与只读配置快照。

**Independent Test**: Domain 定向测试证明 1/8/9 数量边界、key/identity/排序、单仓摘要兼容、多仓摘要稳定和 scoped path；配置定向测试证明 missing/valid/invalid 且非法配置在 SQLite 打开前零写入。

- [ ] T001 [US1] 在 `internal/domain/repository.go`、`internal/domain/task.go`、`internal/domain/limits.go`、`internal/workflow/engine.go` 实现 `RepositoryKey`、有序 `RepositoryScopeEntry`、不可变 Scope 校验和单仓直返/多仓聚合的唯一有效 `repository_binding_digest`，使 Task/Action/records/Blocker/Outcome 继续共享同一摘要权威（FR-001、FR-002、FR-004、FR-005、FR-011、FR-030；SC-001、SC-002、SC-003；`contracts/repository-scope.md`「Key 合同」「有效 repository_binding_digest」）。
- [ ] T002 [US1] 在 `internal/domain/baselines.go`、`internal/domain/task.go`、`internal/workflow/payloads.go` 实现单仓普通相对路径与多仓 `<repository-key>::<repository-relative-path>` 的闭合语法、Scope membership 和去重校验，同时保持 `RepositoryBinding.ChangedPaths` 为仓库内普通相对路径（FR-010、FR-011；SC-001、SC-003；`contracts/repository-scope.md`「Scoped Path」）。
- [ ] T003 [US1] 在 `internal/domain/task_test.go`、`internal/domain/validation_test.go`、`internal/repository/binding_test.go` 增加唯一一组 Scope/digest/path 定向回归，覆盖 1、8、9 数量边界、重复 key/identity、输入顺序归一化、单仓 digest 不变和未知 scoped key 拒绝，不建立 3～8 仓组合矩阵（FR-001、FR-002、FR-010、FR-011；SC-001、SC-003；`quickstart.md`「Domain、摘要与 scoped path」）。
- [ ] T004 [P] [US4] 在新文件 `internal/userconfig/config.go`、`cmd/dev-flow/main.go`、`internal/mcp/server.go` 提供一个在 `store.Open` 前读取 `$HOME/.dev-flow/config.json` 并生成本进程只读 false/false 或 closed 16 KiB 有效偏好快照的入口，错误时不创建数据库且不增加配置 CLI/MCP 工具（FR-019、FR-020、FR-026、FR-027、FR-030；SC-007、SC-010；`contracts/host-configuration.md`「配置文件」「读取行为」）。
- [ ] T005 [US4] 在新文件 `internal/userconfig/config_test.go` 和现有 `cmd/dev-flow/main_test.go` 验证目录/文件缺失、合法 split preference，以及非法 JSON、重复/未知字段、null/非布尔、trailing、不可读和超 16 KiB 配置均产生明确定位且在 storage/serve 前停止，不增加配置排列组合（FR-020、FR-026、FR-027；SC-007、SC-010；`contracts/host-configuration.md`「读取行为」）。
- [ ] T006 运行 `go test ./internal/domain ./internal/repository ./internal/userconfig ./cmd/dev-flow`，只以 `internal/domain/task_test.go`、`internal/domain/validation_test.go`、`internal/repository/binding_test.go`、`internal/userconfig/config_test.go`、`cmd/dev-flow/main_test.go` 的本阶段验收结果判定基础是否完成（FR-001、FR-002、FR-010、FR-019、FR-020、FR-026、FR-027；SC-001、SC-003、SC-007）。

**Checkpoint — STOP REQUIRED**: Repository Scope、唯一摘要、scoped path 和配置读取基础必须通过 T006。Codex MUST 在此停止并等待用户授权；不得继续 Phase 2。

---

## Phase 2: 多仓库 Task 创建和 MCP 合同

**Purpose**: 让 Application 创建/恢复有界 Scope，并用现有 `dev_flow_open_task` 和 `dev_flow_server_info` 暴露闭合合同，同时保持六工具和单仓库调用兼容。

**Independent Test**: 使用 fake Store/Observer 分别创建单仓 Task 和 `core`+`docs` 两仓 Task，验证固定观察顺序、Scope 不可变、同一 Action/revision、从附加仓库恢复；MCP 合同验证 open 输入、Task projection、host preferences 和恰好六工具。

- [ ] T007 [US1] 在 `internal/application/types.go`、`internal/application/open_task.go` 扩展 `OpenTaskRequest`，实现默认主 key、最多 7 个附加输入、主仓后按 key 顺序观察、identity 去重、Scope 纳入 open operation digest，以及从任一参与仓库 claim 恢复时不改变原主仓库或 Scope（FR-001、FR-002、FR-003、FR-004、FR-005、FR-008；SC-002、SC-003；`contracts/repository-scope.md`「创建输入」「Identity 与观察」「从任一仓库恢复」）。
- [ ] T008 [US1] 在新文件 `internal/application/multi_repository_test.go` 增加一组 Application 定向测试，证明单仓调用不传新字段仍可用、两仓固定观察并返回一套状态、重复 key/identity 与第 9 个仓库零写拒绝、Scope mismatch 不会修改活动 Task、附加路径可恢复同一 Task（FR-001、FR-002、FR-004、FR-005、FR-008、FR-011；SC-001、SC-002、SC-003；`quickstart.md`「两仓库创建」「从附加仓库恢复」）。
- [ ] T009 [US1] 在 `internal/mcp/schemas.go`、`internal/mcp/tools.go` 为 `dev_flow_open_task` 增加可选 `primary_repository_key` 和 closed `additional_repositories[{key,repository_path}]`、`maxItems:7` 的 wire/validation/mapping，保持其他五个工具输入、catalog 顺序和 annotations 不变（FR-001、FR-002、FR-030；SC-003；`contracts/mcp-tools.md`「dev_flow_open_task」「不变边界」）。
- [ ] T010 [US1] 在 `internal/mcp/server.go`、`internal/mcp/results.go` 将 Phase 1 的有效配置投影为 `dev_flow_server_info.host_preferences`，并在 Task result 保留主 `repository`、增加 `primary_repository_key` 与按 key 排序且含 `canonical_root` 的 `additional_repositories`，不新增 Scope digest 字段（FR-005、FR-019、FR-030；SC-002、SC-007；`contracts/mcp-tools.md`「Task result additions」「dev_flow_server_info」）。
- [ ] T011 [US1] 更新 `protocol/fixtures/graph-server-info.json`、`protocol/fixtures/README.md` 并新增 `protocol/fixtures/graph-multi-repository-open.json`，形成一个默认偏好 server-info 和一个两仓单 Task/单 Action/单 digest 的当前 graph 合同样例，不改写历史 Feature 文档（FR-005、FR-030；SC-002、SC-007；`contracts/mcp-tools.md`「不变边界」「Task result additions」）。
- [ ] T012 [US1] 在 `internal/mcp/phase5d_hardening_test.go`、`internal/mcp/graph_contract_test.go`、`tests/contract/mcp_contract_test.go`、`tests/contract/fixture_contract_test.go`、`tests/contract/result_envelope_test.go` 锁定新 open schema、server-info/Task projection、closed JSON、原 envelope 和恰好六工具，保留一个必要单仓调用回归且不复制历史 MCP 测试（FR-011、FR-019、FR-030；SC-001、SC-002、SC-003、SC-007；`contracts/mcp-tools.md` 全部条款）。
- [ ] T013 [US1] 运行 `go test ./internal/application ./internal/mcp ./tests/contract`，只以 `internal/application/multi_repository_test.go`、`internal/mcp/phase5d_hardening_test.go`、`internal/mcp/graph_contract_test.go`、`tests/contract/mcp_contract_test.go`、`tests/contract/fixture_contract_test.go`、`tests/contract/result_envelope_test.go` 的创建/MCP 断言判定本阶段完成（FR-001～FR-005、FR-008、FR-011、FR-019、FR-030；SC-001、SC-002、SC-003、SC-007）。

**Checkpoint — STOP REQUIRED**: Application 创建/恢复和 MCP 合同必须通过 T013，公开工具仍为六个。Codex MUST 在此停止并等待用户授权；不得继续 Phase 3。

---

## Phase 3: repository claim、漂移和 Recovery

**Purpose**: 在现有 SQLite Task mutation 中原子管理完整 Scope claims，并让 apply、probe、Drift、Blocker 和 uncertainty Recovery 对全部参与仓库形成一个结论。

**Independent Test**: 一个 SQLite-backed 两仓场景证明附加 claim 冲突零残留、从附加 identity 恢复、Retain/Release 精确集合、旧 DB 零写拒绝；一个 drift/uncertain 场景证明仓库 key 可定位、partial 和 conflicting 复用现有分类且不产生仓库级状态。

- [ ] T014 [US2] 在 `internal/store/migrations.go` 将内部 SQLite schema identity 定为 `0.2.0`，保留 `tasks.repository_identity` 主仓镜像和 `repository_claims.repository_identity` 主键，移除 `task_id UNIQUE` 并增加普通 task lookup index，不创建 migration 或第二 schema runtime（FR-006、FR-007、FR-028、FR-029；SC-004；`contracts/persistence-recovery.md`「SQLite schema boundary」「Reject-and-reset」）。
- [ ] T015 [US2] 在 `internal/store/store.go`、`internal/store/sqlite.go` 让现有 Acquire/Retain/Release 在同一个 Task CAS/event 事务中按主仓+sorted additions 处理精确 claim 集，任何 acquire 冲突回滚全部写入，retain/release 缺失、额外或 host mismatch 时 safe-stop（FR-006、FR-007；SC-004；`contracts/persistence-recovery.md`「Transaction contract」）。
- [ ] T016 [US2] 在 `internal/store/sqlite.go`、`internal/store/codec.go` 让 immutable startup preflight 校验活动 Task 的完整 claim 集、终态零 claim、主 identity 镜像和 closed Scope snapshot，并对旧 `0.1.0`/未知数据在 writable open 前零写拒绝且只提示新数据目录或 Core 外归档（FR-004、FR-028、FR-029；SC-004、SC-010；`contracts/persistence-recovery.md`「Startup preflight」「Reject-and-reset」）。
- [ ] T017 [US2] 在 `internal/store/claim_preflight_test.go`、`internal/store/current_schema_bootstrap_test.go`、`internal/store/former_data_rejection_test.go`、`internal/store/codec_test.go`、`tests/contract/current_storage_contract_test.go` 增加多 claim acquire/retain/release、缺失/额外/host mismatch、两仓 snapshot restart 和旧 schema 字节不变的唯一持久化测试组（FR-006、FR-007、FR-028、FR-029；SC-004、SC-010；`quickstart.md`「Application、Recovery 与 Store」）。
- [ ] T018 [P] [US2] 在 `internal/application/apply_action.go`、`internal/application/apply_action_results.go`、`internal/application/cancel_task.go`、`internal/application/get_task.go` 将单仓重观察/rebind 扩展为主仓后 sorted additions 的完整 Scope 观察，并让普通 apply、operation probe、Blocker resolution、terminal outcome 和 claim release 始终使用一个有效 Scope digest（FR-005、FR-006、FR-009、FR-012、FR-013；SC-002、SC-005、SC-006；`contracts/persistence-recovery.md`「Drift aggregation」「Uncertain mutation recovery」）。
- [ ] T019 [US2] 在 `internal/recovery/types.go`、`internal/recovery/reconcile.go`、`internal/recovery/classify.go` 汇总每仓 `exact/worktree_only_changed/forbidden_change` 和 scoped effect，按非空严格子集得到现有 `partially_completed`、按任一不兼容事实得到现有 `conflicting`，继续只产生一个 directive/Blocker 且不新增分类（FR-009、FR-012、FR-013、FR-030；SC-005、SC-006；`contracts/persistence-recovery.md`「Drift aggregation」「Uncertain mutation recovery」）。
- [ ] T020 [US2] 在 `internal/mcp/results.go` 为 Recovery assessment 投影按 key 排序的 bounded repository relation/reason，并让仓库错误消息只包含已验证 key 和闭合原因而不改变 error envelope/code 或泄露绝对路径（FR-009、FR-012；SC-005、SC-010；`contracts/mcp-tools.md`「Recovery result additions」和 `contracts/persistence-recovery.md`「Claim/Recovery failure visibility」）。
- [ ] T021 [US2] 在 `internal/application/recovery_graph_test.go`、`internal/recovery/reconcile_test.go`、`internal/mcp/recovery_graph_test.go` 增加一个附加仓库未声明 drift、一个 declared effect 非空严格子集 partial、一个不兼容仓库 conflicting 及 key/reason 投影测试，不展开节点或 Recovery 组合矩阵（FR-009、FR-012、FR-013；SC-005、SC-006、SC-010；`quickstart.md`「Application、Recovery 与 Store」）。
- [ ] T022 [US2] 在新文件 `tests/journeys/multi_repository_scope_test.go` 增加一个 deterministic real Git/SQLite 两仓 Core Journey，串联原子创建、附加 claim 冲突零残留、从附加仓恢复同一 Task、一次合法 scoped mutation 和终态释放全部 claims，不复制完整历史节点 Journey（FR-006、FR-007、FR-008、FR-011；SC-001、SC-002、SC-004；`quickstart.md`「Application、Recovery 与 Store」）。
- [ ] T023 [US2] 针对 `internal/store/claim_preflight_test.go`、`internal/application/recovery_graph_test.go`、`internal/recovery/reconcile_test.go`、`internal/mcp/recovery_graph_test.go`、`tests/contract/current_storage_contract_test.go`、`tests/journeys/multi_repository_scope_test.go` 运行本阶段定向命令 `go test ./internal/store`、`go test ./internal/application -run 'MultiRepository|Recovery'`、`go test ./internal/recovery -run MultiRepository`、`go test ./internal/mcp -run 'MultiRepository|Recovery'`、`go test ./tests/contract -run 'CurrentStorage|MCP'`、`go test ./tests/journeys -run MultiRepositoryScope`，不得扩大为其他 Journey 或全仓测试（FR-006～FR-009、FR-012、FR-028～FR-030；SC-002、SC-004、SC-005、SC-006、SC-010）。

**Checkpoint — STOP REQUIRED**: claims、从任一仓库恢复、Drift、Recovery 和 reject-and-reset 必须通过 T023。Codex MUST 在此停止并等待用户授权；不得继续 Phase 4。

---

## Phase 4: Codex 与 DeepSeek Adapter

**Purpose**: 两个 Host 消费同一 Core Scope/Action/digest 合同，同时分别执行已授权 writable roots 与 Workspace Root 边界，并诚实处理可选 codebase-memory 偏好。

**Independent Test**: 确定性 Host tests 证明 Codex 未授权附加目录和 DeepSeek Root 外路径在 task-bearing Core call 前被拒绝；偏好 false 不调用索引，true 但能力缺失只提示一次并回退；随后每个 Host 仅执行一次真实两仓 Journey。

- [ ] T024 [P] [US3] 在 `packages/codex/plugin/skills/dev-flow/SKILL.md`、`packages/codex/plugin/skills/dev-flow/references/method-profiles.md`、`packages/codex/plugin/skills/dev-flow/references/node-payloads.md` 将单仓 admission 改为当前 Git 主仓+用户已授权 additional writable roots，使用新 open 输入和多仓 scoped paths，并在 Action 前权限失效时停止修改且不改变 sandbox（FR-014、FR-015、FR-016；SC-008；`contracts/host-configuration.md`「Codex 权限合同」）。
- [ ] T025 [US4] 在 `packages/codex/plugin/skills/dev-flow/SKILL.md` 编码 `server_info.host_preferences.codex.codebase_memory` 的 false 内置检索、true 且已可用时可优先、不可用时本会话最多提示一次并回退的行为，不安装工具且不把偏好/能力写入 Core 状态（FR-021～FR-025；SC-007、SC-009；`contracts/host-configuration.md`「codebase-memory 行为」）。
- [ ] T026 [US3] 在 `packages/codex/bin/dev-flow-codex.mjs`、`packages/codex/tests/fixtures/fake-core.mjs`、`packages/codex/tests/fixtures/graph-method-profiles.json` 同步多仓 selector/handshake/open 说明和有效 host preferences fixture，保持 launcher 只启动 packaged Core、不拥有或扩大仓库授权（FR-014、FR-015、FR-019、FR-030；SC-008；`contracts/mcp-tools.md`「dev_flow_server_info」和 `contracts/host-configuration.md`「Codex 权限合同」）。
- [ ] T027 [US3] 在 `packages/codex/tests/launcher.test.mjs`、`packages/codex/tests/fake-core-contract.test.mjs`、`packages/codex/tests/skill-contract.test.mjs` 验证 Codex 新 Scope 输入、六工具、单 digest、已授权目录、权限失效停止，以及 [US4] 的 false/true-unavailable 一次提示回退，不增加真实 codebase-memory（FR-014～FR-016、FR-021～FR-025、FR-030；SC-007、SC-008、SC-009；`contracts/host-configuration.md`「Codex 权限合同」「codebase-memory 行为」）。
- [ ] T028 [US3] 在 `scripts/run-codex-real-journey.sh`、`scripts/write-codex-journey-evidence.mjs`、`packages/codex/tests/journey-harness.test.mjs` 增加一个 Feature-only `multi-repository` runner contract，固定使用 `--sandbox workspace-write --cd <primary> --add-dir <additional>`、两个临时 Git 仓库和一个 Core Task，且不触碰历史/release evidence modes（FR-014～FR-016、FR-032；SC-008；`quickstart.md`「Codex」）。
- [ ] T029 [P] [US3] 在 `packages/deepseek/skills/dev-flow/SKILL.md`、`packages/deepseek/skills/dev-flow/references/method-profiles.md`、`packages/deepseek/skills/dev-flow/references/node-payloads.md` 将单仓 admission 改为同一非 Git Workspace Root 下显式主/附加 Git 仓库，使用新 open 输入和多仓 scoped paths，并保持与 Codex 两套 references 的既有同步合同（FR-017、FR-018、FR-030；SC-008；`contracts/host-configuration.md`「DeepSeek 权限合同」）。
- [ ] T030 [US4] 在 `packages/deepseek/skills/dev-flow/SKILL.md` 编码 `server_info.host_preferences.deepseek.codebase_memory` 的 false 内置检索、true 且已可用时可优先、不可用时本会话最多提示一次并回退的行为，索引结果不得放宽 Workspace Root 或改变 Task（FR-021～FR-025；SC-007、SC-009；`contracts/host-configuration.md`「codebase-memory 行为」「DeepSeek 权限合同」）。
- [ ] T031 [P] [US3] 在 `packages/deepseek/lib/authorization.mjs` 扩展现有 `dev_flow_open_task` guard，以启动时 canonical `process.cwd()` 为 Workspace Root，在 task-bearing dispatch 前拒绝 root 外主/附加路径和 symlink escape，保持 selector 与六工具 guard 不变（FR-017、FR-018、FR-030；SC-008、SC-010；`contracts/host-configuration.md`「DeepSeek 权限合同」）。
- [ ] T032 [US3] 在 `packages/deepseek/tests/authorization.test.mjs`、`packages/deepseek/tests/skill-contract.test.mjs`、`tests/journeys/deepseek/fake-core.mjs`、`tests/journeys/deepseek/simulated-graph-journey.test.mjs` 验证非 Git Root 内两仓允许、Root 外/escape 零 dispatch、同一 Core Task/Action/digest，以及 [US4] 的 false/true-unavailable 一次提示回退，不增加平台或索引集成矩阵（FR-017、FR-018、FR-021～FR-025、FR-030；SC-007、SC-008、SC-009、SC-010；`contracts/host-configuration.md`「DeepSeek 权限合同」「codebase-memory 行为」）。
- [ ] T033 运行 `node --test packages/codex/tests/launcher.test.mjs packages/codex/tests/fake-core-contract.test.mjs packages/codex/tests/skill-contract.test.mjs packages/codex/tests/journey-harness.test.mjs` 和 `node --test packages/deepseek/tests/authorization.test.mjs packages/deepseek/tests/skill-contract.test.mjs tests/journeys/deepseek/simulated-graph-journey.test.mjs`，只判定本阶段 deterministic Adapter 合同，不执行真实 Host 或真实 codebase-memory（FR-014～FR-025、FR-030；SC-007、SC-008、SC-009、SC-010）。
- [ ] T034 [US3] 在 T033 的 Codex 定向检查通过后，通过 `scripts/run-codex-real-journey.sh` 的 Feature-only `multi-repository` mode 最多调用一次 Codex 真实两仓库 Journey，并将不含私有路径/凭据的唯一结果写入新文件 `tests/journeys/codex/evidence/feature-001-multi-repository.json`。调用一旦实际启动即消耗预算，无论成功、失败、中断或超时；失败时必须停止并将 Feature 标记为 `Blocked`，不得在同一任务中自动修复后重跑。第二次执行必须先获得用户明确批准，并同步修订 `spec.md`、`plan.md`、`quickstart.md` 和 `tasks.md` 中的验证预算（FR-014～FR-016；SC-008；`quickstart.md`「Codex」）。
- [ ] T035 [US3] 在 T033 的 DeepSeek 定向检查通过后，新增 `tests/journeys/deepseek/multi-repository-runner.mjs` 并最多调用一次 DeepSeek 真实两仓库 Journey，以非 Git Workspace Root 下两个临时 Git 仓库完成同一 Core Task 的创建、双仓工作和附加仓恢复，并将 sanitized 结果写入 `tests/journeys/deepseek/evidence/feature-001-multi-repository.json`。调用一旦实际启动即消耗预算，无论成功、失败、中断或超时；失败时必须停止并将 Feature 标记为 `Blocked`，不得在同一任务中自动修复后重跑。第二次执行必须先获得用户明确批准，并同步修订 `spec.md`、`plan.md`、`quickstart.md` 和 `tasks.md` 中的验证预算（FR-017、FR-018；SC-008；`quickstart.md`「DeepSeek」）。

**Checkpoint — STOP REQUIRED**: T033 必须通过，T034 与 T035 各最多消费一次真实 Journey 预算并产生明确结果。Codex MUST 在此停止并等待用户授权；不得继续 Phase 5。

---

## Phase 5: README、技术文档和最终有界验证

**Purpose**: 同步全部维护文档族，并只执行一次最终仓库门禁。

**Independent Test**: 所有 locale 表达相同的 Scope、配置、权限、scoped path、fallback、reject-and-reset 和单仓兼容事实；一次 `pnpm run validate` 通过且没有版本或发布变更。

- [ ] T036 更新 `README.md`、`README_en.md`、`README_zh-TW.md`、`README_ja.md`、`README_ko.md`、`README_es.md`、`README_fr.md`、`README_de.md`、`README_pt-BR.md`，同步一个主仓+最多七个附加仓库、单仓兼容、配置样例、两 Host 权限与索引缺失回退，不修改安装版本或发布声明（FR-011、FR-031、FR-032；SC-001、SC-007、SC-009；`plan.md`「Documentation Scope」）。
- [ ] T037 [P] 更新 `docs/PRODUCT.md`、`docs/PRODUCT_en.md`、`docs/ROADMAP.md`、`docs/ROADMAP_en.md`，将旧绝对单仓边界改为本 Feature 的显式有界 Scope，同时继续排除自动多仓编排、未来 Provider/Orchestrator 和发布能力（FR-003、FR-013、FR-030、FR-031、FR-032；SC-002；`research.md`「Decision 13」）。
- [ ] T038 [P] 更新 `docs/ARCHITECTURE.md`、`docs/ARCHITECTURE_en.md`、`docs/COMMANDS.md`、`docs/COMMANDS_en.md`，准确记录 `ProcessTask.Repository` 主仓、sorted additions、唯一 aggregate digest、顺序 Observer、claim 事务、scoped path、open/server-info 输入结果和 reject-and-reset（FR-001～FR-013、FR-019、FR-028～FR-031；SC-002～SC-006、SC-010；`contracts/repository-scope.md`、`contracts/mcp-tools.md`、`contracts/persistence-recovery.md`）。
- [ ] T039 [P] 更新 `packages/codex/README.md`、`docs/CODEX_en.md`、`packages/deepseek/README.md`、`docs/DEEPSEEK_en.md`，分别提供可执行两仓声明、Codex additional writable roots、DeepSeek Workspace Root、配置样例和 codebase-memory 诚实回退，并保持两个 Host 共用一个 Core 合同（FR-014～FR-025、FR-031；SC-007、SC-008、SC-009；`contracts/host-configuration.md` 全部条款）。
- [ ] T040 在所有定向测试、T034/T035 各一次真实 Journey 和 T036～T039 文档同步完成后，依据 `package.json` 与 `scripts/validate-repository.sh` 最多调用一次 `pnpm run validate`，将结果记录在 `specs/001-multi-repository-scope/tasks.md` 的本任务状态。调用一旦实际启动即消耗预算，无论成功、失败、中断或超时；失败时必须停止并将 Feature 标记为 `Blocked`，不得在同一任务中自动修复后重跑。第二次执行必须先获得用户明确批准，并同步修订 `spec.md`、`plan.md`、`quickstart.md` 和 `tasks.md` 中的验证预算。不得追加平台/仓库/节点/配置/Recovery 矩阵、压力/性能/fuzz、真实 codebase-memory 或任何 release command（FR-030、FR-031、FR-032；SC-001～SC-010；`quickstart.md`「最终全仓门禁（最多一次）」）。

**Checkpoint — FINAL STOP REQUIRED**: 完成 T040 后 Codex MUST 停止并报告各阶段定向检查、两个一次性真实 Journey、唯一全仓门禁和明确未执行项；不得创建版本修改、npm、Tag、GitHub Release 或其他发布工作。

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 Repository Scope/config foundation
  -> Phase 2 Task creation/MCP contract
  -> Phase 3 claims/Drift/Recovery
  -> Phase 4 Host adapters/one-time Journeys
  -> Phase 5 documentation/one final validation
```

- Phase checkpoints are hard authorization boundaries; no later phase may start automatically.
- Phase 2 depends on the Scope, digest, path and configuration snapshot from Phase 1.
- Phase 3 depends on the persisted/MCP Task shape from Phase 2.
- Phase 4 depends on the complete Core, claim and Recovery contract from Phase 3.
- Phase 5 depends on delivered behavior and both bounded Host results from Phase 4.

### User Story Dependencies

- **US1 (P1)**: T001～T003 and T007～T013 deliver the bounded Scope creation/MCP increment; SQLite multi-claim completion arrives in US2 by the user-mandated phase split.
- **US2 (P1)**: T014～T023 depend on US1's Scope/MCP shape and complete atomic claims, any-repository resume, Drift and Recovery.
- **US3 (P2)**: T024、T026～T029、T031～T035 depend on the complete shared Core contract; Codex and DeepSeek streams are independently testable.
- **US4 (P3)**: T004～T005 provide Core config loading; T010 exposes preferences; T025、T027、T030、T032 complete Host selection/fallback without depending on a real index.

### Within Each Phase

- Implement the named contract result before its associated test task; TDD is permitted but not required.
- Run only the phase's explicit targeted command task after its implementation/test files are complete.
- Stop at the checkpoint even when the next phase appears unblocked.
- Any contract contradiction discovered during implementation returns to `spec.md`/contracts and stops code expansion.

## Parallel Opportunities

- **Phase 1**: T004 may run in parallel with T001～T003 because config/startup files do not overlap Domain Scope files; T005 waits for T004.
- **Phase 3**: T018 may begin in parallel with T014～T016 after Phase 2 because Application observation files do not overlap Store schema files; T019 waits for the effective observation shape.
- **Phase 4**: Codex stream T024～T028 and DeepSeek stream T029～T032 may proceed in parallel after Phase 3; T033 joins both before either real Journey.
- **Phase 5**: T036、T037、T038、T039 may run in parallel by document family; T040 waits for all four.

## Parallel Examples

### US1 / US4 foundation

```text
Parallel task A: T001 -> T002 -> T003 (Repository Scope, digest and path)
Parallel task B: T004 -> T005 (read-only user configuration)
Join: T006
```

### US3 / US4 Host adapters

```text
Parallel task A: T024 -> T025 -> T026 -> T027 -> T028 (Codex)
Parallel task B: T029 -> T030 and T031 -> T032 (DeepSeek)
Join: T033
Sequential budgeted evidence: T034 once, T035 once
```

## Implementation Strategy

### MVP Scope

The smallest reviewable MVP is Phase 1 plus Phase 2: it delivers US1's bounded Repository Scope model, single-repository compatibility, Task creation/resume and closed MCP shape. Phase 1 also establishes the shared config reader required later, but MVP does not claim Host indexing behavior until Phase 4.

### Incremental Delivery

1. Complete Phase 1, run only T006, stop.
2. Complete Phase 2, run only T013, stop and review the MVP.
3. Complete Phase 3, run only T023, stop and review persistence/Recovery.
4. Complete Phase 4 deterministic tests, then consume T034 and T035 once each, stop.
5. Complete synchronized docs and consume the single T040 full validation, then final stop.

## Scope and Budget Guardrails

- Do not create a generic Workspace, Provider, Registry, Orchestrator, repository-level Task, second state machine or second public digest.
- Do not add MCP tools, process nodes, Transition or Recovery classifications.
- Do not add 3～8 repository, platform, node, configuration or Recovery combination matrices.
- Do not add stress, performance, fuzz, coverage expansion or real codebase-memory installation/integration work.
- Do not modify `CORE_VERSION`, `packages/codex/package.json`, `packages/deepseek/package.json`, release contracts/scripts/evidence, npm state, Tags or GitHub Releases.
- Starting the Codex Journey, DeepSeek Journey or `pnpm run validate` consumes its one-call budget regardless of success, failure, interruption or timeout.
- Do not run a second Codex Journey, second DeepSeek Journey or second `pnpm run validate` until the user explicitly approves it and the validation budget is synchronized in `spec.md`, `plan.md`, `quickstart.md` and `tasks.md`.
