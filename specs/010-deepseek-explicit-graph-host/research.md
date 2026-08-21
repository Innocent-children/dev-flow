# Phase 0 Research: DeepSeek Explicit Graph Host

**Feature**: `010-deepseek-explicit-graph-host`
**Research date**: 2026-08-20
**Repository baseline**: `70726d0ba59ead5496657e445b25494152e6d8f8`
**DSH source baseline**: `141eb6fef83422698aef7a981029e843e8161534`

## Outcome

The DeepSeek product can be implemented as a thin DSH bundle without changing Core. Current DSH
provides the necessary official primitives:

- profile bundle install/remove;
- runtime Skill registration and separate model/user invocation policy;
- local STDIO MCP client with qualified names;
- subprocess lifecycle and reconnect;
- immutable session events with source provenance;
- a monotonic synchronous tool guard.

The remaining material risk is not basic integration. It is explicit authorization and complete MCP
result handling. Both are closed by specific gates in this Feature.

## Decision 1 — Create Feature 010 Rather Than Reopen Feature 004

Feature 004 remains historical planning. It is not modified into the new design because it assumes:

- Core Contract 0.1;
- the pre-graph task model;
- older Codex/DeepSeek parity;
- an unavailable “stable DSH required for completion” gate;
- an older host lifecycle and launcher model.

A small status note may point from Feature 004 to Feature 010. All new requirements and evidence live
in Feature 010.

**Rejected**: editing Feature 004 in place. That would destroy the record of what was planned against
the old baseline and blur which contracts were actually reviewed.

## Decision 2 — Support a Developer-Preview DSH Baseline Explicitly

Official planning evidence identifies:

```text
package: @deepseek-ai/dsh
version: 0.1.0-rc.8
source commit: 141eb6fef83422698aef7a981029e843e8161534
status: developer preview
```

The product declares `>=0.1.0-rc.8 <0.2.0` as an engineering compatibility range, while acceptance is
bound to the exact rc.8 artifact.

Feature completion no longer waits for an unspecified future stable release. It also does not claim
that every later RC is supported without revalidation.

**Rejected**: exact patch pin as the only package declaration. It prevents compatible updates and
confuses declaration with acceptance evidence.

**Rejected**: unbounded `^0.1.0` or `*`. The host is pre-stable and compatibility-breaking changes are
expected.

## Decision 3 — Use the Official Profile Bundle Mechanism

A DSH package declares `dsh.bundle.patch`. The official CLI runs pnpm inside the selected profile and
reconciles bundle layers from installed package metadata, including path and tarball specs.

Feature 010 therefore needs one package and one patch row.

**Rejected**: copying files into DSH profile directories. It creates an unsupported owner and removal
problem.

**Rejected**: custom setup/remove scripts. DSH already owns this lifecycle.

## Decision 4 — Register One User-Only Skill

Current DSH separates `modelInvocable` from `userInvocable`. The product registers:

```text
name: dev-flow
modelInvocable: false
userInvocable: true
```

The official user invocation implementation scans only direct `source.kind=user` messages using a
whitespace-bounded `/name` token. Injected Skill content has `source.kind=skill-invocation`, so it
cannot forge a direct user gesture.

**Rejected**: model-invocable Skill with instructions saying “wait for the user.” That allows
automatic selection.

**Rejected**: a second custom slash-command namespace. `/dev-flow` already fits the official Skill
gesture.

## Decision 5 — Add a Monotonic Execution Guard

A user-only Skill does not hide or authorize MCP tools. The official MCP client registers its tools
on the ordinary DSH ToolRuntime. Prompt instructions cannot prove that a call was selected by the
user.

Use `ctx.tools.guard()` from the bundle context. It is synchronous and monotonic: a denial after the
reorderable pre-execute waterfall cannot later be converted into permission.

The guard derives authorization from the current open session turn and exact direct-user selector.
It stores nothing.

**Rejected**: prompt-only enforcement. It is advisory.

**Rejected**: adapter-persisted “active session” state. It survives beyond the user turn, creates a
second authority, and is vulnerable to restart/race errors.

**Rejected**: task existence as authorization. An existing task does not mean the user selected Dev
Flow in the current turn.

## Decision 6 — Use the Official MCP Client Directly

Use one child instance of `@deepseek-ai/dsh-mcp-client`:

```text
transport: stdio
serverName: dev_flow
command: <absolute packaged Core>
args: ["mcp", "--stdio"]
```

The official bridge qualifies names as `mcp__<serverName>__<rawName>`, owns child process lifetime,
scrubs ambient credentials, forwards cancellation, unregisters tools on disconnect, and performs
bounded reconnect.

No transport proxy or frame parser is needed.

