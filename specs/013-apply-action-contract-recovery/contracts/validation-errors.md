# Contract: Field-level Validation and Guard Failures

## INVALID_ARGUMENT

```json
{
  "code": "INVALID_ARGUMENT",
  "message": "The request does not match the closed Core contract.",
  "details": [
    {
      "path": "payload.node_result.checks[3].command_count",
      "rule": "non_automated_command_count_zero",
      "message": "command_count must equal 0 when source is user"
    }
  ]
}
```

### 规则

- `path` 是相对 apply 请求根的稳定路径。数组用 `[index]`，成员用 `.name`。
- `rule` 来自闭合枚举。未知 rule 不得出现在公开结果中。
- `message` 是该 rule 的固定文案。不插值用户数据实际值、文件内容、数据库路径、环境变量或堆栈。
- 同一输入产生稳定的 `path`、`rule` 与顺序（按 `path` 稳定排序）。
- 没有安全字段详情时省略 `details`，只返回原有公共错误。
- 现有 error code 集合不变；`details` 是附加字段。

### 闭合 rule 枚举

| rule | 含义 |
| --- | --- |
| `evidence_source_invalid` | `source` 不属于 `automated`/`user`/`static`/`host_observed` |
| `non_automated_command_count_zero` | 非 automated source 的 `command_count` 必须为 0 |
| `non_automated_full_suite_false` | 非 automated source 的 `full_suite` 必须为 false |
| `automated_command_count_positive` | automated source 的 `command_count` 必须至少为 1 |
| `automated_command_count_limit` | automated source 的 `command_count` 不得超过上限 |
| `evidence_name_duplicate` | 同一 TEST payload 内 `name` 重复 |
| `action_kind_payload_mismatch` | `action_kind` 与 payload branch/当前节点不匹配 |
| `required_member_missing` | 闭合合同要求的成员缺失 |
| `unknown_member` | 出现闭合合同之外的成员 |
| `text_not_normalized` | 必填文本为空、含首尾空白或超出上限 |
| `string_list_duplicate` | 有界字符串列表出现重复项 |
| `string_list_too_long` | 有界字符串列表超过成员上限 |
| `repository_path_invalid` | repository contract path 不合法 |
| `repository_mutation_inconsistent` | `changed_paths` 与 `no_file_changes` 互相矛盾 |
| `evidence_status_invalid` | `status` 不属于闭合 evidence status 集合 |
| `problem_class_not_valid_for_node` | `problem_class` 不属于当前节点允许集合（保持 `INVALID_ARGUMENT` 兼容） |

## TRANSITION_NOT_ALLOWED

```json
{
  "code": "TRANSITION_NOT_ALLOWED",
  "message": "The transition guard was not satisfied.",
  "guard": {
    "guard_id": "implementation_report_complete",
    "failures": [
      {
        "path": "payload.node_result.findings",
        "rule": "forward_findings_empty",
        "message": "findings must be empty when problem_class is none"
      }
    ]
  }
}
```

### 规则

- `guard_id` 必须来自当前 Process Definition 的 transition guard 标识。
- `failures[].rule` 来自闭合枚举，形状与 `details[]` 相同。
- Repository Drift、字段格式错误、未知 work item **不得**伪装成 Guard 失败。
- 当 transition 本身不在当前节点的合法出边集合中时，返回原有公共错误，不带 `guard`。

### 闭合 guard rule 枚举

| rule | 含义 |
| --- | --- |
| `forward_findings_empty` | `problem_class=none` 时 `findings` 必须为空 |
| `problem_findings_present` | 非 none `problem_class` 时 `findings` 必须非空 |
| `problem_class_transition_mismatch` | `problem_class` 与所选 transition 要求不一致 |

`problem_class` 不属于当前节点允许集合时保持既有 `INVALID_ARGUMENT` code，因此该规则属于
`ViolationRule` 而不是 guard 失败。

### 明确保留的语义

- `problem_class=none` 时 `findings` 必须为空。
- 非 none `problem_class` 时 `findings` 必须非空。
- `deviations` 非空**不**阻止 forward transition，并可作为 ImplementationRecord 保存。
- `completed_work_item_ids` 只校验已提交 ID 是否属于当前 TaskPlan，不要求覆盖全部 work item。

## 安全边界

公开结果不得包含：用户数据实际值、文件内容、仓库路径、数据库路径、环境变量、Go 错误串、堆栈。
`internal/mcp` 的定向测试对 `details` 与 `guard` 做拒绝式断言。

未知成员路径必须包含完整父级和数组索引，例如
`payload.node_result.checks[0].extra_member`。无法安全恢复完整路径时省略详情。
