<p align="center">
  <img src="https://raw.githubusercontent.com/Innocent-children/taskbelay/main/packages/webui/src/assets/taskbelay-app-icon-light.svg" width="112" height="112" alt="TaskBelay" />
</p>

# taskbelay

This package installs and maintains TaskBelay integrations and provides the local WebUI and desktop pet commands. Development tasks are started from the chosen Host conversation.

## Installation channels

The public package installs the integrations available in its release:

```sh
npm install -g taskbelay@latest
taskbelay
```

Check the [support matrix](https://github.com/Innocent-children/taskbelay/blob/main/docs/SUPPORT-MATRIX_en.md) for verified Host and platform coverage. Follow the [Claude](https://github.com/Innocent-children/taskbelay/blob/main/docs/CLAUDE_en.md) or [ZCode](https://github.com/Innocent-children/taskbelay/blob/main/docs/ZCODE_en.md) guide for their setup and required UI steps.

The manager targets macOS arm64 and Windows 10/11 desktop x64. Other OS/CPU combinations are rejected by its runtime selection. Source setup and build requirements are documented separately from public installation.

## Inspect and maintain an installation

Run `taskbelay` for the interactive menu, or select the Host explicitly:

```sh
taskbelay status --host all
taskbelay doctor --host codex
taskbelay repair --host codex --yes
```

The current source accepts `codex`, `deepseek`, `claude`, `zcode` and `all`. DeepSeek uses a Profile, defaulting to `web`; Profile options do not apply to Claude, Codex or ZCode.

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
taskbelay repair --help
taskbelay status --host all --json
```

The menu supports back, exit and retrying invalid input. `--json` never prompts; when confirmation is required, its result provides the command to run. Progress output identifies the operation and completed steps. To update this manager itself, install its package again through the same distribution channel.

## Activation and failures

After installation, review/trust the TaskBelay hook in Codex, restart the selected DeepSeek Profile, or reload Claude plugins/start a new Claude session. For ZCode, follow the returned Settings → Plugins installation/enablement steps and start a new session. Local preparation reports `action_required`; it cannot verify that ZCode loaded the plugin. Follow the actual prompts for the installed Host.

An absent optional Host is informational in an all-Host diagnostic when another integration is healthy. Installation problems retain available package and registration information for repair. Codex and Claude removal can handle their owned registration after the Adapter package has disappeared; unknown ownership is not permission to remove another installation. Existing unmanaged DeepSeek contributions require explicit `--adopt`.

ZCode removal takes two steps: ordinary uninstall retains the Adapter while you remove its plugin and marketplace in ZCode and close affected sessions. Run `taskbelay-zcode remove --confirm-host-removed` to record that completed action, then repeat manager uninstall to remove the package. Shared-data reset is blocked while the ZCode package or record remains, because cached Host processes cannot be verified automatically.

Doctor checks existing user configuration through an installed Core. If no usable Core is available, it reports that configuration validation could not be completed. A missing configuration file uses Core defaults.

If maintenance fails, keep its output. The result identifies completed work and the next recovery command. Do not remove files manually to make the status appear clean.

## Task data and reset

Ordinary maintenance and removal retain task data and unrelated Host settings. Default task data is stored in `~/.taskbelay/data` on macOS or `%LOCALAPPDATA%\taskbelay\data` on Windows. An explicit `TASKBELAY_DATA_DIR` must name an existing canonical directory and remain consistent across the Host and management commands.

Reset displays the exact affected directories and requires its plan-specific token. Recoverable reset uses macOS Trash or the product recovery directory `%LOCALAPPDATA%\taskbelay\trash` on Windows. The latter is not the Windows Recycle Bin. Permanent deletion and clearing an explicitly selected data directory require their own confirmations. When reset initializes user configuration, it writes `{}` so Core supplies the defaults for each Host.

Reset stops the managed Adapters' local WebUI and identifiable STDIO Core processes before removing
them, then checks again before cleaning data. If a process cannot be stopped or a Host reconnects,
cleanup stops; close that Host session and follow the reported retry instructions. Selecting the same
directory as both default and explicit data cleans it once while retaining explicit confirmation.

## WebUI and desktop pet

With a configured Adapter that supplies Core:

```sh
taskbelay webui start
taskbelay webui open
taskbelay webui status
taskbelay webui stop
```

WebUI shows existing tasks, results, blockers and supported recovery operations. Start a new development task in the Host conversation.

The desktop pet additionally requires the desktop application supplied by an appropriate complete package. Installing an Adapter alone does not provide it.

```sh
taskbelay pet start
taskbelay pet stop
```

These are the only pet command forms; `pet status` and `pet start --json` are not supported. Stopping the pet leaves tasks and WebUI intact. Maintenance refreshes a bundled desktop application while retaining settings and imported appearances.

See the [desktop guide](https://github.com/Innocent-children/taskbelay/blob/main/docs/DESKTOP-PETS_en.md) for installation and controls, and the support matrix for verified platforms and signing status.

## Automation results

Lifecycle exit codes are `0` for success/no changes, `1` for check or execution failure, `2` for invalid arguments, `3` for required/declined confirmation, `4` for unmet authorization and `5` for partial execution or failed final verification. Invalid WebUI arguments return `2`; pet commands use `0`, `1` and `2` for success, runtime failure and invalid arguments.

Exact options, structured results and recovery inputs are in the [command reference](https://github.com/Innocent-children/taskbelay/blob/main/docs/COMMANDS_en.md).
