# Feature Specification: Repository Binding Authorized Mutations

**Feature Directory**: `specs/011-repository-binding-mutations`
**Created**: 2026-08-25
**Status**: Complete
**Input**: 修复允许写入的 Action 因自身授权 worktree 变化而被错误判定为 `REPOSITORY_DRIFT`。

## Problem Statement

Action 签发时的 Repository Binding 同时包含稳定仓库事实和可变 worktree fingerprint。Host 必须先
执行 Action 允许的文件修改，再使用同一 Action apply；当前实现却把 process artifact references
隐式当作 changed-path 声明。合法修改只要没有逐一出现在 artifact evidence 中，就会被错误拒绝，
使 `allowed_effects` 与 apply guard 冲突。

## User Scenarios & Testing

### User Story 1 - 完成授权仓库修改 (Priority: P1)

Host 取得允许仓库写入的 Action，执行精确文件修改，并使用原 revision、Action identity、process
definition 和 repository binding digest 提交精确 mutation envelope；Core 验证后推进 Task。

**Independent Test**: 在临时真实 Git 仓库中完成 Action issuance、授权编辑和 apply，证明原 Action
可进入目标节点。

**Acceptance Scenarios**:

1. **Given** REQUIREMENTS Action 允许 `edit_process_artifacts`，**When** Host 修改 Feature selector、README、spec 和 requirements checklist 并提交精确 changed paths，**Then** 原 Action 成功进入 DESIGN。
2. **Given** DESIGN 或 TASKS Action 允许过程文档修改，**When** 只有声明路径发生变化，**Then** 原 Action 可以完成。
3. **Given** IMPLEMENT 或 REFACTOR Action 允许修改授权文件，**When** Host 提交与观察结果一致的精确 changed paths，**Then** 原 Action 可以完成。
4. **Given** 初始 worktree 已有修改或未跟踪文件，**When** 基线内容不变且 Action 新增授权变化，**Then** 基线不会造成假漂移。

### User Story 2 - 安全拒绝真实漂移和伪造提交 (Priority: P1)

Core 继续拒绝会使 Action 权威失效的仓库变化、未声明工作区变化和错误 Action/binding identity，且
拒绝路径保持 Task、event、evidence 和 claim 零写入。

**Independent Test**: 对 branch、HEAD、identity、canonical root、scope、revision、Action ID、binding
digest 和未声明 changed path 分别注入单一错误并核对稳定错误与零写入。

**Acceptance Scenarios**:

1. **Given** Action 已签发，**When** repository identity、canonical root、branch、HEAD 或 participating scope 改变，**Then** 返回确定性 repository drift 且不提交 Task mutation。
2. **Given** worktree 出现 mutation envelope 外的路径，**When** apply，**Then** 返回 repository drift 且零写入。
3. **Given** revision、Action ID、process definition 或 binding digest 错误，**When** apply，**Then** 返回对应 stale/unsupported 错误，不把它采纳为授权修改。
4. **Given** Action 不允许仓库写入，**When** worktree 改变，**Then** Core 拒绝并保持零写入。

### User Story 3 - 多仓库与重启保持同一权威 (Priority: P2)

多仓库 Task 对每个参与仓库独立验证 mutation envelope 和稳定 binding；Core 重启后从持久化 Action
继续相同语义，不要求取消或重建 Task。

**Independent Test**: 在两个临时 Git 仓库和临时 SQLite 中签发 Action、编辑参与仓库、重启服务并
apply；再分别注入任一仓库的 branch/HEAD/identity 漂移。

**Acceptance Scenarios**:

1. **Given** 多仓库 Action 声明两个仓库的 scoped paths，**When** 两仓只发生对应授权修改，**Then** 一个原子 apply 成功。
2. **Given** 任一参与仓库 branch、HEAD 或 identity 改变，**When** apply，**Then** 整个操作安全停止且零写入。
3. **Given** Task 在 Action 签发后重启，**When** Host 使用持久化的同一 revision、Action 和 binding 提交合法结果，**Then** apply 不要求重建 Task。

### Edge Cases

- 声明路径为空但 worktree 改变时拒绝；声明 `no_file_changes` 时只接受 exact binding。
- changed paths 必须是规范化、去重的单仓库路径或现有 multi-repository scoped path。
- 初始脏路径发生只改变内容、不改变 Git status path set 的并发写入时，聚合 fingerprint 能证明
  worktree 变化，但不能定位是哪一个基线路径变化；本 Feature 的路径级 envelope 不做写入者归因。
