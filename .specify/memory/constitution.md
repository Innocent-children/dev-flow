<!--
Sync Impact Report
- Constitution version: 2.0.0 → 3.0.0
- Amendment date: 2026-08-20
- Reason for MAJOR:
  - 公开发布不再创建独立 Release Feature 或执行完整 Spec Kit Feature 生命周期；
  - 发布改由轻量、可恢复的一键命令治理，并显式区分 `quick` 与 `normal`；
  - 每次发布前，Host 必须建议模式并询问维护者选择，随后先提交版本对齐再发布。
- Preserved invariants:
  - Go Core 仍是唯一任务与流转权威；
  - Git 仍只读；
  - mutation 仍使用 revision、action identity 与 read-before-retry；
  - SQLite 当前代任务、repository claim、证据预算和稳定错误仍保持严格；
  - `1.0.0` 前历史任务兼容改为显式 opt-in，Feature 008 明确不兼容任何 Core Contract 0.1 历史任务数据；
  - MCP 工具数量仍限制为六个；
  - Codex/DeepSeek 适配器仍不得复制 Core 语义。
- Modified principles:
  - X. Vertical-Slice Specifications and Release Separation → X. Vertical-Slice Specifications and Lightweight Release Execution
- Breaking transition authority:
  - `specs/008-refactor-to-development-process-graph/` 是用开发过程状态图替换 Core Contract 0.1
    线性运行时的唯一批准规格。
  - 已发布 `0.3.0`、Tag、npm 包、GitHub Release、制品摘要和历史 Feature 证据保持冻结。
  - Feature 008 不提供历史任务迁移、读取、继续或转换；旧数据目录只允许安全拒绝并由用户显式
    归档、改名或删除后重新开始。
  - Feature 008 完成前，现有 Core Contract 0.1 可继续运行；不得再向旧线性阶段模型增加新能力。
- Required follow-up:
  - `AGENTS.md`
  - `docs/SPEC-KIT-WORKFLOW.md` and Spec Kit templates/checklists
  - `scripts/release-codex.mjs` and release contracts/tests
  - `release/README.md` and current product/release documentation
  - `.specify/templates/*.md`
  - `MANIFEST.md`
- Affected active features:
  - None; completed Feature 009 remains frozen historical evidence.
-->
# Dev Flow Constitution

## Core Principles

### I. Developer-Visible Process Navigation

Dev Flow MUST make the governed development process visible to the developer. Every active task MUST
expose, through one authoritative Core read:

- the current process definition and version;
- the current node;
- the node's purpose, entry assumptions, completion conditions, allowed effects, and required evidence;
- the closed set of legal outgoing transitions;
- the condition for choosing each transition;
- whether a transition requires an explicit reason;
- the method-tool operations recommended for the selected task profile.

A developer or host MUST NOT need to reconstruct the next step from chat history, repository
conventions, Spec Kit/OpenSpec memory, or adapter-owned state.

Rationale: process management has value only when the developer can always answer “where am I,
what must be completed, and where may I go next?”

### II. Single Process Authority

The Go Core MUST be the sole authority for:

- task identity, immutable original intent, verification authority, and selected method profile;
- versioned requirements, design, task-plan, verification, and comprehension baselines;
- process definition identity and version;
- current node and resume node;
- node contract;
- allowed transitions and transition guards;
- next-action identity;
- repository claim;
- recovery classification;
- blocker state;
- terminal outcome.

CLI, MCP, Codex, DeepSeek, Spec Kit guidance, OpenSpec guidance, and package scripts are adapters or
execution aids over that authority. They MUST NOT independently persist a cursor, add a hidden
transition, infer completion, or select a destination not returned by Core.

Rationale: a process graph with more than one authority becomes a suggestion rather than a reliable
development-management system.

### III. One Bounded Standard Development Graph

New tasks MUST use one built-in standard development process graph. Before `1.0.0`, its normal nodes
are bounded to:

