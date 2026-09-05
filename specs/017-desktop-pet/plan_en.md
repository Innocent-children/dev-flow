# Dev Flow Desktop Pet Proposal

[中文](plan.md) | [English](plan_en.md)

Developers can see the stage of a selected Dev Flow task on their desktop, notice when it becomes
blocked or finishes, and click the pet to open that task in the Web UI. The design provides a native
macOS arm64 component, with Codex as its primary use case and support for displaying DeepSeek's
Dev Flow tasks through existing Core task data and local services.

Delivery includes complete desktop interaction, task selection and status cues, final pet artwork,
installation and removal, a bilingual UI, documentation, and actual artifact acceptance. Delivery
is complete only when all of these are finished.

This is an implementation proposal based on source inspected on 2026-09-05. New commands, directories,
and desktop behavior below are proposed. This delivery adds proposal documents only; it changes no
current product behavior, version, or support claim.

## Problem

A developer asks Codex to work on a Dev Flow task, then switches to an editor, browser, or another
activity. The task advances, becomes blocked, or finishes, but discovering that change requires
returning to the conversation or opening the Web UI.

## Current approach

Developers inspect progress through their Host conversation or the local Web UI. The Web UI already
provides task lists, detail pages, a process graph, and blocker information. Its detail page refreshes
every two seconds, but the developer still needs to open the page.

