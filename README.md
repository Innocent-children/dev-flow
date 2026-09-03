<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Keep long AI coding tasks inside the change and test limits you set—and know when it is safe to continue.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## When a coding task starts to drift

Suppose you ask an agent:

```text
Add failed-login rate limiting. Change only authentication files and run at most 4 targeted checks.
```

The change takes longer than expected. The agent wants to edit a nearby configuration file, a focused
test keeps failing, and the session restarts before the remaining checks finish. Now you need answers
that chat history alone cannot reliably provide: Is the extra file really part of the job? How much
testing is still allowed? Is another retry useful? Which results still apply to the current code?

Dev Flow keeps those decisions with the task. The agent still reads code, edits files, and runs
commands; Dev Flow makes scope changes, extra testing, repeated attempts, and completion visible
decisions instead of quiet drift.

## What changes with Dev Flow

| Using an agent directly | With Dev Flow |
| --- | --- |
| File limits live in the prompt | Planned files are recorded; supported out-of-plan writes pause for your decision |
| “Run targeted tests” can grow into open-ended testing | Automatic checks have a fixed limit, and a full suite needs prior permission |
| The same failure can trigger another similar fix | A third exact repetition pauses and asks for a different path or explicit approval |
| A restart forces the next session to reconstruct progress | The next session continues the same work, limits, and remaining checks |
| A green test can outlive later code changes | Results that no longer match the current work are discarded before delivery |

## Why it stands out

### The task cannot quietly grow

Each piece of work records the files it expects to touch and the checks it needs. Supported structured
writes outside that plan stop before writing; you can allow that exact write once, update the plan,
or reject it. Before testing and completion, changed paths are checked again—including paths written
by tools that were not covered before the write.

### More retries must add information

Dev Flow remembers the three latest test attempts. It pauses only on exact repeated patterns: the
same failed check, the same complete result, or the same changed files followed by the same failure.
Changes to the request, plan, or implementation also retire old test and review results, so yesterday's
green check cannot approve today's code.

### Continue without guessing or blindly retrying

The task's request, plan, current stage, checks, and blockers live in local data rather than only in
the conversation. A new session can pick up the same task. If a Dev Flow operation returned no clear
result, the integration reads the saved operation and current repository before deciding whether a
retry is safe.

### The developer owns the finish line

Passing tests is necessary, but not sufficient. Before delivery, the developer reviews what changed,
unnecessary complexity, and maintenance risks, then explicitly confirms that the result can be
explained and maintained. A later code change requires testing again.

### Inspect the task locally

Current source includes a local Control Center that shows tasks across Codex and DeepSeek, current
stage, planned and changed paths, check history, repeated-attempt pauses, and the next decision. It
uses the same local data as the integrations; it is not a cloud dashboard or a second copy of task state.

## Quick start

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

```text
$dev-flow-codex:dev-flow Add failed-login rate limiting. Change only auth files and run at most 4 targeted checks.
/dev-flow Add failed-login rate limiting. Change only auth files and run at most 4 targeted checks.
```

See the [Codex guide](docs/CODEX_en.md), [DeepSeek guide](docs/DEEPSEEK_en.md), and
[Command Reference](docs/COMMANDS_en.md) for setup, status, recovery, and removal.

## Good fit / poor fit

Dev Flow is useful when a repository task may span sessions, needs a real file boundary, must limit
test effort, may require rework, or needs a clear handoff before delivery.

Using Codex or DeepSeek directly is usually simpler for one-off questions, code explanation, status
checks, and small mechanical edits that do not need retained progress. Dev Flow is not a general
project manager, remote execution service, or security sandbox.

## What is actually available

### Stable npm `@latest`

| Product | Verified environment |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

Stable lifecycle records cover package installation, readiness, removal, uninstallation, and an
unchanged target repository. The stable DeepSeek journey also covers explicit activation, restart,
completion, and reopening retained data.

### Current source and public records

- Current source includes the local WebUI, file-scope decisions, the automatic repetition brake, and
  exact `darwin-arm64` and `win32-x64` runtimes.
- Windows is source-only today: native Windows 11 evidence exists, but no stable `@latest` Host journey does.
- [PR #8](https://github.com/Innocent-children/dev-flow/pull/8) records a real Codex journey covering
  restart, refactoring, retesting, developer comprehension, delivery, and completion.

These are separate records; they do not combine into one proof of every feature.

### Limits and unproven outcomes

- External use has not yet shown that Dev Flow reduces testing cost, defect rate, or maintenance effort.
- Adoption and long-term repeat-use records remain limited.
- Linux, Windows Server, 32-bit and ARM64 Windows, Intel Mac, Rosetta, and remote MCP have no stable support claim.
- Team views, cloud synchronization, task export, and explicit cross-Host handoff remain future work.

## Boundaries

- The Go Core observes Git read-only and does not commit, push, merge, rebase, tag, or publish.
- File changes and command execution remain with user-authorized Codex or DeepSeek.
- Pre-write checks cover listed structured tools only. Bash and external tools may write first, so
  Dev Flow is not a shell or file-system sandbox.
- The WebUI is local loopback and single-user; it provides no remote access or team permissions.
- Stable support is only what the [Support Matrix](docs/SUPPORT-MATRIX_en.md) lists.

## Documentation

- [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md) · [Roadmap](docs/ROADMAP_en.md)
- [Architecture](docs/ARCHITECTURE_en.md) · [Commands](docs/COMMANDS_en.md) · [WebUI](docs/WEBUI_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md)
- [Security](SECURITY.md) · [Threat Model](docs/THREAT-MODEL_en.md) · [Manifest](MANIFEST_en.md) · [Contributing](CONTRIBUTING_en.md)

## License

[Apache License 2.0](LICENSE)