```text
REQUIREMENTS
DESIGN
TASKS
IMPLEMENT
TEST
COMPREHENSION_REVIEW
REFACTOR
DELIVERY
DONE
```

`BLOCKED` and `CANCELLED` are exceptional nodes and are excluded from the normal-node count.

The graph MUST support explicit backward and looping transitions required by real development,
including requirement correction, redesign, implementation rework, failed testing, comprehension
failure, refactoring, regression testing, and delivery rejection. It MUST NOT contain an
adapter-only fast path or permit arbitrary node skipping.

Feature 008 intentionally removes the released linear runtime from the new Core contract. The
implementation MUST NOT retain a compatibility process, v1 snapshot codec, dual task projection, or
historical-task continuation path. A pre-graph database is rejected with zero writes until the user
explicitly selects a fresh data directory or archives/renames/deletes the old data outside Core.
Core and package lifecycle commands MUST NOT erase it automatically.

A user-configurable workflow DSL, arbitrary graph upload, or multiple selectable product workflows
is prohibited before a separate accepted specification and Constitution amendment.

Rationale: the product needs a real graph rather than a linear ceremony, while remaining small,
deterministic, and supportable.

### IV. Human Comprehensibility Is a Delivery Gate

Passing automated tests is necessary evidence, but it is not sufficient for delivery. The standard
graph MUST include a distinct `COMPREHENSION_REVIEW` node that evaluates whether the implemented
design, code, and supporting documentation are understandable and proportionate to the requirement.

When a developer cannot reasonably understand or maintain the result, the task MUST have an
authoritative route to `REFACTOR`, `DESIGN`, `TEST`, or another earlier node. Refactoring MUST return
through `TEST` before delivery when repository behavior or code structure changed.

The product MUST NOT treat “the AI produced code” or “tests passed” as proof that the change is
maintainable.

Rationale: AI-generated complexity is a product failure mode, not a personal failure of the
developer.

### V. Method Tools Are Guidance, Not Workflow Authority

A task MAY select one closed method profile:

```text
plain
spec-kit
openspec
```

The profile is immutable for that task and maps Core-owned semantic method steps to external
tooling guidance. Core owns the semantic step; adapters may render the exact supported command or
instruction for the installed tool.

Spec Kit and OpenSpec MUST NOT become runtime state stores, transition authorities, or hidden
dependencies of Core. Missing, outdated, or unavailable method tooling MUST be reported honestly
and MUST NOT fabricate node completion. A task may continue only through behavior explicitly
permitted by its profile and current node contract.

Rationale: Dev Flow should tell developers how Spec Kit or OpenSpec fits into the current step
without outsourcing process truth to either tool.

### VI. Recovery Before Retry

Every mutation MUST carry a revision, action identity, source process/node identity, and repository
binding. When a mutation response is missing, cancelled, truncated, malformed, or otherwise
uncertain, the caller MUST read the authoritative task and current action before deciding whether
another mutation is safe.

Blind mutation replay is prohibited. Recovery MUST continue to classify reality as one of:

```text
not_started
completed_and_recorded
completed_but_unrecorded
partially_completed
conflicting
```

A graph transition, including a backward transition, MUST be committed at most once. Recovery
requirements apply to tasks created by the current graph contract; pre-graph tasks are unsupported.

Rationale: loops make duplicate side effects more dangerous, not less dangerous.

### VII. Read-Only Repository Boundary

The Core MAY inspect an existing Git repository and calculate a bounded structured fingerprint. It
MUST NOT create, switch, repair, reset, clean, stash, commit, merge, rebase, push, tag, publish, or
delete Git state. It MUST NOT expose a generic shell tool.

Host agents perform explicitly authorized development work with their normal tools and submit
bounded results to Core. Method-tool guidance does not expand Core's operating-system authority.

