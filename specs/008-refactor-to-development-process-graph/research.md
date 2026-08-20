# Research: Refactor to a Development Process Graph

## Decision 1: Use one built-in graph, not a configurable workflow engine

**Decision**

Implement only `standard-development@1` as a closed Go definition. Do not retain
`legacy-linear@1`, load YAML/JSON/TOML process files, or expose a graph editor or plugin API.

**Rationale**

The user need is a reliable default development process that always explains the next legal nodes.
A configurable engine would add parsing, validation, upgrade, security, migration, documentation,
and support burdens before there is evidence that users need multiple processes. A single static
definition is deterministic, digestible, and keeps one current workflow authority.

**Alternatives considered**

- User-defined graph DSL.
- One graph JSON file embedded at build time.
- Host-owned transition configuration.
- Multiple preset processes for task size or methodology.

**Why alternatives were rejected**

A DSL and multiple presets create a second product problem—workflow authoring—without proving the
first process. An embedded file adds a parser and schema without user value. Host-owned
configuration violates single Core authority.

**Consequences**

Changing the standard graph requires a new process version and Product Feature. New tasks cannot
select a custom graph. The code must validate its own closed definition and expose a stable digest.

---

## Decision 2: Preserve immutable original intent while versioning requirements

**Decision**

Replace the immutable final task contract for new tasks with:

- an immutable `TaskIntent` containing the original request, known initial bounds, verification
  authority, and selected method profile;
- a versioned `RequirementsBaseline` created and revised inside `REQUIREMENTS`.

**Rationale**

A process that begins with requirements grooming cannot demand final scope and acceptance before
the task exists. At the same time, silently rewriting the original request would destroy audit and
recovery meaning. Separating intent from the current requirements authority preserves both.

**Alternatives considered**

- Keep the existing immutable goal/scope/acceptance contract.
- Make the entire contract mutable.
- Require the Host to finish requirements before calling `open_task`.
- Store only external Spec Kit/OpenSpec documents.

**Why alternatives were rejected**

The existing contract makes the first node ceremonial. A fully mutable contract loses the original
authorization boundary. Pre-opening requirements means Dev Flow cannot manage that part of
development. External documents alone would make Core depend on repository/tool state and would not
provide a stable terminal acceptance authority.

**Consequences**

Outcome acceptance binds to the latest requirements revision, not the initial request. Downstream
authorities must record their upstream revision. Backward transitions can create a new baseline and
invalidate stale downstream work.

---

## Decision 3: Select transitions by stable transition ID

**Decision**

A standard node action returns its complete `available_transitions`. Apply payloads submit exactly one
`transition_id`; Core derives the destination. The caller cannot send `destination`, `next_node`, or
a guard result.

**Rationale**

The product must tell developers which nodes are legal while preventing adapters from becoming a
second state machine. A stable edge ID expresses user/developer intent without granting destination
authority.

**Alternatives considered**

- Keep the current generic result vocabulary (`pass`, `replan`, and similar).
- Let callers submit destination node.
- Provide one MCP tool per transition.
- Infer the transition from payload content.

**Why alternatives were rejected**

Generic results become ambiguous as the graph grows. Caller destinations permit hidden transitions.
A tool per transition explodes the public surface. Payload inference obscures the developer's
decision and complicates recovery digests.

**Consequences**

The transition table is public contract. Backward edges have explicit reason requirements. Recovery
probes retain the exact transition-bearing payload.

---

## Decision 4: Make comprehension a mandatory human-facing node

**Decision**

Every successful test enters `COMPREHENSION_REVIEW`. `comprehension_passed` requires explicit
current user-confirmation evidence. AI/static review can identify issues and recommend transitions,
but cannot by itself produce the pass verdict.

**Rationale**

The motivating failure is code/design that technically works but the developer cannot understand.
A review that the same AI can self-certify would not address that failure. A user-confirmed gate
makes maintainability a product outcome.

**Alternatives considered**

- Fold comprehension into ordinary code review.
- Let tests or static complexity metrics prove comprehension.
- Make the node optional.
- Allow the Host Agent to assert the user understands.

