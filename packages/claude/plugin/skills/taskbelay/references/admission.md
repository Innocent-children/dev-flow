# Assessment and workspace preparation

Implementation: `packages/claude/lib/workspace.mjs` — inspect, prepare, provision, scope, session.

Read repository instructions, current source/contracts and Git status before admission. Before the user chooses TaskBelay, perform no Core calls, tests, dependency installation, writes, Git mutation or launch.

host-launch inspect takes request and repositories (each key and absolute repository_path). Repository keys follow Core's `^[a-z0-9][a-z0-9._-]{0,127}$` rule; preserve the selected keys throughout preparation, Task creation and relocation. Retain the entire result as assessment.anchor. Show change_level, candidate_components, candidate_paths, public_contract_flags, persistence_or_state_flags, host_or_platform_flags, verification_shape, unknowns and reasons. Resolve material unknowns; reuse the actual user choice.

The assessment anchor records HEAD/status and repository observations, not working-file contents.
Equal status digests do not prove an already dirty file is unchanged. Reassess known requirement or
code changes while waiting for a choice rather than treating the anchor as proof of content identity.

host-launch prepare takes request, assessment, user_choice, repositories and handoff. user_choice has source=user, mode=taskbelay and the actual decision summary. Each repository has key, repository_path, workspace_mode, source_type, remote_name, base_branch, target_branch, carry_changes, worktree_path. Use observed canonical roots/branches. Modes are new_branch, current_branch, dedicated_worktree. Local modes use source_type=local, remote_name empty and worktree_path=repository_path. Never invent permission to carry dirty files. Remote sources cannot carry changes. Dedicated destinations are explicit absolute paths.

For a dedicated workspace retain complete original relevant discussion in `handoff.discussion`, following [requirement handoff](task-handoff.md). Keep confirmed requirements, corrections and open questions distinct. Do not reconstruct unavailable original messages. Local current-session work uses `handoff=null`.

Prepare verifies the exact assessment anchor, all repository selections and Core occupancy before retaining a launch. It resolves the selected base and retains snapshot identity without changing the source index. Save launch_id. host-launch provision takes only launch_id and prepares every repository. Failure leaves operation records and local files for inspection; never erase the failed worktree or replay an uncertain operation automatically.

The shared snapshot helper compares HEAD and the index, working-file, and untracked Git trees from
two reads. Changed content stops preparation even if status is unchanged, without returning a
snapshot or retrying automatically. Inspect the source and retained launch record before continuing.
Preparation still requires one writer; these checks do not provide an atomic snapshot under arbitrary
concurrent writes or expand the assessment anchor's contract.

host-launch scope takes launch_id, verifies current repository identity and branch and returns the complete Core creation scope only when all repositories are provisioned. Pass the returned primary_repository_key even for a single repository. Add host=claude and the new_task fields per the shared opening contract. A known/uncertain prior creation requires matching Core lookup/resume first.

After a successful Core open, call host-launch bind-task with launch_id and the actual returned task_id. The receipt retains only that identity. Resume a bound Task by reading that ID and handling Core recovery; relocation never authorizes a second Core creation. Do not manufacture a Task ID or treat this binding as a workflow cursor.

Current-directory work stays in this session. For independent workspaces, host-launch launch takes launch_id and returns executable, arguments, cwd and session_id. Use those exact argv/cwd in a real interactive terminal with all roots authorized. It records launch intent before returning; do not call launch again after a timeout. host-launch record-session takes launch_id and the actual session_id after observing that exact session. host-launch resume returns the saved UUID descriptor. Read the same process/session output rather than dispatching another consumer.

## Host-launch requests

Use the [Host command transport](transport.md) for each JSON object below. The paths, IDs and digests are examples. Copy the actual `inspect` result into `assessment.anchor`, the actual `prepare` result's `launch_id` into later inputs, and the exact `scope` result into the repository members of `taskbelay_open_task`. Do not recompute or reuse example identities.

`inspect` takes only the admitted request and selected repository roots:

<!-- example:host-launch inspect request -->
```json
{"request":"Implement the endpoint field.","repositories":[{"key":"primary","repository_path":"/work/project"}]}
```

It returns this complete anchor shape, not an assessment or a Core Task:

<!-- example:host-launch-output inspect success -->
```json
{"request_digest":"2222222222222222222222222222222222222222222222222222222222222222","repositories":[{"key":"primary","repository_path":"/work/project","head":"1111111111111111111111111111111111111111","branch":"main","status_digest":"3333333333333333333333333333333333333333333333333333333333333333","clean":true,"source_identity":"4444444444444444444444444444444444444444444444444444444444444444"}]}
```

The Agent supplies its resolved impact assessment and the user's actual choices to `prepare`. The `anchor` member below is the unchanged `inspect` response above; `unknowns` must be empty and the impact, verification and reason arrays must be meaningful. This local new-branch example keeps work in the current session:

