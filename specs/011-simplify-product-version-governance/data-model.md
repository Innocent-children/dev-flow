# Data Model: Simplify Product Version Governance

## 1. Product Version Authority

| Product | Authority | Mirrors | Invariant |
| --- | --- | --- | --- |
| Core | `CORE_VERSION` | Core fixture values and built executable output | Every Core build/read reports this value |
| Codex | `packages/codex/package.json.version` | Codex plugin manifest | Mirror equals Codex only |
| DeepSeek | `packages/deepseek/package.json.version` | None | Independent of Core/Codex |

The root package is private tooling and has no version field. All three authority values are valid
SemVer and have no cross-product equality invariant.

## 2. Core Runtime Identity

| Field | Meaning |
| --- | --- |
| `product` | Fixed Core product identity `dev-flow` |
| `version` | Actual executable Core product version |
| `transport` / `health` | Current server availability |
| `supported_hosts` | Closed host identity set |
| `supported_processes` | Stable process ID, definition digest, and new-task availability |
| `method_profiles` | Closed current method-profile catalog |
| `tools` | Exact six-tool catalog |

There is no internal contract, limits, schema, or process version field. Compatibility is the closed
aggregate above plus each tool's actual input/output schema and behavior.

Success envelopes contain `ok`, `request_id`, `tool`, and `result`. Failure envelopes replace
`result` with `error` and `recovery`. Neither form has a format number.

## 3. Process Reference

| Field | Rule |
| --- | --- |
| `process_id` | Exactly `standard-development` for current tasks |
| `process_definition_digest` | Exact digest of stable process semantics |

The definition digest is content identity. It changes when stable semantics change and is not a
maintained numeric generation.

Payload-contract IDs use stable names such as `requirements-result` and `blocker-resolution`, without
an artificial suffix. Repository digest domains likewise use stable names without `/vN`.

## 4. Current Persisted Task

The authoritative task aggregate remains unchanged except that its `ProcessReference` has two
fields. The current `tasks` row stores:

- task, host, process ID, and process definition digest;
- current node, revision, repository identity, strict snapshot bytes, and timestamps.

It stores no process or snapshot number. The strict snapshot is the closed current `ProcessTask` JSON
shape and rejects unknown/duplicate/trailing/invalid data.

### Storage lifecycle

1. Missing database: create the current tables/indexes in one transaction, verify exact structure,
   then commit.
2. Existing database: open read-only, verify the exact allowed objects/SQL/columns, validate all task
   rows/snapshots/claims, then close.
3. Compatible database: reopen through the current writable path.
4. Former, partial, future, or corrupt database: return a stable error with zero writes.
5. User recovery: choose a fresh directory or archive/rename/delete the old directory outside Core.

No automatic state transition exists between incompatible formats.

## 5. Codex Build Identity

| Field | Source |
| --- | --- |
| `package_version` | Codex package authority |
| `core_version` | Built executable / `CORE_VERSION` |
| `npm_tarball` | `dev-flow-codex-<package_version>.tgz` |
| `core_binary` | `dev-flow-core-<core_version>-darwin-arm64` |

Both artifacts retain source commit/tree and SHA-256 identity.

## 6. Codex Release Identity

| Field | Rule |
| --- | --- |
| `product` | `codex` |
| `version` | Codex version |
| `core_version` | Actual bundled Core version |
| `tag` | `codex-v<version>` |
| `source_commit` / `source_tree` | Exact product source |
| `verification_mode` | `quick` or `normal` |
| `based_on_release` | `v0.5.0` bridge or the latest lower eligible `codex-v*` in both modes |
| artifact digests | Exact package/Core/manifest bytes |

Publication state adds the fixed step states and observed npm/GitHub identities. It has no record
format number. Exact keys make it current-format only.

## 7. Codex Registration Receipt

The current receipt retains product `{name, version, core_version}`, host, registration, paths,
resource digests, and installation time. It has no format number. Exact current-key validation
rejects former numbered receipts before lifecycle mutation; no legacy receipt DTO is retained.

### Release lifecycle

```text
source validated
  -> Codex-only version commit when needed
  -> targeted/normal local validation
  -> deterministic preparation
  -> current-format record verification
  -> later authorized publication or frozen resume
```

Feature 011 stops before the later authorized publication branch.
