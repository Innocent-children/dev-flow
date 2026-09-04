# Dev Flow Command Reference

[中文](COMMANDS.md) | [English](COMMANDS_en.md)

> Most users only need to install the unified entry, run `dev-flow`, and use the corresponding
> selector in their Host. Other commands are mainly for diagnosis, recovery, and integration work.

This document lists every currently supported public or managed Dev Flow command entrypoint. The
command surface is derived from implementation: unified lifecycle commands from
`packages/dev-flow/package.json` and its CLI, Codex commands from `packages/codex/package.json`
and `packages/codex/bin/dev-flow-codex.mjs`, DeepSeek lifecycle commands from the DSH CLI used by the
DSH lifecycle tests, Core commands from `cmd/dev-flow/main.go`, and MCP tools from the closed
catalog under `internal/mcp/`.

Public installation examples select npm's `latest` dist-tag so they install the current stable
package. Exact product versions remain in machine-readable release records.

The current source launcher and bundled Core accept exactly two runtime pairs: `darwin-arm64` and
`win32-x64`. The `@latest` commands below still describe the current npm stable channel. Validate the
Windows 10/11 desktop x64 source capability with packages built from this repository until an
explicitly confirmed release places those artifacts on the stable channel.

## Recommended entry for most users

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

After installation, Codex uses `$dev-flow-codex:dev-flow <task description>` and DeepSeek Harness
uses `/dev-flow <task description>`. These are conversational Host selectors, not shell commands.

## Unified Adapter lifecycle

`@imotong/dev-flow` provides one Host-neutral lifecycle and Control Center entry:

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

The closed operations are `status`, `doctor`, `install`, `upgrade`, `repair`, `reinstall`, `uninstall`, and
`factory-reset`. Host is `codex|deepseek|all`; the default DeepSeek Profile is `web`. Ordinary uninstall, upgrade,
repair, and reinstall preserve configuration and Task data. Factory reset requires the token bound to the current
plan; `--yes` alone has no data-cleanup authority. Default cleanup moves data to the user's Trash on macOS and to the
recoverable `%LOCALAPPDATA%\create-dev-flow\trash` quarantine on Windows; the Windows target is not the system
Recycle Bin. Permanent removal requires another confirmation.
The Codex global package is observed independently from its receipt and Plugin registration. Even when registration
is already absent, `uninstall` and `factory-reset` still remove an installed global package.
The interactive interface reads the current locale: `zh*` uses Simplified Chinese and every other locale uses
English. JSON output remains language-neutral.
During install, upgrade, repair, and reinstall, text modes show each Host action and completed package, registration,
artifact, and readiness step; `--json` omits these progress lines.

| Entry | Purpose |
| --- | --- |
| `npm install -g @imotong/dev-flow@latest` | Install the public `dev-flow` command globally. |
| `dev-flow` | Open the interactive lifecycle menu. |
| `dev-flow status\|doctor --host codex\|deepseek\|all` | Inspect or diagnose without mutation. |
| `dev-flow install\|upgrade\|repair\|reinstall --host ... [--profile web] [--version latest] --yes` | Perform ordinary maintenance while preserving configuration and Task data. |
| `dev-flow install\|repair --host deepseek\|all --adopt ...` | Adopt an existing identity-verified DeepSeek Profile contribution; other operations and Codex-only targets reject `--adopt`. |
| `dev-flow upgrade ... --confirm-downgrade <token>` | Explicitly confirm a downgrade with the token from the current plan when the target is older than the installed version. |
| `dev-flow uninstall --host ... [--all-known-profiles] --yes` | Remove selected Adapters while preserving configuration and Task data; Codex first stops the matching WebUI safely and retains registration and package state if that stop fails. |
| `dev-flow factory-reset --host all --all-known-profiles` | Produce a current-state-bound reset plan/token; `--yes` has no cleanup authority. |
| `dev-flow factory-reset ... --confirm-reset <token> [--reinstall]` | Move confirmed data to Trash and optionally perform a clean reinstall. |
| `dev-flow factory-reset ... --confirm-explicit-data <absolute-path>` | Confirm one explicit `DEV_FLOW_DATA_DIR` listed by the plan; repeat the option for multiple directories. |
| `dev-flow factory-reset ... --permanent --confirm-reset <token> --confirm-permanent <token>` | Permanently remove the plan's exact targets; both the reset token and a separate permanent-removal token are required. |
| `dev-flow webui start\|open\|status\|stop` | Select and verify Core from either installed Adapter, then manage the shared local Control Center; `start` may create a missing default data directory with mode `0700` on macOS or inherited user-profile/LocalAppData ACLs on Windows. The other commands create nothing. |
| `--json` / `--plain` | Select one JSON object or ANSI-free plain output. |

