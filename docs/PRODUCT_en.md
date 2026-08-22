# Dev Flow Product Definition

[中文](PRODUCT.md) | [English](PRODUCT_en.md)

## One-line definition

Dev Flow is the navigation and recovery layer for AI-assisted development. It places each task in a
Go Core-managed state graph and continuously exposes the current node, completion conditions,
evidence requirements, and every legal next transition.

## Intended users

Dev Flow serves developers and teams that want AI to participate deeply in real repositories while
developers retain process control. These tasks commonly cross requirement clarification, design
choices, implementation rework, failed tests, context switches, and delivery review—facts that chat
history alone cannot reliably preserve.

## Problems it solves

### Development work loses its place

A host may skip requirements or design, or deliver hard-to-maintain code immediately after tests
pass. Dev Flow gives every node an explicit purpose, entry assumptions, completion conditions,
allowed effects, and required evidence.

### Multiple tools create competing cursors

Spec Kit, OpenSpec, Codex, and DeepSeek Harness can all assist development. Dev Flow treats them as
method tools or host adapters. Go Core alone stores the process cursor, transition authority, and
terminal outcome.

### Replaying an interrupted mutation can duplicate effects

When a mutation result is uncertain, Dev Flow reads the recorded operation, Task, and repository
binding before deciding whether recovery is needed. Callers do not have to infer success from a
partial output stream.

### Passing tests does not prove maintainability

Tests verify behavior. Comprehension review verifies that the developer can explain and maintain the
result. Dev Flow records both as separate evidence and provides a formal refactoring loop for excess
complexity.

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

### Current authority baselines

A Task retains immutable original intent and method profile, plus current requirements, design,
task-plan, implementation, test, comprehension, and delivery authority. A material upstream change
explicitly invalidates stale downstream authority.

### Three method profiles

- `plain`: perform the node's semantics with ordinary host development capabilities;
- `spec-kit`: map Spec Kit capabilities to the current node;
- `openspec`: map OpenSpec capabilities to the current node.

All profiles use the same Core graph. A successful external command, checked box, or existing
artifact may provide evidence, but does not advance the Task by itself.

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
