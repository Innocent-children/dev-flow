# Windows feature parity design

[中文](WINDOWS-PARITY.md) | [English](WINDOWS-PARITY_en.md)

## Problem

Windows Core and Host entry points were available, but Windows lacked the desktop task pet delivered on macOS: selecting and observing a Task, importing appearances and interacting with animated artwork.

## Current approach

Windows users opened WebUI manually. macOS users could navigate from the pet or menu bar to their selected Task.

## Available data

Use current Core runtime status, WebUI system/status, paginated tasks and task detail, and the existing default artwork and animation catalog. Preferences store display choices, never a process cursor.

## Behavior rules

Core remains the sole Task authority. Windows uses a separate Electron process, transparent always-on-top window and system tray; macOS retains Swift/AppKit. A disconnected view marks the last record. Reconnecting, changing Tasks or waking does not replay historical completion. Task prompts preempt idle activities; hidden and sleeping windows stop observation and animation. Repeated startup restores the same instance, and shutdown is scoped to the product directory and Core identity.

## Expected result

Windows 10/11 x64 receives task selection, state bubbles, WebUI navigation, tray/context menus, saved drag position, hide/restore, animation and idle switches, six scales, static/native animated PNG/SVG packs, Codex PNG/WebP nine-row atlases, appearance switching and independent start/stop. The local package carries its desktop runtime; installed execution does not depend on a developer toolchain.

## Risks and impact

Misleading state is prevented by checking Core and data identity on every observation and by not inferring completion. Invalid artwork preserves the previous selection and installed content. The renderer has no Node privileges, arbitrary filesystem access or remote content. Electron belongs only to the Windows desktop package, not Core or macOS dependencies.

## Acceptance checks

On native Windows 11 Intel x64, verify display mappings, animation timing, artwork validation/import, atomic preferences, restricted local interfaces, build/extraction, actual desktop screenshots, startup reuse/shutdown and existing Windows entry points. No macOS tests or cross-builds are performed. Report unavailable Windows 10/AMD hardware explicitly, and distinguish real Core/WebUI checks from constructed display-state tests.

## Non-goals

No change to the process graph, transitions, Schema or Core state authority. No new remote service, account, release or automated Git operation. No extension to 32-bit Windows, ARM64, Server or special environments.

## Product evaluation

Showing retained state and a direct task entry supports resuming long tasks and reduces task discovery work. Evidence comes from Core records. Codex and DeepSeek keep existing interfaces, and the desktop introduces no workflow step. This supplies the missing Windows task viewing and interaction capabilities; full Host-session and desktop checks remain separately reported.

Implementation and verification results are recorded in the [adaptation report](WINDOWS-ADAPTATION_en.md).

## Unified-entry delivery contract

The Windows development distribution explicitly binds both Adapter artifact paths, versions and SHA256 values in package.json devFlowLocalPackages. The launcher installs those artifacts; invalid declarations or digests stop the operation without choosing another source. Regular release packages omit the declaration and retain their npm version selection.

Bootstrap the launcher with npm, then use dev-flow install, upgrade, repair, reinstall and pet start/stop. This entry owns Adapter registration and desktop updates. Local distributions can replace same-version code; Codex first uses its own remove command to validate and remove a receipt-owned registration, then installs and runs setup. Windows maintenance identifies Core by its full executable path, command and creation time and stops maintained MCP/WebUI instances before replacement. Mac retains its existing executable-replacement behavior.

Windows starts the GUI through system Start-Process and returns a unique per-launch acknowledgment, so the long-running pet does not hold the caller's output handles. Local package updates refresh the desktop copy while retaining preferences and appearances.
