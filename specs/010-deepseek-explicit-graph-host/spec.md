# Feature Specification: DeepSeek Explicit Graph Host

**Feature Branch**: `010-deepseek-explicit-graph-host`
**Created**: 2026-08-20
**Status**: Ready
**Input**: Implement the current Dev Flow graph Core as an explicit-only DeepSeek Harness product
without copying Core authority into the adapter.

## Feature 010 Simplification Revision

The Product Contract remains unchanged. Final acceptance uses one repeatable non-model Preflight,
one bounded native Journey, one minimal sanitized Evidence record, and CI for the exact acceptance
commit. Historical native failures remain retained evidence and do not authorize or block execution
through Attempt numbers.

Product Source Identity covers only the files packed into the DeepSeek Artifact. Acceptance Harness
Identity covers the Runner, Evidence validation, Feature documents, and current PR commit. Harness
changes do not invalidate an Artifact whose Product Source bytes and recorded digests still match.

Native acceptance proves only behavior that requires a real DSH Agent: ordinary zero dispatch, the
exact six-tool handshake, one interrupted restart/resume, one smallest successful graph path with an
explicit comprehension verdict, and one remove/reinstall readback. Deterministic journeys own
negative graph branches, uncertain-mutation recovery variants, comprehension rejection, and
refactor/retest. Lifecycle tests own repeated-removal and exhaustive retention cases. The native
Journey does not repeat those lower-layer responsibilities.

## Problem Statement

The repository already has a complete graph Core and a functioning Codex product. The DeepSeek
package, however, is only a stale placeholder, and Feature 004 describes an earlier Core and earlier
Harness surface.

A current DeepSeek product must solve three distinct problems:

1. install and remove through DSH's supported profile-bundle mechanism;
2. project the current Core Contract 0.2 loop into one user-invoked Skill;
3. enforce explicit invocation even though official MCP-client tools remain ordinary model tools.

The third problem is an authority boundary, not a prompt-writing problem. A user-only Skill prevents
model-initiated Skill loading but does not prevent a model from calling registered MCP tools. The
product therefore requires a fail-closed DSH execution guard derived only from the current direct user
turn.

## User Scenarios & Testing

### User Story 1 — Install and invoke Dev Flow explicitly in DSH (P1)

As a DeepSeek Harness user, I can add one local `dev-flow-deepseek` artifact to an isolated profile,
restart the profile, and invoke `/dev-flow` in a Git repository without altering that repository
during installation.

**Why this priority**: without a supported install surface and a real execution boundary, no later
workflow behavior is trustworthy.

**Independent test**: add the exact local package artifact using the official DSH profile command,
restart, inspect the resolved profile, and prove:

- exactly one `dev-flow` Skill is registered;
- it is user-invocable and not model-invocable;
- exactly six `mcp__dev_flow__...` tools appear after Core connects;
- an ordinary user turn causes zero Dev Flow transport dispatches and zero Core writes;
- a forced model attempt without `/dev-flow` is denied before MCP transport;
- a current direct user turn containing the exact selector permits the same tool.

**Acceptance scenarios**:

1. **Given** a supported DSH profile and exact local artifact, **when** the user runs the official add
   command and restarts DSH, **then** the bundle appears once in the resolved profile.
2. **Given** the installed bundle, **when** a user sends ordinary input without `/dev-flow`, **then**
   no Dev Flow tool reaches MCP transport and no task, event, claim, or repository state changes.
3. **Given** a model attempts a Dev Flow tool without authorization, **when** the DSH tool pipeline
   evaluates the call, **then** a monotonic guard denies it before dispatch with a stable diagnostic.
4. **Given** a direct user message containing a whitespace-bounded `/dev-flow`, **when** DSH prepares
   the turn, **then** the user-only Skill instructions are injected and guarded Dev Flow tools may
   dispatch during that same open turn.
5. **Given** `/dev-flowx`, `//dev-flow`, `path/dev-flow`, `/dev-flow,`, a previous-turn selector,
   model output, plugin context, or `skill-invocation` context, **when** a Dev Flow tool is attempted,
   **then** the guard denies it.
6. **Given** a non-Git directory, empty request, or conversational request, **when** `/dev-flow` is
   selected, **then** the Skill stops before opening a task.

---

### User Story 2 — Govern and resume a DeepSeek graph task (P2)

As a developer, I can use `/dev-flow` to open or resume one DeepSeek-owned task, follow Core-declared
graph actions, restart the host, and continue to an authoritative terminal outcome.

**Why this priority**: this is the actual product value and proves the adapter remains a projection of
the Core rather than another orchestrator.

**Independent test**: with a simulated DSH runtime and real packaged Core, follow one bounded
`standard-development@1` path through requirements, design, task planning, implementation, test,
comprehension, optional refactor/retest, and delivery. Restart DSH between committed nodes, explicitly
select `/dev-flow` again, and verify the same task lineage resumes.

