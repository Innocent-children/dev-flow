# Dev Flow 路线图

[中文](ROADMAP.md) | [English](ROADMAP_en.md)

路线图描述希望改善的用户结果，不承诺日期。当前已经交付的能力和对应状态集中记录在
[Project Status](PROJECT-STATUS.md)；稳定支持范围以 [Support Matrix](SUPPORT-MATRIX.md) 为准。

## 目标

> 在长时任务中断后，让开发者和 Agent 快速获得准确的当前状态，以及一个不会无理由重复、
> 扩大范围或扩大验证的下一步。

## 当前重点：看懂任务与工作树状态

这一阶段围绕当前已有能力改善表达和使用成本：

- 用简短摘要回答当前 Task 是什么；
- 区分已经确认的结果与仍然不确定的结果；
- 显示哪些验证记录仍然适用于当前实现；
- 说明 Task 为什么被阻塞，以及需要确认什么；
- 直接展示当前合法下一步；
- 在新请求建立 Task 前显示只读改动量评估和是否建议进入完整流程；
- 展示确认的 remote/base/target、专属工作树、Task Plan、当前修改路径、文件范围决定和未说明路径；
- 区分正常线性 commit、内容变化、history conflict、workspace unavailable 与 relocation；
- 从 Host 与本机 WebUI 读取分析后形成的验证计划、当前预算/消耗、历次增加原因和 Recovery 判断；
- 让普通修改后的复核停在当前 diff、因果影响和验收范围，修复后不重新启动全仓库审计。

这些工作不增加流程节点或第二份 Task 状态；预算增加复用一条 TEST→TEST 自循环。

## 计划改进：让完成判断更准确

以下是未来方向，当前尚未实现或尚未完整实现：

- 把验证记录与当前实现状态绑定得更紧，减少旧结果被继续使用；
- 根据真实使用反馈继续校准初始验证计划和预算增加判断，避免误放大或误阻塞；
- 提供不确定 Action 的可公开复现的故障注入测试；
- 继续改进 `small|standard|large|uncertain` 评估的可理解性和误判反馈；
- 在不引入第二状态机的前提下，减少确认和恢复所需的操作次数。

Skip、Guarded、Strict 等模式名称目前不是已交付的用户功能。后续是否采用这些名称和具体行为，
需要单独的产品设计，并在实际编程工具中验证完整流程。

## 长期考虑：跨机器与团队协作

以下能力是更晚的候选方向，当前未实现：

- 跨机器 Task transfer 与可验证 export/import；
- PR / CI 的只读验证摘要；
- 团队只读任务视图；
- 更简单的 OpenSpec / Spec Kit 文档集成。

当前源码已经支持同机 relocation；未来跨机器能力仍必须使用同一个 Core Task 状态，不能让 Adapter
复制当前阶段或自行判断完成。

## 不计划提供的功能

当前不计划：

- 把 Dev Flow 做成通用 Agent；
- 把 Core 做成 shell 或文件系统沙箱；
- 自动 commit、merge、rebase、push、tag 或 publish；
- 提供任意 workflow DSL 或用户自定义状态机；
- 自动扫描相邻仓库并扩大 Repository Scope；
- 把本机 WebUI 变成云端项目管理平台。

新平台、Host 或界面只有在能够改善长时任务继续体验，并且有独立验证方式时才进入路线图。
