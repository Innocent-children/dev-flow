package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"testing"

	sdk "github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/Innocent-children/dev-flow/internal/application"
)

// The Host tool-schema projector models a bounded JSON Schema subset:
// $ref, type, description, enum, items, properties, required,
// additionalProperties, anyOf, oneOf, allOf, $defs and definitions. Every other
// keyword is dropped before the declaration reaches the caller. When the
// modelled schema exceeds the Host compaction budget the projector applies
// increasingly lossy passes: it strips descriptions, drops definition tables,
// replaces complex objects at or below the collapse depth with an empty schema,
// and finally replaces every node carrying a composition keyword with an empty
// schema. The last pass reaches the root, which is exactly how a discriminated
// root union becomes an untyped callable argument.
const (
	hostProjectionBudgetBytes = 5000
	hostProjectionMarginBytes = 64
	hostProjectionCollapse    = 3
)

var hostProjectionKeywords = map[string]bool{
	"$ref": true, "type": true, "description": true, "enum": true, "items": true,
	"properties": true, "required": true, "additionalProperties": true,
	"anyOf": true, "oneOf": true, "allOf": true, "$defs": true, "definitions": true,
}

var hostCompositionKeywords = []string{"anyOf", "oneOf", "allOf"}

// modelledHostSchema keeps only the keywords the Host projector can model.
func modelledHostSchema(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		out := map[string]any{}
		for key, member := range typed {
			if !hostProjectionKeywords[key] {
				continue
			}
			switch key {
			case "properties", "$defs", "definitions":
				table, _ := member.(map[string]any)
				projected := map[string]any{}
				for name, entry := range table {
					projected[name] = modelledHostSchema(entry)
				}
				out[key] = projected
			case "items", "additionalProperties":
				out[key] = modelledHostSchema(member)
			case "anyOf", "oneOf", "allOf":
				out[key] = modelledHostSchema(member)
			default:
				out[key] = member
			}
		}
		return out
	case []any:
		out := make([]any, len(typed))
		for i, member := range typed {
			out[i] = modelledHostSchema(member)
		}
		return out
	case []map[string]any:
		out := make([]any, len(typed))
		for i, member := range typed {
			out[i] = modelledHostSchema(member)
		}
		return out
	default:
		return value
	}
}

func modelledHostSchemaBytes(t *testing.T, raw json.RawMessage) int {
	t.Helper()
	var schema any
	if err := json.Unmarshal(raw, &schema); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(modelledHostSchema(schema))
	if err != nil {
		t.Fatal(err)
	}
	return len(encoded)
}

func toolSchema(t *testing.T, name string) map[string]any {
	t.Helper()
	for _, definition := range ToolCatalog() {
		if definition.Name != name {
			continue
		}
		var schema map[string]any
		if err := json.Unmarshal(definition.InputSchema, &schema); err != nil {
			t.Fatal(err)
		}
		return schema
	}
	t.Fatalf("tool %s is not in the catalog", name)
	return nil
}

// TestApplyActionSchemaIsHostProjectable is the Host projection contract. It
// fails for any apply schema the Host would reduce to an untyped argument.
func TestApplyActionSchemaIsHostProjectable(t *testing.T) {
	schema := toolSchema(t, ToolApplyAction)
	if schema["type"] != "object" {
		t.Fatalf("apply root type=%#v", schema["type"])
	}
	properties, ok := schema["properties"].(map[string]any)
	if !ok || len(properties) == 0 {
		t.Fatalf("apply root has no projectable properties: %#v", schema["properties"])
	}
	if schema["additionalProperties"] != false {
		t.Fatalf("apply root additionalProperties=%#v", schema["additionalProperties"])
	}
	for _, keyword := range hostCompositionKeywords {
		if _, present := schema[keyword]; present {
			t.Fatalf("apply root carries composition keyword %s; the Host projector replaces such a root with an empty schema", keyword)
		}
	}
	for _, name := range []string{"request_id", "host", "task_id", "revision", "action_id", "action_kind", "process_id", "process_definition_digest", "source_cursor", "repository_binding_digest", "payload", "recovery_apply"} {
		if _, present := properties[name]; !present {
			t.Fatalf("apply callable cannot see %s", name)
		}
	}
	assertHostProjectable(t, schema, "$")
}

