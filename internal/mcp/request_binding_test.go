package mcp

import (
	"context"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestSubmissionUsesServerGeneratedOperationIdentity(t *testing.T) {
	t.Parallel()
	transportID := domain.ID("request-transport")
	callerID := domain.ID("request-caller-operation")
	submit := []byte(`{"host":"codex","task_id":"task","action_id":"action"}`)
	if got := resultEnvelopeRequestID(ToolSubmitRequirements, submit, transportID); got != transportID {
		t.Fatalf("submission request ID = %q, want generated operation %q", got, transportID)
	}
	cancel := []byte(`{"request_id":"request-caller-operation","host":"codex"}`)
	if got := resultEnvelopeRequestID(ToolCancelTask, cancel, transportID); got != callerID {
		t.Fatalf("cancel result request ID = %q, want caller operation %q", got, callerID)
	}
	if got := resultEnvelopeRequestID(ToolGetTask, submit, transportID); got != transportID {
		t.Fatalf("read result request ID = %q, want generated transport %q", got, transportID)
	}
}

func TestMutationRequestBindingMatchesCommittedLastOperation(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 8, 20, 9, 0, 0, 0, time.UTC)
	digest := domain.Digest(strings.Repeat("a", 64))
	branch, head := "main", strings.Repeat("b", 40)
	binding := domain.RepositoryBinding{CanonicalRoot: "/repo", GitCommonDirDigest: digest, RepositoryIdentity: digest, Branch: &branch, Head: &head, WorktreeFingerprint: digest, ObservedAt: now, BindingDigest: digest}
	database, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "tasks.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	service, err := application.NewService(database, recoveryProjectionObserver{binding: binding})
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.OpenTask(context.Background(), application.OpenTaskRequest{RequestID: "request-open", Host: domain.HostCodex, RepositoryPath: "/repo", NewTask: &application.NewTaskInput{Request: "Define work.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 2}, MethodProfile: domain.MethodPlain}})
	if err != nil {
		t.Fatal(err)
	}
	action := opened.Task.CurrentAction
	input := map[string]any{
		"host": "codex", "task_id": opened.Task.TaskID, "action_id": action.ActionID,
		"transition_id": "requirements_ready", "summary": "Ready.", "reason": "",
		"artifacts": map[string]any{"current": []any{}, "other_process": []any{}},
		"method_results": map[string]any{
			"requirements.capture":  map[string]any{"capability": "", "summary": "Captured."},
			"requirements.clarify":  map[string]any{"capability": "", "summary": "Clarified."},
			"requirements.validate": map[string]any{"capability": "", "summary": "Validated."},
		},
		"node_result": map[string]any{"problem_class": "none", "baseline": map[string]any{"goal": "Goal", "scope": []any{}, "out_of_scope": []any{}, "acceptance_criteria": []string{"Works"}, "constraints": []any{}, "assumptions": []any{}}, "unresolved_questions": []any{}, "changed_paths": []any{}, "no_file_changes": true},
	}
	raw, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	server, err := NewServer(service, "0.3.0", nil)
	if err != nil {
		t.Fatal(err)
	}
	encoded := server.dispatch(context.Background(), ToolSubmitRequirements, "request-transport", raw)
	if encoded.IsError {
		t.Fatalf("apply result=%s", encoded.JSON)
	}
	var result struct {
		RequestID string `json:"request_id"`
		Result    struct {
			LastOperation struct {
				OperationID string `json:"operation_id"`
			} `json:"last_operation"`
		} `json:"result"`
	}
	if json.Unmarshal(encoded.JSON, &result) != nil {
		t.Fatal("invalid apply result")
	}
	if result.RequestID != "request-transport" || result.Result.LastOperation.OperationID != result.RequestID {
		t.Fatalf("result request=%q last operation=%q", result.RequestID, result.Result.LastOperation.OperationID)
	}
	if action.Process != workflow.StandardProcess().Reference {
		t.Fatal("test action process differs from the current standard process")
	}
}

func TestMutationRequestBindingAppliesToSuccessAndDomainError(t *testing.T) {
	t.Parallel()
	transportID := domain.ID("request-transport")
	raw := []byte(`{"host":"codex"}`)
	resultID := resultEnvelopeRequestID(ToolSubmitRequirements, raw, transportID)
	success := decodeEnvelopeForRequestBinding(t, EncodeSuccess(string(resultID), ToolSubmitRequirements, map[string]any{"status": "accepted"}))
	if !success.OK || success.RequestID != string(transportID) {
		t.Fatalf("success envelope = ok:%v request:%q", success.OK, success.RequestID)
	}
	errorEnvelope := decodeEnvelopeForRequestBinding(t, (&Server{version: "0.3.0"}).dispatch(context.Background(), ToolSubmitRequirements, transportID, raw))
	if errorEnvelope.OK || errorEnvelope.RequestID != string(transportID) || errorEnvelope.Error == nil || errorEnvelope.Error.Code != domain.ErrorInvalidArgument {
		t.Fatalf("domain-error envelope = %+v", errorEnvelope)
	}
	read := decodeEnvelopeForRequestBinding(t, (&Server{version: "0.3.0"}).dispatch(context.Background(), ToolServerInfo, transportID, []byte(`{}`)))
	if !read.OK || read.RequestID != string(transportID) {
		t.Fatalf("transport-bound read envelope = ok:%v request:%q", read.OK, read.RequestID)
	}
}

func decodeEnvelopeForRequestBinding(t *testing.T, encoded EncodedResult) Envelope {
	t.Helper()
	var envelope Envelope
	if err := json.Unmarshal(encoded.JSON, &envelope); err != nil {
		t.Fatal(err)
	}
	return envelope
}
