# Task experiences

[中文](EXPERIENCES.md) | [English](EXPERIENCES_en.md)

## Recording and understanding

On every entry to `COMPREHENSION_REVIEW`, the AI executing the current Task proactively reviews its
existing requirements, design, code changes, discussion and check results. No separate collection
request is needed. It reads the Task's saved experiences, extracts a few useful findings, saves them
through Core and then explains them. Other nodes do not require automatic experience collection.

Each experience explains the problem, cause, resolution, basis, applicability and next checks, with
project, stage, time and references, so it can be understood without the original chat. If nothing is
worth recording, skip the write and explain the implementation normally. There is no minimum count,
and collection does not justify extra investigation, testing or task scope.

Conclusions are `pending`, `supported` or `refuted`. Revise the current content with a reason when the
conclusion changes; previous revisions remain available. Keep useful eliminated alternatives in the
current basis. User supplements are appended separately and retained when the conclusion is edited.

After saving, the AI explains why the approach was chosen, when it applies and what to check next time.
Users can keep asking questions; the AI answers from available material, saves actual user supplements
and revises the corresponding experience when a conclusion changes. After returning to code changes
and entering understanding review again, it reviews and updates the same finding. Unchanged content
does not need another write.

If saving fails, the AI identifies what remains unsaved, retains the request identity and follows
Core's correction, readback or retry instruction. A failed save is not an empty review or a successful
write; unresolved saves remain in understanding review. Only the user's explicit understanding verdict
allows the normal transition to delivery. Saving or exporting experience cannot supply it. Required
code changes still use the current legal return edges and verification rules.

Automatic collection is work performed by the current AI after entering the node. Core supplies node
requirements and persistence; it does not monitor chat, generate experience content or call another
model. This default collection timing does not restrict historical reading, explicit user supplements,
revisions or manual export, which retain their existing permissions.

## Finding and exporting

Open “Task experiences” in the local WebUI sidebar and search by keyword. The project filter accepts a
saved repository path or group ID; clicking a project in an experience applies that filter. Task details
also support reading, revision history, user supplements and export. Archived tasks remain searchable.

Core attempts export automatically after completion. Default paths:

```text
macOS:  ~/.dev-flow/data/experiences/<repository-group>/<task-id>.md
Windows: %LOCALAPPDATA%\dev-flow\data\experiences\<repository-group>\<task-id>.md
```

With `DEV_FLOW_DATA_DIR`, that directory replaces the default data directory. Exports stay outside task
repositories. If a custom directory would put an export inside a task repository, Core preserves pending
status and rejects the write. Core supplies the project and task identifiers; callers cannot select an
arbitrary destination.

SQLite holds the authoritative content. Markdown is an offline snapshot containing task context and
state, up to five supported takeaways, complete current experiences, references and user supplements.
Read older revisions through WebUI or Core. Export invokes no model and infers no new explanation.

No experiences means no export. Export failure does not undo `DONE`. Task details show failed or pending
export; use “Export Markdown” to retry. Hosts can call `dev_flow_export_experiences`. Repeated exports
replace the same complete file rather than appending duplicate text. Manual export also works for
paused, blocked, cancelled tasks and tasks with failed checks, preserving the actual state. This feature
adds no separate failure node.

Archiving retains database experience. The existing permanent Task deletion removes associated database
experience and export records; previously exported Markdown stays on disk. Worktree cleanup does not
remove experience files in the data directory.

## Core interface

See the [Command Reference](COMMANDS_en.md) and [shared Host examples](../skills/dev-flow/core/experience.md).

| Operation | Main inputs and results |
| --- | --- |
| `dev_flow_save_experience` | `host`, `task_id`, `experience_id`, `request_id`, `expected_revision`, `content`, `change_reason`; use revision 0 for creation; returns the saved experience |
| `dev_flow_add_experience_note` | The same identity fields, current experience `expected_revision`, and `user_note`; appends an actual user supplement |
| `dev_flow_get_experiences` | `host`, `task_id`, optional `experience_id` and `page`; current experiences by default, revision history for a specified experience; also returns export status |
| `dev_flow_search_experiences` | `host`, optional `task_id`, `project`, `text`, `page`; returns current experience, task state and archive flag |
| `dev_flow_export_experiences` | `host`, `task_id`; returns `generation`, `exported_generation`, `path`, `error` |

Writes retain Task origin-host ownership; both Hosts can read historical experiences. WebUI saves user
supplements through the same Core service. Experience revision is independent of Task revision; a pure
experience write changes no Task snapshot, Action, node or task event.

Generate and retain stable experience and request IDs before the first write. After response loss,
repeat the identical request. Reusing an ID with different content is rejected. Use a new request ID and
the latest experience revision for a changed conclusion; read current data after a conflict. One encoded
experience revision, including retained supplements, is limited to 65536 bytes; rejection reports actual
bytes. Individual content fields allow 8192 bytes, titles 240 bytes and references at most 32 entries.
Reads and searches return at most five records per page; follow `has_next`. Pages start at 1.

A nonempty `error` means export needs retry; `generation > exported_generation` means saved content has
pending changes. A successful outer `ok:true` does not establish that a file was exported; inspect these
fields. A crash during export can be followed by the same export again.

## Limits

Experience comes from the task AI and user. Core validates structure and associations; it does not prove
that every narrative or external reference is true. The recorded content digest is historical context
and grants no current verification or comprehension authority. Check conditions and references before
reusing a conclusion.

This feature provides local recording, explanation, export and basic lookup. It adds no model calls,
cross-task recommendations, vectors or learning scores. Users decide whether experience should become
project rules or team policy. Storage follows the project's current-layout-only policy without migration.