// TestApplyActionSchemaFitsHostProjectionBudget keeps the published schema below
// the Host compaction budget so no lossy pass runs and nested structure at or
// below the collapse depth stays visible.
func TestApplyActionSchemaFitsHostProjectionBudget(t *testing.T) {
	for _, name := range []string{ToolApplyAction, ToolGetTask, ToolGetNextAction, ToolOpenTask, ToolCancelTask, ToolServerInfo} {
		for _, definition := range ToolCatalog() {
			if definition.Name != name {
				continue
			}
			size := modelledHostSchemaBytes(t, definition.InputSchema)
			if size > hostProjectionBudgetBytes-hostProjectionMarginBytes {
				t.Fatalf("%s modelled schema is %d bytes; the Host compaction budget is %d bytes and this feature reserves a %d byte margin", name, size, hostProjectionBudgetBytes, hostProjectionMarginBytes)
			}
			t.Logf("%s modelled schema = %d bytes", name, size)
		}
	}
}

// TestApplyActionTestEvidenceIsVisibleBelowCollapseDepth proves the TEST check
// structure survives at the depth the Host would otherwise collapse.
func TestApplyActionTestEvidenceSchemaIsVisible(t *testing.T) {
	schema := toolSchema(t, ToolApplyAction)
	payload := childSchema(t, schema, "payload")
	nodeResult := childSchema(t, payload, "node_result")
	checks := childSchema(t, nodeResult, "checks")
	if checks["type"] != "array" {
		t.Fatalf("checks type=%#v", checks["type"])
	}
	item, ok := checks["items"].(map[string]any)
	if !ok {
		t.Fatalf("checks items=%#v", checks["items"])
	}
	if item["type"] != "object" || item["additionalProperties"] != false {
		t.Fatalf("check item is not a closed object: %#v", item)
	}
	itemProperties := item["properties"].(map[string]any)
	for _, name := range []string{"source", "name", "status", "summary", "command_count", "full_suite"} {
		if _, present := itemProperties[name]; !present {
			t.Fatalf("check item cannot see %s", name)
		}
	}
	source := itemProperties["source"].(map[string]any)
	wantSources := []string{"automated", "user", "static", "host_observed"}
	got := stringSlice(source["enum"])
	if len(got) != len(wantSources) {
		t.Fatalf("check source enum=%#v", source["enum"])
	}
	for index, want := range wantSources {
		if got[index] != want {
			t.Fatalf("check source enum[%d]=%s", index, got[index])
		}
	}
	commandCount := itemProperties["command_count"].(map[string]any)
	if commandCount["type"] != "integer" || commandCount["minimum"] != float64(0) || commandCount["maximum"] != float64(20) {
		t.Fatalf("check command_count=%#v", commandCount)
	}
	fullSuite := itemProperties["full_suite"].(map[string]any)
	if fullSuite["type"] != "boolean" {
		t.Fatalf("check full_suite=%#v", fullSuite)
	}
}

// TestApplyActionToolDescriptionCarriesSourceRules keeps the cross-field evidence
// rules in the tool description. A projector charges the description separately
// from the schema budget and discards schema descriptions first, so the
// description is the only place a source-specific rule survives reliably.
func TestApplyActionEvidenceRulesAreInToolDescription(t *testing.T) {
	var description string
	for _, definition := range ToolCatalog() {
		if definition.Name == ToolApplyAction {
			description = definition.Description
		}
	}
	if len(description) > 1000 {
		t.Fatalf("apply description is %d bytes; a Host plugin truncates at 1000", len(description))
	}
	for _, required := range []string{
		"command_count is 1 to 20 only when checks[].source is automated",
		"exactly 0",
		"full_suite false",
		"user, static or host_observed",
		"Record a completed user verification in checks",
		"manual_handoff_items for work nobody has run yet",
		"INVALID_ARGUMENT",
	} {
		if !strings.Contains(description, required) {
			t.Fatalf("apply description does not state %q: %s", required, description)
		}
	}
}

