# Feature 010: DeepSeek Explicit Graph Host

## Status

- **Feature**: `010-deepseek-explicit-graph-host`
- **Status**: Implementing
- **Change Type**: Product Feature
- **Created**: 2026-08-20
- **Baseline**: `main` at `70726d0ba59ead5496657e445b25494152e6d8f8`
- **Current Core Contract**: Core Contract 0.2 / `standard-development@1` / Schema 2
- **Target Host Product**: `dev-flow-deepseek`
- **DeepSeek Harness Compatibility Floor**: `@deepseek-ai/dsh >=0.1.0-rc.8 <0.2.0`
- **Exact Planning Evidence**: `@deepseek-ai/dsh 0.1.0-rc.8`, npm integrity `sha512-VQU5NlomrKLRgcXuOf+sxWFvqxPA8q9vMhrKPlPPXiOJEhGlGlAdiyxZvZxkCVI+v0zbhe21cY3/luLyxpSzzA==`, upstream tag `dsh-v0.1.0-rc.8` at `141eb6fef83422698aef7a981029e843e8161534`
- **Release Authority**: Not authorized
- **Current Checkpoint**: Phase 2 package contracts complete; implementation stops before T019

## Purpose

Add a thin, explicit-only DeepSeek Harness product for the current Dev Flow graph Core.

The product is installed into a DeepSeek Harness profile as one official profile bundle. It registers one
user-invocable, non-model-invocable `dev-flow` Skill, mounts the packaged Core through the official
local STDIO MCP client, and enforces selector authorization at the DSH tool-execution boundary.

The adapter does not own workflow state, graph transitions, completion, recovery, repository mutation,
or task persistence. Those remain authoritative in the shared Go Core.

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
