# Implementation Plan: DeepSeek Explicit Graph Host

**Branch**: `010-deepseek-explicit-graph-host`
**Date**: 2026-08-20
**Specification**: [spec.md](spec.md)

## Summary

Implement `dev-flow-deepseek` as one official DSH profile bundle that composes three host-plane
contributions:

1. a runtime-registered, user-invocable and non-model-invocable `dev-flow` Skill;
2. a monotonic selector guard over the fixed `mcp__dev_flow__...` namespace;
3. one official `@deepseek-ai/dsh-mcp-client` child plugin connected directly to the packaged Core
   over STDIO.

The design intentionally removes the old custom-launcher assumption. Current DSH already owns
subprocess creation, STDIO, cancellation, disposal, and bounded reconnect. The integration plugin
resolves the package runtime and data directory, then gives the official MCP client the absolute Core
command and explicit environment.

Core remains the sole process and persistence authority.

## Baseline

| Area | Current authority |
| --- | --- |
| Repository | `main@70726d0ba59ead5496657e445b25494152e6d8f8` |
| Core | Contract 0.2 |
| Process | `standard-development@1` |
| Persistence | Schema 2 / current graph task codec |
| Raw MCP tools | six fixed `dev_flow_*` tools |
| Codex product | implemented graph host; reference behavior only |
| DeepSeek package | private placeholder |
| DSH planning artifact | `@deepseek-ai/dsh 0.1.0-rc.8` |
| DSH source | `141eb6fef83422698aef7a981029e843e8161534` |
| Initial platform | macOS arm64 |

## Technical Context

- **Core language**: Go 1.26
- **Adapter language**: Node.js ESM, Node 24+
- **Package manager**: pnpm 11
- **Host extension model**: Cordis/DSH profile bundle
- **Host Skill model**: DSH Skill registry plus official user-invocation integration
- **Host tool model**: DSH ToolRuntime
- **MCP transport**: official DSH MCP client, local STDIO
- **Storage**: existing Core-owned SQLite Schema 2
- **Artifact**: one local npm tarball containing one darwin-arm64 Core
- **Native evidence**: one exact DSH profile and one exact package artifact

## Constitution Check

### Core Authority

Pass. No Core transition, persistence, recovery, terminal, or repository behavior moves into the
adapter.

### Bounded Workflow

Pass. The adapter projects the one existing process and exact six tools. No graph DSL, plugin graph,
or user-defined workflow is added.

### Explicit Invocation

Pass only with the execution guard. Skill invocation policy alone is not sufficient because MCP
tools remain registered model tools.

### Recovery Before Retry

Pass. DSH reconnect is transport lifecycle only. The Skill performs current task and next-action
reads before a possibly repeated mutation.

### Independent Host Release

Pass. `dev-flow-deepseek` is a separate package and later release authority. The current root version
is not treated as a DeepSeek support claim.

### Evidence Honesty

Pass. Simulated, package, lifecycle, and native gates are separately labelled. One native journey is
required and is not inferred from deterministic tests.

## Architecture

```text
DSH profile
└── dev-flow-deepseek bundle
    └── integration plugin
        ├── register Skill "dev-flow"
        │   ├── userInvocable: true
        │   └── modelInvocable: false
        ├── register global monotonic ToolRuntime guard
        │   └── authorize only current-turn direct-user /dev-flow
        └── mount official dsh-mcp-client child plugin
            └── spawn packaged darwin-arm64 dev-flow mcp --stdio
                └── Core Contract 0.2 / Schema 2 / standard-development@1
```

### Package Shape

```text
packages/deepseek/
├── package.json
├── README.md
├── LICENSE
├── cordis.patch.yml
├── lib/
│   ├── index.mjs
│   ├── authorization.mjs
│   ├── paths.mjs
│   ├── runtime.mjs
│   └── tool-names.mjs
├── skills/
│   └── dev-flow/
│       ├── SKILL.md
│       └── references/
│           ├── method-profiles.md
│           └── node-payloads.md
├── runtime/
│   └── darwin-arm64/
│       └── dev-flow
└── tests/
    ├── package-contract.test.mjs
    ├── bundle-contract.test.mjs
    ├── authorization.test.mjs
    ├── paths.test.mjs
    ├── integration-plugin.test.mjs
    ├── skill-contract.test.mjs
    ├── mcp-result-gate.test.mjs
    └── lifecycle.test.mjs

tests/journeys/deepseek/
├── fake-core.mjs
├── simulated-graph-journey.test.mjs
├── native-runner.mjs
└── evidence-schema.json
```

