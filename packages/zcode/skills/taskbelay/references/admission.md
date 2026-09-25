# Assessment and workspace preparation

Implementation: `packages/zcode/lib/workspace.mjs` — `inspect, prepare, provision, scope, bindTask, session`.

Read repository instructions, current source/contracts and Git status before admission. Before the user chooses TaskBelay, make no Core calls, run no tests, install no dependencies, write no files, mutate no Git state and open no new development session. Reuse current explicit choices and authorization.

`host-launch inspect` receives `request` and `repositories`, each with `key` and an absolute `repository_path`. Keys follow Core's `^[a-z0-9][a-z0-9._-]{0,127}$` rule. Preserve these keys throughout preparation, creation and relocation. Retain the complete result as `assessment.anchor`. Show `change_level`, `candidate_components`, `candidate_paths`, `public_contract_flags`, `persistence_or_state_flags`, `host_or_platform_flags`, `verification_shape`, `unknowns` and `reasons`. Resolve material unknowns and retain the actual user choice.

The anchor records HEAD/status and repository observations, not working-file contents. Equal status digests do not prove an already dirty file is unchanged. Reassess known changes to requirements or relevant code while waiting for a choice.

`host-launch prepare` receives exactly `request`, `assessment`, `user_choice`, `repositories` and `handoff`. `user_choice` has `source=user`, `mode=taskbelay` and the actual decision `summary`. Each repository provides exactly `key`, `repository_path`, `workspace_mode`, `source_type`, `remote_name`, `base_branch`, `target_branch`, `carry_changes`, `worktree_path`.

- Use observed canonical roots and branches. Modes are `new_branch`, `current_branch`, `dedicated_worktree`.
- Local modes use `source_type=local`, empty `remote_name`, and `worktree_path=repository_path`.
- Never infer permission to carry dirty files. Remote sources cannot carry changes. Dedicated destinations are explicit absolute paths.
- For a dedicated workspace or a planned transfer to another session, retain the full relevant discussion in `handoff.discussion`, distinguishing confirmed requirements, corrections and unresolved questions. Do not reconstruct unavailable original messages. Work staying in the current session can use `handoff=null`.

Prepare verifies the exact anchor, selections and local occupancy before retaining a launch, resolving the selected base and capturing carried content. It saves the receipt before any Git mutation. Retain `launch_id`. `host-launch provision` receives only `launch_id` and prepares every repository. Failure preserves the receipt and local files; do not erase failed worktrees or replay uncertain operations.

The shared snapshot helper compares HEAD and index, working-file and untracked Git trees from two reads. Changed content stops preparation even when status is unchanged, without retrying automatically. Inspect the source and saved receipt; the preparation requires one writer and is not an atomic snapshot under arbitrary concurrent writes.

`host-launch scope` receives only `launch_id`, verifies each workspace identity and branch, and returns complete Core creation scope only after all repositories are provisioned. Pass `primary_repository_key` even for one repository. Add `host=zcode` and `new_task` according to the shared opening contract. Known or uncertain prior creation requires Core lookup/recovery first.

After successful Core open, call `host-launch bind-task` with `launch_id` and the actual returned `task_id`. This binds an identity, not a workflow cursor. Resume that Task by ID and handle Core recovery; relocation does not authorize another creation.

Current-directory work remains in the authorized current session. `host-launch open` and `host-launch resume` receive only `launch_id`. They validate scope and return `status=action_required`, `workspace_paths`, `receipt_path`, `task_id` and the full `prompt` with `next_steps`. They neither start a process nor record a fabricated ZCode session identity. Open the actual prepared workspace through ZCode UI when necessary, authorize all listed roots, and pass the entire prompt to the TaskBelay Skill. Re-reading this descriptor is safe; it is not permission to duplicate Core creation or start competing consumers.

## Host-launch requests

Use the [Host command transport](transport.md) for each JSON object below. Paths, IDs and digests are examples. Keep the actual `inspect` response as `assessment.anchor`, the actual `prepare` response's `launch_id` for subsequent calls, and the exact `scope` result for `taskbelay_open_task`. Do not reuse sample identities.

`inspect` takes only the admitted request and selected repository roots:

<!-- example:host-launch inspect request -->
```json
{"request":"Implement the endpoint field.","repositories":[{"key":"primary","repository_path":"/work/project"}]}
```

It returns the complete assessment anchor shape:

<!-- example:host-launch-output inspect success -->
```json
{"request_digest":"2222222222222222222222222222222222222222222222222222222222222222","repositories":[{"key":"primary","repository_path":"/work/project","head":"1111111111111111111111111111111111111111","branch":"main","status_digest":"3333333333333333333333333333333333333333333333333333333333333333","clean":true,"source_identity":"4444444444444444444444444444444444444444444444444444444444444444"}]}
```

The Agent supplies the resolved impact assessment and the user's actual workspace choices to `prepare`. The `anchor` below is the unchanged `inspect` result. The example prepares a new branch in the current session:

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

