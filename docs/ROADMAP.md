# Dev Flow 路线图

[中文](ROADMAP.md) | [English](ROADMAP_en.md)

Dev Flow 的路线由用户价值和可验证结果推进。日期不是承诺；每一项产品能力都需要独立规格、
明确边界和可复现证据。

## 当前：可靠的本地开发过程图

已经交付：

- 由 Go Core 独占权威的 `standard-development`；
- 8 个工作节点、`DONE` 和两个异常节点，共 29 条受控流转；
- requirements/design/task-plan baselines 与下游 authority invalidation；
- `TEST → COMPREHENSION_REVIEW → REFACTOR → TEST` 可理解性闭环；
- `plain`、`spec-kit`、`openspec` 三种 method profile；
- 六工具 local STDIO MCP 与 closed payload；
- 本地 SQLite、revision CAS、restart/resume 与 retained terminal data；
- 五分类 Recovery、read-before-retry 和 Core-owned blocker/resume；
- 有界只读 Git observation；
- 一个主仓库加最多七个显式附加仓库的不可变 Repository Scope，全部仓库共享一个 Task 权威；
- 固定只读用户配置中的 Host 级可选代码索引偏好，以及索引不可用时的内置检索回退；
- Codex setup 缺失配置创建、真实配置/receipt 文件摘要和简中/英文可降级安装首屏；
- Codex 与 DeepSeek 两个显式 Host Adapter。

## 当前公开产品

| 产品 | 版本 | 状态 |
| --- | --- | --- |
| Core | `0.5.1` | 作为两个 Host package 的独立 bundled runtime |
| Codex | `0.5.3` | npm 与 `codex-v0.5.3` 已发布，macOS arm64 registry lifecycle 通过 |
| DeepSeek | `0.5.2` | npm 与 `deepseek-v0.5.2` 已发布，macOS arm64 native registry journey 通过 |

公开支持的精确 Host 版本、制品 digest 和证据入口见
[Support Matrix](SUPPORT-MATRIX.md)。

## 下一阶段：降低日常使用成本

这些方向围绕当前图增强可见性和诊断能力：

- 只读 doctor：解释安装、Core handshake、数据目录和 task 状态；
- 更清晰的任务检查：快速展示当前节点、阻塞原因、剩余验证预算和可选流转；
- 更直接的恢复提示：把五分类 Recovery 结论转换为简短、可执行的用户说明；
- 新平台制品：在独立 final-artifact evidence 完成后扩展支持矩阵。

每项工作都保留单一 Core 权威、只读 Git 和 read-before-retry 约束。

## 后续候选：受控协作

真实跨 Host 使用出现后，可以评估：

- 用户显式授权的 Codex ↔ DeepSeek handoff；
- 可验证的 task export reference 或 handoff receipt；
- 针对团队审查场景的只读共享视图；
- 更细粒度但仍有界的 verification budget。

跨 Host 能力需要保证同一时刻只有一个 Task authority，不允许 Adapter 复制 process cursor。

## 研究方向

长期研究项包括：

- 新 OS/CPU 的可复现最终制品；
- 供应链签名、notarization 与透明度证据；
- 基于真实项目数据验证 comprehension gate 的效果；
- 在不引入流程 DSL 的前提下改进内建图。

## 持续边界

当前路线不包含用户自定义 graph、workflow DSL、Web UI、remote MCP、generic shell、Core Git
mutation、自动发现或动态扩展 Repository Scope、自动多仓库编排、仓库级独立流程状态或历史任务
自动迁移。任何改变这些边界的提议都需要独立产品规格和 Constitution 审查。

Codex 当前路线采用原生 Skill 智能启用：明确开发执行请求可隐式选择 Dev Flow，精确 selector 保留
为强制入口，非任务请求不自动创建 Task。自定义分类器、激活模式配置、第二份 Skill 和激活状态持久化
不在当前路线中。
