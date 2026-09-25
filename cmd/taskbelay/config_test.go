package main

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/Innocent-children/taskbelay/internal/userconfig"
)

func TestConfigValidationUsesCoreRulesWithoutRuntimeState(t *testing.T) {
	for _, tc := range []struct {
		name, input, expected string
		code                  int
	}{
		{"defaults", `{}`, `{"ok":true,"result":{"codex":{"codebase_memory":false},"deepseek":{"codebase_memory":false},"claude":{"codebase_memory":false},"zcode":{"codebase_memory":false}}}`, 0},
		{"all hosts", `{"claude":{"codebase_memory":true},"codex":{},"deepseek":{"codebase_memory":true}}`, `{"ok":true,"result":{"codex":{"codebase_memory":false},"deepseek":{"codebase_memory":true},"claude":{"codebase_memory":true},"zcode":{"codebase_memory":false}}}`, 0},
		{"duplicate host", `{"claude":{},"claude":{}}`, configErrorJSON(`duplicate field "claude"`), 1},
		{"ZCode enabled", `{"zcode":{"codebase_memory":true}}`, `{"ok":true,"result":{"codex":{"codebase_memory":false},"deepseek":{"codebase_memory":false},"claude":{"codebase_memory":false},"zcode":{"codebase_memory":true}}}`, 0},
		{"invalid ZCode preference", `{"zcode":{"codebase_memory":null}}`, configErrorJSON(`field "zcode.codebase_memory" must be a boolean`), 1},
		{"unknown host", `{"other":{}}`, configErrorJSON(`unknown top-level field "other"`), 1},
		{"invalid preference", `{"claude":{"codebase_memory":null}}`, configErrorJSON(`field "claude.codebase_memory" must be a boolean`), 1},
		{"invalid UTF8", "\xff", configErrorJSON("invalid UTF-8"), 1},
		{"limit", strings.Repeat(" ", userconfig.MaxConfigBytes+1), configErrorJSON("exceeds 16 KiB"), 1},
		{"trailing JSON", `{} {}`, configErrorJSON("trailing JSON"), 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var stdout, stderr bytes.Buffer
			code := run([]string{"config", "validate"}, strings.NewReader(tc.input), &stdout, &stderr, func(string) string {
				t.Fatal("configuration validation must not inspect runtime environment")
				return ""
			}, nil)
			if code != tc.code || stdout.String() != tc.expected+"\n" || stderr.Len() != 0 {
				t.Fatalf("code=%d stdout=%q stderr=%q", code, stdout.String(), stderr.String())
			}
		})
	}
}

func TestConfigValidationHelpAndArguments(t *testing.T) {
	var stdout, stderr bytes.Buffer
	if code := run([]string{"config", "validate", "--help"}, nil, &stdout, &stderr, nil, nil); code != 0 || stdout.String() != configValidationHelp {
		t.Fatalf("help code=%d output=%q", code, stdout.String())
	}
	stdout.Reset()
	if code := run([]string{"config", "validate", "--json"}, nil, &stdout, &stderr, nil, nil); code != 2 || stdout.Len() != 0 {
		t.Fatalf("invalid arguments code=%d output=%q", code, stdout.String())
	}
}

func configErrorJSON(message string) string {
	raw, _ := json.Marshal(message)
	return `{"ok":false,"error":{"code":"INVALID_CONFIGURATION","message":` + string(raw) + `}}`
}
