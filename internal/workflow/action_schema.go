package workflow

import (
	"encoding/json"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

// ActionPayloadSchema binds one current Action kind to its closed payload contract.
type ActionPayloadSchema struct {
	Kind   domain.ActionKind
	Schema map[string]any
}

// ActionPayloadSchemas returns the closed payload contracts accepted by the current workflow.
func ActionPayloadSchemas() []ActionPayloadSchema {
	baselineRequirements := schemaObject([]string{"goal", "scope", "out_of_scope", "acceptance_criteria", "constraints", "assumptions"}, map[string]any{
		"goal": schemaString(), "scope": schemaList(), "out_of_scope": schemaList(), "acceptance_criteria": schemaList(), "constraints": schemaList(), "assumptions": schemaList(),
	})
	mutation := map[string]any{"changed_paths": schemaList(), "no_file_changes": map[string]any{"type": "boolean"}}
	requirements := standardPayloadSchema(schemaObject([]string{"problem_class", "baseline", "unresolved_questions", "changed_paths", "no_file_changes"}, mergeSchemaProperties(map[string]any{
		"problem_class": schemaEnum("none"), "baseline": baselineRequirements, "unresolved_questions": schemaList(),
	}, mutation)))
	designBaseline := schemaObject([]string{"requirements_revision", "approach", "components", "decisions", "rejected_alternatives", "complexity_justification", "risks"}, map[string]any{
		"requirements_revision": map[string]any{"type": "integer", "minimum": 1}, "approach": schemaString(), "components": schemaList(), "decisions": schemaList(), "rejected_alternatives": schemaList(), "complexity_justification": schemaList(), "risks": schemaList(),
	})
	design := standardPayloadSchema(schemaObject([]string{"problem_class", "baseline", "findings", "changed_paths", "no_file_changes"}, mergeSchemaProperties(map[string]any{
		"problem_class": schemaEnum("none", "requirement_gap"), "baseline": nullableSchema(designBaseline), "findings": schemaList(),
	}, mutation)))
	workItem := schemaObject([]string{"work_item_id", "summary", "expected_paths", "acceptance_indexes", "verification_steps", "dependencies"}, map[string]any{
		"work_item_id": schemaID(), "summary": schemaString(), "expected_paths": schemaList(), "acceptance_indexes": map[string]any{"type": "array", "items": map[string]any{"type": "integer", "minimum": 0}}, "verification_steps": schemaList(), "dependencies": map[string]any{"type": "array", "items": schemaID()},
	})
	tasksBaseline := schemaObject([]string{"design_revision", "work_items"}, map[string]any{"design_revision": map[string]any{"type": "integer", "minimum": 1}, "work_items": map[string]any{"type": "array", "maxItems": 64, "items": workItem}})
	tasks := standardPayloadSchema(schemaObject([]string{"problem_class", "baseline", "findings", "changed_paths", "no_file_changes"}, mergeSchemaProperties(map[string]any{
		"problem_class": schemaEnum("none", "design_gap", "requirement_gap"), "baseline": nullableSchema(tasksBaseline), "findings": schemaList(),
	}, mutation)))
	implementation := standardPayloadSchema(schemaObject([]string{"problem_class", "task_plan_revision", "completed_work_item_ids", "changed_paths", "no_file_changes", "deviations", "findings"}, map[string]any{
		"problem_class": schemaEnum("none", "design_gap", "requirement_gap", "code_complexity"), "task_plan_revision": map[string]any{"type": "integer", "minimum": 1}, "completed_work_item_ids": map[string]any{"type": "array", "items": schemaID()}, "changed_paths": schemaList(), "no_file_changes": map[string]any{"type": "boolean"}, "deviations": schemaList(), "findings": schemaList(),
	}))
	check := map[string]any{"oneOf": []any{
		evidenceCheckSchema("automated", true), evidenceCheckSchema("user", false), evidenceCheckSchema("static", false), evidenceCheckSchema("host_observed", false),
	}}
	test := standardPayloadSchema(schemaObject([]string{"problem_class", "checks", "failed_items", "unverified_items", "manual_handoff_items", "findings", "changed_paths", "no_file_changes"}, mergeSchemaProperties(map[string]any{
		"problem_class": schemaEnum("none", "implementation_failure", "design_failure", "requirement_gap"), "checks": map[string]any{"type": "array", "maxItems": 32, "items": check}, "failed_items": schemaList(), "unverified_items": schemaList(), "manual_handoff_items": schemaList(), "findings": schemaList(),
	}, mutation)))
	confirmation := schemaObject([]string{"source", "status", "summary"}, map[string]any{"source": map[string]any{"const": "user"}, "status": map[string]any{"const": "passed"}, "summary": schemaString()})
	comprehension := standardPayloadSchema(schemaObject([]string{"problem_class", "explained_components", "unresolved_questions", "unnecessary_abstractions", "maintenance_risks", "user_confirmation", "findings", "changed_paths", "no_file_changes"}, mergeSchemaProperties(map[string]any{
		"problem_class": schemaEnum("none", "implementation_defect", "code_complexity", "design_complexity", "verification_gap", "requirement_gap"), "explained_components": schemaList(), "unresolved_questions": schemaList(), "unnecessary_abstractions": schemaList(), "maintenance_risks": schemaList(), "user_confirmation": nullableSchema(confirmation), "findings": schemaList(),
	}, mutation)))
	refactor := standardPayloadSchema(schemaObject([]string{"problem_class", "changed_paths", "no_file_changes", "simplifications", "behavior_change_intended", "findings"}, map[string]any{
		"problem_class": schemaEnum("none", "design_change", "requirement_change"), "changed_paths": schemaList(), "no_file_changes": map[string]any{"type": "boolean"}, "simplifications": schemaList(), "behavior_change_intended": map[string]any{"type": "boolean"}, "findings": schemaList(),
	}))
	delivery := standardPayloadSchema(schemaObject([]string{"problem_class", "acceptance", "automated_evidence_ids", "manual_evidence_ids", "test_record_id", "comprehension_record_id", "unverified_items", "risks", "findings", "changed_paths", "no_file_changes"}, mergeSchemaProperties(map[string]any{
		"problem_class": schemaEnum("none", "implementation_gap", "test_gap", "comprehension_gap", "design_gap", "requirement_gap"), "acceptance": map[string]any{"type": "array", "items": schemaObject([]string{"criterion", "status"}, map[string]any{"criterion": schemaString(), "status": map[string]any{"const": "satisfied"}})}, "automated_evidence_ids": map[string]any{"type": "array", "items": schemaID()}, "manual_evidence_ids": map[string]any{"type": "array", "items": schemaID()}, "test_record_id": schemaID(), "comprehension_record_id": schemaID(), "unverified_items": schemaList(), "risks": schemaList(), "findings": schemaList(),
	}, mutation)))
	condition := schemaObject([]string{"kind", "expected_binding_digest"}, map[string]any{"kind": map[string]any{"const": "restore_issuance_binding"}, "expected_binding_digest": schemaDigest()})
	blocker := schemaObject([]string{"blocker_id", "condition", "observed_binding_digest"}, map[string]any{"blocker_id": schemaID(), "condition": condition, "observed_binding_digest": schemaDigest()})
	return []ActionPayloadSchema{
		{domain.ActionCompleteRequirements, requirements}, {domain.ActionCompleteDesign, design}, {domain.ActionCompleteTasks, tasks},
		{domain.ActionCompleteImplementation, implementation}, {domain.ActionCompleteTest, test}, {domain.ActionCompleteComprehensionReview, comprehension},
		{domain.ActionCompleteRefactor, refactor}, {domain.ActionCompleteDelivery, delivery}, {domain.ActionResolveBlocker, blocker},
	}
}

// ActionPayloadSchemaFor projects the exact payload schema for one persisted Action.
func ActionPayloadSchemaFor(action domain.ProcessAction) (json.RawMessage, error) {
	if action.Validate() != nil {
		return nil, domain.ErrInvalidArgument
	}
	for _, entry := range ActionPayloadSchemas() {
		if entry.Kind != action.Kind {
			continue
		}
		if action.Kind != domain.ActionResolveBlocker {
			properties := entry.Schema["properties"].(map[string]any)
			transitions := make([]string, len(action.AvailableTransitions))
			for index, transition := range action.AvailableTransitions {
				transitions[index] = string(transition.TransitionID)
			}
			properties["transition_id"] = map[string]any{"type": "string", "enum": transitions}
		}
		raw, err := json.Marshal(entry.Schema)
		if err != nil {
			return nil, domain.ErrInternal
		}
		return raw, nil
	}
	return nil, domain.ErrInvalidArgument
}

func schemaObject(required []string, properties map[string]any) map[string]any {
	return map[string]any{"type": "object", "additionalProperties": false, "required": required, "properties": properties}
}
func schemaString() map[string]any {
	return map[string]any{"type": "string", "minLength": 1, "maxLength": 4096}
}
func schemaID() map[string]any {
	return map[string]any{"type": "string", "minLength": 1, "maxLength": 128}
}
func schemaDigest() map[string]any {
	return map[string]any{"type": "string", "pattern": "^[0-9a-f]{64}$"}
}
func schemaList() map[string]any {
	return map[string]any{"type": "array", "maxItems": 64, "items": map[string]any{"type": "string", "maxLength": 4096}}
}
func schemaEnum(values ...string) map[string]any { return map[string]any{"enum": values} }
func nullableSchema(value any) map[string]any {
	return map[string]any{"anyOf": []any{value, map[string]any{"type": "null"}}}
}
func mergeSchemaProperties(left, right map[string]any) map[string]any {
	result := make(map[string]any, len(left)+len(right))
	for key, value := range left {
		result[key] = value
	}
	for key, value := range right {
		result[key] = value
	}
	return result
}
func evidenceCheckSchema(source string, automated bool) map[string]any {
	commandCount := map[string]any{"type": "integer", "const": 0}
	fullSuite := map[string]any{"type": "boolean", "const": false}
	if automated {
		commandCount = map[string]any{"type": "integer", "minimum": 1, "maximum": 20}
		fullSuite = map[string]any{"type": "boolean"}
	}
	schema := schemaObject([]string{"source", "name", "status", "summary", "command_count", "full_suite"}, map[string]any{
		"source": map[string]any{"const": source}, "name": schemaString(), "status": schemaEnum("passed", "failed", "skipped", "not_run", "observed"), "summary": schemaString(), "command_count": commandCount, "full_suite": fullSuite,
	})
	schema["title"] = source
	return schema
}
func standardPayloadSchema(nodeResult map[string]any) map[string]any {
	artifact := schemaObject([]string{"role", "path", "digest", "summary"}, map[string]any{"role": schemaEnum("requirements", "design", "task_plan", "implementation", "test", "comprehension", "refactor", "delivery", "other_process"), "path": schemaString(), "digest": schemaDigest(), "summary": schemaString()})
	method := schemaObject([]string{"step_id", "status", "capability", "summary"}, map[string]any{"step_id": schemaID(), "status": schemaEnum("completed", "not_run", "unavailable", "plain_fallback"), "capability": map[string]any{"type": "string", "maxLength": 128, "pattern": "^[a-z0-9_.@-]*$"}, "summary": schemaString()})
	return schemaObject([]string{"transition_id", "summary", "reason", "artifacts", "method_evidence", "node_result"}, map[string]any{
		"transition_id": schemaID(), "summary": schemaString(), "reason": map[string]any{"type": "string", "maxLength": 4096}, "artifacts": map[string]any{"type": "array", "maxItems": 16, "items": artifact}, "method_evidence": map[string]any{"type": "array", "maxItems": 16, "items": method}, "node_result": nodeResult,
	})
}
