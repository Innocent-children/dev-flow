# cleanup-decision: keep

Implementation: `packages/codex/bin/dev-flow-codex.mjs` — `runHostLaunchCommand`.

Complete result from the adapter implementation, executed in a temporary Git fixture.
Host session creation, handoff completion and Core terminal reads are supplied test observations,
not live Host calls. Paths, generated identities, digests and timestamps use stable example values;
all fields and their references are retained and compared.

Resolved request:

<!-- example:resolved-host cleanup-decision keep -->
```json
{
  "clean": false,
  "lifecycle": "DONE",
  "pushed": false,
  "stateCertain": true,
  "surface": "cli_worktree"
}
```

Complete response:

<!-- example:host-success cleanup-decision keep -->
```json
{
  "automatic_cleanup": false,
  "branch_cleanup": "requires_dirty_review",
  "worktree_cleanup": "requires_dirty_review"
}
```
