# Feature Specification: 多仓库任务范围与用户配置

**Feature Branch**: `not-created`（未配置 `before_specify` 分支钩子）

**Created**: 2026-08-23

**Status**: Blocked

**Input**: User description: "为 Dev Flow 增加多仓库任务范围与用户配置，在保持单一 Core 流程权威和现有单仓库行为的前提下，让一个 Task 显式绑定一个主仓库和若干附加仓库。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 创建有界多仓库 Task (Priority: P1)

用户为一次跨仓库开发需求显式选择一个主仓库和若干附加仓库。Dev Flow 将这些仓库作为一个
不可变 Repository Scope 绑定到同一 Task；该 Task 仍只有一个当前节点、Action、revision、
verification budget、Recovery、Blocker 和 Outcome。未声明附加仓库时，用户继续获得现有
单仓库体验。

**Why this priority**: 这是多仓库功能的核心价值，也是保持 Core 单一流程权威和单仓库兼容的
基础。

**Independent Test**: 分别创建一个单仓库 Task 和一个由主仓库、一个附加仓库组成的 Task，验证
两者均只有一套流程状态，且两仓库 Task 的范围在创建后不可变。

**Acceptance Scenarios**:

1. **Given** 用户位于一个未被活动 Task 占用的 Git 仓库，且未声明附加仓库，**When** 用户创建
   Task，**Then** Dev Flow 按现有单仓库行为创建 Task，并继续接受普通仓库相对路径。
2. **Given** 用户显式声明一个主仓库和一个具有唯一稳定 key 的附加仓库，且两者均可用且未被
   占用，**When** 用户创建 Task，**Then** Dev Flow 原子地绑定两个仓库，并返回同一个 Task 的
   单一流程状态。
3. **Given** 一个多仓库 Task 已创建，**When** 用户尝试增加、删除、重命名或替换其中的仓库，
   **Then** Dev Flow 拒绝变更且原 Repository Scope 保持不变。
4. **Given** 用户声明的仓库总数超过 8，**When** 用户创建 Task，**Then** Dev Flow 返回明确的
   数量上限错误且不创建 Task 或 claim。

---

### User Story 2 - 原子占用、恢复与整体漂移保护 (Priority: P1)

用户希望多仓库 Task 对全部参与仓库形成一个不可分割的工作范围。任一仓库发生 claim 冲突或
禁止漂移时，Dev Flow 必须保护整个 Task；用户也可以从任一参与仓库恢复同一个活动 Task。

**Why this priority**: 如果仓库占用、恢复或漂移只覆盖部分范围，同一个 Task 的权威状态将无法
可靠代表实际工作。

**Independent Test**: 使用两个仓库验证 claim 冲突零残留、从附加仓库恢复同一 Task，以及附加
仓库发生未声明漂移时整个 Task 停止推进。

**Acceptance Scenarios**:

1. **Given** 附加仓库已被另一个活动 Task 占用，**When** 用户尝试创建两仓库 Task，**Then**
   创建整体失败，主仓库和附加仓库均不留下该新 Task 的 claim。
2. **Given** 一个活动 Task 绑定了两个仓库，**When** 用户从任一仓库恢复工作，**Then** Dev Flow
   返回同一 Task、同一 revision 和同一当前 Action。
3. **Given** 一个活动多仓库 Task，**When** 任一参与仓库出现当前 Action 未声明的修改、分支或
   HEAD 变化，或其他禁止漂移，**Then** 整个 Task 停止推进并报告具体仓库和漂移原因。
4. **Given** Task 当前 Action 涉及多个仓库且 mutation 响应不确定，**When** 至少一个仓库已
   完成、其余仓库尚未开始且没有不兼容变化，**Then** Dev Flow 返回 `partially_completed`；如果
   任一仓库出现与该 mutation 不兼容的状态，**Then** Dev Flow 返回 `conflicting`。两种结果均
   不创建仓库级独立流程状态。

---

### User Story 3 - 遵守 Codex 与 DeepSeek 仓库权限 (Priority: P2)

