# Dev Flow Support Matrix

[中文](SUPPORT-MATRIX.md) | [English](SUPPORT-MATRIX_en.md)

This file records support established by public artifacts and final Host lifecycle evidence. A
buildable source tree, uploaded package, or passing fixture test does not independently expand the
support claim.

| Product | Public version | Bundled Core | Platform | Host compatibility | Status and evidence |
| --- | --- | --- | --- | --- | --- |
| `dev-flow-codex` | `0.5.2` | `0.5.0` | macOS arm64, Node.js `>=24` | Codex `>=0.147.0`; final Journey used `0.147.0` | [npm](https://www.npmjs.com/package/dev-flow-codex/v/0.5.2) · [codex-v0.5.2](https://github.com/Innocent-children/dev-flow/releases/tag/codex-v0.5.2) · registry lifecycle passed |
| `dev-flow-deepseek` | `0.5.1` | `0.5.0` | macOS arm64, Node.js `>=24` | DSH `>=0.1.0-rc.6`; final Journey used `0.1.0-rc.6` | [npm](https://www.npmjs.com/package/dev-flow-deepseek/v/0.5.1) · [deepseek-v0.5.1](https://github.com/Innocent-children/dev-flow/releases/tag/deepseek-v0.5.1) · native registry journey passed |

## Evidence notes

Both current Host-product Release manifests record `normal` verification, double-build, closed-package,
forbidden-content scan, and final registry-package Journey evidence. Codex evidence covers
installation, package/Core identity, setup, Core handshake, removal, uninstallation, and an
unchanged repository. DeepSeek evidence covers installation, explicit activation, restart/resume,
`DONE`, removal, uninstallation, and retained reopen.

Core, Codex, and DeepSeek are independent product identities. A Host package version may differ from
its bundled Core version. Compatibility is established through the actual executable, closed
schemas and catalogs, artifact digests, and runtime evidence.

There is currently no public support claim for Linux, Windows, Intel Mac, Rosetta, or remote MCP.
