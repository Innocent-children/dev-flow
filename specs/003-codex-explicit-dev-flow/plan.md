# Implementation Plan: Codex Explicit Dev Flow

**Branch**: `003-codex-explicit-dev-flow` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/003-codex-explicit-dev-flow/spec.md`

## Summary

Deliver the first complete local Codex product projection as one private, locally packed npm artifact for Codex CLI 0.147.x on macOS arm64. The artifact contains one Codex plugin, one explicitly invoked `$dev-flow` Skill, one STDIO MCP registration, a prebuilt Go Core executable, and small Node.js standard-library lifecycle/launch glue. The Skill delegates all task state, transition, recovery, and completion decisions to Core Contract 0.1 through exactly the six existing Core MCP tools.

The package is installed with lifecycle scripts disabled and registered only by an explicit setup command. Setup uses the supported Codex plugin and marketplace commands, records a product-owned receipt outside the target repository, and validates its result through Codex readback. Removal uses that receipt to unregister only Codex-owned resources while preserving Core task data. Contract tests consume the shared Feature 002 fixtures without copying them, and one bounded real-host journey records final-artifact evidence on the supported macOS arm64 Codex CLI surface. This feature neither publishes the package nor claims Windows, Linux, IDE, or desktop-app evidence.

## Technical Context

**Language/Version**: Go 1.26 for the existing Core executable; Node.js 24.x for package-local standard-library glue and tests
**Primary Dependencies**: Existing Go Core dependencies `github.com/modelcontextprotocol/go-sdk` and `modernc.org/sqlite`; Node.js standard library only for new product glue; Codex CLI `>=0.147.0 <0.148.0` as the validated external host
**Storage**: Existing Core SQLite database under explicit `DEV_FLOW_DATA_DIR`; default `~/Library/Application Support/dev-flow/data`; Codex registration receipt at `~/Library/Application Support/dev-flow/registrations/codex.json`
**Testing**: `go test` for the minimal embedded-version seam and shared contract checks; `node --test` for package, lifecycle, launcher, and fake-Core contracts; a bounded real Codex CLI journey using the final packed artifact
**Target Platform**: macOS arm64 with Codex CLI 0.147.x; other operating systems and Codex host surfaces are out of evidence scope
**Project Type**: Go Core plus a host-specific npm product package
**Performance Goals**: No new throughput or latency target; the projection must add no workflow polling loop or persistent runtime beyond the single inherited-stdio Core child process
**Constraints**: Exactly six Core MCP tools; Core Contract 0.1 unchanged; one Skill and one plugin; explicit `$dev-flow` invocation only; no target-repository configuration or Git mutation by setup/removal; no install lifecycle hooks; no product publication; no copied protocol fixtures; no Node workflow/projection proxy
**Scale/Scope**: One Codex product package, one local marketplace entry, one installed plugin, one MCP server, one active target repository per explicit invocation, and one bounded final-artifact real-host journey

## Constitution Check

### Pre-design gate

| Principle | Gate | Result |
|---|---|---|
| I. Self-Contained Product Scope | Every planned change traces to FR-001..FR-028 or a stated verification constraint; no product code is authorized until `tasks.md` is approved. | PASS |
| II. Single Workflow Authority | The Skill forwards Core-requested schemas and displays Core results; no JavaScript or Skill resource stores task state or selects transitions. | PASS |
| III. One State Machine, Bounded Surface | The projection exposes only the six Feature 002 MCP tools and references, rather than restating, Core Contract 0.1. | PASS |
| IV. Thin Host Adapters | Product code is limited to plugin resources, explicit lifecycle registration/removal, executable launch, and result presentation. | PASS |
| V. Recovery Before Retry | Retry handling begins with Core reads; setup/removal use readback and an ownership receipt; unknown completion is never inferred locally. | PASS |
| VI. Read-Only Repository Boundary | Setup and removal write only Codex/user product locations; Core remains read-only for Git; the real journey fingerprints the target repository. | PASS |
| VII. Evidence-Bounded Testing | Static, fake-Core, package-contract, and one real macOS arm64 host journey provide bounded evidence; no cross-platform claims are made. | PASS |
| VIII. Proven Simplicity | No production npm dependency, host abstraction, plugin framework, or protocol proxy is introduced; one direct launcher is used. | PASS |
| IX. Vertical-Slice Specifications | The work delivers the complete Codex install-to-remove journey as one host slice, with each user story independently verifiable. | PASS |
| X. Two-Host Contract Parity | Shared fixtures and Feature 002 contracts are consumed in place; the only Core edit is an internal build-version seam with no public contract change. | PASS |

No constitutional exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/003-codex-explicit-dev-flow/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── codex-plugin.md
│   ├── dev-flow-skill.md
│   ├── journey-evidence.schema.json
│   └── registration-receipt.schema.json
├── checklists/
│   ├── requirements.md
│   └── codex-product-quality.md
└── tasks.md
```

