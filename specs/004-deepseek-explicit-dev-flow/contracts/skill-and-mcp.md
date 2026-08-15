# Contract: Explicit Skill and Direct Core MCP

## 1. User-Facing Skill

The package exposes exactly one Skill:

| Property | Required value |
|---|---|
| Name | `dev-flow` |
| Invocation token | `/dev-flow` under the selected official Harness explicit-invocation contract |
| `userInvocable` | `true` |
| `modelInvocable` | `false` |

The package does not expose a command family, implicit trigger, agent preset, second Skill, or
host-specific completion rule.

### Invocation admission

Before any task mutation, Skill instructions require the host to establish all of the following:

1. the claimed user message explicitly invoked `/dev-flow`;
2. the remainder is a substantive development requirement, not empty or merely conversational;
3. the current directory belongs to exactly one existing Git worktree;
4. the request targets that one repository and does not require a second repository; and
5. `dev_flow_server_info` reports compatible Core Contract 0.1 and exactly the tool allowlist below.

Failure of items 1–4 returns a concise user-facing rejection and opens no task. Failure of item 5
reports a bounded incompatibility/startup error and performs no discovery or mutation.

An ordinary prompt without `/dev-flow` does not inject the Skill and creates zero Core tasks.

## 2. Host-Facing Tool Surface

The bundle exposes one native STDIO MCP server and exactly these six raw Core tools:

| Raw Core name | Use |
|---|---|
| `dev_flow_server_info` | Contract/health/tool-catalog check before other calls. |
| `dev_flow_open_task` | Create or resume the one compatible Core-owned task. |
| `dev_flow_get_task` | Read authoritative task and optional recovery assessment. |
| `dev_flow_get_next_action` | Read fresh action/blocker/outcome and optional recovery assessment. |
| `dev_flow_apply_action` | Submit one exact current action or explicit Core-defined recovery apply. |
| `dev_flow_cancel_task` | Explicit user-authorized cancellation only. |

Harness may display official native names derived as `mcp__<serverName>__<rawName>`. The bundle MUST
not rename raw Core schemas, expose an unfiltered forwarding tool, or add an adapter tool. The
direct-consumption evidence records the actual native catalog for the selected Harness artifact and
proves one-to-one correspondence with these six names.

All input schemas, result envelopes, error codes, tool annotations, action payload schemas,
revision/action identities, allowed effects, evidence requirements, recovery assessments, and
outcomes are the live Core Contract 0.1. This document does not redefine them.

## 3. Open or Resume

After admission and server-info validation, the Skill uses `host=deepseek` and the single resolved
repository path.

- To resume, call `dev_flow_open_task` without `new_task`.
- If no active task exists and the invocation contains a substantive requirement, call
  `dev_flow_open_task` with a bounded contract derived from that requirement.
- A same-host exact normalized contract may resume the existing task.
- A same-host different contract returns Core `ACTIVE_TASK_CONFLICT`.
- A task owned by another host returns Core `HOST_OWNERSHIP_CONFLICT`.

The Skill never changes ownership, creates a second repository claim, edits the normalized contract,
or invents compatibility behavior.

## 4. Fresh-Authority Loop

For each nonterminal step, the Skill:

1. obtains the complete result of `dev_flow_get_next_action` (or the complete action returned by
   open/apply);
2. treats the returned task ID, phase, revision, action ID/kind, repository binding, allowed
   effects, evidence requirements, payload schema, guidance, blocker, recovery assessment, and
   outcome as the only authority;
3. performs only the authorized development work using normal host tools;
4. stays within the Core verification budget and classifies evidence as automated, manual,
   simulated, or unverified without promotion;
5. constructs only the payload schema returned for that exact action; and
6. calls `dev_flow_apply_action` once with the exact issued identities, then consumes the complete
   committed result before continuing.

The Skill does not contain a phase-to-action table, action catalog, transition map, repository claim
algorithm, recovery classifier, stable-error reinterpretation, or completion predicate. Guidance
may tell the agent to follow live Core fields; it MUST NOT duplicate their possible values as an
adapter state machine.

Completion is reported only when the complete Core result contains its authoritative terminal
outcome. A Harness turn ending, model assertion, missing action preview, or package removal is not
completion.

## 5. Complete Results

Core Contract 0.1 emits the same complete compact JSON in MCP text and structured content. The
official Harness may subsequently inline, spill, preview, or prune tool results. Before reading any
authority field, the Skill/caller MUST establish that canonical content is complete.

- Inline canonical JSON may be used only after successful complete-envelope parsing.
- A spill reference, preview, prune/truncation marker, malformed envelope, missing required field,
  digest mismatch, or inaccessible structured result is incomplete.
- For an official recoverable spill/prune representation, use the exact supported retrieval
  mechanism proven by Gate B, then validate the full envelope.
- Never infer omitted fields from a preview or combine fragments into fabricated authority.
- Stable Core domain errors retain their complete `ok=false`, `error.code`, message, details, and
  recovery semantics; Harness display wording is not a replacement error taxonomy.

Gate B passes only when all `DirectResultObservation` cases in `data-model.md` recover byte-identical
canonical content through the official direct client. Until then, no user-story implementation may
claim FR-023, and no projection proxy is allowed.

## 6. Uncertain Mutation

The caller chooses and retains `dev_flow_apply_action.request_id` before dispatch. If the response
is missing, cancelled, spilled without recoverable full content, pruned, truncated, malformed, or
otherwise uncertain:

1. do not replay the mutation;
2. call `dev_flow_get_task` or `dev_flow_get_next_action` with the original Core-defined
   `operation_probe`, including the original request/action identities and retained payload exactly
   as Contract 0.1 permits;
3. retrieve and validate the complete read result;
4. follow the returned Core `recovery_assessment.next_advice`, retry-safety flag, blocker/condition,
   current action, or outcome; and
5. perform an explicit recovery apply only in the exact shape authorized by the live Core result.

The Skill never supplies a recovery classification, replacement binding, next phase, completion
decision, or blind retry. It never parses free-form recovery text into a condition.

## 7. Cancellation and Shutdown

`dev_flow_cancel_task` is called only for explicit user-authorized task cancellation. Host/MCP
transport cancellation instead closes the outward transport and lifecycle launcher, which
propagates cancellation and deterministically reaps the Core child; it does not convert transport
cancellation into task cancellation.

## 8. Contract Verification Matrix

| Contract behavior | Deterministic evidence | Real-host evidence |
|---|---|---|
| Explicit-only activation and empty/conversational rejection | Skill resource inspection/test | Ordinary prompt plus explicit `/dev-flow` invocation |
| Exactly one Skill and six tools | Bundle/package test | Installed profile catalog after restart |
| Core Contract 0.1 identity | Shared fixtures and server-info contract test | First real invocation's complete server-info result |
| Complete success/domain-error/spill/prune results | Fake Core digests plus direct-host spike | Gate B evidence using exact Harness artifact |
| Read-before-retry | Skill/fake-Core transcript test | Lost/uncertain response case when safely reproducible; otherwise explicitly scoped fake evidence |
| Startup/cancellation | Launcher/fake-Core process tests | Observed startup/removal behavior, without promoting simulation |
| Restart/resume/DONE | Not claimable by fake host | Required final journey |
| Removal/data retention/Codex isolation | Package/layout checks | Required final journey, with explicit skip if Codex is absent |
