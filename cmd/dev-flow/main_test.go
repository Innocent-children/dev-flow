package main

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/application"
	coremcp "github.com/Innocent-children/dev-flow/internal/mcp"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/userconfig"
	"github.com/Innocent-children/dev-flow/internal/version"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
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
		t.Run(tt.name, func(t *testing.T) {
			var stdout bytes.Buffer
			var stderr bytes.Buffer
			if exitCode := run(tt.args, bytes.NewReader(nil), &stdout, &stderr, emptyEnvironment, unexpectedServe(t)); exitCode != 0 {
				t.Fatalf("run(%q) exit code = %d; stderr = %q", tt.args, exitCode, stderr.String())
			}
			if stderr.Len() != 0 {
				t.Fatalf("run(%q) stderr = %q", tt.args, stderr.String())
			}
			assertContainsAll(t, stdout.String(), "governed Core", "local STDIO MCP", "dev-flow mcp --stdio", dataDirectoryEnvironment)
			for _, stale := range []string{"Core Contract 0.2", "Feature 001", "placeholder", "MCP functionality", "installed", "published"} {
				if strings.Contains(stdout.String(), stale) {
					t.Errorf("help contains stale or unsupported claim %q", stale)
				}
			}
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
	if exitCode := run([]string{"version"}, bytes.NewReader(nil), &stdout, &stderr, emptyEnvironment, unexpectedServe(t)); exitCode != 0 {
		t.Fatalf("run(version) exit code = %d; stderr = %q", exitCode, stderr.String())
	}
	if stderr.Len() != 0 || stdout.String() != "dev-flow "+wantVersion+"\n" {
		t.Fatalf("version stdout/stderr = %q/%q", stdout.String(), stderr.String())
	}
}

func TestRunMCPStdioStartsAndStopsCleanlyOnEOF(t *testing.T) {
	const instructions = "test host-specific MCP presentation"
	dataDirectory := t.TempDir()
	homeDirectory := t.TempDir()
	configDirectory := filepath.Join(homeDirectory, ".dev-flow")
	if err := os.Mkdir(configDirectory, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(configDirectory, "config.json"), []byte(`{"codex":{"codebase_memory":false},"deepseek":{"codebase_memory":true}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	stdin := bytes.NewReader(nil)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	serveCalls := 0
	serve := func(ctx context.Context, service *application.Service, currentVersion string, diagnostics *coremcp.Diagnostics, actualInstructions string, preferences userconfig.Preferences) error {
		serveCalls++
		if service == nil || currentVersion == "" || diagnostics == nil {
			t.Fatal("MCP serve dependencies are incomplete")
		}
		if actualInstructions != instructions {
			t.Fatalf("MCP instructions = %q, want %q", actualInstructions, instructions)
		}
		if preferences.Codex.CodebaseMemory || !preferences.DeepSeek.CodebaseMemory {
			t.Fatalf("MCP preferences = %#v", preferences)
		}
		server, err := coremcp.NewServer(service, currentVersion, &coremcp.ServerOptions{
			Diagnostics:     diagnostics,
			Instructions:    actualInstructions,
			HostPreferences: preferences,
		})
		if err != nil {
			t.Fatalf("construct MCP server: %v", err)
		}
		transport := &sdkmcp.IOTransport{
			Reader: io.NopCloser(stdin),
			Writer: nopWriteCloser{Writer: &stdout},
		}
		return server.Run(ctx, transport)
	}
	getenv := func(name string) string {
		if name == dataDirectoryEnvironment {
			return dataDirectory
		}
		if name == mcpInstructionsEnvironment {
			return instructions
		}
		if name == "HOME" {
			return homeDirectory
		}
		return ""
	}

	if exitCode := run([]string{"mcp", "--stdio"}, stdin, &stdout, &stderr, getenv, serve); exitCode != 0 {
		t.Fatalf("run(mcp --stdio) exit code = %d; stdout = %q stderr = %q", exitCode, stdout.String(), stderr.String())
	}
	if serveCalls != 1 || stdout.Len() != 0 || stderr.Len() != 0 {
		t.Fatalf("MCP EOF lifecycle calls/stdout/stderr = %d/%q/%q", serveCalls, stdout.String(), stderr.String())
	}
	databasePath := filepath.Join(dataDirectory, databaseFileName)
	if _, err := os.Stat(databasePath); err != nil {
		t.Fatalf("fixed database file was not created: %v", err)
	}
	reopened, err := store.Open(context.Background(), databasePath)
	if err != nil {
		t.Fatalf("closed CLI database could not be reopened: %v", err)
	}
	if err := reopened.Close(); err != nil {
		t.Fatalf("close reopened database: %v", err)
	}
}

func TestRunMCPRejectsMissingOrInvalidDataDirectory(t *testing.T) {
	t.Parallel()

	filePath := filepath.Join(t.TempDir(), "not-a-directory")
	if err := os.WriteFile(filePath, []byte("file"), 0o600); err != nil {
		t.Fatalf("create non-directory fixture: %v", err)
	}
	tests := []struct {
		name  string
		value string
	}{
		{name: "missing"},
		{name: "nonexistent", value: filepath.Join(t.TempDir(), "missing")},
		{name: "file", value: filePath},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var stdout bytes.Buffer
			var stderr bytes.Buffer
			getenv := func(name string) string {
				if name == dataDirectoryEnvironment {
					return tt.value
				}
				return ""
			}
			if exitCode := run([]string{"mcp", "--stdio"}, bytes.NewReader(nil), &stdout, &stderr, getenv, unexpectedServe(t)); exitCode == 0 {
				t.Fatal("invalid data directory returned success")
			}
			if stdout.Len() != 0 || !strings.Contains(stderr.String(), dataDirectoryEnvironment) ||
				(tt.value != "" && strings.Contains(stderr.String(), tt.value)) {
				t.Fatalf("invalid data directory stdout/stderr = %q/%q", stdout.String(), stderr.String())
			}
		})
	}
}

func TestRunMCPRedactsDatabaseStartupFailure(t *testing.T) {
	t.Parallel()

	dataDirectory := t.TempDir()
	homeDirectory := t.TempDir()
	privateDatabasePath := filepath.Join(dataDirectory, databaseFileName)
	if err := os.Mkdir(privateDatabasePath, 0o700); err != nil {
		t.Fatalf("create invalid database path: %v", err)
	}
	getenv := func(name string) string {
		if name == dataDirectoryEnvironment {
			return dataDirectory
		}
		if name == "HOME" {
			return homeDirectory
		}
		return ""
	}
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	if exitCode := run([]string{"mcp", "--stdio"}, bytes.NewReader(nil), &stdout, &stderr, getenv, unexpectedServe(t)); exitCode == 0 {
		t.Fatal("database startup failure returned success")
	}
	if stdout.Len() != 0 || !strings.Contains(stderr.String(), "storage startup failed") ||
		strings.Contains(stderr.String(), dataDirectory) || strings.Contains(stderr.String(), databaseFileName) {
		t.Fatalf("database failure stdout/stderr = %q/%q", stdout.String(), stderr.String())
	}
}

func TestRunMCPRejectsInvalidConfigurationBeforeStorageAndServe(t *testing.T) {
	dataDirectory := t.TempDir()
	homeDirectory := t.TempDir()
	configDirectory := filepath.Join(homeDirectory, ".dev-flow")
	if err := os.Mkdir(configDirectory, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(configDirectory, "config.json"), []byte(`{"codex":{"unknown":true}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	getenv := func(name string) string {
		switch name {
		case dataDirectoryEnvironment:
			return dataDirectory
		case "HOME":
			return homeDirectory
		default:
			return ""
		}
	}
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	if exitCode := run([]string{"mcp", "--stdio"}, bytes.NewReader(nil), &stdout, &stderr, getenv, unexpectedServe(t)); exitCode == 0 {
		t.Fatal("invalid configuration returned success")
	}
	if stdout.Len() != 0 || !strings.Contains(stderr.String(), "codex.unknown") || !strings.Contains(stderr.String(), "config.json") {
		t.Fatalf("invalid configuration stdout/stderr = %q/%q", stdout.String(), stderr.String())
	}
	if _, err := os.Stat(filepath.Join(dataDirectory, databaseFileName)); !os.IsNotExist(err) {
		t.Fatalf("storage was opened before configuration rejection: %v", err)
	}
}

func TestRunRejectsEveryOtherCommandAndNetworkMode(t *testing.T) {
	t.Parallel()

	tests := [][]string{
		{"unknown"},
		{"server"},
		{"task"},
		{"mcp"},
		{"mcp", "--http"},
		{"mcp", "--stdio", "extra"},
		{"version", "extra"},
		{"help", "extra"},
	}
	for _, args := range tests {
		var stdout bytes.Buffer
		var stderr bytes.Buffer
		if exitCode := run(args, bytes.NewReader(nil), &stdout, &stderr, emptyEnvironment, unexpectedServe(t)); exitCode == 0 {
			t.Fatalf("run(%q) returned success", args)
		}
		if stdout.Len() != 0 || stderr.String() != "dev-flow: invalid arguments; use \"dev-flow help\"\n" {
			t.Fatalf("run(%q) stdout/stderr = %q/%q", args, stdout.String(), stderr.String())
		}
	}
}

type nopWriteCloser struct {
	io.Writer
}

func (nopWriteCloser) Close() error { return nil }

func emptyEnvironment(string) string { return "" }

func unexpectedServe(t *testing.T) mcpServeFunc {
	t.Helper()
	return func(context.Context, *application.Service, string, *coremcp.Diagnostics, string, userconfig.Preferences) error {
		t.Fatal("unexpected MCP server invocation")
		return nil
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
