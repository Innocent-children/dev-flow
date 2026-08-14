# Data Model: Bootstrap Monorepo

This feature creates no runtime or persisted user data.

The following build-time entities are represented by files and repository contracts only.

## ProductVersion

| Field | Type | Rule |
|---|---|---|
| value | SemVer string | Current valid `MAJOR.MINOR.PATCH` value; bootstrap starts in the `0.x` line |
| source | Path | Root `VERSION` only |

Validation:

- must be `MAJOR.MINOR.PATCH`;
- no leading `v`;
- package metadata must not contradict it;
- tests and package metadata must read or compare against the current file rather than a hard-coded literal;
- documentation examples may use placeholders and must not become compatibility checks.

## WorkspacePackage

| Field | Type | Rule |
|---|---|---|
| id | enum | `codex` or `deepseek` |
| path | path | `packages/<id>` |
| private | boolean | Must be `true` |
| publishable | boolean | Must be `false` in this feature |
| files | set | README and package manifest only |
| lifecycle scripts | set | Must be empty |
| executable entries | set | Must be empty |
| runtime dependencies | set | Must be empty |

## SourceOwnershipArea

| Area | Owner |
|---|---|
| `cmd/dev-flow` | executable entry point |
| `internal` | shared Go core |
| `packages/codex` | Codex product edge |
| `packages/deepseek` | DeepSeek product edge |
| `protocol/fixtures` | shared public contract fixtures |
| `tests/contract` | cross-layer repository contracts |
| `release` | operator release tooling |
| `scripts` | repository-local development validation |
| `specs` | Spec Kit feature artifacts |
| `docs` | product-wide documentation |

## RepositoryContract

| Field | Type | Rule |
|---|---|---|
| required paths | path set | Must exist or contain an ownership README |
| forbidden nesting | path rules | No nested `.specify/` or `go.mod` |
| product package constraints | manifest rules | Private, no `bin`, no lifecycle script, no runtime dependency |
| validation entry | path | `scripts/validate-repository.sh` |
| CI invocation | command | Must call the same repository validation entry |

## Runtime Data Boundary

This feature defines no database, schema version, migration, user-data directory, import/export
format, or runtime state entity. Those belong to later feature specifications.
