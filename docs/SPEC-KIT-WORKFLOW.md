# Spec Kit 工作流与文档规范

## 1. 目的与适用范围

本文件是 Dev Flow 仓库的 Spec Kit 文档规范。它回答四个问题：

1. 什么变更需要建立 Feature；
2. 一个 Feature 目录必须包含哪些文档；
3. 每份文档分别负责什么，哪些内容不得重复；
4. Feature 如何从问题定义走到实施、验收和后续发布。

本规范适用于仓库根 `.specify/` 项目和 `specs/` 下的新 Feature。已经完成的历史 Feature
是交付证据，不因模板升级而批量重写。

规范优先级：

```text
Constitution
  → 本文件
  → active feature README/spec/contracts/plan/tasks
  → 用户当前明确指令
```

当文档发生冲突时，先修正规格，不得让实现自行选择一个解释。

## 2. 单一 Spec Kit 根项目

Monorepo 只保留一个根 `.specify/`：

```text
.specify/
├── memory/constitution.md
├── scripts/
└── templates/
```

`packages/codex/`、`packages/deepseek/` 和其他产品目录不得再次初始化 Spec Kit。这样可以保持：

- 一份 Constitution；
- 一套 Feature 编号；
- 一个共享 Core 与 Host Adapter 变更视图；
- 公共合同变更的双 Host fixture parity；
- 一套统一文档模板。

若 `.specify/scripts/`、`.specify/templates/` 和 `.agents/skills/speckit-*/SKILL.md` 已存在，
不得重复执行 `specify init`。升级 Spec Kit 只在官方工具行为或生成资产确有变化时进行；升级
本身不得覆盖项目定制模板或历史 Feature。

## 3. 变更分类

### 3.1 Governance Change

只修改 Constitution、AGENTS、Spec Kit 模板、文档规范或 Feature 索引，不改变产品运行行为。

要求：

- 说明治理变化及影响；
- Constitution 变更必须包含 Sync Impact Report；
- 不修改生产版本；
- 不执行发布；
- 不伪装成产品 Feature。

### 3.2 Product Feature

改变用户可见行为、开发过程节点、转换、Core 合同、MCP Schema、持久化语义、恢复行为或
Host Adapter 合同。

必须建立完整 Feature 包，并执行完整 Spec Kit 生命周期。

### 3.3 Corrective Change

修复已经批准合同中的实现缺陷。

- 若不改变公共语义，可建立有界修复规格，或在仍活动的 Feature 中追加明确任务；
- 若改变节点、转换、公共 Schema、错误、持久化语义或支持声明，按 Product Feature 处理；
- 不得用“Bug Fix”绕过合同和持久化数据处置设计。

### 3.4 Release Change

只负责版本对齐、构建、公开制品、Tag、npm、GitHub Release、最终制品 Journey 和支持声明。

Release Feature 不得重新定义产品行为。Product Feature 不得包含不可逆发布操作。

## 4. Feature 状态词汇

每个 `specs/<NNN-name>/README.md` 和 `spec.md` 使用以下状态之一：

| 状态 | 含义 |
| --- | --- |
| `Draft` | 问题和范围仍在形成，禁止实施 |
| `Clarifying` | 正在解决范围、行为或持久化边界歧义 |
| `Planned` | spec/plan/contracts/tasks 已形成，尚未通过最终分析 |
| `Ready` | checklist/analyze 通过，可按任务实施 |
| `Implementing` | 正按阶段或用户故事实施 |
| `Blocked` | 存在明确阻塞条件，禁止扩大范围绕过 |
| `Complete` | 实施和规格验收均完成 |
| `Deferred` | 保留但不在当前路线实施 |
| `Superseded` | 已被明确的新 Feature 替代 |
| `Historical` | 已完成且作为冻结证据保留 |

状态变化必须更新 Feature README。任务 checkbox 不是 Feature 状态的替代品。

## 5. 完整 Feature 目录

