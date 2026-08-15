# Feature Specification: Codex Explicit Dev Flow

**Feature Branch**: `003-codex-explicit-dev-flow`

**Created**: 2026-08-14

**Status**: Planned — ready for implementation review; Core Contract 0.1 and shared fixtures are
available from completed feature `002`

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
- The final runner receives a missing, non-final, digest-mismatched, or wrong-source artifact before
  any Codex process starts.
- The MCP server writes an unexpected line to stdout before protocol initialization.
- Direct Core reopen emits a non-JSON line, an unknown response ID, a duplicate response, or
  unbounded stdout/stderr instead of the exact bounded JSON-RPC exchange.
- Two setup processes race and one observes an already-added marketplace that it does not own.
- A copied, malformed, live-owner, or dead-owner attempt-ledger lock is encountered after a crash.
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
- one passing real Codex restart/resume journey on the declared platform, with failed native
  attempts tracked separately and never promoted into support evidence.

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
- **FR-005**: Setup MUST verify product version, runtime executability, Skill presence and
  explicit-invocation policy, MCP configuration, and read-back of the resulting registration
  before reporting success.
- **FR-006**: Setup MUST NOT copy Core source code or task data into the target repository.
- **FR-007**: Removal MUST be explicit, bounded to recorded product-owned files/registration, and
  preserve task data and repository content.
- **FR-008**: The implementation plan MUST revalidate the then-current official Codex plugin/Skill packaging contract, define a minimum supported Codex version and compatible range, and exercise the latest stable Codex available during implementation. This specification does not freeze unstable manifest field names or require exact patch-version equality.

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
  Skill MUST read task and next-action state, in that order, before deciding whether another
  mutation is safe. The native restart boundary MUST prove that the new session performs those two
  reads before any later `apply_action`.
- **FR-023**: The Skill MUST submit evidence sources and verification command counts accurately and
  MUST NOT relabel manual or simulated checks as automated evidence. Native support evidence MUST
  derive the verification budget and authoritative terminal task phase from complete Core results,
  record every official completed `command_execution` event as command/exit/status/output-digest
  facts, and reconcile those facts with the exact automated evidence submitted to and retained by
  Core. A completed host process or free-form agent statement MUST NOT substitute for Core `DONE`.
- **FR-024**: The Skill MUST stop when the Core returns `BLOCKED`, `DONE`, or `CANCELLED` and report
  the authoritative unblock condition or outcome.

#### Verification

- **FR-025**: Package contract tests MUST verify manifest/Skill/explicit-policy/MCP composition, no
  hidden install mutation, and no embedded workflow implementation.
- **FR-026**: A fake Core test MUST prove tool mapping, closed argument forwarding, complete result
  handling, and read-before-retry behavior without claiming real Codex evidence.
- **FR-027**: The one passing real Codex journey MUST use the final packed artifact, perform a real
  repository change, restart the host, resume, respect verification budget, and remove the product. A
  checked-in runner for that journey MUST be implemented and contract-tested without starting
  Codex before source freeze; only T058 may execute its native-host mode. Each frozen-source,
  validation-report, and final-artifact chain MUST permit at most one native launch. A failed or
  blocked attempt MUST invalidate that chain's artifact/evidence and MUST NOT be rerun for debugging;
  another attempt requires a source fix and a wholly new T055–T057 chain. Its four Codex executions
  MUST have four distinct nonempty thread IDs; raw task observations MUST be monotonic before only
  adjacent equal revisions are collapsed. Setup and reinstall readback MUST observe exactly one
  owned marketplace, exactly one installed owned plugin, and zero available entries. Direct Core
  reopen MUST reject protocol contamination, unknown/duplicate response IDs, and bounded-output
  violations.
- **FR-028**: The real journey runner MUST atomically create the single native evidence record from
  observed host events and lifecycle/data/repository measurements. The record MUST include exact
  Codex build/surface, OS/architecture, frozen source and package digest, Core version, the closed
  validation/artifact report digests, artifact build time, actual native-attempt count, skips,
  failures, and retained data location; it MUST NOT depend on manual JSON creation or repair. Only
  the unique passing attempt may establish support. A native attempt MUST reserve and permanently
  consume its chain in the one durable ledger before host spawn. That same ledger path/identity MUST
  be reused across every attempt and recovery. For a passing attempt, the runner MUST durably prepare the
  observed facts, exact final evidence bytes, and exact final ledger bytes/digest; atomically publish
  the evidence with create-no-replace semantics only after the exact candidates pass full structural
  and semantic validation, then atomically finalize the ledger as `pass`.
  Valid passing evidence MUST immediately block every host launch even if the ledger is still
  reserved. Recovery after evidence publication may only validate that evidence and idempotently
  install the precomputed exact final ledger bytes; recovery before evidence publication MUST NOT
  relaunch the host or promote the attempt to passing. The canonical repository evidence path MUST
  contain only the unique passing record. Failed/blocked diagnostics MUST remain in the external
  recovery directory as independently closed diagnostic records with the ledger as attempt
  authority and MUST NOT occupy or masquerade as that canonical path. Before admission and again
  while holding the reservation lock, the runner MUST validate sequential attempt numbers, unique
  chain/source identities, terminal-field/status consistency, at most one final passing entry, and
  a single unresolved final reservation. Every ledger replacement MUST re-read and compare the
  expected bytes while holding a closed owner lock; only a syntactically valid lock whose recorded
  process is definitely dead may be recovered as stale. Native evidence MUST identify the retained
  data directory only through a closed non-secret descriptor containing its isolation kind,
  workspace-relative name, and canonical-path digest; it MUST NOT serialize the absolute data path.

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
- **SC-004**: The passing real journey crosses at least two committed workflow actions, restarts Codex,
  resumes the same task ID/revision lineage, and reaches `DONE`.
- **SC-005**: The passing real journey performs no automatic verification command beyond its task budget.
- **SC-006**: Codex-specific source contains zero task-state writes and zero transition decisions.
- **SC-007**: Removal leaves task data present and leaves the test repository fingerprint unchanged
  except for the intentional task implementation.
- **SC-008**: The package test and real-host report claim only the documented Codex compatibility
  range and platforms with real evidence; the report records the actual tested version and total
  native-attempt count without limiting support to that single patch or treating failed attempts as
  support.

## Assumptions

- Feature `002` has delivered Core Contract 0.1 and the shared fixtures on `main`.
- Initial real-host evidence is expected on macOS arm64.
- The Codex plugin mechanism may evolve; the implementation plan must revalidate official current behavior, define a minimum compatible host version, and avoid freezing unstable manifest fields or exact patch versions in this specification.
- Public publication and multi-platform package selection belong to feature `006`.
