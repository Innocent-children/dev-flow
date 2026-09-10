# Core 响应规范

[中文](CORE-RESPONSES.md) | [English](CORE-RESPONSES_en.md)

本规范约束 Core 的 MCP 响应，由 `internal/mcp/results.go` 和 `output_schemas.go` 实现。
Core 负责描述实际结果、具体失败条件和允许的下一步；Host 保存完整响应并按结构化字段处理。
工具请求见 [命令参考](COMMANDS.md)，Host 执行说明见共享 Skill 的 `tool-results.md`。

## 成功和失败

每个响应包含 `ok`、`request_id`、`tool`。`request_id` 关联本次调用，`tool` 标识实际工具。
`ok=true` 必须包含 `result`，且不含 `error`、`recovery`；`ok=false` 必须包含
`error`、`recovery`，且不含 `result`。输出 Schema 必须校验这两种互斥结构。

成功表示该工具完成了所报告的操作。节点提交仍须读取保存的 Task：结果可能是 BLOCKED、DONE
或 CANCELLED。普通提交的 Task 在 `result`；open/get 在 `result.task`；next-action 在
`result.action`；relocation prepare 返回 `result.relocation_id` 和 `result.task`。
恢复查询另带 `recovery_assessment`，先处理其 `next_advice`，再执行当前 Action。

## 错误字段

`error.code` 是稳定的错误类别，`message` 是不插入请求内容的说明。
已识别的参数问题使用 `details[]`，每项包含请求字段 `path`、固定规则 `rule` 和具体要求
`message`。数组位置使用 `[index]`。预算错误中的 `verification.*` 指向当前 Task 的预算或用量；`arguments` 指整个 MCP 参数对象，其余参数错误路径指向本次请求字段。状态转换条件使用 `guard.guard_id` 和
`guard.failures[]`。Core 返回能确定的全部相关字段，不让 Host 从通用文案猜字段。

`VERIFICATION_BUDGET_EXCEEDED` 只表示数量上限，`error.budget` 给出 `used`、`requested`、
`limit`；`details[].rule` 区分自动命令和保存记录数量。`VERIFICATION_NOT_ALLOWED` 表示
完整套件或待办人工检查的权限限制，具体字段由 `details[]` 指明。已完成的用户检查和已给出的
验收决定不消耗自动命令额度，也不受待办人工检查开关限制。

公开错误不包含提交的正文、配置值、密钥、内部目录或堆栈。`repository_paths` 仅用于已有的
文件清单遗漏反馈。计数只包含上述非敏感数量。

## 恢复指引

`recovery` 必须包含 `action`、`retry_safe`、`message`。机器处理以 `action` 为准，文案必须
说明同一个动作。`retry_safe=false` 不代表发生过写入，也不要求对允许的只读查询再次征求许可。

| action | Host 行为 |
| --- | --- |
| `correct_request` | Core 已确认握手、读取、创建或生命周期请求在参数检查时零写入。保留同一工具、未列入纠正范围的已有请求身份字段和已有授权，仅按已有事实纠正 allowed_paths 并提交一次 |
| `correct_current_action` | Core 已确认零写入。核对同一个 Action 和当前 Schema，仅根据已有事实修改 `allowed_paths` 内字段，纠正提交一次 |
| `read_next_action`、`read_task`、`retry_read` | 执行指定的只读查询，处理返回的当前状态；不原样重放被拒绝的提交 |
| `resolve_blocker`、`restore_or_abandon`、`use_origin_host`、`provision_worktree` | 根据当前状态执行对应操作，仅对缺失的用户决定提问 |
| `repair_storage`、`report_internal_error`、`none` | 停止自动提交，报告具体问题和需要的操作；文案不能同时要求自动重试 |

只有 `correct_current_action` 和 `correct_request` 返回 `retry_safe=true` 和非空 `allowed_paths`，且路径必须来自
本次错误详情。确定的检查说明遗漏可以纠正；用户确认、验收结论和未知测试结果不能通过纠错补造。
提交前先核对必填字段，纠正后仍失败则报告新的具体问题。不得把响应里的 request_id 加入不接受该参数的工具请求。

响应缺失、损坏、超时或写入情况不确定时，Host 先读取原 Task/Action 的保存操作，再使用 Core
允许的恢复路径。不得把失败响应解释为成功，也不得用上一次成功提交的结果替代本次响应。

## 验证要求

MCP 测试对真实成功/失败响应执行输出 Schema 校验，并覆盖结果路径、非法混合结构、错误字段、
数量与权限区分、零写入纠错及结果不确定的停止条件。共享 Skill 示例必须对同一接口执行校验，
Codex 和 DeepSeek 使用相同语义。新增或修改错误时同步更新实现、Schema、本规范及受影响示例。

## WebUI HTTP 映射

WebUI 使用独立的 HTTP DTO：失败仍使用相同的 Core code、details、budget，并提供 field_paths
用于表单定位。workflow_write_state 区分 not_committed 与 unknown；前者说明当前边界确认未提交，
后者要求先查询保存操作。HTTP 的恢复提示保持相同的纠错前提，不能把结果不确定当作参数错误直接提交。

## 请求与完整响应示例

两端 Skill 的每个完整 MCP 请求都链接对应的完整成功响应，并紧跟错误响应，逐项说明触发条件、校验函数和响应编码函数。成功示例包含用当前 Task 值替换占位符后的完整请求；测试实际执行请求并比较完整返回。仓库观察使用固定测试数据，生成的身份、时间和操作摘要使用稳定示例值。Codex Host helper 与 DeepSeek workspace 请求同样配对完整返回，由临时 Git 仓库中的实际适配器操作校验；Host 会话和 Core 终态读取使用标注的模拟结果。
测试从前一个正确请求构造说明中的失败输入，对完整响应进行比较，包括 message、details、guard
和 recovery。示例说明确定的失败情况，不穷举所有运行条件；已有公共错误示例也与当前编码结果一致。

历史恢复分别报告 `history_resolution.choice` 的枚举错误和 `history_resolution.reason` 的文本错误；多个字段同时错误时一并返回。
