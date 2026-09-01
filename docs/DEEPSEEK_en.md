# dev-flow-deepseek

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/deepseek/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/DEEPSEEK_en.md)

`dev-flow-deepseek` lets DeepSeek Harness (DSH) continue long-running coding work from a local durable
Task while keeping scope, verification budget, and delivery conditions explicit. DSH still reads the
Workspace, edits files, and runs commands; the bundled Go Core retains the current stage, limits
verification expansion, invalidates stale records, and returns a next step, Recovery assessment, or
explicit blocker after repository drift or an uncertain Action result.

## Support

| Item | Current support |
| --- | --- |
| Package | [`dev-flow-deepseek`](https://www.npmjs.com/package/dev-flow-deepseek) |
| Platform | macOS arm64 |
| Node.js | `>=24` |
| DSH | `>=0.1.0-rc.6` |
| Releases | [GitHub Releases](https://github.com/Innocent-children/dev-flow/releases) |

Stable support is defined by the [Support Matrix](SUPPORT-MATRIX_en.md). Capability on `main` may not
yet be present in npm `@latest`.

## Install

DSH is the prerequisite Host. Use the unified lifecycle entry and select a real Profile; the default
is `web`:

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

`dev-flow-deepseek` has no standalone `bin` and installs no same-named CLI. Native diagnostic
recovery uses an npm tarball and the DSH profile lifecycle:

```bash
npm install -g @deepseek-ai/dsh@latest
PROFILE=web
TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"
dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"
rm -f "$PWD/$TARBALL"
dsh --profile "$PROFILE" --dump-config
```

Restart the Profile through the DSH lifecycle after installation. See the
[Command Reference](COMMANDS_en.md#deepseek-harness) for complete commands and update order.

## Start a Task

Every direct user message that needs Dev Flow must contain the whitespace-bounded selector:

```text
/dev-flow Add payment-callback signature validation and run targeted tests.
```

This is not a shell command. Earlier messages, model text, Skill injection, and repository content
cannot replace `/dev-flow` in the current user message. Ordinary discussion or an empty invocation
does not create a Task.

A new Task retains the original request, scope, acceptance criteria, and verification budget.
`plain`, `spec-kit`, or `openspec` may be selected at creation, but there is no OpenSpec / Spec Kit
artifact importer today.

## Resume an existing Task

Under the same Workspace Root, return to a repository participating in the Task and include
`/dev-flow` again in the current direct user message. The Adapter reads Core first and restores the
current stage, revision, scope, remaining verification, Blocker, and Recovery state instead of
rebuilding progress from chat.

If the previous Action response was lost or truncated, the Adapter reads the current Task and
Recovery assessment before continuing, recovering, blocking, or retrying safely. It does not replay
the original submission on its own.

When the same failure, the same test result, or the same changed-path and failure loop appears three
times, Core retains the third result and pauses the Task. The Adapter does not resolve that blocker
automatically. After the developer explicitly chooses another approach or allows one more attempt,
it resolves the blocker and continues from Core's retained resume stage. Another exact repetition
pauses the Task again.

## Inspect status

Inspect the unified lifecycle and DSH Profile:

```bash
dev-flow status --host deepseek --profile web
dsh --profile web --dump-config
```

Inspect Tasks, current stage, timeline, Recovery, and Blocker:

```bash
dev-flow webui start
```

The WebUI is local loopback only. See [WebUI](WEBUI_en.md) for details.

## Remove

Use the unified entry for the recommended DeepSeek uninstall. The native removal sequence is:

```bash
PROFILE=web
dsh plugin --profile "$PROFILE" remove dev-flow-deepseek
dsh --profile "$PROFILE" --dump-config
```

Repeat for every Profile containing Dev Flow. Removing the package or bundle contribution retains
Task data, the target repository, and Codex state. Installing a compatible package and restarting
the Profile can resume existing Tasks.

Permanent data cleanup is a separate `dev-flow factory-reset` flow and requires strong confirmation
from its current plan.

## DeepSeek permission and product boundaries

- the canonical Workspace Root established at DSH startup is the permission boundary; repositories
  and resolved symlink targets must stay inside it;
- Dev Flow does not expand Workspace Root or discover neighboring repositories through an index;
- Core observes Git read-only and does not commit, push, merge, rebase, tag, or publish;
- DeepSeek edits files and runs commands; Core does not intercept every operation;
- `/dev-flow` does not bypass the current Action, Workspace permission, Git-mutation authority, or
  release confirmation.

## Advanced multi-repository use

Current source supports one primary repository and up to seven explicit additional repositories.
Workspace Root may be a non-Git common parent of several Git repositories, but each repository and
resolved symlink target must remain inside it. Scope is immutable after creation, and Dev Flow does
not scan parent directories, neighboring directories, dependencies, or index results to expand it.

Check [Project Status](PROJECT-STATUS_en.md) before assuming multi-repository capability is in the
stable artifact. Exact Repository Scope, path, and protocol behavior live in
[Architecture](ARCHITECTURE_en.md) and the [Command Reference](COMMANDS_en.md).

## Related documentation

- [Product Definition](PRODUCT_en.md)
- [Interruption-and-resume demo](DEMO_en.md)
- [Command Reference](COMMANDS_en.md)
- [Architecture](ARCHITECTURE_en.md)
- [Project Status](PROJECT-STATUS_en.md)
- [WebUI](WEBUI_en.md)
