# Dev Flow Product Definition

[中文](PRODUCT.md) | [English](PRODUCT_en.md)

## Positioning

Dev Flow is the process-control and recovery layer for AI-assisted software development. The Go Core
retains the Task, current node, node contract, verification budget, legal transitions, Recovery, and
terminal outcome. A host adapter reads repositories, modifies code, and runs tools under user
authorization.

The product does not add execution capability to an agent. It places durable, verifiable process
boundaries around execution capability that already exists.

## Target scenarios

Dev Flow serves developers and teams that use AI deeply in real repositories while requiring control
over scope, verification intensity, and delivery quality. Typical work crosses requirement
clarification, design choices, implementation rework, failed tests, interrupted sessions, and
delivery review. Chat history alone cannot act as authoritative process state.

## Failure modes under control

### Scope drift and implicit work

A host may expand a local change into neighboring-module refactoring, a generic abstraction, extra
documentation, or an unrequested future capability. A Task retains immutable `TaskIntent` plus current
requirements, design, and task-plan authority. The current Action exposes completion conditions,
`allowed_effects`, and every legal transition. A material scope change must be reported through the
graph, after which Core invalidates downstream authority that no longer applies.

### Unbounded verification

Targeted validation may expand into a complete regression suite, platform matrix, stress testing,
fuzzing, or a growing collection of edge cases. Every Task retains a verification budget. Checks must
relate to the current node, changed surface, acceptance criteria, or a known recovery risk. Broader
validation requires an explicit requirement or final checkpoint rather than being appended by
default.

### Conversation context as the only state store

After context compaction, a host restart, or work resumed in another session, an agent may rescan the
repository, repeat completed work, or infer progress from partial output. Dev Flow persists the Task,
current node, baselines, evidence, blockers, and legal transitions in local SQLite. One Core read
restores authoritative state.

### Replay of an uncertain mutation

When a mutation response is missing, cancelled, truncated, or malformed, direct replay can duplicate
side effects. The Host submits the Task ID, Action ID, and node result through the tool named by the
current Action. Design, Tasks, and Implementation results omit `requirements_revision`,
`design_revision`, and `task_plan_revision`, respectively. Core validates the current Action identity,
fills those system-state members from the same Task snapshot, completes the identity, artifact roles,
method steps, and payload envelope, builds and validates the complete next Task mutation, and only then
retains the normalized submission as an independent Action operation. Task, Event, Claim, and the operation's applied revision commit in
one transaction. Recovery reads that operation record, so the caller no longer stores or rebuilds the
original payload and the Task snapshot carries no recovery payload. A Delivery submission reports only
Host-owned delivery judgment, risks, and new findings. Acceptance, current automated/manual evidence
IDs, and Test/Comprehension record IDs are absent from the submission contract and are filled by Core
from that same Task snapshot. Submitting those Core-owned members is rejected as `unknown_member`.

Before retaining a submission, Core recursively checks required members against the submission
contract, then validates the complete internal contract and current-Task semantics. System-state
revisions that Core can determine uniquely are filled by Core, and callers cannot submit Delivery
authority members. A proven zero-write `required_member_missing` in
a node submission may also be corrected once at its exact path, but only with facts already established
by the current node work; when the missing content requires a new user decision, the Host must stop and
request it. Other values that cannot be derived safely receive field detail without automatic correction
authority. Rejected input never enters a recoverable Action operation or uncertain-mutation Recovery.

Before every ordinary submission and the one allowed corrected submission, the Codex Host compares
the complete draft member by member with the current `submission_tool` live schema, including required
and extra members at every level, nested value and array-item types, nullability, enums, and consts. It
stops before calling the tool when the draft cannot match exactly; field names, reference prose, and
error text do not define types in place of the live schema.

### Behavioral correctness and maintainability are not separated

