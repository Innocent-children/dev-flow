# Data Model: Repository Binding Authorized Mutations

## RepositoryBinding

Existing fields remain unchanged: `canonical_root`, `git_common_dir_digest`, `repository_identity`,
`branch`, `detached`, `head`, `unborn`, `worktree_fingerprint`, `changed_paths`, `binding_digest`,
`observed_at`. `binding_digest` continues to cover stable facts and worktree fingerprint; bounded
`changed_paths` is the path-set projection used by mutation proof.

## RepositoryMutationEnvelope

Logical closed value embedded in every standard node result:

| Field | Rule |
| --- | --- |
| `changed_paths` | Normalized, unique repository contract paths; scoped for multi-repository Tasks. |
| `no_file_changes` | Boolean. |

```text
no_file_changes == true  <=> len(changed_paths) == 0
no_file_changes == false <=> len(changed_paths) > 0
```

It is canonical operation input, not a new Task field or cursor.

## RepositoryRelation

- `exact`: stable facts, fingerprint and binding digest equal.
- `worktree_only_changed`: stable facts equal; fingerprint and binding digest both differ.
- `forbidden_change`: root/common directory/identity/branch/detached/HEAD/unborn differs.

## RepositoryEffect

Core derives `exact_binding`, `process_artifact_only`, `product_file_change`, or
`exact_blocker_restoration`. `artifacts[]` no longer populates changed paths.

## Multi-repository aggregation

Primary plus sorted additions and one effective digest remain unchanged. Core validates each scoped path
against an existing key and proves each component. All components commit in one existing revision mutation.

## Lifecycle

Action issuance → Host allowed effects → identity validation → read-only scope observation → effect proof →
atomic rebind/transition, or stable error with zero writes. Recovery repeats the same proof from retained
operation input.

## Persistence disposition

`not-applicable`: no SQLite schema, snapshot field, claim row, codec or migration changes.
