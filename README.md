<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow icon" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Keep scope, verification limits, and current progress intact across long AI coding sessions.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Keep long tasks from drifting

A long coding task can gradually change shape: more files enter the change, targeted checks grow into
open-ended testing, the same failure triggers another similar attempt, or a restarted session has to
reconstruct progress from chat history.

Dev Flow keeps the agreed request, expected paths, post-analysis verification plan, current stage, and results in
one local task while Codex or DeepSeek does the coding work.

Every new request is assessed read-only before Dev Flow is selected. If you choose it, you confirm a
remote, base branch, and new task branch; the Host fetches that base and creates a clean dedicated
worktree before Core creates the Task. Changes in the source checkout are not copied into that worktree.

Repository discovery and code-index use follow the current user instructions and applicable `AGENTS.md`.
When those instructions require a project index, the Host inspects candidate repositories read-only
before confirmation, then fixes the confirmed scope in the Task. Those instructions take precedence
over the plugin's code-index preference.

- **Scope stays explicit.** Expected paths are recorded, supported structured writes outside the plan
  ask first, and actual changes are checked again before testing and delivery.
- **The workspace has one owner.** Core derives the Task's actual changes from Git inside the dedicated
  worktree; normal linear commits preserve those changes, while branch rewrites and replacement worktrees stop.
- **Testing matches the task.** TASKS records checks, rationales, initial effort, and full-suite/test-code
  expectations. Concrete new impact, risk, failure, or gaps can increase the budget; spare capacity alone cannot.
- **Review stops at the change.** Post-change review covers the diff, causal impact, and acceptance needs;
  fixing a finding triggers only related rechecks, while explicit code review remains read-only.
- **Progress survives restarts.** A new session can resume the same task, remaining checks, and current
  decision instead of rebuilding them from the conversation.
- **Results stay current.** Changes to the request, plan, implementation, or repository retire stale
  checks; the developer reviews the actual result before delivery.
- **Completion and recovery stay verifiable.** Core requires all planned work items and links every acceptance criterion to current checks. WebUI recovers retained submissions from Core after an interruption.

## Artifact preparation

Before submitting, Codex runs `dev-flow-codex artifacts collect` and `dev-flow-codex artifacts prepare`. Core enumerates the current Action changes; Codex classifies every file and the command generates the artifact arrays. Omitted files receive exact paths and a bounded correction instruction. Workspace, history and node permissions remain enforced. See [artifact collection and submission](docs/ARTIFACTS_en.md).

## Quick start

> Stable npm `@latest` is currently verified on macOS arm64. Use Node.js `>=24` and an installed,
> supported Codex or DeepSeek Harness. See the [Support Matrix](docs/SUPPORT-MATRIX_en.md) for exact
> Host versions and other environments.

### 1. Install Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

The lifecycle menu shows installed Adapter states, supports back/exit and invalid-input retry, and opens Control Center. Plans show versions and resource paths before confirmation. `install`, `repair`, and `reinstall` keep installed versions by default; `upgrade` selects `latest`. Healthy repeated installation/repair, up-to-date upgrade, and already-completed removal require no changes; reinstall deliberately replaces the package again. `doctor` reports failed checks and recovery commands. Use `dev-flow repair --help` for options; JSON never prompts. These commands maintain Adapters; update the public launcher with `npm install -g @imotong/dev-flow@latest`.

Choose Codex, DeepSeek, or both in the interactive setup. Before starting the first task, complete the
Host-specific step printed by the installer:

- **Codex:** open `/hooks`, review the packaged Dev Flow hook, and trust it. The supported
  `apply_patch` pre-write check is inactive until the hook is trusted.
- **DeepSeek Harness:** restart the selected DSH Profile after installation.

The current source Adapter requires DSH `>=0.1.2-rc.1`; each Dev Flow operation must be authorized by the current direct user turn.

### 2. Start a task

Send this as a user message in **Codex**:

```text
$dev-flow-codex:dev-flow Add failed-login rate limiting. Change only auth files and run at most 4 targeted checks.
```

Or send this in **DeepSeek Harness**:

```text
/dev-flow Add failed-login rate limiting. Change only auth files and run at most 4 targeted checks.
```

These are conversation selectors, not shell commands. Include a concrete goal, acceptance conditions,
file boundary, and test limit. The first response assesses the likely impact and asks whether to work
directly or use Dev Flow; even an explicit selector does not skip that choice. If you choose Dev Flow,
confirm the proposed remote, base, and target branch. Codex then opens a managed worktree when its Host
supports it; DeepSeek prints a relaunch instruction because its Workspace Root is fixed for the session.

