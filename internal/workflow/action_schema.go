package workflow

import (
	"encoding/json"
	"sort"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

// ActionPayloadSchema binds one current Action kind to its closed payload contract.
type ActionPayloadSchema struct {
	Kind   domain.ActionKind
	Schema map[string]any
}

var deliveryAuthorityMembers = []string{
	"acceptance",
	"automated_evidence_ids",
	"manual_evidence_ids",
	"test_record_id",
	"comprehension_record_id",
}

// DeliveryAuthorityMembers returns the canonical Delivery members owned and
// hydrated only by Core.
func DeliveryAuthorityMembers() []string {
	return append([]string(nil), deliveryAuthorityMembers...)
}

// ActionPayloadSchemas returns the closed payload contracts accepted by the current workflow.
func ActionPayloadSchemas() []ActionPayloadSchema {
	baselineRequirements := schemaObject([]string{"goal", "scope", "out_of_scope", "acceptance_criteria", "constraints", "assumptions"}, map[string]any{
		"goal": schemaString(), "scope": schemaList(), "out_of_scope": schemaList(), "acceptance_criteria": schemaList(), "constraints": schemaList(), "assumptions": schemaList(),
	})
	requirements := standardPayloadSchema(schemaObject([]string{"problem_class", "baseline", "unresolved_questions"}, map[string]any{
		"problem_class": schemaEnum("none"), "baseline": baselineRequirements, "unresolved_questions": schemaList(),
	}))
	designBaseline := schemaObject([]string{"requirements_revision", "approach", "components", "decisions", "rejected_alternatives", "complexity_justification", "risks"}, map[string]any{
		"requirements_revision": map[string]any{"type": "integer", "minimum": 1}, "approach": schemaString(), "components": schemaList(), "decisions": schemaList(), "rejected_alternatives": schemaList(), "complexity_justification": schemaList(), "risks": schemaList(),
	})
	design := standardPayloadSchema(schemaObject([]string{"problem_class", "baseline", "findings"}, map[string]any{
		"problem_class": schemaEnum("none", "requirement_gap"), "baseline": nullableSchema(designBaseline), "findings": schemaList(),
	}))
	workItem := schemaObject([]string{"work_item_id", "summary", "expected_paths", "acceptance_indexes", "verification_steps", "dependencies"}, map[string]any{
		"work_item_id": schemaID(), "summary": schemaString(), "expected_paths": schemaList(), "acceptance_indexes": map[string]any{"type": "array", "items": map[string]any{"type": "integer", "minimum": 0}}, "verification_steps": schemaList(), "dependencies": map[string]any{"type": "array", "items": schemaID()},
	})
	verificationCheck := schemaObject([]string{"name", "rationale"}, map[string]any{"name": schemaString(), "rationale": schemaString()})
	verificationBudget := schemaObject([]string{"level", "max_automatic_commands", "allow_full_suite", "allow_manual_handoff"}, map[string]any{
		"level": schemaEnum("minimal", "targeted", "full"), "max_automatic_commands": map[string]any{"type": "integer", "minimum": 0, "maximum": domain.MaxTotalAutomaticVerificationCommands}, "allow_full_suite": map[string]any{"type": "boolean"}, "allow_manual_handoff": map[string]any{"type": "boolean"},
	})
	verificationPlan := schemaObject([]string{"checks", "initial_budget", "full_suite_expected", "test_code_changes_expected"}, map[string]any{
		"checks": map[string]any{"type": "array", "minItems": 1, "maxItems": domain.MaxBoundedStringListItems, "items": verificationCheck}, "initial_budget": verificationBudget, "full_suite_expected": map[string]any{"type": "boolean"}, "test_code_changes_expected": map[string]any{"type": "boolean"},
	})
	tasksBaseline := schemaObject([]string{"design_revision", "work_items", "verification_plan"}, map[string]any{"design_revision": map[string]any{"type": "integer", "minimum": 1}, "work_items": map[string]any{"type": "array", "maxItems": 64, "items": workItem}, "verification_plan": verificationPlan})
	tasks := standardPayloadSchema(schemaObject([]string{"problem_class", "baseline", "findings"}, map[string]any{
		"problem_class": schemaEnum("none", "design_gap", "requirement_gap"), "baseline": nullableSchema(tasksBaseline), "findings": schemaList(),
	}))
	implementation := standardPayloadSchema(schemaObject([]string{"problem_class", "task_plan_revision", "completed_work_item_ids", "deviations", "findings"}, map[string]any{
		"problem_class": schemaEnum("none", "design_gap", "requirement_gap", "code_complexity"), "task_plan_revision": map[string]any{"type": "integer", "minimum": 1}, "completed_work_item_ids": map[string]any{"type": "array", "items": schemaID()}, "deviations": schemaList(), "findings": schemaList(),
	}))
	check := map[string]any{"oneOf": []any{
		evidenceCheckSchema("automated", true), evidenceCheckSchema("user", false), evidenceCheckSchema("static", false), evidenceCheckSchema("host_observed", false),
	}}
	budgetAdjustment := schemaObject([]string{"basis", "additional_checks", "additional_automatic_commands", "allow_full_suite", "allow_manual_handoff"}, map[string]any{
		"basis": schemaEnum("new_impact", "new_risk", "verification_failure", "verification_gap"), "additional_checks": map[string]any{"type": "array", "minItems": 1, "maxItems": domain.MaxBoundedStringListItems, "items": verificationCheck}, "additional_automatic_commands": map[string]any{"type": "integer", "minimum": 0, "maximum": domain.MaxAutomaticVerificationCommands}, "allow_full_suite": map[string]any{"type": "boolean"}, "allow_manual_handoff": map[string]any{"type": "boolean"},
	})
	test := standardPayloadSchema(schemaObject([]string{"problem_class", "checks", "failed_items", "unverified_items", "manual_handoff_items", "findings", "budget_adjustment"}, map[string]any{
		"problem_class": schemaEnum("none", "implementation_failure", "design_failure", "requirement_gap"), "checks": map[string]any{"type": "array", "maxItems": 32, "items": check}, "failed_items": schemaList(), "unverified_items": schemaList(), "manual_handoff_items": schemaList(), "findings": schemaList(), "budget_adjustment": nullableSchema(budgetAdjustment),
	}))
	confirmation := schemaObject([]string{"source", "status", "summary"}, map[string]any{"source": map[string]any{"const": "user"}, "status": map[string]any{"const": "passed"}, "summary": schemaString()})
	comprehension := standardPayloadSchema(schemaObject([]string{"problem_class", "explained_components", "unresolved_questions", "unnecessary_abstractions", "maintenance_risks", "user_confirmation", "findings"}, map[string]any{
		"problem_class": schemaEnum("none", "implementation_defect", "code_complexity", "design_complexity", "verification_gap", "requirement_gap"), "explained_components": schemaList(), "unresolved_questions": schemaList(), "unnecessary_abstractions": schemaList(), "maintenance_risks": schemaList(), "user_confirmation": nullableSchema(confirmation), "findings": schemaList(),
	}))
	refactor := standardPayloadSchema(schemaObject([]string{"problem_class", "simplifications", "behavior_change_intended", "findings"}, map[string]any{
		"problem_class": schemaEnum("none", "design_change", "requirement_change"), "simplifications": schemaList(), "behavior_change_intended": map[string]any{"type": "boolean"}, "findings": schemaList(),
	}))
	delivery := standardPayloadSchema(schemaObject([]string{"problem_class", "acceptance", "automated_evidence_ids", "manual_evidence_ids", "test_record_id", "comprehension_record_id", "unverified_items", "risks", "findings"}, map[string]any{
		"problem_class": schemaEnum("none", "implementation_gap", "test_gap", "comprehension_gap", "design_gap", "requirement_gap"), "acceptance": map[string]any{"type": "array", "items": schemaObject([]string{"criterion", "status"}, map[string]any{"criterion": schemaString(), "status": map[string]any{"const": "satisfied"}})}, "automated_evidence_ids": map[string]any{"type": "array", "items": schemaID()}, "manual_evidence_ids": map[string]any{"type": "array", "items": schemaID()}, "test_record_id": schemaID(), "comprehension_record_id": schemaID(), "unverified_items": schemaList(), "risks": schemaList(), "findings": schemaList(),
	}))
	condition := schemaObject([]string{"kind", "expected_binding_digest", "expected_identity_digest", "expected_history_digest", "expected_content_digest"}, map[string]any{
		"kind": schemaEnum("restore_issuance_binding", "allow_verification_retry", "resolve_file_scope", "resolve_workspace_history", "resolve_task_relocation"), "expected_binding_digest": schemaDigest(), "expected_identity_digest": schemaDigest(), "expected_history_digest": schemaDigest(), "expected_content_digest": schemaDigest(), "scope_request_id": schemaID(), "relocation_id": schemaID(),
	})
	fileScopeDecision := schemaObject([]string{"choice", "reason"}, map[string]any{
		"choice": schemaEnum("allow_once", "expand_scope", "reject"), "reason": schemaString(),
	})
	relocationDestination := schemaObject([]string{"key", "repository_path"}, map[string]any{"key": schemaID(), "repository_path": schemaString()})
	historyResolution := schemaObject([]string{"choice", "reason"}, map[string]any{"choice": schemaEnum("accept_current_history"), "reason": schemaString()})
	blocker := schemaObject([]string{"blocker_id", "condition", "observed_binding_digest"}, map[string]any{
		"blocker_id": schemaID(), "condition": condition, "observed_binding_digest": schemaDigest(), "file_scope_decision": fileScopeDecision, "relocation_id": schemaID(), "relocation_destinations": map[string]any{"type": "array", "maxItems": domain.MaxRepositoryScopeEntries, "items": relocationDestination}, "history_resolution": historyResolution,
	})
	return []ActionPayloadSchema{
		{domain.ActionCompleteRequirements, requirements}, {domain.ActionCompleteDesign, design}, {domain.ActionCompleteTasks, tasks},
		{domain.ActionCompleteImplementation, implementation}, {domain.ActionCompleteTest, test}, {domain.ActionCompleteComprehensionReview, comprehension},
		{domain.ActionCompleteRefactor, refactor}, {domain.ActionCompleteDelivery, delivery}, {domain.ActionResolveBlocker, blocker},
	}
}

// ActionSubmissionPayloadSchemas derives the Host submission contracts from the
// canonical payload schemas. Every member owned by Core is absent from the
// closed submission object and added only after the current Action is bound.
func ActionSubmissionPayloadSchemas() []ActionPayloadSchema {
	entries := ActionPayloadSchemas()
	for index := range entries {
		properties, _ := entries[index].Schema["properties"].(map[string]any)
		nodeResult, _ := properties["node_result"].(map[string]any)
		nodeProperties, _ := nodeResult["properties"].(map[string]any)
		switch entries[index].Kind {
		case domain.ActionCompleteDesign:
			removeObjectMembers(nullableObjectSchema(nodeProperties["baseline"]), "requirements_revision")
		case domain.ActionCompleteTasks:
			removeObjectMembers(nullableObjectSchema(nodeProperties["baseline"]), "design_revision")
		case domain.ActionCompleteImplementation:
			removeObjectMembers(nodeResult, "task_plan_revision")
		case domain.ActionCompleteDelivery:
			removeObjectMembers(nodeResult, deliveryAuthorityMembers...)
		}
	}
	return entries
}

// SubmissionNodeResultSchema returns the closed node_result contract one
// submission tool accepts for its Action kind.
func SubmissionNodeResultSchema(kind domain.ActionKind) (map[string]any, error) {
	for _, entry := range ActionSubmissionPayloadSchemas() {
		if entry.Kind == kind {
			properties, _ := entry.Schema["properties"].(map[string]any)
			schema, _ := properties["node_result"].(map[string]any)
			if schema == nil {
				return nil, domain.ErrInvalidArgument
			}
			return schema, nil
		}
	}
	return nil, domain.ErrInvalidArgument
}

// ValidateSubmissionNodeResult checks one submitted node_result against the
// submission contract of its Action kind and reports every required member that
// is missing, with the exact field path. It is the MCP submission boundary, so
// every reported failure is a proven zero-write failure.
func ValidateSubmissionNodeResult(kind domain.ActionKind, raw json.RawMessage) error {
	if err := ValidateSubmissionNodeResultSyntax(raw); err != nil {
		return err
	}
	schema, err := SubmissionNodeResultSchema(kind)
	if err != nil {
		return err
	}
	if violations := unknownSubmissionMembers("node_result", raw, schema); len(violations) != 0 {
		return domain.InvalidArgumentViolations(violations...)
	}
	if violations := requiredMemberViolations("node_result", raw, schema); len(violations) != 0 {
		return domain.InvalidArgumentViolations(violations...)
	}
	return nil
}

// unknownSubmissionMembers walks the closed Host schema so Core-owned nested
// members are rejected before Application adds the canonical values.
func unknownSubmissionMembers(path string, raw json.RawMessage, schema map[string]any) []domain.ContractViolation {
	if schema == nil || isJSONNull(raw) {
		return nil
	}
	for _, keyword := range []string{"anyOf", "oneOf"} {
		if alternatives := schemaAlternatives(schema, keyword); alternatives != nil {
			valueType := rawJSONType(raw)
			for _, alternative := range alternatives {
				candidate, ok := alternative.(map[string]any)
				if ok && unionAlternativeMatches(candidate, valueType) {
					return unknownSubmissionMembers(path, raw, candidate)
				}
			}
			return nil
		}
	}
	members, ok := jsonObjectMembers(raw)
	if !ok {
		return nil
	}
	properties, _ := schema["properties"].(map[string]any)
	names := make([]string, 0, len(members))
	for name := range members {
		if _, known := properties[name]; !known {
			names = append(names, name)
		}
	}
	sort.Strings(names)
	violations := make([]domain.ContractViolation, 0, len(names))
	for _, name := range names {
		violations = append(violations, domain.Violation(path+"."+name, domain.RuleUnknownMember))
	}
	knownNames := make([]string, 0, len(members))
	for name := range members {
		if _, known := properties[name]; known {
			knownNames = append(knownNames, name)
		}
	}
	sort.Strings(knownNames)
	for _, name := range knownNames {
		member, _ := properties[name].(map[string]any)
		violations = append(violations, unknownSubmissionMembers(path+"."+name, members[name], member)...)
	}
	return violations
}

// ValidateSubmissionNodeResultSyntax rejects malformed or ambiguous JSON before
// Application hydrates system-state members. Hydration decodes object members
// into maps, so duplicate members must be rejected first instead of being
// silently collapsed during re-marshaling.
func ValidateSubmissionNodeResultSyntax(raw json.RawMessage) error {
	if len(raw) == 0 || len(raw) > domain.MaxActionPayloadBytes || !utf8.Valid(raw) || !json.Valid(raw) || rejectDuplicateMembers(raw) != nil {
		return domain.ErrInvalidArgument
	}
	return nil
}

// nullableObjectSchema unwraps the closed null/object union of one optional
// baseline member into its object alternative.
func nullableObjectSchema(value any) map[string]any {
	union, _ := value.(map[string]any)
	alternatives, _ := union["anyOf"].([]any)
	if len(alternatives) == 0 {
		return nil
	}
	object, _ := alternatives[0].(map[string]any)
	return object
}

func removeRequiredMember(schema map[string]any, name string) {
	if schema == nil {
		return
	}
	var kept []string
	switch required := schema["required"].(type) {
	case []string:
		for _, member := range required {
			if member != name {
				kept = append(kept, member)
			}
		}
	case []any:
		for _, member := range required {
			if text, _ := member.(string); text != "" && text != name {
				kept = append(kept, text)
			}
		}
	default:
		return
	}
	schema["required"] = kept
}

// removeObjectMembers removes Core-owned members from one closed submission
// object. They remain required in the canonical schema and are filled from the
// current Task snapshot before canonical validation.
func removeObjectMembers(schema map[string]any, names ...string) {
	if schema == nil {
		return
	}
	properties, _ := schema["properties"].(map[string]any)
	for _, name := range names {
		removeRequiredMember(schema, name)
		delete(properties, name)
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
	schema := schemaObject([]string{"source", "name", "status", "summary", "command_count", "full_suite", "full_suite_reason"}, map[string]any{
		"source": map[string]any{"const": source}, "name": schemaString(), "status": schemaEnum("passed", "failed", "skipped", "not_run", "observed"), "summary": schemaString(), "command_count": commandCount, "full_suite": fullSuite, "full_suite_reason": map[string]any{"type": "string", "maxLength": 4096},
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
