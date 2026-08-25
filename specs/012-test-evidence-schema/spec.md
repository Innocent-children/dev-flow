# Feature Specification: Precise TEST Evidence Schema Exposure

**Feature Directory**: `specs/012-test-evidence-schema`  
**Created**: 2026-08-25  
**Status**: Complete  
**Input**: 修复 `dev_flow_apply_action` 在 Codex callable tool 中把 payload退化为 unknown，以及 TEST 手工证据虽通过通用 JSON Schema却被 workflow closed contract拒绝的问题。

## Problem Statement

Core 的 MCP catalog已经为九种 action kind构建不同 payload schema，TEST `checks[].source` 也包含
`automated|user|static|host_observed`。但 apply工具同时声明一个通用 `payload.anyOf(oneOf(...))`，再通过
`allOf(oneOf(action branches))`收窄，Codex Host生成的 callable类型只能显示 `payload?: unknown`。

TEST check 的 JSON Schema还把所有 source统一描述为 `command_count: 0..20` 和任意 `full_suite`，而
workflow validator要求：automated command_count至少为 1；user/static/host_observed command_count必须为
0且 full_suite必须为 false。调用方无法从 live schema得知这一条件，可能构造 Schema表面合法但被 Core
以 `INVALID_ARGUMENT` 拒绝的 payload。

## User Scenarios & Testing

### User Story 1 - Host 获得 action-specific apply schema (Priority: P1)

Codex/DeepSeek读取 tools/list时，`dev_flow_apply_action` 以 action kind作为判别字段，每个分支直接暴露
对应 closed payload，不需要把 `payload` 视为 unknown或从源码猜测。

**Independent Test**: 读取 MCP catalog JSON Schema并验证每个 action分支是完整 apply object，TEST分支
只引用 TEST payload且不存在与通用 payload的交叉退化。

**Acceptance Scenarios**:

1. **Given** MCP catalog构建完成，**When** Host读取 apply input schema，**Then** 九个 action kind各有一个闭合完整分支且 payload类型具体。
2. **Given** 现有合法 automated TEST payload，**When** 按新 Schema验证并 apply，**Then** wire JSON和行为保持兼容。
3. **Given** action kind与 payload branch不匹配，**When** 验证输入，**Then** 在 mutation前确定性拒绝。

### User Story 2 - 用户执行证据具有可见闭合规则 (Priority: P1)

调用方记录开发者执行的测试时使用 `checks[].source="user"`、`status="passed"`、
`command_count=0`、`full_suite=false`。`manual_handoff_items` 只记录仍待用户执行的工作，不承载已经完成
并可保留为 EvidenceSummary 的用户证据。

**Independent Test**: 对 automated/user/static/host_observed四类 check做 Schema与 workflow双层矩阵，
验证合法值通过、错误 command_count/full_suite在 mutation前失败。

**Acceptance Scenarios**:

1. **Given** 自动预算已用完且允许 manual handoff，**When** 提交成功的 user check并使用零 command_count，**Then** TEST pass可创建用户证据且不增加自动命令计数。
2. **Given** user check使用非零 command_count或 full_suite=true，**When** 验证输入，**Then** 返回确定性 invalid argument并保持零写入。
3. **Given** 尚待开发者执行的检查，**When** TEST结果仍未闭合，**Then** 只在 `manual_handoff_items` 中记录，不伪装成 passed check。
4. **Given** developer-run check已经完成，**When** 提交 TEST pass，**Then** `manual_handoff_items` 为空且 user check进入 retained evidence。

### User Story 3 - Feature 010 证据可按正确合同继续 (Priority: P2)

修复完成后，Feature 010 已保留实现与四条自动证据不被重写；开发者报告的 21/21 使用正确 user check
语义重新进入一个新 Task的 TEST/DELIVERY证据，不复用已取消 Task的 Action或 rejected payload。

**Independent Test**: 使用与 Feature 010 相同的预算和证据形状构造 deterministic journey，证明
automated command总数保持 4，user evidence不计入自动预算，TEST可以进入 comprehension。

**Acceptance Scenarios**:

1. **Given** 四个 automated commands已记录，**When** 增加一个 `source=user, command_count=0` 的 passed check，**Then** budget仍为 4且 tests_passed合法。
2. **Given** 旧 Task已经取消，**When** 修复后的流程继续，**Then** 不恢复、覆盖或声称旧 Task完成。

### Edge Cases

