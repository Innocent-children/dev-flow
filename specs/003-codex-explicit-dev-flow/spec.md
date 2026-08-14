# Feature Specification: Codex Explicit Dev Flow

**Feature Branch**: `003-codex-explicit-dev-flow`

**Created**: 2026-08-14

**Status**: Planned — blocked by `002` and Core Contract 0.1

**Input**: Package the shared Dev Flow Core as a thin Codex product that starts or resumes one
single-repository task only when the user explicitly invokes `$dev-flow`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install and explicitly invoke Dev Flow in Codex (Priority: P1)

As a Codex user, I can install a local `dev-flow-codex` package, complete an explicit setup step,
and invoke `$dev-flow` in an existing Git repository without editing that repository.

**Why this priority**: The product has no value in Codex until installation and explicit activation
work as one bounded journey.

**Independent Test**: Install the final local package artifact in a clean Codex test environment,
run its documented setup, start a new Codex task in a temporary Git repository, invoke `$dev-flow`
with a substantive requirement, and verify that exactly the shared six-tool surface is available.

**Acceptance Scenarios**:

1. **Given** a supported Codex environment and a packed product artifact, **When** the user performs
   the documented setup, **Then** one Dev Flow Skill and one local STDIO MCP server are registered.
2. **Given** an ordinary coding request without `$dev-flow`, **When** Codex receives the request,
   **Then** this feature does not require or claim implicit Dev Flow activation.
3. **Given** an explicit `$dev-flow` invocation in a non-Git directory or without a substantive
   requirement, **When** the Skill begins, **Then** it stops before creating a task and explains the
   missing precondition.
4. **Given** setup completes, **When** the target repository is inspected, **Then** no plugin,
   configuration, task database, or generated instruction file has been added to it.

---

### User Story 2 - Govern and resume a real Codex task (Priority: P2)

As a developer, I can let Codex execute the shared Core's current action, close Codex mid-task,
open a new Codex session, and resume the same task until its authoritative terminal outcome.

**Why this priority**: The host adapter must prove the product's defining governance and recovery
capabilities rather than only expose tools.

**Independent Test**: Use the packed product in a real Codex host to complete a bounded source
change, stop after at least two committed workflow actions, restart Codex, resume the exact task,
respect its verification budget, and reach `DONE`.

**Acceptance Scenarios**:

1. **Given** no compatible active task, **When** `$dev-flow` is invoked with a new requirement,
   **Then** the Skill opens one `host=codex` task and follows only the returned current action.
2. **Given** a compatible active Codex-owned task, **When** `$dev-flow` is invoked after restart,
   **Then** the Skill resumes it rather than creating or merging another task.
3. **Given** a mutation response is missing or uncertain, **When** the Skill continues, **Then** it
   reads the authoritative task and fresh next action before considering a retry.
4. **Given** the task verification budget forbids a full suite or limits automatic commands,
   **When** Codex reaches verification, **Then** it does not exceed that budget and lists allowed
   manual handoff items honestly.
5. **Given** the Core returns a terminal outcome, **When** the Skill reports completion, **Then** it
   uses that outcome and does not invent a separate Codex completion rule.

---

### User Story 3 - Remove the Codex product without deleting task data (Priority: P3)

As a user, I can remove the Codex registration and product package without deleting Dev Flow task
history or changing any repository.

**Why this priority**: Package lifecycle must have a clear authority boundary from user task data.

**Independent Test**: Complete or pause one task, remove the Codex product through the documented
command, verify that Skill/MCP registration is absent, task data remains byte-for-byte present, and
the repository is unchanged.

**Acceptance Scenarios**:

1. **Given** an installed Codex product, **When** explicit removal runs, **Then** only product-owned
   Codex registration and package files are removed.
2. **Given** retained task data, **When** the product is installed again at a compatible version,
   **Then** the same Codex-owned task can be discovered subject to the Core contract.
3. **Given** unknown or user-owned files near the registration target, **When** removal runs,
   **Then** they are preserved and reported rather than recursively deleted.

## Edge Cases

- Codex was restarted before the plugin/Skill registry refreshed.
- The package is installed but its platform runtime is missing or not executable.
- The MCP server writes an unexpected line to stdout before protocol initialization.
- Another host owns the repository claim.
- Several Codex sessions or task records exist, but only one active Dev Flow task may match the repository.
- The current working directory is a subdirectory of the worktree.
- The repository path contains spaces, Unicode, or symlinks.
- The Skill receives a truncated tool preview instead of the complete structured result.
- Codex loses the response after a committed `apply_action`.
- Removal is interrupted after registration removal but before package cleanup.
- Workspace policy makes a local plugin visible but unavailable to the current role.

## Scope Boundaries

### In Scope

- one Codex product package;
- one Codex Skill named `dev-flow`;
- explicit `$dev-flow` only;
- one local STDIO registration pointing directly to the packaged Go Core;
- package-local or package-selected platform runtime;
- explicit setup and removal;
- shared task data location owned by the Core;
- exact six-tool contract;
- task create/resume/apply/read-after-write loop;
- one fake-runtime contract test;
- one real Codex restart/resume journey on the declared platform.

### Out of Scope

- implicit activation;
- target-repository `AGENTS.md` edits;
- Node projection proxy for Codex;
- duplicated state machine or error logic;
- alternate Codex registration mechanisms beyond the selected supported surface;
- task data import/export;
- multiple repositories;
- cross-host takeover;
- Git management;
- commit, push, PR, Tag, or Release actions;
- Web UI;
- public npm/GitHub publication;
- automatic update;
- workspace-admin automation;
- Windows or Linux support claims without separate evidence.

