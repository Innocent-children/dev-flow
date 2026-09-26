# TaskBelay Support Matrix

[中文](SUPPORT-MATRIX.md) | [English](SUPPORT-MATRIX_en.md)

This page lists public packages, verified environments, and checks that remain open.

A buildable source tree, a passing test, or a published beta package does not by itself expand the
stable support claim.

## Publication and verification

The table lists published packages and the environments checked for their components. The checks and remaining workflow validation are described below; see the Host guides for installation and activation.

| TaskBelay package name | Platform | Host compatibility | Publication entry point |
| --- | --- | --- | --- |
| `taskbelay-codex` | macOS arm64, Node.js `>=24` | Codex `>=0.147.0` | [npm](https://www.npmjs.com/package/taskbelay-codex) · [Releases](https://github.com/Innocent-children/taskbelay/releases) |
| `taskbelay-deepseek` | macOS arm64, Node.js `>=24` | DSH `>=0.1.0-rc.6` | [npm](https://www.npmjs.com/package/taskbelay-deepseek) · [Releases](https://github.com/Innocent-children/taskbelay/releases) |
| `taskbelay` | macOS arm64, Node.js `>=20` | Target operations require an installed Codex or DSH | [npm](https://www.npmjs.com/package/taskbelay) · [Releases](https://github.com/Innocent-children/taskbelay/releases) |

Codex lifecycle test results covers package/Core identity, installation, setup, Core handshake, removal,
uninstallation, and an unchanged repository. DeepSeek additionally covers explicit activation,
restart/resume, `DONE`, and retained reopen.

## Current source

Current source includes the shared local WebUI, embedded assets, and `taskbelay webui
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

### Claude Code

`taskbelay-claude` is published. This section records component checks; complete model-driven development sessions remain unverified, so it does not expand the stable support claim above.

| Platform | Implementation target and build | Native verification | Unverified |
| --- | --- | --- | --- |
| Windows x64 | Corresponding Core and Claude Adapter included | Claude CLI plugin installation, cache comparison and repeatable setup/removal; independent stdio handshake with packaged Core | Authenticated model development sessions and complete model-driven workflows |
| macOS arm64 | Local Adapter package built with Core for both platforms | Claude CLI plugin installation, byte-for-byte cache comparison, repeatable setup/removal and independent packaged Core handshake; single- and multi-repository creation, relocation and resume with real Core/Git | Authenticated model development sessions and complete model-driven workflows |

The native Windows record describes the 2026-09-14 artifact. The 2026-09-19 manager maintenance changes were checked through Windows platform-branch simulation on macOS, without a new native Windows run. Native macOS checks used Claude Code 2.1.274 and did not cover the final package downloaded and installed from npm.

The 2026-09-20 responsibility and recovery changes passed targeted source checks. macOS termination used isolated test processes; Windows remained command simulation. That run did not repeat real Claude installation or model sessions and does not replace the artifact verification above; see the [verification record](PROJECT-STATUS_en.md).

The Adapter requires Node.js `>=24` and Claude Code `>=2.1.270`. See the [Claude guide](CLAUDE_en.md) for installation and [verification records](PROJECT-STATUS_en.md) for dates, check entry points and other limits. An independent Core handshake does not establish that a model invoked plugin tools.

### ZCode

`taskbelay-zcode` is published. The Adapter requires Node.js `>=24`, Git and ZCode with native plugins, Skills, MCP and Hooks. The checks below do not expand the stable support claim above.

| Platform | Current implementation target | Verification boundary |
| --- | --- | --- |
| Windows x64 | Self-contained plugin, packaged Core, unified lifecycle, Write/Edit Hook and workspace operations | Automated package checks, actual ZCode UI and authenticated model sessions are recorded separately and cannot substitute for one another |
| macOS arm64 | The same plugin with the corresponding Core and macOS path/process implementations | Native macOS validation was not performed for this adaptation; cross-builds and static checks do not establish native acceptance |

Successful local preparation still returns `action_required`. Follow the returned steps for ZCode installation, enablement, cache refresh and removal; there is no automatic Host-readiness claim. See the [ZCode guide](ZCODE_en.md) for installation and two-stage removal, and [project status](PROJECT-STATUS_en.md) for actual results and the remaining native acceptance checklist.

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

Desktop packages target macOS arm64 and Windows 10/11 x64. macOS deployment metadata targets macOS 14; this is a build target, not proof of minimum-system execution. Current formal preparation includes both platform applications and default artwork in the `taskbelay` npm package. A configured Adapter provides Core. Preparation alone does not establish a published or verified stable package.

Historical desktop validation records are available through Git history. Windows environment, procedures and results are recorded in the [Windows report](WINDOWS-ADAPTATION_en.md). These local results do not expand the stable table above. Installation and artwork instructions belong in the [desktop pet guide](DESKTOP-PETS_en.md).

## Source DSH requirement

The source DeepSeek Adapter requires DSH `>=0.1.2-rc.1`. This source requirement does not replace the stable-package environment listed above.