Repository development tooling may mutate this product repository only under explicit maintainer
authority and an active implementation specification. Release tooling may mutate Git/npm/GitHub only
under explicit maintainer authority, an exact target version, a selected release mode, and the
release command's confirmation contract. Such tooling is not Core runtime behavior and MUST NOT be
exposed through MCP.

Rationale: Dev Flow governs development; it does not replace Git or become an ambient executor.

### VIII. Evidence-Bounded Verification

Every task MUST carry a verification budget. Automated checks MUST be directly connected to the
active node, changed surface, acceptance criteria, or recovery risk.

A full suite, platform matrix, stress test, fuzz test, or real-host journey requires an explicit
requirement or final checkpoint. Fake, simulated, static, host-observed, user-performed, and native
automated evidence MUST retain distinct labels.

Targeted tests SHOULD run at node or user-story checkpoints. Repository-wide validation MUST NOT run
after every small edit and MUST run at most once for a final feature checkpoint unless the active
specification records a concrete reason for a retry.

Rationale: excessive validation can obscure the process just as much as insufficient validation.

### IX. Proven Simplicity

New abstraction or configuration requires demonstrated need:

- no generic process engine beyond what the one standard graph requires;
- no user-defined node, edge, guard, policy, or tool profile;
- no interface before two real implementations require it, except existing Store and
  RepositoryObserver ports;
- no new recovery classification without an observed failure or accepted threat model;
- no direct production dependency unless standard-library implementation is unreasonable and the
  dependency removes more complexity than it introduces;
- no public feature added only for a future host, future workflow, or hypothetical platform.

Any exception MUST be listed in the active plan's Complexity Tracking table and approved before
implementation.

Rationale: a process-management product must not become the over-engineered artifact it is intended
to prevent.

### X. Vertical-Slice Specifications and Lightweight Release Execution

Every production feature MUST be self-contained and deliver one independently demonstrable user
capability. It MUST include explicit non-goals, measurable success criteria, a bounded test plan,
persisted-data disposition, and exact affected contracts.

State-graph features MUST additionally define:

- affected nodes;
- complete outgoing transitions for each affected node;
- transition reasons and guards;
- node completion obligations;
- method-profile effects;
- persistence transition and exact disposition of pre-existing task data;
- forbidden transitions.

Product implementation and public release are separate operations. A product feature MUST NOT
publish npm, create or move a Tag, create or finalize a GitHub Release, or rewrite historical
release evidence. Product versions change only after the included product work is complete and the
maintainer explicitly invokes the release command with a target version, release mode, and exact
confirmation.

A version publication MUST NOT create a new Feature. Release intent is carried by the completed
product work, the version-alignment commit, the selected `quick` or `normal` mode, the reviewed
release contracts, the retained external publication record, and the public Tag/npm/GitHub Release.
If a release requires new product behavior, that behavior MUST be specified and completed in a
Product Feature before the release command runs.

Before version mutation, the Host MUST recommend `quick` or `normal`, explain the eligibility reason,
and ask the maintainer to choose. `quick` is admitted only when the changed surface is outside the
distributed product/runtime contract or is limited to approved version metadata; an ineligible
`quick` request MUST stop rather than silently weaken verification. `normal` is required for Core,
MCP, Schema, process, persistence, Host Adapter, packaged Skill/library, package-layout, platform, or
support changes.

Both modes MUST first align all current version authorities, create and push one version commit on a
clean `main`, and only then prepare or resume publication. Both modes retain exact confirmation,
deterministic artifacts, registry and asset read-back, immutable Tag/npm rules, atomic publication
state, and read-before-retry. `quick` may use a bounded final-artifact smoke only when its admission
proof shows no product-contract change; `normal` requires the complete final registry-package
Journey and current human comprehension evidence.

Rationale: a functional change should not become an accidental publication project, and a release
should not redefine product behavior.

### XI. Shared-Contract Host Parity