**Why alternatives were rejected**

Ordinary review focuses on correctness. Metrics cannot prove a specific developer understands the
change. Optional review recreates the current failure. Host assertion without user evidence is not
credible.

**Consequences**

The Host must present a bounded explanation and request a developer verdict. A missing response
leaves the task at the node. User confirmation is bound to the current repository and baselines and
is invalidated by later changes.

---

## Decision 5: Model refactoring as a separate node with mandatory retest

**Decision**

Add `REFACTOR`. Any completed repository-changing refactor transitions to `TEST`; no edge exists
from `REFACTOR` directly to comprehension, delivery, or done.

**Rationale**

Refactoring is a recurring part of AI-assisted development and can introduce regressions even when
behavior is intended to remain unchanged. An explicit node records why simplification was needed
and prevents “refactor” from bypassing verification.

**Alternatives considered**

- Return directly to `IMPLEMENT`.
- Treat refactor as an implementation flag.
- Allow direct return to comprehension when changes look mechanical.

**Why alternatives were rejected**

Those choices hide the simplification decision and permit stale test evidence. A separate node makes
the loop visible and independently measurable.

**Consequences**

Repository-changing refactor invalidates test and comprehension authorities. If refactoring exposes
a behavior/design requirement, it can return to `DESIGN` or `REQUIREMENTS` with a reason, and the
eventual forward path still passes through implementation/test gates.

---

## Decision 6: Keep BLOCKED recovery-owned in the first graph version

**Decision**

`BLOCKED` remains an exceptional Core-generated safety/recovery node. A normal node does not expose
a caller-selected “blocked” transition. Missing user information or unavailable method tooling
leaves the task on its current node and the action incomplete.

**Rationale**

The existing blocker contains a machine-verifiable recovery condition. Expanding it into general
project waiting states would mix human waiting, tool availability, repository drift, and uncertain
mutation under one model. That is not required to solve process navigation.

**Alternatives considered**

- Add `WAITING_FOR_USER`, `WAITING_FOR_TOOL`, and `BLOCKED_EXTERNAL`.
- Allow any node to select `BLOCKED`.
- Persist free-form blockers.

**Why alternatives were rejected**

They add state and unblock semantics without current evidence. Free-form blockers weaken exact
recovery. The current node and unmet completion conditions already explain what is missing.

**Consequences**

A Host stops honestly while preserving the current action. General waiting-state support requires a
future Feature with explicit user value and machine semantics.

---

## Decision 7: Keep six MCP tools and enrich existing reads

**Decision**

Upgrade the existing six tools to Core Contract 0.2. Expose graph navigation through
`open_task`, `get_task`, and `get_next_action`; submit transitions through `apply_action`.

**Rationale**

The existing tool set already covers create/resume, read, next action, mutation, and cancellation.
A graph does not require a separate “list nodes” or “transition” tool when the current action can
return complete local information.

**Alternatives considered**

- Add `dev_flow_get_process`.
- Add `dev_flow_list_transitions`.
- Add `dev_flow_transition_task`.
- Add a generic process-query endpoint.

**Why alternatives were rejected**

They duplicate current reads, increase adapter branching, and weaken the Constitution's bounded
surface. The developer needs current-node navigation, not arbitrary graph administration.

**Consequences**

The result objects become richer and contract schema increments to 2. Tool names/order and
transport remain stable.

---

## Decision 8: Use semantic method steps plus Host rendering

**Decision**

Core returns tool-neutral method step IDs. A task selects `plain`, `spec-kit`, or `openspec`.
Host adapters map semantic steps to installed capabilities/commands and expected artifacts. Missing
capabilities can use an honest plain-equivalent fallback.

**Rationale**

Spec Kit and OpenSpec evolve independently and use Host-specific command spelling. Hardcoding those
commands in the Core would create runtime dependencies and version churn. Leaving all mapping in
free-form prompts would make the process forgettable and inconsistent.

**Alternatives considered**

- Core directly runs tool CLIs.
- Core stores exact slash commands.
- Method tools own their own cursor and Dev Flow only observes files.
- No explicit method profile.

