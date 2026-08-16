package mcp

import "encoding/json"

const (
	ToolServerInfo    = "dev_flow_server_info"
	ToolOpenTask      = "dev_flow_open_task"
	ToolGetTask       = "dev_flow_get_task"
	ToolGetNextAction = "dev_flow_get_next_action"
	ToolApplyAction   = "dev_flow_apply_action"
	ToolCancelTask    = "dev_flow_cancel_task"
)

type ToolAnnotations struct {
	ReadOnly    bool
	Destructive bool
	Idempotent  bool
	OpenWorld   bool
}

type ToolDefinition struct {
	Name        string
	Description string
	InputSchema json.RawMessage
	Annotations ToolAnnotations
}

const schemaDefinitions = `
  "$defs": {
    "identifier": {"type":"string","minLength":1,"maxLength":128},
    "digest": {"type":"string","pattern":"^[0-9a-f]{64}$"},
    "host": {"type":"string","enum":["codex","deepseek"]},
    "sourcePhase": {"type":"string","enum":["INTAKE","ASSESS","PLAN","IMPLEMENT","VERIFY","REVIEW","HANDOFF","BLOCKED"]},
    "actionKind": {"type":"string","enum":["ASSESS_TASK","PLAN_CHANGE","IMPLEMENT_CHANGE","VERIFY_CHANGE","REVIEW_CHANGE","PREPARE_HANDOFF","RESOLVE_BLOCKER"]},
    "boundedList": {"type":"array","maxItems":64,"items":{"type":"string","maxLength":4096}},
    "pathList": {"type":"array","maxItems":64,"items":{"type":"string","maxLength":4096}},
    "verificationBudget": {
      "type":"object","additionalProperties":false,
      "required":["level","max_automatic_commands","allow_full_suite","allow_manual_handoff"],
      "properties":{
        "level":{"type":"string","enum":["minimal","targeted","full"]},
        "max_automatic_commands":{"type":"integer","minimum":0,"maximum":20},
        "allow_full_suite":{"type":"boolean"},
        "allow_manual_handoff":{"type":"boolean"}
      }
    },
    "newTask": {
      "type":"object","additionalProperties":false,
      "required":["goal","scope","out_of_scope","acceptance_criteria","verification_budget"],
      "properties":{
        "goal":{"type":"string","minLength":1,"maxLength":8192},
        "scope":{"type":"array","maxItems":64,"items":{"type":"string","maxLength":1024}},
        "out_of_scope":{"type":"array","maxItems":64,"items":{"type":"string","maxLength":1024}},
        "acceptance_criteria":{"type":"array","minItems":1,"maxItems":64,"items":{"type":"string","maxLength":2048}},
        "verification_budget":{"$ref":"#/$defs/verificationBudget"}
      }
    },
    "blockerCondition": {
      "type":"object","additionalProperties":false,
      "required":["kind","expected_binding_digest"],
      "properties":{
        "kind":{"type":"string","const":"restore_issuance_binding"},
        "expected_binding_digest":{"$ref":"#/$defs/digest"}
      }
    },
    "evidenceInput": {
      "type":"object","additionalProperties":false,
      "required":["source","name","status","summary","command_count","full_suite"],
      "properties":{
        "source":{"type":"string","enum":["automated","user","static","host_observed"]},
        "name":{"type":"string","minLength":1,"maxLength":256},
        "status":{"type":"string","enum":["passed","failed","skipped","not_run","observed"]},
        "summary":{"type":"string","minLength":1,"maxLength":2048},
        "command_count":{"type":"integer","minimum":0,"maximum":20},
        "full_suite":{"type":"boolean"}
      }
    },
    "outcomeCriterion": {
      "type":"object","additionalProperties":false,
      "required":["criterion","status"],
      "properties":{
        "criterion":{"type":"string","minLength":1,"maxLength":2048},
        "status":{"type":"string","enum":["satisfied","unverified"]}
      }
    },
    "delivery": {
      "type":"object","additionalProperties":false,
      "required":["acceptance","automated_evidence_ids","manual_evidence_ids","unverified_items","risks"],
      "properties":{
        "acceptance":{"type":"array","minItems":1,"maxItems":64,"items":{"$ref":"#/$defs/outcomeCriterion"}},
        "automated_evidence_ids":{"type":"array","maxItems":256,"items":{"$ref":"#/$defs/identifier"}},
        "manual_evidence_ids":{"type":"array","maxItems":256,"items":{"$ref":"#/$defs/identifier"}},
        "unverified_items":{"$ref":"#/$defs/boundedList"},
        "risks":{"$ref":"#/$defs/boundedList"}
      }
    },
    "assessPayload": {
      "type":"object","additionalProperties":false,
      "required":["result","summary","constraints","risks","intended_changed_surface","verification_budget_acknowledged"],
      "properties":{
        "result":{"type":"string","const":"succeeded"},
        "summary":{"type":"string","minLength":1,"maxLength":2048},
        "constraints":{"$ref":"#/$defs/boundedList"},
        "risks":{"$ref":"#/$defs/boundedList"},
        "intended_changed_surface":{"$ref":"#/$defs/boundedList"},
        "verification_budget_acknowledged":{"type":"boolean","const":true}
      }
    },
    "planPayload": {
      "type":"object","additionalProperties":false,
      "required":["result","summary","steps","expected_changed_paths","non_goals","verification_steps","unresolved_questions"],
      "properties":{
        "result":{"type":"string","const":"succeeded"},
        "summary":{"type":"string","minLength":1,"maxLength":2048},
        "steps":{"$ref":"#/$defs/boundedList"},
        "expected_changed_paths":{"$ref":"#/$defs/pathList"},
        "non_goals":{"$ref":"#/$defs/boundedList"},
        "verification_steps":{"$ref":"#/$defs/boundedList"},
        "unresolved_questions":{"$ref":"#/$defs/boundedList"}
      }
    },
    "implementPayload": {
      "type":"object","additionalProperties":false,
      "required":["result","summary","changed_paths","no_file_changes","deviations","scope_confirmed"],
      "properties":{
        "result":{"type":"string","const":"succeeded"},
        "summary":{"type":"string","minLength":1,"maxLength":2048},
        "changed_paths":{"$ref":"#/$defs/pathList"},
        "no_file_changes":{"type":"boolean"},
        "deviations":{"$ref":"#/$defs/boundedList"},
        "scope_confirmed":{"type":"boolean","const":true}
      }
    },
    "verifyPayload": {
      "type":"object","additionalProperties":false,
      "required":["result","summary","checks","failed_items","unverified_items","manual_handoff_items","reason"],
      "properties":{
        "result":{"type":"string","enum":["ready","failed"]},
        "summary":{"type":"string","minLength":1,"maxLength":2048},
        "checks":{"type":"array","maxItems":32,"items":{"$ref":"#/$defs/evidenceInput"}},
        "failed_items":{"$ref":"#/$defs/boundedList"},
        "unverified_items":{"$ref":"#/$defs/boundedList"},
        "manual_handoff_items":{"$ref":"#/$defs/boundedList"},
        "reason":{"type":"string","maxLength":4096}
      }
    },
    "reviewPayload": {
      "type":"object","additionalProperties":false,
      "required":["result","summary","findings","residual_risks","reason"],
      "properties":{
        "result":{"type":"string","enum":["pass","rework_implementation","replan"]},
        "summary":{"type":"string","minLength":1,"maxLength":2048},
        "findings":{"$ref":"#/$defs/boundedList"},
        "residual_risks":{"$ref":"#/$defs/boundedList"},
        "reason":{"type":"string","maxLength":4096}
      }
    },
    "reviewHandoffPayload": {
      "type":"object","additionalProperties":false,
      "required":["result","summary","delivery","reason"],
      "properties":{
        "result":{"type":"string","enum":["ready","rework_implementation","replan"]},
        "summary":{"type":"string","minLength":1,"maxLength":2048},
        "delivery":{"anyOf":[{"$ref":"#/$defs/delivery"},{"type":"null"}]},
        "reason":{"type":"string","maxLength":4096}
      }
    },
    "completeHandoffPayload": {
      "type":"object","additionalProperties":false,
      "required":["result","summary","delivery","reason"],
      "properties":{
        "result":{"type":"string","enum":["complete","rework_implementation","replan"]},
        "summary":{"type":"string","minLength":1,"maxLength":2048},
        "delivery":{"anyOf":[{"$ref":"#/$defs/delivery"},{"type":"null"}]},
        "reason":{"type":"string","maxLength":4096}
      }
    },
    "prepareHandoffPayload": {
      "type":"object","additionalProperties":false,
      "required":["result","summary","delivery","reason"],
      "properties":{
        "result":{"type":"string","enum":["ready","complete","rework_implementation","replan"]},
        "summary":{"type":"string","minLength":1,"maxLength":2048},
        "delivery":{"anyOf":[{"$ref":"#/$defs/delivery"},{"type":"null"}]},
        "reason":{"type":"string","maxLength":4096}
      }
    },
    "resolveBlockerPayload": {
      "type":"object","additionalProperties":false,
      "required":["result","blocker_id","summary","resolution_evidence"],
      "properties":{
        "result":{"type":"string","const":"succeeded"},
        "blocker_id":{"$ref":"#/$defs/identifier"},
        "summary":{"type":"string","minLength":1,"maxLength":2048},
        "resolution_evidence":{
          "type":"object","additionalProperties":false,
          "required":["condition","observed_binding_digest"],
          "properties":{
            "condition":{"$ref":"#/$defs/blockerCondition"},
            "observed_binding_digest":{"$ref":"#/$defs/digest"}
          }
        }
      }
    },
    "actionPayload": {
      "anyOf":[
        {"$ref":"#/$defs/assessPayload"},{"$ref":"#/$defs/planPayload"},
        {"$ref":"#/$defs/implementPayload"},{"$ref":"#/$defs/verifyPayload"},
        {"$ref":"#/$defs/reviewPayload"},{"$ref":"#/$defs/reviewHandoffPayload"},
        {"$ref":"#/$defs/completeHandoffPayload"},{"$ref":"#/$defs/resolveBlockerPayload"}
      ]
    },
    "operationProbe": {
      "type":"object","additionalProperties":false,
      "required":["operation_id","source_phase","expected_revision","action_id","action_kind","repository_binding_digest","payload"],
      "properties":{
        "operation_id":{"$ref":"#/$defs/identifier"},
        "source_phase":{"$ref":"#/$defs/sourcePhase"},
        "expected_revision":{"type":"integer","minimum":1},
        "action_id":{"$ref":"#/$defs/identifier"},
        "action_kind":{"$ref":"#/$defs/actionKind"},
        "repository_binding_digest":{"$ref":"#/$defs/digest"},
        "payload":{"anyOf":[{"$ref":"#/$defs/actionPayload"},{"type":"null"}]}
      }
    },
    "recoveryApply": {
      "type":"object","additionalProperties":false,
      "required":["operation_id","source_phase"],
      "properties":{
        "operation_id":{"$ref":"#/$defs/identifier"},
        "source_phase":{"$ref":"#/$defs/sourcePhase"}
      }
    }
  }`

