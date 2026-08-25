# Quickstart: Apply Action 合同恢复验证

四组定向验证。不运行全仓库 suite、registry lifecycle 或 release 验证；真实 Host 回读只在单独授权的
最终检查点执行一次。

## V1：Workflow 与 Evidence 规则

```bash
go test ./internal/workflow -run 'Test.*(Payload|ProblemClass|VerificationBudget|Evidence)'
```

覆盖四种 evidence source 矩阵、user `command_count=0`、automated `command_count` 至少为 1、
findings/problem_class 规则、`deviations` 不阻止 forward transition、violation `path` 与 `rule` 稳定。

## V2：Application 零写入与纠正

```bash
go test ./internal/application -run 'Test.*(InvalidArgument|TransitionNotAllowed|Correction|UserEvidence|ManualHandoff|ZeroWrite)'
```

覆盖错误请求 revision 不变、无 Task event/Evidence/Claim 写入、只有确定性 rule 产生
`allowed_paths`、同一 Action 一次纠正成功、第二次失败后停止、不确定写入保持 `retry_safe=false`。

## V3：MCP Schema、错误投影与真实 Go SDK 注册

```bash
go test ./internal/mcp ./tests/contract -run 'Test.*(Apply|Schema|Evidence|Error|Guard|SDK|ToolCatalog)'
```

覆盖根 `type=object`、六工具目录不变、每个对象封闭、Go SDK `AddTool` 不 panic、in-memory Server
连接与 `ListTools` 成功、`error.details` 与 `guard` 结构闭合、Core Schema 与 Workflow 规则一致。
同时包含 Host 投影合同：旧九分支形态坍缩为空 Schema，新形态保留根、`payload`、`node_result`、`checks`。

## V4：Host Skill 与 package 合同

```bash
node --test \
  packages/codex/tests/journey-evidence.test.mjs \
  packages/codex/tests/skill-contract.test.mjs \
  packages/codex/tests/package-contract.test.mjs \
  packages/deepseek/tests/skill-contract.test.mjs \
  packages/deepseek/tests/package-contract.test.mjs
```

覆盖 Codex/DeepSeek 参考内容一致、Skill 按最终 Schema 层级选择分支、user evidence 与 manual handoff
语义正确、Journey validator 接受新旧错误合同、`correct_current_action` 只允许一次确定性限定纠正、
六工具名称与用途不变。

## 观察到的失败请求复现

```json
{"source":"user","name":"Manual manager check","status":"passed",
 "summary":"Ran the packaged manager twice by hand","command_count":1,"full_suite":false}
```

预期结果：

```json
{"code":"INVALID_ARGUMENT",
 "details":[{"path":"payload.node_result.checks[3].command_count",
             "rule":"non_automated_command_count_zero",
             "message":"command_count must equal 0 when source is user"}]}
```

并附带 `retry_safe=true`、`action=correct_current_action`、
`allowed_paths=["payload.node_result.checks[3].command_count"]`。把该字段改为 `0` 并换新
`request_id` 后一次提交成功。

## 真实 Host 回读结果

授权的本地非 final package 已通过受支持的 remove/install/setup 流程安装并生成匹配 receipt。新任务只读
回读确认：`args` 与 `payload` 不是 `unknown`；`checks` 暴露 `source/name/status/summary/command_count/full_suite`；
`source` 暴露 `automated|user|static|host_observed`；六工具目录不变。
