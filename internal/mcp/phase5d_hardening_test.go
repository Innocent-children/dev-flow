package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/userconfig"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestOptionalInputFieldsAcceptOmittedNullAndClosedNonNull(t *testing.T) {
	digest := workflow.StandardProcess().Reference.DefinitionDigest
	binding := strings.Repeat("a", 64)
	origin := `{"mode":"dedicated_worktree","remote_name":"origin","base_branch":"main","base_commit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","task_branch":"feature/task","provisioning_receipt_id":"receipt"}`
	docsOrigin := `{"mode":"dedicated_worktree","remote_name":"origin","base_branch":"main","base_commit":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","task_branch":"feature/docs","provisioning_receipt_id":"receipt-docs"}`
	valid := []struct {
		name string
		tool string
		raw  string
	}{
		{"open omitted", ToolOpenTask, `{"host":"codex","repository_path":"/repo"}`},
		{"open null", ToolOpenTask, `{"host":"codex","repository_path":"/repo","new_task":null}`},
		{"open nonnull", ToolOpenTask, `{"host":"codex","repository_path":"/repo","workspace_origin":` + origin + `,"new_task":{"request":"Build feature","initial_scope":[],"initial_out_of_scope":[],"known_acceptance_criteria":[],"verification_budget":{"level":"targeted","max_automatic_commands":1,"allow_full_suite":false,"allow_manual_handoff":false},"method_profile":"plain"}}`},
		{"open multi repository", ToolOpenTask, `{"host":"codex","repository_path":"/core","workspace_origin":` + origin + `,"primary_repository_key":"core","additional_repositories":[{"key":"docs","repository_path":"/docs","workspace_origin":` + docsOrigin + `}],"new_task":{"request":"Build feature","initial_scope":[],"initial_out_of_scope":[],"known_acceptance_criteria":[],"verification_budget":{"level":"targeted","max_automatic_commands":1,"allow_full_suite":false,"allow_manual_handoff":false},"method_profile":"plain"}}`},
		{"read omitted", ToolGetTask, `{"host":"codex","task_id":"task"}`},
		{"read null", ToolGetTask, `{"host":"codex","task_id":"task","operation_probe":null}`},
		{"next omitted", ToolGetNextAction, `{"host":"codex","task_id":"task"}`},
		{"next null", ToolGetNextAction, `{"host":"codex","task_id":"task","operation_probe":null}`},
		{"probe nonnull", ToolGetTask, fmt.Sprintf(`{"host":"codex","task_id":"task","operation_probe":{"operation_id":"original","process_id":"standard-development","process_definition_digest":"%s","source_cursor":"REQUIREMENTS","expected_revision":1,"action_id":"action","action_kind":"COMPLETE_REQUIREMENTS","repository_binding_digest":"%s","issuance_identity_digest":"%s","issuance_history_digest":"%s","issuance_content_digest":"%s","payload":null}}`, digest, binding, binding, binding, binding)},
	}
	for _, tc := range valid {
		t.Run(tc.name, func(t *testing.T) {
			if err := ValidateToolInput(tc.tool, []byte(tc.raw)); err != nil {
				t.Fatalf("error=%v raw=%s", err, tc.raw)
			}
		})
	}

	invalid := []struct {
		name string
		tool string
		raw  string
	}{
		{"open unknown", ToolOpenTask, `{"host":"codex","repository_path":"/repo","unknown":true}`},
		{"open additional unknown", ToolOpenTask, `{"host":"codex","repository_path":"/core","workspace_origin":` + origin + `,"additional_repositories":[{"key":"docs","repository_path":"/docs","workspace_origin":` + docsOrigin + `,"unknown":true}],"new_task":{"request":"Build feature","initial_scope":[],"initial_out_of_scope":[],"known_acceptance_criteria":[],"verification_budget":{"level":"targeted","max_automatic_commands":1,"allow_full_suite":false,"allow_manual_handoff":false},"method_profile":"plain"}}`},
		{"open null primary key", ToolOpenTask, `{"host":"codex","repository_path":"/core","workspace_origin":` + origin + `,"primary_repository_key":null,"new_task":{"request":"Build feature","initial_scope":[],"initial_out_of_scope":[],"known_acceptance_criteria":[],"verification_budget":{"level":"targeted","max_automatic_commands":1,"allow_full_suite":false,"allow_manual_handoff":false},"method_profile":"plain"}}`},
		{"open null additions", ToolOpenTask, `{"host":"codex","repository_path":"/core","workspace_origin":` + origin + `,"additional_repositories":null,"new_task":{"request":"Build feature","initial_scope":[],"initial_out_of_scope":[],"known_acceptance_criteria":[],"verification_budget":{"level":"targeted","max_automatic_commands":1,"allow_full_suite":false,"allow_manual_handoff":false},"method_profile":"plain"}}`},
		{"open scope during resume", ToolOpenTask, `{"host":"codex","repository_path":"/core","primary_repository_key":"core","new_task":null}`},
		{"read duplicate", ToolGetTask, `{"host":"codex","task_id":"task","operation_probe":null,"operation_probe":null}`},
		{"probe incomplete", ToolGetTask, `{"host":"codex","task_id":"task","operation_probe":{"operation_id":"original"}}`},
	}
	for _, tc := range invalid {
		t.Run(tc.name, func(t *testing.T) {
			if err := ValidateToolInput(tc.tool, []byte(tc.raw)); err != domain.ErrInvalidArgument {
				t.Fatalf("error=%v", err)
			}
		})
	}
	additional := make([]map[string]any, 8)
	for index := range additional {
		additional[index] = map[string]any{"key": string(rune('a' + index)), "repository_path": fmt.Sprintf("/%c", 'a'+index), "workspace_origin": map[string]any{"mode": "dedicated_worktree", "remote_name": "origin", "base_branch": "main", "base_commit": strings.Repeat("a", 40), "task_branch": fmt.Sprintf("feature/%c", 'a'+index), "provisioning_receipt_id": fmt.Sprintf("receipt-%c", 'a'+index)}}
	}
	eighth, _ := json.Marshal(map[string]any{"host": "codex", "repository_path": "/core", "workspace_origin": json.RawMessage(origin), "additional_repositories": additional, "new_task": map[string]any{"request": "Build feature", "initial_scope": []any{}, "initial_out_of_scope": []any{}, "known_acceptance_criteria": []any{}, "verification_budget": map[string]any{"level": "targeted", "max_automatic_commands": 1, "allow_full_suite": false, "allow_manual_handoff": false}, "method_profile": "plain"}})
	if err := ValidateToolInput(ToolOpenTask, eighth); err != domain.ErrInvalidArgument {
		t.Fatalf("eighth additional repository error=%v", err)
	}
}

