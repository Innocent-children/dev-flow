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

## Quick start

> Stable npm `@latest` is currently verified on macOS arm64. Use Node.js `>=24` and an installed,
> supported Codex or DeepSeek Harness. See the [Support Matrix](docs/SUPPORT-MATRIX_en.md) for exact
> Host versions and other environments.

### 1. Install Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Choose Codex, DeepSeek, or both in the interactive setup. Before starting the first task, complete the
Host-specific step printed by the installer:

- **Codex:** open `/hooks`, review the packaged Dev Flow hook, and trust it. The supported
  `apply_patch` pre-write check is inactive until the hook is trusted.
- **DeepSeek Harness:** restart the selected DSH Profile after installation.

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

The macOS arm64 environment includes a desktop pet. Installing either adapter (Codex or DeepSeek) automatically provisions the prebuilt binary to `~/.dev-flow/pet/` without requiring Xcode or the Swift compiler. With at least one configured Adapter, it shows the saved stage and blocker of one selected task; clicking opens its WebUI page. The menu provides task selection, animation and visibility controls. Stages describe saved Core state, without live Host activity or completion percentages. Exiting preserves tasks and WebUI. See the [command reference](docs/COMMANDS_en.md#desktop-pet-macos-arm64); public support remains defined by the support matrix.

Import a local appearance from the pet menu: a PNG, a Dev Flow animation pack, or a Codex sprite-format 1/2 pack. Selection and imported files survive upgrades. See [appearance packs](docs/DESKTOP-PETS_en.md).

```bash
dev-flow pet start
dev-flow pet stop
```

## Documentation

- **Use Dev Flow:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Project:** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## License

[Apache License 2.0](LICENSE)
