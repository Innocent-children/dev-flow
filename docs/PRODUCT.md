# Dev Flow 产品定义

## 当前交付

Dev Flow 当前包含一个共享 Core 和一个已实现但尚未公开发布的 Codex 产品：

- **Core Contract 0.1**：本地 STDIO MCP、SQLite、只读 Git、单仓库单活动任务、统一状态机与
  五类恢复；
- **Feature 003 Codex 显式产品**：一个 Plugin、一个 `dev-flow` Skill、一个本地 MCP 声明、
  一个 bundled Core，以及显式 setup/remove；
- **Feature 005 恢复加固**：不确定 mutation 的 read-after-write proof、repository drift 拒绝、
  partial/conflicting blocker 与并发提交保护；
- **Feature 006 确定性发布实现**：固定 `dev-flow-codex@0.1.0` public package 合同、仅
  `darwin-arm64`、source-free 本地 tgz、生命周期与 retained data、兼容升级、两工作树准备、
  normalized verifier、resumable publisher、registry-only final Journey 合同和 finalization gate。

Feature 006 尚未执行 public npm/GitHub release。package manifest 的 `private: false` 与 public
publishConfig 定义的是发布合同，不表示 registry 已经存在该包。

Deterministic implementation complete — T001–T046 passed. Irreversible real release T047–T050
remains pending.

`server_info.supported_hosts = [codex, deepseek]` 只表示 Core 接受两个 `origin_host` identity；
DeepSeek 产品仍未实现、未验证、未发布。

## 用户价值与权威边界

Core 把一次开发工作固定为不可静默修改的任务合同：

```text
goal
scope
out_of_scope
acceptance_criteria
verification_budget
origin_host
repository binding
```

Core 保存唯一权威下一动作。Codex Skill 负责显式调用和结果投影，不保存 Task、不复制转换表、
不判断完成。遇到 stale identity、仓库漂移或无法证明的 mutation，Core 返回稳定错误或机器可
验证的 `BLOCKED`；publisher 只处理本仓库的发布状态，不进入 Core 或 SQLite。

## 已实现产品能力

- 一个现有本地 Git repository，每个 repository identity 最多一个活动 governed task；
- `INTAKE → ASSESS → PLAN → IMPLEMENT → VERIFY → REVIEW → HANDOFF → DONE`，以及
  `BLOCKED`、`CANCELLED`；
- revision CAS、action identity、repository binding、verification budget 与 retained evidence；
- SQLite snapshot、audit event 与 repository claim 的同事务 mutation；
- `not_started`、`completed_and_recorded`、`completed_but_unrecorded`、
  `partially_completed`、`conflicting` 五类恢复；
- 一个 Codex Plugin、一个显式 `dev-flow` Skill、一个 local STDIO MCP 和恰好六个工具；
- npm install/update/uninstall 与显式 setup/remove 分离；
- source-free local tgz 安装、unsupported-platform 拒绝、retained task reopen；
- compatible explicit upgrade、downgrade refusal、future SQLite Schema safe-stop；
- 两个 clean worktree 的 release preparation、五文件 output、Schema/identity verifier；
- fake npm/gh 下的 publish-once、resume、conflict、asset read-back 与 finalization gate；
- 只允许 official registry package 的最终 Codex Journey runner 和 native support-matrix 合同。

## MCP 使用面

```text
dev_flow_server_info
dev_flow_open_task
dev_flow_get_task
dev_flow_get_next_action
dev_flow_apply_action
dev_flow_cancel_task
```

Core 本身不运行测试、用户命令或 Git mutation。调用者通过 `dev_flow_get_next_action` 取得
持久化动作与 closed payload contract，使用宿主已有工具完成动作，再提交有界结果。

服务唯一启动模式是：

```bash
DEV_FLOW_DATA_DIR="<existing-directory>" dev-flow mcp --stdio
```

## 证据分层

### 已完成的真实证据

- Feature 003 使用真实 Codex 完成显式 create、restart、resume、Core `DONE` 与 remove 验收。

### 已完成的确定性证据

- Feature 005 Core/Store/MCP/repository recovery tests；
- Feature 006 source-free local tgz package/lifecycle、retention、upgrade 与 future-schema tests；
- 两工作树 preparation、normalized verifier 与 release Schema contracts；
- 隔离 fake npm/gh/临时 bare remote 的 publication、resume、conflict 和 simulated finalization；
- registry-only final Journey harness contract 与 native-only support-matrix validator。

### 尚未完成的真实发布证据

- public npm publication 与 registry metadata/tarball read-back；
- 使用 public registry package 的最终真实 Codex Journey；
- GitHub 四资产 official-path read-back；
- 公开 Git Tag/GitHub Release 与完成态 publication record。

fixture、fake、静态合同或本地 tgz 不会升级为 native/public evidence。

## 明确不支持

- 当前从 npm registry 安装 `dev-flow-codex@0.1.0` 的可用性声明；
- 已发布 Git Tag、GitHub Release 或完成态公开支持声明；
- DeepSeek product、Harness journey 或 publication；
- Linux、Windows、Intel Mac、Rosetta 或未经最终制品验证的平台；
- Web UI、remote MCP、HTTP/SSE、authentication、telemetry、多仓库或跨宿主自动接管；
- Core Git mutation、通用 Shell MCP、自动 repository repair、自动升级、签名或 notarization。

真实不可逆发布仅由 Feature 006 T047–T050 在 reviewed clean `main` 上执行。
