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
side effects. Dev Flow identifies the operation through revision, action identity, source cursor,
repository binding, and the original payload, and requires read-before-retry. Core returns a
five-class Recovery assessment before recovery, blocking, or safe retry is selected.

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

Tasks, events, evidence, and repository claims are stored in local SQLite. A Task may contain one
primary repository and up to seven explicit additional repositories. The scope is immutable after
creation, and every repository shares the same process state. Core reads each repository's canonical
identity, branch, HEAD, index/worktree, and bounded changed paths in primary-first, additional-key
order. A user-authorized host continues to own Git mutations.

The read-only `$HOME/.dev-flow/config.json` file provides independent `codebase_memory` boolean
preferences for Codex and DeepSeek. Missing configuration defaults to disabled. Configuration and
index availability never enter the Task, repository binding, Recovery, or process authority.

### Codex setup out-of-box experience

When configuration is absent, `dev-flow-codex setup` creates a safe complete default, preserves any
existing configuration, and reports the configuration and registration receipt files it directly
created or updated. Interactive results use a Dev Flow-owned Simplified Chinese or English welcome
screen; non-interactive output is plain text, and `setup --json` exposes the same file facts. This is
Codex Host lifecycle behavior and does not change Core, Tasks, or DeepSeek.

## Products

| Product | Responsibility | Current version |
| --- | --- | --- |
| Core | State graph, Task, Store, Recovery, and MCP | `0.5.1` |
| Codex | Codex Plugin, Skill, registration lifecycle, and bundled Core | `0.6.0` |
| DeepSeek | DSH bundle, Skill, guard, MCP child, and bundled Core | `0.5.2` |

The three products have independent versions. A host package records its actual bundled Core version;
the two product version numbers do not have to match.

## Product guarantees

- Current Task, node, legal transitions, recovery classification, and outcome have one Core authority.
- A Task retains immutable original intent, and material requirements or design changes invalidate
  stale downstream authority.
- Every Task carries a verification budget, and validation scope must directly relate to the current
  node, changed surface, acceptance criteria, or recovery risk.
- Mutations carry revision, action identity, source cursor, and repository binding.
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
repository plus zero to seven explicit additional repositories. Each participating repository can
be claimed by at most one active Task. Single-repository calls retain ordinary relative paths;
multi-repository paths use `<repository-key>::<repository-relative-path>`. It does not provide:

- user-defined graphs, a workflow DSL, graph editor, or plugin framework;
- a Web UI, remote MCP, HTTP/SSE, authentication, or telemetry;
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

The current Codex version `0.6.0` is published to npm with the `codex-v0.6.0` GitHub Release.
The current DeepSeek version `0.5.2` is published to npm with the `deepseek-v0.5.2` GitHub Release.
Each host product bundles the exact Core identity recorded in the support matrix and publicly supports
macOS arm64 with Node.js `>=24`.

See the [Support Matrix](SUPPORT-MATRIX_en.md) for exact platform, host version, Journey outcome, and
Release evidence. Current source code, machine-readable schemas, and executable tests define exact
product behavior.

## Codex smart activation

The Codex Plugin lets the Host select Dev Flow implicitly for bounded implementation, bug-fix,
refactoring, targeted-testing, and development-delivery requests. `$dev-flow-codex:dev-flow` remains
the exact force-entry selector. Explanation-only, status-only, design-discussion, ordinary-question,
and ambiguous requests do not automatically create or resume a Task. Both paths share the same
admission, Core Action, and authority boundaries and do not authorize Git mutations or releases.