When `DEV_FLOW_DATA_DIR` is set, the public launcher accepts only an existing canonical, non-symbolic-link absolute
directory. No command creates an explicit directory.

Default local paths are platform-specific:

| Path | macOS arm64 | Windows 10/11 x64 |
| --- | --- | --- |
| Task data | `$HOME/Library/Application Support/dev-flow/data` | `%LOCALAPPDATA%\dev-flow\data` |
| User configuration | `$HOME/.dev-flow/config.json` | `%USERPROFILE%\.dev-flow\config.json` |
| Lifecycle manager state | `$HOME/Library/Application Support/create-dev-flow` | `%LOCALAPPDATA%\create-dev-flow` |

Set an explicit data directory in PowerShell with:

```powershell
$env:DEV_FLOW_DATA_DIR = 'C:\absolute\existing\dev-flow-data'
dev-flow status --host all
```

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
configuration is absent, setup first creates `$HOME/.dev-flow/config.json` on macOS or
`%USERPROFILE%\.dev-flow\config.json` on Windows; success then reports
actual configuration/receipt file changes and one next step. `--version`
reports both the host package and bundled Core identities.

### Supported Codex commands

| Command | Purpose |
| --- | --- |
| `npm install -g dev-flow-codex@latest` | Install the package selected by the npm `latest` dist-tag and place `dev-flow-codex` globally on `PATH`. It does not register the Codex Plugin automatically. |
| `dev-flow-codex setup` | Create or validate fixed user configuration, validate the installation and Codex compatibility, register the marketplace, Plugin, MCP, and packaged hook, then direct the developer to review and trust the current hook through Codex `/hooks`. Repeated execution verifies the existing registration. |
| `dev-flow-codex setup --json` | Perform the same operation as `setup`, but emit one machine-readable JSON line retaining operation, status, changed, and receipt_path while adding configuration_path, file_changes, and next_step. |
| `dev-flow-codex status` | Read and display the current package/Core and registration state. |
| `dev-flow-codex status --json` | Read package, Core, receipt, marketplace, and Plugin state without creating configuration, registration, or data. |
| `dev-flow-codex --version` | Print `dev-flow-codex <package-version> (core <core-version>)` to identify the actual installed package and bundled Core. |
| `dev-flow-codex remove` | Validate the runtime receipt and stop the matching WebUI before removing the package-owned Codex Plugin, marketplace registration, and receipt. A stop failure leaves registration intact; Task data and the target Git repository are retained. |
| `dev-flow-codex remove --json` | Perform the same operation as `remove` and emit machine-readable JSON. Its `next_step` points to the separate global npm uninstall. |
| `npm uninstall -g dev-flow-codex` | Uninstall the global npm package after `remove` completes. Running it alone does not deregister the Codex integration first. |
| `dev-flow-codex mcp` | **Managed host command.** The Plugin MCP configuration invokes it to establish the data directory and Codex admission instructions, then launch the packaged Core with `mcp --stdio`. Normal users should not start it manually. |
| `dev-flow-codex hook pre-tool-use` | **Managed host command.** The packaged Codex hook invokes it through the package-owned launcher on `PATH`; it reads one hook event, extracts `apply_patch` targets, and performs the prewrite check. Normal users should not start it manually. |
| `dev-flow-codex host-check pre-file-write` | **Managed host command.** The `hook pre-tool-use` implementation invokes it so the launcher resolves the package-local Core and forwards stdin/stdout with the exact `host-check pre-file-write` arguments. Normal users should not start it manually. |
| `dev-flow-codex host-launch <operation>` | **Managed Host command.** Reads one closed JSON object from stdin and writes one JSON object. `operation` is exactly `inspect|prepare|status|dispatch-start|dispatch-result|bootstrap|cli-provision|handoff-start|handoff-result|handoff-status|cleanup-decision|cleanup-worktree|cleanup-branch`; it performs or records current-user-confirmed assessment, provisioning, relaunch, handoff, and cleanup steps and is not a generic Git CLI. |