Product Feature、共享合同 Feature、持久化 Feature 和 Release Feature 必须使用：

```text
specs/<NNN-feature-name>/
├── README.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ...
├── checklists/
│   └── requirements.md
└── tasks.md
```

不得因为某份文档内容较短而省略。确实不适用时，文件仍保留并写明 `N/A` 的原因。

## 6. 文档职责

### 6.1 `README.md`：Feature 入口与执行边界

只负责：

- 当前状态；
- 变更类型；
- 依赖与基线；
- 权威文件；
- 明确非目标；
- 激活方式；
- implement 前置门禁；
- 当前完成到哪个 checkpoint；
- 是否允许发布。

不得把 README 写成第二份 spec、plan 或任务清单。

### 6.2 `spec.md`：为什么做、对用户表现为什么

必须使用技术无关、可观察的语言定义：

- 问题；
- 目标用户；
- 优先级用户故事；
- Given/When/Then 验收场景；
- 功能要求；
- 持久化过渡要求；
- 非目标；
- 关键实体；
- 可衡量成功标准；
- 假设。

`spec.md` 不决定 Go 文件、SQLite SQL、SDK 或函数签名；精确公共行为可由 `contracts/`
补充，但不能只存在于 plan 或 tasks。

持久化发生变化时，Feature 必须明确选择且只选择一种旧数据处置：

```text
migrate
retain-read-only
reject-and-reset
not-applicable
```

Dev Flow 在 `1.0.0` 前发生不兼容任务模型变化时，默认采用 `reject-and-reset`：零写入拒绝旧
数据、禁止自动删除，并给出用户显式使用新目录或手工归档/改名/删除的步骤。只有用户明确要求
历史任务连续性，且 plan 证明其长期价值高于 legacy 运行时、decoder、迁移与测试成本时，才可
选择 `migrate` 或 `retain-read-only`。不能为了抽象意义上的“兼容”默认增加长期代码包袱。

### 6.3 `plan.md`：如何在当前仓库实现

必须说明：

- 当前系统基线和真实文件；
- 选择的技术方案；
- Constitution Check；
- 数据模型与持久化处置；
- 公共合同变化；
- Host/工具画像影响；
- 当前代 Recovery 与不支持/未来数据行为；
- 精确源码目录；
- 测试预算和 checkpoint；
- 被拒绝的复杂方案。

计划不得重新发明需求，也不得用“后续再定”掩盖会影响实现的关键决策。

### 6.4 `research.md`：决策、备选方案和理由

每项决策使用：

```text
Decision
Rationale
Alternatives considered
Why alternatives were rejected
Consequences
```

只记录会改变设计或风险的研究。不要复制 spec，不要写教程，不要把猜测升级为要求。

### 6.5 `data-model.md`：实体、关系、不变量和生命周期

必须包含：

- 实体字段与含义；
- 枚举闭集；
- 关系；
- 聚合不变量；
- 创建、流转、阻塞、恢复、终态生命周期；
- 序列化与边界；
- Schema 启动方式、旧数据处置和不支持数据的零写入行为。

涉及状态图时，必须区分 Process、Node、Transition、Action、Task、Blocker 和 Outcome。

### 6.6 `contracts/`：可精确验证的闭合合同

用于：

- MCP Tool 输入输出；
- Node 和 Transition 定义；
- Payload Schema；
- Persistence bootstrap/transition/reset；
- Method profile mapping；
- Result Envelope；
- Release manifest。

合同必须：

- 使用稳定标识；
- 说明 required/optional；
- 关闭未知字段；
- 定义错误和零写入行为；
- 给出合法与非法示例；
- 标明版本和数据处置路线。

不得让 README、Skill Prompt 或测试 fixture 成为唯一合同。

### 6.7 `quickstart.md`：独立用户旅程

用最少步骤演示每个 P1/P2 用户故事：

- 初始条件；
- 调用或操作；
- 预期状态；
- 可选下一节点；
- 失败路径；
- 恢复路径。