Exact names may change during implementation only when the contracts and task references are amended
together. No production file is added outside `packages/deepseek/` except bounded repository
validation, current-authority documentation, and DeepSeek journey support.

## Design Decisions

### 1. Official Bundle Lifecycle

`package.json` declares:

```json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

The patch inserts one package row. DSH's plugin command forwards package operations to pnpm inside the
profile and reconciles the bundle stack from installed package metadata. Local directories,
`file:` specs, tarballs, registry names, and aliases are resolved by DSH/pnpm rather than a custom
installer.

No `setup`, `remove`, profile JSON writer, symlink manager, or postinstall hook is added.

### 2. Runtime Skill Registration

The integration plugin reads packaged `SKILL.md` and registers one Skill with:

- name `dev-flow`;
- provider `dev-flow-deepseek`;
- `modelInvocable=false`;
- `userInvocable=true`;
- package-directory resource base.

The exact DSH acceptance artifact must include the official user-invocation integration. The Skill
content is not placed in the model catalog and is injected only when the direct user gesture is
recognized.

### 3. Selector Authorization

The exact selector token is:

```regex
(^|\s)/dev-flow(?=\s|$)
```

Only `user/message` events whose `source.kind` is `user` are considered. The decision is derived on
every covered tool call; it is not remembered.

The guard algorithm is:

1. Ignore tools outside the `mcp__dev_flow__` namespace.
2. Deny namespace tools not in the exact six-name allowlist.
3. Require an initiating Agent and a running session.
4. Prefer the current `tool/call` event matching `execution.callId`; use its `turn`.
5. For a nested execution without its own durable `tool/call`, locate the latest unmatched
   `turn/start`; deny if no single open turn exists.
6. Bound the scan to that turn.
7. Read only `user/message` events with `source.kind=user`.
8. Scan text blocks with the exact selector regex.
9. Return no denial only when a match exists; otherwise return the stable explicit-selector reason.

The guard uses `ctx.tools.guard`, not only the reorderable `tools/pre-execute` waterfall, so a later
listener cannot turn a denial into permission.

### 4. Qualified Tool Catalog

Fixed server name:

```text
dev_flow
```

Fixed public names:

```text
mcp__dev_flow__dev_flow_server_info
mcp__dev_flow__dev_flow_open_task
mcp__dev_flow__dev_flow_get_task
mcp__dev_flow__dev_flow_get_next_action
mcp__dev_flow__dev_flow_apply_action
mcp__dev_flow__dev_flow_cancel_task
```

The MCP client remains responsible for raw schema bridging. The integration verifies that the
connected server produces exactly these six names. An unexpected seventh name is not silently
accepted.

### 5. Direct Core Spawn

The integration plugin:

- resolves the package root from its own module URL;
- resolves only `runtime/darwin-arm64/dev-flow`;
- rejects unsupported platform/architecture without registering partial product contributions;
- resolves and creates the allowed data directory;
- mounts `@deepseek-ai/dsh-mcp-client` with:
  - `transport=stdio`;
  - `serverName=dev_flow`;
  - absolute Core command;
  - args `["mcp", "--stdio"]`;
  - explicit `DEV_FLOW_DATA_DIR`;
  - package root or another stable absolute `cwd`;
  - `toolCallTimeoutMs=60000`;
  - `failOnStartupError=false`;
  - the rc.8 reconnect defaults: `enabled=true`, `initialDelayMs=500`,
    `maxDelayMs=30000`, and `maxAttempts=10`.

There is no JavaScript transport launcher. DSH owns child lifetime and STDIO. The adapter does not
parse MCP frames.

### 6. Data Directory

`packages/deepseek/lib/paths.mjs` implements the same external behavior as Codex without importing the
Codex package:

- explicit `DEV_FLOW_DATA_DIR` first;
- otherwise shared macOS default;
- absolute canonical directory;
- restrictive creation for the default;
- reject unsupported symlink/non-directory cases;
- never delete.

A parity test compares externally observable path cases with the Codex path contract. The
implementation remains product-local to avoid a new generic adapter framework.

### 7. Skill Projection

The DeepSeek Skill is adapted to qualified DSH names but otherwise follows current Codex graph
semantics:

- explicit admission;
- first-call handshake;
- one repository;
- open/resume with `host=deepseek`;
- fresh Action before work;
- current method steps and payload contract;
- Core-declared transitions only;
- honest evidence budget;
- comprehension and user verdict;
- refactor returns through test;
- read-before-retry;
- terminal reporting.

Host-neutral reference files are copied into the package and byte/marker parity checked against the
current Codex copies. The runtime package does not depend on Codex.

### 8. MCP Result Compatibility

The direct official MCP path is the default. Before native acceptance, one bounded gate covers:

1. normal success with complete structured content;
2. Core domain error with stable error identity;
3. a response just below DSH spill policy;
4. a response that triggers official spill/retrieval behavior;
5. a response near the Core envelope limit;
6. a read-after-compaction/restart path where the Skill can re-read authoritative Core state.

The gate records expected/recovered byte counts and SHA-256 where retrieval is involved. A failure
stops for amendment; it does not silently authorize a proxy.

### 9. Lifecycle and Coexistence

The lifecycle journey uses one isolated DSH profile and isolated host state:

1. build one local package artifact;
2. add artifact through official DSH command;
3. restart and inspect resolved profile;
4. run deterministic and native explicit journeys;
5. stop DSH;
6. remove through official DSH command;
7. restart and verify absence;
8. verify data and Codex-owned state unchanged;
9. reinstall the exact artifact;
10. restart and reopen the same task.

The test may inspect DSH-owned profile metadata but never edits it directly.

## Testing Strategy

### Layer A — Static and Unit

- package manifest and patch;
- closed file allowlist;
- runtime/platform selection;
- data path cases;
- selector regex;
- current-turn event derivation;
- exact tool constants;
- Skill policy and forbidden authority phrases.

### Layer B — DSH Integration with Fakes

- Cordis bundle plugin composition;
- Skill registration;
- monotonic guard;
- official MCP-client config;
- six-name synchronization;
- initial failure/reconnect;
- direct result gate.

### Layer C — Deterministic Product Journey

- real packaged Core where practical;
- simulated DSH Agent/session/tool pipeline;
- create/apply/restart/resume;
- graph branches;
- comprehension;
- uncertain mutation;
- DONE;
- removal retention.

### Layer D — Official Profile Lifecycle

- exact DSH package;
- isolated profile;
- add/restart/readback/remove/restart/reinstall;
- no public network publication;
- no manual profile mutation.

### Layer E — One Native Journey

One macOS arm64 real-host journey after source freeze. It is the only final native execution and uses
the exact retained artifact.

### Test Budget

- targeted package tests may run during their owning checkpoint;
- one direct-result gate for the frozen host artifact;
- one official lifecycle journey for the frozen package;
- one native graph journey;
- one final repository validation;
- no repeated native retries without an explicit failure classification and amendment;
- no test is repeated only to increase confidence after a pass.

## Documentation Changes

Bounded current-authority changes are permitted:

- mark Feature 004 as superseded by Feature 010;
- add Feature 010 to `MANIFEST.md`;
- update `docs/FEATURE-DEPENDENCIES.md`;
- add a current product/support matrix;
- update root README current version/support statements;
- replace the validator's “DeepSeek must remain unchanged” rule with package contracts.

Historical completed Feature content is not rewritten.

## Release Plan

None in this Feature. The artifact remains source-local and unpublished.

A later standalone Release Change:

- selects the first public DeepSeek version;
- verifies the exact supported DSH range;
- publishes and reads back the npm artifact;
- installs from official registry identity;
- promotes GitHub Release assets;
- re-downloads and re-verifies;
- updates public support documentation.

## Complexity Tracking

| Choice | Why needed | Simpler alternative rejected |
| --- | --- | --- |
| Monotonic execution guard | User-only Skill does not authorize MCP tools | Prompt-only instruction is not an authority boundary |
| Runtime Skill registration | One package owns content and policy without repository/user copies | Filesystem copying adds lifecycle ownership |
| Product-local path module | Shared data semantics are security relevant, but a generic framework is premature | Importing Codex couples independent products |
| Direct-result gate | Host spill/compaction can affect model-visible structured data | Assuming displayed text is complete |
| Exact DSH artifact evidence | Developer-preview contracts can change | Broad unverified support claim |
