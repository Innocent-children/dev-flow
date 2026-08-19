package contract_test

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const sharedFixtureAggregateSHA256 = "8c27bcf6be0e4e5a4bf294c67cbda8cdf281b1b2b2c53fff16206db2828dede7"

func sha256Hex(raw []byte) string { sum := sha256.Sum256(raw); return hex.EncodeToString(sum[:]) }

func TestSharedProtocolFixtureInventoryByGeneration(t *testing.T) {
	root := markdownRepositoryRoot(t)
	readme, err := os.ReadFile(filepath.Join(root, "protocol", "fixtures", "README.md"))
	if err != nil {
		t.Fatal(err)
	}
	text := string(readme)
	for _, name := range []string{"graph-server-info.json", "graph-open-requirements.json", "graph-design-action.json", "graph-invalid-edge.json"} {
		if !strings.Contains(text, "`"+name+"`") {
			t.Errorf("missing inventory %s", name)
		}
		if _, err := os.Stat(filepath.Join(root, "protocol", "fixtures", name)); err != nil {
			t.Fatal(err)
		}
	}
	if strings.Contains(text, "`graph-*.json`") {
		t.Fatal("wildcard fixture inventory")
	}
}

func TestGraphServerInfoFixtureContainsCompletePublicDTO(t *testing.T) {
	path := filepath.Join(markdownRepositoryRoot(t), "protocol", "fixtures", "graph-server-info.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var value map[string]any
	if json.Unmarshal(raw, &value) != nil || len(value) != 10 {
		t.Fatalf("incomplete top-level fixture: %s", raw)
	}
	for _, key := range []string{"product", "version", "schema_version", "core_limits_version", "transport", "health", "supported_hosts", "supported_processes", "method_profiles", "tools"} {
		if _, ok := value[key]; !ok {
			t.Fatalf("missing %s", key)
		}
	}
	processes, ok := value["supported_processes"].([]any)
	if !ok || len(processes) != 1 {
		t.Fatal("supported_processes is incomplete")
	}
	process, ok := processes[0].(map[string]any)
	if !ok || len(process) != 4 || process["definition_digest"] == nil || process["new_task_supported"] != true || process["process_definition_digest"] != nil {
		t.Fatalf("public process DTO=%#v", process)
	}
	tools, ok := value["tools"].([]any)
	if !ok || len(tools) != 6 {
		t.Fatalf("tools=%#v", tools)
	}
	previous := -1
	for _, key := range []string{`"product"`, `"version"`, `"schema_version"`, `"core_limits_version"`, `"transport"`, `"health"`, `"supported_hosts"`, `"supported_processes"`, `"method_profiles"`, `"tools"`} {
		index := strings.Index(string(raw), key)
		if index <= previous {
			t.Fatalf("field order drift at %s", key)
		}
		previous = index
	}
}
