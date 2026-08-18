# Feature Specification: Close the Open-Task Contract

**Feature Branch**: `007-close-open-task-contract`

**Created**: 2026-08-18

**Status**: Draft

**Input**: Prevent Codex from submitting malformed `dev_flow_open_task.new_task` contracts after two observed failures: an unsupported verification level and list-valued contract fields encoded as strings.

## User Scenarios & Testing

### User Story 1 - Construct a valid new task on the first attempt (Priority: P1)

As a supported host agent, I can discover the complete new-task input contract before opening a task, so I submit list-valued fields and verification levels in the exact form accepted by Core.

**Why this priority**: Task creation is the entry point to every governed workflow. A discoverable but incomplete contract prevents all later product value.

**Independent Test**: Inspect the public open-task contract from each supported host surface, construct one new task using only that contract, and observe that Core creates or resumes the compatible task without an input-contract rejection.

**Acceptance Scenarios**:

1. **Given** a supported host inspects the open-task input contract, **When** it reads `new_task`, **Then** it can identify the exact required members, their types, the closed verification-budget members, and every accepted verification level without consulting repository source.
2. **Given** a host submits `scope`, `out_of_scope`, and `acceptance_criteria` as arrays of strings with verification level `targeted`, **When** it opens a task, **Then** the request passes input-contract validation.
3. **Given** a host follows the packaged Skill guidance, **When** it builds a new-task request, **Then** the guidance uses the same field types and verification-level vocabulary as the public Core contract.

---

### User Story 2 - Reject malformed task contracts before workflow mutation (Priority: P2)

As a host integrator, I receive deterministic contract enforcement for malformed new-task values, so invalid requests cannot create task state and contract drift is caught during validation.

**Why this priority**: Strict rejection protects Core state, while precise published constraints prevent repeated trial-and-error submissions.

**Independent Test**: Submit the two observed malformed request shapes through contract validation and confirm both are rejected without task creation, then confirm the valid equivalent is accepted.

**Acceptance Scenarios**:

1. **Given** a new-task request uses verification level `focused`, **When** it is validated, **Then** it is rejected because the level is outside the published closed vocabulary.
2. **Given** any list-valued task-contract member is encoded as one string, **When** it is validated, **Then** it is rejected because the published member type is an array of strings.
3. **Given** an invalid request is rejected, **When** repository and task state are inspected, **Then** no task mutation is attributable to that request.

---

### User Story 3 - Align the feature delivery version (Priority: P3)

As a maintainer or installer, I see the Feature 007 delivery consistently identified as `0.3.0`
across the current Core and package metadata without rewriting the frozen Feature 006 `v0.1.0`
publication history.

**Why this priority**: Every production feature owns its version increment, and conflicting current
identities make builds and package evidence unreliable.

**Independent Test**: Read all current product version authorities and build the Codex package;
they report `0.3.0`, while Feature 006 Tag, Draft, fixed digests, recovery facts, and historical
publication scenarios remain bound to `0.1.0`.

**Acceptance Scenarios**:

1. **Given** Feature 007 is complete, **When** current product identities are inspected, **Then**
   root `VERSION`, root package, Codex package/plugin, and DeepSeek package all report `0.3.0`.
2. **Given** the current Codex package is built, **When** its launcher and bundled Core report their
   versions, **Then** both report `0.3.0`.
3. **Given** Feature 006 frozen publication evidence, **When** current product identity advances,
   **Then** its `v0.1.0` Tag, Draft, digests, release fixtures, recovery route, and historical
   publication scenarios remain unchanged.

---

### User Story 4 - Publish the completed feature (Priority: P4)

As the maintainer, I can publish the completed `dev-flow-codex@0.3.0` from one clean `main` commit,
verify registry and GitHub assets, exercise the real Codex journey, and finalize one immutable
GitHub Release.

**Why this priority**: The feature delivers user value only after the verified current package is
available through its supported public installation path.

**Independent Test**: Prepare from the exact pushed `main` commit into a durable external release
directory, publish once with explicit `v0.3.0` confirmation, redownload every public artifact, run
the registry-package Codex journey, and observe a complete publication record.

**Acceptance Scenarios**:

1. **Given** a dirty or unpushed source, conflicting remote identity, unavailable ownership, or
   failed validation, **When** publication starts, **Then** it stops before remote mutation.
2. **Given** one clean pushed `main` commit and absent `0.3.0` remote identities, **When** the
   explicit publisher runs, **Then** it creates/reuses only exact matching Tag/Draft state and
   publishes npm at most once.
3. **Given** npm publication succeeds, **When** read-back and the real Codex journey pass, **Then**
   final manifest/checksums and four GitHub assets are verified before the Release becomes public.

### Edge Cases

- `new_task` is omitted or null for an explicit resume request.
- A required list is empty where Core permits emptiness, while acceptance criteria remain non-empty.
- A list contains a non-string value, duplicate JSON member, or unknown member.
- Verification-budget members are missing, added, mistyped, or use different letter casing.
- Codex and DeepSeek expose the shared Core contract through different host packaging surfaces.
- Dependency, MCP client, upgrade/downgrade, mismatch, and frozen release scenario versions are not
  current product version authorities.

## Requirements

### Functional Requirements

