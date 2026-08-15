# Feature Specification: DeepSeek Explicit Dev Flow

**Feature Branch**: `004-deepseek-explicit-dev-flow`  
**Created**: 2026-08-14  
**Status**: Planned — bounded Host-local deterministic preparation is authorized before Feature 003
is merged, within the exact file and behavior boundary in FR-003. Shared integration stops at the
003 merge barrier until Feature 003 is merged to `main` and its delivered capabilities are recorded.
Feature completion and stable support remain blocked until an official stable Harness artifact
passes the full direct-result gate and the final journey uses that same stable version/build.
**Input**: Package the shared Dev Flow Core as a thin DeepSeek Harness product that starts or resumes
one single-repository task only when the user explicitly invokes `/dev-flow`.

## User Scenarios & Testing

### User Story 1 — Install and explicitly invoke Dev Flow (Priority: P1)

As a DeepSeek Harness user, I can install one self-contained `dev-flow-deepseek` bundle into an
isolated profile, restart the host, and invoke `/dev-flow` in an existing Git repository without a
separate Dev Flow runtime or target-repository setup.

**Independent deterministic test**: Build and inspect the package with package tests, fake Core,
fake profile/lifecycle fixtures, and journey-harness contracts. No per-story real Harness run is
required.

**Acceptance scenarios**:

1. A supported installed bundle contributes exactly one `dev-flow` Skill and one local STDIO MCP
   integration corresponding one-to-one with the six Core tools.
2. Ordinary coding without `/dev-flow` creates zero Dev Flow tasks.
3. Missing, incompatible, or non-executable packaged Core produces a bounded non-secret diagnostic;
   where the selected Harness supports nonfatal startup, unrelated Harness use remains available.
4. Package/profile/data/evidence files remain outside the target repository.

### User Story 2 — Govern and resume a task (Priority: P2)

As a developer, I can explicitly invoke `/dev-flow`, follow only complete fresh Core authority,
restart Harness, resume the same task, respect its verification budget, and reach the Core-owned
terminal outcome.

**Independent deterministic test**: Use fake Core and journey-harness contracts to prove create,
resume, conflicts, complete-result handling, read-before-retry, budget accounting, restart lineage,
and terminal outcome. Native behavior is established only by the final stable journey.

**Acceptance scenarios**:

1. A new substantive invocation opens `host=deepseek` and follows the fresh Core action.
2. A compatible active DeepSeek task resumes after restart; another host or incompatible contract
   stops with the Core conflict.
3. Every authority field comes from a complete canonical Core result.
4. Preview, spill, prune, truncation, malformed, lost, cancelled, or uncertain mutation output is
   not used as authority; the caller retrieves complete content or performs Core-authorized readback
   before retry.
5. Completion is reported only from the complete Core outcome.

### User Story 3 — Remove without deleting task data (Priority: P3)

As a user, I can remove `dev-flow-deepseek` from its isolated profile, restart Harness, and preserve
shared task data, the target repository, and the already delivered Codex product.

**Independent deterministic test**: Use package/lifecycle fixtures and retained-data integration to
prove product-identity removal, data preservation, reinstall/resume, and bounded Codex-state
comparison logic. Native proof is part of the final stable journey.

**Acceptance scenarios**:

1. Removal deletes only the profile dependency and product-owned bundle layer.
2. A compatible reinstall can discover/resume retained DeepSeek-owned task data.
3. Passing final evidence uses a real co-installed Codex product and proves its package selection,
   registration resources, runtime identity, and shared data are unchanged before/after DeepSeek
   removal. Codex absence is a blocker, not a passing skip.

## Edge Cases

- Feature 003 is not merged or its delivered capability identity cannot be verified.
- Harness changes bundle/profile, Skill, MCP result, add/remove, restart, or stale-metadata behavior.
- No official stable Harness exists.
- A release-candidate direct-result spike passes but the selected stable artifact behaves
  differently.
- Direct MCP results are complete and no proxy is needed.
- Direct complete results cannot be recovered.
- Core exits before MCP initialization.
- The host displays only a preview while complete content is available elsewhere.
- Profile resolution uses a custom home/composed profile path.
- Repository paths contain spaces, Unicode, or symlinks.
- Harness restarts while a mutation response is in flight.
- Profile removal succeeds but stale Skill/tool metadata remains after the supported restart.
- A real Codex co-installation cannot be established for final comparison.
- Parallel preparation reaches a shared file, merged version seam, native Harness execution, final
  artifact, final evidence, support claim, or completion claim before the 003 merge barrier opens.

## Scope Boundaries

### In Scope

