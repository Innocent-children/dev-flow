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
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type recoveryProjectionObserver struct{ binding domain.RepositoryBinding }

func (o recoveryProjectionObserver) Observe(context.Context, string) (domain.RepositoryBinding, error) {
	return o.binding, nil
}

func TestGetTaskDispatchReturnsActualRecoveryAssessment(t *testing.T) {
	now := time.Date(2026, 8, 19, 10, 0, 0, 0, time.UTC)
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
	opened, err := service.OpenTask(context.Background(), application.OpenTaskRequest{RequestID: "open", Host: domain.HostCodex, RepositoryPath: "/repo", NewTask: &application.NewTaskInput{Request: "Define work.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 2}, MethodProfile: domain.MethodPlain}})
	if err != nil {
		t.Fatal(err)
	}
	action := opened.Task.CurrentAction
	payload := `{"transition_id":"requirements_ready","summary":"Ready.","reason":"","artifacts":[],"method_evidence":[{"step_id":"requirements.capture","status":"plain_fallback","capability":"","summary":"Captured."},{"step_id":"requirements.clarify","status":"plain_fallback","capability":"","summary":"Clarified."},{"step_id":"requirements.validate","status":"plain_fallback","capability":"","summary":"Validated."}],"node_result":{"problem_class":"none","baseline":{"goal":"Goal","scope":[],"out_of_scope":[],"acceptance_criteria":["Works"],"constraints":[],"assumptions":[]},"unresolved_questions":[],"changed_paths":[],"no_file_changes":true}}`
	input := map[string]any{"host": "codex", "task_id": opened.Task.TaskID, "operation_probe": map[string]any{"operation_id": "uncertain", "process_id": action.Process.ID, "process_definition_digest": action.Process.DefinitionDigest, "source_cursor": action.NodeID, "expected_revision": action.Revision, "action_id": action.ActionID, "action_kind": action.Kind, "repository_binding_digest": action.RepositoryBindingDigest, "payload": json.RawMessage(payload)}}
	raw, _ := json.Marshal(input)
	server, err := NewServer(service, "0.3.0", &ServerOptions{NewRequestID: func() (domain.ID, error) { return "read-request", nil }})
	if err != nil {
		t.Fatal(err)
	}
	encoded := server.dispatch(context.Background(), ToolGetTask, "read-request", raw)
	if encoded.IsError || !strings.Contains(string(encoded.JSON), `"recovery_assessment":{"`) || !strings.Contains(string(encoded.JSON), `"classification":"completed_but_unrecorded"`) {
		t.Fatalf("result=%s", encoded.JSON)
	}
}

func TestRecoveryAssessmentProjectionIsClosedAndRedacted(t *testing.T) {
	process := workflow.StandardProcess().Reference
	digest := domain.Digest(strings.Repeat("a", 64))
	actionID := domain.ID("action")
	assessment := &recovery.RecoveryAssessment{Classification: domain.RecoveryPartiallyCompleted, Operation: domain.OperationReference{OperationID: "operation", Process: process, SourceCursor: domain.NodeRefactor, ExpectedRevision: 3, ActionID: actionID, ActionKind: domain.ActionCompleteRefactor, RepositoryBindingDigest: digest}, TaskRevision: 3, CurrentActionID: &actionID, IssuanceBindingDigest: digest, AuthoritativeBindingDigest: digest, ObservedBindingDigest: domain.Digest(strings.Repeat("b", 64)), RepositoryRelation: recovery.RepositoryWorktreeOnlyChanged, Repositories: []recovery.RepositoryFact{{RepositoryKey: "docs", Relation: recovery.RepositoryForbiddenChange, Reason: recovery.RepositoryReasonHead}, {RepositoryKey: "core", Relation: recovery.RepositoryExact, Reason: recovery.RepositoryReasonExact}}, LastOperationRelation: recovery.LastOperationUnrelated, OperationEvidence: recovery.OperationEvidencePartial, ActionRetrySafe: false, NextAdvice: recovery.AdviceSubmitRecoveryApply, UnblockCondition: &domain.BlockerCondition{Kind: domain.BlockerConditionRestoreIssuanceBinding, ExpectedBindingDigest: digest}, ObservedAt: time.Date(2026, 8, 19, 10, 0, 0, 0, time.UTC)}
	raw, err := json.Marshal(projectRecoveryAssessment(assessment))
	if err != nil {
		t.Fatal(err)
	}
	text := string(raw)
	for _, required := range []string{"\"classification\":\"partially_completed\"", "\"source_cursor\":\"REFACTOR\"", "\"next_advice\":\"submit_recovery_apply\"", `"repositories":[{"key":"core","reason":"exact","relation":"exact"},{"key":"docs","reason":"head_changed","relation":"forbidden_change"}]`} {
		if !strings.Contains(text, required) {
			t.Fatalf("projection missing %s: %s", required, text)
		}
	}
	for _, forbidden := range []string{"directive", "canonical_root", "raw_payload", "database", "/Users/", "git status", "stderr"} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("projection leaked %s: %s", forbidden, text)
		}
	}
}

func TestRepositoryDriftErrorProjectsOnlyValidatedKeyAndClosedReason(t *testing.T) {
	safe := EncodeError("drift-safe", ToolApplyAction, domain.NewError(domain.ErrorRepositoryDrift, `Repository "docs" has repository drift: head_changed.`))
	if safe.IsError == false || !strings.Contains(string(safe.JSON), `"message":"Repository \"docs\" has repository drift: head_changed."`) {
		t.Fatalf("safe drift result=%s", safe.JSON)
	}
	unsafe := EncodeError("drift-unsafe", ToolApplyAction, domain.NewError(domain.ErrorRepositoryDrift, `Repository "/Users/private" has repository drift: git status.`))
	if strings.Contains(string(unsafe.JSON), "/Users/private") || strings.Contains(string(unsafe.JSON), "git status") {
		t.Fatalf("unsafe drift result=%s", unsafe.JSON)
	}
}

func TestResolveBlockerInputUsesClosedPayloadAndNoDestination(t *testing.T) {
	digest := workflow.StandardProcess().Reference.DefinitionDigest
	raw := []byte(`{"request_id":"resolve","host":"codex","task_id":"task","revision":2,"action_id":"action","action_kind":"RESOLVE_BLOCKER","process_id":"standard-development","process_definition_digest":"` + string(digest) + `","source_cursor":"BLOCKED","repository_binding_digest":"` + string(digest) + `","payload":{"blocker_id":"blocker","condition":{"kind":"restore_issuance_binding","expected_binding_digest":"` + string(digest) + `"},"observed_binding_digest":"` + string(digest) + `"}}`)
	if err := ValidateToolInput(ToolApplyAction, raw); err != nil {
		t.Fatal(err)
	}
	var value map[string]any
	if json.Unmarshal(raw, &value) != nil {
		t.Fatal("invalid fixture")
	}
	payload := value["payload"].(map[string]any)
	payload["destination"] = "REFACTOR"
	bad, _ := json.Marshal(value)
	if err := ValidateToolInput(ToolApplyAction, bad); err != domain.ErrInvalidArgument {
		t.Fatalf("destination error=%v", err)
	}
}
