# 工作树来源与本地改动

[中文](WORKTREE-SOURCES.md) | [English](WORKTREE-SOURCES_en.md)

## 使用场景

开发者希望从指定的本地分支或远端分支开始任务，并自行决定是否带上尚未提交的本地内容。
Host 在创建工作树前询问来源、起始分支、携带改动的选择及目标分支，已有明确选择继续有效。

## 可用数据与职责

Host 读取本地分支、remote、源 checkout 的 HEAD、暂存、未暂存及未跟踪路径，显示待确认内容。
Host 负责 Git 创建和内容复制；Core 只读核对工作树身份、来源、分支、HEAD 和实际修改内容，并创建 Task。

`source_type` 必填，取 `local` 或 `remote`；`carry_changes` 必填，取布尔值。
本地来源的 `remote_name` 为空字符串，`base_branch` 是本地分支；远端来源要求有效的 remote 名称，
且 `carry_changes=false`。`target_branch` 是待创建的任务分支。省略来源或携带选择不会采用默认值。

## 处理规则

1. 用户明确上述选择后才开始准备。远端执行精确 fetch；本地直接解析 `refs/heads/<base>`，无需联网。
2. Host 保存 `base_commit`，随后从该 commit 创建独立工作树；Codex managed dispatch 也使用这个固定 commit。
3. 携带本地改动时，Host 创建 Git 快照对象，记录 `snapshot_commit`。快照保留暂存与未暂存层，
   包含未被 Git 忽略的未跟踪文件。源 checkout、源 index、HEAD 和 `refs/stash` 保持原样。
4. Host 在新分支中应用快照，并恢复暂存状态。选择不同本地分支时通过 Git 应用改动；冲突或文件覆盖
   导致应用失败时，不创建 Core Task，保留目标工作树与失败记录供检查。
5. Core 核对工作树、具名分支、固定 commit 与来源 ref。本地 `carry_changes=true` 可以带着初始修改创建
   Task；其余选择要求干净工作树。携带内容属于该 Task 的实际修改范围，后续仍按范围和验证规则处理。
6. 每个仓库独立保存选择，全部准备成功后才能创建一个多仓库 Task。恢复时读取原启动记录；结果不确定
   不重复创建或应用快照。源工作区后续修改不会改变已经捕获的内容。

快照准备拒绝尚未解决的冲突和子模块修改。Git 忽略的文件不复制。DeepSeek 自动辅助清理继续保留
本地来源分支，供用户单独检查处理；不为本地创建过程增加远端访问。

## 启动记录与 Task 状态

Host 启动记录增加 `source_type`、`carry_changes`、`snapshot_commit`，使用 `base_commit` 保存起点。
准备阶段为 `confirmed -> resolving -> prepared`，随后进入现有派发与工作树准备阶段。
失败或结果不确定继续使用 `failed`、`uncertain`。这属于 Host 操作记录，不增加 Core 流程节点。

`WorkspaceOrigin` 及 CLI/MCP/WebUI 投影包含 `source_type` 和 `carry_changes`，其余身份、恢复及流程
规则继续由 Core 管理。当前 `standard-development` 的定义摘要、节点、出边、guard、Action 和
验证要求不变；仅 Task 创建入口允许用户已确认携带的本地修改。`tasks.snapshot` 保存新的来源字段。

## 预期结果与影响

本地仓库可以离线开始任务，未提交内容由用户决定是否复制。应用失败不会改动源 checkout，也不会产生
误报成功的 Task。复制的内容计入 Task 修改面，不能作为已经完成的工作或已通过的验证。

## 验收方式

- Codex `task-launch.test.mjs`：临时 Git 仓库验证远端创建、本地离线两种携带选择、暂存分离、未跟踪文件、
  忽略文件排除、源内容保留、快照冻结、不同起始分支、managed bootstrap 及冲突保留。
- DeepSeek `workspace-coordinator.test.mjs`：验证明确选择、本地离线创建、二进制新增文件及重启后 consume。
- Core `workspace_observer_test.go`：验证本地来源无需 remote、初始修改须明确携带、远端拒绝携带、实际修改面保存。
- 包清单、CLI/MCP 输入及存储检查确认新字段和快照模块完整进入当前约定。

以上测试使用本机临时仓库和 Host helper。managed dispatch 使用模拟 Host 创建结果；不代表已完成实际
Codex 桌面或 DSH 新会话的端到端操作，也不扩大其他平台的支持声明。

## 非目标

本次不增加 Core Git 写入、自动提交或发布、历史数据兼容、跨机器复制、忽略文件复制或子模块内容复制。

## Codex 规划与保留检查

Codex 携带本地改动时，会在 REQUIREMENTS 中记录保留要求，在 TASKS 中将完整的 `current_changed_paths` 与 `expected_paths` 及已保留的流程文件逐项核对。新开发工作和已有内容保留分别安排工作项与检查；当前 Action 的空文件清单不能代替完整 Task 路径核对。保留检查比较启动快照，不代表已有业务功能已经验证。已发生的文件范围阻塞仍通过现有 Core 选择与转移处理。
