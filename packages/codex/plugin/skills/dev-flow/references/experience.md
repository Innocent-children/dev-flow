<!-- Generated from skills/dev-flow/core/experience.md; edit the shared source and run node scripts/sync-skill-references.mjs. -->

# Task experience

Implementation: `internal/domain/experience.go`; `internal/store/experience.go`; `internal/application/experience.go`; `internal/mcp/experience.go`.

## Collect at understanding review

On every entry to `COMPREHENSION_REVIEW`, the AI executing the current Task proactively performs
`comprehension.collect_experiences`, without waiting for a separate collection request. Review this
Task's existing requirements, design, code changes, discussion and verification results. Read its
current experiences through `dev_flow_get_experiences`, following `has_next`, before deciding what to
save. Other nodes have no automatic experience-collection obligation.

1. Select a few useful causes, rejected hypotheses, solution choices, constraints or answers from
   those existing materials. Write for someone who cannot see the original chat: problem, cause,
   resolution, basis, applicability and what to check next time. Do not add investigation, tests or
   task scope to produce experience. If nothing is worth recording, skip the write and explain the
   implementation normally; there is no minimum count.
2. Save the selected content through Core before using it in the explanation. Match an existing
   finding by its subject and reasoning, reuse its `experience_id`, and revise it only when its
   content changes. On return from implementation or another remediation node, review again and
   update the existing finding; unchanged content needs no new write. A new node entry is not a new
   experience identity.
3. Explain why this approach was chosen, the conditions in which it applies, and what to inspect next
   time, using the saved experiences and current code/checks. Answer follow-up questions from the
   available task material. Save actual user supplements through `dev_flow_add_experience_note`,
   preserving the user's meaning; revise existing conclusions when that discussion changes them.
4. Identify concrete unnecessary complexity or maintenance risks and obtain the existing explicit
   user comprehension verdict. Stay in this node while discussing questions. Only the user's actual
   confirmation can support `comprehension_passed`; saving experience or exporting Markdown cannot.
   Findings that require code or requirement changes follow the current Action's legal return edges.

Record the completed review in `method_results.comprehension.collect_experiences.summary`: what was
saved or revised, what was already current, or why there was nothing useful to save. This is the
normal method result, not another confirmation or an experience-count gate.

Use `pending` for an unverified hypothesis, `supported` for a conclusion supported by references,
and `refuted` when disproved. State uncertainty explicitly; never turn a pending idea into an
established cause. Preserve useful eliminated alternatives in `basis` when revising.

Core supplies this node obligation and persists records. The current Host AI selects and writes the
actual content. Collection does not monitor chat in the background or invoke another model. The
node's `record_experiences` effect describes this automatic work; it is not a node restriction on
all experience APIs. Historical reading, explicit edits, user supplements and manual export remain
available under their existing permissions.

## Save results and failures

Host experience writes retain the Task's origin-host ownership. Both Hosts can read experiences; WebUI reads the same database. The Core records stage, time, repository identity and the saved Task content digest as historical context. These values do not certify that a Host's narrative or external reference is true, and never authorize a workflow transition.

Generate and retain an experience ID and request ID. Creation uses `expected_revision:0`; revision uses the last experience revision and a new request ID. After a lost response, retry the identical request ID and complete input; changing its content is rejected. Read before correcting a revision conflict. User supplements use the separate append operation and survive every content revision. Never invent a user supplement or comprehension verdict. Each encoded revision, including retained supplements, is limited to 65536 bytes; Core reports actual bytes on rejection. Reads/searches use 5 records per page; continue while `has_next` is true.

If a save fails, retain the candidate content and request identity, tell the user what is not yet
saved, and follow the returned recovery instruction. A revision conflict requires a current read;
a lost response requires the identical request, not a replacement experience. Do not report a failed
write as saved or as an empty review. While the save remains unresolved, stay in understanding review
and do not submit `comprehension_passed`. No new workflow node, blocker type or confirmation is added.

