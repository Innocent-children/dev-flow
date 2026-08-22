# Quickstart: Validate Independent Product Versions

This guide validates Feature 011 without publishing or creating a Tag.

## 1. Validate current authorities

```bash
pnpm run versions:check
```

Expected: Core, Codex, and DeepSeek each report `0.5.0`; the command succeeds because each authority
is valid and the Codex plugin mirrors Codex.

## 2. Run the differing-version fixture

```bash
node --test tests/version-governance.test.mjs
```

Expected fixture identities:

```text
Core      1.2.3
Codex     2.3.4
DeepSeek  3.4.5
```

The root package has no version and no test asserts cross-product equality.

## 3. Validate Core contract and current storage

```bash
go test ./internal/version ./internal/domain ./internal/workflow ./internal/store ./internal/mcp ./tests/contract ./tests/journeys
```

Expected: current-format bootstrap/reopen succeeds; former numbered data, partial data, malformed
snapshots, wrong process/digest, and corrupt claims fail with zero writes.

## 4. Validate Codex with a different Core

```bash
node --test \
  packages/codex/tests/package-contract.test.mjs \
  packages/codex/tests/lifecycle.test.mjs \
  packages/codex/tests/release-command.test.mjs \
  packages/codex/tests/release-package.test.mjs \
  packages/codex/tests/release-publication.test.mjs
```

Expected: the fixture reports `dev-flow-codex 2.3.4 (core 1.2.3)`; simulated release `2.3.5`
changes only the two Codex version files, uses `codex-v2.3.5`, records Core `1.2.3`, and produces no
remote side effect.

## 5. Validate DeepSeek with a different Core

```bash
node --test \
  packages/deepseek/tests/paths.test.mjs \
  packages/deepseek/tests/integration-plugin.test.mjs \
  packages/deepseek/tests/package-contract.test.mjs \
  packages/deepseek/tests/skill-contract.test.mjs \
  packages/deepseek/tests/lifecycle.test.mjs
```

Expected: DeepSeek `3.4.5` accepts actual Core `1.2.3` after executable and current capability checks;
it never passes the DeepSeek manifest version as expected Core version.

## 6. Run the final repository gate once

```bash
pnpm run validate
```

Run only after all targeted gates and converge succeed. Do not invoke `release:codex`, native host
journeys, Tag/npm/GitHub commands, or platform/stress suites for Feature 011.
