# Desktop Pet Acceptance

[中文](validation.md) | [English](validation_en.md)

Acceptance covers the [plan](plan_en.md)'s behavior, the [technical design](design_en.md)'s
connection and lifecycle, and the polished result required by the
[UI and animation specification](ui-design_en.md). The final subject is `DevFlowPet.app` installed
with the unified npm tarball, including final assets, signatures, and language resources.

The current user request prioritizes functionality: task presentation, interaction, connections,
and lifecycle in a local development package. V06 visual refinement, V07 animation smoothness and
long performance recordings, V11 public notarization, and V12 full Host session journeys are outside
this checkpoint. The scenarios below retain the wider definitions; executed steps are recorded at
the end, with fixtures distinguished from native operations.

## Environment and preparation

Prepare an isolated Dev Flow installation and task data on macOS arm64. Record actual macOS,
hardware, display scaling, Node.js, Swift/Xcode, Codex/DeepSeek, unified-entry and Adapter versions,
and package SHA-256. Exact product versions belong in implementation-time machine-readable run
records, not end-user installation prose.

T01 first verifies minimum OS/build ranges, Developer ID identity, notarization credential references,
and builder availability. Minimum macOS and Swift/Xcode versions remain unverified until tested;
the developer machine does not establish the minimum. Record credential references, never secrets.

Prepare:

- No-Adapter, Codex-only, DeepSeek-only, and both-installed setups.
- Isolated task directories and selection records for different data roots.
- Ordinary, blocked, completed, cancelled, archived, and missing tasks, plus more than 50 list fixtures.
- HTTP test endpoints capable of delay, 404, failure, and redirects for targeted client tests only.
- A real dynamic-port WebUI, browser, light/dark/busy desktop backgrounds, and system Reduce Motion.

Fixtures verify display rules; actual Host journeys verify product integration. Test endpoints and
fixtures must not be reported as real Core or Host runs.

## Targeted automated checks

The following are implementation targets and become runnable only after the relevant files exist.
Implementation may combine tests with the same responsibility, while retaining traceability to scenarios.

| Test location | Coverage |
| --- | --- |
| `packages/dev-flow/tests/pet.test.mjs` (new) | Arguments, exit codes, activation, existing Core selection, platform rejection, and startup acknowledgment |
| `packages/desktop-pet/macos/Tests/` (new) | HTTP decoding, late responses, recovery, display precedence, and animation triggers |
| `packages/dev-flow/tests/lifecycle-maintenance.test.mjs`, `factory-reset.test.mjs` | Stop before selected-Adapter maintenance, failure prevents removal, and pet files enter reset plans and targets |
| `packages/dev-flow/tests/package-contract.test.mjs` | App/resource inventory, public command inventory, permissions, and actual tarball contents |
| Native asset/build checks added with the component | Five asset categories, frame dimensions, alpha channels, valid indices, signatures, and notarization tickets |

Swift logic tests use `swift test --package-path packages/desktop-pet/macos`; Node checks use
`node --test <affected-test-file>`. Window behavior, fullscreen behavior, focus, and final installation
require native checks separately. Run relevant checks only; this feature does not automatically
require the full Core suite or a new cross-platform desktop matrix.

## Scenario procedures and passing results

### V01 Activation and commands

In all four Adapter setups, invoke proposed `dev-flow pet start` and repeat through the interactive
menu. Without a usable Adapter, return installation guidance and failure with no pet window.
Other setups start using existing selection rules without requiring both Hosts. Failure never
automatically installs an Adapter.

Check unknown subcommands, extra arguments, and direct calls on Windows x64 for argument/platform
errors. `pet status` and `pet start --json` are unsupported. Existing Windows commands remain
available; run only relevant entry tests without claiming Windows pet support.

### V02 Selection and pagination

Without preferences, check default selection in blocked-then-active order; both empty means idle.
After saving a selection, relaunch and restore the same `data_root_digest`'s task. Completion keeps
the selection, and another task's updates never change it.

Open the picker and page past the first 50 fixture tasks until `has_next=false`. Check selection,
source Host, stage, and repository context. Closing the panel stops paging. A missing saved task
gets explicit feedback and user-controlled replacement.

### V03 Stages, blockers, and outcomes

Observe ordinary forward/backward moves, BLOCKED entry, changed blocker text, recovery, and DONE.
Stages match Core, reasons are correct, and revision-only changes do not replay cues.
DONE celebrates once and becomes still. Verify CANCELLED without celebration using another task.

Open an already completed task, restore a completed task after hiding/wake/reconnection, and switch
to a completed task. All use the completed still without historical celebration. An initially
blocked task starts its quiet loop. Work-themed animation must not use wording such as
“Host is executing” that Core cannot establish.

### V04 Connection failures and recovery

