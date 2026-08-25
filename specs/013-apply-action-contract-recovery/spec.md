# Feature Specification: Apply Action 合同恢复

**Feature**：`specs/013-apply-action-contract-recovery`
**Created**：2026-08-25
**Status**：Complete
**变更类型**：Product Feature（公共合同 + 共享错误 + Host adapter 合同）

## 摘要

`dev_flow_apply_action` 的 Core JSON Schema 与 Go MCP SDK 注册都成立，但真实 Codex Host 仍把该
callable 投影为 `dev_flow_apply_action(args: unknown)`。调用端因此看不到 `action_kind`、`payload`
和 `COMPLETE_TEST` 的 `checks` 结构，只能靠猜测构造 payload；一旦构造错误，Core 只返回通用
`INVALID_ARGUMENT` 或 `TRANSITION_NOT_ALLOWED`，且当前 Skill 禁止为同一 Action 重新提交纠正后的
payload，最终迫使用户取消整个 Task。

本 Feature 把四个互相关联的缺口一次修正：可被 Host 展开的 apply Schema、字段级校验 Violation、
Guard 失败详情，以及一次有界的零写入 payload 纠正。

## 当前事实

1. **Schema 形态**：`internal/mcp/schemas.go` 发布 `{"type":"object","oneOf":[九个完整分支]}`，
   每个分支再用 `allOf` 收窄 recovery 约束。根层存在 composition 关键字。
2. **Host 投影**：当前 Codex tool-schema 转换器只建模
   `$ref/type/description/enum/items/properties/required/additionalProperties/anyOf/oneOf/allOf/$defs/definitions`，
   并对建模后的 Schema 施加一个小字节预算。超预算时它依次剥离 description、丢弃 definition 表、
   把折叠深度以下的复杂对象替换为空 Schema，最后把**任何带 composition 关键字的节点**替换为空
   Schema——包括根。九分支根联合体远超预算，因此根被清空为 `{}`，callable 退化为 `args: unknown`。
3. **Evidence 规则**：`internal/workflow/verification_budget.go` 已精确执行 automated `1..20`、
   非 automated `command_count=0` 且 `full_suite=false`；但调用端无法从真实 callable 读到该规则。
4. **错误粒度**：`internal/mcp/results.go` 的 `publicFailure` 只按 error code 返回固定文案，
   没有失败字段路径，也没有 Guard 标识。
5. **Recovery**：所有 `EncodeError` 结果一律 `retry_safe=false`，Skill 因此不能为同一 Action
   提交任何纠正，即使 Core 能确定请求在任何写入前就被拒绝。

## 用户场景

### User Story 1 - 调用端能看到真实 apply 合同（P1）

调用端在 Codex 会话中打开 `dev_flow_apply_action` 的 callable 声明，能看到 `action_kind` 的九个
取值、全部顶层身份字段，以及 `payload` → `node_result` → `checks` 的完整成员与 `source` 取值。

**Independent Test**：定向 MCP 测试在仓库内模拟 Host 的建模与压缩过程；旧九分支形态必须坍缩为
空 Schema，新形态必须保留根、`payload`、`node_result` 和 `checks` 成员。

### User Story 2 - 用户证据可被正确构造（P1）

调用端为 `COMPLETE_TEST` 提交人工验证时，把 `command_count` 设为 0、`full_suite` 设为 false，
把人工实际执行的 shell 命令写进 `summary`，并把已完成项从 `manual_handoff_items` 移除。

**Independent Test**：定向 workflow 与 application 测试覆盖四种 source 矩阵、已完成用户检查进入
`checks`、`manual_handoff_items` 仅保留未执行事项。

### User Story 3 - 校验失败指出确切字段（P1）

调用端提交 `checks[3].source=user` 且 `checks[3].command_count=1` 时，得到
`payload.node_result.checks[3].command_count` 与 `non_automated_command_count_zero`，
而不是通用文案。

**Independent Test**：定向 workflow/application/MCP 测试断言 path、rule 与顺序稳定，且结果不含
用户数据实际值、文件内容、数据库路径、环境变量或堆栈。

### User Story 4 - Guard 失败指出确切原因（P2）

