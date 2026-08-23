# dev-flow-codex

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/codex/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/CODEX_en.md)

`dev-flow-codex` brings the Dev Flow state graph to Codex CLI. The package contains a Codex Plugin,
an explicit Skill, local STDIO MCP configuration, and a macOS arm64 Core executable. The bundled Go
Core remains the sole authority for Tasks, nodes, transitions, and Recovery.

## Support

| Item | Current support |
| --- | --- |
| Package | `dev-flow-codex@0.5.3` |
| Bundled Core | `0.5.1` |
| Platform | macOS arm64 |
| Node.js | `>=24` |
| Codex | `>=0.147.0` |
| Release | [codex-v0.5.3](https://github.com/Innocent-children/dev-flow/releases/tag/codex-v0.5.3) |

The `0.5.3` normal release passed registry-package installation, package/Core identity, setup, Core
handshake, removal, uninstallation, and repository-unchanged gates. The table records the exact
verified public version; the installation commands below select npm's `latest` dist-tag.

## Install and verify

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex --version
```

The global npm operation only installs the package and places the `dev-flow-codex` launcher on
`PATH`. `setup` is separate: it validates the platform, package contents, bundled Core, and Codex
compatibility; registers the Plugin, marketplace, and MCP configuration; and reads back ownership.
`--version` reports the actual package and bundled Core identities.

## Command reference

The production `dev-flow-codex` CLI accepts only the commands below. Unknown arguments fail before
any registration operation is dispatched.

| Command | Description |
| --- | --- |
| `npm install -g dev-flow-codex@latest` | Install the package selected by npm `latest` and place the launcher globally on `PATH`. It does not register the Codex Plugin automatically. |
| `dev-flow-codex setup` | Validate the package, Core, and Codex version; register the marketplace, Plugin, and MCP configuration; and read back the final state. Repeated execution verifies existing ownership, and compatible package upgrades use the same command. |
| `dev-flow-codex setup --json` | Perform the same operation as `setup`, but emit machine-readable JSON containing `operation`, `status`, `changed`, and `receipt_path`. |
| `dev-flow-codex --version` | Print `dev-flow-codex <package-version> (core <core-version>)` to identify the installed package and bundled Core. |
| `dev-flow-codex remove` | Remove the package-owned Plugin, marketplace registration, and receipt while retaining Task data, unknown neighboring files, and the target Git repository. |
| `dev-flow-codex remove --json` | Perform the same operation as `remove` and emit machine-readable JSON. `next_step` identifies the separate global npm uninstall. |
| `npm uninstall -g dev-flow-codex` | Uninstall the global package after `remove` completes. Running it alone does not deregister Codex first. |
| `dev-flow-codex mcp` | **Managed host command.** The Plugin MCP configuration invokes it to set the data directory and admission instructions, then launch the packaged Core with `mcp --stdio`. Normal users should not start it manually. |

The CLI has no `help`, `update`, `uninstall`, or other implicit subcommand. To update to the current
latest package, reinstall globally and rerun `setup`:

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex --version
```

See the repository-wide [Command Reference](COMMANDS_en.md) for the Codex, DeepSeek, Core, and MCP
command catalogs.

## Start a Task

In the current Git repository, describe the work with the only exact selector:

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

## Explicit invocation boundary

Skill metadata sets `policy.allow_implicit_invocation: false`, so only this exact selector enters Dev
Flow:

```text
$dev-flow-codex:dev-flow
```

The naming and admission boundaries are:

- the Skill resource/base name is `dev-flow`;
- the installed Skill full name is `dev-flow-codex:dev-flow`;
- bare `$dev-flow` is not an alias and does not select the Skill;
- a wrong plugin namespace, wrong Skill base name, or missing selector does not select the Skill;
- an ordinary prompt must produce zero Dev Flow calls;
- a non-exact selector must not complete a task-bearing operation.

This boundary does not disable ordinary Codex repository tools and does not claim selector-bound MCP
visibility or authorization. It controls whether this Skill may initiate Dev Flow calls.

After admission, `dev_flow_server_info({})` must be the first Dev Flow call. Package contents, the
bundled Core, Codex compatibility, and registration ownership are already validated by
`dev-flow-codex setup`. Each Task startup silently confirms Core readiness, `standard-development`,
the definition digest, method profiles, and the closed six-tool set, then immediately opens or
resumes the Task. A successful startup does not enumerate versions, digests, profiles, or tools to
the user; a failure reports the specific blocker and one actionable recovery step. Tool and method
profile order does not affect compatibility.

| MCP tool | Purpose |
| --- | --- |
| `dev_flow_server_info` | Read Core identity, capabilities, process, method profiles, and the tool catalog. It must be called first after valid admission. |
| `dev_flow_open_task` | Create a Task for the current canonical repository or resume its existing Task. |
| `dev_flow_get_task` | Read the persisted Task and optionally attach an operation probe for a Recovery assessment. |
| `dev_flow_get_next_action` | Read the authoritative current Action, verification budget, method steps, and every legal transition. |
| `dev_flow_apply_action` | Apply one Core-declared transition with the current revision, Action identity, repository binding, and closed payload. |
| `dev_flow_cancel_task` | Cancel a nonterminal Task with the current revision and an explicit reason. |

## Comprehension and Recovery

After `TEST` passes, the Task enters `COMPREHENSION_REVIEW`. Codex explains current behavior, design,
and maintenance risk, and the developer provides an explicit verdict. Excess complexity routes to
`REFACTOR`; repository changes must return through `TEST`.

Before each mutation, the Adapter retains request/operation ID, source cursor, revision, action,
repository binding, and original payload. If the result is missing, cancelled, truncated, malformed,
or lost to a transport failure, the Adapter reads Core and follows its five-class Recovery assessment
and advice. It does not infer retry safety or destination.

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
