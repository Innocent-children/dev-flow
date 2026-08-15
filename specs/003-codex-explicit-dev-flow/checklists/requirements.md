# Requirements Quality Checklist: Codex Explicit Dev Flow

**Purpose**: Assess whether the Codex package, explicit Skill, Core delegation, recovery, lifecycle, and evidence requirements are complete, bounded, and ready for implementation review.
**Created**: 2026-08-15
**Feature**: [spec.md](../spec.md)

**Review Ownership**: Reviewer-owned requirements artifact. `[x]` means the requirements-quality criterion is satisfied by the current specification/planning package; it does not mean implementation exists or has passed.

## Product Boundary

- [x] CHK001 The product identity is exactly `dev-flow-codex`, while public scope and publication identity are deferred explicitly.
- [x] CHK002 One private local artifact, one Codex plugin, one `dev-flow` Skill, one STDIO MCP server, and one packaged Core runtime form the complete product boundary.
- [x] CHK003 The package is self-contained for its supported platform and does not depend on a separately installed Dev Flow Core.
- [x] CHK004 The Codex projection is limited to registration, lifecycle ownership, inherited-stdio launch, Skill guidance, and result presentation.
- [x] CHK005 Core Contract 0.1 remains the sole workflow authority and its exact six-tool surface is closed.
- [x] CHK006 Node workflow projection, duplicated state/error logic, generic shell MCP, additional repositories, and cross-host takeover are excluded explicitly.
- [x] CHK007 Public publication, automatic updates, release automation, multi-platform packages, other host surfaces, and DeepSeek work are deferred explicitly.

## Package, Setup, and Removal

- [x] CHK008 npm installation is separated from Codex registration and cannot mutate configuration, repositories, or task data through an install lifecycle hook.
- [x] CHK009 One explicit setup action is required through the currently supported Codex plugin/marketplace mechanism.
- [x] CHK010 Setup preconditions cover platform, Codex compatibility, product/Core version identity, executable runtime, Skill/MCP composition, PATH availability, and safe receipt paths.
- [x] CHK011 Setup success requires supported Codex JSON readback and a schema-validated ownership receipt; repeated matching setup is defined as idempotent.
- [x] CHK012 Setup conflict and partial-failure behavior is fail-closed and bounded to resources created by the current attempt.
- [x] CHK013 Registration metadata is separated from Core task data, with an explicit default data path and an explicit `DEV_FLOW_DATA_DIR` override rule.
- [x] CHK014 Removal reads before mutation, uses only recorded plugin/marketplace identity, preserves adjacent resources, and handles interruption/repetition.
- [x] CHK015 Product deregistration, npm artifact removal, task-data retention, task reopen evidence, and target-repository preservation are distinct and measurable steps.

## Explicit Skill and Authority

- [x] CHK016 Exact current-turn `$dev-flow` selection is an observable precondition rather than an implicit-description assumption.
- [x] CHK017 Empty/conversational input, non-Git input, and multi-repository scope stop before task creation with defined diagnostics.
- [x] CHK018 Read-only Git worktree resolution covers subdirectories, spaces, Unicode, and symlinks without granting Git mutation authority.
- [x] CHK019 `dev_flow_server_info` precedes task discovery and checks product, version, schema, host, transport, health, and the exact tool catalog.
- [x] CHK020 New-task and explicit-resume inputs are distinguished, while Core alone decides create, compatible resume, and conflict outcomes.
- [x] CHK021 Every governed action uses one complete fresh Core result for identity, allowed effects, evidence, payload schema, blocker, recovery, and outcome.
- [x] CHK022 Closed mutation forwarding, caller-retained request identity, and prohibition of aliases/unknown fields/local recovery flags are explicit.
- [x] CHK023 Repository instructions, user authority, verification budget, and actual evidence-source labels remain binding throughout Skill execution.

## Recovery, Outcome, and Evidence

- [x] CHK024 Successful mutations continue only from the returned authoritative result or a fresh Core read.
- [x] CHK025 Missing, cancelled, malformed, truncated, and uncertain mutation results require task and next-action reads before a retry decision.
- [x] CHK026 Operation probes use only retained original values, and unavailable values are never reconstructed or fabricated.
- [x] CHK027 Blocked, conflict, `DONE`, and `CANCELLED` behavior stops at the Core-owned condition/outcome without an adapter completion test.
- [x] CHK028 Fake Codex lifecycle evidence, fake-Core contract evidence, static/package evidence, and native Codex evidence are kept as separate classes.
- [x] CHK029 The fake-Core requirement covers exact tool mapping, closed argument forwarding, complete structured results, and read-before-retry.
- [x] CHK030 The final native journey uses the exact tarball, crosses at least two Core-confirmed action commits, restarts, resumes the same task lineage, respects budget, completes, and removes the product.
- [x] CHK031 The journey evidence model records exact host/platform/version/digests, calls, revisions/actions, lifecycle checks, repository fingerprints, retained data, failures, and skips.

## Dependencies, Measurability, and Simplicity

- [x] CHK032 Feature 002 completion, Core Contract 0.1, the 22 shared fixtures, and auditable aggregate digests are recorded as delivered dependencies.
- [x] CHK033 Current official Codex plugin, Skill, MCP, marketplace, import, and removal sources are linked with an access date.
- [x] CHK034 The minimum Codex version, compatible minor range, exact-version recording rule, and macOS arm64 evidence boundary are explicit without freezing the specification to one patch.
- [x] CHK035 Each of the three user stories has an independent acceptance journey and each success criterion has an observable evidence source.
- [x] CHK036 Edge cases cover registry refresh, missing runtime, stdout contamination, ownership conflicts, concurrent records, unusual paths, truncated results, lost responses, interrupted removal, and policy visibility.
- [x] CHK037 Production dependency count remains bounded to the existing Core and Node.js standard library; no generic framework or second protocol implementation is implied.
- [x] CHK038 The minimal internal build-version seam is justified as self-contained packaging work and explicitly changes no Core public contract, state, transition, or recovery rule.

## Notes

- This built-in checklist records specification quality only; it makes no assertion that product code, tests, packed artifacts, or native-host evidence already exist.
- Reopen an item if later edits make the cited requirement ambiguous, inconsistent, unmeasurable, or incomplete.
- Custom PR review criteria remain separately unchecked in `codex-product-quality.md`.
