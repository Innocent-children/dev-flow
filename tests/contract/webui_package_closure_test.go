package contract_test

import (
	"encoding/json"
	"io/fs"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/webui"
)

func TestEmbeddedWebUIAssetClosure(t *testing.T) {
	generated, err := fs.Sub(webui.Assets, "assets/generated")
	if err != nil {
		t.Fatal(err)
	}
	index, err := fs.ReadFile(generated, "index.html")
	if err != nil {
		t.Fatal(err)
	}
	manifestBytes, err := fs.ReadFile(generated, "manifest.json")
	if err != nil {
		t.Fatal(err)
	}
	var manifest map[string]struct {
		File   string   `json:"file"`
		CSS    []string `json:"css"`
		Assets []string `json:"assets"`
	}
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		t.Fatal(err)
	}
	entry, ok := manifest["index.html"]
	if !ok || filepath.Ext(entry.File) != ".js" || len(entry.CSS) != 1 || filepath.Ext(entry.CSS[0]) != ".css" || len(entry.Assets) != 1 || filepath.Ext(entry.Assets[0]) != ".svg" {
		t.Fatalf("embedded manifest entry = %#v", entry)
	}
	for _, path := range []string{entry.File, entry.CSS[0], entry.Assets[0]} {
		content, err := fs.ReadFile(generated, path)
		if err != nil || len(content) == 0 {
			t.Fatalf("embedded asset %q is unavailable: %v", path, err)
		}
	}
	if !strings.Contains(string(index), "/"+entry.File) || !strings.Contains(string(index), "/"+entry.CSS[0]) {
		t.Fatalf("embedded index does not select manifest JS/CSS")
	}
}
