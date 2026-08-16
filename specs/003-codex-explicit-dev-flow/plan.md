# Implementation Plan: Codex Explicit Dev Flow

**Branch**: `003-codex-explicit-dev-flow`  
**Spec**: [spec.md](./spec.md)  
**Checkpoint**: Merge preparation; Feature 003 remains **NO-GO** until final acceptance

## Summary

The test-suite simplification and four native result-handling regressions are complete. The thin
Codex package, Core-authoritative workflow, package/lifecycle/Skill/Core-loop/parser layers, and
repeatable development smoke remain. Two fresh isolated Codex 0.147 development-smoke runs passed.
Release/supply-chain provenance, immutable attempts, and crash-transaction machinery remain
deferred. The only unmet Feature 003 acceptance requirement is the final real-host journey.

Subsequent explicitly approved smoke repairs added only bounded Core payload examples, stricter
Skill forwarding guidance, the repeatable development-smoke runner, and their focused tests. They
did not add adapter-owned workflow authority, a public contract, or release machinery.

## Technical Context

| Item | Decision |
|---|---|
| Core contract | Core Contract 0.1, six tools |
| Package | private `dev-flow-codex@0.1.0` |
| Host baseline | Codex CLI 0.147, macOS arm64 |
| Skill selector | `$dev-flow-codex:dev-flow` |
| Transport | direct local STDIO MCP |
| Runtime dependencies | none |
| Test runtime | Node.js >=24 and Go toolchain |
| Persistent smoke state | none |
| Merge status | NO-GO until the final acceptance journey passes |

## Constitution Check

- Core alone owns state, transitions, next action, recovery, and terminal outcomes.
- Codex remains a thin host adapter with no workflow engine or generic MCP proxy.
- Product code does not mutate Git.
- Fake/static checks are never promoted to real-host evidence.
- The final acceptance journey is a merge gate, not a release-provenance system.
- This checkpoint introduces no new product abstraction or schema version.

## Implemented Checkpoint Paths

```text
specs/003-codex-explicit-dev-flow/**
packages/codex/tests/**
packages/codex/package.json
packages/codex/bin/dev-flow-codex.mjs
cmd/dev-flow/main.go
cmd/dev-flow/main_test.go
internal/mcp/server.go
internal/mcp/server_test.go
scripts/run-codex-real-journey.sh
scripts/validate-codex-journey-evidence.mjs
scripts/write-codex-journey-evidence.mjs
tests/contract/**
```

The original simplification stayed within its original subset of that list. Later user-approved minimal smoke repairs also
touched `packages/codex/plugin/skills/dev-flow/SKILL.md`, `internal/workflow/engine.go`, and their
existing focused tests. The current Host-capability closure additionally updates the listed Codex
launcher, CLI presentation boundary, MCP server options, and focused tests. `packages/codex/lib`,
protocol, DeepSeek, root-validator, main-branch, permanent ledger, and canonical-evidence paths
remain unchanged.

## Verification Design

### Layer 1 — Package

Owns private-package identity, exact packed allowlist, runtime executable selection, no lifecycle
mutation hooks, and absence of copied Core/test authority.

Primary tests: `package-contract.test.mjs`, `paths.test.mjs`, and Go manifest/layout contracts.

### Layer 2 — Lifecycle

Owns setup/readback, idempotence, bounded rollback, removal, compatible reinstall, and retained task
data.

Primary tests: `launcher.test.mjs`, `lifecycle.test.mjs`, and
`removal-retention.test.mjs`.

### Layer 3 — Skill

Owns exact explicit Skill activation, ordinary zero-call behavior, non-exact-selector state
isolation with honest MCP observations, the six-tool handshake, and the absence of adapter-owned
workflow authority.

Primary test: `skill-contract.test.mjs`.

### Layer 4 — Core Loop

Owns deterministic six-tool forwarding and create/apply/restart/resume/DONE behavior using the
existing fake Core and shared Core fixtures. It also preserves the product-level distinction
between a Core domain error and a transport failure.

Primary test: `fake-core-contract.test.mjs`.

### Layer 5 — Codex 0.147 Parser

Owns only three host terminal shapes:

1. `item.completed` + `status=completed` + complete structured/text-parity result;
2. `item.completed` + `status=failed` + complete Core `ok=false` result;
3. `item.completed` + `status=failed` + no complete result + typed transport error.

Three sanitized JSONL files under `tests/contract/testdata/codex-0.147/` are the only host-shape
fixtures. They preserve event/item/status/tool/result-presence/parity/error shape and contain no
prompt, source, user path, environment, token, or secret.

Primary test: rewritten `journey-evidence.test.mjs`.

### Layer 6 — Native Smoke

The checked-in smoke command accepts either one sanitized fixture or an explicitly supplied Codex
executable and workspace. Fixture mode is the deterministic development gate. Real mode is manual,
repeatable, emits only ephemeral summaries, and never creates a validation report, artifact report,
attempt ledger, or canonical evidence.

Primary test: rewritten `journey-harness.test.mjs` with the thin
`tests/fixtures/fake-native-tool.mjs` fixture emitter.

### Final Acceptance

Exactly once immediately before merge approval, an operator runs the real-host acceptance mode
against the reviewed package. It must cover ordinary zero-call isolation, bare-selector Skill
non-activation and unchanged task/event/claim/repository state with all observed calls retained,
exact Skill invocation, handshake, create/apply/restart/resume/DONE, error-shape distinction,
removal, and retained task data. Its result is an acceptance observation, not release provenance.

## Test Audit

| Classification | Files / behavior | Disposition |
|---|---|---|
| KEEP | `paths.test.mjs`, `launcher.test.mjs`, `lifecycle.test.mjs`, `package-contract.test.mjs`, `skill-contract.test.mjs`, `fake-core-contract.test.mjs`, `removal-retention.test.mjs` | Retain as product-bearing layers; remove only release-report assertions from package contracts. |
| MERGE | create/apply/restart/resume/DONE and read-before-retry coverage | Keep in `fake-core-contract.test.mjs`; do not duplicate in native parser tests. |
| REWRITE | `journey-harness.test.mjs`, `journey-evidence.test.mjs`, `fake-native-tool.mjs` | Replace thousands of release/evidence cases with parser and repeatable-smoke tests. |
| DEFER | attempt-ledger crash/recovery, pass-lock, fsync/TOCTOU, diagnostic versions, 64 MiB boundaries, one-shot chains, release provenance reports | Explicitly moved to a future release/supply-chain feature. |
| DELETE | Feature 003 tests and schemas whose sole contract is a deferred release concern | Delete only after this plan and spec establish the deferral. |

## Closed HIGH Regression Inventory

The four formerly pending native cases now have one minimum passing regression each:

- HIGH-1 diagnostic precedence;
- HIGH-2 Core envelope closure;
- HIGH-3 failed event/recovery binding;
- HIGH-4 aggregate/session MCP fact parity.

The passing regressions remain merge requirements and must not be weakened.

## Development and Final Commands

During implementation, run only:

```bash
go test ./internal/mcp ./cmd/dev-flow ./internal/version ./tests/contract
node --test packages/codex/tests/<targeted-files>
git diff --check
```

After all edits, run exactly once:

```bash
pnpm run validate
```

Then run exactly one final `speckit-analyze` pass and at most one independent read-only review.

## Delivery Boundary

The simplification and four-HIGH closure commits are already present in the Feature 003 history.
The current merge-preparation work remains on `codex/feature-003-repeatable-development-smoke`.
After the final validation/analyze/review gate, commit and push that branch, then run T078 exactly
once against the reviewed commit. Do not merge `main` unless T078 passes.
