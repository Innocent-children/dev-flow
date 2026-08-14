# Protocol Fixtures

This directory owns the shared public-contract fixtures produced by the Dev Flow Core. The same
fixtures are consumed by future Codex and DeepSeek adapters; host-specific copies or alternate
workflow contracts do not belong here.

Feature 002 User Story 1 provides these shared examples:

- `server-info.json`: product and six-tool catalog metadata;
- `open-task.json`: creation of one governed task;
- `active-task-conflict.json`: a same-host incompatible-contract conflict;
- `host-ownership-conflict.json`: a cross-host ownership conflict;
- `task.json`: the authoritative persisted task projection;
- `next-action.json`: the persisted `ASSESS_TASK` projection.

The three successful task fixtures describe the same task, revision, repository binding, and action
identity. Error fixtures intentionally return only a stable error and recovery instruction; they do
not expose a task contract or repository path. `${VERSION}` is the product-version placeholder used
by the future adapter, and `/workspace/example` is a fictional public example path.

Fixtures contain bounded public projections only: never database paths, source contents, Git diffs
or raw Git status, environment values, raw command output, or host-private state. The Application
does not read these files. They are contract evidence rather than runtime workflow authority, do
not replace the Domain model, and do not imply that the MCP SDK or server is implemented.
