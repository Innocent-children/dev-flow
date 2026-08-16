# Feature Specification: Codex Explicit Dev Flow

**Feature Branch**: `003-codex-explicit-dev-flow`

**Created**: 2026-08-14

**Status**: Merge preparation — four native regressions closed and repeatable development smoke
passed twice; **NO-GO** until the final acceptance journey passes
**Input**: Package the shared Dev Flow Core as a thin Codex product that starts or resumes one
single-repository task only when the user explicitly invokes `$dev-flow-codex:dev-flow`.

## User Scenarios & Testing

### User Story 1 — Install and explicitly invoke Dev Flow in Codex (P1)

As a Codex user, I can install a local `dev-flow-codex` package, complete explicit setup, and invoke
`$dev-flow-codex:dev-flow` in an existing Git repository without modifying that repository during
setup.

**Independent test**: Build the package, run setup/readback against isolated host state, verify that
an ordinary prompt makes zero Dev Flow calls, then explicitly select the installed Skill and observe
the six-tool handshake.

**Acceptance scenarios**:

1. Setup registers exactly one owned plugin/Skill and one STDIO MCP server, and readback confirms it.
2. An ordinary prompt without the full selector makes zero Dev Flow calls and creates zero tasks.
3. Bare `$dev-flow`, a wrong namespace/base, an empty requirement, or a non-Git directory is rejected
   before task creation.
4. Setup does not add plugin, task-data, configuration, or instruction files to the target repository.

### User Story 2 — Govern and resume a Codex task (P2)

As a developer, I can let Codex follow the Core's current action, restart the host, resume the same
task, and continue until the Core returns an authoritative terminal outcome.

**Independent test**: The deterministic Core-loop layer proves create/apply/restart/resume/DONE.
One final pre-merge acceptance journey repeats that flow in a real supported Codex host.

**Acceptance scenarios**:

1. With no compatible task, explicit invocation opens exactly one `host=codex` task.
2. After restart, explicit invocation resumes the compatible task rather than creating another.
3. After an uncertain mutation, the Skill reads task state and next action before retrying.
4. Core domain errors remain distinguishable from host transport failures.
5. `BLOCKED`, `DONE`, and `CANCELLED` come only from fresh Core results.

### User Story 3 — Remove without deleting task data (P3)

As a user, I can remove the Codex registration and package while retaining Dev Flow task history and
repository content.

**Independent test**: Setup in isolated state, remove twice, verify product-owned registration is
gone, task data is byte-identical, and a compatible reinstall can discover it.

## Scope Boundaries

### In Scope

- one private `dev-flow-codex` package with one selected compatible Core runtime;
- explicit setup, readback, removal, and compatible reinstall;
- one Skill with base name `dev-flow`, selected as `$dev-flow-codex:dev-flow` in Codex 0.147;
- one direct local STDIO MCP registration exposing exactly the six Core Contract 0.1 tools;
- Core-authoritative create/apply/read-after-uncertainty/restart/resume/terminal handling;
- deterministic package, lifecycle, Skill, Core-loop, parser, and native-smoke test layers;
- three sanitized Codex 0.147 JSONL fixtures for success, Core-domain-error, and transport-error
  terminal item shapes;
- a repeatable development smoke that does not create permanent attempt state;
- one final real-host acceptance journey immediately before merge approval.

### Deferred to a Release/Supply-Chain Feature

The following are explicitly not Feature 003 completion conditions:

- immutable native-attempt ledgers or permanent consumption of failed attempts;
- one launch per frozen validation/artifact chain and pass-lock admission;
- validation-report, artifact-report, ledger, and evidence digest chains;
- cross-file evidence/ledger crash transactions;
- diagnostic v1/v2/v3/v4 compatibility matrices;
- evidence-path fsync, inode/device identity, and TOCTOU protocols;
- 64 MiB stdout/stderr digest-boundary matrices;
- exact shell-rendering matrices beyond the three checked-in host-shape fixtures;
- release-grade provenance or canonical passing-evidence publication.

Public release, npm publication, Windows/Linux support claims, multi-repository orchestration,
cross-host takeover, Git mutation, and a Web UI also remain out of scope.

## Functional Requirements

### Package and Lifecycle

- **FR-001**: Product identity MUST be `dev-flow-codex`; public publication identity is deferred.
- **FR-002**: The package MUST contain or select a compatible Core runtime and MUST NOT require a
  separately installed Dev Flow Core.
- **FR-003**: Package installation MUST NOT use lifecycle hooks to mutate Codex, a repository, or
  task data.
- **FR-004**: Registration MUST require one explicit user-initiated setup/import action.
- **FR-005**: Setup MUST verify version, runtime executability, Skill policy, MCP configuration, and
  registration readback before reporting success.
- **FR-006**: Setup MUST NOT copy Core source or task data into the target repository.
- **FR-007**: Removal MUST be bounded to recorded product-owned state and preserve task data and
  repository content.
- **FR-008**: The supported Codex line and packaging surface MUST be recorded from official sources;
  the implementation baseline is Codex CLI 0.147 on macOS arm64.

### Skill and Authority

