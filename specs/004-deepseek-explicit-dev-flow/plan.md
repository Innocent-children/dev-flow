# Implementation Plan: DeepSeek Explicit Dev Flow

**Branch**: `004-deepseek-explicit-dev-flow`  
**Date**: 2026-08-15  
**Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/004-deepseek-explicit-dev-flow/spec.md`

## Summary

Deliver one private `dev-flow-deepseek` Harness bundle containing exactly one explicit-only
`dev-flow` Skill, one native local STDIO MCP integration, one package-relative macOS arm64 Go Core
runtime, and a small transport-transparent JavaScript launcher.

Feature 004 may begin with one bounded pre-merge Host-local deterministic preparation slice. That
slice is confined to Feature 004 docs, `packages/deepseek/**`, and the three DeepSeek-owned scripts;
it cannot consume or modify unmerged shared capabilities, run native/final evidence, or establish
support/completion. It stops at the explicit 003 merge barrier. After Feature 003 is merged, Feature
004 merges latest `main`, records the exact baseline, and consumes the delivered detached-binary
version seam, Codex-aware shared contract tests, and root validator without referring to Feature
003 task numbers, duplicating shared files, or weakening Codex behavior.

Direct native MCP consumption is the only authorized result path. A provisional release-candidate
spike may provide engineering evidence when no stable Harness exists, but final support requires the
complete direct-result gate to pass again on the exact official stable Harness version/build used by
the final journey.

Exact inspection of `@deepseek-ai/dsh-mcp-client@0.1.0-rc.6` found that it registers discovered MCP
tools directly on the global Harness tool registry and exposes no reviewed invocation-scoping
configuration. This is an RC6 capability gap, not a conclusion about a future stable artifact.
Skill metadata/prose cannot close it. Explicit-only Host integration remains pending until the
selected artifact provides a verified Host-enforced visibility/authorization mechanism; no proxy
or Core change is authorized as a workaround.

User-story implementation is verified with deterministic package, fake-Core, fake-profile,
retained-data, and journey-harness checks. No story phase starts a real Harness host. Native
execution is limited to:

1. one optional provisional direct-result spike when no stable artifact exists;
2. one mandatory full direct-result gate on the selected stable artifact; and
3. one final stable end-to-end journey.

The final artifact is built only after stable Gate B, all deterministic checks, root validation, a
read-only pre-final audit, and source freeze. The final journey uses that exact artifact and includes
mandatory real Codex non-interference.

## Technical Context

**Core language/toolchain**: Go 1.26 or repository-pinned compatible toolchain  
**Host glue**: Node.js `>=24`, ECMAScript modules  
**Harness dependencies**: only implementation-time official first-party packages needed for bundle,
Skill, and native MCP composition  
**Transport**: local STDIO only  
**Storage**: Core-owned SQLite under explicit `DEV_FLOW_DATA_DIR`, otherwise documented macOS default  
**Target platform**: macOS arm64  
**Compatibility**: exact stable artifact and bounded range selected during implementation  
**Result bound**: prove complete canonical results through the Core 1,048,576-byte envelope limit  
**Publication**: prohibited

## Constitution Check

| Principle | Result | Evidence |
|---|---|---|
| I. Self-Contained Product Scope | PASS | One bounded DeepSeek package and install-to-remove journey. |
| II. Single Workflow Authority | PASS | Core alone owns task, action, claim, recovery, budget, and outcome. |
| III. One State Machine, Bounded Surface | PASS | Exactly six raw Core tools; no alternate catalog. |
| IV. Thin Host Adapters | PASS | Bundle, Skill, closed launcher, and package evidence only; the RC6 Host-scoping gap stops rather than adding an adapter gate. |
| V. Recovery Before Retry | PASS | Incomplete/uncertain mutation output triggers complete retrieval or Core readback. |
| VI. Read-Only Repository Boundary | PASS | Package/profile/data/evidence remain outside the target repository; Core does not mutate Git. |
| VII. Evidence-Bounded Testing | PASS | Deterministic story checkpoints, bounded direct-result gates, one final journey. |
| VIII. Proven Simplicity | PASS | Native MCP plus one raw launcher; no proxy/framework/network layer. |
| IX. Vertical-Slice Specifications | PASS | Three independently testable stories without repeated native journeys. |
| X. Two-Host Contract Parity | PASS | Feature 004 consumes the merged Feature 003/Core baseline and proves Codex non-interference. |

No constitutional exception is requested.

## Gate -1 — Bounded Parallel Preparation

Before Feature 003 is merged, the only writable paths are:

```text
specs/004-deepseek-explicit-dev-flow/**
packages/deepseek/**
scripts/build-deepseek-package.sh
scripts/run-deepseek-real-journey.sh
scripts/validate-deepseek-journey-evidence.mjs
```

Allowed work is limited to first-party Harness contract research/records, package-local fake Core
and bundle/Skill/launcher/runtime tests and source, `cordis.patch.yml`, fake-profile journey
infrastructure, RC/stable result-evidence models, and Host-local code that does not depend on the
shared version seam. All execution in this slice is static, fake, simulated, or deterministic; no
real Harness process is started.

The slice cannot edit `internal/version/**`, any of the three shared contract tests,
`scripts/validate-repository.sh`, `pnpm-lock.yaml`, `protocol/**`, `cmd/**`, `internal/mcp/**`, or
Feature 002 contracts. It cannot build a final artifact, run provisional/stable native Gate B or the
final journey, write final stable evidence, claim stable support/completion, add a projection proxy,
change a Core contract, or invent a DeepSeek-specific Core version seam.

After the safe tasks and their targeted tests converge, work stops at the **003 merge barrier** with
a clean worktree. The barrier opens only after completed Feature 003 is merged to `main`, latest
`main` is merged into the Feature 004 branch with history preserved, the exact baseline is recorded,
and `$speckit-analyze` finds no new CRITICAL/HIGH cross-feature issue.

## Gate 0 — Merged Feature 003 Baseline

Shared integration and native/final implementation may not begin from a sibling or unmerged Feature
003 branch. Gate -1 preparation does not satisfy or bypass this gate.

Record in `evidence/direct-consumption.md`:

- the Feature 003 merge commit on `main`;
- SHA-256/source identity for the merged `internal/version` seam and tests;
- identity of merged Codex-aware package manifest/layout contracts;
- identity of merged Codex-aware root validator;
- root `VERSION`, Core source commit, and shared fixture aggregate;
- targeted verification results from that exact baseline.

Feature 004 must not:

- reference Feature 003 T005/T006 or any mutable task number as a dependency;
- edit/duplicate `internal/version` to implement a DeepSeek-specific seam;
- replace shared contract tests from an older baseline;
- weaken Codex package/layout/root-validator behavior.

If the merged baseline is insufficient, stop and amend the owning Feature 003/Core specification
before continuing.

## Gate A — Official Harness Selection

At implementation start and immediately before final support evidence:

1. inspect official registry/repository metadata;
2. identify stable and pre-release artifacts;
3. record exact package version/build/integrity/source evidence;
4. select a bounded compatible range;
5. revalidate bundle/profile, Skill, MCP result, add/remove/restart, and stale-metadata behavior;
6. prove the Host itself keeps the six MCP tools unavailable outside the explicit `/dev-flow`
   invocation context.

When no stable artifact exists, one provisional engineering spike may use the latest reviewed
release candidate. It is labelled `pre-release-native` and cannot establish support.

RC6 currently fails the sixth selection condition because its MCP client registers all discovered
tools globally and has no reviewed Skill-invocation scope option. Do not infer that a future stable
artifact behaves the same; revalidate its exact implementation. If the selected artifact still
lacks enforcement, stop for a Feature 004 amendment without building an adapter proxy or changing
Core.

Before final evidence, select the latest official stable compatible artifact. If no stable artifact
exists, final stable Gate B, final artifact support claim, and final journey remain blocked. Accepting
an RC as final support requires a specification amendment.

## Gate B — Direct Authoritative Result Completeness

The gate must cover six cases:

1. inline success;
2. complete domain error / MCP `isError`;
3. near-spill;
4. spilled;
5. pruned/compacted;
6. near the Core 1,048,576-byte envelope limit.

For every case record:

- exact Harness artifact selection;
- canonical Core byte count and SHA-256;
- observed host representation and incomplete marker detection;
- exact official retrieval mechanism;
- recovered byte count and SHA-256;
- complete envelope/authority parse result.

A case passes only when expected and recovered bytes/digests match and the complete result parses.
Display text that appears sufficient is not proof.

### Provisional Gate B

When stable is unavailable, an RC may pass a provisional Gate B and unblock deterministic
host-specific implementation. It does not satisfy stable support.

### Mandatory Stable Gate B

After selecting the exact stable artifact, all six cases must have complete evidence from that
exact artifact. When Phase 2 already ran the full gate on the same exact stable artifact and Gate A
confirms the contract and artifact identity remain current, that evidence may be revalidated and
reused. A prior RC pass, a different stable artifact, static inspection, or small-result tests cannot
substitute and requires a full execution.

If stable Gate B fails:

- stop implementation finalization;
- do not build the final artifact;
- do not add a proxy;
- prepare a reviewed spec/plan/contract/test/Constitution amendment.

The exact stable artifact that passes this gate is the only Harness version/build allowed for the
final journey.

## Gate C — Runtime, Environment, and Ownership

Package/fake/native evidence proves:

- package-relative Core selection only;
- closed environment containing only approved keys;
- shell-free raw STDIO, no listener, no network;
- bounded redacted diagnostics and deterministic child cleanup;
- package/profile/data/build/evidence roots outside the target repository;
- removal preserves Core data and repositories;
- passing final removal leaves a real co-installed Codex package/registration/runtime/shared-data
  state unchanged.

Codex comparison is mandatory for a passing final record. When a real co-installation cannot be
established, final evidence is blocked/failed, not pass-with-skip.

## Project Structure

### Documentation

```text
specs/004-deepseek-explicit-dev-flow/
├── README.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── deepseek-bundle.md
│   └── skill-and-mcp.md
├── checklists/
│   ├── requirements.md
│   └── deepseek-host-readiness.md
├── evidence/
│   ├── direct-consumption.md
│   └── real-journey.md
└── tasks.md
```

### Planned source and verification changes

```text
packages/deepseek/
├── README.md
├── package.json
├── cordis.patch.yml
├── src/
│   ├── index.mjs
│   ├── runtime.mjs
│   └── launch-core.mjs
├── skills/dev-flow/SKILL.md
└── tests/
    ├── fixtures/fake-core.mjs
    ├── bundle.test.mjs
    ├── direct-consumption.test.mjs
    ├── fake-core.test.mjs
    ├── journey-harness.test.mjs
    ├── launch-core.test.mjs
    └── skill.test.mjs

scripts/
├── build-deepseek-package.sh
├── run-deepseek-real-journey.sh
├── validate-deepseek-journey-evidence.mjs
└── validate-repository.sh

pnpm-lock.yaml
tests/contract/package_manifest_test.go
tests/contract/repository_layout_test.go
```

`internal/version/` is consumed from the merged Feature 003 baseline and is not edited by Feature
004.

During Gate -1, only the `packages/deepseek/` tree and the three explicitly listed DeepSeek scripts
from this planned structure may be created or changed; shared paths remain post-barrier work.

## Product Design

### Bundle and runtime

The package uses the exact official bundle/profile mechanism selected by Gate A. It contributes one
Skill provider and one official native local STDIO MCP integration.

The package consumes the merged Feature 003 build-version seam. Repository build staging creates one
CGo-free `darwin-arm64` Core executable, injects repository `VERSION`, and proves CLI plus
`dev_flow_server_info` identity after moving the binary outside the source checkout.

The launcher:

- resolves only package-relative Core;
- validates explicit/default data roots;
- constructs the approved six-key environment;
- spawns without a shell;
- forwards raw protocol STDIO;
- propagates EOF/signals/cancellation;
- waits/reaps deterministically;
- opens no listener and makes no network request;
- never parses task/result content or owns retry/workflow decisions.

### Skill and authority

The sole `dev-flow` Skill is user-invocable, not model-invocable, and requires explicit `/dev-flow`.
It rejects ordinary/empty/conversational/non-Git/multi-repository inputs before task creation.

It calls `dev_flow_server_info` first and admits only Core Contract 0.1 with exactly the six tools.
Every action/recovery/outcome is taken from a complete fresh Core result. No adapter task state,
phase/action catalog, transition map, claim rule, recovery classifier, error reinterpretation, or
completion predicate is allowed.

### Direct results and uncertain mutation

Authority fields are unavailable until complete canonical content is recovered and parsed. Only the
exact official retrieval method proven by the currently selected Gate B is used.

Uncertain mutation handling retains original request/action values, performs the exact Core-defined
readback/operation probe, and follows the complete recovery assessment. Blind replay is prohibited.

## Deterministic Story Evidence

User-story checkpoints use:

- source/staged-tarball package contracts;
- fake Core complete-result/recovery/cancellation cases;
- fake profile add/remove/readback;
- launcher process/environment tests;
- retained task-data integration;
- journey-harness stage/order/digest tests;
- shared manifest/layout/root-validator checks.

The journey harness may expose `--through explicit-invocation`, `--through done`, and
`--through remove`, but story tasks invoke only fake/simulated modes. They assert no real `dsh`
process and no native evidence. These fake modes and their evidence model may be completed before
the 003 merge barrier; any native mode remains disabled until after it.

## Native Evidence Budget

Native execution is limited to Gate B execution(s) and one final stable journey. There are no
mandatory per-story native journeys.

The final journey composes:

1. exact stable Harness that passed stable Gate B;
2. one final artifact built after deterministic/root validation and source freeze;
3. isolated profile/data/repository roots;
4. ordinary zero-task prompt and explicit invalid inputs;
5. one substantive task and at least two Core action commits;
6. Harness restart/resume with same task lineage;
7. verification-budget compliance and Core `DONE`;
8. product-identity removal/restart;
9. retained data/task reopen and compatible reinstall;
10. repository equality;
11. mandatory before/after comparison of a real co-installed Codex product.

## Evidence Records and Validation

`evidence/direct-consumption.md` records provisional and stable Gate B separately with exact artifact
identity and all six cases.

`evidence/real-journey.md` records:

- merged Feature 003 baseline commit;
- exact stable Harness version/build/integrity/range;
- stable Gate B identity/result;
- frozen source and final product artifact identities;
- package/Core/source/fixture digests;
- profile/OS/architecture;
- one Skill/six tools and `proxy_presence=none`;
- task/action/revision lineage;
- call budget and terminal outcome;
- removal/data/reinstall/repository facts;
- mandatory real Codex before/after facts;
- deterministic/root validation results;
- every failure/skip.

A passing record has no required skip, especially no Codex skip. If Codex cannot be co-installed or
compared, status is blocked/failed.

The planned semantic validator verifies merged baseline identity, stable Gate B/final host identity,
source/artifact identity, strict revisions/task equality/action count, budget, `DONE`, retained data,
repository equality, Codex equality, and prior root validation. It is read-only.

## Root Validation Ownership

Feature 004 extends the **merged** Feature 003 root validator. It must preserve every delivered
Codex rule while adding bounded DeepSeek source/dry-pack/dependency checks. It starts no real host,
performs no profile mutation/publication/download, and writes no native evidence.

## Final Artifact and Evidence Order

The final chain is strictly serialized:

1. Gate A stable selection/revalidation;
2. full stable Gate B on the exact selected stable artifact;
3. documentation/contract reconciliation;
4. complete deterministic package/fake/integration/shared-contract tests;
5. root `pnpm run validate`;
6. fix failures and rerun affected deterministic checks;
7. read-only pre-final scope/diff audit;
8. freeze source;
9. build exactly one final artifact;
10. verify artifact allowlist/version/source/digest;
11. run exactly one final stable journey;
12. validate final evidence structurally and semantically;
13. final read-only diff audit.

A source change after step 9 invalidates the artifact and returns to step 4. Evidence failure is not
repaired by manual editing.

## Complexity Tracking

No exception is requested. The closed launcher, stable direct-result gate, Feature 003 delivered
capability dependency, and final Codex comparison are concrete lifecycle/evidence requirements. No
generic host framework or proxy is introduced.

## Delivery Boundary

The pre-merge slice is complete only when all safe tasks have targeted passing evidence, convergence
finds no safe-slice gap, commits are pushed, the worktree is clean, and execution is stopped at the
003 merge barrier. This is not Feature completion and establishes no Harness support.

Feature 004 is complete only after:

- Feature 003 is merged and its baseline recorded;
- reviewer checklists are approved;
- exact stable Harness passes full Gate B;
- deterministic/root validation passes;
- one frozen-source final artifact is built;
- one final stable journey passes;
- mandatory real Codex non-interference passes;
- final evidence passes structural/semantic review; and
- the final diff remains within approved scope.

Public publication, release automation, automatic update, other platforms, a projection proxy,
Core Contract changes, multi-repository behavior, and cross-host takeover remain out of scope.
