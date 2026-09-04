# 按任务复杂度控制验证与复核范围：交付记录

## 采用的设计

- Task 创建只保存请求、初始范围、已知验收和 method profile，不再保存最终 verification budget。
- TASKS baseline 保存 `verification_plan`：计划检查及理由、初始预算、完整套件预期和测试代码预期。
- Evidence 绑定 Task Plan revision；当前消耗只统计当前 revision，旧计划记录保留但不占新计划预算。
- TEST 增加 `verification_budget_increased` 自循环；调整必须有闭合依据、具体 reason、新增检查和实际
  单调增加，Core 保存调整前后预算并签发新的 TEST Action。
- 完整套件 Evidence 保存本次 `full_suite_reason`。Codex/DeepSeek Skill 在命令和测试文件修改前判断
  相关性，并限制修改后复核和修复后的重检范围。
- WebUI 显示未计划状态、当前计划、初始/当前预算、当前消耗及全部增加原因。

## 准确改动路径

### Core 版本、Domain、Workflow 与 Application

- `CORE_VERSION`
- `internal/domain/baselines.go`
- `internal/domain/errors.go`
- `internal/domain/evidence.go`
- `internal/domain/limits.go`
- `internal/domain/phase5d_hardening_test.go`
- `internal/domain/primitives_test.go`
- `internal/domain/task.go`
- `internal/domain/task_invalidation_test.go`
- `internal/domain/task_test.go`
- `internal/domain/verification_budget.go`
- `internal/workflow/action_schema.go`
- `internal/workflow/definitions_test.go`
- `internal/workflow/payloads.go`
- `internal/workflow/payloads_test.go`
- `internal/workflow/phase5d_hardening_test.go`
- `internal/workflow/standard_process.go`
- `internal/workflow/standard_process_test.go`
- `internal/workflow/submission_contract_test.go`
- `internal/workflow/verification_brake_test.go`
- `internal/workflow/verification_budget.go`
- `internal/workflow/verification_budget_test.go`
- `internal/workflow/violation_contract_test.go`
- `internal/application/apply_action.go`
- `internal/application/apply_action_results.go`
- `internal/application/control_center_test.go`
- `internal/application/file_scope_test.go`
- `internal/application/method_contract_test.go`
- `internal/application/multi_repository_test.go`
- `internal/application/navigation_test.go`
- `internal/application/open_task.go`
- `internal/application/phase5a_test.go`
- `internal/application/phase5b_test.go`
- `internal/application/phase5d_hardening_test.go`
- `internal/application/stabilization_test.go`
- `internal/application/types.go`

### MCP、Store 与 WebUI

- `internal/mcp/graph_contract_test.go`
- `internal/mcp/host_projection_test.go`
- `internal/mcp/phase5d_hardening_test.go`
- `internal/mcp/recovery_graph_test.go`
- `internal/mcp/request_binding_test.go`
- `internal/mcp/results.go`
- `internal/mcp/schemas.go`
- `internal/mcp/submission_boundary_test.go`
- `internal/mcp/tools.go`
- `internal/mcp/verification_brake_test.go`
- `internal/store/codec_test.go`
- `internal/store/control_center_test.go`
- `internal/store/current_schema_bootstrap_test.go`
- `internal/store/future_corrupt_matrix_test.go`
- `internal/store/schema.go`
- `internal/store/store_test_helpers_test.go`
- `internal/webui/boundary_test.go`
- `internal/webui/handlers_test.go`
- `internal/webui/read_handlers.go`
- `internal/webui/types.go`
- `packages/webui/src/lib/api.ts`
- `packages/webui/src/lib/i18n.tsx`
- `packages/webui/src/pages/TaskDetailPage.tsx`
- 删除 `internal/webui/assets/generated/assets/index-B_AtGYBY.js`
- 新增 `internal/webui/assets/generated/assets/index-C550w0rZ.js`
- `internal/webui/assets/generated/index.html`
- `internal/webui/assets/generated/manifest.json`

### Codex、DeepSeek 与 Journey/合同测试

- `packages/codex/README.md`
- `packages/codex/plugin/skills/dev-flow/SKILL.md`
- `packages/codex/plugin/skills/dev-flow/references/method-profiles.md`
- `packages/codex/plugin/skills/dev-flow/references/node-payloads.md`
- `packages/codex/tests/fake-core-contract.test.mjs`
- `packages/codex/tests/fixtures/fake-core.mjs`
- `packages/codex/tests/fixtures/graph-method-profiles.json`
- `packages/codex/tests/package-contract.test.mjs`
- `packages/codex/tests/removal-retention.test.mjs`
- `packages/codex/tests/skill-contract.test.mjs`
- `packages/deepseek/README.md`
- `packages/deepseek/skills/dev-flow/SKILL.md`
- `packages/deepseek/skills/dev-flow/references/method-profiles.md`
- `packages/deepseek/skills/dev-flow/references/node-payloads.md`
- `packages/deepseek/tests/lifecycle.test.mjs`
- `packages/deepseek/tests/skill-contract.test.mjs`
- `tests/comprehensive/mcp_contract_test.go`
- `tests/comprehensive/process_graph_test.go`
- `tests/contract/README.md`
- `tests/contract/current_storage_contract_test.go`
- `tests/contract/fixture_contract_test.go`
- `tests/contract/mcp_contract_test.go`
- `tests/contract/testdata/final-local-payloads.json`
- `tests/journeys/codex/simulated-worktree-first.test.mjs`
- `tests/journeys/current_storage_boundary_test.go`
- `tests/journeys/deepseek/multi-repository-runner.mjs`
- `tests/journeys/deepseek/simulated-graph-journey.test.mjs`
- `tests/journeys/multi_repository_scope_test.go`
- `tests/journeys/phase7b_helpers_test.go`
- `tests/journeys/process_graph_iteration_test.go`
- `tests/journeys/process_graph_navigation_test.go`
- `tests/journeys/shared/simulated-submission-contract.test.mjs`

