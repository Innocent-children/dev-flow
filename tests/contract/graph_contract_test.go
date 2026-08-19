package contract_test

import (
	"encoding/json"
	coremcp "github.com/Innocent-children/dev-flow/internal/mcp"
	"os"
	"path/filepath"
	"testing"
)

func TestGraphContractCatalogAndFixtures(t *testing.T) {
	if len(coremcp.ToolNames()) != 6 {
		t.Fatal("tool catalog changed")
	}
	root := markdownRepositoryRoot(t)
	for _, name := range []string{"graph-server-info.json", "graph-open-requirements.json", "graph-design-action.json", "graph-invalid-edge.json"} {
		raw, err := os.ReadFile(filepath.Join(root, "protocol", "fixtures", name))
		if err != nil {
			t.Fatal(err)
		}
		var value map[string]any
		if json.Unmarshal(raw, &value) != nil {
			t.Fatalf("invalid %s", name)
		}
	}
}
func TestFixtureContractGraphInputsAreClosed(t *testing.T) {
	if err := coremcp.ValidateToolInput(coremcp.ToolGetTask, []byte(`{"host":"codex","task_id":"task","operation_probe":null}`)); err != nil {
		t.Fatal(err)
	}
	if err := coremcp.ValidateToolInput(coremcp.ToolGetTask, []byte(`{"host":"codex","task_id":"task","operation_probe":null,"destination":"DONE"}`)); err == nil {
		t.Fatal("caller destination accepted")
	}
}