- **FR-001**: The public open-task input contract MUST fully describe `new_task` rather than expose it as an unconstrained value.
- **FR-002**: The published `new_task` contract MUST require exactly `goal`, `scope`, `out_of_scope`, `acceptance_criteria`, and `verification_budget`, with no additional members.
- **FR-003**: The published contract MUST define `goal` as text and `scope`, `out_of_scope`, and `acceptance_criteria` as arrays whose members are text.
- **FR-004**: The published verification-budget contract MUST require exactly `level`, `max_automatic_commands`, `allow_full_suite`, and `allow_manual_handoff`, with no additional members.
- **FR-005**: The published verification-level vocabulary MUST contain exactly `minimal`, `targeted`, and `full`.
- **FR-006**: The published numeric and collection constraints MUST remain consistent with the limits enforced by Core.
- **FR-007**: Omitting or explicitly nulling `new_task` MUST remain valid for task resume; providing a new task MUST select the complete new-task contract.
- **FR-008**: Packaged Codex Skill guidance MUST state the list-valued member types and closed verification-level vocabulary and MUST include one structurally valid new-task example.
- **FR-009**: Shared contract fixtures MUST validate the same open-task contract for every supported host; no host adapter may redefine or weaken it.
- **FR-010**: Regression coverage MUST include both observed malformed inputs (`focused` and string-valued lists) plus their valid equivalent.
- **FR-011**: Invalid open-task inputs MUST remain non-mutating and retain the existing closed public error envelope.
- **FR-012**: This feature MUST NOT change workflow transitions, persisted task meaning, the six-tool catalog, recovery classifications, Git behavior, or release/publication state.
- **FR-013**: Feature 007's approved current product version MUST be `0.3.0`.
- **FR-014**: Root `VERSION`, root package, Codex package, Codex plugin, and DeepSeek package metadata MUST all report `0.3.0` before feature completion.
- **FR-015**: Ordinary current-build and current-package tests MUST derive expected version identity from the current authority rather than a stale `0.1.0` or `0.2.0` literal.
- **FR-016**: Feature 006 specifications, Tag `v0.1.0`, Draft identity, fixed artifact digests, recovery evidence, release fixtures, and publication-state scenarios MUST remain unchanged.
- **FR-017**: Historical release fixtures MUST be validated for internal historical consistency independently of the current product version.
- **FR-018**: Version alignment MUST NOT publish npm, create or move a Git tag, mutate a GitHub Release/Draft, regenerate frozen output, or run a release-recovery mutation.
- **FR-019**: After explicit maintainer publication authority, Feature 007 MAY enter a separate final publication phase for `0.3.0`; FR-018 continues to constrain the version-alignment phase itself.
- **FR-020**: Publication MUST originate from one clean pushed `main` commit containing the completed Feature 007 implementation and version identities.
- **FR-021**: Release output names MUST derive from the approved version and MUST NOT expose a stale fixed-version list as current release authority.
- **FR-022**: Preparation MUST use a durable absolute directory outside the repository and produce the exact versioned five-file set for `0.3.0`.
- **FR-023**: The publisher MUST require explicit `v0.3.0` confirmation, verify npm/GitHub ownership and remote absence/exact reuse, and publish npm at most once.
- **FR-024**: Publication MUST complete npm read-back, the real registry-package Codex journey, final manifest/checksums, four GitHub asset read-backs, and GitHub Release finalization before recording completion.
- **FR-025**: Any failure or conflict MUST preserve the durable publication record and stop without moving, deleting, overwriting, or republishing an immutable component.
- **FR-026**: Feature 006 `v0.1.0` Tag, Draft, assets, fixed digests, and recovery evidence MUST remain untouched by the `v0.3.0` publication.

### Key Entities

- **Open-Task Input Contract**: The public closed description of host, repository path, and optional new-task data.
- **New-Task Contract**: Goal, bounded scope lists, acceptance criteria, and verification authority used to create or match one governed task.
- **Verification Budget**: Closed verification level and command/hand-off permissions enforced by Core.
- **Host Guidance**: Packaged instructions that map user intent into the shared Core contract without owning workflow semantics.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All supported host contract fixtures expose identical required members, member types, closed-object rules, and verification-level values for new-task creation.
- **SC-002**: The two observed malformed requests are rejected in automated regression coverage, while the corresponding valid request passes contract validation.
- **SC-003**: A host agent can construct a valid new-task request using only the public tool contract and packaged guidance, with zero repository-source lookup.
- **SC-004**: Contract validation demonstrates zero task-state mutation for every malformed-request regression.
- **SC-005**: The tool count, workflow states, persistence schema, and recovery vocabulary have zero changes.
- **SC-006**: All five current version authorities report `0.3.0` with zero mismatch.
- **SC-007**: The current Codex package build and runtime report `0.3.0`.
- **SC-008**: Feature 006 frozen `0.1.0` Tag, Draft, digest, fixture, recovery, and publication values have zero changes.
- **SC-009**: `dev-flow-codex@0.3.0` is redownloaded from the public npm registry and matches the prepared package.
- **SC-010**: The final real Codex journey reaches `DONE`, removes registration, uninstalls the package, and reopens retained task data.
- **SC-011**: Tag `v0.3.0`, the public GitHub Release, four verified assets, and the complete publication record point to one source identity.
- **SC-012**: No Feature 006 remote or frozen local identity changes during publication.

## Assumptions

- The existing Core field names, value semantics, limits, and accepted verification levels are authoritative and remain unchanged.
- This feature improves contract publication and host guidance; it does not make previously invalid request values valid.
- Codex and DeepSeek share the Core tool contract even where their packaging and real-host delivery timelines differ.
- Existing generic public error text remains intentionally bounded; prevention comes from publishing the complete input contract and testing it.
- Version alignment is a required task inside Feature 007 rather than a separate feature, and it does not authorize publication.