## Requirements *(mandatory)*

### Functional Requirements

#### Product Package and Setup

- **FR-001**: The product identity MUST be `dev-flow-codex`; its public npm scope and publication
  identity remain deferred to feature `006`.
- **FR-002**: The package MUST contain or select a compatible build of the shared Go Core and MUST
  NOT require a separately installed Dev Flow Core runtime.
- **FR-003**: Installation of the npm/package artifact MUST NOT use `postinstall`, `preinstall`, or
  another lifecycle hook to modify Codex configuration, a repository, or task data.
- **FR-004**: Codex registration MUST require one explicit setup/import action initiated by the
  user through the currently supported Codex plugin mechanism.
- **FR-005**: Setup MUST verify product version, runtime executability, Skill presence, MCP
  configuration, and read-back of the resulting registration before reporting success.
- **FR-006**: Setup MUST NOT copy Core source code or task data into the target repository.
- **FR-007**: Removal MUST be explicit, bounded to recorded product-owned files/registration, and
  preserve task data and repository content.
- **FR-008**: The implementation plan MUST revalidate the then-current official Codex plugin/Skill
  packaging contract; this specification does not freeze unstable manifest field names.

#### Skill and Authority

- **FR-009**: The package MUST expose exactly one user-facing Skill named `dev-flow`.
- **FR-010**: The Skill MUST activate only through explicit `$dev-flow` invocation in this feature.
- **FR-011**: The Skill MUST reject an empty or conversational invocation before opening a task.
- **FR-012**: The Skill MUST resolve one current Git worktree and MUST reject a requirement that
  needs another repository.
- **FR-013**: The Skill MUST call `dev_flow_server_info` before task discovery and require the
  package's compatible Core Contract.
- **FR-014**: The Skill MUST expose and use only the six tools frozen by Core Contract 0.1.
- **FR-015**: The Skill MUST treat fresh Core results as the sole authority for action identity,
  payload schema, allowed effects, required evidence, recovery, and terminal outcome.
- **FR-016**: The Skill MUST NOT encode a transition table, action payload catalog, error-code
  reinterpretation, or alternate completion test.
- **FR-017**: Ordinary Codex repository tools MAY be used only to perform the current authorized
  action; no generic shell MCP tool may be added.
- **FR-018**: The Skill MUST preserve repository instructions and user authority boundaries while
  following Core guidance.

#### Resume and Evidence

- **FR-019**: New tasks MUST be opened with `host=codex`.
- **FR-020**: A compatible active Codex-owned task MUST be resumed; a different contract or another
  host's claim MUST stop with the Core's conflict.
- **FR-021**: After every successful mutation, the Skill MUST continue from the returned next
  action or perform one fresh read before further work.
- **FR-022**: After a missing, cancelled, malformed, truncated, or uncertain mutation result, the
  Skill MUST read task and next-action state before deciding whether retry is safe.
- **FR-023**: The Skill MUST submit evidence sources and verification command counts accurately and
  MUST NOT relabel manual or simulated checks as automated evidence.
- **FR-024**: The Skill MUST stop when the Core returns `BLOCKED`, `DONE`, or `CANCELLED` and report
  the authoritative unblock condition or outcome.

#### Verification

- **FR-025**: Package contract tests MUST verify manifest/Skill/MCP composition, no hidden install
  mutation, and no embedded workflow implementation.
- **FR-026**: A fake Core test MUST prove tool mapping, closed argument forwarding, complete result
  handling, and read-before-retry behavior without claiming real Codex evidence.
- **FR-027**: One real Codex journey MUST use the final packed artifact, perform a real repository
  change, restart the host, resume, respect verification budget, and remove the product.
- **FR-028**: The real journey MUST record exact Codex build/surface, OS/architecture, package
  digest, Core version, skips, failures, and retained data location.

### Key Entities

- **Codex Product Package**: Installable unit containing the Codex-specific Skill/registration and a
  compatible Core runtime.
- **Codex Skill**: Thin workflow guidance that routes explicit `$dev-flow` use to Core tools.
- **Codex Registration Receipt**: Bounded evidence identifying product-owned registration/files for
  setup read-back and safe removal.
- **Codex Journey Evidence**: Exact real-host evidence for one final package artifact.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A supported user can install the packed product and complete setup without editing a
  repository or global MCP configuration manually.
- **SC-002**: An ordinary request without `$dev-flow` creates zero Dev Flow tasks.
- **SC-003**: Explicit invocation creates or resumes exactly one Codex-owned task for the current
  repository.
- **SC-004**: The real journey crosses at least two committed workflow actions, restarts Codex,
  resumes the same task ID/revision lineage, and reaches `DONE`.
- **SC-005**: The real journey performs no automatic verification command beyond its task budget.
- **SC-006**: Codex-specific source contains zero task-state writes and zero transition decisions.
- **SC-007**: Removal leaves task data present and leaves the test repository fingerprint unchanged
  except for the intentional task implementation.
- **SC-008**: The package test and real-host report make no support claim beyond the exact verified
  Codex surface and platform.

## Assumptions

- Feature `002` has frozen Core Contract 0.1 and shared fixtures.
- Initial real-host evidence is expected on macOS arm64.
- The Codex plugin mechanism may evolve; the implementation plan must revalidate the official
  current behavior and avoid freezing unstable manifest fields in this specification.
- Public publication and multi-platform package selection belong to feature `006`.
