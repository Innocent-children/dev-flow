# Desktop Pet Technical Design

[中文](design.md) | [English](design_en.md)

For the current functional delivery, build and assemble the macOS arm64 app and unified-entry
tarball locally with ad-hoc signing. Developer ID signing, notarization, public publication, and
minimum-OS verification remain distribution requirements, outside this user-requested functional
checkpoint. A local development package does not establish public distribution support.

This design implements the [desktop pet plan](plan_en.md). The unified entry point selects Core from
a usable Adapter and launches its bundled native app, which displays one task through existing HTTP
endpoints. The app and assets update with the unified package; Core retains Task and workflow rules.
New files, arguments, and test entries below are implementation targets, not delivered capabilities.

## Responsibilities and change locations

| Location | Responsibility and change |
| --- | --- |
| `packages/dev-flow/bin/dev-flow.mjs` | Dispatch `pet` to pet orchestration while preserving lifecycle/WebUI dispatch |
| `packages/dev-flow/lib/pet.mjs` (new) | Parse start/stop requests, reuse `resolveCoreRuntime`, coordinate WebUI and native startup |
| `packages/dev-flow/lib/cli.mjs`, `presentation.mjs`, `runtime.mjs` | Interactive menu, bilingual results and help; the launcher handles pet commands |
| `packages/dev-flow/lib/platform/macos/pet.mjs` (new) | Locate the bundled app, invoke native entries with argument arrays, handle startup acknowledgments and exit results |
| `packages/desktop-pet/macos/` (new) | Swift Package for AppKit windows, menus, HTTP, presentation, animation, native process management, preferences, and tests |
| `packages/dev-flow/lib/lifecycle.mjs`, `plan.mjs`, `ownership.mjs` | Stop the pet before selected-Adapter maintenance; include pet files in confirmed reset plans and targets |
| `scripts/build-desktop-pet.mjs` (new) | Compile, assemble, sign, notarize, and inspect the app in an explicit staging directory |
| `scripts/release-dev-flow.mjs`, `packages/dev-flow/package.json`, and package tests | Add the inspected app to unified-package staging, pack, and inspect the resulting artifact |
| Existing `internal/webui/`, `internal/application/`, `internal/store/` | Reuse task and runtime reads under current contracts |

Use a few direct Swift modules for windows, reads, presentation/animation, processes, and preferences.
Response models only decode data; presentation decides animation triggers; the native process module
owns macOS process and file operations. The Node macOS module invokes it without implementing another
process-identity algorithm. Platform selection belongs at the launcher boundary; Core gains no OS branches.

The unified entry point retains Windows x64 support. Windows menus omit pet entries and direct pet
commands return unsupported-platform errors, without loading the macOS app or changing other commands.

## Public commands

New public syntax is `dev-flow pet start` and `dev-flow pet stop`, with no task ID or other arguments.
General help lists both. Commands and interactive entries share orchestration. Output is short plain
text without ANSI: success to stdout, failure to stderr. Exit codes are success `0`,
installation/platform/connection/process failure `1`, and argument error `2`.

There is no pet `status`, `--json`, or separate status-query interface. Core's `webui ... --json`
remains an internally reused interface. Stop ends an existing pet; cleanup does not require finding
an Adapter again and does not start a service.

## Launch and native entry contract

1. Check the platform, then call existing `resolveCoreRuntime` with `initializeDefaultData` enabled.
   It validates Adapter candidates before preparing the default directory under existing rules.
   Explicit `DEV_FLOW_DATA_DIR` must exist. Without a usable Adapter, return installation guidance
   without opening a pet window or installing dependencies.
2. Invoke the selected executable's `webui status --json` with `DEV_FLOW_DATA_DIR` set. Reuse a
   running service. On `unavailable`, this explicit launch may call `webui start --no-open --json`.
   Stop on command failure or `incompatible`. Read-only local storage without a reachable service
   does not activate the pet.
3. Type-check returned `core_identity`, `data_root_digest`, `url`, and `pid`, then read
   `GET /api/system/status` to confirm identity and address. An actually readable `read_only`
   service may display read-only results.
4. Launch the bundled app using the following private argument array. All paths are absolute and
   already resolved by the launcher. Acknowledge successful window startup, let the launcher exit,
   and retain the desktop process.

| Private entry/argument | Meaning |
| --- | --- |
| `run` | Start windows or restore an existing instance with the same runtime and data directory |
| `--core-path` | Core executable supplied by the selected Adapter |
| `--data-dir` | Current data directory |
| `--product-root` | Current user's product directory for pet runtime records and preferences |
| `--core-identity` | Verified Core identity |
| `--data-root-digest` | Data-directory identity returned by Core |
| `stop --product-root <path>` | Internal native stop entry; creates no windows |
| Stop entry's `--core-path <path>` | During Adapter maintenance, stop only an instance using that Core |

Startup acknowledgment is one line, `ready` or `restored`, without Task data, connection snapshots,
or a queryable status interface. Initial failures go to stderr. Acknowledge only after the windows
and runtime record are ready. The launcher waits at most 10 seconds; timeout returns failure and
retries still pass singleton checks. Close startup communication after acknowledgment; use system
logging during normal operation.