<!-- example:host-launch prepare request -->
```json
{
  "request": "Implement the endpoint field.",
  "assessment": {
    "change_level": "standard",
    "candidate_components": ["endpoint"],
    "candidate_paths": ["src/endpoint.go"],
    "public_contract_flags": ["response field"],
    "persistence_or_state_flags": [],
    "host_or_platform_flags": [],
    "verification_shape": ["endpoint check"],
    "reasons": ["changes a public response"],
    "unknowns": [],
    "anchor": {
      "request_digest": "2222222222222222222222222222222222222222222222222222222222222222",
      "repositories": [{"key":"primary","repository_path":"/work/project","head":"1111111111111111111111111111111111111111","branch":"main","status_digest":"3333333333333333333333333333333333333333333333333333333333333333","clean":true,"source_identity":"4444444444444444444444444444444444444444444444444444444444444444"}]
    }
  },
  "user_choice": {"source":"user","mode":"taskbelay","summary":"Use TaskBelay in a new local branch without carrying changes."},
  "repositories": [{"key":"primary","repository_path":"/work/project","workspace_mode":"new_branch","source_type":"local","remote_name":"","base_branch":"main","target_branch":"task/endpoint-field","carry_changes":false,"worktree_path":"/work/project"}],
  "handoff": null
}
```

Successful `prepare` returns a Host receipt directly. `launch_id` is generated; its value and the receipt's digests come from this call:

<!-- example:host-launch-output prepare success -->
```json
{
  "launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "host":"claude",
  "request":"Implement the endpoint field.",
  "assessment":{"change_level":"standard","candidate_components":["endpoint"],"candidate_paths":["src/endpoint.go"],"public_contract_flags":["response field"],"persistence_or_state_flags":[],"host_or_platform_flags":[],"verification_shape":["endpoint check"],"reasons":["changes a public response"],"unknowns":[],"anchor":{"request_digest":"2222222222222222222222222222222222222222222222222222222222222222","repositories":[{"key":"primary","repository_path":"/work/project","head":"1111111111111111111111111111111111111111","branch":"main","status_digest":"3333333333333333333333333333333333333333333333333333333333333333","clean":true,"source_identity":"4444444444444444444444444444444444444444444444444444444444444444"}]}},
  "user_choice":{"source":"user","mode":"taskbelay","summary":"Use TaskBelay in a new local branch without carrying changes."},
  "handoff":null,
  "handoff_digest":"5555555555555555555555555555555555555555555555555555555555555555",
  "repositories":[{"key":"primary","repository_path":"/work/project","workspace_mode":"new_branch","source_type":"local","remote_name":"","base_branch":"main","target_branch":"task/endpoint-field","carry_changes":false,"worktree_path":"/work/project","source_identity":"4444444444444444444444444444444444444444444444444444444444444444","base_commit":"1111111111111111111111111111111111111111","snapshot":null,"phase":"prepared"}],
  "session":null,
  "relocation":null
}
```

The remaining preparation calls use the retained `launch_id`. Use `launch`, `record-session` and `resume` only when another Claude session must continue in a prepared workspace; local current-session work continues here:

| Operation | Complete input | Successful result |
| --- | --- | --- |
| `provision` | `{"launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}` | The updated receipt: every repository has `phase:"provisioned"` and a `worktree_identity`. |
| `status` | `{"launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}` | The complete saved receipt, including any incomplete operation phase. This is the first read after an uncertain Host call. |
| `scope` | `{"launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}` | The complete Core creation repository members shown below. |
| `bind-task` | `{"launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","task_id":"task-from-core"}` | The updated receipt with `core_task_id:"task-from-core"`; use only the ID from a successful Core open or verified readback. |
| `launch` | `{"launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}` | A descriptor with `executable`, `arguments`, `cwd` and `session_id`; it records launch intent but does not start Claude. |
| `record-session` | `{"launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","session_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}` | `{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","phase":"observed"}` after the actual session has been observed. The ID must match the saved launch. |
| `resume` | `{"launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}` | The retained Claude session descriptor; use its `--resume` arguments once in the actual Host terminal. |

For a dedicated workspace, `launch` returns a complete descriptor of this shape. Use the actual returned `arguments` array rather than reconstructing the prompt or shell command:

<!-- example:host-launch-output launch success -->
```json
{"executable":"claude","arguments":["--session-id","bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","--","Continue this TaskBelay task in the prepared workspace. First read the entire retained request and original discussion at /private/taskbelay/provisioning/claude/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/receipt.json. Read taskbelay-claude host-launch status and scope for launch aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa. Preserve existing content. Perform server_info. Resume an existing matching Core Task, and create only after establishing that no prior Core creation occurred. After a successful open, record its actual task_id with host-launch bind-task. Retain all original requirements and corrections from the saved discussion."],"cwd":"/work/project","session_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}
```

After `provision`, `scope` returns the exact object to combine with `host:"claude"` and `new_task` for the [Core creation request](connection.md#open-or-resume-a-task):

<!-- example:host-launch-output scope success -->
```json
{"repository_path":"/work/project","primary_repository_key":"primary","workspace_origin":{"mode":"new_branch","source_type":"local","carry_changes":false,"remote_name":"","base_branch":"main","base_commit":"1111111111111111111111111111111111111111","task_branch":"task/endpoint-field","provisioning_receipt_id":"claude-6666666666666666666666666666666666666666666666666666666666666666"}}
```

A rejected `inspect` or `prepare` exits nonzero with a concrete message on stderr and no success JSON on stdout. For example, `prepare` rejects an assessment with nonempty `unknowns` before saving a receipt: `taskbelay-claude: Complete resolved assessment required`. After a failed or lost call that may have saved a receipt, read `status` using an already retained `launch_id`. When no ID was returned or retained, stop for inspection; the CLI error does not provide a new ID. Do not repeat `prepare` with guessed inputs.
