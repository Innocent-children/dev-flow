# Codex Package and Plugin Contract

## Identity

| Field | Value |
|---|---|
| Package | `dev-flow-codex` |
| Plugin namespace | `dev-flow-codex` |
| Skill base name | `dev-flow` |
| Explicit selector | `$dev-flow-codex:dev-flow` |
| MCP server | `dev-flow` |
| Core contract | `0.1` |
| Codex baseline | CLI 0.147 on macOS arm64 |

The package remains private and has no production dependency or install-time mutation hook.

## Packed Surface

The package allowlist contains only:

- local marketplace metadata;
- launcher and lifecycle/path helpers;
- plugin manifest and MCP configuration;
- the single Skill and Codex invocation policy;
- one selected platform Core runtime;
- package metadata, README, and LICENSE.

It excludes tests, fixtures, task data, receipts, Core source, workflow state, and evidence records.

## Setup and Readback

Setup is an explicit user action. It verifies:

1. package/Core version compatibility;
2. runtime presence and executability;
3. exact plugin and Skill resources;
4. implicit invocation disabled;
5. direct STDIO MCP configuration;
6. one owned marketplace/plugin readback.

Only then may it write the closed registration receipt. Setup never writes the target repository.

## Removal

Removal uses the receipt to delete only product-owned registration and package state. It preserves:

- Core task data;
- target-repository content;
- unknown adjacent files;
- foreign marketplace/plugin entries.

Repeated removal is idempotent, and a compatible reinstall may rediscover retained tasks.

## Tool Surface

The direct MCP server exposes exactly:

```text
dev_flow_server_info
dev_flow_open_task
dev_flow_get_task
dev_flow_get_next_action
dev_flow_apply_action
dev_flow_cancel_task
```

No proxy, generic shell MCP tool, extra alias, transition engine, or adapter-owned task store is
permitted.

## Verification Contract

Feature 003 verification has six layers:

1. package build/allowlist;
2. lifecycle setup/readback/removal;
3. Skill selector and six-tool composition;
4. deterministic Core loop;
5. three Codex 0.147 JSONL terminal shapes;
6. repeatable native smoke plus one final pre-merge acceptance journey.

Development smoke output is ephemeral. It is not release evidence and creates no permanent attempt
or report state.

## Deferred Release Contract

Feature 003 does not define validation/artifact reports, immutable attempts, pass-lock, digest
chains, diagnostic-version compatibility, cross-file crash transactions, fsync/inode/TOCTOU
protocols, large-stream digest matrices, or canonical support evidence. The former schemas for those
concerns are removed from this feature and may be redesigned by a dedicated release/supply-chain
feature.

## Closed HIGH Cases

The following native regressions are closed by one minimum test each:

- diagnostic precedence;
- Core envelope closure;
- failed-event/recovery binding;
- aggregate/session MCP fact parity.

Their coverage must remain intact. The package remains NO-GO only until the separate final real
Codex acceptance journey passes.