Successful `prepare` returns a Host receipt directly. `launch_id` and the receipt's digests are generated for this launch:

<!-- example:host-launch-output prepare success -->
```json
{
  "launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "host":"zcode",
  "request":"Implement the endpoint field.",
  "assessment":{"change_level":"standard","candidate_components":["endpoint"],"candidate_paths":["src/endpoint.go"],"public_contract_flags":["response field"],"persistence_or_state_flags":[],"host_or_platform_flags":[],"verification_shape":["endpoint check"],"reasons":["changes a public response"],"unknowns":[],"anchor":{"request_digest":"2222222222222222222222222222222222222222222222222222222222222222","repositories":[{"key":"primary","repository_path":"/work/project","head":"1111111111111111111111111111111111111111","branch":"main","status_digest":"3333333333333333333333333333333333333333333333333333333333333333","clean":true,"source_identity":"4444444444444444444444444444444444444444444444444444444444444444"}]}},
  "user_choice":{"source":"user","mode":"taskbelay","summary":"Use TaskBelay in a new local branch without carrying changes."},
  "handoff":null,
  "handoff_digest":"5555555555555555555555555555555555555555555555555555555555555555",
  "repositories":[{"key":"primary","repository_path":"/work/project","workspace_mode":"new_branch","source_type":"local","remote_name":"","base_branch":"main","target_branch":"task/endpoint-field","carry_changes":false,"worktree_path":"/work/project","source_identity":"4444444444444444444444444444444444444444444444444444444444444444","base_commit":"1111111111111111111111111111111111111111","snapshot":null,"phase":"prepared"}],
  "relocation":null
}
```

The remaining preparation and UI calls use the saved `launch_id`:

| Operation | Complete input | Successful result |
| --- | --- | --- |
| `provision` | `{"launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}` | The updated receipt: every repository has `phase:"provisioned"` and a `worktree_identity`. |
| `status` | `{"launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}` | The complete saved receipt, including any incomplete operation phase; read it after an uncertain Host call. |
| `scope` | `{"launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}` | The complete Core creation repository members shown below. |
| `bind-task` | `{"launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","task_id":"task-from-core"}` | The updated receipt with `core_task_id:"task-from-core"`; bind only an actual successful Core result or verified readback. |
| `open` | `{"launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}` | UI guidance with `status:"action_required"`; no ZCode session has been launched. |
| `resume` | `{"launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}` | The same UI guidance shape, with the retained `task_id` when one is bound. |

After `provision`, `scope` returns the exact repository members to combine with `host:"zcode"` and `new_task` for the [Core creation request](connection.md#open-or-resume-a-task):

<!-- example:host-launch-output scope success -->
```json
{"repository_path":"/work/project","primary_repository_key":"primary","workspace_origin":{"mode":"new_branch","source_type":"local","carry_changes":false,"remote_name":"","base_branch":"main","base_commit":"1111111111111111111111111111111111111111","task_branch":"task/endpoint-field","provisioning_receipt_id":"zcode-6666666666666666666666666666666666666666666666666666666666666666"}}
```

`open` and `resume` return a direct Host response with `operation`, `status`, `host`, `launch_id`, `receipt_path`, `task_id`, `workspace_paths`, `prompt` and `next_steps`; pass the complete actual `prompt` to the destination Skill. For example, an unbound `open` response has this complete shape:

<!-- example:host-launch-output open success -->
```json
{"operation":"open","status":"action_required","host":"zcode","launch_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","receipt_path":"/private/taskbelay/provisioning/zcode/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/receipt.json","task_id":null,"workspace_paths":["/work/project"],"prompt":"Continue this TaskBelay task in its prepared workspace. First read the entire retained request, assessment and original discussion at /private/taskbelay/provisioning/zcode/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/receipt.json. Read taskbelay-zcode host-launch status and scope for launch aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa; verify every actual workspace and its permissions, and preserve existing content. Discover the actual plugin MCP tools and perform server_info before work. Check Core for an existing Task in these exact repositories before creation. An unbound launch receipt does not prove that Core creation never occurred. If a previous open result is uncertain, recover it first. After a successful open, save the actual task_id with host-launch bind-task. Follow the saved Core Action and preserve the user's requirements and corrections.","next_steps":["In ZCode, open the listed prepared workspace directories and grant only the required workspace permissions. If the current session already has access to all of them, continue there.","Use the installed TaskBelay Skill in that workspace and provide the complete prompt above. This command has not opened or resumed a ZCode session."]}
```

A rejected `inspect` or `prepare` exits nonzero, writes its error on stderr and no success JSON on stdout. For example, an assessment with nonempty `unknowns` is rejected before a receipt is saved: `taskbelay-zcode: Complete resolved assessment required`. If `prepare` saved a receipt before failing, stderr also reports its `launch_id` and `receipt_path`; read that saved launch instead of repeating preparation.
