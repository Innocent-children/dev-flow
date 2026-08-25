# Contract: One Zero-write Payload Correction

## Core 结果

仅当 Core 能确定请求在任何 Task、Event、Claim 或 Evidence 写入**之前**失败时：

```json
{
  "retry_safe": true,
  "action": "correct_current_action",
  "allowed_paths": [
    "payload.node_result.checks[3].command_count"
  ]
}
```

`allowed_paths` 恰好等于可确定性纠正的结构化失败详情中的 `path` 集合，按稳定顺序去重。任何失败
不存在唯一纠正值时，Core 保留详情但不得返回该 recovery 形状。

## Core 侧零写入判定

`ApplyAction` 的确定性前置阶段（identity 校验、payload 解码、封闭合同校验、evidence 规则校验、
transition 查找、guard 一致性）全部发生在 `store.CommitTask` 之前且不做任何写入。只有在该阶段产生的
结构化领域错误才带 `correct_current_action`。

以下情况**继续保持** `retry_safe=false`：

- mutation 结果不确定；
- Store 提交可能已经发生；
- response 丢失或截断；
- Action identity 过期（`ACTION_STALE`、`REVISION_CONFLICT`）；
- Repository Drift；
- 无法给出准确 `allowed_paths`；
- `INTERNAL_ERROR`；
- 任何经由 `recovery_apply` 的 reconciliation 路径。

## Host 侧一次纠正规则

Skill 允许为**同一 Action** 提交一次纠正，且必须全部条件成立：

1. 原结果是完整结构化 Core 领域错误（带 `details` 或 `guard`）；
2. `recovery.action` 为 `correct_current_action`；
3. `retry_safe` 为 `true`；
4. Task revision、Action ID、process identity、source cursor 与 repository binding 未变化；
5. 新请求使用**新的** `request_id`；
6. 只修改 `allowed_paths` 列出的字段；
7. 纠正值可以直接从 `rule` 确定，不依赖源码猜测；
8. 其他 payload 字节保持相同语义。

第二次提交仍失败时立即停止，不再提交第三个候选 payload。只报告确切 rule、path 与纠正仍失败的
事实，不报告任一次提交的实际字段值。

`allowed_paths` 是 Core 对可确定性纠正成员的授权。Host Skill 负责保留原请求并限制只修改这些成员；
Core 不保存被拒请求，也不比较两次 payload，因此不宣称在服务端拒绝了其他合法字段变化。

## 禁止

- 不得放宽对不确定写入的安全规则。
- 不得把 `correct_current_action` 用于 identity、repository 或 process 类失败。
- 不得在纠正请求中重用原 `request_id`。
- 不得连续纠正超过一次。
