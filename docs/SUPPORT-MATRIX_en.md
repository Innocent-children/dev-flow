# Dev Flow Support Matrix

[中文](SUPPORT-MATRIX.md) | [English](SUPPORT-MATRIX_en.md)

This page answers a narrow question: **which public package has been verified in which environment?**

A buildable source tree, a passing test, or a published beta package does not by itself expand the
stable support claim.

## Stable support

npm `@latest` currently selects these packages:

| Product | Platform | Host compatibility | Publication entry point |
| --- | --- | --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24` | Codex `>=0.147.0` | [npm](https://www.npmjs.com/package/dev-flow-codex) · [Releases](https://github.com/Innocent-children/dev-flow/releases) |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24` | DSH `>=0.1.0-rc.6` | [npm](https://www.npmjs.com/package/dev-flow-deepseek) · [Releases](https://github.com/Innocent-children/dev-flow/releases) |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` | Target operations require an installed Codex or DSH | [npm](https://www.npmjs.com/package/@imotong/dev-flow) · [Releases](https://github.com/Innocent-children/dev-flow/releases) |

Codex lifecycle evidence covers package/Core identity, installation, setup, Core handshake, removal,
uninstallation, and an unchanged repository. DeepSeek additionally covers explicit activation,
restart/resume, `DONE`, and retained reopen.

## Current source

Current source includes the shared local WebUI, embedded assets, and `dev-flow webui
start|open|status|stop|reset`.

New source capabilities or a later beta can expand the stable support claim above only after the
independent release flow, registry-byte read-back, and final Host journey.

## Not currently supported

There is no public support claim for Linux, Windows, Intel Mac, Rosetta, or remote MCP.

For current source capabilities, real journey entry points, and adoption status, read
[Project Status](PROJECT-STATUS_en.md).