Before starting a new Codex session, the source session saves the complete relevant requirements discussion and a structured handoff, separating confirmed requirements from unaccepted suggestions and open questions. Desktop task creation and CLI relaunch use the same saved material; long content is supplied through complete files without truncation. See [the architecture](docs/ARCHITECTURE_en.md#codex-requirements-handoff).

### 3. Resume and inspect

After a session restart, explicitly ask to continue the Task in its original bound worktree. The
system checks that worktree and continues from the saved task state. It does not reassess the request
or ask you to choose Dev Flow again. If the original worktree is missing or replaced, the Task pauses
until you restore it or explicitly abandon the Task; the system does not switch to another worktree.

```bash
# Inspect installed integrations
dev-flow status --host all

# Open the local task view
dev-flow webui start
```

For non-interactive installation, custom DSH Profiles, upgrades, repair, and removal, see the
[Command Reference](docs/COMMANDS_en.md).

## Suitable tasks

Dev Flow is useful for repository work that spans sessions, needs a real file boundary, limits test
effort, or may require rework without reusing stale results.

For one-off questions, code explanations, status checks, and small mechanical edits that need no saved
progress, using Codex or DeepSeek directly is usually simpler.

## Desktop pet (macOS arm64)

The local pet package retains the default appearance. Import Whale Girl or other custom appearances as separate artwork packs; application updates preserve imported artwork.

The desktop pet is available on macOS arm64 through a local development package containing `DevFlowPet.app`; regular npm file lists and release preparation omit the native app. Running a built package requires no Swift/Xcode and uses Core from an already configured Codex or DeepSeek Adapter. It shows one Task's saved state and opens its WebUI, without inferring live Host activity or completion percentages. Quitting preserves Tasks and WebUI.

Import a static PNG or SVG, a native PNG/SVG animation pack, or a Codex format 1/2 atlas. Native packs require five task clips and may add four more; Codex-layout atlases extract nine clips and 57 frames. Dev Flow's high-resolution extension requires a separate standard-sized atlas for use in Codex. Available artwork drives idle walking, waving, and thinking, with a separate Idle activities switch and priority for task prompts. Program updates and artwork reimports are separate operations.

The menu bar uses a monochrome Dev Flow mark that adapts to the system appearance. Pet size offers six settings from 50% to 200% while keeping bubble text unchanged. The default appearance ships as a separate nine-clip pack of 312 SVG frames.

While no task is selected, the pet keeps looking for new tasks, preferring the most recently updated blocked task, then the most recently updated active task. Once selected, the watched task stays selected until you change it.

See the [desktop pet guide](docs/DESKTOP-PETS_en.md) for obtaining the app, installation, updates, triggers, limits, and troubleshooting; the support matrix defines public support.

```bash
dev-flow pet start
dev-flow pet stop
```

## Documentation

- **Use Dev Flow:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Project:** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## License

[Apache License 2.0](LICENSE)

## Windows desktop adaptation

Windows 10/11 x64 targets ordinary Intel and AMD 64-bit desktop PCs. Host path, permission, command and cleanup rules live in separate `platform/windows/` and `platform/macos/` implementations; Core retains shared platform-neutral task semantics. Windows command shims use UTF-8, and Core Git observation hides console windows. See the [adaptation report](docs/WINDOWS-ADAPTATION_en.md) for native Windows verification and its limits; this does not expand the stable package support claim.

Windows now also provides the desktop pet: task selection and status bubbles, tray menus, PNG/SVG appearances, native animations, Codex PNG/WebP atlases, nine actions, dragging, six size settings, hide/restore and independent start/stop. Build the Windows local package with `node scripts/build-desktop-pet-windows.mjs --output "C:\pet-build"`; prerequisites and installation are in the [desktop pet guide](docs/DESKTOP-PETS_en.md). Windows and macOS desktop implementations remain separate.
On Windows, resizing ends the current idle activity and resumes normal scheduling.

On Windows, existing AppData directories are resolved to their actual paths, including directory aliases exposed by packaged desktop hosts; symbolic links remain rejected.

The current Windows development distribution includes both Adapter packages and the desktop app. After installing the launcher package, use `dev-flow install --host all --yes` and `dev-flow pet start`. Repair and reinstall use the same entry, verify bundled artifact hashes, refresh the desktop app, and preserve Task data, settings and appearances.

`dev-flow-codex host-launch <operation>` reads a UTF-8 JSON object of at most 1 MiB from the stdin stream, including chunked input and multibyte characters split across chunks. Read failures, invalid UTF-8, duplicate members, invalid JSON, arrays, and null are rejected before the operation runs; errors go to stderr and successful JSON results go to stdout.
