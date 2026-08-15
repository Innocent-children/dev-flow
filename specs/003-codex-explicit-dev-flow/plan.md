# Implementation Plan: Codex Explicit Dev Flow

**Branch**: `003-codex-explicit-dev-flow`  
**Date**: 2026-08-15  
**Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/003-codex-explicit-dev-flow/spec.md`

## Summary

Deliver one private, locally packed `dev-flow-codex` artifact containing exactly one Codex plugin,
one explicitly selected `$dev-flow` Skill, one local STDIO MCP registration, one packaged macOS
arm64 Go Core executable, and small Node.js standard-library lifecycle/launch glue.

The Go Core remains the sole authority for task state, transitions, repository claims, recovery,
verification budgets, and terminal outcomes. The Codex layer owns only package composition,
explicit registration/removal, process launch, invocation guidance, and evidence presentation.

Feature 003 uses deterministic package, fake-Codex, fake-Core, and harness-contract checks during
story implementation. It performs **exactly one real Codex host journey**, after all deterministic
checks and root validation pass and after one final artifact is built from a frozen source tree.
Intermediate user-story checkpoints never start a real Codex host and never create native support
evidence.

## Technical Context

**Core language/toolchain**: Go 1.26 or the repository-pinned compatible toolchain  
**Host glue**: Node.js `>=24`, ECMAScript modules, Node standard library only  
**Package manager**: pnpm `>=11 <12`; npm-compatible local `.tgz` installation  
**Core dependencies**: existing `github.com/modelcontextprotocol/go-sdk` and `modernc.org/sqlite`  
**Storage**: Core-owned SQLite under explicit `DEV_FLOW_DATA_DIR`, otherwise
`~/Library/Application Support/dev-flow/data` on macOS  
**Registration receipt**:
`~/Library/Application Support/dev-flow/registrations/codex.json`  
**Transport**: local STDIO only  
**Target evidence platform**: macOS arm64, Codex CLI only  
**Host compatibility**: selected and recorded during implementation-time revalidation; the
planning baseline was Codex CLI `0.147.x`, but this plan does not permanently freeze that minor line  
**Publication**: prohibited in Feature 003

## Constitution Check

| Principle | Result | Design evidence |
|---|---|---|
| I. Self-Contained Product Scope | PASS | One bounded Codex package and one install-to-remove capability. |
| II. Single Workflow Authority | PASS | Core alone owns task, action, recovery, claim, and outcome semantics. |
| III. One State Machine, Bounded Surface | PASS | Exactly the six Core Contract 0.1 tools; no aliases or secondary catalog. |
| IV. Thin Host Adapters | PASS | Node code is limited to lifecycle, paths, launch, and evidence glue. |
| V. Recovery Before Retry | PASS | Uncertain mutations require authoritative task/next-action reads. |
| VI. Read-Only Repository Boundary | PASS | Setup/removal write only product-owned user locations; Core does not mutate Git. |
| VII. Evidence-Bounded Testing | PASS | Deterministic checks per story and one final real-host journey only. |
| VIII. Proven Simplicity | PASS | No runtime dependency, proxy, generic framework, listener, or polling loop. |
| IX. Vertical-Slice Specifications | PASS | US1, US2, and US3 remain independently testable without repeated native journeys. |
| X. Two-Host Contract Parity | PASS | Shared Core fixtures are consumed in place and public Core contracts stay unchanged. |

No constitutional exception is requested.

## Host Compatibility Revalidation

Codex plugin, Skill, MCP, marketplace, setup, removal, and JSON readback contracts are volatile
external inputs. Before final validation, one serialized compatibility task must:

1. inspect the then-current official Codex documentation and exact stable CLI artifact;
2. select a minimum supported version and a bounded compatible range;
3. record the exact version used for native evidence;
4. update every compatibility-bearing artifact together when the selected range differs from the
   planning baseline:
   - `research.md`;
   - this `plan.md`;
   - `contracts/codex-plugin.md`;
   - `contracts/registration-receipt.schema.json`;
   - `contracts/journey-evidence.schema.json`;
   - `data-model.md`;
   - `quickstart.md`;
   - `tasks.md`;
   - package and journey tests that enforce the range;
5. rerun analyze/checklist review if the official contract changes product behavior rather than
   only field names, commands, or the compatible range.

This revalidation is not parallel with final test hardening, root validation, or artifact creation.

## Project Structure

### Documentation

```text
specs/003-codex-explicit-dev-flow/
├── README.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── codex-plugin.md
│   ├── dev-flow-skill.md
│   ├── journey-evidence.schema.json
│   └── registration-receipt.schema.json
├── checklists/
│   ├── requirements.md
│   └── codex-product-quality.md
└── tasks.md
```

### Planned source and verification changes

```text
internal/version/
├── version.go
└── version_test.go

