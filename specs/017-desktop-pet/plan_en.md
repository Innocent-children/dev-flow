# Dev Flow Desktop Pet Plan

[中文](plan.md) | [English](plan_en.md)

Developers can see the stage of a selected Dev Flow task on their desktop, notice blockers and
completion, and click the pet to open that task in the WebUI. The pet is a native macOS arm64
component distributed with `@imotong/dev-flow`. At least one installed and configured Codex or
DeepSeek Adapter is required to activate it. Both Hosts use the same existing Core data and display rules.

The user's 2026-09-06 request makes functional usability the current delivery target: start and stop,
task selection and stages, WebUI navigation, reconnection, hiding and waking, preferences, Adapter
maintenance, and a locally installable app. Reuse existing artwork; simple static shapes are acceptable.
Art refinement, animation smoothness, pose blending, full visual recordings, notarized publication,
and minimum-OS matrices are outside this checkpoint. Run only checks for each changed surface, with
no repository-wide test run or code audit.

This document defines planned behavior; source was checked on 2026-09-06. New commands and paths are
design targets, not current support claims. The [technical design](design_en.md) defines integration
and packaging, the [UI and animation specification](ui-design_en.md) defines visual delivery, and the
[acceptance document](validation_en.md) defines procedures and result records.

## Problem

A developer asks Codex to continue a Dev Flow task, then switches to an editor, browser, or other work.
They want to notice stage changes, blockers, and completion directly on the desktop and quickly open
the relevant task.

## Current approach

Developers inspect progress through Codex / DeepSeek conversations or the local WebUI. The WebUI
already provides task lists, detail pages, a process graph, and blocker information, but requires
opening a page. The pet keeps a small summary visible and reuses the detail page for subsequent actions.

## Available data

Existing HTTP endpoints expose task ID, summary, source Host, current node, revision, update time,
blocker text, and archive status. Detail pages support `/tasks/{task_id}`. The selected Core's WebUI
commands supply the dynamic loopback address and service identity.

A Core node is the most recently retained process stage. It does not establish whether Codex or
DeepSeek is currently executing, awaiting input, or stopped. The pet displays stages without computing
completion percentages or remaining time.

## Behavior rules

- At least one Adapter must pass existing installation-record, platform, and Core-executable checks.
  Installing the unified entry point alone does not satisfy activation requirements.
- Follow one task. Once selected, updates to other tasks do not change the selection.
- Core decides task stage, blockers, and outcome; the pet chooses wording, poses, and navigation.
- `BLOCKED` shows the retained reason without treating every blocker as an approval request.
- Celebrate once when continuous online observation sees the selected task move from a nonterminal
  state to `DONE`. Never celebrate `CANCELLED`.
- The first read after startup, selection, showing, system wake, or reconnection establishes the
  display without replaying historical cues.
- Updates and bubble expansion preserve other apps' keyboard focus. Clicking opens the task;
  finishing a drag does not navigate.
- Stopping the pet preserves the shared WebUI, Host conversations, and tasks. Stop the pet before
  maintaining its selected Adapter and select a runtime again on the next launch.

These rules use existing Tasks and local endpoints without adding Core nodes, transitions, or user
workflow steps.

## Expected result

The pet stays near a desktop corner with two persistent lines showing the task short name and stage.
Hovering reveals task update time, last successful sync, and blocker text. Clicking opens the task;
dragging changes position. The menu bar provides task selection, the task list, retry connection,
an animation toggle, hide/show, and quit. The context menu uses the same entries. UI language follows
the system, with Simplified Chinese and English resources.

Delivery retains complete idle, ordinary-stage, blocked, completed, and disconnected animations.
Each has a suitable pose and transitions. Completion has clear anticipation, main action, and settling.
Character construction, motion curves, transparent edges, and detail at different scales require
visual checks. The animation toggle and system Reduce Motion setting provide static presentation;
the complete animations remain required assets.

## Risks and impact

Presenting old records as live execution can mislead users; missing a blocker delays intervention.
Display “Task updated” and “Last synced” separately. Connection failures mark retained content
“Last recorded” and stop work and celebration animations.