**Why alternatives were rejected**

Direct execution violates the Core boundary and increases security/installation scope. Exact Core
commands become stale. A second cursor recreates authority drift. No profile fails the user's
navigation requirement.

**Consequences**

Semantic step IDs are public stable identifiers. Adapter mappings can evolve within compatible Host
releases as long as they preserve semantics. Tool completion never mutates Core by itself.

---

## Decision 9: Establish Schema 2 as a fresh storage generation

**Decision**

Create the final Schema 2 tables directly in an empty data directory and support exactly one strict
snapshot-version-2 task codec. Do not run Schema 1 bootstrap first, add `ALTER TABLE` migration logic,
or select a decoder from historical row metadata.

**Rationale**

The product is still in rapid pre-1.0 iteration, and the new process model changes task intent,
cursor, actions, payloads, evidence, baselines, and terminal meaning. Carrying the old representation
would double core invariants and tests while providing little durable user value. A fresh generation
keeps the new model direct and reviewable.

**Alternatives considered**

- Schema 1 → Schema 2 in-place migration.
- Dual v1/v2 snapshot codecs in one database.
- A second compatibility database.
- Semantic conversion of old phases to new nodes.
- Event replay or JSON-shape inference.

**Why alternatives were rejected**

Each alternative preserves obsolete runtime semantics or fabricates process history. Dual codecs and
processes are the exact code burden the rapid-iteration policy is intended to avoid. Conversion cannot
prove requirements, design, testing, or comprehension gates that did not exist.

**Consequences**

A Schema 1/pre-graph database is unsupported and fails closed with zero writes. A fresh directory
creates Schema 2 directly. Production code contains no v1 codec, legacy process, dual task projection,
or migration branch.

---

## Decision 10: Require explicit user-controlled reset instead of historical-task compatibility

**Decision**

Feature 008 will not read, resume, cancel, complete, convert, import, or export Core Contract 0.1
tasks. When old data is detected, Core returns `SCHEMA_UNSUPPORTED` without mutation. The user may
select a fresh `DEV_FLOW_DATA_DIR` or manually archive, rename, or delete the old directory outside
Core. Package lifecycle commands never perform that destructive action automatically.

**Rationale**

A safe breaking change is different from silent data loss. Explicit rejection preserves user control
without forcing permanent legacy code into the product. Feature 008 makes no promise to operate,
finish, or convert an old task; the user decides only whether to preserve the unsupported files
outside the active data root.

**Alternatives considered**

- Continue old tasks through a frozen compatibility process.
- Automatically cancel or delete old tasks during upgrade.
- Automatically convert the database on first open.
- Add task export/import as a bridge.

**Why alternatives were rejected**

A compatibility process and dual codecs create long-lived maintenance debt. Automatic cancellation,
deletion, or conversion changes user data without explicit authority. Import/export is a separate
product capability and would broaden this refactor substantially.

**Consequences**

Upgrade documentation must state the breaking boundary before use. Tests prove old-data zero-write
rejection and direct fresh bootstrap, not legacy continuation. No old-binary compatibility journey is
required.

---

## Decision 11: Persist semantic baselines, not full method documents

**Decision**

Persist bounded current requirements/design/task-plan semantics and compact prior references.
Persist artifact path/digest/role summaries as evidence. Do not store full Markdown documents in
SQLite and do not parse them during ordinary task reads.

**Rationale**

Core needs semantic authorities for transitions and delivery, but full Spec Kit/OpenSpec documents
are larger, tool-specific, editable outside Core, and already live in the repository. Snapshot
authority must remain bounded and independently readable.

**Alternatives considered**

- Store full document content.
- Store only file paths.
- Reconstruct current state by parsing repository documents.
- Reconstruct baselines from TaskEvents.

**Why alternatives were rejected**

Full content bloats snapshots. Paths alone are not semantic authority. Parsing method documents
makes Core tool-dependent. Event replay would replace the current snapshot model and add failure
modes unrelated to the user goal.

**Consequences**

