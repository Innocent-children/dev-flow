package userconfig

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadMissingAndValidConfiguration(t *testing.T) {
	t.Run("missing directory", func(t *testing.T) {
		home := t.TempDir()
		preferences, err := Load(home)
		if err != nil || preferences != (Preferences{}) {
			t.Fatalf("missing directory preferences/error = %#v/%v", preferences, err)
		}
		if _, err := os.Stat(filepath.Join(home, ".dev-flow")); !os.IsNotExist(err) {
			t.Fatalf("configuration directory was created: %v", err)
		}
	})

	t.Run("missing file", func(t *testing.T) {
		home := t.TempDir()
		if err := os.Mkdir(filepath.Join(home, ".dev-flow"), 0o700); err != nil {
			t.Fatal(err)
		}
		preferences, err := Load(home)
		if err != nil || preferences != (Preferences{}) {
			t.Fatalf("missing file preferences/error = %#v/%v", preferences, err)
		}
		if _, err := os.Stat(filepath.Join(home, ".dev-flow", "config.json")); !os.IsNotExist(err) {
			t.Fatalf("configuration file was created: %v", err)
		}
	})

	t.Run("split preferences", func(t *testing.T) {
		home := writeConfig(t, `{"codex":{"codebase_memory":false},"deepseek":{"codebase_memory":true}}`)
		preferences, err := Load(home)
		if err != nil {
			t.Fatalf("load valid configuration: %v", err)
		}
		if preferences.Codex.CodebaseMemory || !preferences.DeepSeek.CodebaseMemory {
			t.Fatalf("preferences = %#v", preferences)
		}
	})
}

func TestLoadRejectsClosedInvalidConfiguration(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		fragment string
	}{
		{name: "invalid JSON", content: `{`, fragment: "invalid JSON"},
		{name: "duplicate host", content: `{"codex":{},"codex":{}}`, fragment: "duplicate field"},
		{name: "duplicate preference", content: `{"codex":{"codebase_memory":false,"codebase_memory":true}}`, fragment: "duplicate field"},
		{name: "unknown host", content: `{"other":{}}`, fragment: "unknown top-level field"},
		{name: "unknown host field", content: `{"codex":{"future":true}}`, fragment: "codex.future"},
		{name: "null host", content: `{"codex":null}`, fragment: "must be an object"},
		{name: "null preference", content: `{"codex":{"codebase_memory":null}}`, fragment: "must be a boolean"},
		{name: "string preference", content: `{"codex":{"codebase_memory":"true"}}`, fragment: "must be a boolean"},
		{name: "trailing JSON", content: `{} {}`, fragment: "trailing JSON"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			home := writeConfig(t, test.content)
			_, err := Load(home)
			if err == nil || !strings.Contains(err.Error(), test.fragment) || !strings.Contains(err.Error(), "config.json") {
				t.Fatalf("error = %v, want location and %q", err, test.fragment)
			}
		})
	}

	t.Run("unreadable path", func(t *testing.T) {
		home := t.TempDir()
		path := filepath.Join(home, ".dev-flow", "config.json")
		if err := os.MkdirAll(path, 0o700); err != nil {
			t.Fatal(err)
		}
		_, err := Load(home)
		if err == nil || !strings.Contains(err.Error(), "read failed") || !strings.Contains(err.Error(), "config.json") {
			t.Fatalf("error = %v", err)
		}
	})

	t.Run("over 16 KiB", func(t *testing.T) {
		home := writeConfig(t, strings.Repeat(" ", MaxConfigBytes+1))
		_, err := Load(home)
		if err == nil || !strings.Contains(err.Error(), "16 KiB") || !strings.Contains(err.Error(), "config.json") {
			t.Fatalf("error = %v", err)
		}
	})
}

func writeConfig(t *testing.T, content string) string {
	t.Helper()
	home := t.TempDir()
	directory := filepath.Join(home, ".dev-flow")
	if err := os.Mkdir(directory, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, "config.json"), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return home
}