用户通过 Codex 或 DeepSeek 执行多仓库 Task 时，Dev Flow 使用同一 Repository Scope 语义，
同时遵守各 Host 已有的目录授权边界，不替用户扩大沙箱或 Workspace 权限。

**Why this priority**: 多仓库能力只有在不绕过 Host 权限模型时才可安全使用。

**Independent Test**: 各运行一个有界两仓库 Host Journey；同时验证 Codex 未授权附加目录和
DeepSeek Workspace Root 外仓库均被拒绝。

**Acceptance Scenarios**:

1. **Given** Codex 当前仓库作为主仓库，附加仓库位于 Codex 已授权的附加可写目录，**When**
   用户创建并执行两仓库 Task，**Then** Host 可以在现有授权内完成相关 Action。
2. **Given** Codex 声明的附加仓库不在当前授权附加可写目录中，**When** 用户创建多仓库 Task，
   **Then** Dev Flow 拒绝创建且不改变沙箱配置或切换沙箱模式。
3. **Given** 多仓库 Task 创建时 Codex 对附加仓库具有写权限，但该权限在后续 Action 前失效，
   **When** Action 需要修改该仓库，**Then** Host 明确报告权限问题并停止相关修改。
4. **Given** 两个仓库都位于同一 DeepSeek Workspace Root 下，且 Workspace Root 本身不是 Git
   仓库，**When** 用户创建两仓库 Task，**Then** Dev Flow 接受该范围。
5. **Given** 一个仓库位于 DeepSeek Workspace Root 外，**When** 用户声明该仓库，**Then**
   Dev Flow 拒绝创建 Task；代码索引能力不得改变该结果。

---

### User Story 4 - 配置可选代码索引偏好 (Priority: P3)

用户可以通过统一、只读的个人配置分别选择 Codex 和 DeepSeek 是否优先使用已经可用的
codebase-memory。该偏好只影响代码发现方式，不影响 Repository Scope、权限、Git 事实、
Recovery 或流程流转。

**Why this priority**: 该配置能改善已安装索引能力的使用体验，但多仓库 Task 不依赖它即可完成。

**Independent Test**: 验证配置文件不存在、配置合法和配置非法三种情况；在启用但能力不可用时
验证一次提示和内置检索回退。

**Acceptance Scenarios**:

1. **Given** `$HOME/.dev-flow/config.json` 不存在，**When** 任一 Host 读取用户配置，**Then**
   Codex 和 DeepSeek 的 codebase-memory 偏好均为关闭，且 Dev Flow 不创建配置文件。
2. **Given** 配置分别为 Codex 关闭、DeepSeek 开启，且索引能力已经可用，**When** 两个 Host
   执行代码发现，**Then** Codex 使用内置检索，DeepSeek 可以优先使用索引能力。
3. **Given** 配置启用 codebase-memory 但能力不可用，**When** Host 执行代码发现，**Then** Host
   在当前会话仅提示一次并回退到内置检索，多仓库 Task 不因此被阻塞。
4. **Given** 配置 JSON 无效或包含不支持字段，**When** Dev Flow 读取配置，**Then** 返回明确
   错误，并且不创建或修改任何 Task。

### Edge Cases

- 主仓库与附加仓库解析为同一 repository identity 时，创建必须失败且不留下 claim。
- 两个附加仓库使用重复 key、同一路径或指向同一仓库的不同路径时，创建必须失败。
- 附加仓库 key 为空、在同一 Scope 中重复，或在一次创建或恢复请求中与已绑定值不一致时，
  创建或恢复必须失败。
- 任一声明路径不存在、不是可观察的 Git 仓库或在创建期间改变 identity 时，整体创建必须失败。
- 仓库总数恰好为 8 时必须可创建；第 9 个仓库必须被拒绝。
- 多仓库 Task 的路径无法唯一确定所属仓库时，相关 Action 或结果必须被拒绝。
- 活动 Task 的非主仓库 claim 丢失、冲突或指向其他 Task 时，Task 必须安全停止而不是部分推进。
- 不确定 mutation 仅包含已完成和未开始仓库时，Recovery 必须返回 `partially_completed`；任一
  仓库存在不兼容状态时必须返回 `conflicting`。
