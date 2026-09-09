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

Codex lifecycle test results covers package/Core identity, installation, setup, Core handshake, removal,
uninstallation, and an unchanged repository. DeepSeek additionally covers explicit activation,
restart/resume, `DONE`, and retained reopen.

## Current source

Current source includes the shared local WebUI, embedded assets, and `dev-flow webui
start|open|status|stop`, and supports these operating-system/CPU pairs:

| Runtime pair | Current-source scope | Verified scope |
| --- | --- | --- |
| `darwin-arm64` | macOS arm64 | Existing end-to-end tests of stable packages; current worktree features need separate tests in actual Hosts |
| `win32-x64` | Windows 10/11 desktop x64 | Native Windows 11 x64 Core/WebUI/MCP, complete Go suite, Adapter contracts, and local packaging for both platforms; no end-to-end test of the stable `@latest` package yet |

An npm manifest must list allowed operating systems and CPUs independently, so installation metadata
can admit cross-pairs. Package runtime selection accepts only the two exact pairs above and rejects
`win32-ia32`, `win32-arm64`, and `darwin-x64`. Data paths are documented in the [Command Reference](COMMANDS_en.md).

New source capabilities or a later beta can expand the stable support claim above only after the
independent release flow, downloading and checking registry package contents, and end-to-end testing of the final package in an actual Host.

## Not currently supported

There is no public support claim for Linux, Windows Server, 32-bit Windows, Windows ARM64, Intel Mac,
Rosetta, or remote MCP. The Windows runtime does not reject Server by SKU; this statement means that
Server has no validation, end-to-end testing, or product-support commitment.

For current source capabilities, actual-environment test entry points, and adoption status, read
[Project Status](PROJECT-STATUS_en.md).

## Desktop pet functional checks

| Artifact / environment | Recorded checks | Limits |
| --- | --- | --- |
| macOS arm64 local development package | App build, unpacked resources, ad-hoc signature and executable permissions; native import/selection, controls, scaling and idle activities; targeted observer, artwork and playback checks | Minimum macOS execution, complete mouse-drag automation, full Codex/DeepSeek Task sessions, Developer ID signing and notarization are not established |
| Windows 11 Intel x64 local development distribution | Core/WebUI, package assembly, native window, atlas import, singleton and stop; isolated lifecycle installation, reinstall and removal | Windows 10, AMD hardware, complete mouse-drag and sleep/wake interaction, full Codex/DeepSeek Task sessions and formal distribution signing remain unverified |

Desktop packages target macOS arm64 and Windows 10/11 x64. macOS deployment metadata targets macOS 14; this is a build target, not proof of minimum-system execution. Regular npm packages omit `DevFlowPet.app`; running a local desktop package requires a configured Adapter to supply Core.

Historical desktop validation records are available through Git history. Windows environment, procedures and results are recorded in the [Windows report](WINDOWS-ADAPTATION_en.md). These local results do not expand the stable table above. Installation and artwork instructions belong in the [desktop pet guide](DESKTOP-PETS_en.md).

## Source DSH requirement

The source DeepSeek Adapter requires DSH `>=0.1.2-rc.1`. This source requirement does not replace the stable-package environment listed above.
