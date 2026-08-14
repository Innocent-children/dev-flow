# Feature Specification: DeepSeek Explicit Dev Flow

**Feature Branch**: `004-deepseek-explicit-dev-flow`

**Created**: 2026-08-14

**Status**: Planned — blocked by `002` and Core Contract 0.1

**Input**: Package the shared Dev Flow Core as a thin DeepSeek Harness product that starts or
resumes one single-repository task only when the user explicitly invokes `/dev-flow`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install and explicitly invoke Dev Flow in DeepSeek Harness (Priority: P1)

As a DeepSeek Harness user, I can install a `dev-flow-deepseek` bundle into an isolated profile and
invoke `/dev-flow` in an existing Git repository without separately installing another Dev Flow
runtime.

**Why this priority**: Installation must yield one self-contained, bounded host product with no
separate Dev Flow backend prerequisite.

**Independent Test**: Install the final local package artifact into a clean isolated Harness
profile, restart the host, invoke `/dev-flow` in a temporary repository, and verify that the shared
six tools and one Skill are available.

**Acceptance Scenarios**:

1. **Given** a supported Harness profile and packed product artifact, **When** the package is added,
   **Then** one Dev Flow Skill and one local STDIO MCP integration are registered.
2. **Given** the package is installed, **When** ordinary coding work occurs without `/dev-flow`,
   **Then** no Dev Flow task is implicitly created.
3. **Given** the package starts, **When** its Go runtime is absent, incompatible, or not executable,
   **Then** the integration reports a bounded startup diagnostic while the rest of Harness remains
   usable where the host supports nonfatal startup failure.
4. **Given** installation succeeds, **When** the repository is inspected, **Then** no package,
   database, Skill, or Harness profile file has been copied into it.

---

### User Story 2 - Govern and resume a real DeepSeek task (Priority: P2)

As a developer, I can use `/dev-flow` to perform the Core's current action, restart DeepSeek
Harness, and resume the same task until the Core reaches its authoritative terminal outcome.

**Why this priority**: Host integration is complete only when the shared workflow and recovery
semantics survive a real Harness restart.

**Independent Test**: Use the packed product in a real Harness profile to complete a bounded source
change, stop after at least two committed actions, restart Harness, resume the task, respect its
verification budget, and reach `DONE`.

**Acceptance Scenarios**:

1. **Given** no compatible active task, **When** `/dev-flow` is invoked with a substantive
   requirement, **Then** the Skill opens one `host=deepseek` task and follows only the fresh Core
   action.
2. **Given** a compatible active DeepSeek-owned task, **When** the host restarts and `/dev-flow` is
   invoked again, **Then** the same task is resumed.
3. **Given** Harness cannot reliably expose a complete structured Core result directly, **When** a
   projection proxy is used, **Then** it preserves every authority field, stable error code, and
   complete result while adding no workflow decision.
4. **Given** a mutation response is lost, previewed, spilled, pruned, truncated, or uncertain,
   **When** the Skill continues, **Then** it obtains the complete result or rereads task/next-action
   authority before retry.
5. **Given** a terminal outcome, **When** the Skill reports completion, **Then** it reports the Core
   outcome rather than a Harness-specific completion rule.

---

### User Story 3 - Remove the DeepSeek product without deleting task data (Priority: P3)

As a user, I can remove the package from its Harness profile without deleting shared task data or
changing any repository.

**Why this priority**: Profile dependencies and user task data are separate authorities.

**Independent Test**: Pause or complete one task, remove the package by product identity, verify the
profile no longer exposes the Skill/tools, and verify task data remains present.

**Acceptance Scenarios**:

1. **Given** an installed package, **When** Harness removes it, **Then** only the profile dependency
   and product-owned bundle layer are removed.
2. **Given** retained task data, **When** a compatible package is reinstalled, **Then** the same
   DeepSeek-owned active task can be resumed.
3. **Given** the Codex product is also installed, **When** DeepSeek is removed, **Then** Codex files,
   runtime selection, and task data are unaffected.

## Edge Cases

- Harness changes its bundle/patch API before implementation begins.
- Direct MCP results are sufficient and no projection proxy is needed.
- The projection proxy starts but its Core child exits before MCP initialization.
- Harness displays only a preview while full canonical text is stored elsewhere.
- Package resolution occurs from a composed profile path rather than project root.
- Another host owns the repository claim.
- The profile has a custom home directory.
- The repository path contains spaces, Unicode, or symlinks.
- Harness restarts while a mutation response is in flight.
- Package removal succeeds but host cache still displays stale Skill metadata.

## Scope Boundaries

### In Scope

- one DeepSeek Harness product package;
- one explicit `/dev-flow` Skill;
- one Harness bundle/profile integration;
- shared Go Core runtime included or selected by the product package;
- local STDIO only;
- an optional minimal TypeScript projection proxy only when proven necessary;
- exact six-tool allowlist;
- task create/resume/apply/read-after-write loop;
- profile-scoped install/remove;
- one fake Core/package contract suite;
- one real Harness restart/resume/removal journey on the declared platform.

### Out of Scope

- a separately installed Dev Flow backend or executable;
- alternate Core backends or task data import/export;
- implicit activation;
- custom Harness UI, panel, settings screen, command family, or agent preset;
- proxy-side state, transition, recovery, or completion logic;
- generic shell MCP;
- multiple repositories;
- cross-host takeover;
- Git management;
- network transport, OAuth, telemetry, or remote service;
- public npm/GitHub publication;
- automatic update;
- Windows or Linux support claims without real evidence.

