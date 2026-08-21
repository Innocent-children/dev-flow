# Feature 010: DeepSeek Explicit Graph Host

## Status

- **Feature**: `010-deepseek-explicit-graph-host`
- **Status**: Blocked
- **Change Type**: Product Feature
- **Created**: 2026-08-20
- **Baseline**: `main` at `70726d0ba59ead5496657e445b25494152e6d8f8`
- **Current Core Contract**: Core Contract 0.2 / `standard-development@1` / Schema 2
- **Target Host Product**: `dev-flow-deepseek`
- **DeepSeek Harness Compatibility Floor**: `@deepseek-ai/dsh >=0.1.0-rc.8 <0.2.0`
- **Exact Planning Evidence**: `@deepseek-ai/dsh 0.1.0-rc.8`, npm integrity `sha512-VQU5NlomrKLRgcXuOf+sxWFvqxPA8q9vMhrKPlPPXiOJEhGlGlAdiyxZvZxkCVI+v0zbhe21cY3/luLyxpSzzA==`, upstream tag `dsh-v0.1.0-rc.8` at `141eb6fef83422698aef7a981029e843e8161534`
- **Release Authority**: Not authorized
- **Current Checkpoint**: `CREDENTIAL_CORRECTED_NATIVE_RERUN_BLOCKED`; Acceptance commit
  `aa8ec9c6816fa7082cc437597cf09479943a12f7` passed CI and repeatable Preflight, while the one
  credential-corrected rerun timed out in `reject-refactor-retest` after Core reached `REFACTOR`
  revision 7; T065–T068, T072, and T075 remain incomplete

## Purpose

Add a thin, explicit-only DeepSeek Harness product for the current Dev Flow graph Core.

The product is installed into a DeepSeek Harness profile as one official profile bundle. It registers one
user-invocable, non-model-invocable `dev-flow` Skill, mounts the packaged Core through the official
local STDIO MCP client, and enforces selector authorization at the DSH tool-execution boundary.

The adapter does not own workflow state, graph transitions, completion, recovery, repository mutation,
or task persistence. Those remain authoritative in the shared Go Core.

## Feature 010 Simplification Revision — 2026-08-21

The Product Contract is unchanged. Acceptance now uses a repeatable non-model Preflight, one bounded
Native Acceptance, minimal semantic Evidence, exact-commit CI, and final Spec Kit convergence.

Product Source Identity covers only files entering the Artifact. Acceptance Harness Identity covers
the Runner, Evidence validation, Feature documents, and current PR commit. The retained Artifact may
be reused while its Product Source bytes, package SHA-256, embedded Core SHA-256, executable mode,
and version still match.

Historical failures remain evidence only:

| Stage | Failure | Product defect | Current handling |
| --- | --- | --- | --- |
| Attempt 1 | Artifact executable mode loss | no | verify retained Artifact mode |
| Attempt 2 | Recovery Turn too broad | Runner | use bounded semantic checkpoints |
| Attempt 3 | Custom Profile lacked Headless composition | Runner | use shipped `headless` Profile |
| A2 Preflight | YAML representation binding | Preflight | verify Profile bundles and working Help |
| A3 Preflight | source-workspace lockfile input | Input | use one external npm consumer |
| A4 Preflight | whole-root empty check rejected runtime cache | Preflight | verify Runner-owned paths only |

Current success and failure records are `native-acceptance.json` and
`native-acceptance-failed.json`. Attempt numbers, repeated freezes, and one-shot Preflight are not
active acceptance controls.

### Current Native Outcome

- Acceptance commit: `225bbbf9a4b1ecb36adc41b755fcae035412fd80`; CI passed.
- Repeatable Preflight passed with zero Session and zero Core Task before Artifact installation.
- `NATIVE_ACCEPTANCE_START` was recorded once.
- Native execution timed out in `design-and-tasks`; cleanup passed and
  `native-acceptance-failed.json` is retained.
- Core retained task `task-1af84eae7d3e1d04a5baac376fa1c7d5` at `IMPLEMENT` revision 4.
- No automatic retry was started.

## Native Acceptance Boundary Correction

The retained `design-and-tasks` Session has no completed `turn/end`, no unanswered Dev Flow call,
and no Workspace change. After Core committed `TASKS → IMPLEMENT` at revision 4, the Skill continued
its fresh-Action loop, so the Runner's intermediate `IMPLEMENT` stop conflicted with the Skill's
natural control flow.

Final acceptance now combines bounded design, task planning, implementation, and targeted test into
`work-to-comprehension`, where Headless must exit naturally with a completed Turn at
`COMPREHENSION_REVIEW` and wait for the developer's explicit verdict. The Product Surface and
retained Artifact are unchanged. The authorized final rerun was executed once after the correction
commit's CI and repeatable Preflight passed.