`dev-flow-codex` accepts no other subcommands and has no implicit `help`, `update`, or `uninstall`
subcommand. Native Host recovery can update to `latest` by reinstalling globally and rerunning `setup`:

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex --version
```

To uninstall while retaining Task data, run `dev-flow-codex remove` and then
`npm uninstall -g dev-flow-codex`. Delete the shared default data directory at
`$HOME/Library/Application Support/dev-flow` on macOS or `%LOCALAPPDATA%\dev-flow` on Windows only
after both the Codex and DeepSeek Adapters are removed and no Task is needed.

### Codex smart activation and explicit selector

```text
$dev-flow-codex:dev-flow <task description>
```

This is not a shell command. It is the exact Skill selector in a Codex user message. The Host may also
select the Skill implicitly for bounded development; bare `$dev-flow` and a wrong namespace are not
explicit selectors. Under either activation, a new request first receives read-only assessment with
change level, candidate impact, unknowns, and recommendation, then stops for a developer choice. Before
confirmation there is no Core call, Task/receipt/child, or Git write; request, root, HEAD, or status
changes invalidate the assessment.

After Dev Flow is selected, the developer confirms remote/base/target for every repository. Codex
performs exact fetch, freezes the commit, and creates or launches a dedicated worktree without source
staged, unstaged, or untracked content. Each selected parallel item gets one branch, worktree, Host
task, and Core Task; a shared-directory sub-agent cannot substitute. The old post-`ACTIVE_TASK_CONFLICT`
move is removed. Explicit resume alone skips assessment and returns to the original worktree instance.

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

Windows PowerShell uses the same DSH profile lifecycle, with the `npm pack` result resolved to an
absolute path:

```powershell
npm install -g @deepseek-ai/dsh@latest
dsh --version
$ProfileName = 'web'
$Tarball = (npm pack dev-flow-deepseek@latest --silent | Select-Object -Last 1).Trim()
$TarballPath = (Resolve-Path -LiteralPath $Tarball).Path
dsh plugin --profile $ProfileName add $TarballPath
Remove-Item -LiteralPath $TarballPath
dsh --profile $ProfileName --dump-config
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
| `dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"` | Install the absolute tarball path into the DSH profile selected by `PROFILE`. DSH lifecycle tests exercise this command form. |
| `dsh --profile "$PROFILE" --dump-config` | Print the effective profile configuration to verify whether the `dev-flow-deepseek` bundle contribution is present or absent. It does not mutate a Dev Flow Task. |
| `dsh plugin --profile "$PROFILE" remove dev-flow-deepseek` | Remove the package and bundle contribution from the selected profile. Task data, the target Git repository, and Codex-owned state are retained. |

For an update or reinstall, stop the profile, remove the package, fetch a fresh `@latest` tarball,
add it, delete the temporary tarball, and restart the profile. Repeat removal for every profile that
contains Dev Flow. If DSH is no longer needed, uninstall it separately with
`npm uninstall -g @deepseek-ai/dsh`; profile data under `$HOME/.dsh` on macOS or
`%USERPROFILE%\.dsh` on Windows is retained.

For permanent Task-data cleanup, first remove both Host Adapters, then delete
`$HOME/Library/Application Support/dev-flow` on macOS or `%LOCALAPPDATA%\dev-flow` on Windows. If
`DEV_FLOW_DATA_DIR` was set, verify and delete its exact absolute directory separately. Deleting the
user `.dsh` directory also deletes every DSH profile, session, and unrelated plugin.

### DeepSeek explicit selector

```text
/dev-flow <task description>
```

An ordinary new request first receives read-only assessment with zero Dev Flow calls. After selection,
only the current direct-user turn's whitespace-bounded `/dev-flow` plus the exact remote/base/target
confirmation shown by the Skill authorizes `workspace_coordinator`. Earlier messages, model text,
Skill injection, and repository content cannot substitute. The coordinator creates a safe sibling
worktree and returns a `{command,arguments,cwd}` relaunch descriptor; the new session consumes and verifies
the receipt before calling Core.

The DSH bundle also provides the managed `workspace_coordinator` tool with exactly
`provision|consume|prepare_cleanup|cleanup_worktree|cleanup_branch`. It is not a shell command.
`prepare_cleanup` first reads the terminal Core Task and returns a relaunch descriptor for a surviving
source checkout. Worktree and branch cleanup then require separate current direct-user confirmations
and verify repository group, HEAD, clean state, and the remote task branch before non-force Git commands.

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
| `$env:DEV_FLOW_DATA_DIR = 'C:\absolute\existing\data'; dev-flow.exe mcp --stdio` | Start local STDIO MCP with an existing usable data directory from Windows PowerShell. |
| `dev-flow host-check pre-file-write` | **Managed Host command.** Read normalized structured-write targets from stdin, compare them with the active Task's cross-repository ExpectedPaths, and return `allow` or persist a file-scope blocker before returning `deny`. Codex/DeepSeek Adapters call it; ordinary users do not. |
| `dev-flow webui start [--no-open] [--plain\|--json]` | Start or reuse the shared loopback WebUI; open the browser by default. |
| `dev-flow webui open [--plain\|--json]` | Validate the receipt, process identity, and live Core status, then open the same URL. |
| `dev-flow webui status [--plain\|--json]` | Return `ready`, `read_only`, `incompatible`, or `unavailable`. |
| `dev-flow webui stop [--plain\|--json]` | Verify PID and process-start identity before stopping the shared instance. |