- 配置文件存在但不可读、超过支持大小、顶层 Host 名称未知或 Host 配置字段未知时，必须作为
  配置错误处理。
- codebase-memory 在一次 Host 会话中途变为不可用时，Host 必须回退到内置检索，不改变 Task。
- 旧的不兼容持久化数据存在时，系统必须零写入拒绝，且不得自动删除、覆盖、改名或迁移。

## Requirements *(mandatory)*

### Functional Requirements

#### Repository Scope and Task Authority

- **FR-001**: 用户创建 Task 时，系统 MUST 接受一个显式主仓库和零至七个显式附加仓库，
  Repository Scope 总数 MUST NOT 超过 8。
- **FR-002**: 每个附加仓库声明 MUST 包含非空 key 和本地路径；key MUST 在当前 Repository
  Scope 内唯一，并在 Scope 生命周期内保持不变；所有声明仓库 MUST 解析为互不重复的
  repository identity。
- **FR-003**: 系统 MUST 只使用用户显式声明的仓库，MUST NOT 通过父目录、相邻目录、依赖关系
  或代码索引结果自动发现或扩展 Repository Scope。
- **FR-004**: Repository Scope 一经创建 MUST 保持不可变；系统 MUST 拒绝动态增加、删除、
  重命名或替换仓库。
- **FR-005**: 多仓库 Task MUST 继续只有一个当前节点、一个当前 Action、一个 revision、一个
  verification budget、一套 Recovery、一个 Blocker 和一个 Outcome。
- **FR-006**: Core MUST 对所有参与仓库建立 repository binding 和 repository claim，并将
  完整 Repository Scope 作为同一 Task 的权威范围。
- **FR-007**: Task 创建和全部 repository claim MUST 原子成功或原子失败；任一仓库存在活动
  claim 冲突时，系统 MUST NOT 创建 Task 或留下任何新 claim。
- **FR-008**: 用户 MUST 能从任一参与仓库恢复同一个活动 Task；恢复结果 MUST 指向相同 Task、
  revision 和当前 Action。
- **FR-009**: 任一参与仓库出现未声明修改、分支变化、HEAD 变化或其他禁止漂移时，系统 MUST
  阻止整个 Task 推进并标识发生漂移的仓库和原因。
- **FR-010**: 多仓库 Task 中的每个文件路径 MUST 能唯一确定所属仓库；单仓库 Task MUST 继续
  使用现有普通仓库相对路径。
- **FR-011**: 系统 MUST 保持现有单仓库 Task 的创建、恢复、路径、claim、漂移和 Recovery
  用户行为兼容。
- **FR-012**: 不确定 mutation 的 Recovery MUST 同时评估全部参与仓库，并继续使用现有 Recovery
  分类；至少一个仓库完成、其余仓库未开始且没有不兼容变化时 MUST 返回
  `partially_completed`，任一仓库存在不兼容状态时 MUST 返回 `conflicting`。
- **FR-013**: Repository Scope 或 Recovery 的任何扩展 MUST NOT 创建仓库级子 Task、独立
  状态机、并行 Action、额外 Blocker 或额外 Outcome。

#### Host Permission Boundaries

- **FR-014**: Codex MUST 将当前 Git 仓库作为主仓库，并且只接受已位于当前授权附加可写目录
  中的附加仓库。
- **FR-015**: Dev Flow MUST NOT 自动修改 Codex 沙箱配置或切换到不受限制的沙箱模式。
- **FR-016**: Codex MUST 在创建多仓库 Task 时拒绝未获附加写目录授权的仓库；已创建 Task 的
  仓库权限在 Action 前失效时，Host MUST 明确报告权限问题并停止相关修改。
- **FR-017**: DeepSeek 多仓库 Scope 中的所有仓库 MUST 位于当前 Workspace Root 下；Workspace
  Root MAY 是这些仓库的非 Git 共同父目录。
- **FR-018**: DeepSeek MUST 拒绝 Workspace Root 外的仓库；代码索引结果 MUST NOT 绕过该
  权限判断。

#### User Configuration and Optional Indexing

