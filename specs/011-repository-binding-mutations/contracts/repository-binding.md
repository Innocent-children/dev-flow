# Repository Binding and Drift Contract

## Stable binding facts

Apply protects canonical root, Git common directory digest, repository identity, branch/detached,
HEAD/unborn, immutable Repository Scope, Action revision/identity/kind, source cursor and process identity.

## Mutation envelope

Every standard node result contains exact `changed_paths` and `no_file_changes`. Multi-repository paths use
`<repository-key>::<repository-relative-path>`. Unknown keys, absolute paths, traversal, non-normalized forms
and duplicates are invalid arguments.

## Decision table

| Action/effect | Fresh observation | Envelope | Result |
| --- | --- | --- | --- |
| Write allowed | Stable facts exact; observed paths = baseline ∪ declared | exact paths | Accept and rebind |
| Write allowed | Binding exact | `no_file_changes=true` | Accept without rebind |
| Write allowed | Undeclared path present | any | `REPOSITORY_DRIFT`, zero writes |
| Write allowed | root/identity/branch/HEAD/scope differs | any | `REPOSITORY_DRIFT`, zero writes |
| Write forbidden | Binding exact | no change | Continue payload validation |
| Write forbidden | Worktree changed | any | `REPOSITORY_DRIFT`, zero writes |
| Any Action | stale revision/Action/source/binding | any | stale/unsupported error, zero writes |

Dirty baseline paths are retained by set union. Core verifies path authorization and aggregate content change.
Because the persisted binding contains one aggregate fingerprint rather than per-path baseline fingerprints,
a content-only concurrent write to an already-dirty path cannot be attributed when the Git status path set is
unchanged; this contract does not claim writer identity for that case.

## Rebinding

After successful write, Task component bindings become fresh observations before the next Action digest is
calculated. This is verified Action-effect adoption, not generic worktree adoption.
