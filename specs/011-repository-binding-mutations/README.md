# Feature 011：Repository Binding 授权修改

**状态**：Complete
**变更类型**：Product Feature
**基线**：`main` at `6460abe68a5c0cb6452555e23d5132971b92668a`

## 权威与边界

- [`spec.md`](spec.md)：授权仓库修改、真实漂移、拒绝和恢复行为。
- [`checklists/requirements.md`](checklists/requirements.md)：需求质量门禁。
- [`plan.md`](plan.md)、[`research.md`](research.md)、[`data-model.md`](data-model.md)、
  [`quickstart.md`](quickstart.md)、[`contracts/`](contracts/) 和 [`tasks.md`](tasks.md) 定义设计、
  精确合同与实施顺序。

本 Feature 修复允许写入的 Action 在执行合法修改后无法 apply 的合同冲突。Core 继续独占
Repository Binding、Action validity、drift classification 和 Recovery 权威；Host 只提交精确
changed paths/no-change 事实，不能用一个笼统声明放行工作区。

本 Feature 不改变 SQLite Task 模型、Repository Scope 成员、Node/Transition 集、MCP 工具目录、
Host 激活行为、版本或发布逻辑。现有 `specs/010-create-dev-flow-installer/` 属于另一项未完成工作，
本 Feature 不修改它。

`.specify/feature.json` 必须选择本目录。完成 clarify、plan、checklist、tasks 和 analyze 并将状态
更新为 `Ready` 后，才能实施生产代码。

## 当前检查点

clarify、requirements checklist、analyze、implementation 和 converge 已完成；17/17 FR、5/5 SC 与
16/16 tasks 均闭环。12/12 定向验证命令已消耗并通过最终结果；未运行任何禁止的完整验证、真实 Host
Journey 或发布命令。Feature 停止在 `Complete / targeted-validation-complete` checkpoint。禁止提交、
推送、改版本和发布。
