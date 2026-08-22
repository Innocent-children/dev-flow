package contract_test

import (
	"os"
	"path/filepath"
	"testing"
)

func contractRepositoryRoot(t *testing.T) string {
	t.Helper()

	current, err := os.Getwd()
	if err != nil {
		t.Fatalf("get working directory: %v", err)
	}
	for {
		if _, statErr := os.Stat(filepath.Join(current, "go.mod")); statErr == nil {
			return current
		}
		parent := filepath.Dir(current)
		if parent == current {
			t.Fatal("repository root containing go.mod not found")
		}
		current = parent
	}
}
