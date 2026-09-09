<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow icon" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Keep scope, verification limits, and current progress intact across long AI coding sessions.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## What Dev Flow helps you do

Dev Flow helps you manage long AI coding tasks in Codex or DeepSeek. It saves the agreed requirements,
file scope, verification plan, progress, and results locally so you can continue after a session ends.

- **Keep scope clear:** record the intended files and check the actual changes against the plan.
- **Plan testing:** choose relevant checks and set limits on verification effort.
- **Resume work:** continue the same task and remaining work from its original worktree.
- **Inspect results:** view progress, checks, and reasons a task needs attention.

It suits repository work that spans sessions or needs explicit scope and testing limits. For one-off
questions, code explanations, and small edits that need no saved progress, using Codex or DeepSeek
directly is usually simpler.

## Quick start

> Stable npm `@latest` is currently verified on macOS arm64. Use Node.js `>=24` and install a supported
> Codex or DeepSeek Harness first. See the [Support Matrix](docs/SUPPORT-MATRIX_en.md) for Host versions
> and other environments.

### 1. Install Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Choose Codex, DeepSeek, or both in the interactive setup, then complete the installer's instructions:

- **Codex:** open `/hooks`, review the Dev Flow hook, and trust it to enable supported pre-write checks.
- **DeepSeek Harness:** restart the selected DSH Profile after installation.

### 2. Start a task

Send this message in **Codex**:

```text
$dev-flow-codex:dev-flow Add failed-login rate limiting. Change only auth files and run at most 4 targeted checks.
```

Or in **DeepSeek Harness**:

```text
/dev-flow Add failed-login rate limiting. Change only auth files and run at most 4 targeted checks.
```

Send these in the conversation, not a terminal. Describe your goal, acceptance conditions, file
scope, and testing limit.

The first reply assesses the request and asks whether to work directly or use Dev Flow. If you
choose Dev Flow, confirm the local or remote source, starting branch, new task branch, and whether
to carry existing local changes.

Work then proceeds in a dedicated Git worktree, a separate directory for the task. Codex opens it
when the Host supports that operation; DeepSeek provides a command to restart from the new directory.

### 3. Resume and view progress

After a session restart, return to the task's original worktree and ask to continue it. Dev Flow
resumes from the saved progress. If that worktree is missing or replaced, the task pauses until you
restore it or explicitly abandon the task.

In DeepSeek Harness, include `/dev-flow` in the message asking to resume.

```bash
# Inspect installed integrations
dev-flow status --host all

# Open the local task view
dev-flow webui start
```

For non-interactive installation, custom DSH Profiles, upgrades, repair, and removal, see the
[Command Reference](docs/COMMANDS_en.md).

## Desktop pet

The desktop pet shows a selected task's saved state and opens its WebUI. You can choose tasks,
customize its appearance, control animations, resize it, and start or stop it independently. Complete
the installation and Codex or DeepSeek setup above before using it.

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

- **Usage:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Project:** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md)
- **Development and contributions:** [Documentation index](MANIFEST_en.md) · [Contributing](CONTRIBUTING.md)

## License

[Apache License 2.0](LICENSE)
