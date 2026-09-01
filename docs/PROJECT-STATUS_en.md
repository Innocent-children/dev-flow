# Dev Flow Project Status

[中文](PROJECT-STATUS.md) | [English](PROJECT-STATUS_en.md)

_Last reviewed: September 1, 2026._

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
uninstallation, and an unchanged target repository. The DeepSeek stable journey also covers explicit
activation, restart recovery, `DONE`, and reopen with retained data. See the
[Support Matrix](SUPPORT-MATRIX_en.md) for exact Releases and artifacts.

## Current source and preview capability

The following capabilities exist on current `main`; some may be beta-only or source-only:

| User-visible capability | Current content |
| --- | --- |
| Durable Task | Locally retain request, scope, current stage, verification budget, records, blockers, and outcome |
| Continue after interruption | Codex and DeepSeek resume the current stage and next step from the same Task |
| Scope and verification limits | Explicit Repository Scope, verification budget, and record invalidation |
| Automatic verification brake | Retain the three most recent test attempts and pause after the third exact repetition of the same failure, same result, or same changed-path and failure loop |
| Uncertain Action recovery | Read-before-retry, Recovery assessment, Blocker, and resume |
| Pre-delivery comprehension | Comprehension follows testing; repository changes require testing again |
| Local view and diagnostics | Shared loopback WebUI through `dev-flow webui start|open|status|stop|reset` |
| Advanced repository capability | One primary plus up to seven explicit additional repositories; Codex may dispatch isolated worktree Tasks when the Host supports it |
| Host lifecycle | Unified `dev-flow` entry for Codex and DeepSeek installation, diagnosis, maintenance, and removal |

Multi-repository and worktree behavior is advanced capability, not the primary user scenario. Source
presence also does not imply a corresponding stable final-artifact journey.

## Not yet verified

- Linux, Windows, Intel Mac, Rosetta, and remote MCP have no stable support claim;
- Codex explicit parallel batches and worktree dispatch after `ACTIVE_TASK_CONFLICT` do not yet have
  a final-artifact journey;
- external usage has not established that the verification budget reduces unnecessary testing;
- no real-Host journey or external usage data has established the automatic brake's false-block rate;
- long-term project data has not established that the comprehension gate reduces maintenance cost or
  defects;
- external adoption, repeated long-term use, and dependent projects remain limited.

## Current record map

| Entry point | Question it can answer |
| --- | --- |
| [Codex multi-repository Attempt 7](../tests/journeys/codex/evidence/feature-001-multi-repository-attempt-7.json) | Can two independent Codex sessions resume the same Task from an additional repository? |
| [DeepSeek multi-repository Attempt 5](../tests/journeys/deepseek/evidence/feature-001-multi-repository-attempt-5.json) | Did a real DSH journey complete multi-repository work, restart recovery, targeted verification, comprehension, and `DONE`? |
| [PR #8](https://github.com/Innocent-children/dev-flow/pull/8) | Did a real Codex graph journey cover refactoring, retesting, comprehension, and delivery? |
| [Support Matrix](SUPPORT-MATRIX_en.md) | Which public stable packages and Host environments completed final-artifact validation? |
| [Release directory](../release/README.md) | How do maintainers build, read back, and publish artifacts? |

These records cover independent scopes. They must not be combined into a claim that one run proved
the entire product.

## External adoption status

Public Issues, external pull requests, dependent projects, and long-term repeat-use records remain
scarce. npm downloads, repository test counts, and maintainer-owned journeys do not by themselves
show sustained external use or outcomes. Current material establishes package availability and the
specific Host journeys listed above, not defect-rate, verification-cost, or long-term-maintenance
results.

## Current product gaps

- Internal state still needs a shorter, more direct user summary;
- Recovery needs a more direct public fault-injection demonstration;
- external usage has not established that the verification budget reduces unnecessary testing;
- recovery time, automatic-brake false-block rate, and repeat-use rate have not been measured;
- verification-budget consumption and the reason for expansion are not yet clear enough;
- multi-repository and worktree behavior is advanced capability, not the primary user scenario;
- external Issues, pull requests, dependent projects, and long-term adoption remain limited.

These are evaluation directions, not delivered capabilities. See the [Roadmap](ROADMAP_en.md) for
priority.

## Current limitations

- Core is not a Host sandbox and does not intercept every file operation or shell command;
- Core observes Git read-only and does not commit, push, merge, rebase, tag, or publish;
- there is no telemetry, user-defined graph, or automatic historical Task migration;
- the WebUI is local loopback only, with no remote access or multi-user permissions;
- stable support is only what the [Support Matrix](SUPPORT-MATRIX_en.md) lists.

## How to evaluate the project

1. Read the [interruption-and-resume demo](DEMO_en.md) to see whether the primary problem fits your
   work.
2. Read the [Support Matrix](SUPPORT-MATRIX_en.md) to distinguish stable support from source capability.
3. Open the real journeys above when you need the exact scope of a record.
4. Read the [Security Policy](../SECURITY.md) and [Threat Model](THREAT-MODEL_en.md) for residual risk.