Any change to public task semantics, process/node schemas, transition schemas, error codes, result
envelopes, persisted task meaning, or recovery behavior MUST be validated against both Codex and
DeepSeek contract fixtures before merge.

Host-specific products may be implemented and released independently when they do not alter shared
semantics, the unsupported host remains explicit, and evidence for one host is not promoted into
support for another. An adapter MUST NOT patch around a Core contract mismatch.

A Codex-only stable release is permitted when the shared Core contract is host-neutral and Codex has
final-artifact evidence. DeepSeek support is not a mandatory blocker for Core or Codex `1.0.0`; it
becomes a support claim only after its own public package and real-host evidence exist.

Rationale: shared semantics require parity, while product maturity must not be held hostage by an
unavailable external host.

## Product and Technology Constraints

- The Core implementation language is Go.
- The persistent store is one local SQLite database accessed through a CGo-free driver.
- Before `1.0.0`, historical task compatibility is NOT a default requirement. When a Product Feature
  changes persisted task meaning, `reject-and-reset` is the default disposition unless the user's
  explicit requirement justifies migration or retained historical runtime. A breaking generation MUST
  reject old data with zero writes, document the fresh-data boundary, prohibit automatic deletion,
  and contain no migration, import/export, decoder, dual projection, or legacy runtime solely for
  compatibility.
- The transport is local STDIO MCP only.
- The first product journey supports one existing Git repository and one active task per canonical
  repository root.
- The public MCP tool catalog remains exactly six tools unless this Constitution is amended.
- The graph-based Core supports only the built-in `standard-development` process. Feature 008
  intentionally does not read, resume, convert, or complete pre-graph tasks.
- Method profiles are limited to `plain`, `spec-kit`, and `openspec`.
- Spec Kit and OpenSpec are repository-development aids, not Core runtime dependencies.
- The repository contains one root `.specify/` project and one Constitution.
- Before the first stable release, the project MUST NOT implement arbitrary process graphs,
  data import/export, multi-repository tasks, cross-host automatic takeover, Web UI, remote MCP,
  authentication, telemetry, agent orchestration, Git mutation, or a plugin framework.
- Current product/package versions remain unchanged during ordinary feature implementation.
  Version, package, embedded Core, Tag, and Release identity are aligned by the explicitly selected
  release mode after product work is complete. The version-alignment commit precedes all remote
  publication effects.
- Every release starts from one user-owned mode decision: `quick` or `normal`. The Host MUST suggest
  and ask; it MUST NOT choose or publish before the maintainer answers.
- Historical released or incident-frozen Tags, Drafts, Releases, artifact digests, publication
  records, fixtures, and recovery identities remain immutable.

## Spec Kit Documentation Standard

A public-behavior, shared-contract, persistence, process-graph, or adapter-contract change MUST have
one complete feature package:

```text
specs/<NNN-feature-name>/
├── README.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
├── checklists/requirements.md
└── tasks.md
```

The repository-specific artifact responsibilities, lifecycle, status vocabulary, change
classification, and amendment rules are authoritative in `docs/SPEC-KIT-WORKFLOW.md`.

Historical completed Feature packages are evidence and MUST NOT be rewritten to match a later
template. Corrections to historical factual claims require a dedicated amendment that preserves the
original release identity and explains the correction.

Version-only publication does not create a Feature package. Its authority and evidence are the
completed included Product Feature or corrective work, explicit mode choice, version commit,
release contracts, external `release-manifest.json` and `publication-record.json`, immutable public
identities, and final read-back. Repository documentation may summarize a completed release, but it
MUST NOT recreate the publication as a Feature lifecycle.

## Development Workflow and Quality Gates

Every full production feature follows:

1. `specify`
2. `clarify`
3. `plan`
4. `checklist`
5. `tasks`
6. `analyze`
7. staged `implement`
8. `converge`

