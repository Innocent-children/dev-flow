# Dev Flow Project Status

[中文](PROJECT-STATUS.md) | [English](PROJECT-STATUS_en.md)

_Last checked: September 24, 2026._

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
| Continue after interruption | Codex, DeepSeek, Claude Code and ZCode resume the current stage and next step from the same Task |
| Scope and verification limits | TASKS retains the initial verification plan; Core counts the current Task Plan revision, accepts concretely justified TEST increases, and applies ExpectedPaths plus record invalidation |
| Testing and review scoped to the change | The Host checks current relevance before commands, full suites, test-code changes, and post-change review; a review fix receives only related targeted rechecks |
| Automatic verification brake | Retain the three most recent test attempts and pause after the third exact repetition of the same failure, same result, or same changed-path and failure loop |
| Uncertain Action recovery | Read-before-retry, Recovery assessment, Blocker, and resume |
| Pre-delivery comprehension | Comprehension follows testing; repository changes require testing again |
| Local view and diagnostics | Shared loopback WebUI through `dev-flow webui start|open|status|stop` |
| Current-source platforms | Exact `darwin-arm64` and `win32-x64` runtimes; Windows scope is Windows 10/11 desktop x64 |
| Advanced repository capability | One primary plus up to seven explicit additional repositories; every root must be prepared under its confirmed workspace mode, authorized, and verified before Task creation; same-machine relocation is available when all repositories use dedicated worktrees and atomically replaces bindings and claims |
| Host lifecycle | Unified `dev-flow` entry for Codex, DeepSeek, Claude Code and ZCode installation, diagnosis, maintenance, and removal; ZCode retains required UI actions |

Multi-repository and worktree behavior is advanced capability, not the primary user scenario. Source
presence also does not imply a corresponding end-to-end test of a stable package.

## ZCode acceptance scope

ZCode is a distinct Host Adapter in the current source, targeting Windows x64 and macOS arm64. Source and local packages do not establish a stable npm release. Automated records should distinguish Core identity and cross-Host rejection, workspace preparation and resume, unified lifecycle, final packages, MCP and Write/Edit Hook checks. Package checks are not actual ZCode-session checks.

Windows Host acceptance still requires UI plugin installation and enablement, Skill/MCP/Hook loading in a new session, planned and unplanned Write/Edit operations, Task creation and resume, and UI removal followed by session closure and confirmed cleanup. Where the client, authentication or UI operation is unavailable, record the exact unexecuted steps; an independent Core handshake is not a substitute.

Native macOS validation remains deferred: install the final package on an arm64 Mac, verify executable permissions and paths, repeat those UI, Hook and Task workflows, then check maintenance, two-stage removal and retention of unrelated configuration and Task data. Windows checks, cross-compilation and simulated macOS platform branches cannot complete this checklist. See the [ZCode guide](ZCODE_en.md) for entrypoints.

## Verification records

### 2026-09-24: Repository path failure detail

Environment: macOS arm64, Go 1.27.0. Checks used current source; no package was published and no real user data was changed.

| Check | Actual result and scope |
| --- | --- |
| Core path preflight | Targeted Application checks passed; a multi-repository plan path that omits its `key::` prefix, one that names an undeclared key, and a single-repository plan path that adds a prefix all return a zero-write `INVALID_ARGUMENT` naming `repository_path_invalid` and the exact member. One submission reported all 80 invalid work-item paths and both invalid artifact paths |
| MCP end to end | Temporary SQLite, a two-repository fixture and the real dispatch path: the plan submission returned `details[0].path=node_result.baseline.work_items[0].expected_paths[0]` with no automatic correction, and neither the Task revision nor its TaskPlan changed; the same plan with qualified paths then submitted successfully |
| Response capacity | At the current Schema maximum of 64 work items with 64 paths each and 16 artifacts, 4,112 path failure details were generated; the MCP response retained them all, matched the output Schema, and remained below the 1 MiB limit |
| Affected packages | The complete `internal/application`, `internal/mcp`, `internal/domain`, `internal/workflow` and `internal/recovery` package checks passed |

The representative entrypoint is `go test ./internal/application ./internal/mcp ./internal/domain ./internal/workflow ./internal/recovery`. These are source-level checks; no full repository suite and no real Host session were run.

### 2026-09-20: Local ZCode package on Windows

Environment: Windows x64, Node.js 24.18.0 and Go 1.27.0. Checks used current source and the final local tarball containing Core 0.18.0; no npm package was published.

| Check | Actual result and scope |
| --- | --- |
| Core and protocols | Targeted Host identity, cross-Host rejection, protocol and complete four-Host success/error examples passed; the complete `internal/mcp` and `cmd/dev-flow` package checks passed |
| Final ZCode package | After extracting the final tarball, idempotent local setup, native stdio MCP, Task creation and same-directory resume, and cross-Host rejection passed. After fixture confirmation of a plan, an in-scope Edit was allowed and an out-of-scope Write was denied; cancellation after the rejected scope request released claims, and ordinary removal retained data |
| Manager | 73 targeted checks passed; 2 targeted menu checks passed after the regression fix. In the complete manager suite, 3 existing file-symlink cases could not complete because of local `EPERM` permission restrictions and are not counted as passing |
| Builds and interface | Both Windows x64 and macOS arm64 Core targets compiled and WebUI built successfully; macOS artifacts were not executed natively |