const serverInfoInputSchema = `{
  "type":"object","additionalProperties":false,"properties":{},"required":[]
}`

const openTaskInputSchema = `{
  "type":"object","additionalProperties":false,
  "required":["host","repository_path"],
  "properties":{
    "host":{"$ref":"#/$defs/host"},
    "repository_path":{"type":"string","minLength":1,"maxLength":4096},
    "new_task":{"anyOf":[{"$ref":"#/$defs/newTask"},{"type":"null"}]}
  },
` + schemaDefinitions + `
}`

const readTaskInputSchema = `{
  "type":"object","additionalProperties":false,
  "required":["host","task_id"],
  "properties":{
    "host":{"$ref":"#/$defs/host"},
    "task_id":{"$ref":"#/$defs/identifier"},
    "operation_probe":{"anyOf":[{"$ref":"#/$defs/operationProbe"},{"type":"null"}]}
  },
` + schemaDefinitions + `
}`

const applyActionInputSchema = `{
  "type":"object","additionalProperties":false,
  "required":["request_id","host","task_id","revision","action_id","action_kind","repository_binding_digest","payload"],
  "properties":{
    "request_id":{"$ref":"#/$defs/identifier"},
    "host":{"$ref":"#/$defs/host"},
    "task_id":{"$ref":"#/$defs/identifier"},
    "revision":{"type":"integer","minimum":1},
    "action_id":{"$ref":"#/$defs/identifier"},
    "action_kind":{"$ref":"#/$defs/actionKind"},
    "repository_binding_digest":{"$ref":"#/$defs/digest"},
    "payload":{"anyOf":[{"$ref":"#/$defs/actionPayload"},{"type":"null"}]},
    "recovery_apply":{"anyOf":[{"$ref":"#/$defs/recoveryApply"},{"type":"null"}]}
  },
  "allOf":[{
    "oneOf":[
      {
        "title":"INTAKE / ASSESS_TASK",
        "properties":{
          "action_kind":{"const":"ASSESS_TASK"},
          "payload":{"anyOf":[{"$ref":"#/$defs/assessPayload"},{"type":"null"}]}
        }
      },
      {
        "title":"ASSESS / PLAN_CHANGE",
        "properties":{
          "action_kind":{"const":"PLAN_CHANGE"},
          "payload":{"anyOf":[{"$ref":"#/$defs/planPayload"},{"type":"null"}]}
        }
      },
      {
        "title":"PLAN / IMPLEMENT_CHANGE",
        "properties":{
          "action_kind":{"const":"IMPLEMENT_CHANGE"},
          "payload":{"anyOf":[{"$ref":"#/$defs/implementPayload"},{"type":"null"}]}
        }
      },
      {
        "title":"IMPLEMENT / VERIFY_CHANGE",
        "properties":{
          "action_kind":{"const":"VERIFY_CHANGE"},
          "payload":{"anyOf":[{"$ref":"#/$defs/verifyPayload"},{"type":"null"}]}
        }
      },
      {
        "title":"VERIFY / REVIEW_CHANGE",
        "properties":{
          "action_kind":{"const":"REVIEW_CHANGE"},
          "payload":{"anyOf":[{"$ref":"#/$defs/reviewPayload"},{"type":"null"}]}
        }
      },
      {
        "title":"REVIEW or HANDOFF / PREPARE_HANDOFF",
        "properties":{
          "action_kind":{"const":"PREPARE_HANDOFF"},
          "payload":{"anyOf":[{"$ref":"#/$defs/prepareHandoffPayload"},{"type":"null"}]}
        }
      },
      {
        "title":"BLOCKED / RESOLVE_BLOCKER",
        "properties":{
          "action_kind":{"const":"RESOLVE_BLOCKER"},
          "payload":{"anyOf":[{"$ref":"#/$defs/resolveBlockerPayload"},{"type":"null"}]}
        }
      }
    ]
  }],
` + schemaDefinitions + `
}`

