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
func nullableSchema(value any) map[string]any {
	return map[string]any{"anyOf": []any{value, map[string]any{"type": "null"}}}
}

// schemaTypeOrder fixes the order of a projected JSON Schema type union so the
// published catalog stays byte-stable across builds.
var schemaTypeOrder = []string{"object", "array", "string", "integer", "number", "boolean", "null"}

// projectableUnion relaxes closed alternative schemas into one closed schema
// that declares an explicit type on every node and carries no composition
// keyword. A Host tool-schema projector that cannot model `anyOf`, `oneOf`, or
// `allOf` replaces every node carrying one with an empty schema, so a
// discriminated union is invisible to the caller even when it is valid JSON
// Schema. The exact per-branch contract remains Core-owned and is reported as
// field-level violations instead of Host-side narrowing.
func projectableUnion(alternatives []any) map[string]any {
	var merged map[string]any
	for _, alternative := range alternatives {
		flattened := flattenSchema(alternative)
		if len(flattened) == 0 {
			continue
		}
		if merged == nil {
			merged = flattened
			continue
		}
		merged = mergeSchema(merged, flattened)
	}
	return merged
}

// flattenSchema removes composition keywords from one schema tree. `anyOf` and
// `oneOf` alternatives are relaxed into their union; `allOf` narrowing is
// dropped because a union cannot carry a per-alternative constraint.
func flattenSchema(value any) map[string]any {
	schema, ok := value.(map[string]any)
	if !ok {
		return nil
	}
	residual := make(map[string]any, len(schema))
	for key, member := range schema {
		switch key {
		case "anyOf", "oneOf", "allOf", "title":
		case "properties":
			residual[key] = flattenSchemaProperties(member)
		case "items":
			residual[key] = flattenSchema(member)
		default:
			residual[key] = member
		}
	}
	normalized := normalizeSchemaLeaf(residual)
	var alternatives []any
	for _, key := range []string{"anyOf", "oneOf"} {
		alternatives = append(alternatives, schemaAlternatives(schema[key])...)
	}
	if len(alternatives) == 0 {
		return normalized
	}
	union := projectableUnion(alternatives)
	if len(normalized) == 0 {
		return union
	}
	return mergeSchema(normalized, union)
}
func flattenSchemaProperties(value any) map[string]any {
	properties, ok := value.(map[string]any)
	if !ok {
		return map[string]any{}
	}
	out := make(map[string]any, len(properties))
	for name, member := range properties {
		out[name] = flattenSchema(member)
	}
	return out
}
func schemaAlternatives(value any) []any {
	switch items := value.(type) {
	case []any:
		return items
	case []map[string]any:
		out := make([]any, len(items))
		for i, item := range items {
			out[i] = item
		}
		return out
	default:
		return nil
	}
}

// normalizeSchemaLeaf rewrites `const` into a single-value `enum` and gives
// every node an explicit type, mirroring what a projector can model.
func normalizeSchemaLeaf(schema map[string]any) map[string]any {
	if len(schema) == 0 {
		return schema
	}
	if constant, ok := schema["const"]; ok {
		delete(schema, "const")
		switch value := constant.(type) {
		case string, bool:
			schema["enum"] = []any{value}
		default:
			schema["minimum"], schema["maximum"] = value, value
		}
	}
	if _, ok := schema["type"]; !ok {
		schema["type"] = inferredSchemaType(schema)
	}
	return schema
}
func inferredSchemaType(schema map[string]any) string {
	switch {
	case hasSchemaKey(schema, "properties", "required", "additionalProperties"):
		return "object"
	case hasSchemaKey(schema, "items", "maxItems"):
		return "array"
	case hasSchemaKey(schema, "enum"):
		return enumSchemaType(schema["enum"])
	case hasSchemaKey(schema, "minimum", "maximum"):
		return "integer"
	default:
		return "string"
	}
}
func hasSchemaKey(schema map[string]any, keys ...string) bool {
	for _, key := range keys {
		if _, ok := schema[key]; ok {
			return true
		}
	}
	return false
}
func enumSchemaType(value any) string {
	for _, item := range enumValues(value) {
		switch item.(type) {
		case bool:
			return "boolean"
		case string:
			return "string"
		default:
			return "integer"
		}
	}
	return "string"
}
func enumValues(value any) []any {
	switch items := value.(type) {
	case []any:
		return items
	case []string:
		out := make([]any, len(items))
		for i, item := range items {
			out[i] = item
		}
		return out
	default:
		return nil
	}
}