**Acceptance scenarios**:

1. With no compatible active task, explicit invocation opens exactly one task with `host=deepseek`.
2. With a compatible active task, explicit invocation resumes it rather than opening another.
3. The first Core call in each newly activated adapter session is
   `mcp__dev_flow__dev_flow_server_info`.
4. The Skill accepts only Core Contract 0.2, Schema 2, and `standard-development@1`.
5. The Skill renders the current node purpose, entry conditions, completion conditions, allowed
   effects, required evidence, method steps, payload contract, and legal transitions from fresh Core
   data and packaged host-neutral references.
6. The adapter never invents a transition, infers completion, or writes a workflow cursor.
7. Every mutation uses the current `action_id`, task revision, transition ID, and request identity
   required by Core.
8. After an uncertain mutation result, the Skill reads task and next action before considering
   another mutation.
9. A DSH MCP reconnect may recreate transport and tool registrations but never automatically replays
   a workflow mutation.
10. Comprehension requires an explicit developer verdict; a later user turn that may call Dev Flow
    must contain `/dev-flow` again.
11. Core `BLOCKED`, `DONE`, and `CANCELLED` are reported only from fresh Core results.

---

### User Story 3 — Remove and reinstall without losing data or disturbing Codex (P3)

As a user with Codex and DeepSeek products installed, I can remove the DeepSeek bundle from one DSH
profile while preserving Dev Flow data, repository content, and Codex configuration.

**Why this priority**: profile ownership and Core-data ownership are separate. Removal must prove that
separation.

**Independent test**: install the exact artifact, create a DeepSeek task, stop DSH, remove the package
with the official command, restart, verify the Skill and namespace are absent, verify data bytes and
Codex-owned files are unchanged, reinstall the exact artifact, restart, and resume the same task.

**Acceptance scenarios**:

1. Official removal followed by restart removes the bundle layer, Skill, MCP namespace, and guard.
2. Repeated removal is either an official package-manager no-op or a bounded package-manager error;
   it never edits task data or repository content.
3. Removal never deletes or rewrites the shared Dev Flow data directory.
4. Removal never edits the Codex package, Codex registration, Codex Skill, Codex MCP configuration,
   or Codex runtime.
5. Exact-artifact reinstall followed by restart restores the DeepSeek contributions.
6. Reinstall with the same data directory reopens the same task lineage without writes on a
   read-only terminal reopen.

## Edge Cases

- DSH starts while Core is temporarily unavailable.
- Core exits after tools have been registered.
- DSH reconnects and republishes the same qualified names.
- Another MCP client already reserves `serverName=dev_flow`.
- Core publishes a missing or extra tool.
- A Dev Flow call is nested inside Code Mode.
- A session is resumed with historical `/dev-flow` text but the current turn lacks it.
- A turn contains several direct user messages, only one of which contains the selector.
- A direct user message contains the selector in a fenced code block; official token semantics still
  treat it as explicit because the implementation intentionally does not parse Markdown.
- A user selects `/dev-flow` but the current directory is not a canonical single Git worktree.
- `DEV_FLOW_DATA_DIR` is missing, relative, symlinked through an unsupported component, unreadable, or
  not a directory.
- The host is not macOS arm64.
- A Core result is large enough for DSH result spill or later compaction.
- An MCP mutation succeeds but the host loses the result.
- The package is removed while DSH is still running; contributions remain active only until the
  required restart, exactly as DSH profile lifecycle defines.

## State-Graph Impact

**State-Graph Impact: N/A**

Feature 010 adds no node, transition, guard, process definition, method profile, payload contract, or
terminal state. It projects the existing `standard-development@1` definition and current Core results.

## Persistence Impact

**Persistence Impact: N/A**

Feature 010 adds no table, column, event type, schema version, task codec, migration, or adapter-owned
persistent state.

The only durable host-side state is DSH-owned profile package metadata. Dev Flow task data remains
Core-owned Schema 2 data.

## Functional Requirements

### Product and Bundle

- **FR-001**: The product identity MUST be `dev-flow-deepseek`.
- **FR-002**: The product MUST be one DSH package declaring one official `dsh.bundle.patch`.
- **FR-003**: The bundle patch MUST insert exactly one integration plugin row and MUST NOT duplicate
  the DSH base profile.
- **FR-004**: Installation and removal MUST use `dsh plugin --profile <name> ...`; the product MUST
  NOT edit a profile directly.
- **FR-005**: The package MUST remain unpublished and MUST NOT change a product version in this
  Feature.
- **FR-006**: The package MUST have a closed pack allowlist containing only runtime, integration,
  Skill/reference, manifest, license, and documentation files required by the product.
