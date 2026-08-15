# Implementation Plan: DeepSeek Explicit Dev Flow

**Branch**: `004-deepseek-explicit-dev-flow` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from
`/Users/innocent-children/GoLandProjects/dev-flow/specs/004-deepseek-explicit-dev-flow/spec.md`

## Summary

Turn the existing `packages/deepseek` skeleton into one private, locally packable DeepSeek Harness
bundle named `dev-flow-deepseek`. The bundle contributes exactly one explicit-only `dev-flow` Skill
and one native local-STDIO MCP integration backed by the packaged Go Core. A small JavaScript
lifecycle launcher selects the package-relative macOS arm64 runtime, passes a closed environment,
and forwards raw STDIO; it never parses Core results or owns workflow state.

Both host products need the packaged executable to report a version without a source checkout.
Feature 003 T005/T006 are the single owners of a shared internal link-time `buildVersion` seam in
`internal/version/version_test.go` and `internal/version/version.go`, with the existing source-tree
fallback retained. Feature 004 host work may proceed in parallel, but its final Core/package build
waits for Feature 003 T006 and verifies the T005 evidence instead of reimplementing it.

Direct use of the official Harness MCP client is the only authorized result path. An early real-host
spike must prove complete authoritative results through inline, spill, and prune behavior before
user-story implementation proceeds. If that fails, implementation stops for a reviewed plan/spec
amendment; this plan does not authorize a projection proxy. The final journey also waits for an
official stable Harness release, because only `0.1.0-rc.6` was available during planning.

## Technical Context

**Language/Version**: Go 1.26 for the existing Core; ECMAScript modules on Node.js `>=24` for the
thin Harness adapter and tests; YAML and Markdown for Harness bundle/Skill resources
**Primary Dependencies**: Existing Go MCP Core plus the Feature 003-owned internal link-time
`buildVersion` seam; the official DeepSeek Harness bundle, Skill, and
MCP-client contracts compatible with the implementation-time stable `0.1.x` line; Node standard
library for launcher/tests. Exact resolved package versions belong in the lockfile and evidence.
**Storage**: Existing Core-owned SQLite database under explicit `DEV_FLOW_DATA_DIR`, otherwise
`~/Library/Application Support/dev-flow/data` on macOS; the adapter persists no state
**Testing**: Node built-in test runner for bundle/Skill/launcher/fake-Core tests; targeted Go
contract and layout tests; shell build/package verification; one separately labeled real DeepSeek
Harness journey
**Target Platform**: macOS arm64 for this feature's runtime and real-host evidence; no Windows or
Linux support claim
**Project Type**: Monorepo with one existing Go executable and two thin host product packages
**Performance Goals**: Preserve complete Core result envelopes up to the existing 1,048,576-byte
limit; do not add a network hop or adapter-side retry loop; bounded startup failure and deterministic
child shutdown
**Constraints**: Local STDIO only; exactly six Core tools and one Skill; no implicit activation;
no Core contract/state/recovery duplication; no target-repository writes by package/runtime setup;
no runtime network access; no install-time build; no publication; direct-result and stable-version
gates are mandatory
**Scale/Scope**: One existing Git worktree, one Core-owned active task per canonical repository,
one isolated Harness profile, one package artifact, and one macOS arm64 real-host journey

## Constitution Check — Pre-Design

*GATE: Evaluated before Phase 0 research. Every principle passes; no exception is requested.*

| Principle | Result | Design evidence |
|---|---|---|
| I. Self-Contained Product Scope | PASS | Work traces to FR-001–FR-028 and SC-001–SC-008; no publication or future-host work is introduced. |
| II. Single Workflow Authority | PASS | Go Core alone supplies task state, actions, claims, recovery, and outcome; the shared version seam changes identity lookup only, while adapter files contain registration and lifecycle only. |
| III. One State Machine, Bounded Surface | PASS | Existing Core state model is unchanged and the host exposes exactly the existing six tools. |
| IV. Thin Host Adapters | PASS | One Skill, bundle configuration, and raw-STDIO lifecycle launcher are the entire host layer; no proxy is authorized. |
| V. Recovery Before Retry | PASS | Skill follows Core recovery/read-back authority; uncertain mutation explicitly requires reread before retry. |
| VI. Read-Only Repository Boundary | PASS | Core remains read-only toward Git and the package writes neither package assets nor data into the target repository. |
| VII. Evidence-Bounded Testing | PASS | Targeted fake/package checks and one required macOS arm64 real-host journey are separately labeled. |
| VIII. Proven Simplicity | PASS | Direct native MCP is preferred; no new interface, configurable policy, network layer, or pre-emptive proxy is added. |
| IX. Vertical-Slice Specifications | PASS | Setup/Foundation enable three independently demonstrable stories, delivered one story phase at a time. |
| X. Two-Host Contract Parity | PASS | Public Core contracts remain unchanged; shared fixtures and Core identity are recorded and Codex non-interference is verified. |