### Source code (repository root)

```text
internal/version/
├── version.go                         # package-build version injection with source-tree fallback
└── version_test.go

packages/codex/
├── package.json                       # private local product; explicit bin; no install hooks
├── README.md
├── .agents/
│   └── plugins/
│       └── marketplace.json           # one local in-package marketplace entry
├── bin/
│   └── dev-flow-codex.mjs             # setup, remove, version, and inherited-stdio Core launch
├── lib/
│   ├── lifecycle.mjs                  # Codex CLI registration/readback and receipt ownership
│   └── paths.mjs                      # package-relative runtime and user-data path resolution
├── plugin/
│   ├── .codex-plugin/
│   │   └── plugin.json
│   ├── .mcp.json
│   └── skills/
│       └── dev-flow/
│           └── SKILL.md
└── tests/
    ├── fake-core-contract.test.mjs
    ├── journey-evidence.test.mjs
    ├── journey-harness.test.mjs
    ├── launcher.test.mjs
    ├── lifecycle.test.mjs
    ├── package-contract.test.mjs
    ├── paths.test.mjs
    ├── removal-retention.test.mjs
    ├── skill-contract.test.mjs
    └── fixtures/
        ├── fake-codex.mjs
        └── fake-core.mjs

scripts/
├── build-codex-local.sh               # reproducible temp staging and local npm pack
└── run-codex-real-journey.sh           # bounded supported-host evidence orchestrator

tests/
├── contract/
│   ├── package_manifest_test.go        # Codex package boundary and lifecycle-hook policy
│   ├── fixture_contract_test.go        # shared fixture consumption/parity
│   └── repository_layout_test.go       # one real Codex product; DeepSeek remains skeleton
└── journeys/
    └── evidence/
        └── codex-macos-arm64.json      # exact final-artifact real-host record
```

**Structure Decision**: Keep the Codex product under the already reserved `packages/codex/` boundary. The package-local Node modules are direct lifecycle and path helpers, not a reusable adapter framework. Build orchestration stays under the repository's existing `scripts/` boundary, while cross-product contract checks and final journey evidence stay under `tests/`. The prebuilt executable is created only in temporary pack staging and is not committed as a repository binary.

## Phase 0: Research

Research resolves the current Codex plugin/Skill/MCP/local-marketplace contracts, host version range, lifecycle ownership, package composition, Core fixture baseline, and real-host evidence boundary. Decisions and rejected alternatives are recorded in [research.md](./research.md), with official OpenAI links accessed on 2026-08-15.

The immutable planning baseline is:

- Core Contract: `0.1`, delivered by Feature 002 on `main`.
- Core MCP catalog: six tools named in Feature 002; the Codex projection may not add aliases.
- Shared fixture set: 22 JSON files under `protocol/fixtures/`.
- Shared fixture aggregate SHA-256: `8c27bcf6be0e4e5a4bf294c67cbda8cdf281b1b2b2c53fff16206db2828dede7`.
- Feature 002 contract-document aggregate SHA-256: `8d4fdcfe87257b206ba3ffec07db25c4957f32af4d0e32fd8085fed2d25b6942`.
- Aggregate algorithm: sort repository-relative paths bytewise, render one manifest line per file as `<file-sha256><two spaces><repository-relative-path>\n`, then SHA-256 the complete manifest bytes.

These digests make the planning input auditable; they are not a new runtime compatibility gate and do not replace the fixture-level tests.

## Phase 1: Design and Contracts

### Product boundary

The local artifact stages one macOS arm64 Core executable beside the Codex plugin and exposes one `dev-flow-codex` executable. Its `mcp` subcommand resolves the package-local Core binary, requires an explicitly supplied `DEV_FLOW_DATA_DIR` to be an existing absolute canonical directory or creates only the exact documented macOS default with restrictive permissions, and inherits stdio from Core. It does not decode JSON-RPC, project results, inspect task state, or retry workflow operations.

