package contract_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/Innocent-children/dev-flow/internal/domain"
	core "github.com/Innocent-children/dev-flow/internal/mcp"
	"slices"
	"strings"
	"testing"
)

func TestMCPToolCatalogIsExactStableAndConservative(t *testing.T) {
	want := []string{core.ToolServerInfo, core.ToolOpenTask, core.ToolGetTask, core.ToolGetNextAction,
		core.ToolSubmitRequirements, core.ToolSubmitDesign, core.ToolSubmitTasks, core.ToolSubmitImplementation,
		core.ToolSubmitTest, core.ToolSubmitComprehension, core.ToolSubmitRefactor, core.ToolSubmitDelivery,
		core.ToolResolveBlocker, core.ToolRecoverAction, core.ToolCancelTask}
	if !slices.Equal(core.ToolNames(), want) {
		t.Fatal(core.ToolNames())
	}
	for _, tool := range core.ToolCatalog() {
		read := tool.Name == core.ToolServerInfo || tool.Name == core.ToolGetTask || tool.Name == core.ToolGetNextAction
		idempotent := read || tool.Name == core.ToolRecoverAction || tool.Name == core.ToolResolveBlocker || strings.HasPrefix(tool.Name, "dev_flow_submit_")
		if tool.Annotations.ReadOnly != read || tool.Annotations.Idempotent != idempotent || tool.Annotations.Destructive != (tool.Name == core.ToolCancelTask) || tool.Annotations.OpenWorld {
			t.Fatalf("annotations %s %#v", tool.Name, tool.Annotations)
		}
		var schema any
		if json.Unmarshal(tool.InputSchema, &schema) != nil {
			t.Fatal("invalid schema")
		}
		assertClosed(t, schema, "$")
	}
}
func assertClosed(t *testing.T, value any, path string) {
	t.Helper()
	switch v := value.(type) {
	case map[string]any:
		_, discriminated := v["oneOf"]
		if isObjectSchema(v) && v["additionalProperties"] != false && !discriminated {
			t.Fatalf("open object %s", path)
		}
		for k, x := range v {
			assertClosed(t, x, path+"/"+k)
		}
	case []any:
		for i, x := range v {
			assertClosed(t, x, fmt.Sprintf("%s/%d", path, i))
		}
	}
}
func TestMCPCurrentContractRequiredShapes(t *testing.T) {
	schemas := map[string]map[string]any{}
	for _, tool := range core.ToolCatalog() {
		var v map[string]any
		_ = json.Unmarshal(tool.InputSchema, &v)
		schemas[tool.Name] = v
	}
	requireNames := func(tool string, names []string) {
		required := stringsOf(schemas[tool]["required"])
		if !slices.Equal(required, names) {
			t.Fatalf("%s required=%v", tool, required)
		}
	}
	requireNames(core.ToolOpenTask, []string{"host", "repository_path"})
	requireNames(core.ToolGetTask, []string{"host", "task_id"})
	requireNames(core.ToolGetNextAction, []string{"host", "task_id"})
	for _, tool := range []string{core.ToolSubmitRequirements, core.ToolSubmitDesign, core.ToolSubmitTasks, core.ToolSubmitImplementation, core.ToolSubmitTest, core.ToolSubmitComprehension, core.ToolSubmitRefactor, core.ToolSubmitDelivery} {
		requireNames(tool, []string{"host", "task_id", "action_id", "transition_id", "summary", "reason", "artifacts", "method_results", "node_result"})
	}
	requireNames(core.ToolResolveBlocker, []string{"host", "task_id", "action_id"})
	requireNames(core.ToolRecoverAction, []string{"host", "task_id", "action_id"})
	requireNames(core.ToolCancelTask, []string{"request_id", "host", "task_id", "revision", "reason"})
	openProperties := schemas[core.ToolOpenTask]["properties"].(map[string]any)
	additional := openProperties["additional_repositories"].(map[string]any)
	if additional["maxItems"] != float64(domain.MaxAdditionalRepositories) || additional["items"].(map[string]any)["additionalProperties"] != false {
		t.Fatalf("additional_repositories schema=%#v", additional)
	}
	if openProperties["primary_repository_key"].(map[string]any)["pattern"] != "^[a-z0-9][a-z0-9._-]{0,127}$" {
		t.Fatal("primary_repository_key pattern changed")
	}
	for _, tool := range core.ToolNames() {
		if tool == core.ToolOpenTask {
			continue
		}
		properties, _ := schemas[tool]["properties"].(map[string]any)
		if _, exists := properties["primary_repository_key"]; exists {
			t.Fatalf("%s input gained repository scope", tool)
		}
		if _, exists := properties["additional_repositories"]; exists {
			t.Fatalf("%s input gained additional repositories", tool)
		}
	}
}

