# Protocol Fixtures

本目录保存有界、可复查的 public projection fixture。它们由 contract tests 消费，不被
Application 当作 runtime workflow authority。fixture 不包含真实数据库路径、用户目录、source
content、Git diff/status、raw command output、environment、token 或 secret。

## Current graph fixtures

- `graph-server-info.json`：完整、定序的 current ServerInfo、`standard-development`、三种
  method profile 和六工具 catalog；
- `graph-open-requirements.json`：创建 graph Task、TaskIntent、REQUIREMENTS Action 和唯一出边；
- `graph-design-action.json`：DESIGN Action 的完整合法出边；
- `graph-invalid-edge.json`：DESIGN 上 undeclared transition 的 closed zero-write error。

这些文件是当前 source contract 的 static fixture evidence；它们不等同于 native Host 或
released package evidence。

## Current Core Host parity fixtures

- `graph-host-parity-codex.json`；
- `graph-host-parity-deepseek.json`。

两份文件只在 `host`、`origin_host` 和 fixture-specific opaque `request_id` 上不同。它们证明 Core
对两个 Host identity 投影相同的 process、node、method、payload、error 和 storage 语义。
DeepSeek fixture 只证明 Host identity/Core parity。These fixtures do not implement or claim a DeepSeek
Adapter, Skill, package, native Journey, or product support. 静态 fixture 也不是任何真实 Host 证据。

## Released linear Core historical fixtures

以下文件记录已发布线性合同的历史事实，不能作为当前 graph 操作说明：

- `server-info.json`；
- `open-task.json`；
- `active-task-conflict.json`；
- `host-ownership-conflict.json`；
- `task.json`；
- `next-action.json`；
- `apply-success.json`；
- `rework.json`；
- `verification-budget-failure.json`；
- `revision-conflict.json`；
- `stale-action.json`；
- `repository-drift.json`；
- `completed-outcome.json`；
- `cancelled-outcome.json`。

其中出现的旧阶段、action 或 Schema 含义属于 Contract 0.1 freeze evidence。Contract 0.2 runtime
不会读取、迁移、继续或投影这些历史 Task。

## Frozen Recovery fixtures

以下 Contract 0.1 recovery 文件独立分组，以保留五分类和 read-before-retry 的历史公共形状：

- `recovery-not-started.json`；
- `recovery-completed-and-recorded.json`；
- `recovery-completed-but-unrecorded.json`；
- `recovery-partially-completed.json`；
- `recovery-conflicting.json`；
- `recovery-apply-read-back.json`；
- `recovery-blocked.json`；
- `recovery-resolved.json`。

当前 graph-native Recovery 使用 process reference 和 `source_cursor`，由 Domain/Application/
Journey tests 确定性证明。历史 fixture 不授权 `source_phase` 或旧 payload 进入 Contract 0.2。

## Evidence classification

- 上述 JSON 都是 **static evidence**；
- contract tests 对 exact JSON/schema/order/parity 的执行结果是 **deterministic contract evidence**；
- Contract 0.1 文件是 **historical freeze evidence**；
- 无 fixture 可称为 simulated/native Codex、real DeepSeek、registry package 或 released artifact。
