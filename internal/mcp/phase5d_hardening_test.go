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
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestOptionalInputFieldsAcceptOmittedNullAndClosedNonNull(t *testing.T) {
	digest := workflow.StandardProcess().Reference.DefinitionDigest
	payload := `{"transition_id":"requirements_ready","summary":"Ready.","reason":"","artifacts":[],"method_evidence":[{"step_id":"requirements.capture","status":"plain_fallback","capability":"","summary":"Captured requirements."},{"step_id":"requirements.clarify","status":"plain_fallback","capability":"","summary":"Clarified requirements."},{"step_id":"requirements.validate","status":"plain_fallback","capability":"","summary":"Validated requirements."}],"node_result":{"problem_class":"none","baseline":{"goal":"Goal","scope":[],"out_of_scope":[],"acceptance_criteria":["Accepted"],"constraints":[],"assumptions":[]},"unresolved_questions":[]}}`
	emptyMethodPayload := `{"transition_id":"requirements_ready","summary":"Ready.","reason":"","artifacts":[],"method_evidence":[],"node_result":{"problem_class":"none","baseline":{"goal":"Goal","scope":[],"out_of_scope":[],"acceptance_criteria":["Accepted"],"constraints":[],"assumptions":[]},"unresolved_questions":[]}}`
	applyBase := `"request_id":"request","host":"codex","task_id":"task","revision":1,"action_id":"action","action_kind":"COMPLETE_REQUIREMENTS","process_id":"standard-development","process_version":1,"process_definition_digest":"%s","source_cursor":"REQUIREMENTS","repository_binding_digest":"%s","payload":%s`
	binding := strings.Repeat("a", 64)
	valid := []struct {
		name string
		tool string
		raw  string
	}{
		{"open omitted", ToolOpenTask, `{"host":"codex","repository_path":"/repo"}`},
		{"open null", ToolOpenTask, `{"host":"codex","repository_path":"/repo","new_task":null}`},
		{"open nonnull", ToolOpenTask, `{"host":"codex","repository_path":"/repo","new_task":{"request":"Build feature","initial_scope":[],"initial_out_of_scope":[],"known_acceptance_criteria":[],"verification_budget":{"level":"targeted","max_automatic_commands":1,"allow_full_suite":false,"allow_manual_handoff":false},"method_profile":"plain"}}`},
		{"read omitted", ToolGetTask, `{"host":"codex","task_id":"task"}`},
		{"read null", ToolGetTask, `{"host":"codex","task_id":"task","operation_probe":null}`},
		{"next omitted", ToolGetNextAction, `{"host":"codex","task_id":"task"}`},
		{"next null", ToolGetNextAction, `{"host":"codex","task_id":"task","operation_probe":null}`},
		{"probe nonnull", ToolGetTask, fmt.Sprintf(`{"host":"codex","task_id":"task","operation_probe":{"operation_id":"original","process_id":"standard-development","process_version":1,"process_definition_digest":"%s","source_cursor":"REQUIREMENTS","expected_revision":1,"action_id":"action","action_kind":"COMPLETE_REQUIREMENTS","repository_binding_digest":"%s","payload":null}}`, digest, binding)},
		{"apply omitted", ToolApplyAction, fmt.Sprintf("{"+applyBase+"}", digest, binding, payload)},
		{"apply null", ToolApplyAction, fmt.Sprintf("{"+applyBase+`,"recovery_apply":null}`, digest, binding, payload)},
		{"recovery nonnull", ToolApplyAction, fmt.Sprintf("{"+applyBase+`,"recovery_apply":{"operation_id":"original","source_cursor":"REQUIREMENTS"}}`, digest, binding, payload)},
		{"recovery nonnull without retained payload", ToolApplyAction, fmt.Sprintf("{"+applyBase+`,"recovery_apply":{"operation_id":"original","source_cursor":"REQUIREMENTS"}}`, digest, binding, "null")},
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
		{"read duplicate", ToolGetTask, `{"host":"codex","task_id":"task","operation_probe":null,"operation_probe":null}`},
		{"probe incomplete", ToolGetTask, `{"host":"codex","task_id":"task","operation_probe":{"operation_id":"original"}}`},
		{"recovery unknown", ToolApplyAction, fmt.Sprintf("{"+applyBase+`,"recovery_apply":{"operation_id":"original","source_cursor":"REQUIREMENTS","unknown":true}}`, digest, binding, payload)},
		{"recovery duplicate", ToolApplyAction, fmt.Sprintf("{"+applyBase+`,"recovery_apply":{"operation_id":"original","operation_id":"again","source_cursor":"REQUIREMENTS"}}`, digest, binding, payload)},
	}
	for _, tc := range invalid {
		t.Run(tc.name, func(t *testing.T) {
			if err := ValidateToolInput(tc.tool, []byte(tc.raw)); err != domain.ErrInvalidArgument {
				t.Fatalf("error=%v", err)
			}
		})
	}
	if err := ValidateToolInput(ToolApplyAction, []byte(fmt.Sprintf("{"+applyBase+"}", digest, binding, emptyMethodPayload))); err != domain.ErrTransitionNotAllowed {
		t.Fatalf("empty method evidence error=%v", err)
	}
}

func TestServerInfoUsesExactPublicDTOFixture(t *testing.T) {
	encoded := (&Server{version: "0.3.0"}).dispatch(context.Background(), ToolServerInfo, "server-info", []byte(`{}`))
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
	encoded := EncodeError("recovery-request", ToolApplyAction, domain.ErrRecoveryUnavailable)
	if !encoded.IsError || !bytes.Contains(encoded.JSON, []byte(`"code":"RECOVERY_UNAVAILABLE"`)) ||
		!bytes.Contains(encoded.JSON, []byte(`"retry_safe":false`)) || !bytes.Contains(encoded.JSON, []byte(`"action":"none"`)) ||
		bytes.Contains(encoded.JSON, []byte(`"recovery_assessment"`)) {
		t.Fatal(string(encoded.JSON))
	}
}
