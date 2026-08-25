# Quickstart: Repository Binding Authorized Mutations

## REQUIREMENTS authorized edit

1. Create a Task in a temporary Git repository and retain its REQUIREMENTS Action.
2. Modify `.specify/feature.json`, Feature `README.md`, `spec.md` and `checklists/requirements.md` without
   changing branch or HEAD.
3. Submit those exact `changed_paths`, `no_file_changes=false` and a valid requirements result.
4. Expect DESIGN, revision +1 and a next Action bound to the fresh worktree.

## IMPLEMENT and REFACTOR

Reach each node, modify only exact authorized paths, submit them in `changed_paths`, and expect the selected
legal next node with a fresh binding.

## Forbidden drift

Change one of branch, HEAD, repository identity, canonical root or an undeclared path. Expect the stable
stale/drift error and unchanged Task revision/event/claim counts.

## Dirty baseline

Open with an existing modified and untracked file. Leave their bytes/status unchanged, edit one new path and
declare only that path. Expect success without treating baseline content as new effect.

## Multi-repository and restart

Create two repositories, issue one Action, modify scoped paths, reopen the Service against the same temporary
SQLite, then apply the persisted Action. Expect atomic success. Changing HEAD or branch in either repository
instead must stop the whole mutation with zero writes.

## Targeted commands

Run only commands listed in `plan.md`; record command, result and consumed count in `tasks.md`.
