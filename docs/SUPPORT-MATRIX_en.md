# Dev Flow Support Matrix

[中文](SUPPORT-MATRIX.md) | [English](SUPPORT-MATRIX_en.md)

This page answers a narrow question: **which public package has been verified in which environment?**

A buildable source tree, a passing test, or a published beta package does not by itself expand the
stable support claim.

## Stable support

npm `@latest` currently selects these packages:

| Product | Public version | Bundled Core | Platform | Host compatibility | Evidence |
| --- | --- | --- | --- | --- | --- |
| `dev-flow-codex` | `0.7.4` | `0.6.3` | macOS arm64, Node.js `>=24` | Codex `>=0.147.0`; final Journey used `0.147.0` | [npm](https://www.npmjs.com/package/dev-flow-codex/v/0.7.4) · [codex-v0.7.4](https://github.com/Innocent-children/dev-flow/releases/tag/codex-v0.7.4) · registry lifecycle passed |
| `dev-flow-deepseek` | `0.7.4` | `0.6.3` | macOS arm64, Node.js `>=24` | DSH `>=0.1.0-rc.6`; final Journey used `0.1.0-rc.6` | [npm](https://www.npmjs.com/package/dev-flow-deepseek/v/0.7.4) · [deepseek-v0.7.4](https://github.com/Innocent-children/dev-flow/releases/tag/deepseek-v0.7.4) · native registry journey passed |
| `@imotong/dev-flow` | `0.1.1` | Selected from installed Adapters | macOS arm64, Node.js `>=20` | Target operations require an installed Codex or DSH | [npm](https://www.npmjs.com/package/@imotong/dev-flow/v/0.1.1) · [dev-flow-v0.1.1](https://github.com/Innocent-children/dev-flow/releases/tag/dev-flow-v0.1.1) · registry package smoke passed |

Codex lifecycle evidence covers package/Core identity, installation, setup, Core handshake, removal,
uninstallation, and an unchanged repository. DeepSeek additionally covers explicit activation,
restart/resume, `DONE`, and retained reopen.

## Current source

Current source includes the shared local WebUI, embedded assets, and `dev-flow webui
start|open|status|stop|reset`. The Host package versions in source match the stable versions above:

| Product | Package version on `main` | Bundled Core |
| --- | --- | --- |
| `dev-flow-codex` | `0.7.4` | `0.6.3` |
| `dev-flow-deepseek` | `0.7.4` | `0.6.3` |

New source capabilities or a later beta can expand the stable support claim above only after the
independent release flow, registry-byte read-back, and final Host journey.

## Not currently supported

There is no public support claim for Linux, Windows, Intel Mac, Rosetta, or remote MCP.

For current source capabilities, real journey entry points, and adoption status, read
[Project Status](PROJECT-STATUS_en.md).
