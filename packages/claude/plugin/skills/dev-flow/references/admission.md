# Assessment and workspace preparation

Implementation: packages/claude/lib/workspace.mjs — inspect, prepare, provision, scope, session.

Read repository instructions, current source/contracts and Git status before admission. Before the user chooses Dev Flow, perform no Core calls, tests, dependency installation, writes, Git mutation or launch.

host-launch inspect takes request and repositories (each key and absolute repository_path). Repository keys follow Core's `^[a-z0-9][a-z0-9._-]{0,127}$` rule; preserve the selected keys throughout preparation, Task creation and relocation. Retain the entire result as assessment.anchor. Show change_level, candidate_components, candidate_paths, public_contract_flags, persistence_or_state_flags, host_or_platform_flags, verification_shape, unknowns and reasons. Resolve material unknowns; reuse the actual user choice.

The assessment anchor records HEAD/status and repository observations, not working-file contents.
Equal status digests do not prove an already dirty file is unchanged. Reassess known requirement or
code changes while waiting for a choice rather than treating the anchor as proof of content identity.

host-launch prepare takes request, assessment, user_choice, repositories and handoff. user_choice has source=user, mode=dev_flow and the actual decision summary. Each repository has key, repository_path, workspace_mode, source_type, remote_name, base_branch, target_branch, carry_changes, worktree_path. Use observed canonical roots/branches. Modes are new_branch, current_branch, dedicated_worktree. Local modes use source_type=local, remote_name empty and worktree_path=repository_path. Never invent permission to carry dirty files. Remote sources cannot carry changes. Dedicated destinations are explicit absolute paths.

For a dedicated workspace retain complete original relevant discussion in handoff.discussion, with confirmed requirements, corrections and open questions distinguished. Do not reconstruct unavailable original messages. Local current-session work uses handoff=null.

Prepare verifies the exact assessment anchor, all repository selections and Core occupancy before retaining a launch. It resolves the selected base and retains snapshot identity without changing the source index. Save launch_id. host-launch provision takes only launch_id and prepares every repository. Failure leaves operation records and local files for inspection; never erase the failed worktree or replay an uncertain operation automatically.

The shared snapshot helper compares HEAD and the index, working-file, and untracked Git trees from
two reads. Changed content stops preparation even if status is unchanged, without returning a
snapshot or retrying automatically. Inspect the source and retained launch record before continuing.
Preparation still requires one writer; these checks do not provide an atomic snapshot under arbitrary
concurrent writes or expand the assessment anchor's contract.

host-launch scope takes launch_id, verifies current repository identity and branch and returns the complete Core creation scope only when all repositories are provisioned. Pass the returned primary_repository_key even for a single repository. Add host=claude and the new_task fields per the shared opening contract. A known/uncertain prior creation requires matching Core lookup/resume first.

After a successful Core open, call host-launch bind-task with launch_id and the actual returned task_id. The receipt retains only that identity. Resume a bound Task by reading that ID and handling Core recovery; relocation never authorizes a second Core creation. Do not manufacture a Task ID or treat this binding as a workflow cursor.

Current-directory work stays in this session. For independent workspaces, host-launch launch takes launch_id and returns executable, arguments, cwd and session_id. Use those exact argv/cwd in a real interactive terminal with all roots authorized. It records launch intent before returning; do not call launch again after a timeout. host-launch record-session takes launch_id and the actual session_id after observing that exact session. host-launch resume returns the saved UUID descriptor. Read the same process/session output rather than dispatching another consumer.