An old address can open the wrong service. Recheck Core identity, data directory, and loopback URL
before navigation; task actions remain subject to the WebUI's existing checks. Poor artwork, motion
jumps, and focus stealing affect everyday use, so both visuals and interaction require acceptance.

## Installation and lifecycle

The native artifact is `DevFlowPet.app`, carried once inside the unified npm package. Users obtain
an Adapter through existing Dev Flow installation, then start the pet from the unified entry point.
Adapter-only users first obtain that entry point. The app runs inside the package and updates with it.
Users need no separate DMG, PKG, App Store installation, or Swift/Xcode toolchain.

This distribution follows the example of [node-notifier](https://github.com/mikaelbr/node-notifier),
which carries `terminal-notifier.app` inside its npm package. Dev Flow implements its own desktop
windows and animations.

The following public entries are proposed for this feature:

| Entry | Behavior |
| --- | --- |
| `dev-flow pet start` | Validate an installed Adapter, start the WebUI through existing Core behavior if needed, and show the pet; restore a running instance for the same Core and data directory |
| `dev-flow pet stop` | Stop only the current user's identity-matched pet; succeed when already stopped |
| Interactive `dev-flow` menu | Offer pet start and stop through the same orchestration |

Commands return short text and exit codes. The bubble displays connection status directly. There is
no `pet status`, pet JSON query interface, or separate management panel. Only explicit launch or retry
may request WebUI startup; background polling does not repeatedly restart a service the user stopped.

Before the unified entry point upgrades, repairs, reinstalls, or removes the Adapter supplying Core,
stop its matching pet. If stopping fails, retain the Adapter for retry. Confirmed factory-reset stops
the pet before cleanup. If an external tool removes the Adapter or changes Core identity, the pet
exits when a subsequent check detects it. The next launch can select another available Adapter;
there is no live runtime switching.

Normal exit, Adapter removal, and unified-entry upgrades preserve preferences. Factory-reset explicitly
adds `productRoot/pet` to the existing confirmed plan and cleanup targets. Current code enumerates
configuration, default data, and confirmed explicit data; it does not yet include this new directory.

## Task selection and display

Restore the saved task ID for the current `data_root_digest`. Without a saved selection, choose the
most recently updated task on the first `lifecycle=blocked` page, then try `lifecycle=active`.
Remain idle if both are empty. An archived or missing saved task gets an explicit display; the user
chooses a replacement.

The picker requests `GET /api/tasks?page=...` on demand, showing summary, source Host, stage, and
repository context. Load further pages using `has_next`. The endpoint returns at most 50 items per
page and excludes archived tasks by default. The pet does not enumerate all tasks in the background.

| Read result | Display and action |
| --- | --- |
| Ordinary node | Existing WebUI node label and ordinary-stage animation; a backward move displays the new value |
| `BLOCKED` | Blocked animation and reason; ordinary revision changes for the same blocker do not replay its attention cue |
| `DONE` | Celebrate once under continuous-observation rules, then hold the completed pose |
| `CANCELLED` | Cancelled label and a calm static pose |
| Detail `readiness=read_only` | Keep the stage and add “View only” |
| No task / archived / missing | Show choose-task, archived, or unavailable content respectively; a missing task opens the task list |
| Request failure / identity mismatch | Show disconnected and last-recorded content with the disconnected animation; identity changes require relaunch |

The technical design defines connection and task precedence, cancellation, and animation triggers.
The UI and animation specification defines the motions themselves.

## Acceptance checks

Acceptance uses the app installed from the final npm tarball. Procedures and result locations are in
the [acceptance document](validation_en.md).

| Scenario | Passing result | Verification |
| --- | --- | --- |
| Activation | No usable Adapter prevents activation; Codex-only, DeepSeek-only, and both-installed setups can start | Targeted launcher tests and native installation checks |
| Desktop interaction | Visible and draggable without accidental navigation or focus stealing; hiding is reversible; quitting leaves no windows | Native macOS arm64 checks |
| Task changes | Correct forward, backward, blocked, recovered, completed, and cancelled states without invented execution status or percentages | Presentation tests and an actual Codex task journey |
| Shared Host data | DeepSeek tasks can be selected, updated, and opened under identical rules | Actual DeepSeek task checks |
| Connection and selection | Changed ports open the right page; late responses cannot replace a new selection; reconnect does not replay completion | Targeted HTTP tests and native service lifecycle checks |
| Visuals and animation | Original character and all five animations are complete; loops, transitions, alpha edges, scaling, and static mode pass | Asset previews and installed-app recordings |
| Lifecycle and package | Single instance, pet stops before Adapter maintenance, reset includes preferences, signatures and resources survive unpacking | Targeted lifecycle and final-package checks |

## Non-goals

- Windows, Linux, Intel Mac, and cross-machine pets; existing Dev Flow platform support keeps its scope.
- Operation without an Adapter, automatic Adapter installation, live Core switching, independent installers or updaters.
- Control of Codex's built-in pet, private Host conversation databases, or internal Host event subscriptions.
- Task creation, Action submission, blocker resolution, test approval, or Git operations from the pet.
- New Core nodes, transitions, MCP tools, Task fields, SQLite layouts, or historical-configuration compatibility.
- Global background monitoring, estimates, completion percentages, login startup, cloud sync, speech, progression, or skin markets.
- A separate settings window, manual language switching, or special adaptations for individual fullscreen apps.

## Implementation checklist

The following work forms one complete delivery. Paths follow the
[technical responsibility allocation](design_en.md#responsibilities-and-change-locations).

| Work | Scope | Dependencies | Completion checks |
| --- | --- | --- | --- |
| T01 | Native windows, menu bar, build assembly; verify minimum system/toolchain and signing/notarization prerequisites | None | Native-window checks and package-build feasibility record |
| T02 | Task reads, selection, polling, navigation, and presentation rules | T01 | Acceptance V02–V05, V08 |
| T03 | Final character, five complete animations, transitions, Chinese/English layout, and static mode | T01; state mapping aligned with T02 | Acceptance V06–V07 |
| T04 | Unified entry point, singleton, preferences, Adapter maintenance, and reset | T01; integrate T02 | Acceptance V01, V09–V10 |
| T05 | Final tarball, signature/notarization read-back, actual Host journeys, and product-document synchronization | T02–T04 | Acceptance V11–V12 and all result records |

## Documentation to synchronize during implementation

This change maintains only the paired Chinese and English plan, technical design, UI and animation
specification, and acceptance documents in this feature directory. Implementation synchronizes these
delivered-product documents with final behavior:

- Nine root READMEs: `README.md`, `README_zh-CN.md`, `README_zh-TW.md`, `README_ja.md`,
  `README_ko.md`, `README_es.md`, `README_fr.md`, `README_de.md`, `README_pt-BR.md`.
- `docs/PRODUCT.md`, `docs/PRODUCT_en.md`, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE_en.md`.
- `docs/COMMANDS.md`, `docs/COMMANDS_en.md`, `docs/WEBUI.md`, `docs/WEBUI_en.md`.
- `docs/SUPPORT-MATRIX.md`, `docs/SUPPORT-MATRIX_en.md`, `docs/CODEX_en.md`, `docs/DEEPSEEK_en.md`.
- `packages/dev-flow/README.md`, `packages/codex/README.md`, `packages/deepseek/README.md`.
- `docs/TOOLCHAIN-BASELINES.md` and `release/dev-flow/README.md` for affected build/distribution statements;
  synchronize the matching document families if the same statements occur elsewhere.

Core semantics and public interfaces remain unchanged under this plan, so this document change does
not update `CORE_VERSION`. Any implementation need to change shipped Core must first state the changed
requirement, then update its interfaces, direct consumers, and version. Feature completion does not
publish npm packages, Git Tags, or GitHub Releases. Publication retains the standalone flow with an
explicit product, channel, and exact version selected by the user.

## User-created appearances

Support local pack import, menu selection, and persistence. As additionally requested, Codex sprite formats 1/2 are converted to common assets during import. User artwork lives outside the installation. See the [design](appearance-packs_en.md) and [authoring guide](../../docs/DESKTOP-PETS_en.md).
