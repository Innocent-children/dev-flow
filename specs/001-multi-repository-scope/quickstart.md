# Quickstart: 验证多仓库任务范围与用户配置

本指南用于实现完成后的有界验收。它不执行版本对齐、npm 发布、Tag、GitHub Release 或 registry
Journey，也不安装 codebase-memory。

## 1. 前置条件

- 在仓库根目录执行命令；
- 使用 `go.mod` 声明的 Go 1.26；
- Node.js >=24，pnpm >=11 <12；
- 依赖已按项目现有开发流程安装；
- 真实 Host Journey 使用临时 HOME、临时 Dev Flow data directory 和临时 Git 仓库；
- 开始前记录真实 Journey 与最终全仓门禁尚未执行，避免超过预算。

不需要真实 codebase-memory。配置为 true 的“能力缺失”场景必须由 Host capability fixture 或不可用
状态证明，不能自动安装工具。

## 2. 定向 Core 验证

### Domain、摘要与 scoped path

```bash
go test ./internal/domain ./internal/repository
```

预期直接证明：

- 1 个和 8 个仓库有效，第 9 个被拒绝；
- key、排序和重复 identity 不变量；
- 单仓库有效 digest 等于原 component digest；
- 多仓库 digest 对角色、key 或任一 component binding 改变敏感，且不受输入数组顺序影响；
- 单仓普通路径、多仓 `<key>::<relative-path>` 和未知 key 拒绝。

### Application、Recovery 与 Store

```bash
go test ./internal/application ./internal/recovery ./internal/store
```

预期只覆盖以下代表场景：

1. 主仓库 `core` + 附加仓库 `docs` 原子创建一个 Task；
2. 从 `docs` 的路径恢复同一 Task、revision 和 Action；
3. `docs` 已被另一 Task claim 时创建整体失败且零残留；
4. `docs` 出现未声明 path 或 HEAD drift 时整个 apply 零写入；
5. retained mutation 只在 `core` 完成、`docs` 未开始时得到 `partially_completed`；
6. 任一不兼容变化得到 `conflicting`；
7. terminal mutation 释放两个 claims；
8. 旧 schema 数据库在 writable open 前被 reject-and-reset 边界拒绝。

### 配置、MCP 与合同

```bash
go test ./internal/userconfig ./cmd/dev-flow ./internal/mcp ./tests/contract
```

预期证明：

- config 目录/文件缺失得到 Codex=false、DeepSeek=false 且不创建文件；
- 合法 split preference 通过 `dev_flow_server_info.host_preferences` 返回；
- 非法、未知、重复、非布尔、trailing、不可读和超过 16 KiB 的配置在 `store.Open` 前失败；
- `dev_flow_open_task` 新字段 closed、additional `maxItems=7`；
- Task result 保留主 `repository` 并返回 sorted additions；
- Action/probe/apply 仍只有一个 `repository_binding_digest`；
- catalog 仍恰好六个工具且顺序/annotation 不变。

## 3. 定向 Host 合同验证

只运行与本 Feature 直接相关的文件：

```bash
node --test \
  packages/codex/tests/launcher.test.mjs \
  packages/codex/tests/skill-contract.test.mjs \
  packages/codex/tests/journey-harness.test.mjs
```

```bash
node --test \
  packages/deepseek/tests/authorization.test.mjs \
  packages/deepseek/tests/skill-contract.test.mjs \
  tests/journeys/deepseek/simulated-graph-journey.test.mjs
```

预期证明：

- Codex 只接受当前主仓库和已授权 additional writable roots，不改变 sandbox；
- Codex Journey args 使用 `--cd <primary>`、`--sandbox workspace-write` 和显式
  `--add-dir <additional>`；
- DeepSeek 允许非 Git Workspace Root 下的两个 Git 子仓库，并在 Core call 前拒绝 root 外路径和
  symlink escape；
- 两套 Skill 同步使用 scoped path、server-info preference、一个 Action/摘要和六工具；
- `codebase_memory=false` 使用内置检索；true 但能力缺失时只提示一次并回退，不阻塞 Task。

## 4. 手工核对 MCP 形状

### 两仓库创建

Host 发出的创建参数应等价于：

