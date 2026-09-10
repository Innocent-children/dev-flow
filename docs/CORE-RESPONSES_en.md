# Core Response Contract

[中文](CORE-RESPONSES.md) | [English](CORE-RESPONSES_en.md)

This contract governs Core MCP responses, implemented by `internal/mcp/results.go` and
`output_schemas.go`. Core reports the actual outcome, specific failure conditions and permitted next
operation. Hosts retain the complete response and follow its structured fields. Requests are described
in [Commands](COMMANDS_en.md); Host execution is documented in the shared Skill's `tool-results.md`.

## Success and failure

Every response includes `ok`, `request_id` and `tool`. The request ID correlates the invocation and the
tool identifies the actual operation. `ok=true` requires `result` and excludes `error`/`recovery`;
`ok=false` requires `error`/`recovery` and excludes `result`. Output schemas enforce these exclusive shapes.

Success means the tool performed the operation it reports. A node submission still requires reading
the saved Task, which may be BLOCKED, DONE or CANCELLED. Ordinary submissions return the Task at
`result`; open/get use `result.task`; next-action uses `result.action`; relocation preparation returns
`result.relocation_id` and `result.task`. Reads may include `recovery_assessment`; follow its
`next_advice` before executing the current Action.

## Error fields

`error.code` is a stable category and `message` is a description without interpolated request content.
Identified parameter failures use `details[]`: each entry has a request `path`, fixed `rule` and
specific required behavior in `message`. Array positions use `[index]`. Budget paths under `verification.*` identify the current Task budget or usage; `arguments` names the entire MCP argument object, and other parameter-error paths identify submitted members. Transition conditions use
`guard.guard_id` and `guard.failures[]`. Core returns every relevant field it can establish rather than
requiring the Host to guess from generic prose.

`VERIFICATION_BUDGET_EXCEEDED` identifies a quantity limit; `error.budget` provides `used`, `requested`
and `limit`, while `details[].rule` distinguishes automatic commands from retained records.
`VERIFICATION_NOT_ALLOWED` identifies full-suite or pending manual-check permission restrictions,
with the affected field in `details[]`. Completed user checks and existing acceptance decisions consume
no automatic commands and are independent of the pending manual-handoff permission.

Public failures exclude submitted content, configuration values, secrets, internal directories and
stacks. `repository_paths` is reserved for existing missing-manifest feedback. Counters expose only
the non-sensitive quantities described above.

## Recovery guidance

`recovery` requires `action`, `retry_safe` and `message`. Machine behavior follows `action`; the message
must describe the same operation. `retry_safe=false` neither proves a write nor requires renewed
permission for the indicated read.

| action | Host behavior |
| --- | --- |
| `correct_request` | Core proved zero writes at the handshake/read/creation/lifecycle input boundary. Keep the same tool, preserve existing identity fields outside allowed_paths and authorization, correct only `allowed_paths` from existing facts, and submit once |
| `correct_current_action` | Core proved zero writes. Check the same Action and current schema, change only `allowed_paths` using established facts, and submit one correction |
| `read_next_action`, `read_task`, `retry_read` | Perform the indicated read and handle current state; do not replay the rejected submission |
| `resolve_blocker`, `restore_or_abandon`, `use_origin_host`, `provision_worktree` | Follow the operation indicated by current state; ask only for missing user decisions |
| `repair_storage`, `report_internal_error`, `none` | Stop automatic submissions and report the specific problem and required operation; the message must not also request automatic retry |

Only `correct_current_action` and `correct_request` return `retry_safe=true` and nonempty `allowed_paths`; every path must
come from the current failure details. Missing explanations for established checks can be corrected;
user confirmation, acceptance and unknown test results cannot be fabricated through correction.
Check required members before submission. Do not add the response request_id to tools that do not accept it. If the correction fails, report the new specific problem.

For missing, malformed or timed-out responses and uncertain writes, read the saved operation of the
original Task/Action before using a Core-authorized recovery path. Never reinterpret a failure as
success or substitute an earlier successful operation's result.

## Verification

MCP tests validate real success/failure responses against output schemas, covering result locations,
invalid mixed envelopes, detailed failures, quantity versus permission restrictions, zero-write
correction and uncertain outcomes. Shared Skill examples validate against the same interface for
Codex and DeepSeek. Error changes update the implementation, schema, this contract and affected examples.

## WebUI HTTP mapping

WebUI uses separate HTTP DTOs with the same Core failure code, details and budget counters, plus
field_paths for form highlighting. workflow_write_state distinguishes not_committed from unknown:
the former is established by the current boundary, while the latter requires reading the saved
operation. HTTP recovery keeps the same correction prerequisites and never treats an uncertain
outcome as a parameter correction.

## Requests and complete response examples

Both Host Skills link a complete successful response and place an error response directly after every complete MCP request. Success files include the resolved request using current Task values. Tests execute it through the application and store with fixed repository observations and compare the complete response; generated identities, timestamps and operation digests use stable example values. Codex Host helpers and DeepSeek workspace requests also have complete responses checked by actual adapter operations in temporary Git repositories, with explicitly simulated Host sessions and terminal Core reads. Each error pair states
its failure condition and the functions responsible for validation and encoding. Tests construct the
described failed input from the preceding valid request and compare the complete response, including
message, details, guard and recovery. The examples illustrate supported failures rather than exhaust
all runtime conditions. Existing shared error examples also match the current encoder exactly.

History resolution reports enum failures at `history_resolution.choice` and text failures at `history_resolution.reason` independently, returning both when both members are invalid.
