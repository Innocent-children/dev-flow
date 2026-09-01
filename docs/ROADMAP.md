# Dev Flow 路线图

[中文](ROADMAP.md) | [English](ROADMAP_en.md)

路线图描述希望改善的用户结果，不承诺日期。当前已经交付的能力和对应状态集中记录在
[Project Status](PROJECT-STATUS.md)；稳定支持范围以 [Support Matrix](SUPPORT-MATRIX.md) 为准。

## North Star

> 在长时任务中断后，让开发者和 Agent 快速获得一份可信的当前状态，以及一个不会无理由重复、
> 扩大范围或扩大验证的下一步。

## Now：看懂当前任务状态

这一阶段围绕当前已有能力改善表达和使用成本：

- 用简短摘要回答当前 Task 是什么；
- 区分已经确认的结果与仍然不确定的结果；
- 显示哪些验证记录仍然适用于当前实现；
- 说明 Task 为什么被阻塞，以及需要确认什么；
- 直接展示当前合法下一步；
- 让当前阶段、剩余验证预算和 Recovery 判断更容易从 Host 与本机 WebUI 中读取。

这些工作不改变当前状态图，也不增加第二份 Task 状态。

## Next：让完成判断更可信

以下是未来方向，当前尚未实现或尚未完整实现：

- 更直观地核对范围声明与实际仓库变化；
- 把验证记录与当前实现状态绑定得更紧，减少旧结果被继续使用；
- 显示 verification budget 的消耗过程，以及扩大验证的具体原因；
- 提供不确定 Action 的公开故障注入 Journey；
- 根据任务复杂度降低不必要的流程成本；
- 为小任务、普通长任务和严格任务提供不同的流程强度。

Skip、Guarded、Strict 等模式名称目前不是已交付的用户功能。后续是否采用这些名称和具体行为，
需要独立产品设计与真实 Journey。

## Later：可信交接

以下能力是更晚的候选方向，当前未实现：

- Codex 与 DeepSeek 的显式 handoff；
- Task export 或 handoff receipt；
- PR / CI 的只读验证摘要；
- 团队只读任务视图；
- 更薄的 OpenSpec / Spec Kit artifact 集成。

交接能力必须继续使用同一个 Core Task 状态，不能让 Adapter 复制当前阶段或自行判断完成。

## Not planned

当前不计划：

- 把 Dev Flow 做成通用 Agent；
- 把 Core 做成 shell 或文件系统沙箱；
- 自动 commit、merge、rebase、push、tag 或 publish；
- 提供任意 workflow DSL 或用户自定义状态机；
- 自动扫描相邻仓库并扩大 Repository Scope；
- 把本机 WebUI 变成云端项目管理平台。

新平台、Host 或界面只有在能够改善长时任务继续体验，并且有独立验证方式时才进入路线图。