The Task snapshot holds enough normalized data to validate transitions and outcomes. External
artifacts remain useful evidence and human context but are not the state machine.

---

## Decision 12: Separate implementation from release

**Decision**

Feature 008 changes product behavior and local acceptance only. It does not change product version
or mutate npm/GitHub. A later Release Change chooses and publishes the next version.

**Rationale**

The previous process combined behavior correction, version alignment, publisher repair, native
journey, and public release in one Feature. That made the specification difficult to understand and
expanded every product change into release engineering.

**Alternatives considered**

- Include version alignment and publication in Feature 008.
- Increment version during every Product Feature.
- Publish automatically after merge.

**Why alternatives were rejected**

They conflate reversible implementation with irreversible external mutation, obscure feature
acceptance, and force release work before the product design is stable.

**Consequences**

Feature 008 can reach `Complete` while `VERSION` remains `0.3.0`. The next release has its own
source identity, artifact gates, registry journey, and support statement.

---

## Decision 13: Harden Phase 2–5 contracts before adding Phase 6–8 behavior

**Decision**

Insert Phase 5D as a corrective checkpoint. Bind transition choice to closed typed problem classes,
close public optional/error/DTO shapes, enforce current aggregate/claim/evidence authority at read
boundaries, and fail closed on non-null Recovery requests until Phase 7 implements classification.

**Rationale**

The audit showed that passing CI did not prove caller facts selected only one edge, that accepted
Recovery fields were acted on, or that loaded snapshots/claims/outcomes were internally current.
These are safety and contract gaps in already implemented work and must be closed before adapters or
full Recovery add more call paths.

**Alternatives considered**

- Defer the gaps to Phase 7 or Phase 8.
- Remove the public Recovery fields until Phase 7.
- Accept multiple issue labels and infer the destination from free text.
- Repair malformed task/claim state automatically during Store open.

**Why alternatives were rejected**

Deferral leaves silent acceptance and ambiguous transition authority in the public contract.
Removing fields creates avoidable wire churn. Free-text inference lets callers select incompatible
destinations. Automatic repair violates zero-write safe-stop and can destroy audit evidence.

**Consequences**

Phase 5D introduces `RECOVERY_UNAVAILABLE` as a temporary closed error, not a sixth recovery class.
Payloads gain per-node `problem_class`; definition identity remains based on the previously frozen
stable identifiers. Store open becomes stricter and may reject corrupt current-generation data with
`STORAGE_UNAVAILABLE`. Phase 6–8 remain unchanged and unstarted.

---

## Decision 14: Compose final acceptance from native graph-flow and deterministic lifecycle evidence

**Decision**

Complete SC-015 with two closed evidence components bound to the same exact source-local artifact.
Attempt 3 supplies the native Codex graph-flow component. A lifecycle-only runner supplies the
deterministic package/Core/data-retention component without launching Codex. A composite record
closes the shared artifact identity and both component results.

**Rationale**

Model-driven workflow behavior and deterministic package lifecycle behavior have different evidence
mechanisms. The retained Attempt 3 sessions already prove the model-dependent graph path through
Core `DONE`. Installation, setup, removal, uninstall, retention, reinstall, and terminal reopen use
deterministic commands and packaged-Core calls. Binding both components to one exact artifact proves
the complete source-local product surface without making completed native evidence depend on a
post-session command classifier.

**Alternatives considered**

- Require one runner invocation to perform both evidence classes.
- Start an additional native Codex attempt to repeat the whole path.
- Accept only deterministic or simulated evidence for the graph flow.

**Why alternatives were rejected**

The single-runner form couples completed native sessions to deterministic post-processing. Repeating
the native path adds stochastic cost without adding product coverage. Deterministic or simulated
graph-flow evidence cannot replace real Codex evidence.

**Consequences**

Attempt 3 remains recorded as native-flow passed, runner failed after native sessions, and lifecycle
not run. The lifecycle component uses a separate Task and retains the exact label
`deterministic exact-artifact lifecycle evidence`. Attempts 1–3 remain immutable evidence, Attempt 4
is forbidden, and publication remains outside Feature 008.