- artifact references 可以为空或只包含权威证据，不再承担完整 changed-path envelope 职责。
- recovery probe 使用原 payload 时，必须按同一 mutation envelope 重新验证，不得比 ordinary apply 更宽松。

## Requirements

### Functional Requirements

- **FR-001**: Repository binding MUST continue to bind canonical root, Git common directory/repository identity, branch/detached state, HEAD/unborn state and worktree observation.
- **FR-002**: Effective multi-repository binding MUST continue to bind immutable participating scope, repository keys and every component binding digest.
- **FR-003**: Every node whose Action allows repository writes MUST submit a closed mutation envelope containing exact `changed_paths` and `no_file_changes`; exactly one of non-empty paths or no-change MUST be true.
- **FR-004**: Core MUST compare the issuance baseline with a fresh observation and accept worktree-only change only when every observed path equals the baseline paths union the exact declared changed paths for that repository.
- **FR-005**: Artifact references MUST remain evidence/baseline inputs and MUST NOT be the implicit source of the mutation envelope.
- **FR-006**: A node without a repository-write allowed effect MUST require an exact repository binding.
- **FR-007**: Canonical root, Git common directory, repository identity, branch, detached state, HEAD, unborn state or Repository Scope change MUST be classified as forbidden repository drift.
- **FR-008**: Revision, Action ID/kind, source cursor, process identity/definition digest and submitted repository binding digest MUST be validated before mutation-envelope adoption.
- **FR-009**: Rejected ordinary apply and recovery apply MUST produce zero Task, event, evidence and claim writes.
- **FR-010**: Successful authorized worktree mutation MUST rebind the Task to the fresh observed component binding before issuing the next Action.
- **FR-011**: Multi-repository apply MUST dispatch scoped changed paths by existing repository key and validate every participating repository atomically.
- **FR-012**: Recovery MUST use the same mutation envelope and repository comparison as ordinary apply; it MUST NOT infer completion from artifact presence alone.
- **FR-013**: Restart/resume MUST preserve the persisted Action and binding semantics and MUST NOT require Task cancellation or recreation for already-produced authorized work.
- **FR-014**: Existing SQLite Task storage shape and repository-claim schema MUST remain unchanged; persisted-data disposition is `not-applicable`.
- **FR-015**: The change MUST NOT alter Node IDs, Transition IDs/destinations/guards, MCP tool names/count, Host activation, release behavior or public versions.
- **FR-016**: Deterministic tests MUST cover REQUIREMENTS, DESIGN/TASKS contract parity, IMPLEMENT, REFACTOR, read-only rejection, branch/HEAD/identity/root drift, stale identities, dirty baseline, multi-repository atomicity and restart/resume.
- **FR-017**: Validation MUST be limited to Repository Binding, Git observer, Action apply, Recovery and direct contract fixtures; full suites, real Host journeys and release checks are forbidden for this Feature.

### Key Entities

- **Repository Binding**: One repository's stable identity facts plus mutable worktree observation and aggregate binding digest.
- **Mutation Envelope**: Closed Action-result facts declaring exact changed paths or exact no-change for the current execution.
- **Repository Scope**: Immutable primary plus ordered additional repositories participating in one Task.
- **Repository Effect Evidence**: Core-derived comparison of the mutation envelope with baseline and fresh observations.

## Non-Goals

- No second repository state machine, Host cursor, actor-attribution system or background watcher.
- No content-level attribution of concurrent writers to any already-dirty baseline path when its Git status
  path membership is unchanged.
- No SQLite Task model, claim schema or migration change.
- No unrelated process, Node, Transition, MCP catalog, Host activation, installer or release change.
- No commit, push, version change, publication or release evidence.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All authorized-write deterministic issuance→edit→apply scenarios complete with the original Action in one apply attempt.
- **SC-002**: Every forbidden binding/stale identity/undeclared-path scenario returns the expected stable error with zero recorded writes.
- **SC-003**: Dirty-baseline and restart/resume scenarios produce zero false repository-drift results.
- **SC-004**: Multi-repository tests prove all authorized component changes commit atomically and any one forbidden component stops the whole mutation.
- **SC-005**: All approved targeted commands pass within the finite Feature budget, with no prohibited broad command executed.

## Assumptions

- Git status and bounded content fingerprint remain the authoritative read-only observation mechanism.
- Exact path-envelope validation is the minimum verifiable boundary; attribution of content-only concurrent
  writes among already-dirty baseline paths is not observable without persisted per-path baselines and is out
  of scope.
- Host integrations read the live closed apply schema before constructing payloads.
- The current repository baseline includes an unrelated untracked Feature 010 directory that this Feature must preserve.