- **FR-007**: No npm lifecycle hook may mutate DSH, Codex, a target repository, or task data.
- **FR-008**: The package MUST declare a bounded DSH compatibility range and record an exact
  acceptance artifact.

### Skill and Selector

- **FR-009**: The package MUST register exactly one Skill named `dev-flow`.
- **FR-010**: The Skill MUST be user-invocable and MUST NOT be model-invocable.
- **FR-011**: The selector grammar MUST be equivalent to
  `(^|\s)/dev-flow(?=\s|$)` over direct `source.kind=user` text blocks.
- **FR-012**: Selector authorization MUST be derived from the current open turn only.
- **FR-013**: Previous turns, model messages, tool results, plugin context, Skill catalog messages,
  and `skill-invocation` messages MUST NOT authorize execution.
- **FR-014**: Every user turn expected to dispatch a Dev Flow tool MUST contain the selector again.
- **FR-015**: Empty, conversational, non-Git, multi-repository, or materially out-of-scope invocation
  MUST stop before opening a task.
- **FR-016**: The Skill MUST require one canonical current Git worktree and preserve repository and
  user instruction authority.

### Execution Authorization

- **FR-017**: The integration MUST install a monotonic DSH tool guard from the plain bundle context.
- **FR-018**: The guard MUST cover every tool name beginning `mcp__dev_flow__`, including an
  unexpected future name.
- **FR-019**: The guard MUST allow only the six exact qualified names declared in
  `contracts/skill-and-mcp.md`.
- **FR-020**: A covered tool MUST be denied when no initiating Agent or readable current open turn is
  available.
- **FR-021**: A covered tool MUST be denied when the current open turn has no direct-user selector.
- **FR-022**: Guard evaluation MUST be synchronous, deterministic, fail closed, and derived from the
  immutable DSH session event view.
- **FR-023**: The adapter MUST NOT persist an active flag, selector flag, task cursor, or
  authorization lease.
- **FR-024**: A denied call MUST NOT reach the MCP client, Core process, data store, or Git observer.
- **FR-025**: Guard denial MUST remain final after reorderable pre-execute listeners.

### MCP and Core Projection

- **FR-026**: The package MUST mount the official DSH MCP client over local STDIO.
- **FR-027**: The MCP namespace MUST be `dev_flow`.
- **FR-028**: Public DSH names MUST be `mcp__dev_flow__<raw-core-tool-name>`.
- **FR-029**: Exactly six Core tools MUST be exposed; a missing or extra tool fails compatibility.
- **FR-030**: The package MUST start only the package-relative Core selected for the current
  platform.
- **FR-031**: The first authorized Core call in a newly activated adapter session MUST be
  `dev_flow_server_info`.
- **FR-032**: The Skill MUST require Core Contract 0.2, Schema 2, Core Limits 0.2, and
  `standard-development@1`.
- **FR-033**: New tasks MUST be opened with `host=deepseek`.
- **FR-034**: Fresh Core results MUST be the sole authority for task identity, revision, action,
  graph node, legal transitions, evidence, recovery, blocker, and terminal status.
- **FR-035**: The adapter MUST NOT implement a transition table, payload validator, completion test,
  recovery classifier, or repository mutation engine.
- **FR-036**: Method-profile and node-payload references MUST remain host-neutral and parity-checked
  against the current Codex references without making Codex a runtime dependency.
- **FR-037**: Direct MCP result handling MUST pass the compatibility gate before native acceptance.
- **FR-038**: No result proxy is authorized unless a reviewed amendment records an observed direct
  result failure and the minimum transformation.

### Runtime, Data, and Lifecycle

- **FR-039**: Initial support MUST be limited to macOS arm64.
- **FR-040**: The integration MUST resolve the packaged Core from the installed package, not from the
  repository checkout, `PATH`, network, or install-time compilation.
- **FR-041**: An explicit valid `DEV_FLOW_DATA_DIR` MUST take precedence.
- **FR-042**: Without an explicit data directory, the product MUST use the documented shared macOS
  default and create it with restrictive permissions before Core starts.
- **FR-043**: Invalid, non-canonical, or unusable data paths MUST fail before Core dispatch.
- **FR-044**: The official MCP client MUST spawn Core without a shell and own connection,
  cancellation, shutdown, and bounded reconnect.
- **FR-045**: `failOnStartupError=false` MAY preserve unrelated DSH usability while Core reconnects,
  but the Skill MUST report unavailability rather than simulate progress.
- **FR-046**: Reconnect MUST NOT replay workflow mutations.
- **FR-047**: Removal MUST preserve Dev Flow data and repository content.
- **FR-048**: Removal MUST preserve every Codex-owned file and registration.
- **FR-049**: Exact-artifact reinstall MUST restore contributions and reopen compatible task data.

