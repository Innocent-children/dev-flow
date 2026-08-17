# 005 Recover Uncertain Actions and Repository Drift

Feature 005 is the next shared-Core feature after the Codex product in Feature 003. Feature 004 is
explicitly deferred and is not an implementation or acceptance dependency for this feature.

**Status**: Complete — all three user stories, root validation, final analyze, and final converge passed on 2026-08-17.

This directory is a complete Spec Kit package:

- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `contracts/recovery-hardening.md`
- `contracts/test-failure-model.md`
- `quickstart.md`
- `checklists/requirements.md`
- `tasks.md`

## Entry gate

Implementation starts only from a `main` commit that contains the completed Feature 003 product and
its final Codex acceptance result. Record that merge commit in `research.md` before changing Core
code.

Feature 005 does not wait for DeepSeek Harness. It uses:

1. Core Contract 0.1 delivered by Feature 002;
2. the real Codex create/restart/resume journey delivered by Feature 003;
3. the accepted local-STDIO threat model that a mutation result may be lost after commit;
4. deterministic Core, Store, MCP, and repository tests.

## Non-negotiable boundary

This feature hardens and proves the existing recovery contract. It does not add:

- a seventh MCP tool;
- a new workflow phase;
- a new recovery class;
- a database schema migration;
- a production fault-injection flag;
- automatic mutation replay;
- Git mutation or repository repair;
- DeepSeek implementation work;
- cross-host takeover.

If implementation discovers that a public MCP schema, stable error, state transition, or persisted
model must change, stop Feature 005 and amend the specification before coding that change. Such an
amendment must satisfy the Constitution's two-host contract-parity rule; skipping Feature 004 does
not authorize a public Core divergence.

## User Story 1 Baseline — 2026-08-17

The baseline was run once from `a2ba8bd5de9c87aaf758bff51a02ae120f60c7f7` before implementation
edits.

| Command | Result |
|---|---|
| `go test ./internal/recovery` | PASS |
| `go test ./internal/application` | PASS |
| `go test ./internal/repository` | PASS |
| `go test ./internal/store` | PASS |
| `go test ./internal/mcp` | PASS |
| `go test ./tests/journeys` | PASS |
| `go test ./tests/contract` | PASS |
| `node --test packages/codex/tests/skill-contract.test.mjs` | PASS — 10 tests |

No baseline failure required investigation or correction. The baseline contains no
`packages/deepseek/` change.

## Implementation Reconciliation — 2026-08-17

T001–T033 are complete. User Story 1 proves lost-result read-back, zero-write pre-commit failure,
bounded partial output, and duplicate idempotency. User Story 2 proves the five existing recovery
classes, exact adoption, read-only partial/conflicting reads, stale-source rejection, and the
existing blocker lifecycle. User Story 3 proves complete binding drift, canonical aliases,
same-path replacement, a two-handle deterministic race, and restart-safe blocker resolution.

No Core, Application, Recovery, Repository, Store, or MCP Go production file required a change.
The implementation is deterministic proof plus a Codex Skill static-contract clarification. That
clarification now requires the five uncertainty shapes to retain one exact pre-dispatch identity,
construct only the existing seven-member `operation_probe`, read before retry, keep complete
`ok=false` domain errors separate from transport uncertainty, and obey rather than reproduce the
Core recovery decision table. `packages/deepseek/` remains unchanged.

Evidence is reported only as test-local pre-commit failure, post-commit discarded result,
pre-serialization discard, bounded partial writer, SQLite close/reopen, two-handle deterministic
race, temporary Git fixture mutation, Codex Skill static contract, or root repository validation.
None of these is a real Codex crash, operating-system power loss, real network interruption,
DeepSeek evidence, or release-artifact evidence.

No extra real Codex Host Journey or DeepSeek Harness was run. The feature adds no seventh tool,
schema migration, production failpoint, automatic replay, Git repair, cross-host takeover,
Feature 006 work, dependency, npm publication, tag, or release.