The native app checks status using the same Core again to reject results that expired during launch.
Opening the bundled app directly without launch arguments displays guidance to use Dev Flow and exits.
This expresses a product dependency, not authentication between same-user processes.

## Singleton and exit

The native macOS module holds a process-lifetime lock on `productRoot/pet/instance.lock`, allowing
one instance per user. Once windows are ready, atomically write `runtime.json` with `pid`,
`process_start_identity`, `executable_path`, `core_path`, `core_identity`, and `data_root_digest`.
Obtain start identity from actual OS process-creation information.

When the lock is held, compare the record with the live process. Matching Core and data directory
use internal `SIGUSR1` to restore windows on the native main thread and return `restored`.
Different Core or data directory requires stop before start. The signal requests showing only; it
carries no Task or connection state. Remove stale records only after confirming no matching process
or held lock. PID or application name alone is insufficient identity.

Stop verifies the current user, process start identity, and executable, sends `SIGTERM`, and waits
up to 5 seconds. The main thread cancels requests, stops animation, saves preferences, closes windows
and menu bar entries, removes its own record, and releases the lock. Timeout preserves the record
and returns failure, preventing dependent removal/reset from continuing. Normal stop neither
automatically force-kills nor stops the WebUI. No instance means success.

## Core and HTTP reads

Current Core JSON comes from [writeRuntimeState](../../cmd/dev-flow/main.go), with top-level
`operation`, `readiness`, `core_identity`, `data_root_digest`, `url`, and `pid`.
Failed processes may produce no JSON on stdout; inspect exit code and output. Each Core invocation
has a 10-second timeout.

Use system `URLSession`, restrict requests to the confirmed `http://127.0.0.1:<port>` origin,
disable redirects, and use a 3-second HTTP timeout. Render task text as plain text and encode task
IDs as individual URL path segments.

| Endpoint and fields | Desktop use |
| --- | --- |
| `GET /api/system/status`: `readiness/core_identity/data_root_digest/url` | Confirm the current connection against selected Core output |
| `GET /api/tasks`: `items/page/has_next` | Picker, initial selection, and pagination |
| Detail `summary.task_id/request_summary/current_node/revision/updated_at` | Selection, stage, change recognition, and task update time |
| `summary.origin_host/repository_keys/worktree_path` | Source Host and repository context; no foreground-conversation inference |
| `summary.blocker` | Existing readable blocker text; use generic blocked text when absent |
| `summary.archived` and detail `readiness` | Archived and read-only presentation |

Use the current [TaskSummary and TaskDetailResponse](../../internal/webui/types.go).
[summarizeDetail](../../internal/webui/read_handlers.go) already supplies blocker text. Displaying a
reason does not require parsing the entire `blocker.value` JSON or duplicating blocker classifications.
Unused response fields need no desktop model.

### Polling and response ownership

- While visible, wait 5 seconds after each request completes before reading the selected task again.
  With no selection, check only the service rather than scanning tasks.
- Read lists only when opening or paging the picker, using current `page`, `lifecycle`, and `has_next`.
- Selection, showing, and wake refresh immediately. Connection generation, task ID, and list-request
  generation identify response ownership; discard obsolete responses.
- Hiding cancels requests, timers, and animations. Showing starts a fresh observation. Wake,
  reconnection, and selection clear previous notification-trigger observations.
- Network failure immediately shows disconnected. Every 15 seconds, check status through the same
  Core and obtain a fresh address after recovery. Background checks are read-only. Clicking
  “Retry connection” may explicitly start the same Core's WebUI and then verify it again.
- Missing Core paths or changed identity exit the pet with relaunch guidance. Handle external
  Adapter changes through existing checks, without installation watchers or live Core switching.

HTTP 404 means the selected task is unavailable, not that the entire service is disconnected.
A successful `archived=true` response separately marks archive status. Other failures show the read
result and enter connection checking. Current-data errors do not introduce migrations or compatibility reads.

### Display precedence and animation triggers

Handle disconnected, no selection, missing task, and archived task before the current node.
Read-only is an additional label. Unarchived terminal tasks remain selected. Archived and missing
tasks stop stage animation and use their static poses.

During continuous successful reads of one task, compare node and blocker text. Only a move from a
nonterminal node to `DONE` triggers completion. Entering `BLOCKED` or changing its reason plays the
blocked attention cue, then its gentle loop. Ordinary revision increases do not replay cues.
These are in-memory display events, not Core or preference writes. Update labels immediately;
motion transitions follow the animation specification.

## Navigation

Before opening, call the current Core's status and verify the service again. An unavailable service
shows connection feedback. Otherwise encode the task ID as one path segment and ask macOS to open
`<origin>/tasks/<encoded_task_id>` in the default browser. Without a selection or for a missing task,
open `<origin>/tasks`. Archived tasks still open their detail pages.

Browser failure preserves the display and permits retry. Background refresh never opens a browser.
Selection, dragging, and bubble expansion submit no Task operations. Page mutations retain the
WebUI's Origin, session, and revision checks.

