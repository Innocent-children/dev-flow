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

func TestMutationRequestBindingUsesCallerOperationIdentity(t *testing.T) {
	t.Parallel()
	transportID := domain.ID("request-transport")
	callerID := domain.ID("request-caller-operation")
	apply := []byte(`{"request_id":"request-caller-operation","host":"codex"}`)
	if got := resultEnvelopeRequestID(ToolApplyAction, apply, transportID); got != callerID {
		t.Fatalf("apply result request ID = %q, want caller operation %q", got, callerID)
	}
	cancel := []byte(`{"request_id":"request-caller-operation","host":"codex"}`)
	if got := resultEnvelopeRequestID(ToolCancelTask, cancel, transportID); got != callerID {
		t.Fatalf("cancel result request ID = %q, want caller operation %q", got, callerID)
	}
	if got := resultEnvelopeRequestID(ToolGetTask, apply, transportID); got != transportID {
		t.Fatalf("read result request ID = %q, want generated transport %q", got, transportID)
	}
	duplicate := []byte(`{"request_id":"request-caller-operation","request_id":"request-other"}`)
	if got := resultEnvelopeRequestID(ToolApplyAction, duplicate, transportID); got != transportID {
		t.Fatalf("ambiguous request ID = %q, want generated transport %q", got, transportID)
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
	payload := json.RawMessage(`{"transition_id":"requirements_ready","summary":"Ready.","reason":"","artifacts":[],"method_evidence":[{"step_id":"requirements.capture","status":"plain_fallback","capability":"","summary":"Captured."},{"step_id":"requirements.clarify","status":"plain_fallback","capability":"","summary":"Clarified."},{"step_id":"requirements.validate","status":"plain_fallback","capability":"","summary":"Validated."}],"node_result":{"problem_class":"none","baseline":{"goal":"Goal","scope":[],"out_of_scope":[],"acceptance_criteria":["Works"],"constraints":[],"assumptions":[]},"unresolved_questions":[]}}`)
	input := map[string]any{"request_id": "request-caller-operation", "host": "codex", "task_id": opened.Task.TaskID, "revision": action.Revision, "action_id": action.ActionID, "action_kind": action.Kind, "process_id": action.Process.ID, "process_definition_digest": action.Process.DefinitionDigest, "source_cursor": action.NodeID, "repository_binding_digest": action.RepositoryBindingDigest, "payload": payload}
	raw, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	server, err := NewServer(service, "0.3.0", nil)
	if err != nil {
		t.Fatal(err)
	}
	encoded := server.dispatch(context.Background(), ToolApplyAction, "request-transport", raw)
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
	if result.RequestID != "request-caller-operation" || result.Result.LastOperation.OperationID != result.RequestID {
		t.Fatalf("result request=%q last operation=%q", result.RequestID, result.Result.LastOperation.OperationID)
	}
	if action.Process != workflow.StandardProcess().Reference {
		t.Fatal("test action process differs from the current standard process")
	}
}

func TestMutationRequestBindingAppliesToSuccessAndDomainError(t *testing.T) {
	t.Parallel()
	callerID := domain.ID("request-caller-operation")
	transportID := domain.ID("request-transport")
	raw := []byte(`{"request_id":"request-caller-operation","host":"codex"}`)
	resultID := resultEnvelopeRequestID(ToolApplyAction, raw, transportID)
	success := decodeEnvelopeForRequestBinding(t, EncodeSuccess(string(resultID), ToolApplyAction, map[string]any{"status": "accepted"}))
	if !success.OK || success.RequestID != string(callerID) {
		t.Fatalf("success envelope = ok:%v request:%q", success.OK, success.RequestID)
	}
	errorEnvelope := decodeEnvelopeForRequestBinding(t, (&Server{version: "0.3.0"}).dispatch(context.Background(), ToolApplyAction, transportID, raw))
	if errorEnvelope.OK || errorEnvelope.RequestID != string(callerID) || errorEnvelope.Error == nil || errorEnvelope.Error.Code != domain.ErrorInvalidArgument {
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
