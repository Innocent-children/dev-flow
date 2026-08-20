# dev-flow-codex

`dev-flow-codex` 是 Codex CLI 的 explicit-only Dev Flow Adapter。package 包含一个 Codex
Plugin、一个 `dev-flow` Skill、一份 local STDIO MCP 声明、method-profile reference 和一个
`darwin-arm64` Core executable。它不保存 Task、process cursor、transition table 或 recovery
classification。

## 安装与发布身份

当前 package、plugin 和 bundled Core 版本是 `0.4.0`。Feature 009 发布已完成的 Feature 008
graph runtime；历史 `0.3.0` 包、Tag、Release 与证据保持冻结。

标准安装和显式注册入口是：

```bash
npm install -g dev-flow-codex@0.4.0
dev-flow-codex setup
```

精确 npm tarball、standalone Core、manifest、checksums、实际 Codex 版本和最终 Journey 结果以
GitHub Release `v0.4.0` 与 registry 回读证据为准。

当前公开支持 native macOS arm64、Node.js `>=24` 和 Codex
`>=0.147.0 <0.148.0`。没有 Linux、Windows、Intel Mac、Rosetta 或 DeepSeek 产品支持声明。

## Closed package

生产 package 内容由 `package.json.files` 和本地 builder 共同关闭：

```text
.agents/plugins/marketplace.json
LICENSE
README.md
bin/dev-flow-codex.mjs
lib/lifecycle.mjs
lib/paths.mjs
package.json
plugin/.codex-plugin/plugin.json
plugin/.mcp.json
plugin/skills/dev-flow/SKILL.md
plugin/skills/dev-flow/agents/openai.yaml
plugin/skills/dev-flow/references/method-profiles.md
plugin/skills/dev-flow/references/node-payloads.md
runtime/darwin-arm64/dev-flow
```

Artifact 不包含 tests、fixtures、specs、source tree、`.git`、`node_modules`、用户数据、构建日志
或绝对路径。package 没有 production npm dependency 和 install/update/uninstall lifecycle hook；
安装文件与显式 Codex 注册是两个操作。

## Local package build

在干净、已提交的 source commit 上，把最终验收制品构建到仓库外的空目录：

```bash
ARTIFACT_ROOT="${TMPDIR:-/tmp}/dev-flow-local-artifacts"
mkdir -p "$ARTIFACT_ROOT"
SOURCE_COMMIT="$(git rev-parse HEAD)"

pnpm --dir packages/codex run build:local \
  --output "$ARTIFACT_ROOT" \
  --final \
  --source-commit "$SOURCE_COMMIT" \
  --report "$ARTIFACT_ROOT/artifact-evidence.json"
```

`--final` 表示 builder 的 clean-source/identity verification 模式；公开 Release 由 Feature 009
的一键 publisher 产生。
Builder 要求输出目录已经存在、没有 `.tgz`，source tree 干净且 HEAD 等于 `--source-commit`；
它验证 package/Core/plugin version identity、platform、detached runtime executable 和 closed pack
contents，并输出 SHA-256 evidence。制品与 evidence JSON 均保留在仓库外。

本地构建只生成和检查制品，不执行 setup/remove、不修改真实 Codex 配置、不启动 native Journey。

## Explicit invocation boundary

Skill metadata 设置 `policy.allow_implicit_invocation: false`。唯一精确 selector 是：

```text
$dev-flow-codex:dev-flow
```

Skill resource/base name 是 `dev-flow`，installed Skill full name 是 `dev-flow-codex:dev-flow`，
only exact explicit selector 是 `$dev-flow-codex:dev-flow`。bare `$dev-flow` is not an alias and
does not select this Skill；wrong plugin namespace、wrong Skill base name 或 missing selector 也不会
选择它。ordinary prompt 必须产生 zero Dev Flow calls。non-exact selectors must not complete a task-bearing operation；
This does not disable ordinary Codex repository tools. The package does not make or claim selector-bound MCP visibility or authorization。

被接纳的请求必须只涉及一个现有 Git repository，并先调用 `dev_flow_server_info({})`。当前
source-local Contract 0.2 handshake 必须返回：

```text
schema_version = 2
core_limits_version = 0.2
process = standard-development@1
method_profiles = plain, spec-kit, openspec
exact six-tool catalog
```

不完整、不同版本或不同顺序的 catalog 会停止请求。公开工具为：

```text
dev_flow_server_info
dev_flow_open_task
dev_flow_get_task
dev_flow_get_next_action
dev_flow_apply_action
dev_flow_cancel_task
```

## Graph task 与 method profiles

新任务从 `REQUIREMENTS` 开始，Core 返回完整 node contract、semantic method steps 和全部合法
transitions。Codex 只提交 Core 返回的 `transition_id` 和 closed node payload；destination、guard、
current node 和 completion 都由 Core 决定。