`implementation_ready_for_test` 因 `problem_class=none` 而 `findings` 非空被拒时，调用端得到
`guard_id` 与 `forward_findings_empty` 失败项，而不是"transition 不允许"。

**Independent Test**：定向测试断言 `guard_id` 来自当前 Process Definition，且 Repository Drift、
字段格式错误、未知 work item 不会伪装成 Guard 失败。

### User Story 5 - 一次零写入纠正（P2）

当 Core 能确定请求在任何 Task、Event、Claim 或 Evidence 写入前失败时，调用端得到
`retry_safe=true`、`action=correct_current_action` 和 `allowed_paths`，可以为同一 Action 提交
一次纠正；第二次失败立即停止。

**Independent Test**：定向 application/MCP/Skill 测试断言 revision 不变、无写入、确定性 rule 才
产生 `allowed_paths`、Host 合同限制其他字段不变、不确定写入保持 `retry_safe=false`。

## Functional Requirements

- **FR-001**：`dev_flow_apply_action` 的发布 Schema 根必须是 `type: object` 且带非空 `properties`，
  根层不得出现 `oneOf`、`anyOf`、`allOf`、`not`、`if`、`enum`。
- **FR-002**：apply Schema 树内不得出现任何 composition 关键字，nullable 必须用 `type` 数组表达。
- **FR-003**：`action_kind` 必须以 `enum` 暴露全部九个 action kind。
- **FR-004**：全部十一个必填顶层身份字段加 `recovery_apply` 必须在发布 Schema 的 `properties` 中可见。
- **FR-005**：`payload` 必须是封闭对象（可为 null），并暴露 `transition_id`、`summary`、`reason`、
  `artifacts`、`method_evidence`、`node_result` 六个成员。
- **FR-006**：`payload.node_result` 必须暴露九种 node result 成员的完整并集，且 `additionalProperties`
  为 false。发布 Schema 中每个对象都必须 `additionalProperties: false`。
- **FR-007**：`checks` 必须暴露 `source`（四取值 enum）、`name`、`status`、`summary`、
  `command_count`、`full_suite` 的完整结构。
- **FR-008**：source-specific 规则、已完成用户验证归属和 `manual_handoff_items` 语义必须出现在
  apply 工具 description 中，因为投影器优先丢弃 Schema description。
- **FR-009**：发布 Schema 的建模体积必须留在 Host 压缩预算之内，使任何有损 pass 都不会执行。
- **FR-010**：`INVALID_ARGUMENT` 的公开结果必须支持 `details` 数组，元素含稳定 `path`、闭合枚举
  `rule` 和不含用户数据的 `message`。
- **FR-011**：`details` 至少覆盖：非法 source、非 automated `command_count` 非 0、非 automated
  `full_suite=true`、automated `command_count=0`、`action_kind` 与 payload branch 不匹配、
  required 字段缺失、未知字段。
- **FR-012**：同一输入必须产生稳定的 `path`、`rule` 和顺序。没有安全字段详情时可只返回原有公共错误。
- **FR-013**：`TRANSITION_NOT_ALLOWED` 的公开结果必须支持 `guard` 对象，含来自当前 Process
  Definition 的 `guard_id` 和闭合枚举 `rule` 的 `failures`。
- **FR-014**：Repository Drift、字段格式错误和未知 work item 不得作为 Guard 失败上报。
- **FR-015**：必须保留现有语义：`problem_class=none` 时 `findings` 必须为空；非 none 时必须非空；
  `deviations` 非空不阻止 forward transition；`completed_work_item_ids` 只校验已提交 ID 是否属于
  当前 TaskPlan。
- **FR-016**：仅当 Core 能确定请求在任何 Task、Event、Claim 或 Evidence 写入前失败时，Recovery
  必须返回 `retry_safe=true`、`action=correct_current_action` 和 `allowed_paths`。
- **FR-017**：以下情况必须保持 `retry_safe=false`：mutation 结果不确定、Store 提交可能已发生、
  response 丢失或截断、Action identity 过期、Repository Drift、无法给出准确 `allowed_paths`、
  `INTERNAL_ERROR`。
- **FR-018**：Codex 与 DeepSeek Skill 必须描述与最终 Schema 一致的分支层级，并纠正
  "under `allOf`, choose the `oneOf` payload branch" 旧说明。
