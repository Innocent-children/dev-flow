package mcp

import (
	"encoding/json"
	"testing"
)

func TestMCPContractGraphCatalogAndClosedSchemas(t *testing.T) {
	want := []string{ToolServerInfo, ToolOpenTask, ToolGetTask, ToolGetNextAction, ToolApplyAction, ToolCancelTask}
	got := ToolNames()
	if len(got) != 6 {
		t.Fatalf("tools=%d", len(got))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("tool %d=%s", i, got[i])
		}
	}
	for _, d := range ToolCatalog() {
		var schema map[string]any
		if err := json.Unmarshal(d.InputSchema, &schema); err != nil {
			t.Fatal(err)
		}
		if schema["additionalProperties"] != false {
			t.Fatalf("%s schema open", d.Name)
		}
	}
	if err := ValidateToolInput(ToolGetTask, []byte(`{"host":"codex","task_id":"task","extra":true}`)); err == nil {
		t.Fatal("unknown field accepted")
	}
}
