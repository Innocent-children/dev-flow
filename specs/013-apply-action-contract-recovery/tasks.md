# Tasks: Apply Action 合同恢复

**Feature**：`specs/013-apply-action-contract-recovery`
**Spec**：[spec.md](spec.md) ｜ **Plan**：[plan.md](plan.md)

## Phase 1：Setup

- [x] T001 选择本 Feature 目录并写入 `.specify/feature.json`
- [x] T002 建立完整 Product Feature 包：`specs/013-apply-action-contract-recovery/`
      （`README.md`、`spec.md`、`plan.md`、`research.md`、`data-model.md`、`quickstart.md`、
      `contracts/apply-action-schema.md`、`contracts/validation-errors.md`、
      `contracts/zero-write-correction.md`、`checklists/requirements.md`、`tasks.md`）

## Phase 2：Foundational

- [x] T003 建立失败的 Host 投影合同：在 `internal/mcp/host_projection_test.go` 复现 Host 的
      建模关键字集合、压缩预算与四个有损 pass，并证明当前九分支根联合体坍缩为空 Schema
      （FR-001、FR-002、SC-001）

## Phase 3：User Story 1 - 调用端能看到真实 apply 合同（P1）

**Goal**：`dev_flow_apply_action` 的 callable 不再是 `args: unknown`。
**Independent Test**：V3 中的投影合同、预算合同与 SDK 注册合同。

- [x] T004 [US1] 在 `internal/mcp/schemas.go` 实现 `projectableUnion`/`flattenSchema`/
      `mergeSchema` 及其辅助函数，把九个完整分支关系松弛为一个封闭对象
      （FR-001、FR-002、FR-003、FR-004、FR-005、FR-006）
- [x] T005 [US1] 在 `internal/mcp/schemas.go` 实现 `projectForHostBudget` 路径白名单裁剪与
      `applyToolDescription`，并把 `operation_probe.payload` 切到同一并集
      （FR-007、FR-008、FR-009）
- [x] T006 [P] [US1] 更新 `internal/mcp/graph_contract_test.go` 的 apply 形态断言为并集完整性
      （从 `graphPayloads()` 机械校验）（SC-001）
- [x] T007 [P] [US1] 更新 `tests/contract/mcp_contract_test.go` 的 `assertClosed` 与
      `requireNames` 以识别 nullable `type` 数组与单根 `required`（FR-006、FR-020）
- [x] T008 [US1] 在 `internal/mcp/host_projection_test.go` 增加 SDK 注册合同：`AddTool`、
      in-memory Server、`ListTools`，并对列出的 apply Schema 复跑投影与预算合同（SC-002）

## Phase 4：User Story 3 - 校验失败指出确切字段（P1）

**Goal**：`INVALID_ARGUMENT` 指出确切字段路径与闭合 rule。
**Independent Test**：V1、V2、V3 中的 violation 断言。

- [x] T009 [US3] 在 `internal/domain/errors.go` 增加 `ViolationRule` 闭合枚举、
      `ContractViolation`、`GuardRule`、`GuardFailure`，并扩展 `domain.Error`
      （FR-010、FR-011、FR-012）
- [x] T010 [US3] 在 `internal/workflow/verification_budget.go` 产出 evidence source 相关 Violation
      （FR-011）
- [x] T011 [US3] 在 `internal/workflow/payloads.go` 产出封闭合同 Violation（required 缺失、
      未知成员、`action_kind` 与 branch 不匹配、文本/列表/repository mutation 规则）（FR-011）
- [x] T012 [US3] 在 `internal/application/apply_action.go` 与
      `internal/application/apply_action_results.go` 透传结构化失败并标记零写入阶段（FR-016）
- [x] T013 [US3] 在 `internal/mcp/results.go` 把 Violation 投影为 `error.details`，并保证顺序稳定、
      无敏感数据（FR-010、FR-012）
- [x] T014 [P] [US3] 在 `internal/mcp/tools.go` 让 MCP 边界校验产出同样的字段级 Violation（FR-011）

## Phase 5：User Story 4 - Guard 失败指出确切原因（P2）

**Goal**：`TRANSITION_NOT_ALLOWED` 指出 `guard_id` 与 guard 失败项。
**Independent Test**：V1、V3 中的 guard 断言。

- [x] T015 [US4] 在 `internal/workflow/payloads.go` 用当前 Process Definition 的 guard 标识产出
      `GuardFailure`，只覆盖 problem-class/findings 一致性（FR-013、FR-015）
- [x] T016 [US4] 在 `internal/mcp/results.go` 投影 `guard` 对象，并确保 Repository Drift、字段格式
      错误、未知 work item 不被伪装成 Guard 失败（FR-014）

## Phase 6：User Story 5 - 一次零写入纠正（P2）

**Goal**：同一 Action 允许一次有界纠正。
**Independent Test**：V2、V4。

- [x] T017 [US5] 在 `internal/mcp/results.go` 在零写入且 `allowed_paths` 准确时返回
      `retry_safe=true` + `action=correct_current_action` + `allowed_paths`（FR-016）
