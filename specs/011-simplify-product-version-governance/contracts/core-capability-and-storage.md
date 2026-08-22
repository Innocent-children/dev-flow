# Core Capability and Current Storage Contract

## Server information

The closed server-info result contains:

```json
{
  "product": "dev-flow",
  "version": "1.2.3",
  "transport": "stdio",
  "health": "ok",
  "supported_hosts": ["codex", "deepseek"],
  "supported_processes": [
    {
      "process_id": "standard-development",
      "definition_digest": "<64 lowercase hex>",
      "new_task_supported": true
    }
  ],
  "method_profiles": ["<closed current entries>"],
  "tools": ["<exact six tool names>"]
}
```

Actual method-profile representation and six names remain the current public contract. Unknown
fields are rejected by host contract tests. No internal version field is accepted or emitted.

## Result envelope

Success keys are exactly `ok`, `request_id`, `tool`, and `result`. Failure keys are exactly `ok`,
`request_id`, `tool`, `error`, and `recovery`. The `ok` discriminator and closed result/error shapes
provide current behavior; no envelope format number is emitted.

## Process reference

Every task/action/process projection uses:

```json
{
  "process_id": "standard-development",
  "process_definition_digest": "<64 lowercase hex>"
}
```

The complete graph behavior is unchanged.

Payload contract identities are stable unnumbered names such as `requirements-result`,
`design-result`, `test-result`, and `blocker-resolution`. Repository identity/binding digest domains
are stable unnumbered domain strings. Removing the former suffixes changes calculated digests once;
the old database is already rejected by the current-format boundary.

## Host compatibility gate

A host accepts a packaged Core only when all required observations pass:

- ordinary executable at the exact package-relative path;
- `dev-flow <SemVer>` Core identity line;
- healthy local STDIO server info with the closed fields above;
- exact six-tool catalog and each current input schema;
- `standard-development` with the required definition digest;
- current method profiles and expected runtime behavior.

Package/Core version equality is not a compatibility criterion.

DeepSeek keeps its existing exact six-qualified-tool catalog gate. Its first authorized Skill
handshake reads current server info and the live input schemas before mutation. Missing/extra tools,
changed schemas, or incompatible server info fail closed without a new compatibility registry.

## Current SQLite format

- Core owns one database Schema version, currently `0.1.0`, stored as the sole row in
  `schema_metadata`.
- Bootstrap creates the exact current object allowlist in one transaction.
- Existing files are checked read-only before a writable open.
- Task rows contain process ID and definition digest but no process/snapshot number.
- Snapshots use one strict current DTO and reject unknown, duplicate, trailing, malformed, oversized,
  or semantically invalid data.
- Extra old tables/columns, missing objects, changed SQL, wrong definition digest, corrupt rows, or
  invalid claim cardinality return a stable error with zero writes.
- Core never deletes or migrates the file. The user selects a fresh directory or manages the old
  path explicitly.
