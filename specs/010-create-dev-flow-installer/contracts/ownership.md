# Contract: Ownership and Cleanup

## Owned Roots

| Owner | Exact resource |
| --- | --- |
| Codex lifecycle | Codex Plugin/marketplace registration and Codex receipt validated by `dev-flow-codex` |
| DSH lifecycle | `dev-flow-deepseek` contribution in one explicit Profile |
| Manager | `$HOME/Library/Application Support/create-dev-flow` records and manager-created temp roots |
| Shared Dev Flow product | `$HOME/.dev-flow/config.json` and current Task data selected by the reset plan |

The manager may coordinate an owner command. It does not acquire ownership of adjacent Host state.

## Never-Owned Targets

```text
$HOME
$HOME/.codex
$HOME/.dsh
npm cache or npm global prefix root
Codex or DSH executable/package
Git repository roots
unknown sibling files
historical explicit DEV_FLOW_DATA_DIR values not supplied in the current request/environment
```

No recursive delete or move may resolve to an ancestor of an allowed target.

## Factory Reset Preconditions

Every cleanup target must satisfy all conditions:

1. Exact canonical identity was observed before the plan.
2. Target is fixed product state, a current explicit data directory or manager-owned record.
3. Target appears in the saved plan digest.
4. Target identity is unchanged immediately before mutation.
5. All observed Adapters using shared data are included and removed/read back first.
6. Reset confirmation token matches the saved digest and has not expired.
7. Explicit data path matches a `--confirm-explicit-data` value.
8. Permanent deletion also has a valid permanent token.

Failure of any condition exits 4 and makes no cleanup mutation for that target.

## Recoverable Move

- Create one unique non-symlink `$HOME/.Trash/create-dev-flow-<timestamp>-<random>` root with mode 0700.
- Move each exact target to a deterministic label under that root using rename.
- Never overwrite an existing destination.
- Record the move immediately after readback.
- `EXDEV` or destination conflict leaves the source untouched and returns one manual handoff.
- A later successful clean reinstall does not restore the Trash copy as active state.

## Permanent Removal

Permanent removal applies only to the same confirmed closed targets. It uses exact literal paths after the final
identity check. It cannot accept a glob, unresolved environment variable, HOME, manager root parent or product root
parent. The result reports resource categories, not private contents.

## Parent Cleanup

After exact child cleanup, a product directory may be removed only when it is empty. Unknown neighbors are preserved
and reported as preventing parent removal.