// mergeSchema relaxes two flattened schemas into the smallest closed schema
// that accepts both.
func mergeSchema(left, right map[string]any) map[string]any {
	if isNullSchema(right) {
		return withNullableType(left)
	}
	if isNullSchema(left) {
		return withNullableType(right)
	}
	merged := map[string]any{"type": mergeSchemaTypes(left["type"], right["type"])}
	if properties := unionSchemaProperties(left["properties"], right["properties"]); len(properties) != 0 {
		merged["properties"] = properties
		merged["additionalProperties"] = false
		if required := intersectSchemaRequired(left["required"], right["required"]); len(required) != 0 {
			merged["required"] = required
		}
	}
	if items := mergeSchemaItems(left["items"], right["items"]); items != nil {
		merged["items"] = items
	}
	if values := unionSchemaEnums(left["enum"], right["enum"]); values != nil {
		merged["enum"] = values
	}
	for _, bound := range []struct {
		key     string
		takeMax bool
	}{{"minimum", false}, {"maximum", true}, {"minLength", false}, {"maxLength", true}, {"maxItems", true}} {
		if value, ok := mergeSchemaBound(left[bound.key], right[bound.key], bound.takeMax); ok {
			merged[bound.key] = value
		}
	}
	if pattern, ok := left["pattern"].(string); ok && pattern == right["pattern"] {
		merged["pattern"] = pattern
	}
	return merged
}
func isNullSchema(schema map[string]any) bool {
	return len(schema) == 1 && schema["type"] == "null"
}
func withNullableType(schema map[string]any) map[string]any {
	out := make(map[string]any, len(schema))
	for key, value := range schema {
		out[key] = value
	}
	out["type"] = mergeSchemaTypes(schema["type"], "null")
	return out
}
func mergeSchemaTypes(left, right any) any {
	present := map[string]bool{}
	for _, value := range []any{left, right} {
		for _, name := range schemaStringList(value) {
			present[name] = true
		}
	}
	out := make([]string, 0, len(present))
	for _, name := range schemaTypeOrder {
		if present[name] {
			out = append(out, name)
		}
	}
	if len(out) == 1 {
		return out[0]
	}
	return out
}
func schemaStringList(value any) []string {
	switch typed := value.(type) {
	case string:
		return []string{typed}
	case []string:
		return typed
	case []any:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			if name, ok := item.(string); ok {
				out = append(out, name)
			}
		}
		return out
	default:
		return nil
	}
}
func unionSchemaProperties(left, right any) map[string]any {
	leftProperties, _ := left.(map[string]any)
	rightProperties, _ := right.(map[string]any)
	if len(leftProperties) == 0 && len(rightProperties) == 0 {
		return nil
	}
	out := make(map[string]any, len(leftProperties)+len(rightProperties))
	for name, value := range leftProperties {
		out[name] = value
	}
	for name, value := range rightProperties {
		existing, ok := out[name].(map[string]any)
		incoming, incomingOK := value.(map[string]any)
		if ok && incomingOK {
			out[name] = mergeSchema(existing, incoming)
			continue
		}
		out[name] = value
	}
	return out
}
func intersectSchemaRequired(left, right any) []string {
	rightNames := map[string]bool{}
	for _, name := range schemaStringList(right) {
		rightNames[name] = true
	}
	var out []string
	for _, name := range schemaStringList(left) {
		if rightNames[name] {
			out = append(out, name)
		}
	}
	return out
}
func mergeSchemaItems(left, right any) map[string]any {
	leftItems, leftOK := left.(map[string]any)
	rightItems, rightOK := right.(map[string]any)
	switch {
	case leftOK && rightOK:
		return mergeSchema(leftItems, rightItems)
	case leftOK:
		return leftItems
	case rightOK:
		return rightItems
	default:
		return nil
	}
}
func unionSchemaEnums(left, right any) []any {
	leftValues, rightValues := enumValues(left), enumValues(right)
	if len(leftValues) == 0 || len(rightValues) == 0 {
		return nil
	}
	out := append([]any(nil), leftValues...)
	for _, value := range rightValues {
		duplicate := false
		for _, existing := range out {
			if existing == value {
				duplicate = true
				break
			}
		}
		if !duplicate {
			out = append(out, value)
		}
	}
	return out
}
func mergeSchemaBound(left, right any, takeMax bool) (int, bool) {
	leftValue, leftOK := schemaNumber(left)
	rightValue, rightOK := schemaNumber(right)
	if !leftOK || !rightOK {
		return 0, false
	}
	if takeMax == (rightValue > leftValue) {
		return rightValue, true
	}
	return leftValue, true
}
func schemaNumber(value any) (int, bool) {
	switch typed := value.(type) {
	case int:
		return typed, true
	case int64:
		return int(typed), true
	case float64:
		return int(typed), true
	default:
		return 0, false
	}
}

