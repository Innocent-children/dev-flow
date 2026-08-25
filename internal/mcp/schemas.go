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

type ToolAnnotations struct{ ReadOnly, Destructive, Idempotent, OpenWorld bool }
type ToolDefinition struct {
	Name, Description string
	InputSchema       json.RawMessage
	Annotations       ToolAnnotations
}

var catalog = buildCatalog()

func obj(required []string, properties map[string]any) map[string]any {
	return map[string]any{"type": "object", "additionalProperties": false, "required": required, "properties": properties}
}
func mergeProperties(left, right map[string]any) map[string]any {
	result := make(map[string]any, len(left)+len(right))
	for key, value := range left {
		result[key] = value
	}
	for key, value := range right {
		result[key] = value
	}
	return result
}
func str() map[string]any    { return map[string]any{"type": "string", "minLength": 1, "maxLength": 4096} }
func id() map[string]any     { return map[string]any{"type": "string", "minLength": 1, "maxLength": 128} }
func digest() map[string]any { return map[string]any{"type": "string", "pattern": "^[0-9a-f]{64}$"} }
func list() map[string]any {
	return map[string]any{"type": "array", "maxItems": 64, "items": map[string]any{"type": "string", "maxLength": 4096}}
}
func problemClass(values ...string) map[string]any { return map[string]any{"enum": values} }
func payloadSchema(nodeResult map[string]any) map[string]any {
	artifact := obj([]string{"role", "path", "digest", "summary"}, map[string]any{"role": map[string]any{"enum": []string{"requirements", "design", "task_plan", "implementation", "test", "comprehension", "refactor", "delivery", "other_process"}}, "path": str(), "digest": digest(), "summary": str()})
	method := obj([]string{"step_id", "status", "capability", "summary"}, map[string]any{"step_id": id(), "status": map[string]any{"enum": []string{"completed", "not_run", "unavailable", "plain_fallback"}}, "capability": map[string]any{"type": "string", "maxLength": 128, "pattern": "^[a-z0-9_.@-]*$"}, "summary": str()})
	return obj([]string{"transition_id", "summary", "reason", "artifacts", "method_evidence", "node_result"}, map[string]any{"transition_id": id(), "summary": str(), "reason": map[string]any{"type": "string", "maxLength": 4096}, "artifacts": map[string]any{"type": "array", "maxItems": 16, "items": artifact}, "method_evidence": map[string]any{"type": "array", "maxItems": 16, "items": method}, "node_result": nodeResult})
}
func graphPayloads() ([]any, []any) {
	nullable := func(v any) map[string]any {
		return map[string]any{"anyOf": []any{v, map[string]any{"type": "null"}}}
	}
	baselineReq := obj([]string{"goal", "scope", "out_of_scope", "acceptance_criteria", "constraints", "assumptions"}, map[string]any{"goal": str(), "scope": list(), "out_of_scope": list(), "acceptance_criteria": list(), "constraints": list(), "assumptions": list()})
	mutation := map[string]any{"changed_paths": list(), "no_file_changes": map[string]any{"type": "boolean"}}
	requirements := payloadSchema(obj([]string{"problem_class", "baseline", "unresolved_questions", "changed_paths", "no_file_changes"}, mergeProperties(map[string]any{"problem_class": problemClass("none"), "baseline": baselineReq, "unresolved_questions": list()}, mutation)))
	designBase := obj([]string{"requirements_revision", "approach", "components", "decisions", "rejected_alternatives", "complexity_justification", "risks"}, map[string]any{"requirements_revision": map[string]any{"type": "integer", "minimum": 1}, "approach": str(), "components": list(), "decisions": list(), "rejected_alternatives": list(), "complexity_justification": list(), "risks": list()})
	design := payloadSchema(obj([]string{"problem_class", "baseline", "findings", "changed_paths", "no_file_changes"}, mergeProperties(map[string]any{"problem_class": problemClass("none", "requirement_gap"), "baseline": nullable(designBase), "findings": list()}, mutation)))
	work := obj([]string{"work_item_id", "summary", "expected_paths", "acceptance_indexes", "verification_steps", "dependencies"}, map[string]any{"work_item_id": id(), "summary": str(), "expected_paths": list(), "acceptance_indexes": map[string]any{"type": "array", "items": map[string]any{"type": "integer", "minimum": 0}}, "verification_steps": list(), "dependencies": map[string]any{"type": "array", "items": id()}})
	tasksBase := obj([]string{"design_revision", "work_items"}, map[string]any{"design_revision": map[string]any{"type": "integer", "minimum": 1}, "work_items": map[string]any{"type": "array", "maxItems": 64, "items": work}})
	tasks := payloadSchema(obj([]string{"problem_class", "baseline", "findings", "changed_paths", "no_file_changes"}, mergeProperties(map[string]any{"problem_class": problemClass("none", "design_gap", "requirement_gap"), "baseline": nullable(tasksBase), "findings": list()}, mutation)))
	implementation := payloadSchema(obj([]string{"problem_class", "task_plan_revision", "completed_work_item_ids", "changed_paths", "no_file_changes", "deviations", "findings"}, map[string]any{"problem_class": problemClass("none", "design_gap", "requirement_gap", "code_complexity"), "task_plan_revision": map[string]any{"type": "integer", "minimum": 1}, "completed_work_item_ids": map[string]any{"type": "array", "items": id()}, "changed_paths": list(), "no_file_changes": map[string]any{"type": "boolean"}, "deviations": list(), "findings": list()}))
	check := obj([]string{"source", "name", "status", "summary", "command_count", "full_suite"}, map[string]any{"source": map[string]any{"enum": []string{"automated", "user", "static", "host_observed"}}, "name": str(), "status": map[string]any{"enum": []string{"passed", "failed", "skipped", "not_run", "observed"}}, "summary": str(), "command_count": map[string]any{"type": "integer", "minimum": 0, "maximum": 20}, "full_suite": map[string]any{"type": "boolean"}})
	test := payloadSchema(obj([]string{"problem_class", "checks", "failed_items", "unverified_items", "manual_handoff_items", "findings", "changed_paths", "no_file_changes"}, mergeProperties(map[string]any{"problem_class": problemClass("none", "implementation_failure", "design_failure", "requirement_gap"), "checks": map[string]any{"type": "array", "maxItems": 32, "items": check}, "failed_items": list(), "unverified_items": list(), "manual_handoff_items": list(), "findings": list()}, mutation)))
	confirmation := obj([]string{"source", "status", "summary"}, map[string]any{"source": map[string]any{"const": "user"}, "status": map[string]any{"const": "passed"}, "summary": str()})
	comprehension := payloadSchema(obj([]string{"problem_class", "explained_components", "unresolved_questions", "unnecessary_abstractions", "maintenance_risks", "user_confirmation", "findings", "changed_paths", "no_file_changes"}, mergeProperties(map[string]any{"problem_class": problemClass("none", "implementation_defect", "code_complexity", "design_complexity", "verification_gap", "requirement_gap"), "explained_components": list(), "unresolved_questions": list(), "unnecessary_abstractions": list(), "maintenance_risks": list(), "user_confirmation": nullable(confirmation), "findings": list()}, mutation)))
	refactor := payloadSchema(obj([]string{"problem_class", "changed_paths", "no_file_changes", "simplifications", "behavior_change_intended", "findings"}, map[string]any{"problem_class": problemClass("none", "design_change", "requirement_change"), "changed_paths": list(), "no_file_changes": map[string]any{"type": "boolean"}, "simplifications": list(), "behavior_change_intended": map[string]any{"type": "boolean"}, "findings": list()}))
	delivery := payloadSchema(obj([]string{"problem_class", "acceptance", "automated_evidence_ids", "manual_evidence_ids", "test_record_id", "comprehension_record_id", "unverified_items", "risks", "findings", "changed_paths", "no_file_changes"}, mergeProperties(map[string]any{"problem_class": problemClass("none", "implementation_gap", "test_gap", "comprehension_gap", "design_gap", "requirement_gap"), "acceptance": map[string]any{"type": "array", "items": obj([]string{"criterion", "status"}, map[string]any{"criterion": str(), "status": map[string]any{"const": "satisfied"}})}, "automated_evidence_ids": map[string]any{"type": "array", "items": id()}, "manual_evidence_ids": map[string]any{"type": "array", "items": id()}, "test_record_id": id(), "comprehension_record_id": id(), "unverified_items": list(), "risks": list(), "findings": list()}, mutation)))
	condition := obj([]string{"kind", "expected_binding_digest"}, map[string]any{"kind": map[string]any{"const": "restore_issuance_binding"}, "expected_binding_digest": digest()})
	blocker := obj([]string{"blocker_id", "condition", "observed_binding_digest"}, map[string]any{"blocker_id": id(), "condition": condition, "observed_binding_digest": digest()})
	payloads := []any{requirements, design, tasks, implementation, test, comprehension, refactor, delivery, blocker}
	kinds := []string{"COMPLETE_REQUIREMENTS", "COMPLETE_DESIGN", "COMPLETE_TASKS", "COMPLETE_IMPLEMENTATION", "COMPLETE_TEST", "COMPLETE_COMPREHENSION_REVIEW", "COMPLETE_REFACTOR", "COMPLETE_DELIVERY", "RESOLVE_BLOCKER"}
	branches := make([]any, len(kinds))
	for i, kind := range kinds {
		branches[i] = map[string]any{"title": kind, "properties": map[string]any{"action_kind": map[string]any{"const": kind}, "payload": nullable(payloads[i])}}
	}
	return payloads, branches
}
func buildCatalog() []ToolDefinition {
	budget := obj([]string{"level", "max_automatic_commands", "allow_full_suite", "allow_manual_handoff"}, map[string]any{"level": map[string]any{"enum": []string{"minimal", "targeted", "full"}}, "max_automatic_commands": map[string]any{"type": "integer", "minimum": 0, "maximum": 20}, "allow_full_suite": map[string]any{"type": "boolean"}, "allow_manual_handoff": map[string]any{"type": "boolean"}})
	newTask := obj([]string{"request", "initial_scope", "initial_out_of_scope", "known_acceptance_criteria", "verification_budget", "method_profile"}, map[string]any{"request": map[string]any{"type": "string", "minLength": 1, "maxLength": 8192}, "initial_scope": list(), "initial_out_of_scope": list(), "known_acceptance_criteria": list(), "verification_budget": budget, "method_profile": map[string]any{"enum": []string{"plain", "spec-kit", "openspec"}}})
	empty := obj([]string{}, map[string]any{})
	payloads, branches := graphPayloads()
	standardPayload := map[string]any{"oneOf": payloads}
	payload := map[string]any{"anyOf": []any{standardPayload, map[string]any{"type": "null"}}}
	probe := obj([]string{"operation_id", "process_id", "process_definition_digest", "source_cursor", "expected_revision", "action_id", "action_kind", "repository_binding_digest", "payload"}, map[string]any{"operation_id": id(), "process_id": map[string]any{"const": "standard-development"}, "process_definition_digest": digest(), "source_cursor": id(), "expected_revision": map[string]any{"type": "integer", "minimum": 1}, "action_id": id(), "action_kind": id(), "repository_binding_digest": digest(), "payload": map[string]any{"anyOf": []any{payload, map[string]any{"type": "null"}}}})
	read := obj([]string{"host", "task_id"}, map[string]any{"host": map[string]any{"enum": []string{"codex", "deepseek"}}, "task_id": id(), "operation_probe": map[string]any{"anyOf": []any{probe, map[string]any{"type": "null"}}}})
	recoveryApply := obj([]string{"operation_id", "source_cursor"}, map[string]any{"operation_id": id(), "source_cursor": id()})
	applyProps := map[string]any{"request_id": id(), "host": map[string]any{"enum": []string{"codex", "deepseek"}}, "task_id": id(), "revision": map[string]any{"type": "integer", "minimum": 1}, "action_id": id(), "action_kind": id(), "process_id": map[string]any{"const": "standard-development"}, "process_definition_digest": digest(), "source_cursor": id(), "repository_binding_digest": digest(), "payload": payload, "recovery_apply": map[string]any{"anyOf": []any{recoveryApply, map[string]any{"type": "null"}}}}
	apply := obj([]string{"request_id", "host", "task_id", "revision", "action_id", "action_kind", "process_id", "process_definition_digest", "source_cursor", "repository_binding_digest", "payload"}, applyProps)
	apply["allOf"] = []any{
		map[string]any{"oneOf": branches},
		map[string]any{"anyOf": []any{
			map[string]any{"required": []string{"recovery_apply"}, "properties": map[string]any{"recovery_apply": recoveryApply}},
			map[string]any{"properties": map[string]any{"recovery_apply": map[string]any{"type": "null"}, "payload": standardPayload}},
		}},
	}
	repositoryKey := map[string]any{"type": "string", "pattern": "^[a-z0-9][a-z0-9._-]{0,127}$"}
	additionalRepository := obj([]string{"key", "repository_path"}, map[string]any{"key": repositoryKey, "repository_path": str()})
	open := obj([]string{"host", "repository_path"}, map[string]any{
		"host":                    map[string]any{"enum": []string{"codex", "deepseek"}},
		"repository_path":         str(),
		"primary_repository_key":  repositoryKey,
		"additional_repositories": map[string]any{"type": "array", "maxItems": 7, "items": additionalRepository},
		"new_task":                map[string]any{"anyOf": []any{newTask, map[string]any{"type": "null"}}},
	})
	cancel := obj([]string{"request_id", "host", "task_id", "revision", "reason"}, map[string]any{"request_id": id(), "host": map[string]any{"enum": []string{"codex", "deepseek"}}, "task_id": id(), "revision": map[string]any{"type": "integer", "minimum": 1}, "reason": str()})
	defs := map[string]any{"newTask": newTask, "verificationBudget": budget}
	open["$defs"] = defs
	return []ToolDefinition{makeTool(ToolServerInfo, "Read the current Core server identity.", empty, true, true, false), makeTool(ToolOpenTask, "Open or resume one graph task.", open, false, false, false), makeTool(ToolGetTask, "Read one graph task.", read, true, true, false), makeTool(ToolGetNextAction, "Read the persisted graph action.", read, true, true, false), makeTool(ToolApplyAction, "Apply one Core-declared transition.", apply, false, false, false), makeTool(ToolCancelTask, "Cancel one graph task.", cancel, false, false, true)}
}
func makeTool(name, description string, schema map[string]any, read, idempotent, destructive bool) ToolDefinition {
	raw, err := json.Marshal(schema)
	if err != nil {
		panic(err)
	}
	return ToolDefinition{name, description, raw, ToolAnnotations{ReadOnly: read, Idempotent: idempotent, Destructive: destructive}}
}
func ToolCatalog() []ToolDefinition { return append([]ToolDefinition(nil), catalog...) }
func ToolNames() []string {
	out := make([]string, len(catalog))
	for i, v := range catalog {
		out[i] = v.Name
	}
	return out
}
func isToolName(name string) bool {
	for _, v := range catalog {
		if v.Name == name {
			return true
		}
	}
	return false
}