// TestApplyActionSchemaSurvivesHostCompaction runs the Host compaction passes
// against both the published schema and the previous discriminated-union shape.
// The previous shape collapses to an empty schema, which is what makes the
// callable argument untyped; the published schema keeps its full surface.
func TestApplyActionSchemaSurvivesHostCompaction(t *testing.T) {
	legacy := hostCompact(t, legacyDiscriminatedApplySchema())
	legacyObject, ok := legacy.(map[string]any)
	if !ok || len(legacyObject) != 0 {
		t.Fatalf("the previous discriminated apply schema no longer reproduces the defect: %#v", legacy)
	}

	published := toolSchema(t, ToolApplyAction)
	compacted, ok := hostCompact(t, published).(map[string]any)
	if !ok || compacted["type"] != "object" {
		t.Fatalf("published apply schema collapsed: %#v", compacted)
	}
	properties, ok := compacted["properties"].(map[string]any)
	if !ok || len(properties) != 12 {
		t.Fatalf("published apply schema lost top-level properties: %#v", compacted["properties"])
	}
	kind, ok := properties["action_kind"].(map[string]any)
	if !ok || len(stringSlice(kind["enum"])) != 9 {
		t.Fatalf("action_kind discriminant did not survive: %#v", properties["action_kind"])
	}
	payload, ok := properties["payload"].(map[string]any)
	if !ok || len(payload) == 0 {
		t.Fatal("payload did not survive compaction")
	}
	nodeResult := childSchema(t, payload, "node_result")
	checks := childSchema(t, nodeResult, "checks")
	item, ok := checks["items"].(map[string]any)
	if !ok {
		t.Fatalf("checks items did not survive compaction: %#v", checks)
	}
	itemProperties, ok := item["properties"].(map[string]any)
	if !ok || len(itemProperties) != 6 {
		t.Fatalf("check item lost members during compaction: %#v", item)
	}
}

// legacyDiscriminatedApplySchema reproduces the previous nine-branch root union
// exactly as it was published, so the projection contract keeps a live witness
// of the defect instead of a prose claim.
func legacyDiscriminatedApplySchema() map[string]any {
	payloads, kinds := graphPayloads()
	generic := map[string]any{"anyOf": []any{map[string]any{"oneOf": payloads}, map[string]any{"type": "null"}}}
	recoveryApply := obj([]string{"operation_id", "source_cursor"}, map[string]any{"operation_id": id(), "source_cursor": id()})
	base := map[string]any{"request_id": id(), "host": map[string]any{"enum": []string{"codex", "deepseek"}}, "task_id": id(), "revision": map[string]any{"type": "integer", "minimum": 1}, "action_id": id(), "action_kind": id(), "process_id": map[string]any{"const": "standard-development"}, "process_definition_digest": digest(), "source_cursor": id(), "repository_binding_digest": digest(), "payload": generic, "recovery_apply": nullableSchema(recoveryApply)}
	required := []string{"request_id", "host", "task_id", "revision", "action_id", "action_kind", "process_id", "process_definition_digest", "source_cursor", "repository_binding_digest", "payload"}
	branches := make([]any, len(kinds))
	for index, kind := range kinds {
		properties := mergeProperties(base, map[string]any{"action_kind": map[string]any{"const": kind}, "payload": nullableSchema(payloads[index])})
		branch := obj(required, properties)
		branch["title"] = kind
		branch["allOf"] = []any{map[string]any{"anyOf": []any{
			map[string]any{"required": []string{"recovery_apply"}, "properties": map[string]any{"recovery_apply": recoveryApply}},
			map[string]any{"properties": map[string]any{"recovery_apply": map[string]any{"type": "null"}, "payload": payloads[index]}},
		}}}
		branches[index] = branch
	}
	return map[string]any{"type": "object", "oneOf": branches}
}

