# Contract: Explicit Skill and Direct Core MCP

## 1. User-facing Skill

The package exposes exactly one `dev-flow` Skill through the selected official Harness contract.
It is user-invocable, not model-invocable, and selected only by explicit `/dev-flow`.

Before any Core call, require a substantive new requirement or explicit resume intent, one current
Git worktree, and one-repository scope. Ordinary, empty/conversational, non-Git, and multi-repository
inputs create no task.

## 2. Tool surface and handshake

One local STDIO integration corresponds one-to-one with:

1. `dev_flow_server_info`
2. `dev_flow_open_task`
3. `dev_flow_get_task`
4. `dev_flow_get_next_action`
5. `dev_flow_apply_action`
6. `dev_flow_cancel_task`

Harness-native names may be derived from the server name, but raw schemas/semantics remain unchanged.
No alias, seventh tool, generic forwarder, shell tool, or adapter tool is allowed.

`dev_flow_server_info` precedes discovery/mutation and requires compatible Core Contract 0.1,
expected host/transport, and exactly the six raw tools.

## 3. Open/resume

After admission and handshake, use `host=deepseek` and the canonical repository.

- Explicit resume omits `new_task`.
- A new request supplies only a bounded contract derived from user request/repository instructions.
- Same-host compatible resume and all conflicts remain Core decisions.
- The Skill does not choose task rows, alter ownership, or normalize another contract.

## 4. Complete-authority loop

For each nonterminal action, use only the complete live Core result for task ID, phase, revision,
action identity, binding, allowed effects, evidence requirements, payload schema, guidance, blocker,
recovery assessment, and outcome.

Perform only authorized work with normal host tools, stay within the verification budget, construct
only the returned payload, and dispatch one mutation with retained request/action identity.

Skill/provider/launcher contain no task persistence, state/action catalog, transition map, claim
algorithm, error reinterpretation, recovery classifier, or completion predicate.

## 5. Complete-result gate

Required cases are inline success, complete domain error, near-spill, spilled, pruned/compacted, and
near the Core envelope limit. Each records exact Harness identity, host representation, marker,
official retrieval method, expected/recovered bytes and SHA-256, and complete parse.

Final support requires all six cases from the exact stable Harness used by the final journey. A
same-artifact stable gate may be revalidated/reused; RC or different-artifact evidence is
insufficient.

Any stable failure stops. No proxy file/task is authorized until a reviewed amendment defines the
observed limitation, minimum projection contract, tests, and Constitution impact.

## 6. Uncertain mutation

Retain `dev_flow_apply_action.request_id` and original action/payload values before dispatch.
Missing, cancelled, previewed, unrecoverable spilled, pruned, truncated, malformed, or uncertain
output is never blindly replayed.

Perform the exact Core-defined task/next-action operation probe, retrieve a complete read result, and
follow live recovery assessment. Never fabricate classification, binding, next phase, retry safety,
or completion.

## 7. Verification and outcomes

Automatic commands count against the Core budget. Automated, manual, simulated, pre-release-native,
stable-native, skipped, and unverified evidence remain distinct.

Completion is reported only from complete Core `DONE`. Blocked, conflict, cancellation, and
transport closure are not adapter completion rules. Transport cancellation closes/reaps the child;
it does not call `dev_flow_cancel_task` without explicit user-authorized task cancellation.

## 8. Verification matrix

| Behavior | Deterministic evidence | Native evidence |
|---|---|---|
| Explicit-only admission | Skill/package tests | Final stable journey |
| One Skill/six tools | Bundle/fake MCP tests | Stable Gate B and final journey |
| Complete threshold results | Fake Core/digest tests | Full gate on exact stable Harness |
| Read-before-retry | Transcript tests | Final journey when safely reproducible |
| Restart/resume/`DONE` | Fake journey harness | Final stable journey |
| Removal/data retention | Fake profile/retained-data tests | Final stable journey |
| Codex non-interference | Comparison logic/tests | Mandatory real co-install comparison |

A passing final record cannot skip Codex non-interference.