**Rejected**: a JavaScript STDIO launcher. Current DSH already owns transport and subprocess
lifecycle; another process adds failure and signal surfaces without product value.

**Rejected**: Streamable HTTP. The product is local and needs no network listener.

## Decision 7 — Use `dev_flow` as the Fixed Namespace

`dev_flow` is valid under DSH's server-name grammar and produces readable names while preserving the
Core raw tool names.

A duplicate live namespace is a configuration error. The integration does not shadow or rename
another server.

**Rejected**: random or profile-derived namespace. It makes Skill instructions and evidence unstable.

## Decision 8 — Direct Result First, Proxy Only by Amendment

The official MCP client returns canonical tool values and rendered content. DSH may later apply
result spill or compaction policy. The product must prove complete data at the points the Skill uses
it.

Run a bounded result gate against the exact host artifact. If official retrieval preserves complete
JSON, remain direct. If it does not, stop and amend.

**Rejected**: preemptive proxy. It duplicates MCP behavior without observed need and risks becoming
another authority/data layer.

## Decision 9 — Spawn the Packaged Core and Share the Existing Data Contract

The package includes one darwin-arm64 Core. The integration resolves it from `import.meta.url`, never
from the checkout or `PATH`.

The data contract matches Codex:

- explicit valid `DEV_FLOW_DATA_DIR`;
- otherwise shared macOS default;
- existing directory before Core start;
- removal never deletes data.

The implementation is product-local with parity tests rather than a new shared adapter framework.

## Decision 10 — Keep the Adapter Thin

Allowed DeepSeek responsibilities:

- DSH registration;
- selector authorization;
- package/runtime/data resolution;
- Core MCP composition;
- Skill guidance and host-name translation;
- lifecycle/evidence projection.

Forbidden responsibilities:

- task persistence;
- graph state;
- transition selection outside Core output;
- payload validation;
- recovery classification;
- completion inference;
- Git mutation;
- verification command execution by Core;
- cross-host ownership transfer.

## Decision 11 — Preserve Independent Product Release Authority

The repository currently has version drift and root/Codex-oriented release automation. Feature 010
does not choose or publish a DeepSeek version.

Current documentation and validation are corrected so:

- Core contract version, Codex product version, and DeepSeek product release version are distinct;
- an unreleased DeepSeek source package is not a public support claim;
- the first DeepSeek release is a later explicit Release Change.

## Decision 12 — Bound Native Work

Run:

- deterministic package and guard tests during implementation;
- one direct-result gate for the frozen DSH artifact;
- one official add/remove/reinstall lifecycle;
- one final native graph journey;
- one final repository validation.

Do not create repeated native attempts simply to gain confidence after a pass. A failure is classified,
retained, and either fixed before source freeze or escalated to amendment.

## Decision 13 — Preserve the Shipped Headless Profile Composition

Post-Freeze Amendment A2 uses the fixed Profile name `headless`. Attempt identity comes from the
fresh isolated root, source binding, Artifact, Session, Task, and Evidence rather than from a custom
Profile name.

Official DSH initializes the shipped `headless` template with
`@deepseek-ai/dsh-base` and `@deepseek-ai/dsh-headless`. An unknown custom Profile created through
plugin add starts with `@deepseek-ai/dsh-base` only. Only the Headless bundle supplies
`headless-startup`, which consumes the positional Prompt, and `headless-runner`, which creates the
Agent, submits the Prompt, waits for idle, flushes the Session, prints the final reply, and requests
process exit.

The native Adapter Probe composes Cordis services manually and remains useful for the integration,
selector, six-tool, and MCP connectivity checks. It is not Headless composition evidence. A
non-model preflight must inspect the isolated Profile manifest and default config, run Headless
`--help`, and prove zero Session and Core Task creation before Attempt 4.

**Rejected**: another Attempt-numbered custom Profile. Isolation already comes from the Attempt root,
and a custom name omits the Headless app composition.

## Source Observations That Drive Repository Improvements

1. `packages/deepseek/` is only a two-file placeholder while its version was advanced with repository
   releases.
2. Root README, ROADMAP, MANIFEST, package versions, and current release commit do not agree on the
   current version.
3. The root validator explicitly requires the DeepSeek placeholder to remain unchanged.
4. Feature dependency documentation still describes the Contract 0.1 sequence after the graph
   refactor.
5. CI runs only for pull requests, while the main branch has no required status contexts.
6. Core's optional MCP instruction environment variable is Codex-named despite a multi-host Core.
7. The current host parity fixture recognizes DeepSeek at protocol level but must not be presented as
   product support.

These observations are handled either by bounded Feature 010 authority updates or the separate
improvement backlog in the accompanying review.
