# dev-flow-codex

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/codex/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/CODEX_en.md)

`dev-flow-codex` brings the Dev Flow state graph to Codex CLI. The package contains a Codex Plugin,
a smart/explicit Skill, local STDIO MCP configuration, and a macOS arm64 Core executable. The bundled Go
Core remains the sole authority for Tasks, nodes, transitions, and Recovery.

## Support

| Item | Current support |
| --- | --- |
| Package | [`dev-flow-codex`](https://www.npmjs.com/package/dev-flow-codex) |
| Platform | macOS arm64 |
| Node.js | `>=24` |
| Codex | `>=0.147.0` |
| Releases | [GitHub Releases](https://github.com/Innocent-children/dev-flow/releases) |

## Install and verify

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

`dev-flow` is the default lifecycle and public WebUI entry. Native Host commands remain available for diagnostic
recovery:

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex status --json
dev-flow-codex --version
```

The global npm operation only installs the package and places the `dev-flow-codex` launcher on
`PATH`. `setup` is separate: it validates the platform, package contents, bundled Core, and Codex
compatibility; registers the Plugin, marketplace, and MCP configuration; and reads back ownership.
When configuration is absent, setup creates `$HOME/.dev-flow/config.json`, then reports actual
configuration/receipt changes, readiness, and one next step through a Simplified Chinese or English
brand screen or plain fallback.
`--version` reports the actual package and bundled Core identities.

## Command reference

The production `dev-flow-codex` CLI accepts only the commands below. Unknown arguments fail before
any registration operation is dispatched.

| Command | Description |
| --- | --- |
| `npm install -g dev-flow-codex@latest` | Install the package selected by npm `latest` and place the launcher globally on `PATH`. It does not register the Codex Plugin automatically. |
| `dev-flow-codex setup` | Create or validate fixed user configuration; validate package, Core, and Codex; register marketplace, Plugin, and MCP; then report actual configuration/receipt changes, readiness, and one next step. Repeated execution reports zero changes. |
| `dev-flow-codex setup --json` | Perform the same operation but emit one undecorated JSON line retaining `operation`, `status`, `changed`, and `receipt_path`, and adding `configuration_path`, `file_changes`, and `next_step`. |
| `dev-flow-codex status` | Read and display the current package/Core and registration state. |
| `dev-flow-codex status --json` | Read package, Core, receipt, marketplace, and Plugin state without creating configuration, registration, or data. |
| `dev-flow-codex --version` | Print `dev-flow-codex <package-version> (core <core-version>)` to identify the installed package and bundled Core. |
| `dev-flow-codex remove` | Remove the package-owned Plugin, marketplace registration, and receipt while retaining Task data, unknown neighboring files, and the target Git repository. |
| `dev-flow-codex remove --json` | Perform the same operation as `remove` and emit machine-readable JSON. `next_step` identifies the separate global npm uninstall. |
| `npm uninstall -g dev-flow-codex` | Uninstall the global package after `remove` completes. Running it alone does not deregister Codex first. |
| `dev-flow-codex mcp` | **Managed host command.** The Plugin MCP configuration invokes it to set the data directory and admission instructions, then launch the packaged Core with `mcp --stdio`. Normal users should not start it manually. |

The CLI has no `help`, `update`, `uninstall`, or other implicit subcommand. The unified lifecycle entry owns upgrade,
repair, reinstall, uninstall, and clean reinstall. Native Host recovery can still reinstall globally and rerun setup:

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex --version
```

See the repository-wide [Command Reference](COMMANDS_en.md) for the Codex, DeepSeek, Core, and MCP
command catalogs.

## Start a Task

In the current Git repository, describe a bounded implementation, bug fix, refactoring, targeted-testing,
or development-delivery task directly and Codex can select Dev Flow from the Skill description. The exact
selector remains available when you want to force selection:

```text
$dev-flow-codex:dev-flow Fix idempotency in the order-creation endpoint and run targeted tests.
```

This is not a shell command. A new Task starts at `REQUIREMENTS` and uses the `plain` profile by
default. The same request may explicitly select `spec-kit` or `openspec`; the profile is immutable
after Task creation.

Core continuously returns:

- current node, purpose, and entry/completion conditions;
- revision, action identity, and repository binding;
- `allowed_effects`, `required_evidence`, and verification budget;
- semantic steps for the selected method profile;
- every legal transition, guard, destination, and reason rule.

After performing current-node work, Codex submits only a live Action transition and a closed payload.

## Run parallel Tasks in one repository

When the user explicitly lists two or more independent bounded tasks and asks to run them
concurrently in one logical Git repository, the Skill checks for a Host-provided worktree-backed
task/thread creation capability before ordinary Task admission. When available, every item receives
its own Git worktree and Codex task, and the child uses `$dev-flow-codex:dev-flow` to create its own
Core Task. The coordinator creates no parent Core Task and calls no Dev Flow MCP tool.

A generic sub-agent that shares the current working directory is not isolation. If the Host cannot
guarantee a separate worktree for every child, the Skill stops and asks the user to start separate
worktrees. It does not combine the items into one Task and does not commit, merge, rebase, push, or
resolve conflicts automatically. Each physical worktree still holds at most one active Task.

## Two-repository declaration, permission, and optional indexing

When a Codex session starts, the current Git repository becomes the primary repository. Every
additional repository must first be authorized as a writable root for that session through Codex
`--add-dir`. Dev Flow does not change the sandbox or inspect global Codex configuration to infer
authorization. After granting access, send:

```text
$dev-flow-codex:dev-flow Use the current Git repository as primary key core and add repository key docs at /absolute/path/to/docs. Update core::internal/api.go and docs::reference/api.md, then run only the targeted checks.
```

Replace the path with the real absolute path. A Scope contains one to eight repositories and cannot
add, remove, rename, or replace members after creation. Dev Flow does not scan parent or neighboring
directories, dependencies, or index results to discover repositories. A single-repository request
needs no key and retains ordinary relative paths. Resume from an additional repository returns the
original primary repository, ordered Scope, revision, and current Action.
Codex and DeepSeek share one Core contract for Repository Scope, scoped paths, Action, and the single
`repository_binding_digest`. Host permission checks do not create a second process state.

Optional code indexing is selected through the read-only configuration:

```json
{
  "codex": { "codebase_memory": true },
  "deepseek": { "codebase_memory": false }
}
```

The fixed path is `$HOME/.dev-flow/config.json`. A missing file means false, and Dev Flow does not
create or modify it. True permits only codebase-memory that is already visible and usable in the
current session. If it is missing, incomplete, or becomes unavailable, Codex reports that at most
once per Dev Flow session and immediately falls back to built-in Git, file, and text search without
blocking the Task. It never installs, configures, or starts the index. Index results cannot expand
the Scope, prove write permission, or determine Recovery and process transitions.

## Smart activation and explicit force-entry

Skill metadata sets `policy.allow_implicit_invocation: true`. Bounded implementation, bug-fix,
refactoring, targeted-testing, and development-delivery requests may select Dev Flow implicitly. The exact
selector remains the force-entry path:

```text
$dev-flow-codex:dev-flow
```

The naming and admission boundaries are:

- the Skill resource/base name is `dev-flow`;
- the installed Skill full name is `dev-flow-codex:dev-flow`;
- bare `$dev-flow` is not an alias and does not select the Skill;
- a wrong plugin namespace or wrong Skill base name is not explicit selection;
- without a selector, entry requires Host implicit selection for a task-bearing development request;
- explanation-only, status-only, design-discussion, ordinary-question, and ambiguous requests do not
  automatically create or resume a Dev Flow Task;
- explicit force-selection does not bypass a substantive request, repository permissions, Core Actions,
  Git-mutation authority, or release confirmation.

Both selection paths enter the same admission, compatibility handshake, Task discovery, and Action loop.
This boundary does not disable ordinary Codex repository tools and does not claim selector-bound MCP
visibility or authorization.

After admission, `dev_flow_server_info({})` must be the first Dev Flow call. Package contents, the
bundled Core, Codex compatibility, and registration ownership are already validated by
`dev-flow-codex setup`. Each Task startup silently confirms Core readiness, `standard-development`,
the definition digest, method profiles, and the closed fifteen-tool set, then immediately opens or
resumes the Task. A successful startup does not enumerate versions, digests, profiles, or tools to
the user; a failure reports the specific blocker and one actionable recovery step. Tool and method
profile order does not affect compatibility.

| MCP tool | Purpose |
| --- | --- |
| `dev_flow_server_info` | Read Core identity, capabilities, process, method profiles, tool catalog, and effective Codex index preference. It must be called first after valid admission. |
| `dev_flow_open_task` | Create one Task for the current primary and explicit additional repositories, or resume that Task from any participating repository. |
| `dev_flow_get_task` | Read the persisted Task and automatically return a Recovery assessment when Core retains a submission. |
| `dev_flow_get_next_action` | Read the current Action, its `submission_tool`, verification budget, method steps, and every legal transition. |
| `dev_flow_submit_requirements` | Submit the REQUIREMENTS node result; Core fills the complete Action identity and payload. |
| `dev_flow_submit_design` | Submit the DESIGN node result. |
| `dev_flow_submit_tasks` | Submit the TASKS node result. |
| `dev_flow_submit_implementation` | Submit the IMPLEMENT node result. |
| `dev_flow_submit_test` | Submit the TEST node result. |
| `dev_flow_submit_comprehension` | Submit the COMPREHENSION_REVIEW node result. |
| `dev_flow_submit_refactor` | Submit the REFACTOR node result. |
| `dev_flow_submit_delivery` | Submit the DELIVERY node result. |
| `dev_flow_resolve_blocker` | Resolve a blocker using only the Task ID and Action ID after its condition is met. |
| `dev_flow_recover_action` | Recover an uncertain Action from Core's retained normalized submission. |
| `dev_flow_cancel_task` | Cancel a nonterminal Task with the current revision and an explicit reason. |

`dev_flow_submit_delivery` accepts only Host-owned delivery judgment, unverified items, risks,
findings, and the mutation envelope. Core fills acceptance, automated/manual evidence IDs, and
Test/Comprehension record IDs from the current Task; submitting those members is rejected as
`unknown_member`.

## Comprehension and Recovery

After `TEST` passes, the Task enters `COMPREHENSION_REVIEW`. Codex explains current behavior, design,
and maintenance risk, and the developer provides an explicit verdict. Excess complexity routes to
`REFACTOR`; repository changes must return through `TEST`.

Core retains the normalized Action submission before advancing the Task. If the result is missing,
cancelled, truncated, malformed, or lost to a transport failure, the Adapter keeps only the Task ID
and Action ID, reads Core, and calls `dev_flow_recover_action` or stops as directed. It does not
rebuild the original payload.

## Data directory

The package lifecycle manages a default data directory. An explicit directory may be configured:

```bash
export DEV_FLOW_DATA_DIR="/absolute/path/to/existing-directory"
```

The explicit directory must already exist, be usable, and canonicalize successfully. Setup, removal,
and npm uninstallation retain Task data and unknown neighboring files and do not modify the target
Git repository.

Core accepts only the current SQLite Schema. Incompatible or pre-graph data returns
`SCHEMA_UNSUPPORTED` with zero writes. Select a new data directory or archive, rename, or delete the
old directory outside Core.

## Uninstall and permanently clean up

Remove Codex registration before uninstalling the global npm package:

```bash
dev-flow-codex remove
npm uninstall -g dev-flow-codex
```

For machine-readable removal output:

```bash
dev-flow-codex remove --json
```

Installing a compatible package and running `setup` again can resume Tasks from the retained current
data directory.

Only after removing the DeepSeek Adapter as well and confirming that no Task is needed, delete the
shared default Dev Flow data and any remaining registration receipt:

```bash
rm -rf "$HOME/Library/Application Support/dev-flow"
```

This cannot be undone. If `DEV_FLOW_DATA_DIR` was used, verify the exact absolute directory selected
for it and delete that directory separately. `remove`, npm uninstall, and Dev Flow Core never delete
it automatically. Use `dev-flow-codex remove` instead of editing Codex configuration manually: the
command follows the ownership receipt and preserves adjacent configuration.

## Package contents

`package.json.files` closes the production package. It contains the Plugin, Skill, MCP configuration,
lifecycle library, license, and one darwin-arm64 Core. It excludes the source tree, tests, fixtures,
specs, `.git`, `node_modules`, user data, build logs, and absolute paths, and has no install or
uninstall hook.

## Maintainer entrypoints

Package-local validation:

```bash
pnpm --dir packages/codex test
```

Source-local final artifact build:

```bash
ARTIFACT_ROOT="${TMPDIR:-/tmp}/dev-flow-codex-artifacts"
mkdir -p "$ARTIFACT_ROOT"
SOURCE_COMMIT="$(git rev-parse HEAD)"

pnpm --dir packages/codex run build:local \
  --output "$ARTIFACT_ROOT" \
  --final \
  --source-commit "$SOURCE_COMMIT" \
  --report "$ARTIFACT_ROOT/artifact-evidence.json"
```

Build output must stay outside the repository. Public releases use the standalone root release
command documented in [`release/codex/README.md`](../release/codex/README.md).