func TestServerInfoProjectsHostPreferenceSnapshot(t *testing.T) {
	server := &Server{
		version: "test",
		hostPreferences: userconfig.Preferences{
			Codex:    userconfig.HostPreferences{CodebaseMemory: true},
			DeepSeek: userconfig.HostPreferences{CodebaseMemory: false},
		},
	}
	encoded := server.dispatch(context.Background(), ToolServerInfo, "server-info-preferences", []byte(`{}`))
	if encoded.IsError || !bytes.Contains(encoded.JSON, []byte(`"host_preferences":{"codex":{"codebase_memory":true},"deepseek":{"codebase_memory":false}}`)) {
		t.Fatal(string(encoded.JSON))
	}
	for _, forbidden := range []string{"installed", "healthy", "available"} {
		if bytes.Contains(encoded.JSON, []byte(forbidden)) {
			t.Fatalf("preference projection implied capability %q", forbidden)
		}
	}
}

func TestServerInfoUsesExactPublicDTOFixture(t *testing.T) {
	versionBytes, err := os.ReadFile(filepath.Join("..", "..", "CORE_VERSION"))
	if err != nil {
		t.Fatal(err)
	}
	encoded := (&Server{version: strings.TrimSpace(string(versionBytes))}).dispatch(context.Background(), ToolServerInfo, "server-info", []byte(`{}`))
	if encoded.IsError {
		t.Fatal(string(encoded.JSON))
	}
	var envelope struct {
		Result json.RawMessage `json:"result"`
	}
	if err := json.Unmarshal(encoded.JSON, &envelope); err != nil {
		t.Fatal(err)
	}
	want, err := os.ReadFile(filepath.Join("..", "..", "protocol", "fixtures", "graph-server-info.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(envelope.Result, bytes.TrimSpace(want)) {
		t.Fatalf("server info fixture mismatch\n got: %s\nwant: %s", envelope.Result, want)
	}
	if bytes.Contains(envelope.Result, []byte("process_definition_digest")) {
		t.Fatal("internal process reference field leaked")
	}
}

func TestRecoveryUnavailablePublicEnvelopeIsFailClosed(t *testing.T) {
	encoded := EncodeError("recovery-request", ToolRecoverAction, domain.ErrRecoveryUnavailable)
	if !encoded.IsError || !bytes.Contains(encoded.JSON, []byte(`"code":"RECOVERY_UNAVAILABLE"`)) ||
		!bytes.Contains(encoded.JSON, []byte(`"retry_safe":false`)) || !bytes.Contains(encoded.JSON, []byte(`"action":"none"`)) ||
		bytes.Contains(encoded.JSON, []byte(`"recovery_assessment"`)) {
		t.Fatal(string(encoded.JSON))
	}
}
