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

## Desktop pet (macOS arm64)

The macOS arm64 environment provides `dev-flow pet start` and `dev-flow pet stop`;
the interactive menu uses the same entry. Installing any adapter (Codex or DeepSeek) or running lifecycle management automatically provisions the prebuilt desktop pet binary to `$HOME/.dev-flow/pet/DevFlowPet.app`, requiring no Xcode or Swift compiler on the user machine.
At least one Codex or DeepSeek Adapter must be installed
and configured. The pet reads that Core's WebUI interface and shows one selected task's saved stage,
blocker, update time, and synchronization time. Clicking opens its detail page. The chooser loads
pages on demand and keeps watching terminal tasks; cancellation never celebrates. Its menu controls
animation, visibility, and quitting; system language selects Chinese or English.

Starting may start an unavailable WebUI; background connection checks are read-only. Hiding or
sleeping cancels requests, and showing or waking reads again. Old responses cannot replace a new
selection. Disabling animation or enabling system Reduce Motion uses static frames. Stopping ends
only the pet and preserves WebUI, Tasks, and preferences. Maintenance first stops a pet using the
Adapter being changed and aborts on stop failure. The confirmed factory-reset plan includes
`productRoot/pet` under the existing data-directory confirmation and cleanup rules. Other platforms
reject pet commands.

Only the shown arguments are accepted, with plain-text output and exit codes `0` for success, `1`
for runtime failure, and `2` for invalid arguments. `pet status` and `pet start --json` are not public
entries.

```bash
dev-flow pet start
dev-flow pet stop
```

Stop it before updating or removing the unified-entry package. The support matrix defines public support.

Choose appearance → Import appearance in the pet menu imports a local folder containing a single PNG,
a Dev Flow animation pack, or a Codex sprite-format 1/2 pack. Appearance and task selections are
independent, and upgrades preserve imported artwork. Reimporting the same ID updates the appearance;
failed validation preserves the installed pack. Codex artwork is converted to common PNG frames,
while Dev Flow retains stage and navigation ownership. See [appearance packs](https://github.com/Innocent-children/dev-flow/blob/main/docs/DESKTOP-PETS_en.md).
