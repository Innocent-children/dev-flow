# Assessment and workspace preparation

Implementation: `packages/zcode/lib/workspace.mjs` — `inspect, prepare, provision, scope, bindTask, session`.

Read repository instructions, current source/contracts and Git status before admission. Before the user chooses Dev Flow, make no Core calls, run no tests, install no dependencies, write no files, mutate no Git state and open no new development session. Reuse current explicit choices and authorization.

`host-launch inspect` receives `request` and `repositories`, each with `key` and an absolute `repository_path`. Keys follow Core's `^[a-z0-9][a-z0-9._-]{0,127}$` rule. Preserve these keys throughout preparation, creation and relocation. Retain the complete result as `assessment.anchor`. Show `change_level`, `candidate_components`, `candidate_paths`, `public_contract_flags`, `persistence_or_state_flags`, `host_or_platform_flags`, `verification_shape`, `unknowns` and `reasons`. Resolve material unknowns and retain the actual user choice.

The anchor records HEAD/status and repository observations, not working-file contents. Equal status digests do not prove an already dirty file is unchanged. Reassess known changes to requirements or relevant code while waiting for a choice.

`host-launch prepare` receives exactly `request`, `assessment`, `user_choice`, `repositories` and `handoff`. `user_choice` has `source=user`, `mode=dev_flow` and the actual decision `summary`. Each repository provides exactly `key`, `repository_path`, `workspace_mode`, `source_type`, `remote_name`, `base_branch`, `target_branch`, `carry_changes`, `worktree_path`.

- Use observed canonical roots and branches. Modes are `new_branch`, `current_branch`, `dedicated_worktree`.
- Local modes use `source_type=local`, empty `remote_name`, and `worktree_path=repository_path`.
- Never infer permission to carry dirty files. Remote sources cannot carry changes. Dedicated destinations are explicit absolute paths.
- For a dedicated workspace or a planned transfer to another session, retain the full relevant discussion in `handoff.discussion`, distinguishing confirmed requirements, corrections and unresolved questions. Do not reconstruct unavailable original messages. Work staying in the current session can use `handoff=null`.

Prepare verifies the exact anchor, selections and local occupancy before retaining a launch, resolving the selected base and capturing carried content. It saves the receipt before any Git mutation. Retain `launch_id`. `host-launch provision` receives only `launch_id` and prepares every repository. Failure preserves the receipt and local files; do not erase failed worktrees or replay uncertain operations.

The shared snapshot helper compares HEAD and index, working-file and untracked Git trees from two reads. Changed content stops preparation even when status is unchanged, without retrying automatically. Inspect the source and saved receipt; the preparation requires one writer and is not an atomic snapshot under arbitrary concurrent writes.

`host-launch scope` receives only `launch_id`, verifies each workspace identity and branch, and returns complete Core creation scope only after all repositories are provisioned. Pass `primary_repository_key` even for one repository. Add `host=zcode` and `new_task` according to the shared opening contract. Known or uncertain prior creation requires Core lookup/recovery first.

After successful Core open, call `host-launch bind-task` with `launch_id` and the actual returned `task_id`. This binds an identity, not a workflow cursor. Resume that Task by ID and handle Core recovery; relocation does not authorize another creation.

Current-directory work remains in the authorized current session. `host-launch open` and `host-launch resume` receive only `launch_id`. They validate scope and return `status=action_required`, `workspace_paths`, `receipt_path`, `task_id` and the full `prompt` with `next_steps`. They neither start a process nor record a fabricated ZCode session identity. Open the actual prepared workspace through ZCode UI when necessary, authorize all listed roots, and pass the entire prompt to the Dev Flow Skill. Re-reading this descriptor is safe; it is not permission to duplicate Core creation or start competing consumers.