A custom Codex pet can provide a branded appearance. The [official pet documentation](https://developers.openai.com/codex/pets)
reviewed describes appearance, Host activity, and clicks returning to the Host. It does not describe
an extension point for injecting Dev Flow state or setting an external click destination. This
proposal uses a desktop component that owns its window and click behavior, without depending on an
unconfirmed Codex pet extension interface.

## Existing data and interfaces

- Core retains task ID, summary, current node, revision, update time, blocker information, and terminal outcome. Local HTTP endpoints already expose these fields.
- The Web UI supports `/tasks/{task_id}` for opening a specific task directly.
- Codex, DeepSeek, and the Web UI share Core Tasks in the selected data directory. The same endpoints can supply tasks from both Hosts to the pet.
- The current Core node is the most recently retained process stage. It does not establish whether the Host is executing, awaiting input, or has exited.
- The Web UI uses a dynamic loopback port. Existing runtime checks verify process identity, Core identity, the data directory digest, and the service URL.

## Responsibilities and behavior

The pet decides how to display retained state and which page a user click opens. Core and the
existing Host workflow continue to decide whether to continue, review, retry, block, or finish a
task. `BLOCKED` displays a blocked status and its reason; it does not universally mean that user
approval is required.

The feature helps developers notice a task that needs attention and reach its page with fewer
steps. It uses existing Tasks and local endpoints, adds no process node, and requires no extra
development steps just to support the pet.

## User interaction

A small pet window stays near a desktop corner, with two persistent lines such as “Login update /
Testing.” Hovering reveals the last task update and blocker reason. A click opens the task detail
page, dragging moves the window, and a context menu offers task selection, the task list, hiding,
and quitting. A menu bar entry restores the hidden pet.

The pet follows one task. Users select other tasks from a list, and the selection remains
stable rather than changing whenever another task updates.

## Risks and impact

Presenting old records as live execution could make a developer believe work is still advancing;
missing a blocker delays intervention. Opening the wrong task or an old service URL puts the user
in the wrong context. The display therefore separates task update time from connection status,
checks local service identity before navigation, and leaves task operations in the Web UI.

## Acceptance checks

These are acceptance requirements for the complete implementation. None was executed as part of
this document delivery.

| Scenario | Passing result | Verification |
| --- | --- | --- |
| Everyday desktop use | Pet is visible and draggable; updates preserve keyboard focus; hiding is reversible; quitting leaves no window | Native macOS arm64 desktop check |
| Stage changes | Forward and backward moves display the current Core value, without a percentage or an inference that the Host is running | Targeted presentation tests and an end-to-end test in actual Codex |
| Shared Host data | Tasks created by Codex and DeepSeek can be selected, updated, and opened with the same presentation rules | Full task testing in Codex, plus task-reading and navigation tests in actual DeepSeek |
| Blockers and terminal states | Current blocker reason is visible; observing the selected task enter `DONE` celebrates once; `CANCELLED` never celebrates | State examples and real Host transitions |
| Navigation | A changed dynamic port still opens the correct task; identity mismatch or unavailable service never opens the old address | Runtime integration tests and an actual browser opening |
| Task selection | After switching from A to B, a late A response cannot overwrite B; the list supports existing pagination | Targeted HTTP client tests |
| Data and connection failures | Service stop, missing task, and archive have distinct displays; reconnecting does not replay a completion animation | Fault injection and native service start/stop checks |
| Lifecycle | Repeated starts produce one pet; stopping it preserves the Web UI, Host, and Task; status creates no product data | Launcher tests and macOS process checks |
| Final package | Installation from the actual npm tarball can start and quit; signatures, resources, executable permissions, and package contents agree | Targeted package checks and end-to-end testing of the installed package on macOS |

## Non-goals

- The desktop component targets macOS arm64. Windows, Linux, Intel Mac, and cross-machine desktop components are outside this proposal; existing Dev Flow platform capabilities retain their current scope.
- No control of the built-in Codex pet, access to private Codex conversation databases, or subscription to private Host events.
- No Action submission, blocker resolution, test approval, task creation, or Git operation from the pet.
- No new Core nodes, transitions, MCP tools, Task fields, SQLite layout, or historical-data handling branches.
- No background monitoring of every task, time estimates, overall completion percentage, or inference of Host execution activity.
- No login startup, cloud sync, speech, pet progression system, extensible skin marketplace, or independent updater.

## Desktop interaction and status display

### Display stage and connection separately

Ordinary nodes use the Web UI's Chinese and English names, including `REQUIREMENTS`, `DESIGN`,
`TASKS`, `IMPLEMENT`, `TEST`, `COMPREHENSION_REVIEW`, `REFACTOR`, and `DELIVERY`. Names are presentation
only: the desktop component does not copy node order, legal transitions, or completion conditions.
A backward transition simply displays the new current node.

| Endpoint value or read result | Bubble and behavior |
| --- | --- |
| Ordinary process node | Task short name and node label; a subtle work-themed animation, with wording that describes only the stage |
| `BLOCKED` | “Blocked”; expand to show Core's `blocker`; click for details |
| `DONE` | “Done”; briefly celebrate a continuously observed change from a nonterminal state to `DONE`, then become still |
| `CANCELLED` | “Cancelled”; remain still |
| Detail marked read-only | Keep the stage with “View only”; the detail page determines available operations |
| No selected task | “Choose a task”; click to open the task list |
| Selected task archived or missing | Show “Archived” or “Task unavailable”; let the user select another task; a missing task opens the task list |
| Request failure or service identity mismatch | “Disconnected”; label retained content “Last recorded”; stop work and celebration animations |

The first successful read after startup, task selection, or reconnection establishes the current
display without replaying an old completion animation. Later cues reflect continuously observed
changes to the same task. A revision increment alone does not repeat completion or blocker animations.

`updated_at` is labeled “Task updated”; client-side successful read time is labeled “Last synced.”
An unchanged task timestamp does not establish a disconnected Host. When Core supplies no completed
check count, verification budget consumption must not appear as a completion ratio.

### Choose a task to follow

At startup, restore the saved task ID for the current `data_root_digest` and read that task directly.
Without a saved selection, choose the most recently updated task on the first `lifecycle=blocked`
page, then try `lifecycle=active`. If both are empty, remain idle. A saved task that is unavailable
gets an explicit display instead of being silently replaced.

The task picker uses `GET /api/tasks?page=...` and shows a short name, source Host, stage, and
repository context. Load subsequent pages according to `has_next`. The current endpoint returns up
to 50 tasks per page and excludes archived tasks by default. Read the picker when it opens; do not
traverse every task in the background or display an incomplete count as a global attention count.

Keep following a selected task after it finishes so its result remains one click away. Another
task becoming blocked does not change the selection. “Current task” always means the selected
Dev Flow Task, not an inferred foreground Codex conversation.

### Clicks, windows, and animation

A click opens the selected task; finishing a drag does not navigate. Expanding the bubble and
periodic refreshes preserve focus. The task picker accepts keyboard input only after the user
opens it. Keep window bounds compact so a large transparent window does not cover other apps.

The context and menu bar menus share these entries: choose task, open task list, reconnect, start
local service, settings, hide/show, and quit. Reconnect checks an already running service; start local service
explicitly uses the existing start operation. Hiding suspends animation and task polling; showing
refreshes immediately. Settings provide system-default/Chinese/English language selection and an
animation toggle. Save the window position and return it to a visible screen when a monitor is removed.

Deliver one original Dev Flow character with complete idle, ordinary-stage, blocked, completed,
and disconnected poses and transparent assets. Follow the colors and line treatment of the current
Dev Flow icon, consistently across the bubble, menu bar, and settings entry. Check final assets for
transparent edges, clarity at different scales, and animation transitions. Placeholders are not
final deliverables.

Animate only as needed, allow animation to be disabled, and respect reduced-motion settings.
Validate actual fullscreen, Spaces, and multiple-monitor behavior natively before delivery and
document the supported behavior.

## Technical design and responsibilities

### macOS desktop implementation

Use Swift + AppKit: `NSPanel` holds the pet and bubble, `NSStatusItem`
provides the menu bar entry, and `LSUIElement` supplies background-app Dock behavior. Use the system
HTTP client and open details in the default browser. Apple supplies these primitives; their combined
focus, window-level, and screen-switching behavior must be verified before delivery.
See [NSPanel](https://developer.apple.com/documentation/appkit/nspanel),
[NSStatusItem](https://developer.apple.com/documentation/appkit/nsstatusitem), and
[LSUIElement](https://developer.apple.com/documentation/bundleresources/information-property-list/lsuielement).

The native approach fits one small window, a few menus, and HTTP reads. Swift builds and macOS
signing are delivery work. Window, process, and path behavior belongs in the macOS implementation;
Core retains platform-neutral task semantics.

### Responsibility allocation

| Location | Responsibility |
| --- | --- |
| Existing Go Core | Task, process, revision, blockers, and terminal outcome; reuse existing behavior |
| Existing local Web UI service | Task reads, runtime status, and browser pages; retain HTTP and mutation checks |
| Unified launcher | Select and verify an installed Core, resolve the data directory, start the desktop component, and dispatch pet commands |
| Desktop reading and presentation modules | Read current endpoint results, select a task, and produce bubble text and animation cues |
| macOS implementation | Windows, mouse interaction, menu bar, browser opening, single instance, process identity, and local settings files |
| Build and release code | Compilation, resource assembly, signing, notarization, npm contents, and final-artifact verification |

A few direct modules can express these responsibilities. Task data models represent endpoint responses;
animation selection belongs in presentation, and process and path behavior belongs in the macOS
implementation. Constants and configuration objects do not own runtime behavior.

## Connect to Core and open the Web UI

### Startup sequence

1. The user starts the pet through the unified launcher. Reuse `resolveCoreRuntime` and existing
   path rules to choose the Core executable and data directory, without discovering neighboring
   repositories or opening SQLite directly.
2. Run existing `webui status --json` with that Core. If the service is actually stopped, this
   explicit start may invoke `webui start --no-open --json`. Identity conflicts or unreadable
   current data return a specific error.
3. Read `core_identity`, `data_root_digest`, `url`, and `pid`; verify the service response before
   starting the desktop window. Default data creation follows Web UI start rules. An explicit
   `DEV_FLOW_DATA_DIR` must already exist and pass the current checks.
4. Pass the confirmed Core path, data directory, and identity through fixed launcher arguments.
   For reconnection, the desktop app invokes this Core's `webui status --json`, reusing receipt
   and process checks rather than parsing runtime receipts or implementing another directory digest.

### Read data

Data reads use existing `GET /api/system/status`, `GET /api/tasks`, and
`GET /api/tasks/{task_id}`. Successful status must correspond to the same Core, data directory, and
current loopback address. Restrict HTTP requests to the verified `http://127.0.0.1:<port>` origin,
disable redirects, and never use task text to construct a hostname.

While visible, read the selected task every five seconds, scheduling the next request only after
the previous one finishes or fails. The HTTP timeout is three seconds. Refresh immediately
on task selection, showing the pet, or system wake. Associate each request with a connection
generation and task ID; discard late responses from an old connection or task. Use revision to
identify task changes, while also applying actual read-only, archive, and connection results.

A failed request immediately marks the display disconnected. Check service status every fifteen
seconds and obtain a fresh address when the service returns. Do not repeatedly restart a Web UI
that the user has explicitly stopped. If the Core executable disappears or changes identity,
instruct the user to reopen the pet so the launcher can select the runtime again.

The existing detail response is substantial. Poll only the selected task and read task lists on
demand. Record payload size and latency during acceptance, confirming that periodic reads do not
accumulate requests or noticeably interfere with desktop use. This proposal uses existing endpoints
without adding SSE, WebSocket, or a polling-specific endpoint.

### Navigate on click

Recheck runtime status on click, encode a valid task ID as one path segment, and construct
`<origin>/tasks/<encoded_task_id>`. Without a selection or when the task is missing, open
`<origin>/tasks`. Core's static handler and the frontend router already support direct
detail-page navigation; no new deep-link protocol is needed.

If disconnected, show the result in the bubble and let the user reconnect or start the service
from the menu. A browser-opening failure preserves the task display and allows retry. The pet
performs queries only. Operations performed after entering the Web UI retain existing Origin,
session, and revision checks.

## Lifecycle management, settings, and packaging

Ship the component with the `@imotong/dev-flow` unified entry point. It continues to install and
manage the Codex plugin. Users who installed only `dev-flow-codex` can install the unified entry
point to obtain the pet. Package one app rather than a copy in each Codex and DeepSeek Adapter,
and do not copy it into Codex's custom pet directory.

The following commands are proposed; the current parser does not implement them:

| Proposed entry | Behavior |
| --- | --- |
| `dev-flow pet start` | Explicitly start the pet and, if needed, the local service; restore an existing instance for the same data directory |
| `dev-flow pet status` | Inspect the pet process and connection, even after Adapter removal; create no directory and start no service |
| `dev-flow pet stop` | Stop only the current user's identity-matched pet; succeed if already stopped |

All three support `--plain` and `--json`. Starting needs no task ID; selection happens in the pet.
The interactive `dev-flow` menu also provides Desktop Pet entries for starting, inspecting, and
stopping. Commands and menus share orchestration in the unified launcher; they are not forwarded
to Go Core. The user starts the pet after installation.

The macOS implementation maintains one instance per user. Repeated starts for the same directory
reuse it. A start for another directory reports the existing instance's directory; users quit
before switching. The singleton lock and runtime record contain only process ID, start identity,
app path, and selected data-directory identity, with no process cursor. Verify process and
executable identity before stopping, and never terminate processes by name in bulk.

Store preferences in `pet/settings.json` under existing `productRoot`: position, language, animation
preference, and a followed task ID scoped to `data_root_digest`. The launcher supplies application
paths. Task state is an in-memory snapshot; preferences retain no node, Action, outcome, or second
task history.

Quitting or stopping the pet preserves the shared Web UI, Host, and Task. If Adapter removal stops
the service, the pet displays disconnected. Document stopping the pet before updating or removing
the unified entry point that supplies it. Ordinary uninstall preserves settings. Explicit
factory-reset includes this settings directory in the existing product-root cleanup and stops
the pet before cleanup; the pet does not execute data cleanup itself.

## Expected change locations

These are implementation targets. This delivery creates none of the listed code or generated files.

| Path | Implementation change |
| --- | --- |
| `packages/desktop-pet/macos/` (new) | Swift app, AppKit windows, HTTP reads, presentation and settings, native tests, and assets |
| `packages/dev-flow/lib/pet.mjs` (new) | Pet arguments, Core selection, and startup orchestration; reuse runtime and path modules |
| `packages/dev-flow/bin/dev-flow.mjs`, `packages/dev-flow/lib/runtime.mjs` | Dispatch pet entries and update help while sharing current Core selection rules |
| `packages/dev-flow/lib/cli.mjs`, `packages/dev-flow/lib/presentation.mjs` | Interactive pet menu entries, bilingual descriptions, and result presentation |
| `packages/dev-flow/lib/lifecycle.mjs` | Stop the identity-matched pet before explicit reset clears the product directory |
| `packages/dev-flow/package.json`, `packages/dev-flow/tests/` | Package file inventory and targeted command, lifecycle, and final-package checks |
| `packages/dev-flow/runtime/darwin-arm64/DevFlowPet.app/` (generated) | Final native app carried by the unified entry point, with resources assembled at build time |
| `scripts/build-desktop-pet.mjs` (new), `release/prepare.mjs`, and relevant package preparation contracts | Compilation, assembly, and verification; publication stays in the standalone release flow |

No changes are planned for Core's `internal/domain/`, `internal/workflow/`, `internal/store/`, MCP
payloads, or current persisted Schema. The process definition, content digest, nodes, and complete
outgoing edges remain as implemented; the pet has no transition submission path. Implementing this
proposal therefore does not require a `CORE_VERSION` change. Any implementation need to change shipped Core
or its public contract must first state the additional requirement, then update Core's version and
direct consumers under repository rules.

### Documentation to synchronize during implementation

This proposal adds only `specs/017-desktop-pet/plan.md` and `plan_en.md`. Once implemented, synchronize
the following current-product documents with the final capabilities, commands, and artifacts:

- Nine root entries: `README.md`, `README_zh-CN.md`, `README_zh-TW.md`, `README_ja.md`, `README_ko.md`,
  `README_es.md`, `README_fr.md`, `README_de.md`, `README_pt-BR.md`.
- Product and architecture: `docs/PRODUCT.md`, `docs/PRODUCT_en.md`, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE_en.md`.
- Commands and pages: `docs/COMMANDS.md`, `docs/COMMANDS_en.md`, `docs/WEBUI.md`, `docs/WEBUI_en.md`.
- Support and Host usage: `docs/SUPPORT-MATRIX.md`, `docs/SUPPORT-MATRIX_en.md`, `docs/CODEX_en.md`, `docs/DEEPSEEK_en.md`.
- Installation and packages: `packages/dev-flow/README.md`, `packages/codex/README.md`, `packages/deepseek/README.md`.

If implementation changes the same command or support statement elsewhere, synchronize those
Chinese and English files too. The Chinese Codex and DeepSeek Host instructions live in their
package READMEs, paired with `docs/CODEX_en.md` and `docs/DEEPSEEK_en.md` respectively.

## Implementation and completion criteria

Schedule work according to dependencies and deliver one complete feature:

1. Complete the Swift app, window, menu bar, and launcher integration against real Core data.
   Cover focus, dragging, hiding, wake, single instance, and screen environments. Establish and
   verify the minimum macOS and Xcode/Swift build environment.
2. Complete task selection, stable polling, stages, blocked/completed cues, disconnection, and
   preferences. Separate task state from connection state in the wording. Codex and DeepSeek use
   the same reading and presentation logic.
3. Complete final artwork, all required animation, and the Chinese and English UI. Verify scaling,
   transparent edges, reduced motion, and menu entries.
4. Complete an end-to-end test in actual Codex through progress, blocking, recovery, and completion. Verify
   selection, state updates, and navigation for a native DeepSeek task. Record resident resource
   use, payload sizes, and latency, and complete the failure and lifecycle acceptance checks.
5. Complete tarball assembly, signing, notarization, and package checks. Verify startup, quitting,
   removal, and reset ordering from the actual package, and synchronize affected product documents.
   Verify and prepare signing and notarization configuration during implementation.

Completion requires final assets and all interactions, accepted tasks from both Hosts, complete
lifecycle operations, an installable working artifact, passing signature and resource checks, and
synchronized documentation. An unfinished requirement means the delivery remains incomplete.

This proposal includes no native run results, resource measurements, or signed artifact. Apple's
distribution process is described in [Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).

Development validation and publication remain separate. Completing the feature does not execute
npm publication, Tag changes, or a GitHub Release. The user must still select the product, channel,
exact version, and confirmation before its standalone release command runs.

## Implementation references

These links identify the current implementations reused by this proposal. Relevant entries and
fields were checked as of the document date.

- [Runtime selection and Web UI forwarding](../../packages/dev-flow/lib/runtime.mjs): `resolveCoreRuntime`, `runDevFlow`.
- [Public command dispatch](../../packages/dev-flow/bin/dev-flow.mjs) and [path resolution](../../packages/dev-flow/lib/ownership.mjs).
- [Core commands and JSON output](../../cmd/dev-flow/main.go): `runWebUI`, `writeRuntimeState`.
- [Web UI runtime status](../../internal/webui/runtime.go) and [process records](../../internal/webui/receipt.go).
- [HTTP routes](../../internal/webui/server.go) and [read projections](../../internal/webui/read_handlers.go).
- [Task reads](../../internal/application/control_center_read.go) and [pagination, ordering, and archive filtering](../../internal/store/control_center_read.go).
- [Detail routes](../../packages/webui/src/app/router.tsx), [static page handler](../../internal/webui/static.go),
  [detail polling](../../packages/webui/src/pages/TaskDetailPage.tsx), and [stage names](../../packages/webui/src/lib/i18n.tsx).
- [Unified package manifest](../../packages/dev-flow/package.json), [package checks](../../packages/dev-flow/tests/package-contract.test.mjs),
  and [standalone release instructions](../../release/dev-flow/README.md).