Quickstart 是验收脚本的可读说明，不是安装百科，也不包含无法在最终制品中成立的捷径。

### 6.8 `checklists/requirements.md`：需求质量审查

Checklist 检查“规格是否可实施和可验证”，不检查代码是否完成。

`[x]` 只表示 reviewer 已确认对应需求质量。`$speckit-implement` 不得修改 checklist。

### 6.9 `tasks.md`：按可独立验收切片的实施清单

每项任务必须：

- 使用唯一 `T###`；
- 标明 User Story 或共享基础；
- 引用 `FR-*`、`SC-*` 或合同；
- 写出精确文件路径；
- 只包含一个可判断完成的结果；
- 明确所需定向验证；
- 在 checkpoint 停止；
- 排除发布、未来能力和无关重构。

禁止以下任务：

```text
优化代码
完善测试
处理边界情况
更新相关文档
做必要重构
定义并验证旧数据处置
```

必须改写为可定位、可验收的具体工作。

## 7. 状态图 Feature 的附加要求

任何改变开发过程的 Feature，在 `spec.md` 和 `contracts/` 中必须完整定义：

1. Process ID、Version 和 definition digest 规则；
2. 受影响 Node ID；
3. 每个节点的 purpose；
4. entry assumptions；
5. completion conditions；
6. allowed effects；
7. required evidence；
8. semantic method steps；
9. 所有 outgoing transition；
10. transition ID、destination、guard 和 reason requirement；
11. BLOCKED/CANCELLED/DONE 行为；
12. forbidden transitions；
13. Task/Action/MCP projection；
14. pre-existing task data disposition；
15. uncertain mutation recovery。

不能只画 Mermaid 图而缺少转换表；也不能只有转换表而缺少用户场景。

## 8. 活动 Feature 选择

Git 分支和 Spec Kit Feature selection 是两件事。对已经准备好的 Feature：

```bash
export SPECIFY_INIT_DIR="$PWD"
export SPECIFY_FEATURE_DIRECTORY="$PWD/specs/008-refactor-to-development-process-graph"
```

每个 worktree、终端进程和 Agent 会话都要显式选择。不要根据 branch name 推断。

若仓库本地工具生成 `.specify/feature.json`，确认它指向同一目录；该文件是否提交由
`.specify/.gitignore` 和工具约定决定。

## 9. 新 Feature 流程

### 9.1 Specify

```text
$speckit-specify
```

只定义用户问题、行为、边界和可测结果。不要预先指定目录和实现。

### 9.2 Clarify

```text
$speckit-clarify
```

必须解决会影响：

- 节点或转换；
- 范围和非目标；
- 数据迁移；
- 错误与零写入；
- 用户授权；
- Host parity；
- 测试预算；
- Release 边界

的问题。

### 9.3 Plan

```text
$speckit-plan
```

生成或更新 `plan.md`、`research.md`、`data-model.md`、`quickstart.md` 和 `contracts/`。
Constitution Check 在研究前和设计后各执行一次。

### 9.4 Checklist

```text
$speckit-checklist
```

Reviewer 确认需求完整、一致、无实现泄漏且可验证。

### 9.5 Tasks

```text
$speckit-tasks
```

按用户故事和共享基础分组。测试只在规格要求的强度内安排；不要默认每项都 TDD，也不要默认
完整回归。

### 9.6 Analyze

```text
$speckit-analyze
```

在 implement 前解决：

- CRITICAL Constitution 冲突；
- HIGH 合同缺口；
- 会改变验收的 MEDIUM 歧义；
- 未覆盖的 FR/SC；
- 不合法的跨故事依赖。

### 9.7 Staged Implement

一次只实施一个 phase 或 user story：

```text
$speckit-implement
只实施 User Story 1；完成其定向验收后停止。
```

实现过程中发现需求错误，先返回文档层修改，不允许代码自行扩展。

