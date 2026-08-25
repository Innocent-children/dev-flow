# Research: Apply Action 合同恢复

## Decision 1：根层与全树都不使用 composition 关键字

**Decision**：发布的 apply Schema 根为 `type: object` + `properties`，整棵树不出现
`anyOf`/`oneOf`/`allOf`，nullable 用 `type: ["object","null"]` 表达。

**Rationale**：当前 Codex tool-schema 转换器把 MCP inputSchema 归一化为一个受限模型，只保留
`$ref/type/description/enum/items/properties/required/additionalProperties/anyOf/oneOf/allOf/$defs/definitions`，
并对归一化结果施加一个字节预算。超预算时它按顺序执行四个递进有损 pass，最后一个 pass 会把**任何
带 composition 关键字的节点整体替换为空 Schema**，包括根节点。九分支根联合体远超预算，因此根被清空，
callable 退化为 `args: unknown`。这机械地解释了用户观察到的现象。

同一约束在模型侧也成立：OpenAI 的函数工具 `parameters` 拒绝顶层 `oneOf`/`anyOf`/`allOf`/`enum`/`not`，
错误为 `schema must be a JSON Schema of 'type: "object"'`。

**Alternatives considered**：
- 保留根 `oneOf` 并只加 description：投影器仍会清空根。
- 在根用 `allOf` + `if/then` 做判别：`allOf` 同样是顶层 composition，被同一规则拒绝。
- 把 `payload` 改成无约束 object 或 JSON 字符串：明确禁止，且会掩盖问题。
- 用 `$defs` + `$ref` 压缩重复子 Schema：`$ref`-only 节点没有 `type`，投影后不可展开；且第二个
  有损 pass 会把本地 `$ref` 重写为空 Schema。

**来源**（内容已改写以符合授权限制）：
- [Azure OpenAI Responses API 拒绝顶层 oneOf 工具 Schema（并因此影响 Codex）](https://github.com/Azure/azure-sdk-for-net/issues/61049)
- [Codex 会话因工具 parameters 顶层 composition 关键字失败](https://community.openai.com/t/codex-app-and-cli-not-working-after-update/1381471)
- [顶层 anyOf 被 Anthropic API 与 Codex 拒绝](https://github.com/MemPalace/mempalace/issues/1728)
- [Codex 0.20.0 MCP schema 转换失败：integer 不支持、union type 被拒、缺少 type](https://github.com/openai/codex/issues/2204)
- [为兼容内部 JsonSchema 模型加入的 MCP schema sanitization](https://github.com/openai/codex/pull/1975)
- [$ref 导致 MCP 工具参数投影丢失完整结构](https://github.com/openai/codex/issues/3152)
- [MCP 工具 inputSchema 中的 oneOf 对工具调用层不可靠](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/2806)
- [结构化输出仅支持 anyOf 子 Schema，且不能位于根](https://community.openai.com/t/official-documentation-for-supported-schemas-for-response-format-parameter-in-calls-to-client-beta-chats-completions-parse/932422/3)

## Decision 2：判别式并集，而不是九个可见分支

**Decision**：`action_kind` 用 `enum` 暴露九个取值；`payload` 与 `payload.node_result` 暴露九种
payload 成员的完整并集，全部对象保持 `additionalProperties: false`。

**Rationale**：Host 预算不允许九个完整分支同时可见（九分支归一化体积约为预算的五倍）。JSON Schema
若不使用根层 composition，也无法表达"`action_kind` 判别 `payload`"这一跨字段关系。因此结构可见性
由并集承担，精确性回到 Go Core——它本来就是 Constitution 定义的唯一权威——并通过新的字段级
Violation 把精确性变成可操作的调用端反馈。

**Alternatives considered**：只暴露部分成员（会让封闭对象拒绝合法 payload）；把 `node_result` 留成
开放对象（违反封闭合同）；拆分为 action-specific 工具（需要扩大六工具目录，未获授权）。

## Decision 3：把无法结构化的规则放进工具 description

**Decision**：source-specific evidence 规则、已完成用户验证归属、`manual_handoff_items` 语义写入
apply 工具的 `description`。

**Rationale**：投影器的第一个有损 pass 就是剥离 Schema description，而工具 description 与
inputSchema 预算分开计算并被完整投影（plugin 路径下截断阈值为 1000 字节）。因此工具 description 是
规则文本唯一可靠的可见位置。

**Alternatives considered**：把规则放进每个成员的 `description`（会被首个 pass 丢弃）；只依赖
`references/node-payloads.md`（调用端在读 callable 时看不到）。

## Decision 4：并集从九个精确 payload 机械推导

**Decision**：保留 `graphPayloads()` 作为语义源，发布 Schema 由 `projectableUnion` 对九个完整分支
做关系松弛得到，再由 `projectForHostBudget` 按显式路径白名单裁剪 `enum` 与 `required`。

**Rationale**：手写并集会随 payload 演进漂移。机械推导保证并集完整，并让"哪些 `enum`/`required`
被保留"成为一份可读、可测的显式清单。

**Alternatives considered**：手写发布 Schema（漂移风险）；对整棵树无差别删除 `enum`/`required`
（丢失调用端无法从别处读到的判别信息）。

## Decision 5：Violation 与 Guard 失败使用闭合枚举 + 稳定路径

**Decision**：新增 `domain.ViolationRule` 与 `domain.GuardRule` 闭合枚举；`path` 使用请求 JSON
指针风格的稳定路径（如 `payload.node_result.checks[3].command_count`）；`message` 为该 rule 的固定
文案，不插值任何用户值。

**Rationale**：稳定 path/rule 让 Host 能自动定位并纠正字段；固定文案天然满足"不包含用户数据实际值、
文件内容、数据库路径、环境变量或堆栈"。

**Alternatives considered**：回传 Go 错误串（会泄漏路径与值）；只回传 path（Host 无法判断纠正值）。

## Decision 6：零写入判定只依赖 Core 的确定性前置阶段

**Decision**：只有在 mutation 之前的纯校验阶段产生的结构化领域错误才附带
`action=correct_current_action` 与 `retry_safe=true`；一旦进入 Store 提交路径或结果不确定，保持
`retry_safe=false`。

**Rationale**：`ApplyAction` 的校验在 `CommitTask` 之前完成且不做任何写入，Core 可以确定性地证明
零写入。`recovery.Reconcile` 处理的不确定 mutation 与 `INTERNAL_ERROR` 无法证明，必须继续禁止重试。

**Alternatives considered**：对所有 `INVALID_ARGUMENT` 都允许重试（无法覆盖 recovery 路径的不确定
写入）；允许多次纠正（会把猜测循环合法化）。
