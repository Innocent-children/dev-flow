# Dev Flow Support Matrix

[中文](SUPPORT-MATRIX.md) | [English](SUPPORT-MATRIX_en.md)

This page answers a narrow question: **which public package has been verified in which environment?**

A buildable source tree, a passing test, or a published beta package does not by itself expand the
stable support claim.

## Stable support

npm `@latest` currently selects these packages:

| Product | Public version | Bundled Core | Platform | Host compatibility | Evidence |
| --- | --- | --- | --- | --- | --- |
| `dev-flow-codex` | `0.7.0` | `0.6.0` | macOS arm64, Node.js `>=24` | Codex `>=0.147.0`; final Journey used `0.147.0` | [npm](https://www.npmjs.com/package/dev-flow-codex/v/0.7.0) · [codex-v0.7.0](https://github.com/Innocent-children/dev-flow/releases/tag/codex-v0.7.0) · registry lifecycle passed |
| `dev-flow-deepseek` | `0.7.0` | `0.6.0` | macOS arm64, Node.js `>=24` | DSH `>=0.1.0-rc.6`; final Journey used `0.1.0-rc.6` | [npm](https://www.npmjs.com/package/dev-flow-deepseek/v/0.7.0) · [deepseek-v0.7.0](https://github.com/Innocent-children/dev-flow/releases/tag/deepseek-v0.7.0) · native registry journey passed |

Codex lifecycle evidence covers package/Core identity, installation, setup, Core handshake, removal,
uninstallation, and an unchanged repository. DeepSeek additionally covers explicit activation,
restart/resume, `DONE`, and retained reopen.

## Preview and source

| Product | npm `beta` | Package version on `main` | Status |
| --- | --- | --- | --- |
| `dev-flow-codex` | `0.7.0-beta.2` | `0.7.0-beta.2` | Publicly evaluable; not a stable support claim |
| `dev-flow-deepseek` | `0.7.0-beta.1` | `0.7.0-beta.1` | Publicly evaluable; not a stable support claim |

Stable support requires the independent release flow, registry-byte read-back, and the final Host
journey. It is not established by moving an npm dist-tag alone.

## Not currently supported

There is no public support claim for Linux, Windows, Intel Mac, Rosetta, or remote MCP.

For the capabilities present in beta, real journey entry points, and adoption status, read
[Project Status](PROJECT-STATUS_en.md).
