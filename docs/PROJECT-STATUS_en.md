# Dev Flow Project Status

[中文](PROJECT-STATUS.md) | [English](PROJECT-STATUS_en.md)

_Last reviewed: August 28, 2026._

Dev Flow is an early open-source project with real published packages and real Host journeys. This
page separates three different kinds of evidence:

1. **stable product evidence** — a registry package completed the release and Host lifecycle gates;
2. **preview/source evidence** — newer behavior exists in npm `beta` or on `main`;
3. **adoption evidence** — external users, contributors, and dependent projects.

The first two exist today. External adoption is still early and is not overstated here.

## Stable releases

`@latest` selects the stable packages below.

| Product | Stable version | Bundled Core | Verified environment |
| --- | --- | --- | --- |
| `dev-flow-codex` | `0.7.4` | `0.6.3` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | `0.7.4` | `0.6.3` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | `0.1.1` | Selected from installed Adapters | macOS arm64, Node.js `>=20` |

Stable claims come from registry-package installation, Host/Core handshake, removal, uninstallation,
and repository-unchanged gates. The DeepSeek stable journey also covers explicit activation,
restart recovery, `DONE`, and retained reopen. See the [Support Matrix](SUPPORT-MATRIX_en.md) for
exact Releases and artifact identities.

## Current source

| Product | Package version on `main` | Current capabilities |
| --- | --- | --- |
| `dev-flow-codex` | `0.7.4` | smart selection, setup, Plugin/MCP registration, and multi-repository Task Scope |
| `dev-flow-deepseek` | `0.7.4` | DSH bundle, explicit activation, and multi-repository Task Scope |
| `@imotong/dev-flow` | `0.1.1` | unified Adapter lifecycle and local Control Center launcher |

Current source also includes the shared local WebUI embedded in Core, exposed through
`dev-flow webui start|open|status|stop|reset`. Passing source tests alone does not expand platform or
Host support; public support still depends on registry-package read-back and a final Host journey.

## Evidence map

| Entry point | Question it can answer |
| --- | --- |
| [Codex multi-repository Attempt 7](../tests/journeys/codex/evidence/feature-001-multi-repository-attempt-7.json) | Can two independent Codex sessions resume the same Task from an additional repository? |
| [DeepSeek multi-repository Attempt 5](../tests/journeys/deepseek/evidence/feature-001-multi-repository-attempt-5.json) | Did a real DSH journey complete multi-repository work, restart recovery, targeted verification, comprehension, and `DONE`? |
| [PR #8](https://github.com/Innocent-children/dev-flow/pull/8) | Did a real Codex graph journey cover refactoring, retesting, comprehension acceptance, and delivery? |
| [Support Matrix](SUPPORT-MATRIX_en.md) | Which public stable packages and Host environments have final-artifact evidence? |
| [Release directory](../release/README.md) | How do maintainers build, read back, and publish immutable artifacts? |

## Current limitations

- Stable support is macOS arm64 only; there is no Linux, Windows, Intel Mac, Rosetta, or remote MCP
  claim.
- The project is young, so external Issues, pull requests, dependent projects, and long-term adoption
  evidence remain limited.
- Core is not a Host sandbox and does not intercept every Host file operation or shell command.
- There is currently no telemetry, user-defined graph, or automatic historical Task migration; the
  WebUI is local loopback only and provides no remote access.

## How to evaluate the project

1. Read the [two-minute walkthrough](DEMO_en.md) to understand the problem and user experience.
2. Read the [Support Matrix](SUPPORT-MATRIX_en.md) to separate stable support from preview behavior.
3. Open the journey evidence above to inspect the exact real-Host claims.
4. Read the [Security Policy](../SECURITY.md) and [Threat Model](THREAT-MODEL_en.md) for residual risk.