Task 创建时选择一个 immutable profile：

```text
plain
spec-kit
openspec
```

三种 profile 使用同一状态图。Adapter 按当前 Action 渲染实际存在的 capability 和预期 artifact。
capability unavailable 或 unknown 时，它明确报告缺失，并呈现合同定义的 plain-equivalent work；
只有等价工作实际完成时才提交 `plain_fallback` method evidence。command、checkbox、sync、archive
或 artifact 自身不会推进 Core。

`TEST` 成功后必须进入 `COMPREHENSION_REVIEW`。Codex 向开发者解释当前行为、复杂度和维护
风险，并取得明确 verdict；AI/static evidence 不能替代用户确认。复杂代码进入 `REFACTOR`，
repository-changing refactor 只能回到 `TEST`。

## Read-before-retry

每次 mutation 前，Adapter 保留完整 operation identity：request/operation ID、process、source
cursor、revision、action、issuance binding 和原始 closed payload。结果缺失、取消、损坏、截断或
transport failure 时不得盲目重试，也不得重建缺失的 probe。

Adapter 使用 `dev_flow_get_task` 或 `dev_flow_get_next_action` 提交原 operation probe，并只遵循
Core 返回的五分类 Assessment 和 advice。Probe 零写入；只有显式 recovery apply 可以完成一次
Core-derived transition 或创建一次 blocker。Adapter 不判断 classification、retry safety、resume
node 或 destination。

## Schema 1 unsupported guidance

Graph package 只支持 fresh Schema 2、snapshot-v2 和精确 `standard-development@1`。遇到 Schema
1/pre-graph data 时 Core 返回 `SCHEMA_UNSUPPORTED`，且不 decode、migrate、rename、truncate、
delete 或 reset 旧数据。不要重复启动或自动清理。

用户必须明确选择一个新的绝对、canonical、usable `DEV_FLOW_DATA_DIR`，或在 Core 外部手工
archive/rename/delete 旧目录，再启动 graph Core。错误信息不回显私有数据库路径。

## Setup、remove 与 retained data

`0.4.0` package 文件安装仍与 Codex 注册分离：只有 `dev-flow-codex setup` 可以创建经 ownership
和 read-back 验证的注册，只有 `dev-flow-codex remove` 可以删除该产品拥有的注册。

setup/update/remove/uninstall 均保留 Core task data 和未知相邻文件，不会修改目标 repository 或
Git。remove 应先证明 plugin/marketplace absence，再单独执行 package-manager uninstall。重新安装
兼容的 graph artifact 可以从同一 Schema 2 数据目录恢复任务；没有任何 Schema 1 reader 或
conversion path。

## Closed node payload construction

打包 Skill 在每次普通 apply 前同时读取 live Action、`dev_flow_apply_action` `inputSchema` 和
`plugin/skills/dev-flow/references/node-payloads.md` 的对应标记模板。该 reference 覆盖
REQUIREMENTS、DESIGN、TASKS、IMPLEMENT、TEST、COMPREHENSION_REVIEW 的复杂度/通过分支、
REFACTOR、DELIVERY 和 BLOCKED resolution，并由真实 MCP validator、workflow decoder 和 payload
validator 提取验证。它只提供构造指引，不保存游标、复制 transition authority 或替代 Core。

`required_evidence` 与 ArtifactReference role 不同；`repository_observation` 不得作为 artifact
role。无真实 process artifact 时使用空 `artifacts`，同时保留完整 branch wrapper、当前 baseline/
record/evidence identity 和精确 MethodEvidence。Core `INVALID_ARGUMENT` 会停止该 mutation，不会
触发候选 payload 试探或自动重试。

对于 apply/cancel，Result Envelope `request_id` 与 caller mutation `request_id` 相同，并与成功
提交后的 `LastOperation.operation_id`/TaskEvent identity 对齐。没有 caller request ID 的 read/open/
info 工具继续使用 Core 生成的本地 transport identity。

## Deterministic validation

完整 package-local 测试入口为：

```bash
pnpm --dir packages/codex test
```

它覆盖 package contract、Skill contract、lifecycle、journey harness、parser/evidence 以及已有
launcher/runtime tests。fixture、simulated Harness 和 static contract 证据不属于 native Codex
evidence，也不证明 package 已公开发布。

Feature 008 的 source-local acceptance 已完成。Attempt 3 提供真实 native Codex graph-flow
evidence；独立的 no-Codex deterministic lifecycle 使用同一精确 artifact 证明 setup、remove、
npm uninstall、data retention、相同 artifact reinstall 和同一 lifecycle Task terminal reopen。
两类 evidence 保持不同标签，且都不构成 registry package 或公开发布证明。
