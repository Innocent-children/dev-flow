# Dev Flow Project Status

[中文](PROJECT-STATUS.md) | [English](PROJECT-STATUS_en.md)

_Last reviewed: September 3, 2026._

Dev Flow remains an early open-source project. This page separates stable releases, beta or source
capabilities, unverified claims, and product gaps. A buildable source tree or passing tests do not
expand stable support automatically.

## Stable releases

npm `@latest` currently selects these stable packages:

| Product | Verified environment |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

Stable lifecycle records cover registry-package installation, Host/Core readiness, removal,
uninstallation, and an unchanged target repository. The DeepSeek stable end-to-end test also covers explicit
activation, restart recovery, `DONE`, and reopen with retained data. See the
[Support Matrix](SUPPORT-MATRIX_en.md) for exact Releases and artifacts.

## Current source and preview capability

The following capabilities exist in the current source; some may be beta-only or source-only:

| User-visible capability | Current content |
| --- | --- |
| New-request assessment | The Host performs a read-only `small|standard|large|uncertain` assessment and waits for a choice; an exact selector cannot skip it |
| Workspace selection | Default new branch in the current directory, with current-branch and dedicated-worktree alternatives; check claims, accept initial content and prepare all roots before Task creation. Targeted checks cover local Host helpers and real Core/Git/SQLite; actual Host-session end-to-end coverage remains as stated below |
| Durable Task | Locally retain request, scope, current stage, the post-analysis verification plan, current budget/usage, increase reasons, records, blockers, and outcome |
| Continue after interruption | Codex and DeepSeek resume the current stage and next step from the same Task |
| Scope and verification limits | TASKS retains the initial verification plan; Core counts the current Task Plan revision, accepts concretely justified TEST increases, and applies ExpectedPaths plus record invalidation |
| Testing and review scoped to the change | The Host checks current relevance before commands, full suites, test-code changes, and post-change review; a review fix receives only related targeted rechecks |
| Automatic verification brake | Retain the three most recent test attempts and pause after the third exact repetition of the same failure, same result, or same changed-path and failure loop |
| Uncertain Action recovery | Read-before-retry, Recovery assessment, Blocker, and resume |
| Pre-delivery comprehension | Comprehension follows testing; repository changes require testing again |
| Task experiences | Independent SQLite revisions and user supplements; explanation at comprehension review, local Markdown export with retry, and WebUI project/keyword lookup including archives |
| Local view and diagnostics | Shared loopback WebUI through `dev-flow webui start|open|status|stop` |
| Current-source platforms | Exact `darwin-arm64` and `win32-x64` runtimes; Windows scope is Windows 10/11 desktop x64 |
| Advanced repository capability | One primary plus up to seven explicit additional repositories; every root must first be isolated and authorized; same-machine relocation atomically replaces bindings and claims |
| Host lifecycle | Unified `dev-flow` entry for Codex and DeepSeek installation, diagnosis, maintenance, and removal |

Multi-repository and worktree behavior is advanced capability, not the primary user scenario. Source
presence also does not imply a corresponding end-to-end test of a stable package.

## Not yet verified

- Windows 10/11 x64 has native Core/WebUI/MCP, Adapter-contract tests, and local-package results, but not
  yet a stable `@latest` end-to-end test of the final package in an actual Host;
- Linux, Windows Server, 32-bit and ARM64 Windows, Intel Mac, Rosetta, and remote MCP have no stable
  support claim;
- request assessment before worktree creation, provisioning, same-machine relocation, and abandon are not yet present in
  a stable `@latest` end-to-end test of the final package;
- external usage has not established that the verification budget reduces unnecessary testing;
- no real-Host end-to-end test or external usage data has established the automatic brake's false-block rate;
- long-term project data has not established that the pre-delivery comprehension review reduces maintenance cost or
  defects;
- external adoption, repeated long-term use, and dependent projects remain limited.

## Current record map