// hostCompact applies the Host compaction passes in order while the modelled
// schema stays over budget.
func hostCompact(t *testing.T, schema map[string]any) any {
	t.Helper()
	raw, err := json.Marshal(schema)
	if err != nil {
		t.Fatal(err)
	}
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		t.Fatal(err)
	}
	passes := []func(any) any{
		hostStripDescriptions,
		hostDropDefinitions,
		func(node any) any { return hostCollapseDeep(node, 0) },
		hostPruneCompositions,
	}
	for _, pass := range passes {
		if hostModelledLength(t, value) <= hostProjectionBudgetBytes {
			break
		}
		value = pass(value)
	}
	return value
}
func hostModelledLength(t *testing.T, value any) int {
	t.Helper()
	encoded, err := json.Marshal(modelledHostSchema(value))
	if err != nil {
		t.Fatal(err)
	}
	return len(encoded)
}
func walkHostSchemaChildren(node map[string]any, includeDefinitions bool, transform func(any) any) {
	if properties, ok := node["properties"].(map[string]any); ok {
		for name, value := range properties {
			properties[name] = transform(value)
		}
	}
	for _, key := range []string{"items", "anyOf", "oneOf", "allOf"} {
		if value, present := node[key]; present {
			node[key] = transform(value)
		}
	}
	if value, present := node["additionalProperties"]; present {
		if _, isBool := value.(bool); !isBool {
			node["additionalProperties"] = transform(value)
		}
	}
	if !includeDefinitions {
		return
	}
	for _, key := range []string{"$defs", "definitions"} {
		if table, ok := node[key].(map[string]any); ok {
			for name, value := range table {
				table[name] = transform(value)
			}
		}
	}
}
func hostStripDescriptions(value any) any {
	switch typed := value.(type) {
	case []any:
		for index, item := range typed {
			typed[index] = hostStripDescriptions(item)
		}
		return typed
	case map[string]any:
		delete(typed, "description")
		walkHostSchemaChildren(typed, true, hostStripDescriptions)
		return typed
	default:
		return value
	}
}
func hostDropDefinitions(value any) any {
	blanked := hostBlankDefinitionRefs(value)
	node, ok := blanked.(map[string]any)
	if !ok {
		return blanked
	}
	delete(node, "$defs")
	delete(node, "definitions")
	return node
}
func hostBlankDefinitionRefs(value any) any {
	switch typed := value.(type) {
	case []any:
		for index, item := range typed {
			typed[index] = hostBlankDefinitionRefs(item)
		}
		return typed
	case map[string]any:
		if reference, ok := typed["$ref"].(string); ok && strings.HasPrefix(reference, "#/") {
			return map[string]any{}
		}
		walkHostSchemaChildren(typed, false, hostBlankDefinitionRefs)
		return typed
	default:
		return value
	}
}
func hostCollapseDeep(value any, depth int) any {
	switch typed := value.(type) {
	case []any:
		for index, item := range typed {
			typed[index] = hostCollapseDeep(item, depth)
		}
		return typed
	case map[string]any:
		if depth >= hostProjectionCollapse && hostComplexSchema(typed) {
			return map[string]any{}
		}
		walkHostSchemaChildren(typed, false, func(child any) any { return hostCollapseDeep(child, depth+1) })
		return typed
	default:
		return value
	}
}
func hostPruneCompositions(value any) any {
	switch typed := value.(type) {
	case []any:
		for index, item := range typed {
			typed[index] = hostPruneCompositions(item)
		}
		return typed
	case map[string]any:
		for _, keyword := range hostCompositionKeywords {
			if _, present := typed[keyword]; present {
				return map[string]any{}
			}
		}
		walkHostSchemaChildren(typed, false, hostPruneCompositions)
		return typed
	default:
		return value
	}
}
func hostComplexSchema(node map[string]any) bool {
	for _, key := range []string{"items", "anyOf", "oneOf", "allOf", "properties", "additionalProperties", "$ref"} {
		if _, present := node[key]; present {
			return true
		}
	}
	return false
}

func childSchema(t *testing.T, parent map[string]any, name string) map[string]any {
	t.Helper()
	properties, ok := parent["properties"].(map[string]any)
	if !ok {
		t.Fatalf("schema has no properties while reading %s", name)
	}
	child, ok := properties[name].(map[string]any)
	if !ok {
		t.Fatalf("schema member %s is not an object schema: %#v", name, properties[name])
	}
	return child
}

