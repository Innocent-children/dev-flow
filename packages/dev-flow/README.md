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

The rich first-install result shows the Dev Flow mark, verified Host states, conversation selectors, WebUI commands,
and lifecycle commands. `zh*` locales use Simplified Chinese; every other locale uses English. Plain and JSON modes
remain automation-safe.
While install, upgrade, repair, or reinstall is running, rich and plain text output shows each Host action and each
completed package, registration, artifact, and readiness step. JSON mode remains a single result object with no
progress lines.
Codex uninstall first runs the installed Adapter's idempotent `remove`, which validates the runtime receipt and stops the matching WebUI before deregistration. If that stop fails, the global package is retained for a safe retry.

Recoverable factory reset uses the user's macOS Trash or `%LOCALAPPDATA%\create-dev-flow\trash` on
Windows. The Windows quarantine is not the system Recycle Bin; permanent removal still requires its
separate confirmation token.

## Desktop pet (macOS arm64 and Windows x64)

Running the pet requires macOS arm64 or Windows 10/11 x64, a local development package containing the corresponding desktop app, and at least one installed and configured Codex or DeepSeek Adapter.
Regular npm file lists omit `DevFlowPet.app`; see the [desktop pet guide](https://github.com/Innocent-children/dev-flow/blob/main/docs/DESKTOP-PETS_en.md#local-build-and-installation) for building, installation, and updating an existing app.

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

The local pet package retains the default appearance. Import Whale Girl or other custom appearances as separate artwork packs through Import appearance. Artwork is stored in the user directory and preserved across application updates.

## Windows platform adaptation

Windows 10/11 x64 targets ordinary desktop PCs with Intel or AMD 64-bit processors. The three Node packages implement paths, permissions, commands and cleanup separately in `lib/platform/windows/` and `lib/platform/macos/`; selection entry points only dispatch to the current platform. Core keeps shared platform-neutral task semantics, while Windows Git processes hide console windows. Codex `--version` and `status` use the selected executable-file policy, and Windows PowerShell launchers output UTF-8. This change was tested only on native Windows; Windows 10, AMD hardware and macOS were not tested, and stable support claims remain unchanged. See the [Windows adaptation report](../../docs/WINDOWS-ADAPTATION_en.md).

The Windows 10/11 x64 desktop pet aligns with macOS task selection and status bubbles, WebUI navigation, tray/context menus, static and native animated PNG/SVG appearances, Codex PNG/WebP atlas imports, nine actions, dragging, six scale settings, hide/restore and independent start/stop. Windows uses a separate Electron implementation while macOS retains Swift/AppKit; both only read Core state. The Windows local package is built by `scripts/build-desktop-pet-windows.mjs`, with user data in `%LOCALAPPDATA%\dev-flow\pet`. See the [desktop pet guide](../../docs/DESKTOP-PETS_en.md) for building, installation, updates and verification.

On Windows, existing AppData directories are resolved to their actual paths, including directory aliases exposed by packaged desktop hosts; symbolic links remain rejected.

The current Windows development distribution includes both Adapter packages and the desktop app. After installing the launcher package, use `dev-flow install --host all --yes` and `dev-flow pet start`. Repair and reinstall use the same entry, verify bundled artifact hashes, refresh the desktop app, and preserve Task data, settings and appearances.
