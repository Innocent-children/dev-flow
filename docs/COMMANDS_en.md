# Dev Flow Command Reference

[中文](COMMANDS.md) | [English](COMMANDS_en.md)

This document lists every currently supported public or managed Dev Flow command entrypoint. The
command surface is derived from implementation: unified lifecycle commands from
`packages/dev-flow/package.json` and its CLI, Codex commands from `packages/codex/package.json`
and `packages/codex/bin/dev-flow-codex.mjs`, DeepSeek lifecycle commands from the DSH CLI used by the
final-artifact journeys, Core commands from `cmd/dev-flow/main.go`, and MCP tools from the closed
catalog under `internal/mcp/`.

Public installation examples select npm's `latest` dist-tag so they install the current stable
package. Support matrices, Release links, and artifact evidence continue to use exact versions and
must not be replaced with `latest`.

## Unified Adapter lifecycle

`@imotong/dev-flow` provides one Host-neutral lifecycle and Control Center entry:

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

The closed operations are `status`, `doctor`, `install`, `upgrade`, `repair`, `reinstall`, `uninstall`, and
`factory-reset`. Host is `codex|deepseek|all`; the default DeepSeek Profile is `web`. Ordinary uninstall, upgrade,
repair, and reinstall preserve configuration and Task data. Factory reset requires the token bound to the current
plan; `--yes` alone has no data-cleanup authority. Default cleanup moves data to macOS Trash, while permanent removal
requires another confirmation.
The Codex global package is observed independently from its receipt and Plugin registration. Even when registration
is already absent, `uninstall` and `factory-reset` still remove an installed global package.
The interactive interface reads the current locale: `zh*` uses Simplified Chinese and every other locale uses
English. JSON output remains language-neutral.

| Entry | Purpose |
| --- | --- |
| `npm install -g @imotong/dev-flow@latest` | Install the public `dev-flow` command globally. |
| `dev-flow` | Open the interactive lifecycle menu. |
| `dev-flow status\|doctor --host codex\|deepseek\|all` | Inspect or diagnose without mutation. |
| `dev-flow install\|upgrade\|repair\|reinstall --host ... [--profile web] [--version latest] --yes` | Perform ordinary maintenance while preserving configuration and Task data. |
| `dev-flow uninstall --host ... [--all-known-profiles] --yes` | Remove selected Adapters while preserving configuration and Task data. |
| `dev-flow factory-reset --host all --all-known-profiles` | Produce a current-state-bound reset plan/token; `--yes` has no cleanup authority. |
| `dev-flow factory-reset ... --confirm-reset <token> [--reinstall]` | Move confirmed data to Trash and optionally perform a clean reinstall. |
| `dev-flow webui start\|open\|status\|stop` | Select and verify Core from either installed Adapter, then manage the shared local Control Center; `start` may create a missing default data directory with mode `0700`, while the other commands create nothing. |
| `dev-flow webui reset [--confirm TOKEN]` | Use Core's target-bound confirmation to clear incompatible Task data. |
| `--json` / `--plain` | Select one JSON object or ANSI-free plain output. |

When `DEV_FLOW_DATA_DIR` is set, the public launcher accepts only an existing canonical, non-symbolic-link absolute
directory. No command creates an explicit directory.

Native Host commands remain available for diagnostic recovery.

## Codex

### Install

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex --version
```

The global npm installation only places the `dev-flow-codex` launcher on `PATH`. `setup` is a
separate operation: it verifies the platform, package, bundled Core, and Codex version; registers the
local marketplace, Plugin, and MCP configuration; and reads back the resulting ownership. When
configuration is absent, setup first creates `$HOME/.dev-flow/config.json`; success then reports
actual configuration/receipt file changes and one next step. `--version`
reports both the host package and bundled Core identities.

### Supported Codex commands

| Command | Purpose |
| --- | --- |
| `npm install -g dev-flow-codex@latest` | Install the package selected by the npm `latest` dist-tag and place `dev-flow-codex` globally on `PATH`. It does not register the Codex Plugin automatically. |
| `dev-flow-codex setup` | Create or validate fixed user configuration, validate the installation and Codex compatibility, register the marketplace, Plugin, and MCP configuration, then report actual configuration/receipt changes, readiness, and one next step. Repeated execution verifies the existing registration. |
| `dev-flow-codex setup --json` | Perform the same operation as `setup`, but emit one machine-readable JSON line retaining operation, status, changed, and receipt_path while adding configuration_path, file_changes, and next_step. |
| `dev-flow-codex status` | Read and display the current package/Core and registration state. |
| `dev-flow-codex status --json` | Read package, Core, receipt, marketplace, and Plugin state without creating configuration, registration, or data. |
| `dev-flow-codex --version` | Print `dev-flow-codex <package-version> (core <core-version>)` to identify the actual installed package and bundled Core. |
| `dev-flow-codex remove` | Remove the package-owned Codex Plugin, marketplace registration, and receipt. Task data and the target Git repository are retained. |
| `dev-flow-codex remove --json` | Perform the same operation as `remove` and emit machine-readable JSON. Its `next_step` points to the separate global npm uninstall. |
| `npm uninstall -g dev-flow-codex` | Uninstall the global npm package after `remove` completes. Running it alone does not deregister the Codex integration first. |
| `dev-flow-codex mcp` | **Managed host command.** The Plugin MCP configuration invokes it to establish the data directory and Codex admission instructions, then launch the packaged Core with `mcp --stdio`. Normal users should not start it manually. |

`dev-flow-codex` accepts no other subcommands and has no implicit `help`, `update`, or `uninstall`
subcommand. Native Host recovery can update to `latest` by reinstalling globally and rerunning `setup`:

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex --version
```

