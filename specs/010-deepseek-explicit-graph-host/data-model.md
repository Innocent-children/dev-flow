# Data Model: DeepSeek Explicit Graph Host

## Scope

Feature 010 adds no Core or database entity. This document defines only adapter-side runtime concepts
and ownership boundaries.

## Existing Authoritative Data

### Core Task

Unchanged Schema 2 graph task containing:

- immutable task intent;
- repository binding and claim;
- process ID/version/digest;
- current graph node;
- revision and action identity;
- node authorities and evidence;
- last operation and recovery facts;
- terminal state.

**Owner**: Go Core
**Persisted by DeepSeek adapter**: never

### Core Event and Evidence Records

Unchanged append-only Core-owned records.

**Owner**: Go Core
**Read/rewritten by DeepSeek adapter**: never

## New Runtime Concepts

### DeepSeekBundleRegistration

Represents the DSH-owned installed package and profile-layer entry.

| Field | Meaning | Persistence owner |
| --- | --- | --- |
| package name | `dev-flow-deepseek` | DSH/pnpm |
| package spec | path, tarball, or registry identity used by official CLI | DSH/pnpm |
| bundle patch | `cordis.patch.yml` | package |
| profile name | user-selected isolated or normal profile | DSH |
| active process state | loaded integration plugin fiber | DSH runtime |

The adapter does not store a second installation registry.

### DeepSeekSkillDefinition

One immutable registration loaded from packaged content.

| Field | Value |
| --- | --- |
| name | `dev-flow` |
| provider | `dev-flow-deepseek` |
| model invocable | false |
| user invocable | true |
| resource base | package Skill directory |
| content | packaged `SKILL.md` |

The definition is runtime registration, not task state.

### SelectorAuthorizationProjection

A per-call ephemeral result.

```text
AuthorizationDecision =
  NotTargetNamespace
  | DenyUnexpectedTool
  | DenyNoAgent
  | DenyNoOpenTurn
  | DenyMissingCurrentTurnSelector
  | AllowCurrentTurnSelector
```

Inputs:

- immutable `ToolExecution` name, call ID, Agent, and parent token;
- immutable `agent.session.events`;
- exact qualified tool allowlist;
- exact selector regex.

Output:

- `undefined` for allow/non-target;
- stable denial string for a covered unauthorized call.

Persistence: none
Cache: none required
Authority lifetime: one tool execution

### CurrentTurnProjection

Derived synchronously from session events.

```text
CurrentTurnProjection {
  turn: integer
  start_seq: integer
  call_seq?: integer
  direct_user_message_ids: string[]
  selector_present: boolean
}
```

Derivation rules:

1. prefer a `tool/call` whose `callId` matches the execution;
2. otherwise, for a nested call, identify the latest unmatched `turn/start`;
3. reject ambiguous or closed turns;
4. scan only events in that turn;
5. include only `user/message` with `source.kind=user`;
6. scan text blocks only.

It is never written to disk or used after the call.

### McpBridgeInstance

One DSH child plugin configuration.

| Field | Contract |
| --- | --- |
| transport | `stdio` |
| serverName | `dev_flow` |
| command | absolute packaged Core |
| args | `mcp --stdio` |
| env | explicit `DEV_FLOW_DATA_DIR` plus no secret-bearing product state |
| cwd | stable absolute directory |
| timeout | bounded |
| startup failure | non-fatal to unrelated DSH; tools absent while reconnecting |
| reconnect | official bounded policy |
| tool set | exact six qualified names |

DSH owns connection state and live tool registrations.

### PackageRuntimeSelection

```text
PackageRuntimeSelection {
  platform: "darwin"
  architecture: "arm64"
  package_root: absolute path
  core_path: <package_root>/runtime/darwin-arm64/dev-flow
  core_digest: sha256
}
```

An unsupported platform returns no partial product activation.

### DataDirectorySelection

```text
DataDirectorySelection {
  source: explicit | default
  path: canonical absolute directory
  created_by_adapter: boolean
}
```

Invariants:

- explicit path wins;
- Core receives an existing directory;
- default creation is restrictive;
- removal never deletes it;
- Codex and DeepSeek may point at the same directory;
- host ownership remains enforced by Core task claims, not by path separation.

### AcceptanceArtifactIdentity

```text
AcceptanceArtifactIdentity {
  repository_commit
  package_filename
  package_version_label
  package_size
  package_sha256
  core_filename
  core_sha256
  core_reported_version
  dsh_version
  dsh_integrity
  dsh_source_commit
  node_version
  pnpm_version
  operating_system
  architecture
  profile_name_hash
  process_definition_id
  process_definition_version
  process_definition_digest
}
```

No absolute home path, token, prompt, full environment, database content, or private log is retained.

## Runtime Relationships

```text
DSH Profile
  owns DeepSeekBundleRegistration
    loads DeepSeekSkillDefinition
    loads Selector Guard
    loads McpBridgeInstance
      starts PackageRuntimeSelection.core_path
        opens DataDirectorySelection.path
          reads/writes existing Core Task data
```

The integration plugin can disappear while Core data remains. Reinstall reconstructs every runtime
concept from package/profile configuration and reuses Core data.

## Invariants

1. No DeepSeek runtime object is a workflow cursor.
2. No selector authorization survives its tool execution.
3. Only Core writes Schema 2 task data.
4. Only DSH/pnpm writes profile package metadata.
5. Only the package owns its bundled Skill and runtime files.
6. Removing the package removes runtime registrations but not Core data.
7. Codex and DeepSeek package state are independently owned.
8. A current Core task does not authorize a DeepSeek tool call.
9. A DSH reconnect does not imply a Core mutation retry.
10. Exact six-tool and process-definition identities are verified before product acceptance.

## Persistence Transition

**N/A**

No migration, dual read, backfill, schema bump, compatibility decoder, or rollback transform is
authorized.
