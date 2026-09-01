<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Resume long-running coding-agent work from durable state while keeping scope, verification budget, and delivery conditions explicit.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/dev-flow-codex"><img src="https://img.shields.io/npm/v/dev-flow-codex?label=dev-flow-codex" alt="Codex npm" /></a>
  <a href="https://www.npmjs.com/package/dev-flow-deepseek"><img src="https://img.shields.io/npm/v/dev-flow-deepseek?label=dev-flow-deepseek" alt="DeepSeek npm" /></a>
  <a href="https://github.com/Innocent-children/dev-flow/actions/workflows/ci.yml"><img src="https://github.com/Innocent-children/dev-flow/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="Apache 2.0 License" /></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> · <a href="README_en.md">English</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

Dev Flow is a local process-control and recovery layer for long-running AI coding tasks. It does more
than retain progress outside chat history: a Task advances only when scope, verification budget, and
current records satisfy the next step. After an interrupted session, repository drift, or an uncertain
Action result, Codex or DeepSeek can read the same Task and receive a legal next step, Recovery
assessment, or explicit blocker.

## Have you encountered this?

A code change is implemented and only one targeted test remains. Then the session is compacted or the
Host restarts. The next session sees partial chat and the current repository, but cannot tell which
steps are complete or whether old test results still apply. It rescans, repeats changes, or skips the
remaining work.

Dev Flow stores that progress as a local Task. The next session reads the Task first and continues
from its saved stage and next step.

## Four things it manages

| Action | What Dev Flow retains and checks |
| --- | --- |
| Remember | Original request, current stage, completed verification, blockers, and outcome |
| Limit | Task Plan file scope, one-write file authorization, automatic verification-command count, repeated test loops, and permission for full suites or manual handoff |
| Decide | Which old test and comprehension records became stale after implementation changes, and whether repository state still matches the Task |
| Recover | Whether an uncertain Action should continue, be recorded, block, or retry safely |

Codex and DeepSeek still read code, edit files, and run commands. Before Codex `apply_patch` or a
structured DeepSeek file tool writes, the Host sends its target paths to Core. An unplanned path
enters `BLOCKED` so the developer can allow that exact write, revise the Task Plan, or reject it.
Core also reconciles Task-introduced paths before testing and `DONE`.

## Understand it in 30 seconds

| Using an agent directly | What Dev Flow adds |
| --- | --- |
| Progress is reconstructed after an interrupted session | Resume the same local Task |
| A local task gradually expands in scope | Ask before supported unplanned writes and reconcile actual paths before delivery |
| Targeted testing keeps expanding | Retain the verification budget |
| The same check and failure keep repeating | Pause after the third exact repetition and wait for the developer |
| A missing operation response is retried immediately | Read the current Task and Recovery state first |
| Test results are mixed with later code changes | Retain the current stage and its corresponding evidence |

## Tasks that fit

Dev Flow fits real repository work that continues across sessions, days, or Host restarts, especially
when a change needs explicit scope, targeted verification, a rework path, or a comprehension check
before delivery. One primary repository plus a small number of explicit additional repositories is
an advanced use case.

One-off questions, code explanations, status queries, and mechanical small edits that need no durable
progress are usually simpler with Codex or DeepSeek directly. Dev Flow is also not a general task
orchestrator, remote execution platform, or security sandbox.

## Relationship to other tools

| Tool | Responsibility |
| --- | --- |
| Codex / DeepSeek | Read repositories, change code, and run commands |
| OpenSpec / Spec Kit | Help organize requirements, design, and tasks |
| Dev Flow | Retain the current Task stage, scope, verification budget, recovery state, and legal next step |

OpenSpec and Spec Kit are optional methods, not Dev Flow's primary position. There is no OpenSpec /
Spec Kit artifact importer today; thinner integration remains a [future direction](docs/ROADMAP_en.md).

## Continue after an interruption

```text
Before restart
Task: auth-rate-limit
State: TEST
Revision: 5
Completed: implementation
Remaining: targeted auth test

After restart
Task: auth-rate-limit
State: TEST
Revision: 5
Next: run the remaining targeted auth test
```

On resume, the Host reads the same Task's current stage, scope, remaining verification, and recovery
state. It continues the remaining test instead of inferring progress from chat history. See the
[two-minute interruption story](docs/DEMO_en.md).

## Shortest installation path

Current stable artifacts support macOS arm64. See the
[Support Matrix](docs/SUPPORT-MATRIX_en.md) for exact Host, Node.js, and stable-package coverage.

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

After installation, use the corresponding entry from a Git repository.

Codex can select Dev Flow automatically. To enter explicitly:

```text
$dev-flow-codex:dev-flow Fix the failed-login attempt limit and run only targeted tests.
```

Every direct DeepSeek Harness user message that needs Dev Flow uses:

```text
/dev-flow Fix the failed-login attempt limit and run only targeted tests.
```

Native Host commands are diagnostic and recovery entry points. See the
[Codex guide](docs/CODEX_en.md), [DeepSeek guide](docs/DEEPSEEK_en.md), and
[Command Reference](docs/COMMANDS_en.md) for installation, status, resume, and removal details.

## Current support and boundaries

| Product | Verified environment |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

Dev Flow remains early and external adoption is limited. Current boundaries include:

- Core observes Git read-only and does not commit, push, merge, rebase, tag, or publish;
- file changes and command execution remain with user-authorized Codex or DeepSeek;
- the Host performs write-before checks only for the listed structured tools; Core does not intercept every file operation and is not a shell or file-system sandbox;
- writes made by Bash, external processes, or specialized tools may be found only by Core's Implementation/Delivery reconciliation;
- the WebUI is a local loopback single-user view and diagnostic entry, not a cloud project manager;
- stable support comes only from public artifacts and real Host journeys listed in the Support Matrix.

## Detailed documentation

| What you need | Start here |
| --- | --- |
| Product position, target users, and non-goals | [Product](docs/PRODUCT_en.md) |
| A real interruption-and-resume story | [Demo](docs/DEMO_en.md) |
| Stable, source-only, unverified, and current gaps | [Project Status](docs/PROJECT-STATUS_en.md) |
| Future priorities | [Roadmap](docs/ROADMAP_en.md) |
| Core, Adapter, Store, Recovery, and protocol | [Architecture](docs/ARCHITECTURE_en.md) |
| Complete CLI, selector, and MCP reference | [Command Reference](docs/COMMANDS_en.md) |
| Local WebUI | [WebUI](docs/WEBUI_en.md) |
| Supported platforms and Hosts | [Support Matrix](docs/SUPPORT-MATRIX_en.md) |
| Documentation and source responsibilities | [Manifest](MANIFEST_en.md) |
| Security boundaries | [Security](SECURITY.md) · [Threat Model](docs/THREAT-MODEL_en.md) |
| Contributing | [Contributing](CONTRIBUTING_en.md) |

## Local development

Repository development requires Go `>=1.26`, Node.js `>=24`, and pnpm `>=11 <12`:

```bash
pnpm install --frozen-lockfile
pnpm run validate
```

## License

[Apache License 2.0](LICENSE)
