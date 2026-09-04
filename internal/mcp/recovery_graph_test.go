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
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type recoveryProjectionObserver struct {
	origin  domain.WorkspaceOrigin
	binding domain.RepositoryBinding
}

func (o recoveryProjectionObserver) Observe(context.Context, string) (domain.RepositoryBinding, error) {
	return o.binding, nil
}
func (o recoveryProjectionObserver) ObserveWorkspace(context.Context, string, repository.WorkspaceOriginSelection, *domain.RepositoryBinding) (domain.WorkspaceOrigin, domain.RepositoryBinding, error) {
	return o.origin, o.binding, nil
}

func TestGetTaskDispatchReturnsActualRecoveryAssessment(t *testing.T) {
	now := time.Date(2026, 8, 19, 10, 0, 0, 0, time.UTC)
	repositoryPath := testPath("repo")
	origin, binding, originInput := mcpWorkspaceFixture(now, repositoryPath, 'a')
	database, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "tasks.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	service, err := application.NewService(database, recoveryProjectionObserver{origin: origin, binding: binding})
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.OpenTask(context.Background(), application.OpenTaskRequest{RequestID: "open", Host: domain.HostCodex, RepositoryPath: repositoryPath, WorkspaceOrigin: &originInput, NewTask: &application.NewTaskInput{Request: "Define work.", MethodProfile: domain.MethodPlain}})
	if err != nil {
		t.Fatal(err)
	}
	action := opened.Task.CurrentAction
	payload := `{"transition_id":"requirements_ready","summary":"Ready.","reason":"","artifacts":[],"method_evidence":[{"step_id":"requirements.capture","status":"plain_fallback","capability":"","summary":"Captured."},{"step_id":"requirements.clarify","status":"plain_fallback","capability":"","summary":"Clarified."},{"step_id":"requirements.validate","status":"plain_fallback","capability":"","summary":"Validated."}],"node_result":{"problem_class":"none","baseline":{"goal":"Goal","scope":[],"out_of_scope":[],"acceptance_criteria":["Works"],"constraints":[],"assumptions":[]},"unresolved_questions":[]}}`
	input := map[string]any{"host": "codex", "task_id": opened.Task.TaskID, "operation_probe": map[string]any{"operation_id": "uncertain", "process_id": action.Process.ID, "process_definition_digest": action.Process.DefinitionDigest, "source_cursor": action.NodeID, "expected_revision": action.Revision, "action_id": action.ActionID, "action_kind": action.Kind, "repository_binding_digest": action.RepositoryBindingDigest, "issuance_identity_digest": action.IssuanceIdentityDigest, "issuance_history_digest": action.IssuanceHistoryDigest, "issuance_content_digest": action.IssuanceContentDigest, "payload": json.RawMessage(payload)}}
	raw, _ := json.Marshal(input)
	server, err := NewServer(service, "0.7.0", &ServerOptions{NewRequestID: func() (domain.ID, error) { return "read-request", nil }})
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
	assessment := &recovery.RecoveryAssessment{Classification: domain.RecoveryPartiallyCompleted, Operation: domain.OperationReference{OperationID: "operation", Process: process, SourceCursor: domain.NodeRefactor, ExpectedRevision: 3, ActionID: actionID, ActionKind: domain.ActionCompleteRefactor, RepositoryBindingDigest: digest, IssuanceIdentityDigest: digest, IssuanceHistoryDigest: digest, IssuanceContentDigest: digest}, TaskRevision: 3, CurrentActionID: &actionID, IssuanceBindingDigest: digest, AuthoritativeBindingDigest: digest, ObservedBindingDigest: domain.Digest(strings.Repeat("b", 64)), RepositoryRelation: recovery.RepositoryWorktreeOnlyChanged, Repositories: []recovery.RepositoryFact{{RepositoryKey: "docs", Relation: recovery.RepositoryForbiddenChange, Reason: recovery.RepositoryReasonHistory}, {RepositoryKey: "core", Relation: recovery.RepositoryExact, Reason: recovery.RepositoryReasonExact}}, LastOperationRelation: recovery.LastOperationUnrelated, OperationEvidence: recovery.OperationEvidencePartial, ActionRetrySafe: false, NextAdvice: recovery.AdviceSubmitRecoveryApply, UnblockCondition: &domain.BlockerCondition{Kind: domain.BlockerConditionRestoreIssuanceBinding, ExpectedBindingDigest: digest, ExpectedIdentityDigest: digest, ExpectedHistoryDigest: digest, ExpectedContentDigest: digest}, ObservedAt: time.Date(2026, 8, 19, 10, 0, 0, 0, time.UTC)}
	raw, err := json.Marshal(projectRecoveryAssessment(assessment))
	if err != nil {
		t.Fatal(err)
	}
	text := string(raw)
	for _, required := range []string{"\"classification\":\"partially_completed\"", "\"source_cursor\":\"REFACTOR\"", "\"next_advice\":\"submit_recovery_apply\"", `"repositories":[{"key":"core","reason":"exact","relation":"exact"},{"key":"docs","reason":"history_changed","relation":"forbidden_change"}]`} {
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
	safe := EncodeError("drift-safe", ToolRecoverAction, domain.NewError(domain.ErrorRepositoryDrift, `Repository "docs" has repository drift: history_changed.`))
	if safe.IsError == false || !strings.Contains(string(safe.JSON), `"message":"Repository \"docs\" has repository drift: history_changed."`) {
		t.Fatalf("safe drift result=%s", safe.JSON)
	}
	unsafe := EncodeError("drift-unsafe", ToolRecoverAction, domain.NewError(domain.ErrorRepositoryDrift, `Repository "/Users/private" has repository drift: git status.`))
	if strings.Contains(string(unsafe.JSON), "/Users/private") || strings.Contains(string(unsafe.JSON), "git status") {
		t.Fatalf("unsafe drift result=%s", unsafe.JSON)
	}
}

func TestResolveBlockerInputUsesClosedPayloadAndNoDestination(t *testing.T) {
	raw := []byte(`{"host":"codex","task_id":"task","action_id":"action"}`)
	if err := ValidateToolInput(ToolResolveBlocker, raw); err != nil {
		t.Fatal(err)
	}
	fileScope := []byte(`{"host":"codex","task_id":"task","action_id":"action","choice":"allow_once","reason":"Allow this exact write."}`)
	if err := ValidateToolInput(ToolResolveBlocker, fileScope); err != nil {
		t.Fatal(err)
	}
	var value map[string]any
	if json.Unmarshal(raw, &value) != nil {
		t.Fatal("invalid fixture")
	}
	value["destination"] = "REFACTOR"
	bad, _ := json.Marshal(value)
	if err := ValidateToolInput(ToolResolveBlocker, bad); err != domain.ErrInvalidArgument {
		t.Fatalf("destination error=%v", err)
	}
}

func mcpWorkspaceFixture(now time.Time, root string, marker byte) (domain.WorkspaceOrigin, domain.RepositoryBinding, application.WorkspaceOriginInput) {
	digest := domain.Digest(strings.Repeat(string(marker), 64))
	head := strings.Repeat(string(marker), 40)
	branch := "feature/" + string(marker)
	origin := domain.WorkspaceOrigin{Mode: domain.WorkspaceModeDedicatedWorktree, RemoteName: "origin", BaseBranch: "main", BaseCommit: head, TaskBranch: branch, SourceRepositoryGroupDigest: digest, CanonicalWorktreeRoot: root, WorktreeGitDirDigest: digest, ProvisioningReceiptID: domain.ID("receipt-" + string(marker))}
	binding := domain.RepositoryBinding{WorktreeInstanceDigest: digest, IdentityDigest: digest, HistoryDigest: digest, ContentDigest: digest, CurrentBranch: &branch, CurrentHead: head, HeadTree: head, HistoryRelation: domain.RepositoryHistoryExact, BaseCommitAncestor: true, ObservedAt: now, BindingDigest: digest}
	input := application.WorkspaceOriginInput{Mode: origin.Mode, RemoteName: origin.RemoteName, BaseBranch: origin.BaseBranch, BaseCommit: origin.BaseCommit, TaskBranch: origin.TaskBranch, ProvisioningReceiptID: origin.ProvisioningReceiptID}
	return origin, binding, input
}
