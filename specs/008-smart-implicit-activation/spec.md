# Feature Specification: Codex 智能隐式启用

**Feature Branch**: `not-created`

**Created**: 2026-08-24

**Status**: Complete

**Input**: User description: "实现、修复、重构、补测试、交付这类明确开发任务自动加载 Dev Flow；保留精确 selector 作为强制入口；解释、状态查询、方案讨论、普通问答和含糊请求不自动创建 Task。"

## User Scenarios & Testing

### User Story 1 - 直接描述开发任务 (Priority: P1)

Codex 用户直接描述一个边界明确的实现、缺陷修复、重构、定向测试或交付任务时，无需重复输入
Dev Flow selector。Codex 可以根据已安装 Skill 的用途描述选择 Dev Flow，并按既有准入和 Core 合同
打开或恢复 Task。

**Why this priority**: 重复输入完整 selector 是当前最高频的交互摩擦；去除它可以让 Dev Flow 成为
自然的开发工作入口。

**Independent Test**: 检查打包后的 Skill metadata、用途描述和准入合同，使用每类代表性执行请求
验证其属于允许隐式选择的闭合集合，并验证成功选择后仍执行既有兼容握手和 Task 打开流程。

**Acceptance Scenarios**:

1. **Given** Dev Flow Codex Plugin 已安装，**When** 用户提交一个边界明确的功能实现请求，**Then**
   Codex 可以隐式选择 Dev Flow，且不要求用户补写 selector。
2. **Given** Plugin 已安装，**When** 用户提交一个边界明确的缺陷修复、重构或补充定向测试请求，
   **Then** Codex 可以隐式选择 Dev Flow，并继续使用既有 Task 准入与 Core 状态图。
3. **Given** Plugin 已安装，**When** 用户提交一个边界明确的开发交付请求，**Then** Codex 可以隐式
   选择 Dev Flow；提交、推送、版本和发布仍分别受既有用户授权与 release 合同约束。
4. **Given** Skill 被隐式选择，**When** 请求缺少会实质改变范围、验证或方法选择的必要信息，
   **Then** Codex 在创建 Task 前请求必要决定，不自行扩大用户意图。

---

### User Story 2 - 保持普通对话轻量 (Priority: P1)

用户请求解释代码、查询状态、讨论方案、进行普通问答，或只给出含糊意图时，Codex 保持普通对话，
不因 Dev Flow Plugin 已安装而自动创建 Task。

**Why this priority**: 自动化只有在不会把非执行请求变成持久 Task 时才改善体验；误建 Task 会增加
状态、恢复和取消成本。

**Independent Test**: 对五类排除请求逐一检查 Skill 描述、准入合同和代表性负例，确认它们不满足
隐式 Task 创建条件。

**Acceptance Scenarios**:

1. **Given** Plugin 已安装，**When** 用户只要求解释代码或回答普通问题，**Then** 不自动创建 Dev
   Flow Task。
2. **Given** Plugin 已安装，**When** 用户只查询仓库或工作的当前状态，**Then** 不自动创建 Dev Flow
   Task；既有只读能力不因此被禁止。
3. **Given** Plugin 已安装，**When** 用户只讨论或比较设计方案，**Then** 不自动创建 Dev Flow Task。
4. **Given** Plugin 已安装，**When** 用户请求含糊且无法确定一个实质、有界的开发结果，**Then**
   保持普通对话或澄清意图，不自动创建 Task。

---

### User Story 3 - 显式强制进入 (Priority: P2)

需要确定使用 Dev Flow 的用户仍可在当前请求中选择精确 `$dev-flow-codex:dev-flow` Skill。显式选择
跳过隐式匹配判断，但不会跳过实质请求、仓库权限、兼容握手、Core 合同或用户授权检查。

**Why this priority**: 保留确定性入口，支持隐式匹配不稳定、用户主动恢复 Task 和排障场景。

**Independent Test**: 使用精确 selector、错误 namespace、裸 `$dev-flow` 和空/会话型显式请求检查
既有确定性边界。

**Acceptance Scenarios**:

1. **Given** Plugin 已安装，**When** 当前请求包含精确 `$dev-flow-codex:dev-flow` selector 和一个
   实质有界请求，**Then** Skill 被显式选择并进入既有准入流程。
2. **Given** 当前请求包含裸 `$dev-flow` 或错误 namespace，**When** Codex 解析 Skill，**Then** 它们
   不成为该 Plugin 的显式 selector。
3. **Given** 用户显式选择 Skill，**When** selector 后没有实质请求或恢复意图，**Then** 不创建 Task。

## Requirements

### Functional Requirements

- **FR-001**: Dev Flow Codex Skill MUST 允许 Host 根据 Skill 描述进行隐式选择。
- **FR-002**: Skill 描述 MUST 前置声明允许隐式选择的执行型用途：功能实现、缺陷修复、重构、定向
  测试和开发交付。
- **FR-003**: Skill 描述和准入合同 MUST 明确排除仅解释、仅状态查询、仅方案讨论、普通问答和无法
  确定实质有界开发结果的含糊请求；这些请求 MUST NOT 自动创建 Dev Flow Task。
