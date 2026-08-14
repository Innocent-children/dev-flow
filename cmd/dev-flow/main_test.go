package main

import (
	"bytes"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/version"
)

func TestRunHelp(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		args []string
	}{
		{name: "no arguments"},
		{name: "help command", args: []string{"help"}},
		{name: "short flag", args: []string{"-h"}},
		{name: "long flag", args: []string{"--help"}},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var stdout bytes.Buffer
			var stderr bytes.Buffer

			if exitCode := run(tt.args, &stdout, &stderr); exitCode != 0 {
				t.Fatalf("run(%q) exit code = %d, want 0; stderr = %q", tt.args, exitCode, stderr.String())
			}
			if stderr.Len() != 0 {
				t.Fatalf("run(%q) stderr = %q, want empty", tt.args, stderr.String())
			}

			assertContainsAll(t, stdout.String(), "Usage:", "Feature 001", "task", "MCP", "not implemented")
		})
	}
}

func TestRunVersionUsesCurrentRepositoryVersion(t *testing.T) {
	t.Parallel()

	wantVersion, err := version.Current()
	if err != nil {
		t.Fatalf("read current repository version: %v", err)
	}

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	if exitCode := run([]string{"version"}, &stdout, &stderr); exitCode != 0 {
		t.Fatalf("run(version) exit code = %d, want 0; stderr = %q", exitCode, stderr.String())
	}
	if stderr.Len() != 0 {
		t.Fatalf("run(version) stderr = %q, want empty", stderr.String())
	}

	assertContainsAll(t, stdout.String(), wantVersion, "Feature 001", "task", "MCP", "not implemented")
}

func TestRunRejectsUnimplementedCommands(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		args []string
	}{
		{name: "unknown", args: []string{"unknown"}},
		{name: "task", args: []string{"task"}},
		{name: "mcp", args: []string{"mcp"}},
		{name: "version arguments", args: []string{"version", "extra"}},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var stdout bytes.Buffer
			var stderr bytes.Buffer

			if exitCode := run(tt.args, &stdout, &stderr); exitCode == 0 {
				t.Fatalf("run(%q) exit code = 0, want non-zero", tt.args)
			}
			if stdout.Len() != 0 {
				t.Fatalf("run(%q) stdout = %q, want empty", tt.args, stdout.String())
			}

			assertContainsAll(t, stderr.String(), strings.Join(tt.args, " "), "Feature 001", "not implemented", "help", "version")
		})
	}
}

func assertContainsAll(t *testing.T, output string, fragments ...string) {
	t.Helper()

	for _, fragment := range fragments {
		if !strings.Contains(output, fragment) {
			t.Errorf("output %q does not contain %q", output, fragment)
		}
	}
}