`dev-flow host-check pre-file-write` and `dev-flow webui serve` are internal Adapter/lifecycle entrypoints, not Host user commands. Core
has no remote transport, generic HTTP/SSE transport, generic shell, or Git-mutation commands. Codex users start it
through the managed `dev-flow-codex mcp` entrypoint; DeepSeek users start it through the DSH
integration process.

## MCP tools

These seventeen tools are the complete closed public MCP catalog. Host adapters call them; they are not
terminal shell commands.

| Tool | Type | Purpose |
| --- | --- | --- |
| `dev_flow_server_info` | Read-only | Read Core product version, transport, health, supported process, hosts, method profiles, tool catalog, and effective host code-index preferences. It must be the first call after valid host admission. |
| `dev_flow_open_task` | Read or create | Create only after every `workspace_origin` passes dedicated-worktree verification; with null `new_task`, resume the same Task from its original instance after a workspace check. |
| `dev_flow_get_task` | Read-only | Read a persisted Task, including its verification plan, current budget/usage, adjustment reasons, and at most three recent test attempts; automatically returns a Recovery assessment when Core retains an Action submission. |
| `dev_flow_get_next_action` | Observe/maybe mutate | Observe the workspace first; idempotently create a workspace blocker when needed, otherwise return the Action, `submission_tool`, and legal transitions. |
| `dev_flow_submit_requirements` | Mutation | Submit the REQUIREMENTS node result. |
| `dev_flow_submit_design` | Mutation | Submit the DESIGN node result. |
| `dev_flow_submit_tasks` | Mutation | Submit the TASKS node result; its baseline includes the analyzed `verification_plan`. |
| `dev_flow_submit_implementation` | Mutation | Submit the IMPLEMENT node result. |
| `dev_flow_submit_test` | Mutation | Submit the TEST node result. `verification_budget_increased` records a concrete increase and stays in TEST; normal results send `budget_adjustment=null`; a third exact repetition pauses. |
| `dev_flow_submit_comprehension` | Mutation | Submit the COMPREHENSION_REVIEW node result. |
| `dev_flow_submit_refactor` | Mutation | Submit the REFACTOR node result. |
| `dev_flow_submit_delivery` | Mutation | Submit Host-owned DELIVERY judgment, risks, and findings. Core fills acceptance, evidence IDs, and Test/Comprehension record IDs; submitting those members is rejected as `unknown_member`. |
| `dev_flow_resolve_blocker` | Mutation | Resolve after Core verifies the condition. File scope uses `choice` and `reason`; history uses `history_resolution:{choice:"accept_current_history",reason}`; relocation uses `relocation_id` plus every `relocation_destinations[{key,repository_path}]`; verification/Recovery blockers use current identities. |
| `dev_flow_recover_action` | Mutation | Recover an uncertain Action from the normalized submission retained in an independent Action operation record; accepts no original payload. |
| `dev_flow_cancel_task` | Destructive mutation | Move a nonterminal Task to `CANCELLED` using the current revision and a non-empty reason. |
| `dev_flow_prepare_task_relocation` | Mutation | Retain relocation ID, source workspace/content/surface and resume node while source claims remain active during Host handoff. |
| `dev_flow_abandon_task` | Destructive mutation | When the original worktree is unavailable, use exact host/task/revision and a non-empty reason to enter `CANCELLED` and release claims without Git access. |

Each ordinary node submission tool accepts only `host`, `task_id`, `action_id`, `transition_id`,
`summary`, `reason`, `artifacts`, `method_results`, and that node's semantic `node_result`, which has no
`changed_paths` or `no_file_changes`. Core derives Action delta/current surface from Git and fills the
revision, Action kind, process identity, source cursor, repository binding, artifact roles, method
step identity/order/status, and internal payload envelope. `get_next_action.submission_tool` names the
only submission tool for the current Action.

