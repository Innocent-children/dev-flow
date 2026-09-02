<h1 align="center">Dev Flow</h1>

<p align="center">
  <img src=".github/assets/dev-flow-social-preview.png" width="960" alt="Dev Flow — Resume the task. Not the chat. Session 1 resumes as the same Task in Session 2 after a Host restart." />
</p>

<p align="center"><strong>Resume the same Codex or DeepSeek Harness task after an interruption, with its scope, stage, and remaining verification intact.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@imotong/dev-flow"><img src="https://img.shields.io/npm/v/%40imotong%2Fdev-flow?label=%40imotong%2Fdev-flow" alt="Dev Flow npm" /></a>
  <a href="https://github.com/Innocent-children/dev-flow/actions/workflows/ci.yml"><img src="https://github.com/Innocent-children/dev-flow/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="Apache 2.0 License" /></a>
</p>

<p align="center">
  <a href="#install">Install</a> · <a href="docs/DEMO_en.md">Two-minute demo</a> · <a href="https://dev-flow.top">Website</a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

Dev Flow keeps durable local state for long-running AI coding tasks, so an interrupted session can
continue from the same Task instead of reconstructing progress from chat history.

## What it keeps explicit

| Capability | Current behavior |
| --- | --- |
| Resume | Retains the request, current stage, records, blockers, and outcome outside chat history |
| Scope | Checks supported structured writes against the Task Plan and reconciles Task-introduced paths before testing and delivery |
| Verification | Retains the command budget, full-suite and handoff permissions, and recent repeated attempts |
| Recovery | Reads current Task and Action state before deciding whether an uncertain operation may continue or retry |
| Freshness | Invalidates test and comprehension records that no longer match changed requirements or implementation |

Codex and DeepSeek still read code, edit files, and run commands. Dev Flow owns the local Task state,
legal transitions, recovery decisions, and delivery conditions.

## Install

Current stable `@latest` artifacts support macOS arm64. See the
[Support Matrix](docs/SUPPORT-MATRIX_en.md) for exact package, Host, Node.js, source-only, and stable
coverage.

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Explicit Codex entry:

```text
$dev-flow-codex:dev-flow Fix the failed-login attempt limit and run only targeted tests.
```

Every direct DeepSeek Harness message that needs Dev Flow uses:

```text
/dev-flow Fix the failed-login attempt limit and run only targeted tests.
```

Installation, status, resume, and removal details are in the [Codex guide](docs/CODEX_en.md),
[DeepSeek guide](docs/DEEPSEEK_en.md), and [Command Reference](docs/COMMANDS_en.md).

## Support and boundaries

| Product | Stable verified environment |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

Current source also selects `win32-x64` for Windows 10/11 desktop x64 and has native Windows 11
evidence; that does not expand the stable `@latest` claim. Windows Server, 32-bit Windows, and
Windows ARM64 are not supported.

- Core observes Git read-only; it does not commit, push, merge, rebase, tag, or publish.
- File changes and command execution remain with user-authorized Codex or DeepSeek.
- Supported structured tools receive pre-write scope checks, but Core does not intercept every Host,
  Bash, external-process, or specialized-tool write and is not a shell or file-system sandbox.
- The WebUI is a local loopback single-user view and diagnostic entry, not a cloud project manager.
- Dev Flow remains early, with limited external adoption; stable support comes only from the public
  artifacts and real Host journeys listed in the Support Matrix.

## Documentation

| Topic | Reference |
| --- | --- |
| Product position, target users, and non-goals | [Product](docs/PRODUCT_en.md) |
| Interruption and resume walkthrough | [Demo](docs/DEMO_en.md) |
| Delivered, source-only, unverified, and gap status | [Project Status](docs/PROJECT-STATUS_en.md) |
| Future priorities | [Roadmap](docs/ROADMAP_en.md) |
| Core, Adapter, Store, Recovery, and protocol | [Architecture](docs/ARCHITECTURE_en.md) |
| CLI, selectors, and MCP tools | [Command Reference](docs/COMMANDS_en.md) |
| Local WebUI | [WebUI](docs/WEBUI_en.md) |
| Platforms and Hosts | [Support Matrix](docs/SUPPORT-MATRIX_en.md) |
| Documentation and source responsibilities | [Manifest](MANIFEST_en.md) |
| Security boundaries | [Security](SECURITY.md) · [Threat Model](docs/THREAT-MODEL_en.md) |
| Contributing | [Contributing](CONTRIBUTING_en.md) |

## License

[Apache License 2.0](LICENSE)