- [x] T018 [US5] 保持不确定写入、identity 过期、Repository Drift、`INTERNAL_ERROR` 与 recovery
      路径的 `retry_safe=false`（FR-017）

## Phase 7：User Story 2 - 用户证据可被正确构造（P1）

**Goal**：Skill 描述与最终 Schema 和 evidence 规则一致。
**Independent Test**：V4。

- [x] T019 [US2] 更新 `packages/codex/plugin/skills/dev-flow/SKILL.md` 的 closed forwarding
      contract、user evidence 规则与一次纠正规则（FR-018、FR-019）
- [x] T020 [P] [US2] 更新 `packages/codex/plugin/skills/dev-flow/references/node-payloads.md`
      （FR-018）
- [x] T021 [P] [US2] 更新 `packages/deepseek/skills/dev-flow/SKILL.md`（FR-018、FR-019）
- [x] T022 [P] [US2] 更新 `packages/deepseek/skills/dev-flow/references/node-payloads.md`（FR-018）
- [x] T023 [US2] 更新 `packages/codex/tests/skill-contract.test.mjs`、
      `packages/codex/tests/package-contract.test.mjs`、
      `packages/deepseek/tests/package-contract.test.mjs` 的合同断言（SC-007）

## Phase 8：Documentation

- [x] T024 [P] 更新 `packages/codex/README.md` 与 `docs/CODEX_en.md`
- [x] T025 [P] 更新 `packages/deepseek/README.md` 与 `docs/DEEPSEEK_en.md`
- [x] T026 更新 `docs/COMMANDS.md` 与 `docs/COMMANDS_en.md` 的 MCP 工具描述

## Phase 9：Targeted Validation

- [x] T027 运行 V1：`go test ./internal/workflow -run 'Test.*(Payload|ProblemClass|VerificationBudget|Evidence)'`
- [x] T028 运行 V2：`go test ./internal/application -run 'Test.*(InvalidArgument|TransitionNotAllowed|Correction|UserEvidence|ManualHandoff|ZeroWrite)'`
- [x] T029 运行 V3：`go test ./internal/mcp ./tests/contract -run 'Test.*(Apply|Schema|Evidence|Error|Guard|SDK|ToolCatalog)'`
- [x] T030 运行 V4：`node --test packages/codex/tests/skill-contract.test.mjs packages/codex/tests/package-contract.test.mjs packages/deepseek/tests/package-contract.test.mjs`
- [x] T031 converge：一致性复核并报告 Schema 摘要、SDK 结果、四组测试结果、预期 Codex callable
      声明与真实 Host 回读步骤

## Phase 10：Review fixes

- [x] T032 [US5] 在 `internal/mcp/results.go` 将纠正许可限制为唯一可推导的 rule，并修正相关测试
      （FR-021、FR-022、SC-006）
- [x] T033 [US3] 在 `internal/workflow/payloads.go` 保留嵌套 unknown 成员完整路径，并为列表超限、
      重复项和非法 repository path 返回准确 rule（FR-024、FR-025、SC-008）
- [x] T034 [US5] 更新 Codex/DeepSeek Skill 与 zero-write contract，第二次失败只报告 path/rule
      （FR-023、SC-006）
- [x] T035 [US3] 更新 `scripts/validate-codex-journey-evidence.mjs` 与
      `packages/codex/tests/journey-evidence.test.mjs`，兼容新旧闭合错误合同（FR-026、SC-009）
- [x] T036 更新 Codex/DeepSeek `skill-contract.test.mjs` 及直接相关合同断言，不新增验证命令
- [x] T037 运行更新后的 V1-V4；V4 增加 Journey evidence 与 DeepSeek Skill 合同
- [x] T038 converge review fixes，并保持 Feature 状态为 Host verification pending
- [x] T039 经独立授权安装本地 Codex 非 final package，在新任务只读回读 callable 并确认
      `args`/`payload`具体化、TEST checks可见、source四枚举与六工具目录不变

### Review-fix validation evidence

- V1 首次暴露 changed-path 超限被合法性快速返回掩盖；只修正该范围后复验通过。
- V2 Application 定向验证通过。
- V3 MCP 与 repository contract 定向验证通过。
- V4 首次暴露测试变量初始化顺序问题；只修正测试后复验 60/60 通过。
- 未运行全仓库 suite、registry lifecycle、Git 或发布操作。
- 真实 Codex Host 回读通过；本地安装最终状态为 ready，registration receipt 与本地package字节匹配。

## Dependencies

- T003 阻塞 T004–T008。
- T009 阻塞 T010–T014、T015–T018。
- T013 阻塞 T016、T017。
- T019–T023 依赖 T004–T005（Schema 层级已确定）与 T017（纠正规则已确定）。
- T027–T030 依赖各自阶段完成。
- T031 依赖 T027–T030。

## Non-Goals

见 [spec.md](spec.md) 的 Non-Goals。本 tasks 不包含新增 MCP 工具、Process/Transition/持久化变更、
验证预算 API、安装器、lifecycle、版本或发布动作。