Automated tests establish behavior; they do not establish that an implementation can be explained and
maintained. `COMPREHENSION_REVIEW` is a separate delivery gate. A result that fails that gate can return
to `REQUIREMENTS`, `DESIGN`, `IMPLEMENT`, `TEST`, or `REFACTOR`. Any refactor that changes the
repository must pass through `TEST` again.

### Multiple process authorities across tools

Spec Kit, OpenSpec, Codex, and DeepSeek Harness can assist development only as method tools or host
adapters. Go Core alone retains the process cursor, transition authority, and terminal outcome. A
successful external command, checked box, or existing artifact may provide evidence but cannot
advance the Task by itself.

## Core capabilities

### A visible standard development graph

The product provides one built-in process, `standard-development`, with eight working nodes,
`DONE`, and the exceptional `BLOCKED` and `CANCELLED` nodes.

```text
REQUIREMENTS → DESIGN → TASKS → IMPLEMENT → TEST
                                         ↓
                              COMPREHENSION_REVIEW
                                  ↙           ↘
                             REFACTOR       DELIVERY → DONE
                                 └────→ TEST
```

The implementation contains 29 transitions for requirement revision, redesign, implementation
rework, failed testing, failed comprehension, refactoring, retesting, and rejected delivery. Each
Action returns every legal outgoing transition. The caller selects a `transition_id`; Core validates
the guard and derives the destination.

### Node contracts, scope, and verification budget

Every current Action returns:

- process, node, revision, and action identity;
- purpose, entry assumptions, and completion conditions;
- `allowed_effects`, `required_evidence`, and the verification budget;
- semantic method steps for the current method profile;
- every legal transition, destination, guard, selection condition, and reason rule.

Core validates Task transitions but does not statically intercept every file operation performed by a
host. A host adapter must operate according to the current Action contract and report material scope
changes through a legal transition.

### Three method profiles

- `plain`: perform the node's semantics with ordinary host development capabilities;
- `spec-kit`: map Spec Kit capabilities to the current node;
- `openspec`: map OpenSpec capabilities to the current node.

All profiles use the same Core graph. External tools do not retain a second process cursor.

### Five-class Recovery

Core classifies uncertain mutations as:

```text
not_started
completed_and_recorded
completed_but_unrecorded
partially_completed
conflicting
```

Core decides retry advice, recovery apply, or `BLOCKED`. Resolving a blocker returns the Task to its
recorded resume node.

### Local persistence and read-only Git observation

Tasks, recoverable Action operations, events, evidence, and repository claims are stored in local
SQLite. A Task may contain one primary repository and up to seven explicit additional repositories. The scope is immutable after
creation, and every repository shares the same process state. Core reads each repository's canonical
identity, branch, HEAD, index/worktree, and bounded changed paths in primary-first, additional-key
order. A user-authorized host continues to own Git mutations.

`GitCommonDirDigest` identifies only the group of linked worktrees under one Git common directory.
`RepositoryIdentity`, which also includes the canonical root, continues to identify one physical
worktree and remains the exclusive repository-claim key. The same logical Git repository can
therefore run independent Tasks concurrently in different worktrees while one worktree still holds
at most one active Task.

The read-only `$HOME/.dev-flow/config.json` file provides independent `codebase_memory` boolean
preferences for Codex and DeepSeek. Missing configuration defaults to disabled. Configuration and
index availability never enter the Task, repository binding, Recovery, or process authority.

### Codex setup out-of-box experience

When configuration is absent, `dev-flow-codex setup` creates a safe complete default, preserves any
existing configuration, and reports the configuration and registration receipt files it directly
created or updated. Interactive results use a Dev Flow-owned Simplified Chinese or English welcome
screen; non-interactive output is plain text, and `setup --json` exposes the same file facts. This is
Codex Host lifecycle behavior and does not change Core, Tasks, or DeepSeek.

### Unified Adapter lifecycle

