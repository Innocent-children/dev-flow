# dev-flow-codex

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/codex/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/CODEX_en.md)

`dev-flow-codex` lets Codex continue long-running coding work from a local durable Task instead of
reconstructing progress from chat history. Codex still reads repositories, edits files, and runs
commands; the bundled Go Core retains task scope, current stage, verification budget, Recovery, and
next step.

## Support

| Item | Current support |
| --- | --- |
| Package | [`dev-flow-codex`](https://www.npmjs.com/package/dev-flow-codex) |
| Platform | macOS arm64 |
| Node.js | `>=24` |
| Codex | `>=0.147.0` |
| Releases | [GitHub Releases](https://github.com/Innocent-children/dev-flow/releases) |

Stable support is defined by the [Support Matrix](SUPPORT-MATRIX_en.md). Capability on `main` may not
yet be present in npm `@latest`.

## Install

Use the unified lifecycle entry:

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

The installer installs the Codex package, registers the Plugin and MCP, and reads back readiness.
Native Host commands remain for diagnosis and recovery:

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex status --json
dev-flow-codex --version
```

When fixed user configuration is absent, `setup` creates `$HOME/.dev-flow/config.json`, validates the
package, bundled Core, and Codex compatibility, then registers the marketplace, Plugin, and MCP. See
the [Command Reference](COMMANDS_en.md#codex) for every argument and machine-readable result.

## Start a Task

From a Git repository, describe a bounded implementation, bug fix, refactoring, targeted-testing, or
development-delivery request. Codex can select Dev Flow automatically. Use the exact selector when
you want to enter explicitly:

```text
$dev-flow-codex:dev-flow Fix idempotency in the order-creation endpoint and run targeted tests.
```

This is not a shell command. `$dev-flow` is not an alias. Explanation-only, status-only,
design-discussion, ordinary-question, and ambiguous requests do not automatically create or resume a
Task.

A new Task begins in requirements and retains the original request, scope, acceptance criteria, and
verification budget. `plain`, `spec-kit`, or `openspec` may be selected at creation, but there is no
OpenSpec / Spec Kit artifact importer today.

## Resume an existing Task

Return to the same participating physical worktree and continue the original request in a new Codex
session, or use the exact selector. The Adapter reads Core first and restores the current stage,
revision, scope, remaining verification, Blocker, and Recovery state instead of rebuilding progress
from chat.

If the previous Action response was lost or truncated, the Adapter reads the current Task and
Recovery assessment before continuing, recovering, blocking, or retrying safely. It does not replay
the original submission on its own.

## Inspect status

Inspect package and registration state:

```bash
dev-flow status --host codex
dev-flow-codex status --json
```

Inspect Tasks, current stage, timeline, Recovery, and Blocker:

```bash
dev-flow webui start
```

The WebUI is local loopback only. See [WebUI](WEBUI_en.md) for details.

## Remove

Use the unified entry for the recommended Codex uninstall. The native data-preserving sequence is:

```bash
dev-flow-codex remove
npm uninstall -g dev-flow-codex
```

`remove` validates the runtime receipt and stops the matching WebUI before removing the package-owned
Plugin, marketplace registration, and receipt. A stop failure retains later objects. Task data and
the target Git repository are retained by default, so installing a compatible package and running
`setup` can resume existing Tasks.

Permanent data cleanup is a separate `dev-flow factory-reset` flow and requires strong confirmation
from its current plan. Do not manually delete an uncertain data directory.

## Codex permission and product boundaries

- repository access remains controlled by Codex and user authorization; Dev Flow does not expand the
  sandbox;
- Core observes Git read-only and does not commit, push, merge, rebase, tag, or publish;
- Codex edits files and runs commands; Core does not intercept every operation;
- the selector does not bypass repository permission, the current Action, Git-mutation authority, or
  release confirmation;
- optional code indexing assists retrieval only and cannot expand Scope or decide Recovery and
  process state.

## Advanced multi-repository and worktree use

Current source supports one primary repository and up to seven explicit additional repositories.
Each additional repository must first be authorized as a writable root for the session through Codex
`--add-dir`. Scope is immutable after creation, and neighboring directories are not discovered
automatically.

For an explicit parallel batch, or when a new request meets `ACTIVE_TASK_CONFLICT`, Codex dispatches
an isolated Task only when the Host provides worktree-backed task/thread creation. A child starts
from committed default-branch state and receives no uncommitted changes from the occupied checkout.
Core does not create, switch, merge, or clean worktrees.

Check [Project Status](PROJECT-STATUS_en.md) before assuming these capabilities are in the stable
artifact. Exact Repository Scope, worktree dispatch, and protocol behavior live in
[Architecture](ARCHITECTURE_en.md) and the [Command Reference](COMMANDS_en.md).

## Related documentation

- [Product Definition](PRODUCT_en.md)
- [Interruption-and-resume demo](DEMO_en.md)
- [Command Reference](COMMANDS_en.md)
- [Architecture](ARCHITECTURE_en.md)
- [Project Status](PROJECT-STATUS_en.md)
- [WebUI](WEBUI_en.md)
