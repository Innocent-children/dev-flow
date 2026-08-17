# Data Model: Codex Release and Publication

Generated release records are external build/operator artifacts. They are not stored in the Dev Flow
task database and do not change Core schema.

## ReleaseIdentity

| Field | Type | Rule |
|---|---|---|
| `version` | SemVer string | equals root `VERSION` |
| `tag` | string | exactly `v<version>` |
| `source_commit` | 40-char lowercase Git SHA | clean release commit |
| `source_tree` | 40-char lowercase Git SHA | tree of release commit |
| `core_fixture_digest` | `sha256:<hex>` | exact shared Core fixture digest |
| `feature_003_commit` | Git SHA | merged Codex baseline |
| `feature_005_commit` | Git SHA | merged recovery baseline |
| `build_profile` | string | fixed first-release profile |
| `created_at` | RFC 3339 UTC | record creation time |

**Invariant**: All artifacts and remote identities in one release refer to this object.

## ArtifactRecord

| Field | Type | Rule |
|---|---|---|
| `name` | string | unique release asset/package name |
| `kind` | enum | `npm_tarball`, `core_binary` |
| `relative_path` | string | safe relative output path |
| `size_bytes` | integer | non-negative |
| `sha256` | 64-char lowercase hex | digest of exact bytes |
| `mode` | string | expected installed/asset mode |
| `npm_integrity` | string/null | registry integrity when applicable |
| `source_commit` | Git SHA | equals ReleaseIdentity |
| `core_version` | SemVer/null | required for runtime-bearing artifacts |

**Invariant**: The Core binary record digest equals the binary bundled inside the npm tarball.
The manifest does not record its own digest and does not inventory the mutable publication record.

## SupportMatrixEntry

| Field | Type | Rule |
|---|---|---|
| `os` | string | `darwin` |
| `arch` | string | `arm64` |
| `actual_codex_version` | string | exact final journey version |
| `compatible_codex_range` | string | copied from Feature 003 |
| `package_sha256` | hex digest | published tarball |
| `core_sha256` | hex digest | bundled runtime |
| `journey_result` | enum | `passed`, `failed`, `blocked` |
| `journey_observed_at` | RFC 3339 UTC/null | required for passed/failed |
| `notes` | bounded string | no secrets or raw output |

During preparation the entry may be `pending`. Only the final manifest with a `passed` entry
becomes a public support claim.

## ReleaseManifest

Fields:

- schema version;
- ReleaseIdentity;
- toolchain versions;
- normalized package file inventory;
- ArtifactRecords;
- one SupportMatrixEntry;
- validation command/result summaries;
- forbidden-content scan result.

**Invariants**:

- sorted deterministic collections where order has no meaning;
- no absolute paths;
- no credentials or environment values;
- no raw command/host output;
- every referenced artifact exists and matches its digest.

## PublicationStep

Enum:

```text
preflight
tag
github_draft
npm_publish
npm_readback
final_journey
github_upload
github_readback
github_finalize
```

Fields:

- status: `pending`, `complete`, `failed`, `blocked`;
- started/completed timestamps;
- bounded remote identifiers;
- expected and observed digests;
- bounded error code/summary;
- safe next action.

## PublicationRecord

Fields:

- schema version;
- ReleaseIdentity;
- overall status;
- local manifest digest;
- ordered PublicationSteps;
- npm package/version/integrity and verification state;
- Git tag target;
- GitHub draft/release ID and URL identity;
- uploaded asset names/digests;
- final journey result;
- last observed time;
- safe next action.

Overall status transitions:

```text
prepared
→ remote_initialized
→ npm_published
→ npm_verified
→ journey_passed
→ assets_uploaded
→ assets_verified
→ release_published
→ complete
```

Any state may become `failed` or `blocked`; retry first rereads remote state and can return to the
appropriate exact prior state. There is no automatic rollback state.

## LifecycleObservation

Used by final evidence:

- installed package identity and location class;
- packaged Core version/digest;
- Codex version and compatible-range result;
- setup receipt/read-back result;
- ordinary zero-trigger result;
- created task ID;
- pre/post restart revision/action identity;
- terminal outcome;
- removal read-back;
- npm uninstall result;
- retained task reopen result.

Raw prompts, source files, environment values, and unbounded host output are excluded.

## Core Persistence Decision

- SQLite schema version: unchanged.
- Task/Event/Claim model: unchanged.
- Release manifest/publication record: never written into the task database.
- The publication record remains an operator artifact and is not a public immutable release asset.
- Generated release files live only in the operator-selected release output directory and approved
  remote release systems.
