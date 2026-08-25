# Feature 013：Apply Action 合同恢复

**状态**：Complete
**变更类型**：Product Feature
**基线**：`main` at `ee51b774c8b0d0af5a2dc917af7397369702945f`

## 权威与边界

- [`spec.md`](spec.md)：Host 可见 apply 合同、字段级错误、Guard 详情与一次零写入纠正。
- [`checklists/requirements.md`](checklists/requirements.md)：需求质量门禁。
- [`plan.md`](plan.md)、[`research.md`](research.md)、[`data-model.md`](data-model.md)、
  [`contracts/`](contracts/)：实现设计与精确合同。
- [`tasks.md`](tasks.md)：精确路径、依赖、验收映射与四组定向验证。

本 Feature 修正 `dev_flow_apply_action` 在真实 Host 上的 callable 投影，并把 Core 的失败结果从通用
文案升级为字段级 Violation、Guard 失败详情与一次有界的零写入纠正。它不改变
`standard-development` 的节点、transition、guard 语义、Task 持久化格式、Action identity、
Evidence wire 字段或六工具目录。

`.specify/feature.json` 选择本目录。本 Feature 为自托管修复：不创建或恢复 Dev Flow Core Task，
不调用 Dev Flow MCP mutation。

## 关键结论

九分支根联合体不是"未被 Host 支持"，而是被 Host 的 schema 压缩流程**确定性清空**：超预算时最后一个
有损 pass 会把任何带 composition 关键字的节点替换为空 Schema，包括根。因此修复方向是单个封闭对象 +
全树无 composition + 建模体积留在预算内，精确性回到 Go Core 并以字段级 Violation 反馈。详见
[`research.md`](research.md) 与 [`contracts/apply-action-schema.md`](contracts/apply-action-schema.md)。

## 当前检查点

T001–T039 已完成：Feature 包、Host 投影合同、可投影 Schema、SDK 注册合同、字段级 Violation、
Guard 失败详情、确定性零写入纠正、审计修复、Codex/DeepSeek Skill 与文档同步，以及真实 Host 回读。

四组定向验证通过；审计修复后的 V4 包含 Journey evidence 与两个 Host Skill 合同，共 60/60 通过。
未运行全仓库 suite、registry lifecycle 或 release 验证。

发布 apply Schema 的建模体积为 4905 字节，Host 压缩预算为 5000 字节，仅剩 95 字节余量。任何新增
payload 成员都必须重新评估该预算，否则 Host 会折叠 `payload.node_result` 以下的结构。

授权的本地 Codex package 安装、setup 与新任务回读已完成：`args` 与 `payload` 均为具体对象类型，
`payload.node_result.checks` 六个成员和四个 source 枚举可见，Dev Flow 工具目录仍为六个。发布仍未授权。