// A Host tool-schema projector models a bounded keyword subset and enforces a
// small byte budget on the modelled result. Once that budget is exceeded the
// projector discards descriptions, then definition tables, then every complex
// object below its collapse depth, and finally every node carrying a
// composition keyword. The published projection therefore keeps every member
// name, every type and every object closure, and keeps only the enumerations
// and required sets that a caller cannot read from the current Action. The exact
// per-action-kind and per-evidence-source contract stays Core-owned and is
// reported as field-level violations.
var (
	projectedEnumPaths = map[string]bool{
		"host":       true,
		"process_id": true,
		// The discriminant. A caller cannot choose a payload branch without it.
		"action_kind": true,
		// The evidence source drives every other evidence rule.
		"payload.node_result.checks[].source": true,
	}
	projectedRequiredPaths = map[string]bool{
		"":        true,
		"payload": true,
	}
	// Rule text that must survive projection lives in the tool description,
	// which is projected in full and is not charged against the schema budget.
	// Schema descriptions are the first thing a projector discards.
	projectedDescriptions = map[string]string{}
)

// applyToolDescription states the cross-field rules the published projection
// cannot carry structurally. It is the caller-visible source-specific contract.
const applyToolDescription = "Apply one Core-declared transition. " +
	"Send the exact action_kind, payload branch and identity fields from the current Core action. " +
	"Evidence rule: checks[].command_count is 1 to 20 only when checks[].source is automated, " +
	"and is exactly 0 with checks[].full_suite false when the source is user, static or host_observed. " +
	"Record a completed user verification in checks; keep manual_handoff_items for work nobody has run yet. " +
	"Core rejects a mismatched branch with INVALID_ARGUMENT plus the exact failing field path."