## Evidence and Stop Gates

### Gate A — Official stable Harness availability

Planning evidence supports only `@deepseek-ai/dsh` `0.1.0-rc.6`, with a provisional engineering
range of `>=0.1.0-rc.6 <0.2.0-0`. Before the final real-host journey, record current official npm
metadata, choose the latest stable compatible Harness release, revalidate bundle/profile, Skill,
MCP, and add/remove contracts, and record the actual version/build. If no official stable release is
available, the final journey and support claim stop; an explicit specification decision is required
to change FR-003.

### Gate B — Direct authoritative result completeness

Before user-story implementation, install the smallest bundle spike into an isolated real profile
and exercise native STDIO results for small success, domain error, near-spill, spill, and compaction
prune cases, including an envelope near Core's 1,048,576-byte cap. Prove how the Skill/tool caller
retrieves complete canonical JSON and detects any preview/spill/prune marker before using authority
fields. Record observations in `evidence/direct-consumption.md`.

If any required complete result cannot be recovered through the official direct client, stop. Do
not add, scaffold, or task a projection proxy until a plan/spec amendment documents the observed
host limitation, exact transformation, minimal projection contract, new tests, and Constitution
review.

### Gate C — Core and fixture identity

At implementation start, verify the Feature 003 T005/T006 shared link-time `buildVersion` seam and its
source-tree fallback tests in `internal/version/version.go` and `internal/version/version_test.go`.
Host-specific bundle/Skill/launcher work may run before that dependency lands, but Feature 004 MUST
NOT duplicate or concurrently edit those files, and final runtime/package build is blocked on the
Feature 003 T006. At final package build, inject repository `VERSION`, then prove both `dev-flow version`
and `dev_flow_server_info` report it without a source checkout.

Record the Core source identity, product version, binary digest, and aggregate shared-fixture digest.
The planning baseline is Core source
`8d6c929339f49a102d4e3bb34c11f566a950e9fb` and shared-fixture aggregate
`8c27bcf6be0e4e5a4bf294c67cbda8cdf281b1b2b2c53fff16206db2828dede7` across 22 JSON files. Compute the latter by sorting
repository-relative JSON paths bytewise, rendering each manifest line as
`<file-sha256><two spaces><repository-relative-path>\n`, and hashing the complete manifest bytes.
A mismatch is not repaired in the adapter; re-run relevant Core contracts or stop for a Core
specification change.

### Gate D — Environment, repository, and removal boundaries

Package tests and the real journey must prove that the Core child receives only the explicit
allowlist, the launcher has no shell/listener/network behavior, all generated package/profile/test
files stay outside the target repository, and removal preserves the shared data root. If Codex is
installed, DeepSeek removal must leave Codex package selection and shared task data untouched.

## Project Structure

### Documentation (this feature)

```text
specs/004-deepseek-explicit-dev-flow/
├── README.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── deepseek-bundle.md
│   └── skill-and-mcp.md
├── checklists/
│   ├── requirements.md
│   └── deepseek-host-readiness.md
├── evidence/                       # created during implementation; no generated binaries
│   ├── direct-consumption.md
│   └── real-journey.md
└── tasks.md
```

### Source Code (repository root)

