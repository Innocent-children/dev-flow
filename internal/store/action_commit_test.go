package store

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestStageActionOperationLeavesTaskSnapshotUnchanged(t *testing.T) {
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
	if err := database.StageActionOperation(ctx, task, commit); err != nil {
		t.Fatal(err)
	}
	loaded, err := database.LoadTask(ctx, task.TaskID)
	if err != nil || !reflect.DeepEqual(loaded, task) {
		t.Fatalf("loaded task changed=%v err=%v", !reflect.DeepEqual(loaded, task), err)
	}
	operation, found, err := database.LoadActionOperation(ctx, task.TaskID)
	if err != nil || !found || operation.AppliedRevision != nil || !operation.Commit.Equal(commit) {
		t.Fatalf("operation=%#v found=%v err=%v", operation, found, err)
	}
	if err := database.StageActionOperation(ctx, task, commit); err != nil {
		t.Fatalf("idempotent stage: %v", err)
	}
	copy := commit
	copy.Operation.OperationID = "different-operation"
	if err := database.StageActionOperation(ctx, task, copy); !errors.Is(err, ErrInvalidArgument) {
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
	reopened, found, err := database.LoadActionOperation(ctx, task.TaskID)
	if err != nil || !found || !reopened.Commit.Equal(commit) {
		t.Fatalf("reopened operation=%#v found=%v err=%v", reopened, found, err)
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
