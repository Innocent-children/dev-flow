# Dev Flow Product Definition

[中文](PRODUCT.md) | [English](PRODUCT_en.md)

## One-line definition

Dev Flow is the process-boundary and recovery layer for AI-assisted development. At every step, it
makes clear what the agent may do now, what completes the step, how much verification is enough, and
where the task may go next.

## Intended users

Dev Flow serves developers and teams that want AI to participate deeply in real repositories without
accepting scope drift, over-design, excessive testing, or lost context as normal operating costs.
Real tasks cross requirement clarification, design choices, implementation rework, failed tests,
interrupted sessions, and delivery review. Chat history alone cannot reliably retain their scope,
progress, and evidence.

## Problems it solves

### Small requests expand while they are being implemented

A host may turn a local change into neighboring-module refactoring, a generic abstraction, extra
documentation, or a future capability. Dev Flow retains immutable original intent plus the current
requirements, design, and task-plan authority. Every Action exposes allowed effects. A material scope
change returns the Task to the appropriate node and explicitly invalidates stale downstream evidence.

### Verification has no stopping rule

An agent may expand “confirm this change works” into a complete regression suite, platform matrix,
stress testing, fuzzing, or a growing collection of edge cases. Dev Flow stores a verification budget
for every Task. Checks must relate to the current node, changed surface, acceptance criteria, or a
known recovery risk. Broader validation requires an explicit requirement or final checkpoint rather
than being appended by default.

### The process exists only in chat history

After context compaction, a host restart, or a task that resumes the next day, an agent may forget the
current node, rescan the repository, or repeat completed work. Dev Flow stores the Task, current node,
baselines, evidence, blockers, and legal transitions in local SQLite. One authoritative read restores
the actual progress.

### Replaying an interrupted mutation can duplicate effects

When a mutation result is uncertain, Dev Flow reads the recorded operation, Task, and repository
binding before deciding whether recovery is needed. Callers do not have to infer success from a
partial output stream, and blind retry is not treated as the default recovery strategy.

### Passing tests does not mean the code is ready to deliver

Tests verify behavior. Comprehension review verifies that a developer can explain and maintain the
result. Dev Flow records both as separate evidence and provides formal `DESIGN` / `REFACTOR` loops for
excess complexity. Repository-changing refactors must pass through `TEST` again.

### Multiple tools create competing cursors

Spec Kit, OpenSpec, Codex, and DeepSeek Harness can all assist development. Dev Flow treats them as
method tools or host adapters. Go Core alone stores the process cursor, transition authority, and
terminal outcome. A successful external command, checked box, or existing artifact may provide
evidence, but does not advance the Task by itself.

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

### Scope and verification boundaries

A Task retains immutable original intent and method profile, plus current requirements, design,
task-plan, implementation, test, comprehension, and delivery authority. Every current Action also
returns:

- node purpose, entry assumptions, and completion conditions;
- `allowed_effects` and `required_evidence`;
- the current verification budget;
- every legal transition and its selection condition.

A material upstream change explicitly invalidates stale downstream authority. A host cannot hide
scope expansion, extra validation, or a future capability inside the current node and then use “tests
passed” as a substitute for the correct process transition.

### Three method profiles

- `plain`: perform the node's semantics with ordinary host development capabilities;
- `spec-kit`: map Spec Kit capabilities to the current node;
- `openspec`: map OpenSpec capabilities to the current node.

All profiles use the same Core graph. External tools help complete the current node; they do not
store a second process cursor.

### Five-class Recovery

Core classifies uncertain mutations as:

```text
not_started
completed_and_recorded
completed_but_unrecorded
partially_completed
conflicting
```

Core decides retry advice, recovery apply, or `BLOCKED`. Resolving a blocker returns the Task to
its recorded resume node.

### Local persistence and read-only Git observation

Tasks, events, evidence, and repository claims are stored in local SQLite. Core may read the
canonical repository, branch, HEAD, index/worktree, and bounded changed paths. A user-authorized host
continues to own Git mutations.

## Products

| Product | Responsibility | Current version |
| --- | --- | --- |
| Core | State graph, Task, Store, Recovery, and MCP | `0.5.0` |
| Codex | Codex Plugin, Skill, registration lifecycle, and bundled Core | `0.5.1` |
| DeepSeek | DSH bundle, Skill, guard, MCP child, and bundled Core | `0.5.1` |

The three products have independent versions. A host package records its actual bundled Core version;
the two product version numbers do not have to match.

## Product guarantees

- Current Task, node, legal transitions, recovery classification, and outcome have one Core authority.
- A Task retains immutable original intent, and material requirement or design changes invalidate
  stale downstream authority.
- Every Task carries a verification budget, and validation scope must directly relate to the current
  node, changed surface, or acceptance criteria.
- Mutations carry revision, action identity, source cursor, and repository binding.
- An uncertain mutation is read before another write action is selected.
- A repository-changing refactor must return through `TEST`.
- `DELIVERY` requires current test evidence and current developer comprehension evidence.
- Core observes Git read-only and exposes no shell or Git mutation.
- Incompatible SQLite data is rejected before write capability is exposed, with zero writes.
- Public Codex and DeepSeek support is established independently by registry-package lifecycle evidence.

## Current product boundary

The current release focuses on one local host, one existing Git repository, and one active Task per
canonical repository root. It does not provide:

- user-defined graphs, a workflow DSL, graph editor, or plugin framework;
- a Web UI, remote MCP, HTTP/SSE, authentication, or telemetry;
- a generic shell, automatic Git repair, commit, push, merge, rebase, or publication;
- multi-repository Tasks, parallel nodes, subtasks, or automatic cross-host takeover;
- pre-graph Task migration, a legacy snapshot decoder, or a compatibility runtime;
- Spec Kit or OpenSpec installation, execution, or document parsing inside Core.

These boundaries keep the current graph deterministic, explainable, and verifiable. A future
capability enters the roadmap only after its user value and independent specification are established.

## Public status

Codex `0.5.1` and DeepSeek `0.5.1` are published to npm with the `codex-v0.5.1` and
`deepseek-v0.5.1` GitHub Releases. Both host products bundle Core `0.5.0` and publicly support
macOS arm64 with Node.js `>=24`.

See the [Support Matrix](SUPPORT-MATRIX_en.md) for exact platform, host version, Journey outcome, and
Release evidence. Current source code, machine-readable schemas, and executable tests define exact
product behavior.
