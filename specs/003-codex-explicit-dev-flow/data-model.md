# Data Model: Codex Explicit Dev Flow

## Boundary

Feature 003 models package/lifecycle state, Core-owned task references, sanitized Codex host events,
and ephemeral smoke observations. It does not define a release ledger or canonical evidence store.

## 1. Codex Product Package

| Field | Meaning |
|---|---|
| `name` | Exact identity `dev-flow-codex`. |
| `version` | Matches repository `VERSION` and bundled Core version. |
| `private` | Always true for Feature 003. |
| `files` | Closed allowlist of marketplace, launcher, lifecycle/path helpers, plugin/Skill/MCP resources, and one platform runtime. |
| `codex_range` | Supported host line selected from official Codex material. |
| `platform` | Platform actually packaged and exercised. |

Validation owns the exact pack allowlist and executable mode. Test fixtures, task data, receipts,
and workflow logic are never packaged.

## 2. Codex Plugin and Skill

| Field | Meaning |
|---|---|
| `plugin_name` | `dev-flow-codex`. |
| `skill_base_name` | `dev-flow`. |
| `explicit_selector` | `$dev-flow-codex:dev-flow`. |
| `implicit_allowed` | false. |
| `mcp_server` | One direct STDIO server named `dev-flow`. |
| `tools` | Exact six Core Contract 0.1 names. |

The plugin/Skill contains guidance only. Task state, transition decisions, recovery, and terminal
outcomes remain Core-owned.

## 3. Registration Receipt

The existing closed registration receipt identifies only product-owned host state:

- schema version and product/version;
- canonical package/data roots;
- marketplace/plugin selectors;
- digests of owned resources;
- observed registration snapshot;
- creation time.

Setup writes it only after successful readback. Removal uses it as an ownership boundary and never
deletes task data or unknown adjacent files.

## 4. Core Task Reference

The adapter temporarily carries Core-returned task/action facts:

- task ID and host;
- repository binding;
- revision;
- action ID/kind;
- allowed effects and payload schema;
- required evidence and verification budget;
- recovery, blocker, and terminal outcome.

These values are not adapter state and are never independently synthesized.

## 5. Sanitized Codex 0.147 Host Fixture

Each JSONL fixture contains one `thread.started` event and one terminal Dev Flow
`item.completed` event.

| Fixture | Terminal shape |
|---|---|
| `success.jsonl` | `status=completed`, complete result, text/structured parity, typed Core success. |
| `core-domain-error.jsonl` | `status=failed`, complete result, text/structured parity, typed Core `ok=false` error/recovery. |
| `transport-error.jsonl` | `status=failed`, `result=null`, typed host transport error. |

Fixtures retain only:

- event and item type;
- terminal status;
- MCP server/tool;
- arguments needed to identify the call shape;
- result presence;
- structured/text parity where a result exists;
- typed error presence where no result exists.

Fixtures exclude prompts, source content, user paths, environment variables, tokens, secrets, and
real thread/item/task/request identifiers.

## 6. Ephemeral Smoke Observation

A development smoke returns one process-local summary:

```text
mode: fixture | smoke | acceptance
host: codex-0.147
sessions:
  role
  thread_started
  dev_flow_call_count
  tools
  terminal_shape
status: pass | fail
```

The summary may be printed to stdout. It is not written to a canonical path, does not reserve or
consume an attempt, and is not release evidence.

## 7. Final Acceptance Observation

Immediately before merge approval, an operator observes:

- package/setup/readback;
- ordinary zero-call isolation;
- exact explicit selector and six-tool handshake;
- create/apply/restart/resume/DONE;
- Core-domain vs transport error distinction;
- removal with retained task data.

The acceptance result is attached to the merge decision by the operator. Feature 003 does not
define immutable report identities, cross-file transactions, or provenance publication.

## Deferred Models

The former validation report, artifact report, native-attempt ledger, diagnostic version matrix,
and canonical journey-evidence models are removed from the active Feature 003 contract. A future
release/supply-chain feature may define them from its own requirements; it must not infer them from
obsolete Feature 003 schemas.

## Relationships

```text
Codex Product Package
  ├── contains Codex Plugin + Skill + one Core runtime
  ├── setup/readback owns Registration Receipt
  └── removal preserves Core task data

Codex Host
  ├── ordinary request -> zero Dev Flow calls
  ├── exact selector -> six-tool handshake -> Core task loop
  └── JSONL terminal event -> one of three sanitized parser shapes

Development smoke -> ephemeral observation only
Final acceptance -> merge decision only
```
