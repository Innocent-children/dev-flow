# Toolchain Compatibility Policy

[中文](TOOLCHAIN-BASELINES.md) | [English](TOOLCHAIN-BASELINES_en.md)

This page describes repository development, build and Host compatibility requirements. Minimum versions and compatible major-version ranges determine availability; lockfiles, build logs and release records retain actual resolved versions. Workflow configuration selects CI versions. Pinning a build tool does not imply rejection of other compatible patch releases.

## Development toolchain

| Tool | Requirement | Maintained location |
| --- | --- | --- |
| Go | `>=1.26`; use a supported stable version | `go.mod` declares the language floor and `go.sum` records dependencies; avoid an exact toolchain patch unless required |
| Node.js | Repository development and Host Adapters use `>=24` within official support | Relevant `package.json` files declare ranges; CI configuration chooses execution versions |
| pnpm | `>=11 <12` | Root `package.json` declares the range and `pnpm-lock.yaml` records actual dependencies |

Node.js handles package tooling and Host integration; Go Core supplies the shared Task runtime. See the [Support Matrix](SUPPORT-MATRIX_en.md) for public-package environments rather than deriving stable support from repository tooling.

## Platform builds and native validation

Builds target two exact runtime pairs: Go `darwin/arm64` maps to Node `darwin-arm64`, and Go `windows/amd64` maps to Node `win32-x64`. npm `os` and `cpu` metadata only prefilter independently; runtime selection checks the actual pair.

`scripts/build-core-runtimes.mjs` builds both runtimes and reports artifact paths, GOOS, GOARCH, Core version, size and SHA-256. Local packaging and release staging build outside the repository; source packages retain no precompiled Core.

Native macOS and Windows checks run separately. Cross-compilation establishes buildability, not execution in the target OS or actual Host. A Windows CI runner does not establish Windows Server support. See [Scripts](../scripts/README_en.md) for check entry points and [Release](../release/README.md) for publication requirements.

## Core dependencies

| Dependency | Compatible range and purpose |
| --- | --- |
| `github.com/modelcontextprotocol/go-sdk` | `>=v1.7.0 <v2.0.0`; local STDIO Tools integration |
| `modernc.org/sqlite` | `v1`; SQLite through `database/sql` without CGo |

Select stable dependencies within these ranges that support the minimum Go version, and record actual versions in `go.mod` and `go.sum`. Runtime compatibility does not require an exact SDK or driver patch. Current Core interfaces define Dev Flow tools, fields and behavior; additional SDK capabilities do not automatically become product features.

## Host compatibility and revalidation

Host technical documentation and package configuration record minimum versions and compatible ranges; validation records retain the actual Codex or DSH version used. A compatible patch or minor release alone is not a reason to reject startup. Incompatible interface changes require updates to affected implementations, version ranges, technical references and targeted checks.

Toolchain or Host dependency changes should state the current range, tested version, reason, affected interfaces and behavior, relevant source and checks, and whether a real Host workflow needs revalidation. Checks follow the affected scope without adding unrelated product functionality.

## Desktop pet builds

Local macOS arm64 builds require Node.js `>=24` and Xcode command-line tools supplying Swift `>=6.0`. The Swift Package and app metadata target macOS 14; minimum-system execution remains unverified. The builder assembles artwork, retains executable permissions and signs ad hoc; installed execution does not require Swift/Xcode.

Windows x64 desktop builds require Node.js `>=24`, with Electron and artwork dependencies locked in `packages/desktop-pet/windows/package-lock.json`. These dependencies belong only to the Windows desktop package. See the [desktop pet guide](DESKTOP-PETS_en.md) for build steps.