The source tree provides `@imotong/dev-flow` as one Host-neutral `dev-flow` entry for Codex and DeepSeek Adapter status, diagnosis,
installation, upgrade, repair, data-preserving reinstall, uninstall, factory reset, and clean reinstall. It calls
Codex setup/remove/status and public DSH lifecycle commands without copying Core or Host registration authority.
Ordinary maintenance preserves configuration and Task data. Factory reset requires strong confirmation bound to the
current plan and moves exact data targets to macOS Trash by default. Codex global-package installation is observed
independently from receipt and Plugin registration, so uninstall and factory reset still remove the package after
registration has already disappeared. Codex uninstall first asks the currently installed Adapter's bundled Core to validate the runtime receipt and stop the matching WebUI; a stop failure aborts registration and package removal. Interactive menus, confirmations, plans, and results read the current locale:
`zh*` uses Simplified Chinese and every other locale uses English; JSON remains language-neutral. During installation,
upgrade, repair, and reinstall, text output shows each current Host action and the package, registration, artifact,
and readiness steps confirmed by the driver; JSON mode does not include progress text. The public launcher
selects the newest available Core from installed Adapter receipts and forwards
only the closed `webui` surface; it persists neither another Core nor workflow state. `webui start` may create the
missing product-owned default data directory with mode `0700`; explicit data directories must already exist, and every
other WebUI command remains zero-write. See the Support Matrix for exact public versions and installation evidence.

## Products

Current source also provides a Control Center embedded in Core. It browses Tasks from every Host, presents timeline,
process graph, Action, Recovery, and Blocker facts, and performs Task lifecycle operations. `dev-flow webui
start|open|status|stop` manages one shared loopback instance. The interface provides Simplified Chinese/English, selects the system language on first use, and stores a manual choice only in the browser. Old Task data is removed only through CLI-only,
target-bound `reset` after exclusive database access. The browser exposes no remote access, accounts, permissions, shell,
Git mutation, or reset mutation.
The shared page shell reflows navigation, filters, Task lists, detail, forms, and system state across desktop, tablet, and narrow screens. Wide screens expand structured content, while narrow screens render the Task table as labeled cards without changing routes or operation semantics.

| Product | Responsibility |
| --- | --- |
| Core | State graph, Task, Store, Recovery, and MCP |
| Codex | Codex Plugin, Skill, registration lifecycle, and bundled Core |
| DeepSeek | DSH bundle, Skill, guard, MCP child, and bundled Core |
| Dev Flow CLI | Host-neutral Adapter lifecycle, public WebUI launcher, and recovery |

The four products have independent versions. A host package records its actual bundled Core version;
product version numbers do not have to match.

## Product guarantees

- Current Task, node, legal transitions, recovery classification, and outcome have one Core authority.
- A Task retains immutable original intent, and material requirements or design changes invalidate
  stale downstream authority.
- Every Task carries a verification budget, and validation scope must directly relate to the current
  node, changed surface, acceptance criteria, or recovery risk.
- Mutations carry revision, action identity, source cursor, and repository binding.
- The Host submits the current Action result; Core fills and retains the complete mutation input.
- Core builds and validates the complete next Task mutation before retaining a recoverable Action
  operation; Task, Event, Claim, and the operation's applied revision commit atomically.
- A write-enabled Action result reports exact `changed_paths` newly produced relative to the current Action's issuance state, or `no_file_changes` when this node changed no files; Core validates the
  issuance baseline, `allowed_effects`, and fresh observation, while artifact references do not replace
  the mutation envelope.
- A Task's one to eight explicit repositories share one Action, revision, verification budget,
  Recovery, Blocker, and Outcome.
- An uncertain mutation is read before another write action is selected.
- A repository-changing refactor must return through `TEST`.
- `DELIVERY` requires current test evidence and current developer comprehension evidence.
- Core observes Git read-only and exposes no shell or Git mutation.
- Incompatible SQLite data is rejected before write capability is exposed, with zero writes.
- Public Codex and DeepSeek support is established independently by registry-package lifecycle evidence.