- **FR-004**: 精确 `$dev-flow-codex:dev-flow` selector MUST 保持显式强制选择入口；显式选择 MUST NOT
  绕过实质请求、恢复意图、仓库范围、写权限、兼容握手、Core Action 或用户授权检查。
- **FR-005**: 裸 `$dev-flow`、错误 Plugin namespace 和错误 Skill base name MUST NOT 成为该 Plugin 的
  显式 selector。
- **FR-006**: 隐式和显式选择 MUST 汇合到同一份准入、兼容握手、Task discovery、Action loop、恢复
  和展示合同；Host Adapter MUST NOT 保存第二份激活状态或 Core 流程游标。
- **FR-007**: Plugin MCP admission instructions MUST 与 Skill activation contract 一致，不得继续把
  精确 selector 描述成唯一合法入口。
- **FR-008**: `dev-flow-codex setup` MUST 校验启用隐式选择的 metadata、Skill 描述和 MCP admission
  instructions，拒绝互相矛盾或缺失的 package 内容。
- **FR-009**: Codex package contract tests MUST 覆盖五类允许隐式选择的代表请求、五类不得自动创建
  Task 的代表请求、精确 selector 和非 selector 名称边界。
- **FR-010**: 所有受影响的维护文档 locale MUST 同步说明智能隐式启用、精确强制入口和非执行型
  请求边界，并删除“普通提示词必须产生零次 Dev Flow 调用”等冲突陈述。
- **FR-011**: Core、MCP tool Schema、Task/SQLite、process definition、DeepSeek Adapter 和
  codebase-memory preference behavior MUST 保持不变。
- **FR-012**: Product Feature 阶段 MUST NOT 修改产品版本、提交、推送、发布 npm、创建或移动 Git
  Tag，或创建、修改或完成 GitHub Release。

### Key Entities

- **Activation path**: `implicit` 或 `explicit` 的 Skill 选择来源，只用于 Host 当前请求的准入判断，
  不持久化到 Core Task。
- **Task-bearing development request**: 能确定一个实质、有界开发结果的实现、修复、重构、定向测试
  或交付请求。
- **Non-task-bearing request**: 仅解释、仅状态查询、仅方案讨论、普通问答或含糊意图；不得因隐式
  Skill 选择自动创建 Task。

## Persistence Disposition

- **Task/SQLite data**: `not-applicable`。Feature 不改变 Task Schema、记录或数据目录。
- **Activation source**: Host 当前请求的瞬时事实，不写入 Core、receipt、用户配置或仓库文件。
- **Existing Tasks**: 原样可读、可恢复；Feature 不迁移、重写或取消既有 Task。

## Non-Goals

- `$dev-flow` 别名、重命名 Plugin/package 或复制独立 Skill；
- `explicit`/`automatic` 全局或项目配置、激活状态持久化或 UI 开关；
- Core node、transition、payload、MCP Schema、Task/SQLite 或 Recovery 变化；
- DeepSeek Adapter 的隐式激活变化；
- 将代码解释、状态查询或方案讨论强制纳入 Dev Flow；
- 放宽提交、推送、版本、Tag、npm、GitHub Release 或其他外部副作用授权；
- 真实 Host 的概率性匹配穷举、模型组合矩阵、压力、性能或 fuzz 测试；
- 产品版本变化或任何发布操作。

## Verification Budget

本 Feature 的自动验证限定为最多 8 个定向命令：

1. Skill metadata、Skill contract、MCP admission 和 setup lifecycle 的 Codex package 定向测试；
2. 受影响 package closure 或文档合同的直接回归；
3. 必要的格式或静态一致性检查。

不运行 `pnpm run validate`、完整仓库测试、真实 Codex Host Journey、registry lifecycle、DeepSeek
测试、平台/模型矩阵、压力、性能、fuzz 或 release command。失败后先记录根因和剩余预算；不得用
更宽测试替代失败的定向测试。

## Success Criteria

- **SC-001**: 五类明确开发执行请求均由 package contract 表达为允许隐式选择，无需 selector。
- **SC-002**: 五类非执行或含糊请求均由 package contract 表达为不得自动创建 Task。
- **SC-003**: 精确 selector、裸名称和错误 namespace 的确定性边界保持可验证。
- **SC-004**: Skill、MCP instructions、setup validator、tests 和维护文档对激活合同无冲突。
- **SC-005**: 定向验证全部通过，且 Core、DeepSeek、持久化、版本和发布路径没有行为改动。

## Assumptions

- Codex Host 依据 Skill `description` 进行隐式匹配；Plugin 只负责提供清晰、可审查的用途与排除描述，
  不把概率性模型判断伪装成完全确定的运行时分类器。
- `allow_implicit_invocation` 是 Host metadata，不是安全或授权边界；现有仓库权限、Action allowed
  effects 和用户显式 Git/release 授权继续负责副作用边界。
- “开发交付”表示完成当前开发工作及其已授权交付步骤，不自动授权提交、推送或发布。