| Entry point | Question it can answer |
| --- | --- |
| [PR #8](https://github.com/Innocent-children/dev-flow/pull/8) | Did a real Codex graph end-to-end test cover refactoring, retesting, comprehension, and delivery? |
| [Support Matrix](SUPPORT-MATRIX_en.md) | Which public stable packages and Host environments completed final-artifact validation? |
| [Release directory](../release/README.md) | How do maintainers build, read back, and publish artifacts? |

These records cover independent scopes. They must not be combined into a claim that one run proved
the entire product.

## External adoption status

Public Issues, external pull requests, dependent projects, and long-term repeat-use records remain
scarce. npm downloads, repository test counts, and maintainer-run end-to-end tests do not by themselves
show sustained external use or outcomes. Current material establishes package availability and the
specific Host end-to-end tests listed above, not defect-rate, verification-cost, or long-term-maintenance
results.

## Current product gaps

- Internal state still needs a shorter, more direct user summary;
- Recovery needs a more direct public fault-injection demonstration;
- external usage has not established that the verification budget reduces unnecessary testing;
- recovery time, automatic-brake false-block rate, and repeat-use rate have not been measured;
- external data does not yet establish the Host's accuracy when judging verification relevance,
  lasting test value, or causal review scope;
- external data does not yet establish change-level misclassification, provisioning recovery time,
  or relocation availability;
- multi-repository, worktree, and relocation behavior is advanced capability, not the primary user scenario;
- external Issues, pull requests, dependent projects, and long-term adoption remain limited.

These are evaluation directions, not delivered capabilities. See the [Roadmap](ROADMAP_en.md) for
priority.

## Current limitations

- Core is not a Host sandbox and does not intercept every file operation or shell command;
- Core observes Git read-only and does not commit, push, merge, rebase, tag, or publish;
- there is no telemetry or user-defined graph;
- the WebUI is local loopback only, with no remote access or multi-user permissions;
- stable support is only what the [Support Matrix](SUPPORT-MATRIX_en.md) lists.

## Evaluation method the project

1. Read the root [README](../README.md) and [Product Definition](PRODUCT_en.md) to decide whether your
   task needs explicit change scope and post-analysis verification planning.
2. Read the [interruption demo](DEMO_en.md) when continuation across sessions matters to your work.
3. Read the [Support Matrix](SUPPORT-MATRIX_en.md) to separate stable support from source capability,
   then open the real end-to-end tests above when you need the exact scope of a record.
4. Read the [Security Policy](../SECURITY.md) and [Threat Model](THREAT-MODEL_en.md) for residual risk.

## Source DSH requirement

The source DeepSeek Adapter requires DSH `>=0.1.2-rc.1`. This requirement describes source compatibility; stable-package validation remains listed separately in the [Support Matrix](SUPPORT-MATRIX_en.md).

## Task experience verification (September 15, 2026)

Environment: macOS arm64, Go 1.27.0, Node.js 24.19.0. These are September 15 results, before collection was concentrated at understanding review. They do not validate the new trigger below or establish a new stable release.

| Check | Observed result and scope |
| --- | --- |
| `go test ./internal/domain ./internal/store ./internal/application ./internal/experienceexport ./internal/mcp ./internal/webui ./tests/contract` | Passed. SQLite reopen, retained revisions/supplements, request retries, unchanged Task/Action, completion and recovery export, corruption rejection, and shared MCP/WebUI data |
| Export filesystem tests | Passed complete replacement, failure cleanup and repository-directory rejection; a temporary real Git repository kept the same status and file bytes |
| WebUI build and component/API tests | Build passed; 9 tests passed, including stable supplement request identity and uncertain-response retry |
| Codex/DeepSeek adapter and shared-reference tests | 25 tests passed; generated successful and failed MCP examples execute against Core and SQLite with fixed repository observations for both Hosts |
| Package manifests and archive contents | 4 targeted package checks passed. Both source archives contained all 6 new reference files with identical bytes; this is a source archive check, not a final runtime-package or installed Host test |
| Local browser | With a separate simulated archived task, verified keyword lookup, history, supplement saving, unchanged Task revision, and cancelled-task Markdown export |
| Versions and documentation | Version checks passed; maintained README locales and paired guides were synchronized; shared references regenerated and checked |

The experience feature has not been exercised as a complete task in newly installed Codex/DeepSeek packages, nor natively on Windows. Historical reasoning remains auxiliary material. Usage and limits: [Task experiences](EXPERIENCES_en.md).

## Experience collection at understanding review: verification (September 17, 2026)

Environment: macOS arm64, Go 1.27.0, Node.js 24.19.0. Current source data is separate from the original Task database. Go scenarios use temporary SQLite databases and fixed repository observations.

| Check | Observed result and scope |
| --- | --- |
| Targeted Go tests in `workflow/application/store/experienceexport` | Passed. Selected Experience, Comprehension, StandardDefinition, StandardProcess, SemanticMethodCatalog, DefinitionDigest and MethodEvidence tests cover the new step order, original complete edge set, independent saves, empty review and explicit user-verdict requirement |
| Return to implementation and save failure | Real Core/SQLite with simulated operations verifies returning to implementation, testing again and revising the same experience on reentry. Revisions, request retries and user supplements remain intact without changing the issued Action. An injected storage error is reported without changing saved experience or Task data |
| MCP, current protocol fixtures and shared examples | Complete successful/error examples, output Schema and current process digest checks passed. The first run found a generic error for a missing collection result; after adjusting method validation, the full missing-field response and zero-write correction scope passed. The optional browser fixture was not enabled |
| Host references and packaging | 22 Node checks passed, covering simulated Core, DeepSeek injection/connection, shared references and package manifests. Both Host copies were generated from the shared source; `sync-skill-references.mjs --check` passed |
| Versions | `scripts/check-versions.mjs` passed. This change retains the current feature's Core version and does not change Host npm release versions |
| Documentation and preserved work | Checks passed for 200 changed Markdown files, 409 local links and 39 preserved paths. Host references in shared sources resolve against both packaged locations. All nine READMEs and affected paired guides were synchronized |

No full repository suite was run. WebUI source and generated assets were preserved; a read-only check confirmed that the Action form renders Core's `payload_schema` and method list. The browser flow was not rerun. These checks do not establish actual AI extraction quality, a complete task in newly installed Codex/DeepSeek final runtime packages, or native Windows execution; those areas remain unverified.