## Requirements *(mandatory)*

### Functional Requirements

#### Package and Harness Integration

- **FR-001**: The product identity MUST be `dev-flow-deepseek`; public scope and publication
  identity remain deferred to feature `006`.
- **FR-002**: The package MUST contain or select a compatible shared Go Core runtime and MUST NOT
  require a separately installed Dev Flow Core runtime.
- **FR-003**: The package MUST use the then-current supported Harness bundle/profile mechanism and
  MUST pin the exact Harness compatibility baseline in its plan and final evidence.
- **FR-004**: The bundle MUST register one Skill provider and one local STDIO MCP integration.
- **FR-005**: Package installation MUST NOT run an install-time source build or mutate repositories,
  shared task data, or unrelated profiles.
- **FR-006**: Package removal MUST be achievable by product identity through the supported Harness
  profile mechanism and MUST preserve task data.
- **FR-007**: The package MUST use a dedicated, closed child environment and MUST not forward the
  entire host environment to the Core or proxy child.
- **FR-008**: Startup failure MUST be bounded and non-secret; where Harness supports it, the Dev
  Flow integration failure MUST not make unrelated Harness use impossible.

#### Skill and Authority

- **FR-009**: The package MUST expose exactly one user-facing Skill named `dev-flow`.
- **FR-010**: The Skill MUST activate only through explicit `/dev-flow` invocation.
- **FR-011**: The Skill MUST reject empty/conversational invocation and non-Git execution before
  task creation.
- **FR-012**: The Skill MUST resolve exactly one current Git worktree and reject multi-repository
  requirements.
- **FR-013**: The Skill MUST verify the compatible Core Contract through
  `dev_flow_server_info` before discovery or mutation.
- **FR-014**: The host-facing surface MUST expose exactly the six Core Contract tools and no generic
  forwarding surface.
- **FR-015**: The Skill MUST use fresh Core action, binding, payload schema, allowed effects,
  evidence requirements, recovery, and outcome as authority.
- **FR-016**: The Skill and proxy MUST NOT encode a state machine, action catalog, transition rule,
  repository claim rule, error reinterpretation, or terminal rule.
- **FR-017**: New tasks MUST use `host=deepseek`; same-host compatible tasks resume and another
  host's task conflicts.

#### Optional Projection Proxy

- **FR-018**: A projection proxy MAY exist only after the plan proves direct Harness consumption
  cannot preserve complete authoritative results.
- **FR-019**: When used, the proxy MUST forward live tool schemas, enforce the six-tool allowlist,
  preserve structured success/domain-error semantics, and render complete deterministic text where
  the host requires it.
- **FR-020**: The proxy MUST use no shell, open no listening socket, persist no state, and initiate
  no network request.
- **FR-021**: The proxy MUST propagate cancellation and close its child and outward MCP transports
  deterministically.
- **FR-022**: Invalid or incomplete upstream results MUST become a stable adapter error without
  fabricating task authority.

#### Resume and Verification

- **FR-023**: The Skill MUST retrieve a complete result when Harness presents a preview, spill,
  prune, or truncation marker before using authority fields.
- **FR-024**: An uncertain mutation MUST trigger task/next-action read-back before retry.
- **FR-025**: Verification evidence MUST respect the Core budget and accurately distinguish
  automated, manual, simulated, and unverified checks.
- **FR-026**: A fake Core suite MUST verify package composition, tool allowlist, complete result
  handling, cancellation, startup failure, and read-before-retry behavior.
- **FR-027**: One real Harness journey MUST use the final packed artifact, perform a real source
  change, restart/resume, reach `DONE`, and remove the package.
- **FR-028**: The real journey MUST record exact Harness package/build, profile, OS/architecture,
  package digest, Core version, proxy presence, skips, and retained task data.

### Key Entities

- **DeepSeek Product Package**: Installable Harness bundle containing host resources and compatible
  Core runtime.
- **Harness Profile Integration**: Product-owned bundle layer that registers Skill and MCP.
- **Projection Proxy**: Optional non-authoritative compatibility process.
- **DeepSeek Journey Evidence**: Exact real-host evidence for one final package artifact.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A supported user can add the packed product to an isolated Harness profile without an
  external Dev Flow prerequisite.
- **SC-002**: An ordinary request without `/dev-flow` creates zero tasks.
- **SC-003**: The host-facing MCP catalog contains exactly the six shared Core tools.
- **SC-004**: The real journey crosses at least two committed actions, restarts Harness, resumes the
  same task lineage, and reaches `DONE`.
- **SC-005**: When a proxy is required, its source contains zero task writes and zero transition or
  completion decisions.
- **SC-006**: The real journey stays within the task's automatic verification budget.
- **SC-007**: Package removal preserves task data and does not affect an installed Codex product.
- **SC-008**: The package and real-host report claim support only for the exact verified Harness
  baseline and platform.

## Assumptions

- Feature `002` has frozen Core Contract 0.1 and shared fixtures.
- Initial real-host evidence is expected on macOS arm64.
- Harness integration contracts are pre-release or evolving and must be revalidated during plan.
- Direct Core MCP consumption is preferred; a proxy is justified only by observed host behavior.
- Public publication and multi-platform runtime packages belong to feature `006`.