- one private `dev-flow-deepseek` product package;
- one explicit `/dev-flow` Skill;
- one official Harness bundle/profile integration;
- one packaged/shared Go Core runtime;
- local STDIO only;
- exact six-tool allowlist;
- one transport-transparent lifecycle launcher;
- task create/resume/apply/read-before-retry loop;
- profile-scoped install/remove;
- deterministic package/fake/retained-data/journey-harness tests;
- optional provisional direct-result spike when no stable artifact exists;
- mandatory full direct-result gate on the exact stable artifact;
- one final stable restart/resume/removal journey on macOS arm64;
- mandatory real Codex non-interference in passing final evidence.
- pre-003-merge Host-local deterministic preparation restricted to the exact FR-003 boundary.

### Out of Scope

- unmerged Feature 003 dependencies;
- separately installed Core backend;
- alternate Core backends or task import/export;
- implicit Skill activation;
- custom UI, panel, settings screen, command family, or agent preset;
- projection proxy without a reviewed amendment;
- proxy-side task/recovery/completion logic;
- generic shell MCP;
- multiple repositories or cross-host takeover;
- Git mutation;
- HTTP/remote MCP, authentication, telemetry, or network service;
- public npm/GitHub publication or automatic update;
- cache deletion;
- Windows/Linux support claims without native evidence;
- per-story real Harness journeys.
- pre-003-merge edits to shared Core/version/protocol/MCP surfaces, shared contract tests, root
  validation, or the lockfile;
- pre-003-merge native Harness gates, final artifacts/journeys/evidence, stable-support claims,
  completion claims, proxies, Core contract changes, or DeepSeek-specific version seams.

## Requirements

### Package and Merged Dependency Baseline

- **FR-001**: Product identity MUST be `dev-flow-deepseek`; publication identity remains Feature
  `006` work.
- **FR-002**: The package MUST contain/select a compatible shared Core runtime and MUST NOT require
  a separately installed Dev Flow Core.
- **FR-003**: Before Feature 003 is merged, Feature 004 MAY perform only the explicitly authorized
  Host-local deterministic preparation slice. Writes MUST remain within
  `specs/004-deepseek-explicit-dev-flow/**`, `packages/deepseek/**`,
  `scripts/build-deepseek-package.sh`, `scripts/run-deepseek-real-journey.sh`, and
  `scripts/validate-deepseek-journey-evidence.mjs`. The slice MAY cover first-party Harness contract
  research, package-local fake Core/bundle/Skill/launcher/runtime tests and source,
  `cordis.patch.yml`, fake-profile journey infrastructure, RC/stable evidence models, and code that
  does not depend on a shared version seam. It MUST NOT edit `internal/version/**`,
  `tests/contract/package_manifest_test.go`, `tests/contract/repository_layout_test.go`,
  `tests/contract/fixture_contract_test.go`, `scripts/validate-repository.sh`, `pnpm-lock.yaml`,
  `protocol/**`, `cmd/**`, `internal/mcp/**`, or Feature 002 contracts. It MUST NOT build a final
  artifact, run a native Harness gate/final journey, write final stable evidence, establish stable
  support/completion, add a proxy, change a Core public contract, or add a DeepSeek-specific version
  seam. After all safe work, it MUST stop at the explicit `003 merge barrier`. Only after completed
  Feature 003 is merged to `main`, latest `main` is merged into the Feature 004 branch without
  rewriting history, and the exact delivered baseline is recorded MAY Feature 004 modify shared
  integration surfaces or perform native/final work. The recorded baseline MUST include the shared
  detached-build version seam, Codex-aware shared package/layout contracts, and Codex-aware root
  validator; Feature 004 MUST consume these delivered capabilities rather than depend on Feature
  003 task numbers, duplicate the seam, or weaken/revert Codex validation.
- **FR-004**: The package MUST use the implementation-time official Harness bundle/profile
  mechanism and register one Skill provider plus one local STDIO MCP integration.
- **FR-005**: Installation MUST NOT run source builds/downloads, mutate repositories/shared task
  data/unrelated profiles, or publish.
- **FR-006**: Removal MUST be by product identity through the supported profile mechanism and MUST
  preserve shared task data, repositories, unrelated profiles, and Codex state.

### Host Compatibility and Stable Evidence

- **FR-007**: A provisional engineering spike MAY use an official release candidate only when no
  stable Harness exists. Its facts MUST be labelled pre-release and MUST NOT establish support.
- **FR-008**: Before final evidence, the latest official stable compatible Harness MUST be selected,
  its exact version/build/integrity and bounded compatible range recorded, and volatile host
  contracts revalidated.
- **FR-009**: The complete direct-result gate MUST be run in full on that exact stable artifact. A
  release-candidate result or evidence from a different stable artifact MUST NOT substitute.
- **FR-010**: The final native journey MUST use the same exact stable Harness version/build that
  passed the stable direct-result gate.

### Runtime, Environment, and Failure

- **FR-011**: The package MUST use a newly constructed closed Core-child environment and MUST NOT
  forward the complete Harness environment.
