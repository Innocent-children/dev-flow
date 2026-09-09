<p align="center">
  <img src="https://raw.githubusercontent.com/Innocent-children/dev-flow/main/packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow" />
</p>

# @imotong/dev-flow

`@imotong/dev-flow` is the Host-neutral lifecycle and Control Center CLI for Dev Flow.

New development Tasks are not created by this lifecycle CLI or by Control Center. Codex and DeepSeek
first assess a request read-only, obtain the developer's remote/base/target confirmation, provision a
dedicated worktree, and only then open Core from the target Host. Control Center projects that
WorkspaceOrigin, current Task surface, blockers, relocation, and terminal cleanup choices without
performing Git or Host handoff itself.

The current source accepts exactly `darwin-arm64` and `win32-x64`; the Windows scope is consumer
Windows 10/11 desktop x64. Windows Server, 32-bit/ARM64 Windows, and Intel Mac are excluded. npm
`@latest` availability remains defined by the repository Support Matrix until a confirmed release.

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Lifecycle commands manage Codex and DeepSeek Adapters while preserving the shared Core boundary:

```bash
dev-flow status
dev-flow doctor
dev-flow install
dev-flow upgrade
dev-flow repair
dev-flow reinstall
dev-flow uninstall
dev-flow factory-reset
```

The public Control Center commands are independent of either Host:

```bash
dev-flow webui start
dev-flow webui open
dev-flow webui status
dev-flow webui stop
```

The launcher validates installed Adapter receipts and package identities, selects the newest available compatible
Core, and forwards only the closed WebUI command surface. It does not persist another Core or workflow state.
Platform-specific path, permission, process, signal, and executable behavior is selected outside Core semantics.
`dev-flow webui start` creates the product-owned default data directory with mode `0700` on macOS or inherited
user-profile/LocalAppData ACLs on Windows when it is absent. The defaults are
`$HOME/.dev-flow/data` and `%LOCALAPPDATA%\dev-flow\data`, respectively. Explicit
`DEV_FLOW_DATA_DIR` values must already name canonical non-link directories; all other WebUI commands remain zero-write.

The terminal menu shows installation state and supports back, exit, input retry and opening Control Center. A compact rich display uses color only in a suitable terminal; plain and JSON modes remain automation-safe. Plans show versions and resource paths before confirmation. Progress names the current Host action and package or registration step. JSON never prompts and returns a copyable confirmation command when required. `dev-flow repair --help` lists options and examples.

Codex uninstall first runs the installed Adapter's idempotent `remove`, which validates the runtime receipt and stops the matching WebUI before deregistration. If that stop fails, the global package is retained for a safe retry.

Recoverable factory reset uses the user's macOS Trash or `%LOCALAPPDATA%\create-dev-flow\trash` on
Windows. The Windows quarantine is not the system Recycle Bin; permanent removal still requires its
separate confirmation token.

## Lifecycle command behavior

The menu reads installation state before offering Adapter installation, maintenance, Control Center and pet entries. It supports input retry, back and exit, and returns to the menu after an operation. Without a terminal, bare `dev-flow` prints help. `dev-flow <lifecycle-command> --help` explains options and examples.

| Command | Target version and repeated execution |
| --- | --- |
| `install` | Keeps installed versions by default; missing installations use `latest`. A ready matching version needs no changes. |
| `upgrade` | Selects `latest` by default; a ready matching version needs no changes. |
| `repair` | Repairs the current version by default, restoring damaged files and same-version owned registration. Healthy state needs no changes. |
| `reinstall` | Reinstalls the current version by default on every invocation, preserving configuration and Task data. |
| `uninstall` | Already-removed Adapters need no further action; configuration and Task data are preserved. |
| `factory-reset` | Repeating completed cleanup is a no-op; actual cleanup targets still require confirmation of the current plan. |

Explicit `--version` selects a target. Every version-replacement command requires `--confirm-downgrade` for a downgrade; ordinary `--yes` is insufficient. Local development distributions always use their verified bundled versions and artifacts, replacing their contents during maintenance.

Before execution, the plan shows actions, current/target versions, resource paths and data handling. JSON never prompts: required confirmation returns `confirmation` and a copyable `next_step`. Explicit data-directory approval is checked before removing any Adapter. Cleanup directories bind canonical paths, filesystem identity and permissions, allowing managed shutdown to remove runtime records; individual file targets also bind size and modification time. Installation, upgrade, repair and reinstall maintain Adapters; update the public launcher itself with `npm install -g @imotong/dev-flow@latest`.

`status` retains absent targets and reports Host availability, Adapter/Core versions and issues. `doctor` adds installation and configuration checks and exits nonzero on failure. With all Hosts selected, an absent optional Adapter is informational when another Adapter is healthy. Codex self-check failures retain npm installation metadata for repair; DeepSeek checks Profile contribution, the managed receipt and the actual Core. An existing unmanaged DeepSeek contribution requires explicit `--adopt`.

Failures include `error.code/message/detail`, `operation_id`, `failed_action`, `completed_actions` and a recovery command. Text output preserves the same causes and completed steps. Repeating a command observes current installation state instead of replaying an old operation. Recovery commands pin the attempted version where applicable; reset generates a plan for the current state again. Successful installation retains hook review/trust and Profile restart instructions.

Lifecycle exit codes: `0` success or no changes, `1` check/execution failure, `2` invalid arguments, `3` confirmation required or declined, `4` unmet plan/cleanup authorization, `5` partial execution or failed final verification. Exiting the menu returns `0`. Invalid WebUI arguments return `2`; launcher failures under `--json` also return JSON.

## Desktop pet (macOS arm64 and Windows x64)

The npm package includes the macOS arm64 and Windows 10/11 x64 desktop applications and default artwork (nine actions, 312 SVG frames). A configured Codex or DeepSeek Adapter supplies Core. After updating this npm package, run `dev-flow repair` for the configured Host to refresh the installed app copy. `install`, `upgrade`, `repair` and `reinstall` update the app even when the Adapter needs no change, preserving settings and appearances. macOS uses ad-hoc signing; Developer ID, notarization and Windows distribution signing remain unverified. See the [desktop pet guide](https://github.com/Innocent-children/dev-flow/blob/main/docs/DESKTOP-PETS_en.md).

| Command | Behavior |
| --- | --- |
| `dev-flow pet start` | Start or restore the pet, verify Core and the data directory, and start WebUI if needed. An existing user-directory app takes priority over the bundled app. |
| `dev-flow pet stop` | Quit the pet normally, preserving WebUI, Tasks, settings, and appearances. |

Only these two argument forms are accepted. Output is plain text; exit codes are `0` for success, `1` for runtime failure, and `2` for invalid arguments.
`pet status` and `pet start --json` are not public entries.

```bash
dev-flow pet start
dev-flow pet stop
```

The menu provides task and appearance selection, import, Animations, Idle activities, hide, and quit. See the [desktop pet guide](https://github.com/Innocent-children/dev-flow/blob/main/docs/DESKTOP-PETS_en.md)
for task selection, the scope of nine-clip support, triggers, and troubleshooting. Stop the pet before updating or removing its current Core Adapter or
unified-entry package; maintenance aborts if shutdown fails. Confirmed factory-reset clears `productRoot/pet`; ordinary quit and uninstall preserve user artwork and settings.

## Build verification

Maintainers use `node release/dev-flow/prepare.mjs --output "/absolute/pet-release"` on macOS arm64 with the repository toolchain and Swift >=6.0. It builds and verifies the two-platform tarball without publishing; use an output directory outside the repository.