func stringSlice(value any) []string {
	items, _ := value.([]any)
	out := make([]string, 0, len(items))
	for _, item := range items {
		text, _ := item.(string)
		out = append(out, text)
	}
	return out
}

// assertHostProjectable walks a schema tree and fails on any node the Host
// projector cannot model as a concrete type.
func assertHostProjectable(t *testing.T, schema map[string]any, path string) {
	t.Helper()
	for _, keyword := range hostCompositionKeywords {
		if _, present := schema[keyword]; present {
			t.Fatalf("%s carries composition keyword %s", path, keyword)
		}
	}
	if _, present := schema["$ref"]; present {
		t.Fatalf("%s uses $ref, which the Host projector may not resolve", path)
	}
	types := stringSlice(schema["type"])
	if single, ok := schema["type"].(string); ok {
		types = []string{single}
	}
	if len(types) == 0 {
		t.Fatalf("%s declares no type", path)
	}
	object, array := false, false
	for _, name := range types {
		switch name {
		case "object":
			object = true
		case "array":
			array = true
		case "string", "integer", "number", "boolean", "null":
		default:
			t.Fatalf("%s declares unsupported type %s", path, name)
		}
	}
	if object {
		properties, ok := schema["properties"].(map[string]any)
		if !ok || len(properties) == 0 {
			t.Fatalf("%s is an object with no projectable properties", path)
		}
		if schema["additionalProperties"] != false {
			t.Fatalf("%s is an open object", path)
		}
		names := make([]string, 0, len(properties))
		for name := range properties {
			names = append(names, name)
		}
		sort.Strings(names)
		for _, name := range names {
			member, ok := properties[name].(map[string]any)
			if !ok {
				t.Fatalf("%s/%s is not an object schema", path, name)
			}
			assertHostProjectable(t, member, fmt.Sprintf("%s.%s", path, name))
		}
		for _, name := range stringSlice(schema["required"]) {
			if _, present := properties[name]; !present {
				t.Fatalf("%s requires %s without declaring it", path, name)
			}
		}
	}
	if array {
		item, ok := schema["items"].(map[string]any)
		if !ok {
			t.Fatalf("%s is an array with no projectable items", path)
		}
		assertHostProjectable(t, item, path+"[]")
	}
}

// TestSDKListedApplySchemaIsProjectable proves the published apply schema can be
// registered with the Go MCP SDK, served, listed, and still projected.
func TestSDKListedApplySchemaIsProjectable(t *testing.T) {
	service, err := application.NewService(annotationStore{}, annotationObserver{})
	if err != nil {
		t.Fatal(err)
	}
	server, err := NewServer(service, "test", nil)
	if err != nil {
		t.Fatal(err)
	}
	serverTransport, clientTransport := sdk.NewInMemoryTransports()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go server.Run(ctx, serverTransport)
	client := sdk.NewClient(&sdk.Implementation{Name: "projection-test", Version: "1"}, nil)
	session, err := client.Connect(ctx, clientTransport, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()
	listed, err := session.ListTools(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(listed.Tools) != 6 {
		t.Fatalf("tools=%d", len(listed.Tools))
	}
	for _, tool := range listed.Tools {
		if tool.Name != ToolApplyAction {
			continue
		}
		raw, err := json.Marshal(tool.InputSchema)
		if err != nil {
			t.Fatal(err)
		}
		var schema map[string]any
		if err := json.Unmarshal(raw, &schema); err != nil {
			t.Fatal(err)
		}
		if schema["type"] != "object" {
			t.Fatalf("listed apply schema root type=%#v", schema["type"])
		}
		assertHostProjectable(t, schema, "$")
		if size := modelledHostSchemaBytes(t, raw); size > hostProjectionBudgetBytes-hostProjectionMarginBytes {
			t.Fatalf("listed apply schema is %d bytes", size)
		}
		return
	}
	t.Fatal("the SDK did not list dev_flow_apply_action")
}
