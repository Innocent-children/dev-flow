# Feature 014：Dev Flow WebUI Control Center

**状态**：Complete

**变更类型**：Product Feature

**分支**：`feature/webui-control-center`

**数据处置**：`reject-and-reset`

## 目标

交付一个完整的本地单用户 WebUI，使用户可以查看和操作所有已接入 Host 的 Dev Flow Task，并通过
Core-owned `dev-flow webui` 命令管理一个共享 WebUI 进程。全部能力在本 Feature 内交付；实施按可独立
验收的检查点推进。

界面采用现代、克制、内容优先的桌面生产工具视觉，参考 Google Material Design 和 Apple Human Interface
Guidelines 的层级、排版、间距、一致性与可访问性原则；使用实色 surface、有限 elevation 和安静的 Dev Flow
辨识度，排除渐变、玻璃拟态、发光与超大宣传式文案。前端完整支持简体中文和英文，首次按系统语言选择，
手工选择只保存在浏览器。

设计以当前功能能够运行、能够直接保护本地写入与不可恢复删除、能够用最少证据全面验证为准。
同一事实只在一个主要权威层验证；UI 由产品负责人人工验收，不建立自动化 UI 测试或截图矩阵。

## 权威文件

- [`spec.md`](spec.md)：用户场景、功能要求、成功标准和边界。
- [`plan.md`](plan.md)、[`research.md`](research.md)、[`data-model.md`](data-model.md)、
  [`contracts/`](contracts/) 与 [`quickstart.md`](quickstart.md)：实施设计与验收合同。
- [`checklists/requirements.md`](checklists/requirements.md)：requirements-quality gate。
- [`tasks.md`](tasks.md)：已生成并通过只读一致性分析。

## 固定边界

- WebUI 服务于本机单用户，只监听 loopback，由 `dev-flow webui` 管理。
- 所有兼容 Host 共享一个 WebUI 实例和一份 Task 数据权威；Host Adapter 只携带并调用 Core runtime。
- Core 独占 Task、Action、revision、transition、Recovery、Blocker 和 Outcome 权威。
- 历史展示读取已提交 TaskEvent；流程图和未来路径在读取时派生。
- 生命周期管理包含 create/resume、cancel、archive/restore 和永久 purge。
- 浏览器使用轮询读取其它本机 Core 进程提交的变化。
- 页面在常见桌面窗口、浅色和深色系统外观中保持清晰层级、一致组件和完整键盘操作。
- UI 视觉和交互不纳入自动化测试或 Agent 视觉审查，最终由产品负责人人工验收。
- `packages/webui` 是独立前端源码工程；生产构建产物嵌入 Core binary，运行时仍为单进程本地产品。
- 既有 Task 数据在启用新数据格式前由用户显式永久 reset。
- WebUI 只显示 reset-required 状态和 Core CLI 指引；reset plan/confirm 只由 `dev-flow webui reset` 执行。
- 本 Feature 不授权 Git 写入、版本修改或发布。

## 实施检查点

1. CP1：任务查找、详情、历史和流程图。
2. CP2：任务创建、恢复、取消、归档、恢复归档和永久清除。
3. CP3：当前 Action、Guard、Evidence、Recovery 和 Blocker 操作。
4. CP4：本机启动、打开、状态、停止、reset、打包、文档、组合 Host 旅程和一次最终全仓验证。

全部检查点已通过。requirements checklist 为 31/31，48 个 FR 和 15 个 SC 已全部映射到 35 个任务，
只读分析未发现 Critical、High 或 Medium 问题。CP4 的 Core CLI lifecycle、CLI-only reset、运行状态 UI、
Host package closure、维护文档与单一 Host-parity Journey 均已完成，产品负责人已于 2026-08-26
明确接受交付 UI。V01–V07 已通过；V08 首次发现 Go 格式和当前 Schema Journey 列清单遗漏，修复后重跑
`pnpm run validate` 通过。DeepSeek `rc.8` spill 用例因未配置 `DEV_FLOW_DSH_GATE_NODE_MODULES` 按既有条件跳过，
其余最终仓库验证全部通过，T032 已完成。
