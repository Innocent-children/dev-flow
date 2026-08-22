# dev-flow-codex

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/codex/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/CODEX_en.md)

`dev-flow-codex` brings the Dev Flow process graph to Codex CLI. The package contains a Codex
Plugin, an explicit Skill, local STDIO MCP configuration, and a macOS arm64 Core executable. The
bundled Go Core remains the sole authority for Tasks, nodes, transitions, and Recovery.

## Support

| Item | Current support |
| --- | --- |
| Package | `dev-flow-codex@0.5.1` |
| Bundled Core | `0.5.0` |
| Platform | macOS arm64 |
| Node.js | `>=24` |
| Codex | `>=0.147.0` |
| Release | [codex-v0.5.1](https://github.com/Innocent-children/dev-flow/releases/tag/codex-v0.5.1) |

The `0.5.1` normal release passed registry-package installation, package/Core identity, setup, Core
handshake, removal, uninstallation, and repository-unchanged gates.

## Install

```bash
npm install -g dev-flow-codex@0.5.1
dev-flow-codex setup
dev-flow-codex --version
```

`setup` registers the Plugin, marketplace, and MCP configuration, then reads back ownership. npm
installation and Codex registration are separate operations, so run `setup` explicitly after
installing the package.

For machine-readable output:

```bash
dev-flow-codex setup --json
```

## Start a Task

In the current Git repository, describe the work with the only explicit selector:

```text
$dev-flow-codex:dev-flow Fix idempotency in the order-creation endpoint and run targeted tests.
```

A new Task starts at `REQUIREMENTS` and uses the `plain` profile by default. The same request may
explicitly select `spec-kit` or `openspec`. The method profile is immutable after Task creation.

Core continuously returns:

- current node, purpose, and entry/completion conditions;
- revision, action identity, and repository binding;
- allowed effects, required evidence, and verification budget;
- semantic steps for the selected method profile;
- every legal transition, guard, destination, and reason rule.

After performing current-node work, Codex submits only a live Action transition and a closed payload.

## Explicit invocation boundary

Skill metadata sets `policy.allow_implicit_invocation: false`.

The Skill resource/base name is `dev-flow`.

The installed Skill full name is `dev-flow-codex:dev-flow`.

The only exact explicit selector is `$dev-flow-codex:dev-flow`.

Bare `$dev-flow` is not an alias and does not select this Skill. A wrong plugin namespace, wrong
Skill base name, or missing selector also fails selection. An ordinary prompt must produce zero Dev
Flow calls, and a non-exact selector must not complete a task-bearing operation.

This boundary does not disable ordinary Codex repository tools. The package does not claim
selector-bound MCP visibility or authorization; it controls whether this Skill may initiate Dev Flow
calls.

After admission, `dev_flow_server_info({})` must be the first Dev Flow call. The Host validates
`standard-development`, definition digest, method profiles, live schemas, and exactly six tools:

```text
dev_flow_server_info
dev_flow_open_task
dev_flow_get_task
dev_flow_get_next_action
dev_flow_apply_action
dev_flow_cancel_task
```

## Comprehension and Recovery

After `TEST` passes, the Task enters `COMPREHENSION_REVIEW`. Codex explains current behavior,
design, and maintenance risk, and the developer provides an explicit verdict. Excess complexity
routes to `REFACTOR`; repository changes must return through `TEST`.

Before each mutation, the Adapter retains request/operation ID, source cursor, revision, action,
repository binding, and original payload. If the result is missing, cancelled, truncated, malformed,
or lost to a transport failure, the Adapter reads Core and follows its five-class Recovery assessment
and advice. It does not infer retry safety or destination.

## Data directory

The package lifecycle manages a default data directory. An explicit directory may be configured:

```bash
export DEV_FLOW_DATA_DIR="/absolute/path/to/existing-directory"
```

The directory must already exist, be usable, and canonicalize successfully. Setup, removal, and npm
uninstallation retain Task data and unknown neighboring files and do not modify the target Git
repository.

Core accepts only the current SQLite Schema. Incompatible or pre-graph data returns
`SCHEMA_UNSUPPORTED` with zero writes. Select a new data directory or archive, rename, or delete the
old directory outside Core.

## Remove

Remove Codex registration before uninstalling the npm package:

```bash
dev-flow-codex remove
npm uninstall -g dev-flow-codex
```

For machine-readable output:

```bash
dev-flow-codex remove --json
```

Installing a compatible package and running `setup` again can resume Tasks from the retained
current data directory.

## Package contents

`package.json.files` closes the production package. It contains the Plugin, Skill, MCP
configuration, lifecycle library, license, and one darwin-arm64 Core. It excludes the source tree,
tests, fixtures, specs, `.git`, `node_modules`, user data, build logs, and absolute paths, and has
no install or uninstall hook.

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
