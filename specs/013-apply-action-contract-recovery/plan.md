# Implementation Plan: Apply Action 合同恢复

**Feature**：`specs/013-apply-action-contract-recovery`
**Spec**：[spec.md](spec.md)
**Status**：Complete

## Technical Context

- Language：Go 1.25 Core/MCP；Node 测试；打包的 Markdown Host adapter。
- 当前权威：`internal/workflow/verification_budget.go` 已精确执行四种 evidence source 规则。
- 当前 MCP 形态：apply 根 `oneOf` 九分支 + 分支内 `allOf` 收窄。
- 目标 MCP 形态：单个封闭对象；`action_kind` enum；`payload`/`node_result` 为九分支并集；全树无
  composition 关键字；建模体积留在 Host 压缩预算内。
- Persistence disposition：`not-applicable`。
- 外部依赖：无。

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| I. Go Core Single Authority | 满足。精确性回到 Core；Schema 只承担可见性与早期拒绝。 |
| II. Hosts and Methods Are Adapters | 满足。Skill 只读取 Core 结果并按 `allowed_paths` 纠正一次。 |
| III. Read-only Core | 满足。无 Git 或 shell 变更。 |
| IV. Incremental Architecture | 满足。不新增工具、状态机、注册表或 provider 体系。 |
| V. Optional External Code Indexes | 满足。未引入索引依赖。 |
| VI. Acceptance-bound Verification | 满足。四组定向验证，不跑全仓库 suite。 |
| VII. Product Features and Releases Are Separate | 满足。无版本、Tag、发布或 npm 动作。 |
| VIII. Specification Before Contractual Change | 满足。本包先于生产代码修改成立。 |

State-Graph 影响：Process Definition、节点集合、transition 集合、guard 语义、required evidence 与
allowed effects 全部不变。本 Feature 只改变**这些既有事实如何被投影和如何被报告**。

## Phase 0：Research

见 [research.md](research.md)。六个决策全部闭合，无 NEEDS CLARIFICATION 残留。

## Phase 1：Design

### A. 可投影 apply Schema（`internal/mcp/schemas.go`）

1. `projectableUnion(alternatives)`：把若干封闭候选 Schema 关系松弛为一个封闭 Schema。
   - `flattenSchema` 丢弃 `allOf`（收窄）与 `title`，把 `anyOf`/`oneOf` 候选并集化，
     把 `const` 归一化为 `enum` 或数值上下界，并给每个节点补显式 `type`。
   - `mergeSchema` 联合 `type`、联合 `properties`（同名递归）、求交 `required`、联合 `enum`
     （仅当双方都有）、放宽数值/长度界、保留相同 `pattern`、保持 `additionalProperties: false`。
   - 纯 `{"type":"null"}` 候选只贡献 null 类型，因此 nullable 表达为 `type` 数组。
2. `projectForHostBudget(schema, path)`：按显式路径白名单保留 `enum`
   （`host`、`process_id`、`action_kind`、`payload.node_result.checks[].source`）与 `required`
   （根与 `payload`），其余 `enum`/`required` 交回 Core 执行。保留全部成员名、类型、封闭性，
   以及投影器本就丢弃的 `minLength`/`maxLength`/`pattern`/`minimum`/`maximum`/`maxItems`。
3. `applyToolDescription`：承载 source-specific 规则、用户验证归属与 manual handoff 语义。
4. `dev_flow_get_task` / `dev_flow_get_next_action` 的 `operation_probe.payload` 使用同一并集，
   因为它是同一份共享 payload 合同。

### B. 字段级 Violation（`internal/domain/errors.go`、`internal/workflow/*`、`internal/application/*`）

1. `domain.ViolationRule` 闭合枚举与 `domain.ContractViolation{Path, Rule, Message}`。
2. `domain.Error` 增加 `Violations []ContractViolation` 与 `Guard *GuardFailure`，保持
   `Code`/`Message` 与 `Is` 行为不变。
3. Workflow 在 payload 解码与 evidence 校验处产出 Violation；Application 透传；
   `internal/mcp/results.go` 投影为 `error.details`。
4. 顺序稳定：按请求出现顺序产出，再按 `path` 稳定排序去重。

### C. Guard 失败详情（`internal/workflow/payloads.go`、`internal/mcp/results.go`）

1. `domain.GuardRule` 闭合枚举与 `domain.GuardFailure{GuardID, Failures}`。
2. `guard_id` 取自当前 Process Definition 的 transition guard 标识，由
   `workflow.KnownTransitionGuard` 在投影前复核。
3. 只有 problem-class/findings 一致性这类真正的 guard 条件才上报为 Guard 失败。

### D. 一次零写入纠正（`internal/application/apply_action*.go`、`internal/mcp/results.go`）

1. `internal/application` 在 mutation 前的确定性校验阶段把 Violation 标记为零写入。
2. `EncodeError` 在存在零写入标记且能给出准确 `allowed_paths` 时返回
   `retry_safe=true` + `action=correct_current_action` + `allowed_paths`。
3. recovery 路径、Repository Drift、`INTERNAL_ERROR`、Store 提交路径保持 `retry_safe=false`。

### E. Skill 与文档同步

`packages/codex/plugin/skills/dev-flow/`、`packages/deepseek/skills/dev-flow/`、两个 package
README、`docs/CODEX_en.md`、`docs/DEEPSEEK_en.md`、`docs/COMMANDS.md`、`docs/COMMANDS_en.md`。

## Test Budget

实现阶段只运行四组定向验证（见 [quickstart.md](quickstart.md)）。完成后单独执行一次授权的本地
Codex Host callable 回读；不运行全仓库 suite、registry lifecycle 或 release 验证。

## Risks

- Host 投影规则由 Host 拥有。仓库合同复现其当前公开行为，真实 callable 回读需要独立授权。
- 发布 Schema 的建模体积贴近 Host 压缩预算上限；预算合同以显式保留量守护，任何新增 payload 成员
  都必须重新评估该预算。
- 并集放宽了 Host 侧的判别性。缓解手段是 Core 的字段级 Violation 与一次有界纠正。