### 当前合同 fixtures

- `protocol/fixtures/README.md`
- `protocol/fixtures/graph-host-parity-codex.json`
- `protocol/fixtures/graph-host-parity-deepseek.json`
- `protocol/fixtures/graph-multi-repository-open.json`
- `protocol/fixtures/graph-server-info.json`
- `protocol/fixtures/graph-workspace-lifecycle.json`

### 产品、技术文档与九个根 README

- `specs/016-adaptive-verification-review/plan.md`
- `specs/016-adaptive-verification-review/validation.md`
- `README.md`
- `README_zh-CN.md`
- `README_zh-TW.md`
- `README_ja.md`
- `README_ko.md`
- `README_es.md`
- `README_fr.md`
- `README_de.md`
- `README_pt-BR.md`
- `docs/ARCHITECTURE.md`
- `docs/ARCHITECTURE_en.md`
- `docs/CODEX_en.md`
- `docs/COMMANDS.md`
- `docs/COMMANDS_en.md`
- `docs/DEEPSEEK_en.md`
- `docs/DEMO.md`
- `docs/DEMO_en.md`
- `docs/NEXT-FEATURES.md`
- `docs/PRODUCT.md`
- `docs/PRODUCT_en.md`
- `docs/PROJECT-STATUS.md`
- `docs/PROJECT-STATUS_en.md`
- `docs/ROADMAP.md`
- `docs/ROADMAP_en.md`
- `docs/THREAT-MODEL.md`
- `docs/THREAT-MODEL_en.md`
- `docs/VERSIONING.md`
- `docs/WEBUI.md`
- `docs/WEBUI_en.md`
- `internal/README.md`
- `internal/README_en.md`

## 已执行的定向检查

- `go test ./internal/domain ./internal/workflow ./internal/application ./internal/mcp ./internal/store ./internal/webui`：通过。
- `go test ./tests/contract ./tests/comprehensive`：通过。
- `go test ./tests/contract ./tests/comprehensive ./tests/journeys`：最终 Journey package 通过；首轮只发现并
  修正了新增 transition 的固定计数。
- `node --test tests/journeys/shared/simulated-submission-contract.test.mjs tests/journeys/deepseek/simulated-graph-journey.test.mjs`：2 项通过。
- `node --test packages/codex/tests/fake-core-contract.test.mjs`：9 项通过。
- Codex/DeepSeek `skill-contract` 与 `package-contract` 定向测试：最终相关项通过。
- `pnpm run build:webui`：通过，TypeScript/React 产物已刷新。
- `pnpm run versions:check`：通过；Core `0.8.0`，Codex `0.8.8`，DeepSeek `0.8.8`，Dev Flow CLI `0.1.9`。
- 一次性 README locale 搜索：九个根 README 都包含新的 TASKS 验证计划说明。
- 一次性旧合同搜索：未发现仍声称“创建时不可变预算”的当前 Host/产品文档。
- `git diff --check`：通过。

## 未执行的检查

- 未运行 `pnpm run validate`、全仓库 Go/Node suite、平台矩阵、stress 或 release 检查。本次只需要验证
  受影响的 Core package、closed contracts、Host Skills、两条模拟 Journey 和 WebUI 构建；完整套件不会
  补足新的具体风险，仓库也没有要求普通改动在该检查点运行它。
- DeepSeek 官方 lifecycle gate 需要外部精确环境，本机测试按其合同跳过；模拟 DeepSeek graph journey
  已通过。未把模拟结果描述为真实 Host 最终制品证据。
- 未执行 push、merge、commit、Tag、npm/GitHub Release 或发布检查。

## 剩余风险

- Core 能校验闭合依据、非空原因、单调增加、计划版本和结果，不能判断自然语言理由是否真的充分；
  Host 的相关性和长期测试价值判断仍可能出错。
- shell 和不经过 Host hook 的专用工具仍可能先运行或写入；Core 只能在 Action 结果与后续 Git 观察中
  校验可确认状态。
- 当前预算读取依赖 Host 在命令前获取最新 Task；并发或过期视图仍需要现有 revision/Action 机制拒绝。