// isObjectSchema recognizes both `"type":"object"` and the nullable union form
// `"type":["object","null"]` the apply projection uses for optional objects.
func isObjectSchema(schema map[string]any) bool {
	if schema["type"] == "object" {
		return true
	}
	for _, name := range stringsOf(schema["type"]) {
		if name == "object" {
			return true
		}
	}
	return false
}
func stringsOf(v any) []string {
	items, _ := v.([]any)
	out := make([]string, len(items))
	for i, x := range items {
		out[i], _ = x.(string)
	}
	return out
}
func TestMCPStrictInputBoundaryAndDuplicateMembers(t *testing.T) {
	valid := []byte(`{"host":"codex","task_id":"task","operation_probe":null}`)
	if err := core.ValidateToolInput(core.ToolGetTask, valid); err != nil {
		t.Fatal(err)
	}
	for _, raw := range [][]byte{[]byte(`{"host":"codex","task_id":"a","task_id":"b","operation_probe":null}`), []byte(`{"host":"codex","repository_path":"/repo","new_task":{"request":"x","initial_scope":[],"initial_out_of_scope":[],"known_acceptance_criteria":[],"verification_budget":{"level":"targeted","max_automatic_commands":1,"allow_full_suite":false,"allow_manual_handoff":false},"method_profile":"plain","method_profile":"spec-kit"}}`)} {
		if err := core.ValidateToolInput(core.ToolGetTask, raw); err == nil {
			t.Fatal("duplicate accepted")
		}
	}
}

func TestMCPOpenTaskSingleAndMultiRepositoryInputBoundary(t *testing.T) {
	newTask := `"new_task":{"request":"Build feature","initial_scope":[],"initial_out_of_scope":[],"known_acceptance_criteria":[],"verification_budget":{"level":"targeted","max_automatic_commands":1,"allow_full_suite":false,"allow_manual_handoff":false},"method_profile":"plain"}`
	for _, raw := range []string{
		`{"host":"codex","repository_path":"/repo"}`,
		`{"host":"codex","repository_path":"/core","primary_repository_key":"core","additional_repositories":[{"key":"docs","repository_path":"/docs"}],` + newTask + `}`,
	} {
		if err := core.ValidateToolInput(core.ToolOpenTask, []byte(raw)); err != nil {
			t.Fatalf("valid open input rejected: %v %s", err, raw)
		}
	}
	additional := make([]map[string]string, domain.MaxAdditionalRepositories+1)
	for i := range additional {
		additional[i] = map[string]string{"key": fmt.Sprintf("repo%d", i), "repository_path": fmt.Sprintf("/repo%d", i)}
	}
	tooMany, err := json.Marshal(map[string]any{"host": "codex", "repository_path": "/core", "additional_repositories": additional, "new_task": map[string]any{"request": "Build feature", "initial_scope": []string{}, "initial_out_of_scope": []string{}, "known_acceptance_criteria": []string{}, "verification_budget": map[string]any{"level": "targeted", "max_automatic_commands": 1, "allow_full_suite": false, "allow_manual_handoff": false}, "method_profile": "plain"}})
	if err != nil {
		t.Fatal(err)
	}
	for _, raw := range [][]byte{
		[]byte(`{"host":"codex","repository_path":"/core","additional_repositories":[{"key":"docs","repository_path":"/docs","unknown":true}],` + newTask + `}`),
		tooMany,
	} {
		if err := core.ValidateToolInput(core.ToolOpenTask, raw); err != domain.ErrInvalidArgument {
			t.Fatalf("invalid multi repository input error=%v raw=%s", err, raw)
		}
	}
}
func TestMCPStableErrorEnvelopesAreClosedAndRedacted(t *testing.T) {
	secret := "/Users/private/secret.db SELECT * FROM tasks"
	encoded := core.EncodeError("request-error", core.ToolGetTask, fmt.Errorf("%s", secret))
	if bytes.Contains(encoded.JSON, []byte(secret)) || !bytes.Contains(encoded.JSON, []byte(`"code":"INTERNAL_ERROR"`)) {
		t.Fatal(string(encoded.JSON))
	}
	_ = domain.ErrorInternal
}

func TestSchemaUnsupportedResultIsBoundedAndPathFree(t *testing.T) {
	encoded := core.EncodeError("schema-unsupported", core.ToolOpenTask, domain.ErrSchemaUnsupported)
	text := string(encoded.JSON)
	for _, forbidden := range []string{"/Users/", "/home/", "HOME=", "dev-flow.db", "SELECT ", "sqlite", "repository_path", "data_path"} {
		if strings.Contains(strings.ToLower(text), strings.ToLower(forbidden)) {
			t.Fatalf("SCHEMA_UNSUPPORTED leaked private/storage detail %q: %s", forbidden, text)
		}
	}
	for _, required := range []string{`"code":"SCHEMA_UNSUPPORTED"`, "storage schema is unsupported", "Stop this operation"} {
		if !strings.Contains(text, required) {
			t.Fatalf("SCHEMA_UNSUPPORTED guidance missing %q: %s", required, text)
		}
	}
}