- **FR-019**: 系统 MUST 从 `$HOME/.dev-flow/config.json` 只读获取 Codex 和 DeepSeek 各自的
  `codebase_memory` 布尔偏好。
- **FR-020**: 配置目录或文件不存在时，两个 Host 的 `codebase_memory` MUST 均默认为 `false`；
  Dev Flow MUST NOT 自动创建或修改配置目录或文件。
- **FR-021**: `codebase_memory=false` 时，Host MUST NOT 调用 codebase-memory，并 MUST 使用自身
  的 Git、文件读取和文本检索能力。
- **FR-022**: `codebase_memory=true` 且相关能力已经安装并可用时，Host MAY 优先使用该能力进行
  跨仓库代码发现和影响分析。
- **FR-023**: `codebase_memory=true` 但能力不可用或不完整时，Host MUST 在当前会话最多提示一次，
  MUST 回退到内置检索，并 MUST NOT 阻止 Task。
- **FR-024**: Dev Flow MUST NOT 安装、下载、配置、升级、启动或卸载 codebase-memory。
- **FR-025**: codebase-memory MUST NOT 决定或改变 Repository Scope、仓库权限、repository
  binding、changed paths、Recovery、Blocker、Outcome 或流程流转。
- **FR-026**: 配置 MUST 拒绝无效 JSON、非布尔偏好、未知顶层 Host 和 Host 对象中的不支持字段，
  并返回可定位的明确错误。
- **FR-027**: 配置错误发生时，系统 MUST NOT 创建或修改 Task、claim 或其他流程状态。

#### Persistence, Contracts, and Documentation

- **FR-028**: 多仓库持久化结构变化 MUST 对旧的不兼容数据采用 `reject-and-reset`：零写入拒绝、
  不自动迁移、不保留旧数据兼容运行时，并且不自动删除、改名或覆盖旧数据。
- **FR-029**: 遇到旧的不兼容数据时，系统 MUST 提示用户显式选择新的数据目录，或在 Core 外部
  手工归档旧目录。
- **FR-030**: 本 Feature MUST 复用现有流程节点、Transition、Recovery 分类和公开工具集合，
  MUST NOT 增加新的流程权威或新的公开工具。
- **FR-031**: 面向用户的文档 MUST 提供配置文件样例、单仓库兼容说明，以及 Codex 和 DeepSeek
  各自的多仓库使用与权限边界示例。
- **FR-032**: Product Feature 阶段 MUST NOT 修改公开产品版本、发布 npm、创建或移动 Tag，或
  创建或完成 GitHub Release。

### Key Entities *(include if feature involves data)*

- **Repository Scope**: 一个 Task 的不可变仓库集合，包含且仅包含一个主仓库、零至七个附加
  仓库，并作为所有仓库事实和权限校验的完整边界。
- **Repository Scope Entry**: Scope 中的单个仓库声明，包含角色、Scope 内唯一且创建后不可变的
  key（附加仓库必需）、用户提供路径、repository identity、binding、claim 和可报告的漂移
  事实。
- **Process Task**: 跨全部 Scope Entry 共享的单一流程聚合，持有唯一节点、Action、revision、
  verification budget、Recovery、Blocker 和 Outcome。
- **Scoped Path**: 能够无歧义关联到某个 Repository Scope Entry 的文件路径；单仓库路径保持
  现有表示。
- **Host Index Preference**: Codex 或 DeepSeek 对可选 codebase-memory 的只读布尔偏好；该偏好
  不是 Task 状态或流程权威。
- **Recovery Assessment**: 对一次不确定 mutation 涉及的完整 Repository Scope 进行评估后得到
  的现有 Recovery 分类结果。

## Non-Goals

本 Feature 不交付以下能力：

- 新的公开工具、流程节点或 Transition；
- 父 Task、仓库子 Task 或仓库级独立状态机；
- 动态增加、删除、重命名或替换仓库；
- 自动发现、clone、fetch 或 checkout 仓库；
- 多仓库并行 Action、跨仓库 Git 事务或自动回滚；
- 自动 commit、push、创建 PR、合并或发布；
- 通用 Workspace、代码智能 Provider、Repository Provider 或 Orchestrator 框架；
- codebase-memory 安装器或生命周期管理；
- 项目级配置覆盖或配置管理 CLI；
- 平台扩展、产品版本修改或版本发布。

