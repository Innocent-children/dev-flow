# Quickstart: 验证多仓库任务范围与用户配置

本指南用于实现完成后的有界验收。它不执行版本对齐、npm 发布、Tag、GitHub Release 或 registry
Journey，也不安装 codebase-memory。

## 1. 前置条件

- 在仓库根目录执行命令；
- 使用 `go.mod` 声明的 Go 1.26；
- Node.js >=24，pnpm >=11 <12；
- 依赖已按项目现有开发流程安装；
- 真实 Host Journey 使用临时 HOME、临时 Dev Flow data directory 和临时 Git 仓库；
- 开始前记录 T034 Attempt 状态以及 T035/T040 是否已执行，避免超过各自预算。

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

## 6. 真实 Host Journey（T034 evidence-driven repair loop，T035 最多一次）

真实 Journey 必须是本 Feature 独立的两仓库验收模式，不复用或改写历史 Feature/release evidence。
实现任务应在现有 journey harness 中增加一个明确的 `multi-repository` 入口，并在执行前一次性确认
参数、临时目录和证据输出。

T034 Attempts 1～6 保留为不可覆盖的历史证据。Attempts 1、2、4、5、6 已失败，Attempt 3 已通过但只证明
mutation 前恢复；Attempt 7 已通过最终双 session 合同，T034 已完成且 Feature 为 `Ready`。用户已授权 runner 将 substantive 与 resume
session 的 raw JSONL 以 `0600` sidecar 保存在独立 evidence 旁，并授权读取其中的完整 MCP 调用。
后续每次真实运行必须绑定新的 source commit，只验证上一份 raw failure 直接支持的精确修复；首次
通过后立即停止，失败时必须先读取 raw transcript 并修改根因，不允许无代码变化重跑。
Attempt 2 的 source-local build、isolated install、setup 与
registration/Core readback 通过，真实 Codex thread 已启动，但 post-session evidence
validation 未能证明从附加仓库恢复同一 Task。Attempt 3 已基于 source commit
`eee0950d24315aaee6562d112b7717303c946059` 证明创建后立即恢复。最终 runner 使用两个独立
Codex session：主仓 session 完成 mutation，附加仓 session 随后恢复并与最后一次成功 apply
对比。Attempt 4 的 setup/readback、server-info 与 Task 创建通过，但首次 apply 缺少顶层
`request_id`；通用 apply request-binding 规则现由相关 Prompt 共享。Attempt 5 不再报告 binding
缺失，但后续 apply 返回另一个 `INVALID_ARGUMENT`。multi-repository 现也共享既有完整 apply
payload 规则；闭合 failure evidence 保持最小字段，raw sidecar 保留完整诊断。
Attempt 6 raw transcript 显示 `implementation_ready_for_test` 的 Action 和 transition 均正确，但正常
分支 payload 将验证描述放进了非空 `findings`，Core 按合同返回 `TRANSITION_NOT_ALLOWED`。共享
apply 规则现要求所有正常 ready/passed/completed 分支使用 `problem_class=none`、`findings=[]`，并且
substantive session 不提前运行 TEST 节点的验证命令。
Attempt 7 证明 source-bound setup/readback、两个独立 Codex thread、一个 Core Task、两个仓库、
双仓 mutation 后从附加仓恢复，以及恢复前后 revision、Action ID、binding digest 与 Scope 一致。

T035 DeepSeek Journey 已基于 source commit
`14b8669bc331b88a6ccef3888d8c553a54c2bcc5` 调用一次并失败，预算 1/1 已消费。DSH exit code
为 0，但 evidence validation 发现会话首个调用为 `bash` 而不是 runner 假定的 server-info；闭合
evidence 中 Task 停在 `REQUIREMENTS`、revision 1，未证明双仓修改、附加仓恢复或终态。失败
evidence 保留在 `tests/journeys/deepseek/evidence/feature-001-multi-repository.json`。不得自动修复
重跑，Feature 为 `Blocked`。第 7 节 T040 仍为 0/1 且不得执行。

### Codex

- 一个临时主 Git 仓库和一个临时附加 Git 仓库；
- runner 在一个 Journey 内启动两个独立 Codex session，均使用
  `--sandbox workspace-write`；
- 第一段使用 `--cd <primary> --add-dir <additional>` 创建两仓库 Task、完成两个仓库的
  有界修改并成功 apply；
- 第二段使用 `--cd <additional> --add-dir <primary>`，只从附加仓库恢复，不修改文件或 apply；
- evidence 对比最后一次成功 apply 与恢复结果，并证明不同 Codex thread、同一 Core Task、
  revision、Action、digest 和 Scope；
- Attempt 7 通过 evidence 保留在
  `tests/journeys/codex/evidence/feature-001-multi-repository-attempt-7.json`，对应 raw sidecar 仅本地保存；
- Attempt 6 失败 evidence 保留在
  `tests/journeys/codex/evidence/feature-001-multi-repository-attempt-6.json`，对应 raw sidecar 仅本地保存；
- Attempt 5 失败 evidence 保留在
  `tests/journeys/codex/evidence/feature-001-multi-repository-attempt-5.json`；
- Attempt 4 失败 evidence 保留在
  `tests/journeys/codex/evidence/feature-001-multi-repository-attempt-4.json`；
- Attempt 3 evidence 保留在
  `tests/journeys/codex/evidence/feature-001-multi-repository-attempt-3.json`；
- Attempt 2 失败 evidence 保留在
  `tests/journeys/codex/evidence/feature-001-multi-repository-attempt-2.json`；
- 永久保留 Attempt 1 evidence
  `tests/journeys/codex/evidence/feature-001-multi-repository.json`；
- 未授权目录拒绝由第 3 节确定性测试证明，不再增加真实 Journey。

### DeepSeek

- 一个非 Git 临时 Workspace Root，其下初始化主/附加两个 Git 仓库；
- 唯一一次 DSH 运行已失败并消费 1/1；T035 保持未完成；
- 失败 evidence 只证明一个 DeepSeek Task 创建后停在 `REQUIREMENTS`、revision 1，不满足双仓修改、
  从附加仓库恢复和同一 Task 终态条件；
- root 外拒绝由第 3 节 guard 测试证明，不再运行第二次真实 Journey。

## 7. 最终全仓门禁（最多一次）

所有定向检查、文档同步和两个 Host Journey 完成后，最多执行一次。当前 T035 未完成且 Feature 为
`Blocked`，因此不得执行：

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
