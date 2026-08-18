package mcp

import (
	"errors"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestOpenTaskObservedMalformedContractsAreRejected(t *testing.T) {
	t.Parallel()

	valid := `{"host":"codex","repository_path":"/workspace/example","new_task":{"goal":"goal","scope":["scope"],"out_of_scope":["excluded"],"acceptance_criteria":["criterion"],"verification_budget":{"level":"targeted","max_automatic_commands":4,"allow_full_suite":false,"allow_manual_handoff":true}}}`
	tests := []struct {
		name string
		raw  string
	}{
		{
			name: "unsupported focused verification level",
			raw:  strings.Replace(valid, `"level":"targeted"`, `"level":"focused"`, 1),
		},
		{
			name: "scope collapsed into prose",
			raw:  strings.Replace(valid, `"scope":["scope"]`, `"scope":"scope"`, 1),
		},
		{
			name: "out of scope collapsed into prose",
			raw:  strings.Replace(valid, `"out_of_scope":["excluded"]`, `"out_of_scope":"excluded"`, 1),
		},
		{
			name: "acceptance criteria collapsed into prose",
			raw:  strings.Replace(valid, `"acceptance_criteria":["criterion"]`, `"acceptance_criteria":"criterion"`, 1),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := ValidateToolInput(ToolOpenTask, []byte(tt.raw)); !errors.Is(err, domain.ErrInvalidArgument) {
				t.Fatalf("ValidateToolInput() error = %v, want INVALID_ARGUMENT", err)
			}
		})
	}

	for _, host := range []string{"codex", "deepseek"} {
		t.Run("valid "+host, func(t *testing.T) {
			raw := strings.Replace(valid, `"host":"codex"`, `"host":"`+host+`"`, 1)
			if err := ValidateToolInput(ToolOpenTask, []byte(raw)); err != nil {
				t.Fatalf("ValidateToolInput() error = %v", err)
			}
		})
	}
}