To uninstall while retaining Task data, run `dev-flow-codex remove` and then
`npm uninstall -g dev-flow-codex`. Delete the shared default data directory at
`$HOME/Library/Application Support/dev-flow` only after both the Codex and DeepSeek Adapters are
removed and no Task is needed.

### Codex smart activation and explicit selector

```text
$dev-flow-codex:dev-flow <task description>
```

This is not a shell command. It is the exact Skill selector in a Codex user message and force-selects
Dev Flow. The Host may also select the Skill implicitly for a bounded implementation, bug fix,
refactoring, targeted-testing, or development-delivery request; bare `$dev-flow` and a wrong namespace
remain invalid explicit selectors. Explanation-only, status-only, design-discussion, ordinary-question,
and ambiguous requests do not automatically create or resume a Task. Both paths use the same admission,
then the host silently calls `dev_flow_server_info`; explicit selection does not bypass permissions,
Core Actions, Git-mutation authority, or release confirmation.

## DeepSeek Harness

`dev-flow-deepseek` has no `bin` field in `package.json`, so it does not expose a standalone
`dev-flow-deepseek` executable. Installation, inspection, and removal use the DSH profile lifecycle.

### Install

Install DSH first, then add Dev Flow to a real profile from a writable directory. This example uses
`web`; change `PROFILE` for another profile and do not enter `<profile>` literally:

```bash
npm install -g @deepseek-ai/dsh@latest
dsh --version
PROFILE=web
TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"
dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"
rm -f "$PWD/$TARBALL"
dsh --profile "$PROFILE" --dump-config
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
| `dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"` | Install the absolute tarball path into the DSH profile selected by `PROFILE`. This is the command form exercised by the final-artifact journey. |
| `dsh --profile "$PROFILE" --dump-config` | Print the effective profile configuration to verify whether the `dev-flow-deepseek` bundle contribution is present or absent. It does not mutate a Dev Flow Task. |
| `dsh plugin --profile "$PROFILE" remove dev-flow-deepseek` | Remove the package and bundle contribution from the selected profile. Task data, the target Git repository, and Codex-owned state are retained. |

For an update or reinstall, stop the profile, remove the package, fetch a fresh `@latest` tarball,
add it, delete the temporary tarball, and restart the profile. Repeat removal for every profile that
contains Dev Flow. If DSH is no longer needed, uninstall it separately with
`npm uninstall -g @deepseek-ai/dsh`; profile data under `$HOME/.dsh` is retained.

For permanent Task-data cleanup, first remove both Host Adapters, then delete
`$HOME/Library/Application Support/dev-flow`. If `DEV_FLOW_DATA_DIR` was set, verify and delete its
exact absolute directory separately. Deleting `$HOME/.dsh` also deletes every DSH profile, session,
and unrelated plugin.

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
| `dev-flow webui start [--no-open] [--plain\|--json]` | Start or reuse the shared loopback WebUI; open the browser by default. |
| `dev-flow webui open [--plain\|--json]` | Validate the receipt, process identity, and live Core status, then open the same URL. |
| `dev-flow webui status [--plain\|--json]` | Return `ready`, `read_only`, `reset_required`, `incompatible`, or `unavailable`. |
| `dev-flow webui stop [--plain\|--json]` | Verify PID and process-start identity before stopping the shared instance. |
| `dev-flow webui reset [--confirm TOKEN] [--plain\|--json]` | Without a token, show the exact permanent cleanup plan; confirmation first obtains exclusive database access and deletes only bound targets. There is no reset HTTP mutation. |

`dev-flow webui serve` is an internal child-process entrypoint used by the public lifecycle, not a Host user command. Core
has no remote transport, generic HTTP/SSE transport, generic shell, or Git-mutation commands. Codex users start it
through the managed `dev-flow-codex mcp` entrypoint; DeepSeek users start it through the DSH
integration process.