### Final Authorized Native Acceptance Rerun

- Boundary Correction commit `91df0a44f65fbad395d4e70c64a391b1d027f87b` passed exact-commit
  CI run `32461021178`.
- Repeatable non-model Preflight passed with Session 0 and Core Task 0 before Artifact installation.
- The Runner recorded `NATIVE_ACCEPTANCE_START` once and executed one final native run.
- Initial interruption reached `DESIGN` revision 2, and read-only recovery completed for the same
  Task.
- `work-to-comprehension` stopped when DSH reported Provider authentication failure for the existing
  credential; the bounded final Task remained at `DESIGN` revision 2.
- Process cleanup passed, `native-acceptance-failed.json` contains the bounded final Task, and no
  retry was started.
- Product Source, Product Surface, retained Artifact, embedded Core, and publication state are
  unchanged.

### Credential-Corrected Native Acceptance Rerun Authorization

The credential-blocked run remains frozen in Git at
`d281ae3b3fe216268c9115f83a48c46bfafd2e40`. Its Evidence retained the bounded final Task at
`DESIGN` revision 2 with a stable authentication diagnostic, passed process cleanup, and no
Workspace change. The canonical failure path is cleared only after that commit and CI preserved the
record.

The user confirmed that the DSH credential was corrected. The credential file is verified only as an
existing regular file with restrictive permissions; its content is not read or recorded. Current
authority permitted one credential-corrected Native Acceptance rerun after the new Acceptance
commit's CI and one fresh repeatable Preflight pass. Product Source, Product Surface, Runner, Skill,
retained Artifact, and embedded Core remain unchanged.

### Credential-Corrected Native Acceptance Rerun Outcome

- Acceptance commit `aa8ec9c6816fa7082cc437597cf09479943a12f7` passed exact-commit CI run
  `32462487203` and one fresh repeatable non-model Preflight.
- The Runner recorded `NATIVE_ACCEPTANCE_START` once and executed one credential-corrected native
  run.
- Task `task-300fe8988aaa26a8bd521651defd5757` advanced monotonically through
  `COMPREHENSION_REVIEW` revision 6; `work-to-comprehension` ended with a completed Turn.
- The explicit rejection committed `COMPREHENSION_REVIEW → REFACTOR` at revision 7. The
  `reject-refactor-retest` Turn then reached its bounded timeout without a completed `turn/end` and
  without an unanswered Dev Flow call.
- Process cleanup passed, the Workspace retained one bounded target-file change, and the canonical
  failure Evidence contains the bounded final Task at `REFACTOR` revision 7.
- The credential-corrected rerun was not retried. Product Source, Product Surface, Runner, Skill,
  retained Artifact, embedded Core, and publication state remain unchanged.

## Why This Is a New Feature

Feature 004 is retained as historical planning but is not an implementation baseline. It was prepared
against Core Contract 0.1, a mostly linear task model, and an earlier DSH release-candidate surface.
Since then:

- Core moved to Contract 0.2 and `standard-development@1`;
- task persistence moved to strict Schema 2;
- the Codex Skill gained graph, method-profile, node-payload, comprehension, and recovery guidance;
- DSH added profile bundles, runtime Skill registration, qualified MCP tools, automatic MCP reconnect,
  durable message-source metadata, and monotonic tool guards;
- a user-only Skill was shown to be insufficient by itself because MCP tools remain ordinary model
  tools unless execution is separately gated.

Feature 010 therefore revalidates the host from the current main branch and current official DSH
surface rather than amending the old linear-era design.

## Authority

Read in this order:

1. [Dev Flow Constitution](../../.specify/memory/constitution.md)
2. [Repository agent policy](../../AGENTS.md)
3. [Feature specification](spec.md)
4. [Implementation plan](plan.md)
5. [Research decisions](research.md)
6. [Data model](data-model.md)
7. [Normative contracts](contracts/)
8. [Implementation tasks](tasks.md)
9. [Requirements checklist](checklists/requirements.md)

The exact selector, qualified tool names, authority boundary, lifecycle, and acceptance evidence are
normative in `contracts/`.

## Scope

- Convert `packages/deepseek/` from a private placeholder into one packable DSH profile bundle.
- Use the official DSH bundle mechanism and official `dsh plugin --profile ...` lifecycle.
- Register exactly one Skill named `dev-flow`.
- Make the Skill user-invocable and unavailable to model-initiated Skill loading.
- Recognize the official whitespace-bounded `/dev-flow` token only from direct current-turn user input.
- Mount one package-relative macOS arm64 Core through the official DSH STDIO MCP client.
- Expose the six Core tools under the fixed `mcp__dev_flow__<raw-tool-name>` namespace.
- Add a monotonic execution guard that prevents every Dev Flow MCP tool from reaching transport unless
  the current open DSH turn contains an authorized direct-user selector.
