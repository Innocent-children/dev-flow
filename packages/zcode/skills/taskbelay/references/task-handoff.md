# Requirement handoff

Implementation: `packages/zcode/lib/workspace.mjs` — `prepare, session`.

Preserve the original relevant user/assistant messages in `handoff.discussion`, together with current request, confirmed requirements and later corrections. Keep unaccepted suggestions, assumptions and unresolved questions separate. Preserve message identity when available and do not invent inaccessible originals. Current user instructions and applicable repository rules remain authoritative.

For a dedicated worktree or session transfer, `host-launch prepare` receives this `handoff` member inside its complete request. Replace the example with the actual available messages in their original order; the example does not authorize summarizing or inventing a missing message:

```json
{"discussion":[{"role":"user","text":"Implement the endpoint field."},{"role":"user","text":"Keep the existing response fields."}]}
```

The receipt binds request to assessment and handoff to its content digest. A changed request or discussion is rejected before preparation is consumed; inspect the original saved record rather than creating another launch. The receipt is retained outside Task workspaces under the TaskBelay product directory, in `provisioning/zcode/<launch_id>/receipt.json`.

`host-launch open|resume` produces the paths and complete prompt for ZCode UI. Read the full retained material in the destination session, verify every workspace and its permissions, preserve carried content, and distinguish Core creation from resume. A saved `core_task_id` must resume that exact Task. With no saved task_id, inspect Core and any uncertain prior response before creation; an unbound receipt is not proof that no Task was created.

There is no Adapter-owned ZCode session UUID, session launcher or second process cursor. UI guidance is safe to read again, but the user/Host must ensure only one consumer works on the prepared Task. ZCode's actual UI/session capabilities determine how the destination opens; never substitute Claude CLI flags.