// projectForHostBudget applies the published-projection rules above to one
// flattened schema tree.
func projectForHostBudget(schema map[string]any, path string) map[string]any {
	out := make(map[string]any, len(schema))
	for key, value := range schema {
		switch key {
		case "enum":
			if projectedEnumPaths[path] {
				out[key] = value
			}
		case "required":
			if projectedRequiredPaths[path] {
				out[key] = value
			}
		case "properties":
			members, _ := value.(map[string]any)
			projected := make(map[string]any, len(members))
			for name, member := range members {
				child, ok := member.(map[string]any)
				if !ok {
					continue
				}
				projected[name] = projectForHostBudget(child, joinSchemaPath(path, name))
			}
			out[key] = projected
		case "items":
			item, ok := value.(map[string]any)
			if !ok {
				continue
			}
			out[key] = projectForHostBudget(item, path+"[]")
		default:
			out[key] = value
		}
	}
	if description, ok := projectedDescriptions[path]; ok {
		out["description"] = description
	}
	return out
}
func joinSchemaPath(path, name string) string {
	if path == "" {
		return name
	}
	return path + "." + name
}
func evidenceCheckSchema(source string, automated bool) map[string]any {
	commandCount := map[string]any{"type": "integer", "const": 0}
	fullSuite := map[string]any{"type": "boolean", "const": false}
	if automated {
		commandCount = map[string]any{"type": "integer", "minimum": 1, "maximum": 20}
		fullSuite = map[string]any{"type": "boolean"}
	}
	return obj(
		[]string{"source", "name", "status", "summary", "command_count", "full_suite"},
		map[string]any{
			"source":        map[string]any{"const": source},
			"name":          str(),
			"status":        map[string]any{"enum": []string{"passed", "failed", "skipped", "not_run", "observed"}},
			"summary":       str(),
			"command_count": commandCount,
			"full_suite":    fullSuite,
		},
	)
}
func payloadSchema(nodeResult map[string]any) map[string]any {
	artifact := obj([]string{"role", "path", "digest", "summary"}, map[string]any{"role": map[string]any{"enum": []string{"requirements", "design", "task_plan", "implementation", "test", "comprehension", "refactor", "delivery", "other_process"}}, "path": str(), "digest": digest(), "summary": str()})
	method := obj([]string{"step_id", "status", "capability", "summary"}, map[string]any{"step_id": id(), "status": map[string]any{"enum": []string{"completed", "not_run", "unavailable", "plain_fallback"}}, "capability": map[string]any{"type": "string", "maxLength": 128, "pattern": "^[a-z0-9_.@-]*$"}, "summary": str()})
	return obj([]string{"transition_id", "summary", "reason", "artifacts", "method_evidence", "node_result"}, map[string]any{"transition_id": id(), "summary": str(), "reason": map[string]any{"type": "string", "maxLength": 4096}, "artifacts": map[string]any{"type": "array", "maxItems": 16, "items": artifact}, "method_evidence": map[string]any{"type": "array", "maxItems": 16, "items": method}, "node_result": nodeResult})
}
func graphPayloads() ([]any, []string) {
	baselineReq := obj([]string{"goal", "scope", "out_of_scope", "acceptance_criteria", "constraints", "assumptions"}, map[string]any{"goal": str(), "scope": list(), "out_of_scope": list(), "acceptance_criteria": list(), "constraints": list(), "assumptions": list()})
	mutation := map[string]any{"changed_paths": list(), "no_file_changes": map[string]any{"type": "boolean"}}
	requirements := payloadSchema(obj([]string{"problem_class", "baseline", "unresolved_questions", "changed_paths", "no_file_changes"}, mergeProperties(map[string]any{"problem_class": problemClass("none"), "baseline": baselineReq, "unresolved_questions": list()}, mutation)))
	designBase := obj([]string{"requirements_revision", "approach", "components", "decisions", "rejected_alternatives", "complexity_justification", "risks"}, map[string]any{"requirements_revision": map[string]any{"type": "integer", "minimum": 1}, "approach": str(), "components": list(), "decisions": list(), "rejected_alternatives": list(), "complexity_justification": list(), "risks": list()})
	design := payloadSchema(obj([]string{"problem_class", "baseline", "findings", "changed_paths", "no_file_changes"}, mergeProperties(map[string]any{"problem_class": problemClass("none", "requirement_gap"), "baseline": nullableSchema(designBase), "findings": list()}, mutation)))
	work := obj([]string{"work_item_id", "summary", "expected_paths", "acceptance_indexes", "verification_steps", "dependencies"}, map[string]any{"work_item_id": id(), "summary": str(), "expected_paths": list(), "acceptance_indexes": map[string]any{"type": "array", "items": map[string]any{"type": "integer", "minimum": 0}}, "verification_steps": list(), "dependencies": map[string]any{"type": "array", "items": id()}})
	tasksBase := obj([]string{"design_revision", "work_items"}, map[string]any{"design_revision": map[string]any{"type": "integer", "minimum": 1}, "work_items": map[string]any{"type": "array", "maxItems": 64, "items": work}})
	tasks := payloadSchema(obj([]string{"problem_class", "baseline", "findings", "changed_paths", "no_file_changes"}, mergeProperties(map[string]any{"problem_class": problemClass("none", "design_gap", "requirement_gap"), "baseline": nullableSchema(tasksBase), "findings": list()}, mutation)))
	implementation := payloadSchema(obj([]string{"problem_class", "task_plan_revision", "completed_work_item_ids", "changed_paths", "no_file_changes", "deviations", "findings"}, map[string]any{"problem_class": problemClass("none", "design_gap", "requirement_gap", "code_complexity"), "task_plan_revision": map[string]any{"type": "integer", "minimum": 1}, "completed_work_item_ids": map[string]any{"type": "array", "items": id()}, "changed_paths": list(), "no_file_changes": map[string]any{"type": "boolean"}, "deviations": list(), "findings": list()}))
	check := map[string]any{"oneOf": []any{
		evidenceCheckSchema("automated", true),
		evidenceCheckSchema("user", false),
		evidenceCheckSchema("static", false),
		evidenceCheckSchema("host_observed", false),
	}}
	test := payloadSchema(obj([]string{"problem_class", "checks", "failed_items", "unverified_items", "manual_handoff_items", "findings", "changed_paths", "no_file_changes"}, mergeProperties(map[string]any{"problem_class": problemClass("none", "implementation_failure", "design_failure", "requirement_gap"), "checks": map[string]any{"type": "array", "maxItems": 32, "items": check}, "failed_items": list(), "unverified_items": list(), "manual_handoff_items": list(), "findings": list()}, mutation)))
	confirmation := obj([]string{"source", "status", "summary"}, map[string]any{"source": map[string]any{"const": "user"}, "status": map[string]any{"const": "passed"}, "summary": str()})
	comprehension := payloadSchema(obj([]string{"problem_class", "explained_components", "unresolved_questions", "unnecessary_abstractions", "maintenance_risks", "user_confirmation", "findings", "changed_paths", "no_file_changes"}, mergeProperties(map[string]any{"problem_class": problemClass("none", "implementation_defect", "code_complexity", "design_complexity", "verification_gap", "requirement_gap"), "explained_components": list(), "unresolved_questions": list(), "unnecessary_abstractions": list(), "maintenance_risks": list(), "user_confirmation": nullableSchema(confirmation), "findings": list()}, mutation)))
	refactor := payloadSchema(obj([]string{"problem_class", "changed_paths", "no_file_changes", "simplifications", "behavior_change_intended", "findings"}, map[string]any{"problem_class": problemClass("none", "design_change", "requirement_change"), "changed_paths": list(), "no_file_changes": map[string]any{"type": "boolean"}, "simplifications": list(), "behavior_change_intended": map[string]any{"type": "boolean"}, "findings": list()}))
	delivery := payloadSchema(obj([]string{"problem_class", "acceptance", "automated_evidence_ids", "manual_evidence_ids", "test_record_id", "comprehension_record_id", "unverified_items", "risks", "findings", "changed_paths", "no_file_changes"}, mergeProperties(map[string]any{"problem_class": problemClass("none", "implementation_gap", "test_gap", "comprehension_gap", "design_gap", "requirement_gap"), "acceptance": map[string]any{"type": "array", "items": obj([]string{"criterion", "status"}, map[string]any{"criterion": str(), "status": map[string]any{"const": "satisfied"}})}, "automated_evidence_ids": map[string]any{"type": "array", "items": id()}, "manual_evidence_ids": map[string]any{"type": "array", "items": id()}, "test_record_id": id(), "comprehension_record_id": id(), "unverified_items": list(), "risks": list(), "findings": list()}, mutation)))
	condition := obj([]string{"kind", "expected_binding_digest"}, map[string]any{"kind": map[string]any{"const": "restore_issuance_binding"}, "expected_binding_digest": digest()})
	blocker := obj([]string{"blocker_id", "condition", "observed_binding_digest"}, map[string]any{"blocker_id": id(), "condition": condition, "observed_binding_digest": digest()})
	payloads := []any{requirements, design, tasks, implementation, test, comprehension, refactor, delivery, blocker}
	kinds := []string{"COMPLETE_REQUIREMENTS", "COMPLETE_DESIGN", "COMPLETE_TASKS", "COMPLETE_IMPLEMENTATION", "COMPLETE_TEST", "COMPLETE_COMPREHENSION_REVIEW", "COMPLETE_REFACTOR", "COMPLETE_DELIVERY", "RESOLVE_BLOCKER"}
	return payloads, kinds
}
func buildCatalog() []ToolDefinition {
	budget := obj([]string{"level", "max_automatic_commands", "allow_full_suite", "allow_manual_handoff"}, map[string]any{"level": map[string]any{"enum": []string{"minimal", "targeted", "full"}}, "max_automatic_commands": map[string]any{"type": "integer", "minimum": 0, "maximum": 20}, "allow_full_suite": map[string]any{"type": "boolean"}, "allow_manual_handoff": map[string]any{"type": "boolean"}})
	newTask := obj([]string{"request", "initial_scope", "initial_out_of_scope", "known_acceptance_criteria", "verification_budget", "method_profile"}, map[string]any{"request": map[string]any{"type": "string", "minLength": 1, "maxLength": 8192}, "initial_scope": list(), "initial_out_of_scope": list(), "known_acceptance_criteria": list(), "verification_budget": budget, "method_profile": map[string]any{"enum": []string{"plain", "spec-kit", "openspec"}}})
	empty := obj([]string{}, map[string]any{})
	payloads, kinds := graphPayloads()
	standardPayload := map[string]any{"oneOf": payloads}
	payload := map[string]any{"anyOf": []any{standardPayload, map[string]any{"type": "null"}}}
	probe := obj([]string{"operation_id", "process_id", "process_definition_digest", "source_cursor", "expected_revision", "action_id", "action_kind", "repository_binding_digest", "payload"}, map[string]any{"operation_id": id(), "process_id": map[string]any{"const": "standard-development"}, "process_definition_digest": digest(), "source_cursor": id(), "expected_revision": map[string]any{"type": "integer", "minimum": 1}, "action_id": id(), "action_kind": id(), "repository_binding_digest": digest(), "payload": projectForHostBudget(projectableUnion([]any{payload, map[string]any{"type": "null"}}), "payload")})
	read := obj([]string{"host", "task_id"}, map[string]any{"host": map[string]any{"enum": []string{"codex", "deepseek"}}, "task_id": id(), "operation_probe": projectableUnion([]any{probe, map[string]any{"type": "null"}})})
	recoveryApply := obj([]string{"operation_id", "source_cursor"}, map[string]any{"operation_id": id(), "source_cursor": id()})
	applyProps := map[string]any{"request_id": id(), "host": map[string]any{"enum": []string{"codex", "deepseek"}}, "task_id": id(), "revision": map[string]any{"type": "integer", "minimum": 1}, "action_id": id(), "action_kind": id(), "process_id": map[string]any{"const": "standard-development"}, "process_definition_digest": digest(), "source_cursor": id(), "repository_binding_digest": digest(), "payload": payload, "recovery_apply": map[string]any{"anyOf": []any{recoveryApply, map[string]any{"type": "null"}}}}
	requiredApply := []string{"request_id", "host", "task_id", "revision", "action_id", "action_kind", "process_id", "process_definition_digest", "source_cursor", "repository_binding_digest", "payload"}
	applyBranches := make([]any, len(kinds))
	for index, kind := range kinds {
		properties := mergeProperties(applyProps, map[string]any{
			"action_kind": map[string]any{"const": kind},
			"payload":     nullableSchema(payloads[index]),
		})
		branch := obj(requiredApply, properties)
		branch["title"] = kind
		branch["allOf"] = []any{map[string]any{"anyOf": []any{
			map[string]any{"required": []string{"recovery_apply"}, "properties": map[string]any{"recovery_apply": recoveryApply}},
			map[string]any{"properties": map[string]any{"recovery_apply": map[string]any{"type": "null"}, "payload": payloads[index]}},
		}}}
		applyBranches[index] = branch
	}
	apply := projectForHostBudget(projectableUnion(applyBranches), "")
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
	return []ToolDefinition{makeTool(ToolServerInfo, "Read the current Core server identity.", empty, true, true, false), makeTool(ToolOpenTask, "Open or resume one graph task.", open, false, false, false), makeTool(ToolGetTask, "Read one graph task.", read, true, true, false), makeTool(ToolGetNextAction, "Read the persisted graph action.", read, true, true, false), makeTool(ToolApplyAction, applyToolDescription, apply, false, false, false), makeTool(ToolCancelTask, "Cancel one graph task.", cancel, false, false, true)}
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