## Preferences and Adapter lifecycle

Store preferences in `productRoot/pet/settings.json`:

| Field | Contents |
| --- | --- |
| `position` | Window `x` and `y` in screen coordinates; constrain to visible space after display changes |
| `animations_enabled` | Menu toggle, enabled by default; system Reduce Motion takes precedence |
| `selected_tasks` | Map of `data_root_digest` to followed task ID |
| `selected_appearance` | Selected appearance ID; unset uses the bundled character |

Read language from system preferences at runtime. Preferences contain no Task nodes, Actions,
outcomes, or history. Use current-user private permissions and atomic JSON writes. Missing
preferences use defaults; add no historical-format readers.

Immediately before a confirmed lifecycle operation changes the selected Adapter, call native stop
filtered by `core_path`. Unconfirmed previews, read-only status/doctor, and maintenance of another
Adapter do not stop the pet. Before updating or uninstalling the unified entry point itself, users
first stop the pet. Normal npm installation does not launch it.

Add an existing `productRoot/pet` directory to factory-reset observation, plan digest, confirmation
display, and actual targets. It is a sibling of `productRoot/data`; current `executeCleanup` does
not cover it automatically. Reuse existing Trash/permanent-deletion behavior and precise authorization.
Stop successfully before cleanup and preserve explicit data-directory authorization boundaries.

## Build, signing, and npm distribution

The Swift Package provides an executable target and targeted tests. AppKit, Foundation, and the
system HTTP client supply runtime capabilities. T01 verifies minimum macOS and Xcode/Swift ranges
against actual API usage and records them in build configuration and acceptance environments.
Native execution has not yet established those minimum versions; the development-machine version
is not automatically a minimum support claim.

The final npm package has this fixed app location:

```text
runtime/darwin-arm64/DevFlowPet.app/
  Contents/
    Info.plist
    MacOS/DevFlowPet
    Resources/
      Assets/
      animations.json
      zh-Hans.lproj/
      en.lproj/
```

`Info.plist` sets a stable bundle identifier, `LSUIElement`, and the verified minimum OS.
Generate app version metadata from the unified package; the pet has no separate product version.
Assets and `animations.json` fields are specified in the
[UI and animation document](ui-design_en.md#asset-delivery).

Build in this order:

1. Compile Swift on macOS arm64 and assemble final assets, locale resources, and app metadata.
2. In staging outside the repository, apply Developer ID signing, submit an app archive through
   Apple's notarization workflow, and staple the ticket. Development builds aid debugging but do
   not replace acceptance of the final signed package.
3. Add the complete app to unified-package staging and create the npm tarball using its file list.
4. Unpack the tarball, install into an isolated prefix, and check resource inventory, executable
   permissions, signatures, notarization tickets, and actual startup. Do not change resources
   after signing. The resulting package contents must pass before publication.
5. Prepare the release tarball from the same inspected app and retain existing digests, registry
   read-back, and publication-recovery rules.

The unified entry point currently calls npm packaging directly in
[scripts/release-dev-flow.mjs](../../scripts/release-dev-flow.mjs)'s `prepare`.
Integrate app preparation there and into its fixed package checks; local artifact verification
reuses the same assembly logic. `release/prepare.mjs` currently prepares Codex/DeepSeek packages,
not the unified package for this feature.

Verify signing identity, notarization credential references, and builder availability in T01.
Keep secrets out of the repository and acceptance logs. Follow Apple's
[distribution guidance](https://developer.apple.com/documentation/xcode/packaging-mac-software-for-distribution)
and [notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow).
The npm tarball is not submitted directly as an Apple notarization container. Notarize the app using
a supported archive format first, then distribute it through npm.

This feature adds build and package checks without performing public publication. Release selection,
fixed checks, Tags, npm, and GitHub Releases remain owned by the standalone release flow. Core's
process definition, content digest, nodes, complete outgoing edges, Schema, and MCP projections
remain unchanged.

## Current local build entry

`node scripts/build-desktop-pet.mjs --output <absolute-directory>` builds a local unified-entry
tarball from the existing Swift Package and artwork source. The source package manifest keeps its
JS file list; staging adds exactly one `runtime/darwin-arm64/DevFlowPet.app`. The existing USTAR
helper in `scripts/dev-flow-local.mjs` preserves native executable modes. Extracted binaries,
languages, artwork, and ad-hoc signatures are checked. Installed execution is independent of the
repository. Public release scripts remain unchanged; this local entry neither notarizes nor publishes.


User appearances live in `productRoot/pet/appearances/<id>`. `PetAppearanceStore` owns bounded file
reads, validation, and replacement; `CodexPetImporter` crops standard atlases only during import;
`PetAppearanceSelection` keeps successful loading and saved selection consistent; `PetCharacterView`
plays the common catalog. `selected_appearance` is independent of `selected_tasks` per data root.
Preference updates share one lock and preserve the old value on write failure. Switching releases old
frames and shows the current state without replaying prompts. See [DESKTOP-PETS](../../docs/DESKTOP-PETS_en.md).