- Project current Core Contract 0.2 graph actions, method profiles, payload guidance, comprehension,
  recovery, and read-before-retry behavior into the DeepSeek Skill.
- Preserve the same Dev Flow data directory used by the Codex product.
- Prove add, restart, explicit use, host restart, resume, removal, retained data, exact-artifact
  reinstall, and Codex non-interference.
- Produce one source-local, unpublished acceptance artifact.

## Non-Goals

- No Core graph, MCP tool, schema, task model, persistence, recovery, or Git-observer change.
- No second workflow state machine, transition table, payload validator, completion rule, or recovery
  classifier in JavaScript.
- No implicit Skill activation or repository-wide automatic governance.
- No selector authorization derived from previous turns, model text, plugin injections, Skill
  injections, task existence, repository claims, or adapter-persisted flags.
- No custom DSH profile editor, install hook, cache purge, or setup/remove command.
- No remote MCP, HTTP/SSE transport, Web UI, authentication, telemetry, or network service.
- No result proxy unless the direct-result compatibility gate fails and a reviewed amendment
  authorizes the minimum necessary transformation.
- No Linux, Windows, macOS x64, or universal-binary support claim.
- No cross-host takeover, task migration, Schema 1 compatibility, or historical task conversion.
- No npm publication, public Tag, GitHub Release, release promotion, or version bump.
- No generic host-adapter framework. Shared helpers may be extracted later only after stable,
  demonstrated duplication.

## Dependencies and Persistence Boundary

Feature 010 consumes the completed Core Contract 0.2 implementation and existing Schema 2 data model.
It neither changes nor migrates persistence.

The DeepSeek product uses the same data directory contract as the Codex product:

1. a valid explicit `DEV_FLOW_DATA_DIR`, when present;
2. otherwise the documented macOS default `~/Library/Application Support/dev-flow/data`.

The directory must exist before Core starts. The DeepSeek integration creates only the default
directory it owns selecting, with restrictive permissions. Removing the DSH bundle never removes,
renames, truncates, migrates, or rewrites that directory.

Core host identity remains `deepseek`. A Core declaration that `deepseek` is a recognized host is a
protocol capability, not a product-support claim. Product support begins only after this Feature's
exact-artifact native gate passes.

## DSH Compatibility Policy

DSH is a developer-preview dependency. Feature 010 uses a bounded compatibility range rather than
claiming all future release candidates:

```text
declared compatible range: >=0.1.0-rc.8 <0.2.0
exact acceptance artifact: 0.1.0-rc.8
exact upstream commit: 141eb6fef83422698aef7a981029e843e8161534
```

A later DSH artifact inside the declared range is not automatically accepted for release. It must pass
the package contract, selector guard, MCP result, add/remove/restart, and native graph journey gates
before the support matrix names it.

## Activation

```bash
export SPECIFY_INIT_DIR="$PWD"
export SPECIFY_FEATURE_DIRECTORY="$PWD/specs/010-deepseek-explicit-graph-host"
```

The Git branch does not select the active Feature.

## Workflow Gate

Before production changes:

1. mark Feature 004 as superseded by Feature 010 without rewriting its historical content;
2. run `$speckit-clarify` against this package;
3. resolve every unchecked requirement item;
4. run `$speckit-analyze`;
5. resolve every CRITICAL/HIGH and every acceptance-impacting MEDIUM finding;
6. update this Feature from `Draft` to `Ready`;
7. implement one phase or user-story checkpoint at a time.

Do not regenerate the package from templates unless an explicit amendment is approved.

## Checkpoints

| Checkpoint | Exit Condition |
| --- | --- |
| Contract freeze | Current baseline, DSH compatibility, selector, tool names, lifecycle, and non-goals are internally consistent |
| Foundation | Package layout, runtime/data selection, bundle manifest, and closed artifact allowlist pass targeted tests |
| User Story 1 | Official profile add/restart exposes one user-only Skill and six guarded tools; ordinary input reaches no Dev Flow transport |
| User Story 2 | Explicit `/dev-flow` opens or resumes `host=deepseek`, follows current graph actions, survives restart, and reaches Core `DONE` |
| User Story 3 | Official removal/restart removes contributions while preserving data, repository content, and Codex ownership; exact reinstall resumes |
| Native gate | One exact DSH and exact package artifact completes the bounded macOS arm64 journey |
| Final gate | One repository validation plus final analyze/converge reports no blocking gap |

## Release Boundary

Completion proves a source-local DeepSeek product artifact and support evidence for the exact tested
host/platform combination. It does not authorize publication.

A later Release Change must independently choose the first public DeepSeek product version, verify
registry and release assets, re-download the official artifact, and update the product support matrix.