`node_result.baseline.requirements_revision` on `dev_flow_submit_design`,
`node_result.baseline.design_revision` on `dev_flow_submit_tasks`, and
`node_result.task_plan_revision` on `dev_flow_submit_implementation` are absent from the Host
submission contract. After validating the current Action identity, Core fills them from the same
Task snapshot; supplying one returns `unknown_member` at the exact path. Other
missing required members return exact `required_member_missing` paths. The Host may correct through the
same submission tool once only when Core proves zero writes and the value comes from facts already
established by the current node work, and may change only the exact members listed in
`recovery.allowed_paths`.

A new Task's `new_task` has no `verification_budget`. TASKS
`baseline.verification_plan` contains `checks[{name,rationale}]`, `initial_budget`,
`full_suite_expected`, and `test_code_changes_expected`. If TEST capacity becomes insufficient, the
Host may choose the returned `verification_budget_increased` transition with a `budget_adjustment`
containing `basis`, `additional_checks`, `additional_automatic_commands`, `allow_full_suite`, and
`allow_manual_handoff`; the transition `reason` states the concrete new impact, risk, failure, or
verification gap. A no-op, missing-check, or reasonless increase is rejected.

Every TEST check also sends `full_suite_reason`. It is empty when `full_suite=false`; a full suite
records the concrete risk this run covers. Core retains the result, while the Host still decides
necessity before executing the command.

Unknown CLI arguments, tools outside this catalog, and calls that do not satisfy shared implicit/explicit admission
are not supported entrypoints.

### Repository Scope and host-preference fields

When creating a multi-repository Task, `repository_path` identifies the primary repository. The call
may add one primary key and up to seven explicit additional repositories:

```json
{
  "host": "codex",
  "repository_path": "/workspace/core",
  "workspace_origin": {
    "mode": "dedicated_worktree",
    "remote_name": "origin",
    "base_branch": "main",
    "base_commit": "<fetched-commit>",
    "task_branch": "feature/core-docs",
    "provisioning_receipt_id": "launch-core-docs"
  },
  "primary_repository_key": "core",
  "additional_repositories": [
    {
      "key": "docs",
      "repository_path": "/workspace/docs",
      "workspace_origin": {
        "mode": "dedicated_worktree",
        "remote_name": "origin",
        "base_branch": "main",
        "base_commit": "<fetched-commit>",
        "task_branch": "feature/docs",
        "provisioning_receipt_id": "launch-core-docs"
      }
    }
  ],
  "new_task": {
    "request": "Synchronize interface documentation across the Core and docs repositories",
    "initial_scope": [],
    "initial_out_of_scope": [],
    "known_acceptance_criteria": [],
    "method_profile": "plain"
  }
}
```

This example shows the closed MCP input shape; it is not a shell command. Replace `<fetched-commit>`
with the actual object ID. Creation requires a receipt-backed `workspace_origin` for every repository
and non-null `new_task`; Core verifies Git and fills source group, canonical root, and worktree Git-dir.
Resume omits or sets `new_task=null`, points `repository_path` at the original participating worktree,
and omits all Scope/origin creation fields. A Scope contains one to eight repositories, additions are
sorted, and membership is immutable. Multi-repository payload paths use
`<repository-key>::<repository-relative-path>`.

The Task result retains the primary `repository` and adds `primary_repository_key` plus sorted
`additional_repositories`. The current Action's single `repository_binding_digest` remains the
primary binding digest for a single-repository Task and becomes the complete Scope aggregate for a
multi-repository Task. Every active Task's `repository_claims` are acquired, retained, or released
in the same SQLite transaction as the snapshot and event.

The identity in `repository_claims` is a directly observable worktree-instance identity, not the Git
common directory. Linked worktrees share a logical repository group but have different canonical
roots/worktree Git directories, so each may hold a Task; one instance holds one active Task. Control Center Task
summaries expose read-only `repository_group_id` and `worktree_path` fields, and every repository in
Task detail exposes its own `repository_group_id`.

The Task result's `verification` projection contains `plan`, `current_budget`, usage for the current
Task Plan revision, and `adjustments`. Before TASKS completes, `plan` and `current_budget` are `null`.

The `dev_flow_server_info({})` result includes:

```json
{
  "host_preferences": {
    "codex": { "codebase_memory": false },
    "deepseek": { "codebase_memory": false }
  }
}
```

These values come from the process-start snapshot of the read-only user configuration:
`$HOME/.dev-flow/config.json` on macOS or `%USERPROFILE%\.dev-flow\config.json` on Windows. They
express preference, not installed or available index capability. Both are false when the file is
absent, and Dev Flow does not create or modify it.
