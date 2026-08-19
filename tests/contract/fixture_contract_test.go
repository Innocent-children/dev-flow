package contract_test

import (
	"crypto/sha256"
	"encoding/hex"
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