```text
cmd/dev-flow/
└── main.go                         # existing Core entry consumes version.Current(); public contract unchanged

internal/mcp/                       # existing six-tool Core server; unchanged by this feature
internal/version/
├── version.go                      # shared link-time buildVersion seam, owned by Feature 003
└── version_test.go                 # injected-version and source-tree-fallback tests, owned by 003
protocol/fixtures/                  # shared Core Contract 0.1 fixtures

packages/deepseek/
├── README.md
├── package.json                    # private bundle identity/files/dependencies; no lifecycle scripts
├── cordis.patch.yml                # one Skill provider plus one local STDIO MCP client
├── src/
│   ├── index.mjs                   # thin Harness provider/registration entry
│   ├── runtime.mjs                 # package-relative runtime and data-directory resolution
│   └── launch-core.mjs             # closed environment, raw STDIO, child lifecycle only
├── skills/
│   └── dev-flow/
│       └── SKILL.md                # explicit invocation and Core-authority loop
└── tests/
    ├── bundle.test.mjs
    ├── direct-consumption.test.mjs
    ├── fake-core.test.mjs
    ├── launch-core.test.mjs
    ├── skill.test.mjs
    └── fixtures/
        └── fake-core.mjs

scripts/
├── build-deepseek-package.sh       # stages darwin-arm64 Core and local package tarball
├── run-deepseek-real-journey.sh    # isolated profile/repository checkpoints; no publication
└── validate-repository.sh          # adds bounded DeepSeek package checks

tests/contract/
├── package_manifest_test.go        # permits only the reviewed private bundle surface
└── repository_layout_test.go       # permits only the reviewed DeepSeek package tree
```

Build output is staged in a temporary directory. The packed layout contains the executable at the
package-relative location selected by `src/runtime.mjs`; neither a binary nor a tarball is committed
under `packages/deepseek` or the feature directory.

**Structure Decision**: Extend the existing `packages/deepseek` product boundary in place and reuse
the root Go Core, shared fixtures, validation entry, and contract tests. JavaScript is limited to the
native Harness provider and child-process lifecycle because the real host is a Node package. The
only shared Core-side prerequisite is the internal Feature 003-owned link-time version seam; 004
does not duplicate it. The adapter does not create a second Go module, copy Core source, or alter
public Core contracts.

## Phase 0: Research Outcome

Research is recorded in [research.md](./research.md). It establishes the official profile bundle,
explicit Skill, native STDIO MCP, result spill/prune, subprocess environment, and add/remove
behavior available on 2026-08-15. It also records two implementation-time evidence gaps: no stable
Harness release currently exists, and static sources cannot prove complete large-result recovery in
the real host. These are explicit stop gates rather than invented APIs or a proxy assumption.

## Phase 1: Design Outcome

- [data-model.md](./data-model.md) defines package/configuration/evidence records and validates that
  no adapter-owned task state exists.
- [contracts/deepseek-bundle.md](./contracts/deepseek-bundle.md) defines the package, profile,
  runtime, environment, install/remove, and failure boundary.
- [contracts/skill-and-mcp.md](./contracts/skill-and-mcp.md) defines explicit invocation, exact tool
  exposure, authoritative result use, and recovery behavior without restating Core transitions.
- [quickstart.md](./quickstart.md) defines bounded package tests, direct-consumption gate, real-host
  journey, evidence recording, and removal checks.

## Constitution Check — Post-Design

*GATE: Re-evaluated after Phase 1 design. Every principle still passes.*

| Principle | Result | Post-design evidence |
|---|---|---|
| I. Self-Contained Product Scope | PASS | Every designed record and contract maps to current package, invocation, resume, removal, or required evidence. |
| II. Single Workflow Authority | PASS | The data model deliberately contains no adapter task/state/action/outcome entity; all such fields are opaque Core results, and the shared Core edit is version injection only. |
| III. One State Machine, Bounded Surface | PASS | The MCP contract enumerates exactly six unchanged Core tools and no generic forwarding surface. |
| IV. Thin Host Adapters | PASS | Bundle and Skill contracts limit code to registration, explicit guidance, complete-result handling, and lifecycle glue. |
| V. Recovery Before Retry | PASS | The Skill contract requires authoritative reread after uncertain mutation and prohibits blind replay. |
| VI. Read-Only Repository Boundary | PASS | Bundle and quickstart checks cover no target-repository writes and no Git mutation by Core. |
| VII. Evidence-Bounded Testing | PASS | Fake/package, direct-host spike, and final real-host evidence have distinct claims and bounded scopes. |
| VIII. Proven Simplicity | PASS | Native MCP plus one raw launcher is the minimum direct design; proxy work is absent and gated behind amendment. |
| IX. Vertical-Slice Specifications | PASS | Each user story has its own contract-observable independent test and planned phase. |
| X. Two-Host Contract Parity | PASS | Shared fixtures are the parity baseline; both packages consume the same version seam and no public schema/error/state change is planned. |

## Complexity Tracking

No Constitution violation or complexity-budget exception is requested.
