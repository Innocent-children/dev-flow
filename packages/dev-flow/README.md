<p align="center">
  <img src="https://raw.githubusercontent.com/Innocent-children/dev-flow/main/packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow" />
</p>

# @imotong/dev-flow

This package installs and maintains Dev Flow integrations and provides the local WebUI and desktop pet commands. Development tasks are started from the chosen Host conversation.

## Installation channels

The public package installs the integrations available in its release:

```sh
npm install -g @imotong/dev-flow@latest
dev-flow
```

Check the [support matrix](https://github.com/Innocent-children/dev-flow/blob/main/docs/SUPPORT-MATRIX_en.md) for released Host and platform coverage. The current source also includes Claude Code. Follow its [source installation guide](https://github.com/Innocent-children/dev-flow/blob/main/docs/CLAUDE_en.md) or use a complete local development distribution that includes the current manager. An older public CLI does not acquire new Host options simply because a newer Adapter is installed.

The manager targets macOS arm64 and Windows 10/11 desktop x64. Other OS/CPU combinations are rejected by its runtime selection. Source setup and build requirements are documented separately from public installation.

## Inspect and maintain an installation

Run `dev-flow` for the interactive menu, or select the Host explicitly:

```sh
dev-flow status --host all
dev-flow doctor --host codex
dev-flow repair --host codex --yes
```

The current source accepts `codex`, `deepseek`, `claude` and `all`. DeepSeek uses a Profile, defaulting to `web`; Profile options do not apply to Claude or Codex.

| Operation | Result |
| --- | --- |
| `status` | Show installed versions, Host availability and installation issues. |
| `doctor` | Check installation and configuration; return a failure code when checks fail. |
| `install` | Keep installed versions by default and install missing integrations. |
| `upgrade` | Select the latest available version. |
| `repair` | Restore the current installation, retaining its version by default. |
| `reinstall` | Replace the current installation even if its checks pass. |
| `uninstall` | Remove the selected integrations while preserving task data and configuration. |
| `factory-reset` | Remove integrations and clear only the data directories explicitly confirmed in the displayed plan. |

Use `--version` for an explicit available version. A downgrade requires the separate confirmation token shown by the manager; `--yes` alone is insufficient. Complete local development distributions use their bundled, digest-verified packages rather than fetching those versions from npm.

```sh
dev-flow repair --help
dev-flow status --host all --json
```

The menu supports back, exit and retrying invalid input. `--json` never prompts; when confirmation is required, its result provides the command to run. Progress output identifies the operation and completed steps. To update this manager itself, install its package again through the same distribution channel.

## Activation and failures

After installation, review/trust the Dev Flow hook in Codex, restart the selected DeepSeek Profile, or reload Claude plugins/start a new Claude session. Follow the actual prompts for the installed Host.

An absent optional Host is informational in an all-Host diagnostic when another integration is healthy. Installation problems retain available package and registration information for repair. Codex and Claude removal can handle their owned registration after the Adapter package has disappeared; unknown ownership is not permission to remove another installation. Existing unmanaged DeepSeek contributions require explicit `--adopt`.

If maintenance fails, keep its output. The result identifies completed work and the next recovery command. Do not remove files manually to make the status appear clean.

## Task data and reset

Ordinary maintenance and removal retain task data and unrelated Host settings. Default task data is stored in `~/.dev-flow/data` on macOS or `%LOCALAPPDATA%\dev-flow\data` on Windows. An explicit `DEV_FLOW_DATA_DIR` must name an existing canonical directory and remain consistent across the Host and management commands.

Reset displays the exact affected directories and requires its plan-specific token. Recoverable reset uses macOS Trash or the product recovery directory `%LOCALAPPDATA%\dev-flow\trash` on Windows. The latter is not the Windows Recycle Bin. Permanent deletion and clearing an explicitly selected data directory require their own confirmations.

## WebUI and desktop pet

With a configured Adapter that supplies Core:

```sh
dev-flow webui start
dev-flow webui open
dev-flow webui status
dev-flow webui stop
```

WebUI shows existing tasks, results, blockers and supported recovery operations. Start a new development task in the Host conversation.

The desktop pet additionally requires the desktop application supplied by an appropriate complete package. Installing an Adapter alone does not provide it.

```sh
dev-flow pet start
dev-flow pet stop
```

These are the only pet command forms; `pet status` and `pet start --json` are not supported. Stopping the pet leaves tasks and WebUI intact. Maintenance refreshes a bundled desktop application while retaining settings and imported appearances.

See the [desktop guide](https://github.com/Innocent-children/dev-flow/blob/main/docs/DESKTOP-PETS_en.md) for installation and controls, and the support matrix for verified platforms and signing status.

## Automation results

Lifecycle exit codes are `0` for success/no changes, `1` for check or execution failure, `2` for invalid arguments, `3` for required/declined confirmation, `4` for unmet authorization and `5` for partial execution or failed final verification. Invalid WebUI arguments return `2`; pet commands use `0`, `1` and `2` for success, runtime failure and invalid arguments.

Exact options, structured results and recovery inputs are in the [command reference](https://github.com/Innocent-children/dev-flow/blob/main/docs/COMMANDS_en.md).
