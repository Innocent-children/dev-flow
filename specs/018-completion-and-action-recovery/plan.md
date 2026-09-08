# 完成条件与统一 Action 恢复

## Problem

架构审计确认两个问题：IMPLEMENT 只检查已完成项属于计划，DELIVERY 自动生成全部通过的验收结果；WebUI 普通提交绕过 MCP 使用的 Action operation 保存流程，浏览器刷新后无法按 Action 标识恢复不确定提交。本次调整完整处理这两项 P1。

## Current approach

Host 依靠人工检查工作项和验收结果。MCP 使用 `SubmitAction` 保存规范化操作并按 Task/Action ID 恢复；WebUI 使用完整内部 payload 调用 `ApplyAction`，恢复依赖浏览器内存中的 OperationProbe。

## Available data

当前 Task 已保存 Requirements 的验收条件、WorkItem 的 acceptance indexes、Implementation 的 completed IDs、当前 Test 的 Evidence IDs、内容摘要和用户理解确认。SQLite 已提供 action_operations、revision CAS、TaskEvent 和 repository_claims 的事务写入。

## Behavior rules

### 完成约束

- IMPLEMENT→TEST 和 REFACTOR→TEST 要求当前计划全部工作项已经完成；返工边仍可报告部分完成。
- DELIVERY 的 `acceptance` 由调用方明确提交，每项保留 criterion/status，并新增非空、无重复的 `work_item_ids` 和 `evidence_ids`。
- 验收项按当前 Requirements 顺序完整出现，状态为 satisfied。关联工作项必须已完成且在计划中对应此验收索引；关联检查必须来自当前 Test，状态为 passed、属于当前 Task Plan revision。理解确认继续独立检查，不自动代替验收检查。
- Core 负责补齐 Test/Comprehension record IDs 和汇总 Evidence IDs。普通提交、恢复和持久化校验使用相同的完成约束。
- Domain 的独立完成约束模块负责记录关系校验；Application 负责结构化错误、提交与状态修改；Workflow 负责载荷 Schema、节点义务和转换描述。

### 提交与恢复

- WebUI 普通 Action 提交语义结果、Task revision 和 Action ID；Core 组装内部操作并经过现有 StageActionOperation/CommitActionOperation。blocker 同样通过 Core 的语义解除入口。
- HTTP 保留过期页面的 revision 检查。恢复请求只携带 Action ID，Core 读取保存的操作并判断处理方式。
- 详情投影待恢复 Action 标识和 Core 建议，使刷新、重新打开页面后仍可恢复。网络异常先回读 Core；待恢复期间禁止再次普通提交。
- 浏览器不保存内部 payload、流程游标或第二份 Task 状态。MCP 的现有 retained-operation 行为与 Host ownership 检查保持有效。

### 状态图

流程仍为 `standard-development`，11 个节点、30 条普通边。`StandardProcess` 中受影响节点的完成条件/方法说明改变，`DefinitionDigest` 按完整定义重算为 `44f013fc56810340f5d2f12b56ad041478ba01a5e16757e945f5908868744625`；JSON fixture 同步新 digest。没有新增转换。

| 节点 | 转换 | 目标 | guard | 必需 reason |
| --- | --- | --- | --- | --- |
| IMPLEMENT | implementation_ready_for_test | TEST | implementation_report_complete；全部工作项完成 | 否 |
| IMPLEMENT | implementation_requires_design | DESIGN | implementation_exposes_design_gap | 是 |
| IMPLEMENT | implementation_requires_requirements | REQUIREMENTS | material_requirement_gap | 是 |
| IMPLEMENT | implementation_needs_refactor | REFACTOR | implementation_complexity_identified | 是 |
| REFACTOR | refactor_ready_for_test | TEST | refactor_report_complete；全部工作项完成 | 否 |
| REFACTOR | refactor_requires_design | DESIGN | refactor_design_change_required | 是 |
| REFACTOR | refactor_requires_requirements | REQUIREMENTS | refactor_requirement_change_required | 是 |
| DELIVERY | delivery_complete | DONE | delivery_current_and_complete；验收关联完整有效 | 否 |
| DELIVERY | delivery_needs_implementation | IMPLEMENT | delivery_implementation_gap_identified | 是 |
| DELIVERY | delivery_needs_test | TEST | delivery_test_gap_identified | 是 |
| DELIVERY | delivery_needs_comprehension | COMPREHENSION_REVIEW | delivery_comprehension_gap_identified | 是 |
| DELIVERY | delivery_needs_design | DESIGN | delivery_design_gap_identified | 是 |
| DELIVERY | delivery_needs_requirements | REQUIREMENTS | delivery_requirement_gap_identified | 是 |

入口继续要求当前 Requirements/Design/TaskPlan，测试和交付继续要求当前内容摘要。IMPLEMENT/REFACTOR 可修改产品及流程文件，DELIVERY 可读取、整理流程文件和交付摘要。方法配置仍为 plain/spec-kit/openspec；实现方法步骤说明全部工作项完成，交付方法步骤说明逐项验收关联。

### 接口与保存格式

当前 OutcomeCriterion 和 DeliveryResult 的 acceptance 使用上述完整关联字段，不读取旧形状。SQLite 表结构不变；快照、操作 payload、MCP node_result Schema 和 HTTP 投影同步校验当前格式。Core 按未达首个主版本的破坏性接口变化增加 MINOR；稳定发布 metadata 留给独立发布流程。

## Expected result

遗漏工作项、验收关联不完整或引用过期检查时，Core 拒绝流转且不写入记录。WebUI 和 MCP 使用同一份可恢复操作；浏览器重新打开仍能读取待恢复提交并按 Core 建议继续。

## Risks and impact

误放行会记录错误的 DONE；过严的关联会阻止真实完成任务。规则仅检查已经保存的工作项、验收索引和当前检查，不尝试判断自然语言结论真实性。WebUI 恢复必须维持当前 Action/revision 校验，防止旧页面再次提交。保存格式直接替换，不增加历史数据迁移或回退路径。

## Acceptance checks

- Domain/Application：部分完成禁止进入 TEST；完整完成可继续；缺失、错误工作项及历史 Evidence 引用禁止 DONE；有效自动或人工检查关联可以交付。
- Store/Application：无效关联零写入；有效关联可保存重开；不确定 HTTP 提交保留 payload，按 ID 恢复后只增加一次 revision/Event；过期页面拒绝。
- WebUI：请求只发送语义字段；网络失败先回读；重新加载页面发现待恢复操作，恢复使用 Action ID。运行定向前端测试、TypeScript 检查和实际浏览器检查可用的流程。
- Protocol/Host：当前 MCP Schema、样例和两个 Host 的提交说明同步；旧验收形状拒绝。
- 文档：同步九个 README、PRODUCT、ARCHITECTURE、COMMANDS、WEBUI 和受影响的 Host 文档；报告实际执行的定向检查及无法执行的环境检查。

## Non-goals

本次仅修复两个 P1。列表查询优化、构建换行处理、发布、其他平台或 Agent 扩展不在范围内。Core 继续只读 Git；不增加流程节点、插件系统或第二套状态机。