## Export and later use

On DONE, Core attempts Markdown export to `<data>/experiences/<repository-group>/<task-id>.md`. Saved data is authoritative. Export failure preserves DONE and pending state; inspect `export.error` and generation fields, then retry `dev_flow_export_experiences`. Any task state, including archived/cancelled tasks and tasks with failures, can be exported manually. Empty experiences skip export. Repeating export replaces a complete snapshot, never appends. Read/search includes archived tasks. Permanent Task deletion removes associated database experience; existing exported Markdown remains.

## Inputs, results and failures

Use live task IDs and experience revisions; the following values illustrate complete shapes with a Task at understanding review. `get_experiences` returns `result.experiences`, `result.export`, `page`, `has_next`; adding `experience_id` reads revision history. Search accepts optional `task_id`, `project` (repository group ID or saved path), `text` and `page`; results carry task status and archive status. Save/note return the saved experience; export returns generation, exported_generation, path and error. An export response with nonempty error means retry is needed, even though the request envelope is successful. The executable export example below deliberately exercises an unavailable writer and reports that saved failure; filesystem success is covered separately.

### dev_flow_save_experience

<!-- example:mcp dev_flow_save_experience experience_record -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "experience_id": "experience-example",
  "request_id": "experience-request",
  "expected_revision": 0,
  "content": {
    "title": "Independent experience records",
    "problem": "An Action can become stale when its Task revision changes.",
    "cause": "Auxiliary notes must not share the workflow snapshot revision.",
    "resolution": "Save task experience with its own revision.",
    "basis": "The existing Action compares its saved Task revision.",
    "applicability": "Auxiliary reasoning that does not change task workflow.",
    "next_checks": "Check which data belongs in the Action snapshot before adding a write.",
    "status": "supported",
    "repository_keys": [
      "primary"
    ],
    "references": [
      {
        "kind": "discussion",
        "locator": "Current task architecture discussion",
        "summary": "Task revision belongs to workflow operations."
      }
    ]
  },
  "change_reason": "Record the current architecture finding."
}
```

Complete successful request and response: [view every returned field](successes/dev_flow_save_experience-experience_record.md).

Possible error for this request: omit `host` from this request. Validation rejects the missing member before any lookup or write.

Implementation: `internal/mcp/tools.go` — `toolRequestMemberViolations`; `internal/mcp/results.go` — `EncodeError`.

<!-- error-case: {"operation":"remove","path":"host"} -->
<!-- example:mcp-output dev_flow_save_experience experience_record-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_save_experience",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "host",
        "rule": "required_member_missing",
        "message": "the closed contract requires this member"
      }
    ]
  },
  "recovery": {
    "retry_safe": true,
    "action": "correct_request",
    "message": "Correct only allowed_paths using established values and user decisions. Keep the same tool and existing request identity fields unless listed. Do not add the response request_id to tools that do not accept it. Submit once; ask only for missing facts or decisions, and stop if the corrected request fails.",
    "allowed_paths": [
      "host"
    ]
  }
}
```

### dev_flow_add_experience_note

<!-- example:mcp dev_flow_add_experience_note experience_note -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "experience_id": "experience-example",
  "request_id": "experience-note",
  "expected_revision": 1,
  "user_note": "I will check snapshot ownership before putting auxiliary data in the Task."
}
```

Complete successful request and response: [view every returned field](successes/dev_flow_add_experience_note-experience_note.md).

Possible error for this request: omit `host` from this request. Validation rejects the missing member before any lookup or write.

Implementation: `internal/mcp/tools.go` — `toolRequestMemberViolations`; `internal/mcp/results.go` — `EncodeError`.

<!-- error-case: {"operation":"remove","path":"host"} -->
<!-- example:mcp-output dev_flow_add_experience_note experience_note-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_add_experience_note",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "host",
        "rule": "required_member_missing",
        "message": "the closed contract requires this member"
      }
    ]
  },
  "recovery": {
    "retry_safe": true,
    "action": "correct_request",
    "message": "Correct only allowed_paths using established values and user decisions. Keep the same tool and existing request identity fields unless listed. Do not add the response request_id to tools that do not accept it. Submit once; ask only for missing facts or decisions, and stop if the corrected request fails.",
    "allowed_paths": [
      "host"
    ]
  }
}
```

