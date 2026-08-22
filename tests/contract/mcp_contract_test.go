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
	want := []string{core.ToolServerInfo, core.ToolOpenTask, core.ToolGetTask, core.ToolGetNextAction, core.ToolApplyAction, core.ToolCancelTask}
	if !slices.Equal(core.ToolNames(), want) {
		t.Fatal(core.ToolNames())
	}
	for _, tool := range core.ToolCatalog() {
		read := tool.Name == core.ToolServerInfo || tool.Name == core.ToolGetTask || tool.Name == core.ToolGetNextAction
		if tool.Annotations.ReadOnly != read || tool.Annotations.Idempotent != read || tool.Annotations.Destructive != (tool.Name == core.ToolCancelTask) || tool.Annotations.OpenWorld {
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
		if v["type"] == "object" && v["additionalProperties"] != false {
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
	requireNames(core.ToolApplyAction, []string{"request_id", "host", "task_id", "revision", "action_id", "action_kind", "process_id", "process_definition_digest", "source_cursor", "repository_binding_digest", "payload"})
	requireNames(core.ToolCancelTask, []string{"request_id", "host", "task_id", "revision", "reason"})
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
func TestMCPStableErrorEnvelopesAreClosedAndRedacted(t *testing.T) {
	secret := "/Users/private/secret.db SELECT * FROM tasks"
	encoded := core.EncodeError("request-error", core.ToolGetTask, fmt.Errorf("%s", secret))
	if bytes.Contains(encoded.JSON, []byte(secret)) || !bytes.Contains(encoded.JSON, []byte(`"code":"INTERNAL_ERROR"`)) {
		t.Fatal(string(encoded.JSON))
	}
	_ = domain.ErrorInternal
}

func TestSchemaUnsupportedGuidanceIsBoundedAndPathFree(t *testing.T) {
	encoded := core.EncodeError("schema-unsupported", core.ToolOpenTask, domain.ErrSchemaUnsupported)
	text := string(encoded.JSON)
	for _, forbidden := range []string{"/Users/", "/home/", "HOME=", "dev-flow.db", "SELECT ", "sqlite", "repository_path", "data_path"} {
		if strings.Contains(strings.ToLower(text), strings.ToLower(forbidden)) {
			t.Fatalf("SCHEMA_UNSUPPORTED leaked private/storage detail %q: %s", forbidden, text)
		}
	}
	for _, required := range []string{`"code":"SCHEMA_UNSUPPORTED"`, "fresh data directory", "outside Core"} {
		if !strings.Contains(text, required) {
			t.Fatalf("SCHEMA_UNSUPPORTED guidance missing %q: %s", required, text)
		}
	}
}