An already complete feature package begins at `clarify`; existing artifacts MUST NOT be regenerated
without an explicit amendment decision.

Before implementation:

- the active feature is selected explicitly;
- its `README.md` identifies status, dependencies, authority, and execution boundary;
- the requirements checklist is reviewed;
- no unresolved clarification marker remains;
- the Constitution Check passes before and after design;
- every task names exact files or directories and requirement IDs;
- node and transition contracts are complete for every affected state;
- the exact persisted-data disposition is explicit: migrate, retain read-only, reject, or require a user-controlled reset;
- release operations are absent from Product Feature implementation; later publication uses the
  standalone release command after an explicit mode choice.

During implementation:

- implement one phase or user story at a time;
- stop at its checkpoint;
- run only the targeted checks required by that slice;
- update the specification before expanding behavior;
- use `$speckit-converge` only to capture concrete acceptance gaps.

Before merge:

- required targeted tests pass;
- shared contract fixtures pass;
- persistence bootstrap, unsupported-data zero-write rejection, and current-generation restart/recovery pass when storage changes;
- no unauthorized node, edge, tool, dependency, platform, host support, or release side effect
  appears in the diff;
- documentation reflects delivered behavior;
- `$speckit-converge` finds no acceptance gap or appends a bounded remaining task;
- the final repository-wide validation runs no more than the active specification authorizes.

Before release:

- the included product work is complete and merged;
- the Host recommends a mode and the maintainer explicitly chooses `quick` or `normal`;
- the release command proves the chosen mode is eligible before version mutation;
- all current version authorities are aligned in one pushed version commit on clean `main`;
- every included product is built from that one source identity;
- final distributed artifacts and the evidence required by the chosen mode are verified;
- no release side effect occurs from ordinary feature or pull-request validation.

## Transition Rule for Core Contract 0.1

The published `0.3.0` Core Contract 0.1 implementation may remain operational while Feature 008 is
planned and implemented. During this transition:

- no new product feature may extend the old phase or result vocabulary;
- bug fixes required to preserve existing `0.3.0` behavior remain permitted and must not pre-decide
  Feature 008 design;
- Feature 008 deliberately provides no runtime compatibility for `0.3.0` task databases;
- the graph Core creates only fresh Schema 2 data and rejects Schema 1 with zero writes;
- users who wish to preserve old files must do so outside the active data root; before using the
  graph Core they explicitly select a fresh directory or archive/rename/delete the old directory;
- Core, setup, update, remove, and uninstall must not perform that destructive reset automatically;
- new state-graph tasks must not be created until the complete Core Contract 0.2 gate passes;
- public release remains a separate, later decision.

## Governance

This Constitution supersedes conflicting plans, tasks, prompts, conventions, and implementation
preferences.

- **Authority**: Principles I–XI are binding gates. Conflicting specifications, plans, or tasks MUST
  be corrected instead of weakening the Constitution merely to unblock implementation.
- **Amendments**: An amendment requires a sync-impact report, rationale, affected active features,
  persistence implications, exact data disposition, and explicit maintainer approval.
- **Versioning**: Constitution versions follow SemVer. MAJOR removes or redefines a binding
  principle; MINOR adds or materially expands a principle; PATCH clarifies without changing
  meaning.
- **Compliance review**: Every feature plan MUST include a Constitution Check. Every review MUST
  identify any complexity-budget exception. Every release MUST record mode eligibility and the
  maintainer's explicit selection before the version commit.
- **Specification locality**: Only this Constitution, active Product Feature artifacts, and the
  user's current explicit instruction authorize product work. Version-only release authority comes
  from the completed product work plus the exact release invocation; no release Feature is created.
- **Transition authority**: `specs/008-refactor-to-development-process-graph/` is the only approved
  breaking replacement specification from the linear runtime to the standard development graph.

**Version**: 3.0.0 | **Ratified**: 2026-08-14 | **Last Amended**: 2026-08-20