## Verification Budget

本 Feature 的验收证据 MUST 限定为：

1. 现有单仓库行为保持可用；
2. 一个两仓库正常流程；
3. 一个附加仓库 claim 冲突；
4. 一个未声明仓库漂移；
5. 一个部分完成的 Recovery 场景；
6. 配置文件不存在、合法和非法三种情况；
7. Codex 一个有界两仓库 Journey；
8. DeepSeek 一个有界两仓库 Journey。

验收 MUST NOT 默认扩展到 3～8 个仓库的组合矩阵、平台矩阵、压力或性能测试、fuzz、真实
codebase-memory 安装或版本矩阵、每个节点的多仓库 Journey，或重复全仓验证。

本 Feature 中，最终仓库级验证、Codex 真实 Host Journey 和 DeepSeek 真实 Host Journey 各最多
调用一次。每次实际启动均消耗对应预算，无论结果为成功、失败、中断或超时。调用这些最终
检查前，必须先完成对应的定向检查。

若最终验证或真实 Host Journey 失败，Feature 进入 `Blocked`，不得直接重跑。修复阶段只允许
运行与失败原因直接相关的定向检查。

若确实需要第二次执行，必须先获得用户明确批准，并同步修订 `spec.md`、`plan.md`、
`quickstart.md` 和 `tasks.md` 中的验证预算。预算修订完成前不得执行第二次。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 现有单仓库验收场景 100% 保持通过，用户无需声明附加仓库或采用新的路径表示。
- **SC-002**: 用户可以用一个 Task 完成规定的两仓库正常流程，且全程只出现一个当前节点、
  Action、revision、verification budget、Recovery、Blocker 和 Outcome。
- **SC-003**: 系统接受总数 1～8 的唯一仓库声明，并在 100% 的超过上限、重复 key、重复 identity
  或无效路径用例中于创建前给出明确错误。
- **SC-004**: 在规定的 claim 冲突场景中，创建失败后新 Task 和新 claim 的残留数量均为 0。
- **SC-005**: 在规定的未声明漂移场景中，Task 推进次数为 0，错误结果明确指出发生漂移的仓库。
- **SC-006**: 在规定的部分完成场景中，Recovery 对“部分完成且其余未开始”返回
  `partially_completed`，对存在不兼容仓库状态返回 `conflicting`，且不产生第二套流程状态。
- **SC-007**: 配置不存在、合法、非法三类验收场景全部产生规定结果；索引能力不可用时，多仓库
  Task 的阻塞次数为 0，同一 Host 会话的不可用提示不超过 1 次。
- **SC-008**: Codex 和 DeepSeek 各通过且只需一个有界两仓库 Journey，分别证明其目录权限边界
  和同一 Core Task 语义。
- **SC-009**: 用户在不安装 codebase-memory 的环境中能够完成全部必需多仓库核心验收场景。
- **SC-010**: 所有范围、权限、配置、claim 和漂移拒绝结果均能让用户识别具体失败仓库或配置项，
  无需检查内部持久化数据。

## Assumptions

- 仓库路径均指向用户本地已有的 Git 仓库；仓库 clone、fetch 和 checkout 由用户或已授权 Host
  在本 Feature 之外完成。
- Host 已有能力提供其当前授权目录或 Workspace Root；Dev Flow 只校验并遵守该边界。
- “仅提示一次”按单次 Host 会话计算；新的 Host 会话可以再次提示能力不可用。
- 多仓库路径的精确公开表示由后续合同明确，但必须保持仓库归属无歧义，并保持单仓库普通相对
  路径兼容。
- 现有 Recovery 分类足以表达未开始、已记录完成、未记录完成、部分完成和冲突；本 Feature
  只扩展评估范围，不新增分类。
- 用户负责手工创建和编辑个人配置文件；Dev Flow 只读该文件。
- 本 Feature 依赖现有 Core 单一流程权威、Git 只读观察和 Host 授权修改边界持续成立。
