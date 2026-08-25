# Data Model: Apply Action 合同恢复

## Persistence Disposition

`not-applicable`。无存储实体或 SQLite Schema 变更。Task 持久化格式、Action identity、
Process Definition 与 Evidence wire 字段全部保持不变。

## PublishedApplySchema

`dev_flow_apply_action` 的发布输入 Schema。一个封闭对象，字段集合等于既有 apply 请求字段。
`action_kind` 以 `enum` 暴露九个 action kind；`payload` 为可空封闭对象，成员为九种 payload 的完整并集。
它是既有九分支语义的**可投影松弛**，不是新合同。

## ContractViolation

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `path` | string | 相对 apply 请求根的稳定路径；数组用 `[index]` |
| `rule` | enum | 闭合 `ViolationRule` 枚举 |
| `message` | string | 该 rule 的固定文案，不含用户数据 |

## GuardFailure

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `guard_id` | string | 来自当前 Process Definition 的 transition guard 标识 |
| `failures` | array of ContractViolation | `rule` 取自闭合 `GuardRule` 枚举 |

## ZeroWriteCorrection

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `retry_safe` | bool | 仅当 Core 能确定零写入时为 true |
| `action` | string | `correct_current_action` |
| `allowed_paths` | array of string | 恰好等于可确定性纠正详情中的 `path` 集合；其他详情不产生纠正许可 |

## EvidenceInput（不变）

| Source | command_count | full_suite | 含义 |
| --- | --- | --- | --- |
| `automated` | integer 1..20 | boolean | Host 自动验证，计入预算 |
| `user` | 0 | false | 已完成的开发者人工验证，作为 manual evidence 保留 |
| `static` | 0 | false | 无命令执行的静态检查 |
| `host_observed` | 0 | false | 观察到的 Host 事实，不计命令预算 |

人工实际执行的 shell 命令写入 `summary`，不计入自动预算。已完成的用户检查进入 `checks` 且不再保留在
`manual_handoff_items`。

## 不变量

- 发布 Schema 的建模体积留在 Host 压缩预算之内并保留显式余量。
- 发布 Schema 每个对象 `additionalProperties: false`，每个节点有显式 `type`。
- 同一输入产生稳定的 Violation `path`、`rule` 与顺序。
- 结构化失败请求造成零 Task/Event/Claim/Evidence 写入且 revision 不变。
- `deviations` 非空不阻止 forward transition。
- `completed_work_item_ids` 只校验已提交 ID 属于当前 TaskPlan。
- 现有 error code 集合与六工具目录不变。
