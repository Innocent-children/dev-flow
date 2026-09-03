<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow icon" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Keep long AI coding tasks inside the change and test limits you set.</strong></p>

<p align="center">Local guardrails, durable progress, and safe recovery for Codex and DeepSeek.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@imotong/dev-flow"><img alt="npm @latest" src="https://img.shields.io/badge/npm-%40latest-CB3837?style=flat-square&logo=npm&logoColor=white" /></a>
  <a href="docs/SUPPORT-MATRIX_en.md"><img alt="Stable platform: macOS arm64" src="https://img.shields.io/badge/platform-macOS%20arm64-111827?style=flat-square&logo=apple&logoColor=white" /></a>
  <a href="LICENSE"><img alt="Apache License 2.0" src="https://img.shields.io/badge/license-Apache--2.0-3867F5?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> · <a href="docs/CODEX_en.md">Codex</a> · <a href="docs/DEEPSEEK_en.md">DeepSeek</a> · <a href="docs/WEBUI_en.md">Control Center</a> · <a href="#documentation">Documentation</a>
</p>

## Keep the task you approved

Long coding tasks rarely fail all at once. They drift: one extra file becomes three, a targeted check
turns into an open-ended test run, the same failure triggers another similar fix, or a restarted session
reconstructs progress from incomplete chat history.

Dev Flow keeps the agreed request, expected paths, verification budget, current stage, and results with
the Task on your machine. Codex or DeepSeek still reads code, edits files, and runs commands; Dev Flow
makes scope changes, repeated attempts, recovery, and delivery explicit decisions.

## What it keeps under control

| Concern | What Dev Flow does |
| --- | --- |
| **Change scope** | Records expected paths, pauses supported out-of-plan writes, and checks accumulated changed paths again before testing and completion. |
| **Verification effort** | Keeps a command budget, requires prior permission for a full suite, and pauses on the third exact repetition of the same failure or unchanged result. |
| **Durable progress** | Stores the Task outside chat history so a new session can resume the same stage, limits, records, and blockers. |
| **Current results** | Invalidates test and comprehension records when the request, plan, implementation, or repository changes. |
| **Developer sign-off** | Requires the result to be reviewed for actual changes, unnecessary complexity, and maintenance risk before delivery. |

## Quick start

> Stable npm `@latest` is currently verified on macOS arm64. Host adapters require Node.js `>=24`.
> Check the [Support Matrix](docs/SUPPORT-MATRIX_en.md) before installing on another environment.

### 1. Install and connect a Host

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

The interactive setup lets you install Dev Flow for Codex, DeepSeek, or both. It also provides the
same lifecycle operations later for status, diagnosis, upgrades, repair, and removal.

### 2. Start a bounded Task

In **Codex**, send this as a user message:

```text
$dev-flow-codex:dev-flow Add failed-login rate limiting. Change only auth files and run at most 4 targeted checks.
```

In **DeepSeek Harness**, send:

```text
/dev-flow Add failed-login rate limiting. Change only auth files and run at most 4 targeted checks.
```

These are conversation selectors, not shell commands. State the goal, acceptance conditions, file
boundary, and test limit as concretely as you can.

### 3. Resume or inspect

After a restart, return to the participating repository and use the same Host selector. Dev Flow reads
the retained Task and resumes its current stage instead of rebuilding progress from the conversation.

```bash
# Read-only Adapter status
dev-flow status --host all

# Open the local Control Center
dev-flow webui start
```

Control Center shows the current stage, planned and changed paths, check history, blockers, recovery
advice, and the next decision. It reads the same local Task data as both Host integrations.

For non-interactive setup, native Host commands, custom DeepSeek profiles, upgrades, and removal, see
the [Command Reference](docs/COMMANDS_en.md).

## How it behaves during a Task

1. **Plan the boundary.** The Task records the request, repositories, expected paths, work items, and
   verification budget.
2. **Work through the Host.** Codex or DeepSeek changes code. Supported structured file tools ask before
   writing outside the current plan.
3. **Check what really changed.** Before testing and completion, Core reconciles the Task's accumulated
   changed paths—including changes that did not pass through a pre-write check.
4. **Stop unproductive loops.** A third exact repetition pauses the Task and requires a different path or
   explicit permission to continue.
5. **Deliver current results.** Later code changes retire stale checks. Testing and developer
   comprehension must match the implementation that is actually delivered.

If an operation ends without a clear response, the integration reads the saved Action and current
repository before deciding whether a retry is safe.

## When to use it

| Use Dev Flow when… | Use the Host directly when… |
| --- | --- |
| Work may span sessions, restarts, or days | You need a one-off answer or code explanation |
| Changed files and test effort need explicit limits | The edit is small, mechanical, and needs no retained progress |
| Rework must not reuse stale results | You only want a status check or design discussion |
| Delivery needs a clear developer review | You do not need a durable Task or recovery state |

## Support

| Stable npm `@latest` product | Verified environment |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

Current source also contains the local WebUI and exact `win32-x64` runtime, but Windows does not yet
have a stable `@latest` Host journey. The [Support Matrix](docs/SUPPORT-MATRIX_en.md) is the source for
stable platform claims; [Project Status](docs/PROJECT-STATUS_en.md) separates stable releases,
source-only capability, public journeys, and current gaps.

## Boundaries

- Dev Flow is a control layer, not a coding agent. User-authorized Codex or DeepSeek performs file
  changes and commands.
- Go Core observes Git read-only. It does not commit, push, merge, rebase, tag, or publish.
- Pre-write checks cover the listed structured Host tools. Bash and external tools may write first, so
  Dev Flow is not a shell or file-system sandbox.
- Control Center listens only on local loopback for one user; it has no remote access, cloud sync, or
  team permissions.

## Documentation

- **Start here:** [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md)
- **Use Dev Flow:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Understand the system:** [Architecture](docs/ARCHITECTURE_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Roadmap](docs/ROADMAP_en.md)
- **Trust and contribute:** [Security](SECURITY.md) · [Threat Model](docs/THREAT-MODEL_en.md) · [Contributing](CONTRIBUTING_en.md)

## License

[Apache License 2.0](LICENSE)