Representative entrypoints are `go test ./internal/mcp ./cmd/dev-flow`, `node tests/zcode/verify-package.mjs <absolute-extracted-package-directory>` and `pnpm --dir packages/dev-flow test`. The final-package harness used isolated data, temporary Git repositories and fixture inputs while actually executing packaged Core, CLI and Hook code. It did not operate the real ZCode UI or run an authenticated model session. The manager's symlink restriction does not establish passing behavior, and these results are not a complete-repository or final GitHub CI pass. Actual Host and native macOS checks remain on the checklist above.

### 2026-09-20: Responsibility boundaries and failure recovery

Environment: macOS arm64, Node.js 24.19.0 and Go 1.27.0. Checks used current source; no package was published and no real user installation or data was changed.

| Check | Actual result and scope |
| --- | --- |
| Core recovery | Targeted Application/Recovery checks passed; real SQLite covered single- and multi-repository allow_once, expand_scope and accepted history in six stage/interruption/reopen/recovery/idempotence combinations; repository observations used test fixtures |
| SQLite preflight | Two real connections with a controlled commit verified one snapshot across related tables; corrupt snapshot/schema rejection, unchanged database/WAL contents and sidecar membership/size checks passed; live WAL reads may update existing shm reader marks |
| HTTP/MCP | Shared correction eligibility, HTTP field projection and rejection of missing user decisions passed; complete three-Host request/response examples, error transport and shared error examples passed revalidation |
| Host snapshots | 57 related checks passed with temporary Git repositories for three Hosts, including rejecting mixed contents when status text stays unchanged and preserving source files and index state |
| Maintenance and records | 67 maintenance, directory-deduplication, DeepSeek-record and package-dependency checks passed; 22 additional checks covered independent retries, cached Core discovery and private maintenance records |
| Publication and frontend | 66 publication checks passed using temporary artifacts and fake remotes; 7 frontend recovery checks, type checking/build, version references and three-Host generated-content consistency passed |

Native macOS process checks used an isolated Node executable with simulated STDIO arguments to verify termination and retention of processes with other arguments; they do not replace real Core/Host sessions. Windows maintenance used command simulation, not native Windows execution. No full repository suite or real publication ran, and this record does not expand stable support.

### 2026-09-19: Host responsibility changes and the local macOS Claude package

Environment: macOS arm64, Node.js 24.19.0, Go 1.27.0 and Claude Code 2.1.274. Checks used the current source and a locally built package; no npm package was published.

| Check | Actual result and scope |
| --- | --- |
| Core | Targeted userconfig, CLI, domain, application, repository, mcp and public-contract checks passed; the new configuration command reuses Core parsing for three-Host settings, defaults and principal invalid inputs |
| Manager | 54 driver, runtime, lifecycle and package-dependency checks passed; 20 menu, Windows-interface and local-package checks passed, with 3 native Windows checks skipped; 4 configuration-bridge checks passed, including a real Core subprocess |
| Existing Adapters | 36 Codex configuration/launcher checks and 45 Codex/DeepSeek workspace regression checks passed |
| Claude workspaces | 14 passed with the default macOS temporary directory; real Core/Git covered custom primary keys for single- and three-repository creation, relocation and original-Task resume, with uppercase keys rejected before Git writes |
| Local Claude package | Both Core targets and packaging passed; isolated HOME, configuration and data were used for real CLI installation, byte-for-byte cache comparison, repeated setup, independent Core handshake, removal and unrelated-configuration retention |
| Generated content | Three-Host shared Skills, version checks, targeted generator tests and the WebUI build passed |

Windows manager maintenance was verified through Windows platform-branch simulation on macOS, not native Windows acceptance. No authenticated Claude model development session ran; plugin installation and an independent Core handshake do not establish model-driven Task completion. The complete repository suite was not run, and these results do not expand stable support.

### 2026-09-14: Windows source distribution

Artifact: the local Windows desktop distribution containing three Adapters. Environment: Windows x64, Claude Code 2.1.270, Node.js >=24 and Go 1.27.0. It is not a stable npm release.

| Check | Actual result and scope |
| --- | --- |
| Claude Adapter | 10 passed: three workspace modes, local/remote sources, staged/unstaged/untracked carry, partial multi-repository failure, replaced instances, session identity, relocation and separate cleanup authorization |
| Manager and build | 95 targeted checks passed, including native Windows Claude-only Core discovery, menus, lifecycle, orphan registration, configuration retention and source packaging |
| Shared Git operations | 48 relevant Codex/DeepSeek checks passed; LF fixtures use process-local core.autocrlf=false without changing global Git configuration |
| Core | Targeted domain/application/mcp/userconfig/CLI checks passed; public contract checks passed |
| Repository observation | Existing regression checks, 300 changed files, and SHA-1/SHA-256 raw blob comparison against Git passed; actual Task artifact collection took about 1.12 seconds within the existing 30-second deadline |
| Final Windows package | Complete desktop source package built with all three Adapters; digest readback passed, the real Claude CLI installed its package, cached files matched byte for byte, repeated setup made no changes, packaged Core handshake passed, and removal retained unrelated configuration and was repeatable |
| Documentation | Nine root README locales synchronized, all three generated Skills consistent, version and link checks passed |

Limits: no authenticated Claude model development session was executed; the local authentication status was logged out. The macOS Core was built but not executed natively. Other Windows checks reported failures in unchanged macOS pet tests and two Codex handoff path-string assertions. The passing scope in the table excludes those tests and is not a repository-wide pass. The native installation entry is tests/claude/verify-package.mjs. Its results are distinct from actual model sessions and simulated interface tests.

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
