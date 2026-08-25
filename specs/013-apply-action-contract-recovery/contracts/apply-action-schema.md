# Contract: Host-projectable Apply Input Schema

`dev_flow_apply_action` 发布**一个**封闭对象，而不是判别式根联合体。

```text
{
  "type": "object",
  "additionalProperties": false,
  "required": ["request_id","host","task_id","revision","action_id","action_kind",
               "process_id","process_definition_digest","source_cursor",
               "repository_binding_digest","payload"],
  "properties": {
    "request_id": {"type":"string"},
    "host": {"type":"string","enum":["codex","deepseek"]},
    "task_id": {"type":"string"},
    "revision": {"type":"integer"},
    "action_id": {"type":"string"},
    "action_kind": {"type":"string","enum":[
      "COMPLETE_REQUIREMENTS","COMPLETE_DESIGN","COMPLETE_TASKS",
      "COMPLETE_IMPLEMENTATION","COMPLETE_TEST","COMPLETE_COMPREHENSION_REVIEW",
      "COMPLETE_REFACTOR","COMPLETE_DELIVERY","RESOLVE_BLOCKER"]},
    "process_id": {"type":"string","enum":["standard-development"]},
    "process_definition_digest": {"type":"string"},
    "source_cursor": {"type":"string"},
    "repository_binding_digest": {"type":"string"},
    "payload": {"type":["object","null"], "additionalProperties": false,
                "required":["transition_id","summary","reason","artifacts",
                            "method_evidence","node_result"],
                "properties":{...envelope + node_result...}},
    "recovery_apply": {"type":["object","null"], "additionalProperties": false,
                       "properties":{"operation_id":{...},"source_cursor":{...}}}
  }
}
```

## 硬性规则

1. 根必须是 `type: "object"` 且带非空 `properties`。
2. 整棵树不得出现 `anyOf`、`oneOf`、`allOf`、`not`、`if`、`then`、`else`、`$ref`。
3. nullable 用 `type` 数组表达，顺序固定为 `["object","null"]`。
4. 每个对象都必须 `additionalProperties: false`。
5. 每个节点都必须声明显式 `type`；array 必须有可投影 `items`；object 必须有非空 `properties`。
6. `required` 只出现在根与 `payload`。
7. `enum` 只出现在 `host`、`process_id`、`action_kind`、
   `payload.node_result.checks[].source`。
8. 建模体积（只计 Host 可建模关键字）必须留在 Host 压缩预算之内并保留显式余量。
9. `dev_flow_get_task` / `dev_flow_get_next_action` 的 `operation_probe.payload` 使用同一并集。

## payload envelope

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `transition_id` | string | 来自当前 Action 的 `available_transitions` |
| `summary` | string | 人工执行的 shell 命令写在这里，不计自动预算 |
| `reason` | string | transition 要求时非空，否则空串 |
| `artifacts` | array of closed object | `role`/`path`/`digest`/`summary` |
| `method_evidence` | array of closed object | `step_id`/`status`/`capability`/`summary` |
| `node_result` | closed object | 九种 node result 成员的完整并集 |

`node_result` 并集完整性由 `internal/mcp/graph_contract_test.go` 从 `graphPayloads()` 机械校验。

## COMPLETE_TEST checks

```text
"checks": {"type":"array","items":{
  "type":"object","additionalProperties":false,
  "properties":{
    "source":{"type":"string","enum":["automated","user","static","host_observed"]},
    "name":{"type":"string"},
    "status":{"type":"string"},
    "summary":{"type":"string"},
    "command_count":{"type":"integer","minimum":0,"maximum":20},
    "full_suite":{"type":"boolean"}}}}
```

跨字段规则不可结构化表达，因此写在工具 description 中：

- `command_count` 为 `1..20` 仅当 `source` 为 `automated`；
- `source` 为 `user`、`static` 或 `host_observed` 时 `command_count` 恰为 `0` 且
  `full_suite` 为 `false`；
- 已完成的用户验证记入 `checks`；`manual_handoff_items` 只保留尚未执行的事项；
- 分支不匹配由 Core 以 `INVALID_ARGUMENT` + 确切失败字段路径拒绝。

## 不变量

- 六工具目录、名称、用途与 annotations 不变。
- Task 持久化格式、Action identity、Process Definition 与 Evidence wire 字段不变。
- Core 侧精确校验不放宽：`internal/mcp/tools.go` 与 `internal/workflow/*` 仍执行完整封闭合同。
