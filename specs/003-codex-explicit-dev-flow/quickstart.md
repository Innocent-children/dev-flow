# Quickstart: Codex Explicit Dev Flow

Feature 003 is currently **NO-GO**. These commands validate the simplified development suite; they
do not create release evidence.

## 1. Package and Lifecycle

```bash
node --test \
  packages/codex/tests/paths.test.mjs \
  packages/codex/tests/launcher.test.mjs \
  packages/codex/tests/lifecycle.test.mjs \
  packages/codex/tests/package-contract.test.mjs \
  packages/codex/tests/removal-retention.test.mjs
```

This layer covers build/allowlist, setup/readback, removal, reinstall, and task-data retention.

## 2. Skill and Core Loop

```bash
node --test \
  packages/codex/tests/skill-contract.test.mjs \
  packages/codex/tests/fake-core-contract.test.mjs
```

This layer covers ordinary zero-call behavior, non-exact-selector Core-state isolation, exact
`$dev-flow-codex:dev-flow` Skill activation, the six-tool handshake, and deterministic
create/apply/restart/resume/DONE.

## 3. Codex 0.147 Parser Fixtures

```bash
node --test packages/codex/tests/journey-evidence.test.mjs
```

The parser consumes exactly:

```text
tests/contract/testdata/codex-0.147/success.jsonl
tests/contract/testdata/codex-0.147/core-domain-error.jsonl
tests/contract/testdata/codex-0.147/transport-error.jsonl
```

These fixtures are sanitized host-shape contracts, not simulated workflow evidence.

## 4. Repeatable Fixture Smoke

```bash
./scripts/run-codex-real-journey.sh --fixture success
./scripts/run-codex-real-journey.sh --fixture core-domain-error
./scripts/run-codex-real-journey.sh --fixture transport-error
```

The command prints one ephemeral JSON summary and writes no ledger, validation report, artifact
report, or canonical evidence. It is safe to repeat.

## 5. Allowed Checkpoint Validation

```bash
go test ./internal/version ./tests/contract
node --test packages/codex/tests/*.test.mjs
git diff --check
```

After all edits, run the repository gate exactly once:

```bash
pnpm run validate
```

## 6. Repeatable Real Development Smoke

Run the isolated Codex 0.147 development smoke twice with distinct labels and empty result
directories:

```bash
./scripts/run-codex-real-journey.sh \
  --development-smoke \
  --run-label A \
  --codex-executable /absolute/path/to/codex \
  --result-directory /absolute/path/to/empty/result-A

./scripts/run-codex-real-journey.sh \
  --development-smoke \
  --run-label B \
  --codex-executable /absolute/path/to/codex \
  --result-directory /absolute/path/to/empty/result-B
```

Two fresh isolated runs passed on 2026-08-16 with distinct task IDs, seven committed actions, Core
`DONE`, successful removal, and retained-task reopen. Development smoke remains repeatable and does
not consume an attempt or write canonical evidence.

## 7. Final Acceptance

HIGH-1 through HIGH-4 are closed. After final validation and a reviewed clean commit, immediately
before merge approval, run once:

```bash
./scripts/run-codex-real-journey.sh \
  --acceptance \
  --codex-executable /absolute/path/to/codex \
  --workspace /absolute/path/to/isolated/git-worktree
```

The operator must verify ordinary zero-call isolation; a non-mutating bare-selector probe with Skill
non-activation, all host-exposed calls retained, and no task/event/claim/repository change; exact
explicit selection;
six-tool handshake; create/apply/restart/resume/DONE; domain/transport distinction; removal; and
retained task data. This acceptance journey has not passed.

## 8. Merge Status

- HIGH-1 diagnostic precedence: closed.
- HIGH-2 Core envelope closure: closed.
- HIGH-3 failed event/recovery binding: closed.
- HIGH-4 aggregate/session MCP fact parity: closed.
- Repeatable real development smoke: two passing isolated runs.
- Final real Codex acceptance: pending and still the NO-GO merge gate.

Release-grade provenance remains deferred to a separate feature.
