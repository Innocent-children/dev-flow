<!-- Generated from skills/dev-flow/core/successes/dev_flow_get_next_action-guarded-read.md; edit the shared source and run node scripts/sync-skill-references.mjs. -->

# dev_flow_get_next_action: guarded-read

Implementation: `internal/mcp/server.go` — `dispatch`; `internal/application/submit_action.go` — `SubmitAction`.

Complete successful call from the documented scenario. The repository observer is a fixed test fixture;
Host authorization and Git operations are not executed here. Runtime IDs and timestamps use stable
example values, and operation digests use a sample digest. All other fields are compared with the
actual Core response. The resolved request below shows the current Task values substituted for the
identity and confirmation placeholders in the calling reference.

Resolved request:

<!-- example:resolved-mcp dev_flow_get_next_action guarded-read -->
```json
{
  "host": "codex",
  "task_id": "task-example"
}
```

Complete response:

<!-- example:mcp-success dev_flow_get_next_action guarded-read -->
```json
{
  "ok": true,
  "request_id": "request-success-example",
  "result": {
    "action": {
      "action_id": "action-example",
      "action_kind": "COMPLETE_REQUIREMENTS",
      "allowed_effects": [
        "read_repository",
        "edit_process_artifacts",
        "request_user_decision"
      ],
      "available_transitions": [
        {
          "description": "Move from REQUIREMENTS to DESIGN after completing the declared node obligations.",
          "destination_node": "DESIGN",
          "guard_id": "requirements_baseline_complete",
          "reason_required": false,
          "selection_condition": "Choose this transition only when the requirements baseline complete condition is satisfied.",
          "transition_id": "requirements_ready"
        }
      ],
      "completion_conditions": [
        "requirements_goal_defined",
        "requirements_scope_bounded",
        "requirements_exclusions_explicit",
        "requirements_acceptance_nonempty",
        "requirements_material_questions_resolved",
        "requirements_user_decisions_recorded",
        "requirements_presented_for_discussion"
      ],
      "current_node": "REQUIREMENTS",
      "entry_conditions": [
        "intent_available",
        "repository_claimed",
        "requirements_context_available"
      ],
      "guidance": "Complete the current node contract and select one available transition.",
      "issuance_content_digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "issuance_history_digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "issuance_identity_digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "issued_at": "2026-09-10T00:00:00Z",
      "method_profile": "plain",
      "method_steps": [
        {
          "purpose": "Capture a bounded goal, scope, exclusions, acceptance criteria, constraints, and assumptions.",
          "required": true,
          "step_id": "requirements.capture"
        },
        {
          "purpose": "Resolve material requirement questions with the developer.",
          "required": true,
          "step_id": "requirements.clarify"
        },
        {
          "purpose": "Verify that requirements are observable, bounded, and free of material ambiguity.",
          "required": true,
          "step_id": "requirements.validate"
        }
      ],
      "node_purpose": "Transform the immutable initial intent into the current requirements authority.",
      "payload_contract": "requirements-result",
      "process_definition_digest": "eb35dcd623a1673abf768209fd4e7cb07979afb31b102c527bd4066b74a24430",
      "process_id": "standard-development",
      "repository_binding_digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "required_evidence": [
        {
          "kind": "repository_observation",
          "required": true
        },
        {
          "kind": "requirements_baseline",
          "required": true
        }
      ],
      "revision": 1,
      "submission_tool": "dev_flow_submit_requirements",
      "task_id": "task-example"
    },
    "blocker": null,
    "current_cursor": "REQUIREMENTS",
    "method_profile": "plain",
    "outcome": null,
    "process": {
      "process_definition_digest": "eb35dcd623a1673abf768209fd4e7cb07979afb31b102c527bd4066b74a24430",
      "process_id": "standard-development"
    },
    "recovery_assessment": null,
    "revision": 1,
    "task_id": "task-example"
  },
  "tool": "dev_flow_get_next_action"
}
```