- **FR-019**：Skill 必须允许在全部前置条件成立时为同一 Action 提交**一次**纠正，且第二次失败后停止。
- **FR-020**：现有 error code 集合、六工具目录、Task 持久化格式、Action identity、Process
  Definition 和 Evidence wire 字段保持不变。
- **FR-021**：`correct_current_action` MUST 只用于纠正值可由闭合 rule 唯一确定的失败；其他零写入
  失败可以返回字段详情，但 MUST 保持 `retry_safe=false`。
- **FR-022**：`allowed_paths` 限制由 Host Skill 对保留的原请求执行；Core 不得宣称比较或拒绝了
  原请求之外的合法字段变化，测试不得把“仍有另一个错误”表述成“未授权字段被拒绝”。
- **FR-023**：第二次纠正仍失败时，Host MUST 只报告 `path`、`rule` 和纠正仍失败的事实，不得报告
  两次提交的实际字段值。
- **FR-024**：未知成员详情 MUST 保留完整父对象和数组索引；`checks`、`artifacts`、
  `method_evidence`、baseline 与 work item 内部成员均适用。
- **FR-025**：非法 repository path、重复列表项和列表超限 MUST 使用准确的闭合 rule；不能准确分类时
  MUST 回退到不带详情的 `INVALID_ARGUMENT`。
- **FR-026**：Codex Journey evidence validator MUST 同时接受旧公共错误形状和本 Feature 的
  `details[]`、`guard`、`allowed_paths`、`correct_current_action` 形状，并保持 closed-field 校验。

## Success Criteria

- **SC-001**：仓库内 Host 投影合同证明旧九分支形态坍缩为空 Schema，新形态保留根、`payload`、
  `node_result` 与 `checks`。
- **SC-002**：Go MCP SDK 能 `AddTool`、启动 in-memory Server 并 `ListTools`，列出的 apply Schema
  仍通过投影合同。
- **SC-003**：`source=user, command_count=1` 的请求返回
  `payload.node_result.checks[3].command_count` + `non_automated_command_count_zero`。
- **SC-004**：`problem_class=none` 且 `findings` 非空的 `implementation_ready_for_test` 返回
  `guard_id` 与 `forward_findings_empty`。
- **SC-005**：结构化失败请求后 Task revision 不变，且没有 Task event、Evidence 或 Claim 写入。
- **SC-006**：同一 Action 的一次确定性纠正成功；Skill 合同限制只修改 `allowed_paths`；第二次失败后
  停止且不公开提交值。
- **SC-007**：四组定向验证全部通过，不运行全仓库 suite。
- **SC-008**：嵌套未知成员返回完整路径，列表与路径错误返回准确 rule。
- **SC-009**：Codex Journey evidence validator 接受新旧错误合同并拒绝未知扩展。

## Assumptions

- 真实 Host 的投影规则由 Host 拥有。仓库合同复现其当前公开行为，不能替代真实回读。
- Codex 以 plugin `mcpServers` 注册 Dev Flow，工具 description 在 1000 字节以内被完整投影。
- 当前 `EvidenceSource` 枚举与 workflow validator 语义是产品权威，不新增 alias。
- 用户报告的 `args: unknown` 与被拒 payload 作为外部已观察事实保留。

## Non-Goals

验证预算追加或修改 API；TaskIntent、Process Node 或 Transition 集合变更；SQLite Schema 迁移；
Active Feature 自动选择；Dev Flow 与 Spec Kit 流程合并；Task 取消语义；`INTERNAL_ERROR` 根因追踪
或日志系统；`create-dev-flow` 安装器；Codex/DeepSeek lifecycle；新 MCP 工具；Repository Scope 或
Recovery 五分类重构；版本升级、发布、Tag、GitHub Release；commit、push、PR、merge；全仓库重构和
无关格式化。

## Key Entities

- **PublishedApplySchema**：单个封闭对象，九分支语义的可投影并集。
- **ContractViolation**：`path` + 闭合 `rule` + 无敏感数据 `message`。
- **GuardFailure**：`guard_id` + `failures[]`（同 ContractViolation 形状）。
- **ZeroWriteCorrection**：`retry_safe` + `action` + `allowed_paths`。