## Current product boundary

The current product focuses on one local host and a bounded Repository Scope made of one primary
repository plus zero to seven explicit additional repositories. Each participating worktree identity
can be claimed by at most one active Task; different linked worktrees under one Git common directory
may each run an active Task. Single-repository calls retain ordinary relative paths;
multi-repository paths use `<repository-key>::<repository-relative-path>`. It does not provide:

- user-defined graphs, a workflow DSL, graph editor, or plugin framework;
- remote Web UI, remote MCP, generic HTTP/SSE transport, authentication, or telemetry;
- a generic shell, automatic Git repair, commit, push, merge, rebase, or publication;
- automatic discovery or dynamic mutation of Repository Scope, parallel repository nodes, subtasks,
  or automatic cross-host takeover;
- automatic multi-repository orchestration, cross-repository Git transactions, or repository-level
  process state;
- pre-graph Task migration, a legacy snapshot decoder, or a compatibility runtime;
- Spec Kit or OpenSpec installation, execution, or document parsing inside Core.

These boundaries keep the current graph deterministic, explainable, and verifiable. A future
capability enters the roadmap only after its user value and independent specification are established.

## Public status

Maintainers publish npm products through the manually dispatched `publish-npm` GitHub Actions workflow.
It invokes the existing standalone release command on an ARM64 macOS runner with one fixed release
check, exact version confirmation, and npm/Tag/GitHub Release read-back. npm publication uses the
Trusted Publisher bound to that workflow and a short-lived OIDC
credential, with no long-lived npm publish token stored in the repository. This automation is
repository release tooling; it does not enter the Go Core or change Task or Host Adapter product
responsibilities.

The Codex and DeepSeek Adapters are published to npm. Each host product bundles its own Core and
publicly supports macOS arm64 with Node.js `>=24`.

See the [Support Matrix](SUPPORT-MATRIX_en.md) for exact platform, host version, Journey outcome, and
Release evidence. Current source code, machine-readable schemas, and executable tests define exact
product behavior.

## Codex smart activation

The Codex Plugin lets the Host select Dev Flow implicitly for bounded implementation, bug-fix,
refactoring, targeted-testing, and development-delivery requests. `$dev-flow-codex:dev-flow` remains
the exact force-entry selector. Explanation-only, status-only, design-discussion, ordinary-question,
and ambiguous requests do not automatically create or resume a Task. Both paths share the same
admission, Core Action, and authority boundaries and do not authorize Git mutations or releases.

When the user explicitly requests two or more independent bounded tasks to run concurrently in one
logical Git repository, the Codex Plugin uses a Host-coordination route first. It dispatches only
when the current Host can create a separate worktree-backed task/thread for every item; each child
then enters ordinary Dev Flow admission independently. The coordinator creates no parent Core Task
and calls no Dev Flow MCP tool. Shared-directory sub-agents are not isolation. When the capability is
unavailable, the Plugin stops and asks the user to start separate worktrees.

One new request still performs ordinary Task discovery once in the current physical worktree. Only
when a `dev_flow_open_task` call carrying non-null `new_task` returns a complete
`ACTIVE_TASK_CONFLICT`, and the Host can create a separate worktree-backed Codex task, does the
Plugin create exactly one child after that result. The creation request uses
`target.environment.type="worktree"` and omits `startingState`, so the child starts only from the
project's committed default-branch state. The occupied checkout's index, tracked working-tree
changes, and untracked files are not read, copied, or applied to the child. The child uses the exact
`$dev-flow-codex:dev-flow` selector for its own admission, handshake, and Action loop; the coordinator
makes no further Core call, does not retry creation, and leaves the original active Task and
worktree unchanged. Explicit resume, `HOST_OWNERSHIP_CONFLICT`, and other errors retain their
existing stop behavior.