### dev_flow_get_experiences

<!-- example:mcp dev_flow_get_experiences experience_read -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "page": 1
}
```

Complete successful request and response: [view every returned field](successes/dev_flow_get_experiences-experience_read.md).

Possible error for this request: omit `host` from this request. Validation rejects the missing member before any lookup or write.

Implementation: `internal/mcp/tools.go` — `toolRequestMemberViolations`; `internal/mcp/results.go` — `EncodeError`.

<!-- error-case: {"operation":"remove","path":"host"} -->
<!-- example:mcp-output dev_flow_get_experiences experience_read-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_get_experiences",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "host",
        "rule": "required_member_missing",
        "message": "the closed contract requires this member"
      }
    ]
  },
  "recovery": {
    "retry_safe": true,
    "action": "correct_request",
    "message": "Correct only allowed_paths using established values and user decisions. Keep the same tool and existing request identity fields unless listed. Do not add the response request_id to tools that do not accept it. Submit once; ask only for missing facts or decisions, and stop if the corrected request fails.",
    "allowed_paths": [
      "host"
    ]
  }
}
```

### dev_flow_search_experiences

<!-- example:mcp dev_flow_search_experiences experience_find -->
```json
{
  "host": "codex",
  "text": "snapshot",
  "page": 1
}
```

Complete successful request and response: [view every returned field](successes/dev_flow_search_experiences-experience_find.md).

Possible error for this request: omit `host` from this request. Validation rejects the missing member before any lookup or write.

Implementation: `internal/mcp/tools.go` — `toolRequestMemberViolations`; `internal/mcp/results.go` — `EncodeError`.

<!-- error-case: {"operation":"remove","path":"host"} -->
<!-- example:mcp-output dev_flow_search_experiences experience_find-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_search_experiences",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "host",
        "rule": "required_member_missing",
        "message": "the closed contract requires this member"
      }
    ]
  },
  "recovery": {
    "retry_safe": true,
    "action": "correct_request",
    "message": "Correct only allowed_paths using established values and user decisions. Keep the same tool and existing request identity fields unless listed. Do not add the response request_id to tools that do not accept it. Submit once; ask only for missing facts or decisions, and stop if the corrected request fails.",
    "allowed_paths": [
      "host"
    ]
  }
}
```

### dev_flow_export_experiences

<!-- example:mcp dev_flow_export_experiences experience_export -->
```json
{
  "host": "codex",
  "task_id": "task-example"
}
```

Complete successful request and response: [view every returned field](successes/dev_flow_export_experiences-experience_export.md).

Possible error for this request: omit `host` from this request. Validation rejects the missing member before any lookup or write.

Implementation: `internal/mcp/tools.go` — `toolRequestMemberViolations`; `internal/mcp/results.go` — `EncodeError`.

<!-- error-case: {"operation":"remove","path":"host"} -->
<!-- example:mcp-output dev_flow_export_experiences experience_export-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_export_experiences",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "host",
        "rule": "required_member_missing",
        "message": "the closed contract requires this member"
      }
    ]
  },
  "recovery": {
    "retry_safe": true,
    "action": "correct_request",
    "message": "Correct only allowed_paths using established values and user decisions. Keep the same tool and existing request identity fields unless listed. Do not add the response request_id to tools that do not accept it. Submit once; ask only for missing facts or decisions, and stop if the corrected request fails.",
    "allowed_paths": [
      "host"
    ]
  }
}
```