## MCP tools

These fifteen tools are the complete closed public MCP catalog. Host adapters call them; they are not
terminal shell commands.

| Tool | Type | Purpose |
| --- | --- | --- |
| `dev_flow_server_info` | Read-only | Read Core product version, transport, health, supported process, hosts, method profiles, tool catalog, and effective host code-index preferences. It must be the first call after valid host admission. |
| `dev_flow_open_task` | Read or create | Create a Task for one explicit Repository Scope, or resume the same Task from any participating repository when `new_task` is null. |
| `dev_flow_get_task` | Read-only | Read a persisted Task by ID; automatically returns a Recovery assessment when Core retains an Action submission. |
| `dev_flow_get_next_action` | Read-only | Read the current Action, its `submission_tool`, completion conditions, allowed effects, required evidence, verification budget, method steps, and every legal transition. |
| `dev_flow_submit_requirements` | Mutation | Submit the REQUIREMENTS node result. |
| `dev_flow_submit_design` | Mutation | Submit the DESIGN node result. |
| `dev_flow_submit_tasks` | Mutation | Submit the TASKS node result. |
| `dev_flow_submit_implementation` | Mutation | Submit the IMPLEMENT node result. |
| `dev_flow_submit_test` | Mutation | Submit the TEST node result. |
| `dev_flow_submit_comprehension` | Mutation | Submit the COMPREHENSION_REVIEW node result. |
| `dev_flow_submit_refactor` | Mutation | Submit the REFACTOR node result. |
| `dev_flow_submit_delivery` | Mutation | Submit the DELIVERY node result. |
| `dev_flow_resolve_blocker` | Mutation | Resolve the current blocker after Core verifies repository restoration; accepts only host, Task ID, and Action ID. |
| `dev_flow_recover_action` | Mutation | Recover an uncertain Action from the normalized submission retained in the Task snapshot; accepts no original payload. |
| `dev_flow_cancel_task` | Destructive mutation | Move a nonterminal Task to `CANCELLED` using the current revision and a non-empty reason. |

Each ordinary node submission tool accepts only `host`, `task_id`, `action_id`, `transition_id`,
`summary`, `reason`, `artifacts`, `method_results`, and that node's exact `node_result`. Core fills the
revision, Action kind, process identity, source cursor, repository binding, artifact roles, method
step identity/order/status, and internal payload envelope. `get_next_action.submission_tool` names the
only submission tool for the current Action.

Unknown CLI arguments, tools outside this catalog, and calls that do not satisfy shared implicit/explicit admission
are not supported entrypoints.

### Repository Scope and host-preference fields

When creating a multi-repository Task, `repository_path` identifies the primary repository. The call
may add one primary key and up to seven explicit additional repositories:

```json
{
  "host": "codex",
  "repository_path": "/workspace/core",
  "primary_repository_key": "core",
  "additional_repositories": [
    { "key": "docs", "repository_path": "/workspace/docs" }
  ],
  "new_task": {
    "request": "Synchronize interface documentation across the Core and docs repositories",
    "initial_scope": [],
    "initial_out_of_scope": [],
    "known_acceptance_criteria": [],
    "verification_budget": {
      "level": "targeted",
      "max_automatic_commands": 1,
      "allow_full_suite": false,
      "allow_manual_handoff": false
    },
    "method_profile": "plain"
  }
}
```

This example shows the closed MCP input shape; it is not a shell command. Creation uses the existing
non-null Task intent in `new_task`. Resume omits it or sets it to `null`, may point
`repository_path` at any participating repository, and omits the Scope-creation fields. A Scope
contains one to eight repositories, additions are sorted by key, and membership is immutable after
creation. Single-repository calls require no new fields and retain ordinary relative paths.
Multi-repository payload paths use `<repository-key>::<repository-relative-path>`.

The Task result retains the primary `repository` and adds `primary_repository_key` plus sorted
`additional_repositories`. The current Action's single `repository_binding_digest` remains the
primary binding digest for a single-repository Task and becomes the complete Scope aggregate for a
multi-repository Task. Every active Task's `repository_claims` are acquired, retained, or released
in the same SQLite transaction as the snapshot and event. An incompatible old Schema follows
`reject-and-reset`: reject with zero writes before writable open and never migrate, delete, rename,
or overwrite the data.

The `dev_flow_server_info({})` result includes:

```json
{
  "host_preferences": {
    "codex": { "codebase_memory": false },
    "deepseek": { "codebase_memory": false }
  }
}
```

These values come from the process-start snapshot of the read-only
`$HOME/.dev-flow/config.json` file. They express preference, not installed or available index
capability. Both are false when the file is absent, and Dev Flow does not create or modify it.