Stop the real WebUI. The bubble becomes disconnected, retained content is marked last-recorded,
work/celebration stops, and disconnected animation begins. Background checks run every 15 seconds
without repeatedly restarting the service. Explicit retry may call start; automatic service
recovery obtains the new address and resumes reads.

Use targeted fixtures for 404, read-only, archive, mismatched identity, HTTP failure, and redirects.
404/archive are not disconnection, read-only retains the stage, and mismatched/redirected services
cannot become navigation targets. Changed Core identity or a missing executable exits the pet;
the next launch selects an Adapter again.

### V05 Late responses and navigation

Delay task A's response and select B before A returns. Delay an old connection's response and create
a new connection. Late results must neither replace B/the new connection nor celebrate A. Paging
and closing the picker also invalidate obsolete list results.

Restart the WebUI to change its port and click the pet. The browser must open the exact task on the
new origin. Releasing a drag past its threshold does not navigate. A missing task opens the list.
Browser-opening failure preserves the display and permits retry.

### V06 Original character and complete animations

Inspect `idle/working/blocked/complete/disconnected`, each with complete motion, a still, and a
preview. Apply the UI specification's consistency, alpha, scale, layered-motion, and loop checks,
watching each loop at least five times continuously.

Switch states inside the actual app, checking idle, focus, blocked reaction, celebration anticipation/
main action/settling, and disconnected reaction. Record light, dark, busy-background, and
`96 / 144 / 192 pt` inspections. A placeholder, static-only image, or whole-image wobble replacing
any animation category means incomplete delivery.

### V07 Transitions, motion settings, and residency

Change tasks/connections and disable animation during playback. Old motion cancels, labels update
promptly, anchors stay stable, and new poses connect naturally. Enable system Reduce Motion;
every state uses its own still. Re-enabling does not replay events.

Using the final package, observe idle and ordinary-stage playback for 5 minutes each, then hide
for 2 minutes. Record CPU, memory, actual HTTP response size, and latency. Passing means no request
accumulation, no continuous memory growth with loops, no animation timers or polling while hidden,
and smooth dragging/other desktop use. Unmeasured fixed CPU/memory numbers do not replace results,
and required animations cannot be removed to meet this check.

### V08 Native windows and bilingual UI

While typing in an editor, trigger updates, blockers, and completion without losing keyboard focus.
Check clicks, dragging, hover, context menu, menu bar, keyboard task selection, hide/show, and quit.

Check ordinary desktop use, Space switching, one fullscreen app, and external-monitor removal.
Record actual system behavior. Windows must not remain stranded offscreen, and users must be able
to return to the menu bar to restore or quit. Check Chinese/English preferences, long task names,
paths, and blocker text without overflow or unreadably small typography.

### V09 Singleton and Adapter maintenance

Start repeatedly and concurrently; only one pet appears. Starting while hidden restores it.
A different data directory or Core identity requires stopping first and preserves the current
selection. Stopping removes windows/menu entries while retaining the WebUI and tasks.

Exercise unified-entry upgrade, repair, reinstall, and uninstall paths for the selected Adapter,
confirming that the pet stops first. Inject stop failure in targeted tests; subsequent removal
must abort. Read-only previews, unconfirmed operations, and maintenance of other Adapters do not
stop the pet. Verify subsequent checks detect external removal and another retained Adapter can
be selected on the next launch.

### V10 Preferences and reset

Change position, selection, and animation preference, then relaunch and verify restoration.
Ordinary removal preserves preferences. Selections for different data roots remain separate;
system language does not introduce a new preference field.

The reset plan explicitly includes the pet directory. After successful stop, clean it through
existing Trash/permanent-deletion behavior. Missing confirmation or failed stop prevents cleanup.
Do not broaden existing authorization for explicit data directories.

### V11 Final npm package

Create the tarball from the same staging used for distribution and install into an isolated prefix.
Start the pet through the installed entry point. Use a prefix containing spaces; runtime must not
depend on repository paths or files on the builder. End users need no Swift/Xcode.

Confirm one app copy, all five motions and locale files, resolvable references, and executable
permissions. Perform native signature/notarization-ticket checks on the unpacked app and launch it.
The normal installation path must not require bypassing system security checks. Stop before
upgrading the unified entry point, then relaunch using the new package contents. Uninstall follows
the documented preference-retention behavior.

### V12 Actual Host journeys and documentation

In actual Codex, complete stage advancement, blocking, recovery, and completion of one Dev Flow task,
observing the selected task's display and navigation. In actual DeepSeek, create and advance a task
and verify reading, selection, updates, and navigation. Use the same data directory when both coexist.

Check the plan's product-document list and all maintained languages against the final package:
installation, two new commands, Adapter prerequisite, platform, and animation descriptions.
Update delivered-product documents during implementation; document completion is not product delivery.

## Result records

Retain the following for each check, using one machine-readable run record plus necessary recordings
and screenshots:

