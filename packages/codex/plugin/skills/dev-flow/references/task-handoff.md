# Sender Requirements Handoff

The original Codex session collects the complete relevant requirements discussion and supplies one
UTF-8 JSON file to `dev-flow-codex host-launch prepare`. This reference describes the sender's input
and rendering contract. Core continues to own Task state and semantic submissions.

Implementation: `packages/codex/lib/task-handoff.mjs` — `validateTaskHandoff`, `writeTaskHandoff`, `buildManagedBootstrapPrompt`.

The helper checks structure/references and renders supplied content. The collection and provenance
policies below are Host responsibilities; validation does not prove the user accepted a statement.
The complete `prepare` input and result handling are in [admission](admission.md#prepare).

## Collection and classification

Read the discussion from the first relevant request through the final additions before launch.
Direct user requirements are already authorized requirements; an assistant proposal becomes a
confirmed requirement only when a user explicitly accepts it. Later user corrections determine the
current requirement. Retain earlier wording in the original discussion, with its historical role.

Preserve concrete examples, terminology definitions, constraints, and session-specific working rules.
Code findings name the inspected repository/path and the observed commit or dirty context. Unverified explanations
belong in assumptions. A final instruction to start development or confirm a branch does not accept
all preceding suggestions. No extra approval of the handoff document is required.

Use native message IDs when available, or assign local IDs in chronological order. `discussion.text`
contains actual original message text, preserving wording and whitespace. A native summary is not
an original message. If earlier original messages cannot be accessed, describe that exact gap in
`open_questions`; never fabricate the missing text. Exclude unrelated discussion, credentials, and
automatically injected instruction blocks. Actual user messages discussing or changing a task-relevant
rule remain original discussion; an automatically supplied `AGENTS.md` block does not become a user
requirement merely because it appears in the session context.

## Instruction sources

The sender selects task context; the destination Codex session loads applicable instruction files.
`work_requirements` contains session-specific instructions and authorizations, such as the selected
method profile, a task-specific verification constraint, and the confirmed scope of Git operations.

- Automatically discoverable global and repository `AGENTS.md` instructions stay in their source
  files. Do not copy or summarize them into `work_requirements`, other fields, retained discussion,
  or the bootstrap prompt. With the same `CODEX_HOME`, changing worktrees alone does not prevent
  global instruction discovery. Repository instructions are discovered from the destination checkout.
- When a task-relevant rule cannot be discovered there, record its source path, applicable scope,
  and concrete discovery gap in `work_requirements`. Prefer a reference to a source file the receiver
  can read. If that file is unavailable to the receiver, include only the necessary applicable text,
  excluding credentials. This carries instructions, not source checkout changes or copied files.
- If availability is unverified, record the specific uncertainty in `open_questions` instead of
  duplicating rule files as a precaution. The receiver checks the stated source and scope when applying
  a supplement alongside its normally loaded instructions.

For example, a shared global file's Java and Maven rules do not belong in a handoff for an unrelated
Python repository. An explicit conversation instruction to use OpenSpec and not push commits belongs
in `work_requirements`, with its message source. An applicable untracked repository instruction file
absent from the confirmed base needs a source-path reference and a statement of its repository scope
and absence from the destination checkout; it is not copied into the new worktree. A user request to
change an `AGENTS.md` rule remains a real requirement and retains its original discussion.

Before saving, check both the structured fields and retained discussion for duplicated instruction
files or injected blocks. Confirm that session-specific requirements, corrections, and authorizations
remain complete. The helper validates structure and renders the supplied content unchanged; it does
not infer instruction provenance or remove text by keyword.

## Closed JSON shape

Every top-level member below is required. `request` exactly matches the request supplied to
`host-launch inspect` and `prepare`; it is the admitted request overview. The remaining members carry
the full development context. Use empty arrays only when no corresponding item was established.

<!-- task-handoff-example:start -->
```json
{
  "request": "Add the confirmed input preview.",
  "goal": "Let the user inspect the original input text.",
  "confirmed_requirements": [
    {"text": "Preserve whitespace in the Raw view.", "source_ids": ["m1"]}
  ],
  "terminology": ["Raw means the original input, including whitespace (m1)."],
  "scope_and_constraints": ["Limit this change to input preview (m1)."],
  "investigation": [],
  "work_requirements": [],
  "unconfirmed_suggestions": ["Automatic saving was suggested in m2 and has not been accepted."],
  "assumptions": [],
  "open_questions": [],
  "discussion": [
    {"id": "m1", "role": "user", "text": "Add input preview only. Raw means the original input, including whitespace."},
    {"id": "m2", "role": "assistant", "text": "We could also add automatic saving."},
    {"id": "m3", "role": "user", "text": "Start development."}
  ]
}
```
<!-- task-handoff-example:end -->

`request`, `goal`, and every text item are non-empty strings. Each of `terminology`,
`scope_and_constraints`, `investigation`, `work_requirements`, `unconfirmed_suggestions`, `assumptions`,
and `open_questions` is an array of strings. Include source message IDs or repository paths in those
strings where they explain the statement.

`confirmed_requirements` is a non-empty array of closed `{text, source_ids}` objects. Every
`source_ids` value names a retained discussion message, and at least one names a user message.
For an accepted assistant proposal, cite both the proposal and its explicit user acceptance.
`discussion` is a non-empty ordered array of closed `{id, role, text}` objects. IDs are unique and
match `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`; roles are exactly `user` or `assistant`.

The helper checks shape and references. The source session remains responsible for the meaning,
coverage, and classification of the actual discussion; a source reference alone does not prove
that the user accepted the referenced suggestion.

## Save and send

Assemble the material during read-only assessment. After the existing provisioning confirmation,
write the JSON draft outside all assessed repositories, using private file permissions. Supply its
normalized absolute path as the required `handoff_file` member of `host-launch prepare`, beside the
existing `request`, `assessment`, `user_choice`, repository selection, and worktree fields. Using a file
keeps long discussions outside the command's 1 MiB stdin envelope.

Before fetch, `prepare` saves the normalized material and its complete Markdown rendering in the
launch's Host-owned `handoffs` directory. The receipt retains `handoff_digest`; the JSON and Markdown
paths are derived from the same launch and repository key. The Markdown includes all structured
sections and the original discussion in order. The JSON preserves the original message text.
Repeating a preparation for an existing launch requires the same saved content. The source draft
may be removed after successful preparation; dispatch reads the saved copy.

`dispatch-start` accepts exactly `launch_id`, `repository_key`, and `project_id`. Send the returned
`host_request` unchanged to Codex task creation. `cli-provision` accepts exactly `launch_id`,
`repository_key`, `additional_worktree_paths`, and the CLI boundary's `source_repository_path`.
Use its returned relaunch arguments unchanged. Both paths use the same saved material and renderer;
neither accepts a newly written request summary.

The prompt includes the full structured sections when the resulting UTF-8 prompt is at most 24 KiB,
plus paths to the complete Markdown and JSON material. For longer prompts it uses those paths with
an explicit instruction to read the complete handoff; the saved content is never truncated. Original
discussion stays in the complete files in either case. Sender dispatch refuses missing or altered
material before recording a managed dispatch attempt or creating a CLI worktree.

This Host handoff is separate from Core's `new_task` fields. It does not add a Task node, a new
confirmation step, or a second process cursor.
