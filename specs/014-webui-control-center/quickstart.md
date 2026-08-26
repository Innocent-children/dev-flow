# Quickstart: Feature 014 Checkpoints

## Boundary

This guide describes the shortest user-visible acceptance journey for each checkpoint. Exact implementation files, test
symbols and commands belong to `tasks.md`. Automated evidence is limited to `V01`–`V08` in [`plan.md`](plan.md); UI
appearance and interaction are accepted manually by the product owner.

No checkpoint performs Git mutation, version alignment, release or publication.

## CP1: Find and understand a Task

**Initial state**: The current data store contains active, blocked, done and cancelled Tasks, including one Task that repeats
a node or transition.

**Journey**:

1. Start the WebUI and open the dashboard.
2. Filter the Task list by keyword, Host, repository, node, lifecycle and updated time.
3. Open a Task and inspect its detail, timeline and graph.
4. Confirm that the graph distinguishes committed, current legal and future reachable paths without presenting future
   reachability as a passed Guard.
5. Change the Task through another compatible Core process and wait for the next poll.

**Expected outcome**: The page reloads one authoritative Task view, shows the new revision within five seconds and disables
the stale operation form.

**Failure and recovery**: Unknown process data, inconsistent events or a failed poll produces an explicit read-only or stale
state. Restore readable current data or a successful poll before mutation is enabled again.

## CP2: Manage the Task lifecycle

**Initial state**: One repository can open or resume a Task; separate fixtures provide active and terminal Tasks.

**Journey**:

1. Create or resume a Task from its request, Scope, acceptance criteria, verification budget, method profile and Host.
2. Cancel an active Task with its current revision, reason and confirmation.
3. Archive and restore a terminal Task.
4. Purge an eligible terminal Task after entering its exact Task ID, reason and irreversible confirmation.

**Expected outcome**: Core owns every result. Cancellation releases claims, archive changes presentation only, and purge
removes only records linked to the selected Task.

**Failure and recovery**: A stale revision, non-terminal Task, remaining claim or mismatched confirmation produces zero
writes. Reload the current Task and retry only when the displayed Core result makes the operation eligible.

## CP3: Execute Action and Recovery

**Initial state**: Reference Tasks expose representative Action contracts, a Guard failure, an uncertain operation and a
Blocker.

**Journey**:

1. Open the current Action and inspect its identity, conditions, allowed effects, Evidence, method steps and transitions.
2. Submit the current contract without choosing an arbitrary destination.
3. Correct a Core-returned field or Guard error while the Action identity remains current.
4. For an uncertain operation, request Core Recovery advice using the retained operation probe and follow only that advice.
5. Resolve a Blocker through its current contract and use the Core-returned resume node.

**Expected outcome**: The page advances only from the returned Core Task and Action. MCP and Web projections retain the
same Workflow-owned Action meaning.

**Failure and recovery**: If the operation probe is unavailable or stale, return to the current Task instead of fabricating
or guessing Recovery input.

## CP4: Run and share the local WebUI

**Initial state**: Maintained Host packages contain a compatible Core and embedded Web assets. A separate temporary data root
contains pre-Feature Task data for the reset journey.

**Journey**:

1. Use Host A to start the WebUI.
2. Use Host B to read status and open the same live URL.
3. Confirm both Hosts identify the same process and data root and serve the embedded assets.
4. Use Core CLI status and stop for the normal lifecycle.
5. Against the temporary old-data root, read the CLI reset plan, confirm the exact targets and complete reset while Core has
   exclusive database access.

**Expected outcome**: Host B reuses Host A's WebUI instead of starting another instance. Reset deletes only confirmed Task
data and leaves Adapter packages, registrations, configuration and unrelated files intact.

**Failure and recovery**: An incompatible live process returns incompatible. A changed reset target or unavailable exclusive
access returns zero deletes and requires a new plan against current targets.

## Completion evidence

- `V01`–`V06` provide the targeted automated evidence at their assigned authority layers.
- `V07` is the single Host A start / Host B reuse journey above; it does not repeat Task operations, reset or the full CLI
  lifecycle.
- `V08` runs `pnpm run validate` once after `V01`–`V07`. No targeted group is explicitly rerun immediately before it.
- The product owner completes manual UI acceptance using [`contracts/visual-design.md`](contracts/visual-design.md).
