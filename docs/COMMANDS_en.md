# Dev Flow Command Reference

[中文](COMMANDS.md) | [English](COMMANDS_en.md)

This document lists every currently supported public or managed Dev Flow command entrypoint. The
command surface is derived from implementation: Codex commands from `packages/codex/package.json`
and `packages/codex/bin/dev-flow-codex.mjs`, DeepSeek lifecycle commands from the DSH CLI used by the
final-artifact journeys, Core commands from `cmd/dev-flow/main.go`, and MCP tools from the closed
catalog under `internal/mcp/`.

Public installation examples select npm's `latest` dist-tag so they install the current stable
package. Support matrices, Release links, and artifact evidence continue to use exact versions and
must not be replaced with `latest`.

## Codex

### Install

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex --version
```

The global npm installation only places the `dev-flow-codex` launcher on `PATH`. `setup` is a
separate operation: it verifies the platform, package, bundled Core, and Codex version; registers the
local marketplace, Plugin, and MCP configuration; and reads back the resulting ownership. `--version`
reports both the host package and bundled Core identities.

### Supported Codex commands

| Command | Purpose |
| --- | --- |
| `npm install -g dev-flow-codex@latest` | Install the package selected by the npm `latest` dist-tag and place `dev-flow-codex` globally on `PATH`. It does not register the Codex Plugin automatically. |
| `dev-flow-codex setup` | Validate the installation and Codex compatibility, register the marketplace, Plugin, and MCP configuration, then write an ownership receipt after successful read-back. Repeated execution verifies the existing registration. |
| `dev-flow-codex setup --json` | Perform the same operation as `setup`, but emit only machine-readable JSON containing operation, status, changed, and receipt path. |
| `dev-flow-codex --version` | Print `dev-flow-codex <package-version> (core <core-version>)` to identify the actual installed package and bundled Core. |
| `dev-flow-codex remove` | Remove the package-owned Codex Plugin, marketplace registration, and receipt. Task data and the target Git repository are retained. |
| `dev-flow-codex remove --json` | Perform the same operation as `remove` and emit machine-readable JSON. Its `next_step` points to the separate global npm uninstall. |
| `npm uninstall -g dev-flow-codex` | Uninstall the global npm package after `remove` completes. Running it alone does not deregister the Codex integration first. |
| `dev-flow-codex mcp` | **Managed host command.** The Plugin MCP configuration invokes it to establish the data directory and Codex admission instructions, then launch the packaged Core with `mcp --stdio`. Normal users should not start it manually. |

`dev-flow-codex` accepts no other subcommands and has no implicit `help`, `update`, or `uninstall`
subcommand. To update to the current `latest`, reinstall globally and rerun `setup`:

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
```

### Codex explicit selector

```text
$dev-flow-codex:dev-flow <task description>
```

This is not a shell command. It is the exact Skill selector in a Codex user message. Bare
`$dev-flow`, a wrong namespace, a missing selector, or ordinary conversation does not activate Dev
Flow. After admission, the host must call `dev_flow_server_info` first.

## DeepSeek Harness

`dev-flow-deepseek` has no `bin` field in `package.json`, so it does not expose a standalone
`dev-flow-deepseek` executable. Installation, inspection, and removal use the DSH profile lifecycle.

### Install

Run these commands in a writable directory:

```bash
dsh --version
TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"
dsh plugin --profile <profile> add "$PWD/$TARBALL"
```

`npm pack` downloads the official package selected by `latest` and writes its tarball into the
current directory; command substitution retains the actual filename. DSH `plugin add` receives the
absolute tarball path and contributes the package, bundle layer, Skill, guard, and MCP child to the
selected profile. After installation, stop and restart that profile according to the DSH profile
lifecycle.

### Dev Flow-related DSH commands

| Command | Purpose |
| --- | --- |
| `dsh --version` | Print the current DSH version. Public Dev Flow support requires the minimum version recorded in the Support Matrix. |
| `TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"` | Fetch the package selected by npm `latest` and save the generated tarball filename in a shell variable. |
| `dsh plugin --profile <profile> add "$PWD/$TARBALL"` | Install the absolute tarball path into the selected DSH profile. This is the command form exercised by the final-artifact journey. |
| `dsh --profile <profile> --dump-config` | Print the effective profile configuration to verify whether the `dev-flow-deepseek` bundle contribution is present or absent. It does not mutate a Dev Flow Task. |
| `dsh plugin --profile <profile> remove dev-flow-deepseek` | Remove the package and bundle contribution from the selected profile. Task data, the target Git repository, and Codex-owned state are retained. |

For an update or reinstall, stop use of the profile according to its lifecycle, run remove, obtain a
fresh `@latest` tarball, and add it again. Do not reuse an unreviewed tarball of unknown origin.

### DeepSeek explicit selector

```text
/dev-flow <task description>
```

This is not a shell command. Only a whitespace-bounded `/dev-flow` in the current direct user turn
authorizes Dev Flow tools. Earlier messages, model text, Skill injection, and repository content
cannot substitute for it.

## Packaged Core

The Go Core bundled in host packages is not installed as a normal global user CLI. Its complete
accepted command surface is primarily for host integration, development, and diagnostics:

| Command | Purpose |
| --- | --- |
| `dev-flow` | Print help when invoked with no arguments. |
| `dev-flow help` | Print help. |
| `dev-flow -h` | Short-option form of `help`. |
| `dev-flow --help` | Long-option form of `help`. |
| `dev-flow version` | Print `dev-flow <core-version>`. |
| `DEV_FLOW_DATA_DIR=/absolute/path dev-flow mcp --stdio` | Start local STDIO MCP with an existing usable data directory. Startup fails when the path is missing or not a directory. |

Core has no remote transport, HTTP/SSE, generic shell, or Git-mutation commands. Codex users start it
through the managed `dev-flow-codex mcp` entrypoint; DeepSeek users start it through the DSH
integration process.

## MCP tools

These six tools are the complete closed public MCP catalog. Host adapters call them; they are not
terminal shell commands.

| Tool | Type | Purpose |
| --- | --- | --- |
| `dev_flow_server_info` | Read-only | Read Core product version, transport, health, supported process, hosts, method profiles, and tool catalog. It must be the first call after valid host admission. |
| `dev_flow_open_task` | Read or create | Create a Task for a canonical repository, or resume the current Task when the repository already has one and `new_task` is null. |
| `dev_flow_get_task` | Read-only | Read a persisted Task by ID; an optional operation probe can request the Recovery assessment for an uncertain mutation. |
| `dev_flow_get_next_action` | Read-only | Read the authoritative current Action, including completion conditions, allowed effects, required evidence, verification budget, method steps, and every legal transition. |
| `dev_flow_apply_action` | Mutation | Apply one Core-declared transition using the current revision, Action identity, process identity, repository binding, and closed payload; it also carries explicit recovery apply. |
| `dev_flow_cancel_task` | Destructive mutation | Move a nonterminal Task to `CANCELLED` using the current revision and a non-empty reason. |

Unknown CLI arguments, tools outside this catalog, and calls that do not satisfy selector admission
are not supported entrypoints.