### Verification and Evidence

- **FR-050**: Package tests MUST cover manifest, bundle patch, file allowlist, runtime selection,
  path/data rules, and dry pack.
- **FR-051**: Guard tests MUST cover ordinary input, exact selector, malformed selectors,
  previous-turn selectors, injected messages, nested dispatch, missing agent, missing turn, and
  unexpected namespace tools.
- **FR-052**: MCP tests MUST cover exact qualified names, handshake, complete success, complete
  domain error, reconnect, uncertain mutation, and result-size boundaries.
- **FR-053**: Deterministic journeys MUST cover create, apply, restart, resume, graph loops,
  comprehension, and terminal handling without claiming native evidence.
- **FR-054**: Lifecycle tests MUST cover official add/restart/remove/restart/reinstall and data/Codex
  retention against isolated state.
- **FR-055**: Final acceptance MUST run one bounded native DSH journey after a repeatable non-model
  Preflight passes. The native Journey MUST cover ordinary zero dispatch, the exact six-tool
  handshake, one interrupted restart/resume, one smallest successful path through explicit
  comprehension acceptance to Core `DONE`, and one remove/reinstall readback. It MUST NOT repeat
  negative comprehension/refactor/retest, uncertain-mutation variants, repeated removal, or
  exhaustive retention cases already owned by deterministic and lifecycle tests. A failed native
  Journey is retained without an automatic retry in the same acceptance run.
- **FR-056**: Repository-wide validation MUST run once in CI for the exact acceptance commit. The
  same Validator MUST NOT be repeated locally when that CI result is available.
- **FR-057**: Evidence MUST record Product Source commit, Acceptance commit, package digest, embedded
  Core digest/version, DSH version/integrity, platform, task revision lineage, semantic outcomes,
  cleanup, and publication safety.
- **FR-058**: Feature evidence MUST NOT contain prompts, secrets, tokens, full environment dumps,
  private home paths, raw databases, or unbounded host logs.
- **FR-059**: Feature completion MUST NOT publish an npm package, Tag, Release, or support claim beyond
  the exact tested combination.

## Key Entities

- **DeepSeek Bundle**: the DSH package and profile-layer declaration.
- **Integration Plugin**: the host-plane plugin that registers the Skill, guard, and official MCP
  child plugin.
- **Selector Authorization Projection**: an ephemeral decision derived from immutable current-turn
  session events.
- **Qualified Tool Catalog**: the exact six DSH-visible names mapping to Core raw tools.
- **Packaged Core Runtime**: the platform-specific binary shipped inside the package.
- **Acceptance Artifact Identity**: exact package/Core/DSH/source/platform evidence.
- **Core Task**: the existing Schema 2 graph task; unchanged by this Feature.

## Success Criteria

- **SC-001**: One official profile add/restart activates one bundle, one user-only Skill, one guard,
  and six qualified tools.
- **SC-002**: Ordinary input and forced unauthorized model calls produce zero MCP dispatches and zero
  Core writes.
- **SC-003**: The exact selector in the current direct user turn permits guarded calls only for that
  turn.
- **SC-004**: Malformed, prior-turn, model, plugin, and injected selectors do not authorize calls.
- **SC-005**: Explicit invocation opens or resumes exactly one `host=deepseek` task for one canonical
  repository.
- **SC-006**: The adapter follows current Core graph actions through restart and reaches Core `DONE`
  without adapter-owned workflow state.
- **SC-007**: Uncertain mutation handling performs task read and next-action read before retry.
- **SC-008**: Method profiles, node payloads, comprehension, refactor/retest, and delivery match
  current Core Contract 0.2 behavior.
- **SC-009**: Official removal/restart removes every DeepSeek contribution while data, repository
  content, and Codex ownership remain unchanged.
- **SC-010**: Exact-artifact reinstall reopens the same compatible task lineage.
- **SC-011**: The direct MCP result compatibility gate passes without a proxy.
- **SC-012**: All product claims are limited to the exact tested DSH artifact and macOS arm64.
- **SC-013**: DeepSeek-specific source contains no task-state persistence or transition authority.
- **SC-014**: One repeatable Preflight, one non-duplicative bounded native happy-path Journey, and one
  exact-commit CI validation pass for the retained Product Artifact; negative graph-loop and
  exhaustive lifecycle evidence remain separately labelled deterministic or lifecycle evidence.
- **SC-015**: No publication or release mutation occurs.

## Assumptions

- Current main remains the implementation baseline until the Feature is marked Ready.
- DSH's official base profile includes the Skill registry and user-invocation integration used by the
  exact acceptance artifact.
- Core Contract 0.2 and Schema 2 remain unchanged throughout implementation.
- The first public DeepSeek product version is selected by a later Release Change.