| Field | Contents |
| --- | --- |
| Scenario | V01–V12 and the actual test name or native procedure |
| Artifact | Actual tarball, app, and asset identifiers, SHA-256, and exact versions in machine-readable records |
| Environment | Actual OS, Host, toolchain, hardware, and displays |
| Execution | Command or procedure, inputs, and automated/manual/fixture classification |
| Result | Expected and actual behavior, pass/fail/not-run, and log or recording paths |
| Limitations | Unavailable environments/signing prerequisites, unfinished motions, or unexecuted procedures |

Results are recorded per executed step; unrun steps are not passes. The functional scope at the
start of this document and the current user request define this checkpoint's completion criteria.

### Current functional implementation and targeted checks

This turn fixes chooser columns and dismissal, the two-line bubble and long text layout, animation
controls, drag suspension, cancellation on hide, default selection and late responses, ongoing Core
identity checks, startup-record failures, and stopping a held lock without a record. The builder
creates a local unified-entry tarball containing existing artwork, bilingual resources, and ad-hoc signing.

| Check | Current result |
| --- | --- |
| `swift test --package-path packages/desktop-pet/macos --filter TaskObserverTests` | 22 passed, including late hidden responses, default-list failure, preserving manual selection, idle checks, and Core removal |
| `swift test --package-path packages/desktop-pet/macos --filter 'AnimationAndBubbleTests\|LaunchAndInstanceTests'` | Initially 53 of 54 passed; the bubble initialization failure was fixed and retested separately; the subsequent stage-height issue also received bubble-only checks |
| Bubble checks `testCollapsedBubbleLaysOutBothResidentLines\|testLongBubbleContentKeepsABoundedHeight` | 2 passed without layout conflicts |
| Chooser check `testTaskPickerPagesAndSelectsWithReturn` | 1 passed: 50 rows on page one, loading the next page, and selecting its task with Return |
| Targeted navigation and encoding checks | 3 passed for recovery navigation, service identity, and task ID encoding |
| Local tarball assembly and extraction | Fixed lost execution permission for the non-bin native executable using existing USTAR tools; extracted arm64, assets, languages, and code signature checks passed |
| Native installed operations under a path containing spaces | Started; opened the chooser, selected a real Codex Task with Return, checked its stage, and clicked through to the matching WebUI; starting after hide returned restored; stopping removed the runtime record and preserved WebUI and preferences |

Real Core checks read an existing task through the installed Codex Adapter without creating a new
Host development task or changing task state. State changes and some lifecycle paths use targeted
fixtures. No repository-wide tests, repository-wide audit, or complete Swift suite were run.
The output `desktop-pet-build.json` records tarball path, SHA-256, signing type, platform, and asset count.
The local functional package reuses existing artwork; public signing, notarization, minimum-OS
execution, and complete real Host journeys remain unverified.
Native drag automation was not confirmed; an attempt that opened no browser tab is not a drag pass.
The final installed app visibly shows both bubble lines and restores selection after reinstall.
The test-selected historical task was cleared from pet preferences; the Task itself remains unchanged.

### Custom appearances and Codex artwork import

This turn implements the [appearance-pack design](appearance-packs_en.md), including Codex standard sprite formats 1/2 as
additionally requested. Runtime uses the common PNG player; Core, task HTTP reads, and process definitions retain their behavior.

| Check | Result and scope |
| --- | --- |
| `PetAppearanceTests` | 10 targeted checks cover static/animated packs, both Codex atlases, row mapping and timings, updates, invalid-pack preservation, path/resource limits, preferences, menu, and player replacement |
| Real WebP input | `DEV_FLOW_PET_TEST_FIXTURE` supplied the local whale-girl Codex pack; conversion and loading of its 1536×2288 WebP passed, with read-only source access |
| Atlas and path retest | Compare corresponding source/output pixels in the same color space; `./` paths work while escapes and symlinks are rejected; 3 targeted checks passed |
| Existing playback and preferences | 2 corresponding checks passed for playback changes within one clip and existing position/animation/task preferences |
| Reset confirmation text | Explicitly includes imported appearances; 4 Node checks passed for Chinese text, the pet-directory plan, Trash cleanup, and preservation on stop failure |
| Local build and install | Compilation and extracted permissions/assets/signature passed; updated and started under the existing isolated prefix containing spaces |
| Native menu operations | Imported the example PNG square and whale-girl Codex pack and saw each immediately; restart restored whale-girl; selecting the bundled character worked and retained both imported packs |

Native and Codex packs share one local folder importer. No CLI/MCP commands were added, no Codex source pet folder was changed,
and no repository-wide tests, complete Swift suite, repository-wide code audit, or public release was run.
See [DESKTOP-PETS](../../docs/DESKTOP-PETS_en.md) for usage and authoring.