packages/codex/
├── package.json
├── README.md
├── .agents/plugins/marketplace.json
├── bin/dev-flow-codex.mjs
├── lib/lifecycle.mjs
├── lib/paths.mjs
├── plugin/.codex-plugin/plugin.json
├── plugin/.mcp.json
├── plugin/skills/dev-flow/SKILL.md
└── tests/
    ├── fixtures/fake-codex.mjs
    ├── fixtures/fake-core.mjs
    ├── fake-core-contract.test.mjs
    ├── journey-evidence.test.mjs
    ├── journey-harness.test.mjs
    ├── launcher.test.mjs
    ├── lifecycle.test.mjs
    ├── package-contract.test.mjs
    ├── paths.test.mjs
    ├── removal-retention.test.mjs
    └── skill-contract.test.mjs

scripts/
├── build-codex-local.sh
├── run-codex-real-journey.sh
├── validate-codex-journey-evidence.mjs
└── validate-repository.sh

tests/
├── contract/
│   ├── fixture_contract_test.go
│   ├── package_manifest_test.go
│   └── repository_layout_test.go
└── journeys/evidence/codex-macos-arm64.json
```

The prebuilt executable and `.tgz` exist only in temporary staging. They are never committed.

## Product Design

### Package and runtime

The artifact contains one executable entry, `dev-flow-codex`. Production commands are limited to:

- `setup [--json]`;
- `remove [--json]`;
- `mcp`;
- `--version`.

`mcp` resolves only the package-local Core executable, validates the supported platform and data
root, and inherits stdin/stdout/stderr. It does not parse or project MCP messages.

The shared `internal/version` seam permits a detached binary to report repository `VERSION` through
link-time injection while preserving source-tree fallback behavior. It changes no public Core
contract.

### Explicit setup and removal

npm installation runs with lifecycle scripts disabled and does not register anything. Explicit
setup reads current Codex marketplace/plugin state, validates package resources and compatibility,
performs supported Codex mutations, reads state back, and writes an ownership receipt only after
success.

Removal reads the receipt and Codex state before mutation, removes only matching product-owned
plugin/marketplace registration, verifies absence, deletes only the exact receipt, and preserves
task data, the npm package, adjacent user files, Codex cache/config internals, and repositories.

### Skill authority

The sole Skill begins with an exact current-turn `$dev-flow` guard. It rejects empty,
conversational, non-Git, and multi-repository requests before opening a task. It calls
`dev_flow_server_info` first and accepts only Core Contract 0.1 with the exact six tools.

For each action it follows live Core identity, schema, allowed effects, evidence requirements,
recovery assessment, blocker, and outcome. It does not contain a state machine, action catalog,
error reinterpretation, recovery classifier, or completion predicate.

## Verification Design

### Deterministic evidence layers

1. **Static/package contracts**: artifact allowlist, one plugin/Skill/MCP server, no lifecycle
   mutation, version parity, no embedded workflow authority, and no copied Core fixtures.
2. **Fake Codex lifecycle**: exact setup/remove argv, JSON readback, idempotency, conflicts,
   rollback, ownership, and adjacent-file preservation.
3. **Fake Core contract**: exact six-tool mapping, closed argument forwarding, full results,
   verification budgets, terminal outcomes, and read-before-retry ordering.
4. **Journey harness contract**: stage ordering, artifact digest propagation, source identity,
   session boundary, repository/data fingerprints, and evidence classification without starting
   Codex.
5. **Packaged-Core retention integration**: real packaged Core against a temporary data directory,
   but no real Codex host.

US1, US2, and US3 checkpoints use only these deterministic layers.

### Exactly one native journey

After compatibility revalidation, all targeted tests, root validation, and a read-only pre-final
diff audit pass, the source tree is frozen and one final artifact is built. That exact artifact is
then used for one real Codex journey covering:

1. install with scripts disabled;
2. explicit setup and readback;
3. ordinary prompt proving zero Dev Flow tool calls/tasks;
4. invalid explicit invocations;
5. a substantive `$dev-flow` task;
6. at least two Core-confirmed workflow action commits;
7. Codex close/restart;
8. same-task resume and continuing revision lineage;
9. verification-budget compliance;
10. Core-owned `DONE`;
11. explicit deregistration;
12. retained task-data digest and direct task reopen;
13. npm uninstall and compatible reinstall;
14. repository and adjacent-file comparison.

No earlier task may start a real Codex host or write native support evidence.

## Journey Evidence Contract

`journey-evidence.schema.json` validates structure and supports honest `pass`, `failed`, and
`blocked` records. A failed or blocked record may contain only the observations available before the
failure; it is not forced to fabricate task lineage or completed lifecycle fields.

JSON Schema cannot compare values or prove ordering. Therefore
`scripts/validate-codex-journey-evidence.mjs` performs required semantic checks for a passing record:

- package version equals Core version and repository `VERSION`;
- the exact Codex version satisfies the recorded compatible range;
- evidence source commit equals the frozen source commit used to build the artifact;
- revisions are strictly increasing;
- committed-action revisions belong to the recorded lineage;
- task IDs before and after restart are equal;
- at least two action commits are present;
- `core_call_count <= scenario_call_budget`;
- terminal outcome is `DONE`;
- task-data manifests/digests before and after removal are equal;
- repository digest after completion equals repository digest after removal;
- unexpected changed paths are empty;
- setup, restart/resume, removal, retention, and task-reopen flags are true;
- the recorded targeted checks and root `pnpm run validate` passed before artifact creation.

Schema validation and semantic validation are both required. Neither validator modifies evidence.

## Root Validation Ownership

Feature 003 owns the first expansion of `scripts/validate-repository.sh` from skeleton dry-pack
rules to the delivered Codex package boundary. The script must:

- preserve root toolchain, formatting, vet, Go test, and frozen workspace checks;
- validate the exact Codex source/dry-pack allowlist expected by this feature;
- retain the DeepSeek skeleton rule until Feature 004 is merged;
- run no real host, network publication, package installation into user state, or release action.

Feature 004 may later extend this validator only from the merged Feature 003 baseline.

## Final Artifact and Evidence Order

The final chain is strictly serialized:

1. compatibility revalidation;
2. documentation/contract reconciliation;
3. all targeted Go/Node/package/fake checks;
4. root `pnpm run validate`;
5. fix any failures and rerun affected deterministic checks;
6. read-only pre-final scope/diff audit;
7. freeze the source commit;
8. build exactly one final artifact;
9. verify artifact allowlist, versions, executable, source identity, and digest;
10. run exactly one real Codex journey and write the evidence record once;
11. run structural and semantic evidence validation;
12. run a final read-only diff audit.

After step 8, no source or evidence-producing code may be changed without discarding the artifact and
restarting from step 3. After step 10, evidence may not be edited except to replace the entire record
by rerunning the same final journey from a newly frozen source/artifact.

## Complexity Tracking

No constitutional exception is required. The build-version seam, registration receipt, semantic
evidence validator, and product-specific root allowlist each solve a concrete packaging,
ownership, or evidence-integrity requirement. None creates workflow authority or a generic host
framework.

## Delivery Boundary

Feature 003 is complete only when:

- reviewer-owned requirement checklists are approved;
- deterministic package/fake/integration checks pass;
- root validation passes;
- one frozen-source artifact is built;
- exactly one real Codex journey passes;
- its evidence passes both structural and semantic validation; and
- the final diff remains within the approved Feature 003 scope.

Public publication, release automation, signatures, automatic updates, Windows/Linux packages,
other Codex surfaces, DeepSeek implementation, and Core Contract changes remain out of scope.