- **FR-009**: The package MUST expose exactly one user-facing Skill with base name `dev-flow`.
- **FR-010**: Codex 0.147 MUST select that Skill only with `$dev-flow-codex:dev-flow`; bare, wrong,
  missing, or implicit selection MUST create zero Dev Flow calls and tasks.
- **FR-011**: Empty or conversational invocation MUST stop before opening a task.
- **FR-012**: The Skill MUST resolve one current Git worktree and reject work requiring another
  repository.
- **FR-013**: The Skill MUST call `dev_flow_server_info` before discovery and require the compatible
  Core Contract.
- **FR-014**: Only the six Core Contract 0.1 tools may be exposed and used.
- **FR-015**: Fresh Core results are the sole authority for task/action identity, effects, payload,
  evidence requirements, recovery, conflicts, blockers, and terminal outcomes.
- **FR-016**: The adapter and Skill MUST NOT implement a transition table, payload catalog, Core
  error reinterpretation, or independent completion test.
- **FR-017**: Ordinary host repository tools may be used only for the current Core-authorized action;
  no generic shell MCP proxy may be added.
- **FR-018**: Repository instructions and user authority boundaries remain in force while the Skill
  follows Core guidance.

### Core Loop

- **FR-019**: New tasks MUST be opened with `host=codex`.
- **FR-020**: A compatible active Codex task MUST be resumed; incompatible or foreign claims stop
  with the Core conflict.
- **FR-021**: After a successful mutation, continuation MUST use the returned next action or one
  fresh read before further work.
- **FR-022**: After a missing, cancelled, malformed, truncated, or uncertain mutation result, the
  Skill MUST read task and next action, in that order, before considering another mutation.
- **FR-023**: Evidence labels and verification counts MUST describe what actually ran; fake/static
  checks MUST NOT be presented as real-host evidence or Core `DONE`.
- **FR-024**: The Skill MUST stop on Core `BLOCKED`, `DONE`, or `CANCELLED` and report the Core's
  outcome or unblock condition.

### Verification

- **FR-025**: Package contracts MUST cover the package allowlist, explicit setup/readback,
  explicit-only Skill policy, six-tool MCP composition, and absence of embedded workflow authority.
- **FR-026**: Deterministic Core-loop tests MUST cover closed forwarding, complete results,
  create/apply/restart/resume/DONE, Core-domain error, transport error, and removal retention without
  claiming native-host evidence.
- **FR-027**: A development smoke MUST be safely repeatable, use no permanent attempt ledger or
  canonical evidence path, and report only ephemeral session observations. It MUST never be treated
  as final acceptance evidence.
- **FR-028**: Immediately before merge approval, one real Codex acceptance journey MUST use the
  reviewed package and supported host to prove ordinary-prompt isolation, exact explicit selection,
  six-tool handshake, create/apply/restart/resume/DONE, domain/transport distinction, and retained
  task data after removal. A failed run keeps Feature 003 at NO-GO but does not permanently consume
  a chain.

## Closed Native Regression Cases

These four native result-handling cases are closed by implementation and one minimum regression
test each. Feature readiness still requires the separate final real Codex acceptance journey.

| ID | Closed scenario |
|---|---|
| **HIGH-1 diagnostic precedence** | An unrecovered failed MCP item must retain MCP-specific diagnostic priority even when later journey-summary checks also fail. |
| **HIGH-2 Core envelope closure** | A complete-looking Core result with missing, extra, or mismatched envelope identity must be rejected as non-authoritative. |
| **HIGH-3 failed event/recovery binding** | Every recoverable failed event must bind exactly to its later task read, next-action read, and mutation on the same task/revision lineage. |
| **HIGH-4 aggregate/session MCP fact parity** | Aggregate MCP facts must be the exact ordered projection of the four session-level call facts, including zero-call ordinary/invalid sessions. |

## Development Smoke Status

On 2026-08-16, two fresh isolated Codex 0.147 development-smoke runs passed with distinct task IDs.
Each run proved ordinary/invalid zero-call admission, exact explicit selection, the six-tool
handshake, create/apply/restart/resume/DONE, successful removal readback, and direct retained-task
reopen. These repeatable development observations satisfy FR-027 but do not satisfy FR-028.

## Success Criteria

- **SC-001**: Setup/readback succeeds in isolated state without target-repository edits.
- **SC-002**: Ordinary, bare, wrong, missing, and invalid invocations create zero Dev Flow calls and
  tasks.
- **SC-003**: Explicit invocation creates or resumes exactly one Codex-owned task for the repository.
- **SC-004**: The final acceptance journey crosses committed actions, restarts, resumes the same task
  lineage, and reaches Core `DONE`.
- **SC-005**: Automatic verification stays within the Core-provided budget and is labelled honestly.
- **SC-006**: Codex-specific product source contains zero task-state writes and transition decisions.
- **SC-007**: Removal preserves task data and all repository content except the intended task change.
- **SC-008**: Compatibility claims are limited to the host/version/platform actually exercised;
  repeatable smoke output is not release provenance.

## Assumptions

- Feature 002 supplies Core Contract 0.1 and the shared fixtures.
- The current implementation baseline is Codex CLI 0.147 on macOS arm64.
- The three sanitized JSONL fixtures are derived from that host contract and contain no prompt,
  source, user path, environment, token, or secret.
- Feature 003 remains NO-GO until the final real-host acceptance journey passes.
