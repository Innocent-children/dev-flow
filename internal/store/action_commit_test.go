package store

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestStageActionCommitUpdatesOnlyCurrentTaskSnapshot(t *testing.T) {
	ctx := context.Background()
	path := dbPath(t)
	database, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	task := testGraphTask(t)
	if err := database.CommitTask(ctx, testMutation(t, task)); err != nil {
		t.Fatal(err)
	}
	task, err = database.LoadTask(ctx, task.TaskID)
	if err != nil {
		t.Fatal(err)
	}
	commit := storeTestActionCommit(t, task)
	prepared := task
	prepared.ActionCommit = &commit
	if err := database.StageActionCommit(ctx, prepared); err != nil {
		t.Fatal(err)
	}
	loaded, err := database.LoadTask(ctx, task.TaskID)
	if err != nil || loaded.Revision != task.Revision || loaded.ActionCommit == nil || !loaded.ActionCommit.Equal(commit) {
		t.Fatalf("loaded commit=%#v revision=%d err=%v", loaded.ActionCommit, loaded.Revision, err)
	}
	if err := database.StageActionCommit(ctx, prepared); err != nil {
		t.Fatalf("idempotent stage: %v", err)
	}
	conflict := prepared
	copy := commit
	copy.Operation.OperationID = "different-operation"
	conflict.ActionCommit = &copy
	if err := database.StageActionCommit(ctx, conflict); !errors.Is(err, ErrInvalidArgument) {
		t.Fatalf("conflicting stage error=%v", err)
	}
	if err := database.Close(); err != nil {
		t.Fatal(err)
	}
	database, err = Open(ctx, path)
	if err != nil {
		t.Fatalf("reopen staged commit: %v", err)
	}
	defer database.Close()
	reopened, err := database.LoadTask(ctx, task.TaskID)
	if err != nil || reopened.ActionCommit == nil || !reopened.ActionCommit.Equal(commit) {
		t.Fatalf("reopened commit=%#v err=%v", reopened.ActionCommit, err)
	}
}

func storeTestActionCommit(t *testing.T, task domain.ProcessTask) domain.ActionCommit {
	t.Helper()
	result := map[string]any{
		"problem_class":        "none",
		"baseline":             map[string]any{"goal": "Goal", "scope": []string{}, "out_of_scope": []string{}, "acceptance_criteria": []string{"Works"}, "constraints": []string{}, "assumptions": []string{}},
		"unresolved_questions": []string{}, "changed_paths": []string{}, "no_file_changes": true,
	}
	nodeResult, _ := json.Marshal(result)
	method := make([]domain.MethodEvidence, len(task.CurrentAction.SemanticMethodSteps))
	for index, step := range task.CurrentAction.SemanticMethodSteps {
		method[index] = domain.MethodEvidence{StepID: step.StepID, Status: domain.MethodStepPlainFallback, Summary: "Completed step."}
	}
	envelope := workflow.StandardPayload{TransitionID: "requirements_ready", Summary: "Ready.", Reason: "", Artifacts: []domain.ArtifactReference{}, MethodEvidence: method, NodeResult: nodeResult}
	raw, _ := json.Marshal(envelope)
	decoded, typed, err := workflow.DecodeStandardPayload(task.CurrentNode, raw)
	if err != nil {
		t.Fatal(err)
	}
	canonical, err := workflow.CanonicalValidatedPayload(decoded, typed)
	if err != nil {
		t.Fatal(err)
	}
	operation := domain.OperationReference{OperationID: "action-operation", Process: task.Process, SourceCursor: task.CurrentNode, ExpectedRevision: task.Revision, ActionID: task.CurrentAction.ActionID, ActionKind: task.CurrentAction.Kind, RepositoryBindingDigest: task.CurrentAction.RepositoryBindingDigest}
	digest, err := workflow.GraphOperationDigest(task.OriginHost, task.TaskID, operation, canonical)
	if err != nil {
		t.Fatal(err)
	}
	return domain.ActionCommit{Operation: operation, Payload: canonical, PayloadDigest: digest, PreparedAt: task.UpdatedAt}
}
