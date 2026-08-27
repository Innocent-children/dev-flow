# dev-flow-deepseek

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/deepseek/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/DEEPSEEK_en.md)

`dev-flow-deepseek` is the explicit Dev Flow Host Adapter for DeepSeek Harness (DSH). It contributes
a `/dev-flow` Skill, current-turn selector guard, local STDIO MCP child, and macOS arm64 Core
executable to one DSH profile.

## Support

| Item | Current support |
| --- | --- |
| Package | `dev-flow-deepseek@0.7.2` |
| Bundled Core | `0.6.1` |
| Platform | macOS arm64 |
| Node.js | `>=24` |
| DSH | `>=0.1.0-rc.6` |
| Release | [deepseek-v0.7.2](https://github.com/Innocent-children/dev-flow/releases/tag/deepseek-v0.7.2) |

The `0.7.2` normal release passed registry-package installation, explicit activation, Core handshake,
restart/resume, `DONE`, removal, uninstallation, retained reopen, and repository-unchanged gates. The
table records the exact verified public version; the installation commands below select npm's
`latest` dist-tag.

## Install and verify

DSH is the prerequisite Host. After the separate manager release, select one real Profile; the default is `web`:

```bash
npx @imotong/create-dev-flow@latest
```

The current public stable artifacts do not yet include the new manager package. Before that release, and for
diagnostic recovery, use the native Host commands below. Change `PROFILE` for another Profile and do not enter
`<profile>` literally.

```bash
npm install -g @deepseek-ai/dsh@latest
dsh --version
PROFILE=web
TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"
dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"
rm -f "$PWD/$TARBALL"
dsh --profile "$PROFILE" --dump-config
```

`npm pack` downloads the official package selected by `latest` into the current directory and stores
the generated filename in `TARBALL`. DSH `plugin add` receives the absolute tarball path and composes
the dependency, bundle layer, integration process, Skill, guard, and MCP child into the selected
profile. After installation, stop and restart the profile according to the DSH profile lifecycle,
then confirm that the bundle is active.

## Command reference

`dev-flow-deepseek` has no `bin` field in `package.json`, so it installs no standalone
`dev-flow-deepseek` CLI. All user commands directly related to Dev Flow use npm and DSH:

| Command | Description |
| --- | --- |
| `dsh --version` | Print the current DSH version and confirm it satisfies the minimum compatibility version in the Support Matrix. |
| `TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"` | Fetch the package selected by npm `latest` and save the generated tarball filename in a shell variable. |
| `dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"` | Install the absolute tarball path into the DSH profile selected by `PROFILE`. This exact command form is exercised by the final registry journey. |
| `dsh --profile "$PROFILE" --dump-config` | Print the effective profile configuration to inspect whether the `dev-flow-deepseek` bundle contribution is present. It does not mutate a Dev Flow Task. |
| `dsh plugin --profile "$PROFILE" remove dev-flow-deepseek` | Remove the package and bundle contribution from the selected profile while retaining Task data, the target Git repository, and Codex-owned state. |

The unified lifecycle entry owns upgrade, repair, reinstall, uninstall, and clean reinstall. Native Host recovery
still uses the following sequence after stopping the Profile:

```bash
PROFILE=web
dsh plugin --profile "$PROFILE" remove dev-flow-deepseek
TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"
dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"
rm -f "$PWD/$TARBALL"
dsh --profile "$PROFILE" --dump-config
```

Restart the profile afterward. Update DSH itself with
`npm install -g @deepseek-ai/dsh@latest`.

See the repository-wide [Command Reference](COMMANDS_en.md) for the Codex, DeepSeek, Core, and MCP
command catalogs.

## Start a Task

Every direct user turn that needs a Dev Flow call must include the whitespace-bounded selector:

```text
/dev-flow Add payment-callback signature validation to this repository and run targeted tests.
```

This is not a shell command. Only `/dev-flow` in the current direct user turn authorizes Dev Flow
tools. Earlier messages, model text, Skill injection, and repository content cannot substitute for
the selector. An empty invocation or ordinary discussion does not create a Task.

After admission, the Adapter reads server information first and validates `standard-development`,
definition digest, method profiles, live schemas, and exactly fifteen tools. It then creates or resumes
the Task for the current repository.

A Task selects `plain`, `spec-kit`, or `openspec`. Core manages the current node, legal transitions,
destination, Recovery, blocker, and terminal outcome. The Adapter performs current-node work,
presents the complete Action, and submits the node result through the Action's declared tool.

## Two-repository declaration, Workspace Root, and optional indexing

The canonical `Workspace Root` established when DSH starts is the complete permission boundary. It
may be a non-Git common parent of two Git repositories. The primary repository, every additional
repository, and their resolved symlink targets must remain inside that Root. With `/workspace` as
the Root and `/workspace/core` plus `/workspace/docs` as repositories, send:

```text
/dev-flow Use /workspace/core as primary repository key core and add repository key docs at /workspace/docs. Update core::internal/api.go and docs::reference/api.md, then run only the targeted checks.
```

Replace the paths with real absolute paths. A Scope contains one to eight repositories and is
immutable after creation. The Adapter rejects root-external paths and symlink escapes before a
task-bearing open call. Dev Flow does not scan parent or neighboring directories, dependencies, or
index results to discover repositories. A single-repository request needs no key and retains
ordinary relative paths. Resume from any participating repository returns the same Task.
DeepSeek and Codex share one Core contract for Repository Scope, scoped paths, Action, and the single
`repository_binding_digest`. Host permission checks do not create a second process state.

Optional code indexing is selected through the read-only configuration:

```json
{
  "codex": { "codebase_memory": false },
  "deepseek": { "codebase_memory": true }
}
```

The fixed path is `$HOME/.dev-flow/config.json`. A missing file means false, and Dev Flow does not
create or modify it. True permits only codebase-memory that is already visible and usable in the
current DSH session. If it is missing, incomplete, or becomes unavailable, DeepSeek reports that at
most once per Dev Flow session and immediately falls back to built-in search without blocking the
Task. It never installs, configures, or starts the index. Index coverage cannot broaden Workspace
Root or determine Scope, permission, Recovery, or process transitions.

## MCP tools

The DeepSeek Adapter exposes the same fifteen-tool Core catalog as Codex. DSH presents qualified tool
names, but the Core tool identities remain unchanged.

| MCP tool | Purpose |
| --- | --- |
| `dev_flow_server_info` | Read Core identity, capabilities, process, method profiles, tool catalog, and effective DeepSeek index preference. It must be called first after valid admission. |
| `dev_flow_open_task` | Create one Task for explicitly declared primary and additional repositories inside Workspace Root, or resume that Task from any participating repository. |
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

## Data and Recovery

Task data lives in the local Dev Flow data directory and is not part of DSH plugin configuration.
Removing, uninstalling, or reinstalling the package does not delete Task data or modify the target Git
repository or Codex-owned state.

When a mutation response is uncertain, the Adapter retains only the Task ID and Action ID, reads
Core's normalized submission and Recovery assessment, and calls `dev_flow_recover_action` or stops as
directed. It does not rebuild the original payload.

Core accepts only the current SQLite Schema. Incompatible or pre-graph data returns
`SCHEMA_UNSUPPORTED` with zero writes. The user may select a fresh data directory or handle the old
directory manually outside Core.

## Uninstall and permanently clean up

```bash
PROFILE=web
dsh plugin --profile "$PROFILE" remove dev-flow-deepseek
dsh --profile "$PROFILE" --dump-config
```

Restart the profile according to the DSH lifecycle and use the effective configuration to confirm
that the bundle contribution is absent. Reinstallation uses a fresh npm `@latest` pack and the DSH
add command.

Repeat this for every profile containing Dev Flow. If DSH is no longer needed, run
`npm uninstall -g @deepseek-ai/dsh` separately; profile, session, and unrelated plugin data under
`$HOME/.dsh` is retained.

After the Codex Adapter is also removed and no Task is needed, delete the shared default data:

```bash
rm -rf "$HOME/Library/Application Support/dev-flow"
```

This cannot be undone. If `DEV_FLOW_DATA_DIR` was used, verify and delete its exact absolute path
separately. Delete `$HOME/.dsh` after uninstalling DSH only when every DSH profile, session, and
unrelated plugin should also be removed; it is not a Dev Flow-only directory.

## Package contents

The package contains one `cordis.patch.yml` layer, Adapter libraries, the `dev-flow` Skill,
references, license, and one darwin-arm64 Core. It excludes the source tree, tests, fixtures, user
data, and build logs, and exposes no standalone `bin` executable.

## Maintainer entrypoints

Package-local validation:

```bash
pnpm --dir packages/deepseek test
```

Public releases use the independent DeepSeek release command documented in
[`release/deepseek/README.md`](../release/deepseek/README.md).