The plugin contains one Skill and one MCP server configuration. The Skill begins with an exact explicit-invocation guard, calls `dev_flow_server_info`, opens or resumes a Core task, requests Core's next action, forwards only the closed requested arguments, applies the result, and presents Core-owned terminal outcomes. Ambiguous transport results trigger a fresh Core read before any retry. No transition catalog or completion heuristic appears in the Skill.

### Registration lifecycle

The npm artifact has no `preinstall`, `install`, `postinstall`, `prepare`, or equivalent state-changing lifecycle hook. After installation with scripts disabled, the user explicitly runs `dev-flow-codex setup`. Setup validates platform, architecture, Codex version, package/Core version alignment, executable resources, plugin shape, and Skill/MCP presence; it then uses supported `codex plugin marketplace add` and `codex plugin add --json` commands and verifies the installed identity, source, version, and enabled state through `codex plugin list --json`/marketplace readback. The runtime six-tool catalog is verified by package contracts and the Skill's `dev_flow_server_info` handshake.

Setup stores a schema-validated receipt in a product-owned user-data path. Repeated setup reads both the receipt and Codex state before reconciling an absent or complete registration. Conflicting ownership or partial unknown state fails with explicit recovery instructions rather than overwriting adjacent state.

`dev-flow-codex remove` reads the receipt and Codex state first, removes only the recorded plugin and marketplace registration through supported Codex commands, deletes only receipt-owned registration material, and leaves the shared Core data directory intact. Removing the npm artifact is a separate explicit user action after deregistration.

### Evidence layers

1. Static/package contracts validate the allowlisted artifact, one Skill, one MCP server, no lifecycle hooks, runtime version parity, and absence of duplicated fixtures or forbidden adapter authority.
2. A test-only fake Codex executable validates setup/remove argv, JSON readback, idempotency, conflicts, and owned cleanup.
3. A test-only fake Core records six-tool requests and returns shared Feature 002 fixtures to verify exact tool mapping, closed argument forwarding, full result presentation, explicit invocation rejection, and read-before-retry. Test drivers are never packaged as runtime adapter code.
4. A final packed-artifact journey runs on Codex CLI 0.147.x/macOS arm64 in a disposable repository, records exact versions and digests, performs at least two committed Core actions, restarts the host, resumes the same task/revision lineage, reaches a Core-owned terminal outcome, removes the product, proves task data survives, and proves no unintended repository mutation.

### Post-design Constitution Check

| Principle | Design evidence | Result |
|---|---|---|
| I. Self-Contained Product Scope | `tasks.md` will map every FR and buildable SC to exact paths and tests. | PASS |
| II. Single Workflow Authority | The production launcher is stdio-only and the Skill consults Core for every workflow decision. | PASS |
| III. One State Machine, Bounded Surface | `codex-plugin.md` binds to the six-tool catalog without redefining schemas or states. | PASS |
| IV. Thin Host Adapters | The only production JavaScript responsibilities are registration ownership, path validation, and Core process launch. | PASS |
| V. Recovery Before Retry | Receipt reconciliation and ambiguous-result handling are explicitly read-before-retry. | PASS |
| VI. Read-Only Repository Boundary | All setup/removal writes are outside the target repository; journey fingerprints enforce the boundary. | PASS |
| VII. Evidence-Bounded Testing | Evidence is layered and the sole native claim is the exact recorded macOS arm64 CLI journey. | PASS |
| VIII. Proven Simplicity | Node standard library and existing Core dependencies suffice; no generic host abstraction is added. | PASS |
| IX. Vertical-Slice Specifications | US1, US2, and US3 each end in an independently runnable Codex acceptance slice. | PASS |
| X. Two-Host Contract Parity | Fixture parity remains rooted in `protocol/fixtures/`; the version seam changes no Core protocol or workflow behavior. | PASS |

No post-design violation or exception is present.

## Complexity Tracking

No constitutional violation requires justification. The internal Core build-version variable is a packaging seam required for a self-contained binary: local source-tree builds retain the existing `VERSION` fallback, while packed builds inject the same repository version. It does not alter a public command, MCP schema, tool name, workflow state, transition, or recovery rule.

## Delivery Boundary

Feature 003 ends when the private local tarball passes package and fake-runtime contracts plus the bounded real Codex CLI journey. Public npm publication, release automation, signatures, Windows/Linux runtime bundles, additional Codex surfaces, DeepSeek behavior, and any change to Core Contract 0.1 remain outside this feature.
