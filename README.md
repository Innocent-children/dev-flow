<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow icon" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Keep scope, verification limits, and current progress intact across long AI coding sessions.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## What Dev Flow helps you do

Dev Flow helps you manage long AI coding tasks in Codex, DeepSeek, Claude Code or ZCode. It saves the agreed requirements,
file scope, verification plan, progress, and results locally so you can continue after a session ends.

- **Keep scope clear:** record the intended files and check the actual changes against the plan.
- **Plan testing:** choose relevant checks and set limits on verification effort.
- **Resume work:** continue the same task and remaining work from its original directory.
- **Inspect results:** view progress, checks, and reasons a task needs attention.

It suits repository work that spans sessions or needs explicit scope and testing limits. For one-off
questions, code explanations, and small edits that need no saved progress, using Codex, DeepSeek, Claude Code or ZCode
directly is usually simpler.

## Quick start

> Use Node.js `>=24` and install the Host you intend to use. Check Host versions and validated platforms in the [Support Matrix](docs/SUPPORT-MATRIX_en.md).

### 1. Install Dev Flow

The public installation below serves the released Codex and DeepSeek integrations. For Claude Code, follow the [source installation guide](docs/CLAUDE_en.md); a source-only adapter is not installed by the older public CLI.

ZCode also uses a [source installation guide](docs/ZCODE_en.md). Local packages target Windows x64 and macOS arm64; native macOS ZCode validation remains pending.

```sh
npm install -g @imotong/dev-flow@latest
dev-flow
```

Choose your Host from the options offered by your installation entry. After setup, review and trust the Dev Flow hook in Codex `/hooks`, restart the selected DeepSeek Profile, or reload Claude plugins/start a new Claude session and review its permission prompts.

In ZCode, install and enable the plugin in Settings → Plugins, then start a new session to activate its hooks. Local preparation does not confirm that ZCode has loaded the plugin.

### 2. Start a task

After completing the appropriate installation, send one of these messages in your Host conversation:

**Codex**

```text
$dev-flow-codex:dev-flow Add failed-login rate limiting. Change only auth files and run at most 4 targeted checks.
```

**DeepSeek Harness**

```text
/dev-flow Add failed-login rate limiting. Change only auth files and run at most 4 targeted checks.
```

**Claude Code**

```text
/dev-flow-claude:dev-flow Add failed-login rate limiting. Change only auth files and run at most 4 targeted checks.
```

**ZCode**

Select `dev-flow` from the input’s `/` → Skills menu, then describe your task.

```text
Use Dev Flow to add failed-login rate limiting. Change only auth files and run at most 4 targeted checks.
```

Send these in the conversation, not a terminal. Describe your goal, acceptance conditions, file
scope, and testing limit.

The first reply assesses the request and asks whether to work directly or use Dev Flow. Choosing
Dev Flow defaults to a new task branch from the current HEAD in the current directory. Confirm the
new branch and whether existing uncommitted changes belong to the task. Your dependencies, local
configuration, files and staged state stay in place; the current session continues when it can access
all participating directories.

You can explicitly choose to use the current branch or create a dedicated Git worktree. A dedicated
worktree additionally selects a local or remote source and a starting branch. Codex opens the new
directory when supported; DeepSeek and Claude Code provide a relaunch command.

One directory supports one active Task. Local manual or external edits are also observed, and changing
branches during a Task pauses progress. Local directories and branches remain after completion;
uncommitted work must be accounted for when starting the next Task.

Before implementation, review and discuss the requirements, design, work items, expected files and verification plan. Development starts after you explicitly approve the complete plan. Revisions or expanded file scope require approval again; choosing Dev Flow or a worktree does not replace plan approval.

### 3. Resume and view progress

After a session restart, return to the task's original directory and ask to continue it. Dev Flow
resumes from the saved progress. If that directory is missing or replaced, the task pauses until you
restore it or explicitly abandon the task.

In DeepSeek Harness, include `/dev-flow` in the message asking to resume.

For Claude, reopen the original workspace and conversation and invoke `/dev-flow-claude:dev-flow` to continue the saved task.

For ZCode, reopen the original workspace, select the Dev Flow Skill and ask to continue the saved task. For a new directory, follow the returned workspace-opening instructions.

These commands use an installed global manager. For source installations, use the corresponding entry in the source guide.

```bash
# Inspect installed integrations
dev-flow status --host all

# Open the local task view
dev-flow webui start
```

For non-interactive installation, custom DSH Profiles, upgrades, repair, and removal, see the
[Command Reference](docs/COMMANDS_en.md).

## Desktop pet

The pet requires both a configured Adapter and an installed desktop application. Installing an Adapter alone does not install the desktop app.

The desktop pet shows multiple tasks in stacked bubbles and opens each task's WebUI. It prioritizes blocked tasks and automatically follows unfinished work after a task completes; you can also pin a task. Customize its appearance, control animations, resize it, and start or stop it independently.

```bash
dev-flow pet start
dev-flow pet stop
```

Desktop applications target macOS arm64 and Windows 10/11 x64. See the
[pet guide](docs/DESKTOP-PETS_en.md) for installation and controls, and the
[Support Matrix](docs/SUPPORT-MATRIX_en.md) for verified availability.

## Usage limits

A dedicated worktree separates code changes. Processes, network access, credentials, and external
services remain shared with your environment.

Completing a task does not automatically commit, push, or delete its worktree. Those operations
require your separate authorization.

## Documentation

- **Usage:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Claude Code](docs/CLAUDE_en.md) · [ZCode](docs/ZCODE_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Project:** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md)
- **Development and contributions:** [Documentation index](MANIFEST_en.md) · [Contributing](CONTRIBUTING.md)

## Community

[LINUX DO](https://linux.do/)

## License

[Apache License 2.0](LICENSE)
