# Quickstart: Validate the Open-Task Contract Fix

## Prerequisites

- Go 1.26 or newer
- Repository root as the working directory

## Focused validation

Run the Core MCP package tests that cover schema publication and strict decoding:

```bash
go test ./internal/mcp
```

Run the shared public contract tests:

```bash
go test ./tests/contract
```

Run the Codex package contract test that inspects the packaged Skill:

```bash
node --test packages/codex/tests/package-contract.test.mjs
```

Finally check the patch:

```bash
git diff --check
```

Expected outcomes:

- the open-task schema exposes closed nested field types and the three verification levels;
- `focused` and string-valued lists are rejected while the valid equivalent passes;
- the packaged Skill contains the same vocabulary and valid example;
- the tool catalog remains exactly six entries and no persistence/recovery contract changes.

## Version-alignment validation

Run the complete current manifest/release contracts and the current/frozen package scenarios:

```bash
go test ./tests/contract
node --test packages/codex/tests/package-contract.test.mjs
node --test packages/codex/tests/release-package.test.mjs
```

Expected outcomes:

- all current root/package/plugin authorities report `0.3.0`;
- the ordinary package build and bundled Core report `0.3.0`;
- copied historical release fixtures explicitly use `0.1.0`;
- Feature 006 release fixtures remain internally consistent without being treated as current identity.