- apply普通操作与 recovery apply继续使用同一 payload shape；recovery identity语义不变。
- `payload=null` 只在现有 recovery contract允许的位置出现，不扩大 ordinary apply。
- source alias如 `manual`、大小写或带空格值继续拒绝。
- non-automated check的 command_count只能是 JSON整数 0；缺失、null、字符串 0均拒绝。
- automated check的 command_count保持 1..20，并继续受 Task累计 budget限制。
- schema暴露修复不得增加、删除或重命名 MCP工具。

## Requirements

### Functional Requirements

- **FR-001**: `dev_flow_apply_action` input schema MUST 使用 action kind可判别的九个完整 apply object分支，每个分支直接包含对应 concrete payload schema。
- **FR-002**: 新 Schema MUST 保持当前 top-level字段、required规则、ordinary/recovery payload JSON和九个 action kind wire compatibility。
- **FR-003**: TEST check schema MUST 按 source分支表达 closed约束：automated为 command_count `1..20` 且 full_suite boolean；user/static/host_observed为 command_count const `0` 且 full_suite const `false`。
- **FR-004**: `checks[].source="user"` MUST 表示已完成的 developer-run verification并生成 user EvidenceSummary；它不得增加 automatic command budget。
- **FR-005**: `manual_handoff_items` MUST 只表示仍待手工执行的有界工作；已完成 user check提交 tests_passed时该列表为空。
- **FR-006**: Schema validation与 workflow validation MUST 对 source、command_count、full_suite规则一致；Schema接受而 workflow因同一字段组合返回 INVALID_ARGUMENT 的差异必须消除。
- **FR-007**: action kind/payload不匹配、未知 source、非自动证据非零 command_count和非自动 full suite MUST 在任何 Task mutation前失败并保持零写入。
- **FR-008**: MCP tool catalog MUST 继续恰好包含现有六工具，名称、annotations、transport与工具用途不变。
- **FR-009**: Codex 与 DeepSeek packaged node-payload references MUST 同步说明 completed user evidence和 outstanding manual handoff的区别。
- **FR-010**: Deterministic tests MUST 覆盖 catalog shape、source分支、existing automated compatibility、manual evidence budget和此前失败的 Feature 010 evidence组合。
- **FR-011**: 本 Feature MUST NOT 修改 Process、Node、Transition、Task、Action identity、Recovery分类、SQLite Schema或持久化处置；data disposition为 `not-applicable`。
- **FR-012**: 发布、版本、Tag、GitHub Release、registry lifecycle、提交、推送与 PR 不属于本 Feature。

### Persistence and Compatibility

- **Data disposition**: `not-applicable`.
- 已持久化 Task、Action、Evidence和旧合法 apply payload不需要迁移。
- 变化只收紧 live JSON Schema到当前 workflow validator已经执行的规则，并改善 Host类型投影。

### Key Entities

- **Apply Branch**: 一个 action kind对应的完整 top-level input object与 concrete payload。
- **Automated Check**: source automated、command_count 1..20、受自动预算控制的 evidence input。
- **User Check**: source user、command_count 0、full_suite false的已完成 developer evidence。
- **Manual Handoff Item**: 尚待用户执行、未形成 passed evidence的有界描述。

## Non-Goals

- 新 evidence source、status alias、Task字段或第二套 evidence模型。
- 修改 verification budget数值或允许绕过 exhausted automatic budget。
- 改变 comprehension user confirmation语义。
- 修复或扩大 Feature 010 生命周期功能本身。
- release或 Git mutation。

## Success Criteria

- **SC-001**: apply catalog的九个 action分支都能直接定位 concrete payload，Host投影不再需要 `payload?: unknown`。
- **SC-002**: automated/user/static/host_observed合法与非法组合的 Schema和 workflow矩阵结果 100%一致。
- **SC-003**: 四条自动命令加一条 user check的回归 journey通过，automatic count仍为 4。
- **SC-004**: 现有合法 automated apply fixtures与六工具 catalog tests保持通过。
- **SC-005**: 所有 invalid evidence组合在 mutation前失败且测试证明零写入。

## Assumptions

- Codex Host的 callable type generator能够从 top-level discriminated `oneOf`完整对象分支保留 payload结构。
- 当前 source enum和 workflow validator语义是产品权威，不新增 alias。
- Feature 010 的工作区文件与用户提供的 21/21输出作为外部已观察事实保留。