```json
{
  "host": "codex",
  "repository_path": "/workspace/core",
  "primary_repository_key": "core",
  "additional_repositories": [
    {
      "key": "docs",
      "repository_path": "/workspace/docs"
    }
  ],
  "new_task": {
    "request": "Update Core and its documentation together.",
    "initial_scope": ["Change the bounded Core behavior", "Update matching docs"],
    "initial_out_of_scope": ["Release a package"],
    "known_acceptance_criteria": ["Both repositories reflect one accepted change"],
    "verification_budget": {
      "level": "targeted",
      "max_automatic_commands": 4,
      "allow_full_suite": false,
      "allow_manual_handoff": true
    },
    "method_profile": "plain"
  }
}
```

结果必须只有一个 Task、revision 和 current Action；`additional_repositories[0].key` 为 `docs`；
Action 只有一个 aggregate `repository_binding_digest`。

### Scoped payload

多仓库 implementation/refactor payload 的 path 形状：

```json
{
  "changed_paths": [
    "core::internal/application/open_task.go",
    "docs::docs/ARCHITECTURE.md"
  ]
}
```

单仓库同一字段继续是：

```json
{
  "changed_paths": ["internal/application/open_task.go"]
}
```

### 从附加仓库恢复

```json
{
  "host": "codex",
  "repository_path": "/workspace/docs",
  "new_task": null
}
```

结果必须返回创建时同一 `task_id`、revision、Action、主 key 和完整 Scope；`docs` 不会变成主仓库。

## 5. 配置行为核对

在测试管理的临时 HOME 中分别验证：

1. `.dev-flow/config.json` 不存在：server info 返回 false/false，HOME 内容不变；
2. 合法配置：分别返回配置值；
3. 配置包含未知 Host/字段或非布尔值：Core 在 SQLite 打开前失败，数据库路径不存在或字节不变；
4. DeepSeek=true 但能力不可用：一次提示后使用内置文本检索并继续 Task。

不得在开发者真实 HOME 中覆盖配置，也不得用配置测试启动安装器。

## 6. 真实 Host Journey（各最多一次）

真实 Journey 必须是本 Feature 独立的两仓库验收模式，不复用或改写历史 Feature/release evidence。
实现任务应在现有 journey harness 中增加一个明确的 `multi-repository` 入口，并在执行前一次性确认
参数、临时目录和证据输出。

本节的 Codex 和 DeepSeek 真实 Host Journey 以及第 7 节的最终仓库级验证各最多调用一次。
调用前必须先完成对应的定向检查；每次实际启动均消耗对应预算，无论结果为成功、失败、中断或
超时。若任一最终检查失败，Feature 进入 `Blocked`，不得直接重跑；修复阶段只允许运行与失败原因
直接相关的定向检查。

若确实需要第二次执行，必须先获得用户明确批准，并同步修订 `spec.md`、`plan.md`、
`quickstart.md` 和 `tasks.md` 中的验证预算。预算修订完成前不得执行第二次。

### Codex

- 一个临时主 Git 仓库和一个临时附加 Git 仓库；
- 一个 Codex 运行，使用 `--cd <primary>`、`--add-dir <additional>` 和
  `--sandbox workspace-write`；
- 创建两仓库 Task、在两个仓库完成一个有界修改、从附加仓库恢复并完成同一 Task；
- 记录一个 Task、一套 Action/revision/Outcome 和两个 claim 的证据；
- 未授权目录拒绝由第 3 节确定性测试证明，不再为此运行第二次真实 Journey。

### DeepSeek

- 一个非 Git 临时 Workspace Root，其下初始化主/附加两个 Git 仓库；
- 一个 DSH 运行完成创建、双仓修改、从附加仓库恢复和同一 Task 终态；
- root 外拒绝由第 3 节 guard 测试证明，不再运行第二次真实 Journey。

## 7. 最终全仓门禁（最多一次）

所有定向检查、文档同步和两个 Host Journey 完成后，最多执行一次：

```bash
pnpm run validate
```

运行后记录命令、结果和一次性预算消费。不得追加平台矩阵、3～8 仓库矩阵、压力/性能/fuzz、真实
codebase-memory 或发布验证。

## 8. 完成判定

只有以下事实同时成立才满足 Feature 验收：

- 单仓库行为和路径保持兼容；
- 两仓库 Task 全程只有一个 Core 流程状态；
- claims 原子且能从任一仓库恢复；
- drift/uncertain mutation 覆盖完整 Scope 并返回既有正确分类；
- 两个 Host 各自权限边界有效；
- config missing/valid/invalid 与索引 fallback 符合合同；
- 文档 locale 同步；
- 未修改公开版本，未执行 npm、Tag、GitHub Release 或其他发布工作。