### 9.8 Converge

```text
$speckit-converge
```

Converge 只处理真实实现暴露的验收缺口。不得加入未来能力、覆盖率扩张、发布操作或无关重构。

## 10. 已准备 Feature 的流程

当 `README/spec/plan/research/data-model/quickstart/contracts/checklist/tasks` 已完整存在时：

1. 不重新运行 specify；
2. 选择 Feature；
3. 运行 clarify；
4. review checklist；
5. 运行 analyze；
6. 只实施批准的第一个切片；
7. 定向验证；
8. converge；
9. 停止并记录 checkpoint。

## 11. 规格变更控制

批准后的行为变化必须按以下顺序：

1. 修改 `spec.md`；
2. 修改受影响 `contracts/`；
3. 重新 clarify；
4. 重新 review checklist；
5. 修改 plan/research/data-model/quickstart；
6. 修改 tasks；
7. 重新 analyze；
8. 判断已完成任务是否仍成立；
9. 再继续实现。

禁止先扩大代码，再让文档追认。

## 12. 历史 Feature 管理

`001`–`007` 记录已经发生的设计、实施和发布历史。新的规范只约束 `008` 及后续 Feature。

历史文档仅在以下情况下修改：

- 修复事实错误；
- 记录完成状态；
- 增加明确的 superseded 链接；
- 修复无效链接。

不得：

- 批量套用新模板；
- 改写已发布版本；
- 把新的产品方向伪装成旧 Feature 原意；
- 删除失败和恢复证据。

## 13. 测试与证据预算

每个 plan 必须列出：

- 每个 User Story 的定向测试；
- Schema/contract fixture；
- 已选择的数据处置、不支持/未来数据 safe-stop；
- 是否需要真实 Host；
- 最终 repository-wide validation 次数。

默认规则：

- 小步骤不跑完整仓库验证；
- 每个 User Story 只跑受影响 package/contract；
- 完整 `pnpm run validate` 只在最终 Feature checkpoint 运行一次；
- 真实 Host Journey 只在规格明确要求时运行一次；
- 失败重跑必须记录根因，不能默默重复直到通过。

## 14. Product Feature 与 Release Feature 分离

Product Feature：

- 可修改 Core、Schema、MCP、Adapter 和文档；
- 不修改公开版本作为交付条件；
- 不发布 npm；
- 不创建/移动 Tag；
- 不创建/完成 GitHub Release；
- 不生成公开支持声明。

Release Feature：

- 选择已经完成的 Product Features；
- 对齐 VERSION/package/runtime；
- 构建、回读、Journey、制品与支持矩阵；
- 不改变产品语义。

## 15. 模板维护

`.specify/templates/` 是本仓库定制模板。升级 Spec Kit 时：

1. 比较上游模板变化；
2. 保留本文件规定的必填段落；
3. 不覆盖项目的状态图、持久化过渡、测试预算和 Release 分离要求；
4. 更新模板后，用一个临时示例验证生成结构；
5. 不修改 `.agents/skills/speckit-*` 生成资产，除非由受控 Spec Kit 升级重新生成。

## 16. 当前替换入口

当前下一项 Product Feature 是：

```text
specs/008-refactor-to-development-process-graph/
```

它用开发过程状态图替换现有 Core Contract 0.1 线性阶段模型，并明确不兼容任何历史任务数据。Feature 008 完成前：

- 不向旧阶段表添加新阶段；
- 不实现 `legacy-linear@1`、Schema 1 任务迁移、snapshot-v1 codec、双 Task projection 或旧任务续跑；
- Schema 1/pre-graph 数据只允许零写入拒绝；Core 与包生命周期不得自动删除，用户显式选择新目录或自行归档/改名/删除；
- 不在 Host Skill 中建立第二套状态；
- 不启动 DeepSeek 产品实施；
- 不把实现工作和下一次公开发布混合；
- 只按 Feature 008 的 staged checkpoint 推进。