- **FR-012**: The launcher MUST spawn the package-relative Core without a shell, forward raw STDIO,
  propagate EOF/signals/cancellation, reap the child deterministically, open no listener, and make no
  network request.
- **FR-013**: Startup failures MUST be bounded and non-secret; no infinite reconnect/respawn loop is
  allowed.

### Skill and Authority

- **FR-014**: The package MUST expose exactly one user-facing Skill named `dev-flow`.
- **FR-015**: The Skill MUST be user-invocable, not model-invocable, and activate only through the
  explicit `/dev-flow` token.
- **FR-016**: Empty/conversational, ordinary, non-Git, and multi-repository requests MUST stop before
  task creation.
- **FR-017**: `dev_flow_server_info` MUST precede discovery/mutation and require compatible Core
  Contract 0.1 plus exactly the six raw tools.
- **FR-018**: The Skill MUST use complete fresh Core action, binding, schema, allowed effects,
  evidence requirements, recovery, blocker, and outcome as authority.
- **FR-019**: New tasks MUST use `host=deepseek`; compatible same-host tasks resume and all conflicts
  remain Core decisions.
- **FR-020**: Skill, provider, launcher, and any later approved proxy MUST NOT encode task state,
  phase/action catalogs, transitions, claims, error reinterpretation, recovery classification, or
  terminal rules.

### Direct Results and Conditional Proxy

- **FR-021**: Direct native MCP consumption is the only authorized result path in the current plan.
- **FR-022**: The direct-result gate MUST cover complete inline success, complete domain error,
  near-spill, spilled, pruned/compacted, and near-Core-limit results.
- **FR-023**: Preview/spill/prune/truncation/malformed markers MUST be detected before authority use;
  each case passes only when official retrieval yields identical expected/recovered bytes and
  SHA-256 plus a complete parse.
- **FR-024**: A projection proxy MAY be specified only after an observed gate failure and a reviewed
  specification/plan/contract/test/Constitution amendment. Failure does not automatically authorize
  implementation.

### Recovery, Verification, and Final Journey

- **FR-025**: Uncertain mutation results MUST retain original request/action values and trigger the
  exact Core-defined readback/operation probe before retry.
- **FR-026**: Verification MUST respect the Core budget and label automated, manual, simulated,
  pre-release native, stable native, skipped, and unverified evidence accurately.
- **FR-027**: Story checkpoints MUST use deterministic/fake/integration evidence only. No per-story
  real Harness journey is permitted.
- **FR-028**: After stable Gate B, complete deterministic checks, root validation, read-only scope
  audit, and source freeze, exactly one final artifact MUST be built and used for one real stable
  journey covering install/restart, explicit task, two Core commits, restart/resume, budgeted
  `DONE`, removal/restart, retained data, compatible reinstall, repository comparison, and mandatory
  Codex non-interference.

## Key Entities

- **Feature 003 Delivered Baseline**: Exact merged commit and capabilities consumed by Feature 004.
- **DeepSeek Product Package**: Private Harness bundle containing host resources and packaged Core.
- **Harness Artifact Selection**: Exact provisional or stable official Harness artifact.
- **Harness Profile Installation**: Observed product dependency and bundle layer in an isolated
  profile.
- **Direct Result Observation**: Complete-result evidence for one case on one exact Harness artifact.
- **DeepSeek Journey Evidence**: Final stable artifact/host evidence including Codex
  non-interference.

## Success Criteria

- **SC-001**: The package adds one Skill and one six-tool native MCP integration without external
  Core installation or target-repository files.
- **SC-002**: An ordinary prompt without `/dev-flow` creates zero tasks.
- **SC-003**: The host-facing catalog corresponds one-to-one with the six raw Core tools.
- **SC-004**: The final stable journey crosses at least two Core action commits, restarts Harness,
  resumes the same task lineage, and reaches `DONE`.
- **SC-005**: Adapter source contains zero task writes and zero transition/recovery/completion
  decisions; proxy presence is `none` unless a later approved amendment changes the feature.
- **SC-006**: The final stable journey stays within the automatic verification budget.
- **SC-007**: Final passing evidence proves removal preserves task data/repository and leaves a real
  co-installed Codex product unchanged; absence of Codex makes the final record blocked, not pass.
- **SC-008**: Support claims are limited to the recorded compatible stable Harness range and macOS
  arm64 evidence; exact version/build and every failure/skip are recorded.

## Assumptions

- Feature 002/Core Contract 0.1 is merged.
- Feature 003 is fully implemented and merged before Feature 004 crosses the 003 merge barrier;
  only the bounded FR-003 Host-local deterministic preparation slice may run earlier.
- The planning-time Harness artifact is pre-release and may be used only for labelled provisional
  engineering evidence.
- Direct Core MCP is preferred; no proxy is currently authorized.
- Public release and platform expansion belong to Feature 006.
