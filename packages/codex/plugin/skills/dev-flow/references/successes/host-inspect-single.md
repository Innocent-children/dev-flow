# inspect: single

Implementation: `packages/codex/bin/dev-flow-codex.mjs` — `runHostLaunchCommand`.

Complete result from the adapter implementation, executed in a temporary Git fixture.
Host session creation, handoff completion and Core terminal reads are supplied test observations,
not live Host calls. Paths, generated identities, digests and timestamps use stable example values;
all fields and their references are retained and compared.

Resolved request:

<!-- example:resolved-host inspect single -->
```json
{
  "repositories": [
    {
      "key": "primary",
      "repository_path": "/work/project"
    }
  ],
  "request": "Return the requested field from the endpoint."
}
```

Complete response:

<!-- example:host-success inspect single -->
```json
{
  "repositories": [
    {
      "canonical_root": "/work/project",
      "dirty_paths": [],
      "dirty_paths_truncated": false,
      "head": "0000000000000000000000000000000000000001",
      "repository_key": "primary",
      "status_digest": "0000000000000000000000000000000000000000000000000000000000000001"
    }
  ],
  "request_digest": "0000000000000000000000000000000000000000000000000000000000000002"
}
```