const cancelTaskInputSchema = `{
  "type":"object","additionalProperties":false,
  "required":["host","task_id","revision","reason"],
  "properties":{
    "host":{"$ref":"#/$defs/host"},
    "task_id":{"$ref":"#/$defs/identifier"},
    "revision":{"type":"integer","minimum":1},
    "reason":{"type":"string","minLength":1,"maxLength":4096}
  },
` + schemaDefinitions + `
}`

var catalog = [...]ToolDefinition{
	{
		Name:        ToolServerInfo,
		Description: "Report the ready local Core contract, version, supported host identities, and exact tool list.",
		InputSchema: json.RawMessage(serverInfoInputSchema),
		Annotations: ToolAnnotations{ReadOnly: true, Idempotent: true},
	},
	{
		Name:        ToolOpenTask,
		Description: "Create one governed repository task or resume its compatible active task.",
		InputSchema: json.RawMessage(openTaskInputSchema),
		Annotations: ToolAnnotations{},
	},
	{
		Name:        ToolGetTask,
		Description: "Read one authoritative task and optionally assess an uncertain operation without persistence.",
		InputSchema: json.RawMessage(readTaskInputSchema),
		Annotations: ToolAnnotations{ReadOnly: true, Idempotent: true},
	},
	{
		Name:        ToolGetNextAction,
		Description: "Read the exact persisted next action or terminal outcome, with optional transient recovery assessment.",
		InputSchema: json.RawMessage(readTaskInputSchema),
		Annotations: ToolAnnotations{ReadOnly: true, Idempotent: true},
	},
	{
		Name:        ToolApplyAction,
		Description: "Submit the closed payload for the exact current action or an explicit recovery apply.",
		InputSchema: json.RawMessage(applyActionInputSchema),
		Annotations: ToolAnnotations{},
	},
	{
		Name:        ToolCancelTask,
		Description: "Explicitly cancel a host-owned task at its exact revision while retaining task history.",
		InputSchema: json.RawMessage(cancelTaskInputSchema),
		Annotations: ToolAnnotations{Destructive: true},
	},
}

func ToolCatalog() []ToolDefinition {
	result := make([]ToolDefinition, len(catalog))
	for index, definition := range catalog {
		result[index] = definition
		result[index].InputSchema = append(json.RawMessage(nil), definition.InputSchema...)
	}
	return result
}

func ToolNames() []string {
	names := make([]string, len(catalog))
	for index, definition := range catalog {
		names[index] = definition.Name
	}
	return names
}

func isToolName(name string) bool {
	for _, definition := range catalog {
		if definition.Name == name {
			return true
		}
	}
	return false
}
