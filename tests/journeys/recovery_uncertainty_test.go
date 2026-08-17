package journeys

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
)

func TestPostCommitDiscardCloseReopenRecoveryJourney(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	databasePath := filepath.Join(root, "post-commit-discard.db")
	repositoryPath := filepath.Join(root, "repository")
	initializeRestartRepository(t, repositoryPath)
	repositoryBefore := captureRecoveryRepositorySnapshot(t, repositoryPath)

	first := openRecoveryJourneyCore(t, ctx, databasePath)
	source := openRecoveryJourneyTask(t, ctx, first, repositoryPath)
	payload := recoveryJourneyAssessPayload()
	const operationID = domain.ID("operation-post-commit-discard")
	request := recoveryJourneyApplyRequest(t, source, operationID, payload)

	// The harness observes only that the real application call committed, then deliberately
	// discards the returned value before recreating every Core object used by the caller.
	if _, err := first.service.ApplyAction(ctx, request); err != nil {
		t.Fatalf("post_commit_discard ApplyAction failed before result loss: %v", err)
	}
	firstStore := first.taskStore
	firstObserver := first.observer
	firstService := first.service
	first.close(t)

	reopened := openRecoveryJourneyCore(t, ctx, databasePath)
	if reopened.taskStore == firstStore || reopened.observer == firstObserver || reopened.service == firstService {
		t.Fatal("post_commit_discard reused a Store, observer, or application service")
	}
	probe := recoveryJourneyProbe(t, request, source.Phase)
	read, err := reopened.service.GetTask(ctx, application.GetTaskRequest{
		Host: source.OriginHost, TaskID: source.TaskID, OperationProbe: probe,
	})
	if err != nil {
		t.Fatalf("close/reopen exact probe failed: %v", err)
	}

	task := read.Task
	assessment := read.RecoveryAssessment
	if task.TaskID != source.TaskID || task.Revision != source.Revision+1 ||
		task.Phase != domain.PhaseAssess || task.CurrentAction == nil ||
		task.CurrentAction.Kind != domain.ActionPlanChange {
		t.Fatalf("post_commit_discard resulting task = %#v", task)
	}
	if task.LastOperation == nil || task.LastOperation.OperationID != operationID ||
		task.LastOperation.Kind != domain.OperationApplyAction || task.LastOperation.ActionID == nil ||
		*task.LastOperation.ActionID != request.ActionID ||
		task.LastOperation.FromRevision != source.Revision ||
		task.LastOperation.ToRevision != source.Revision+1 ||
		task.LastOperation.PayloadDigest == "" || task.LastOperation.CommittedAt.IsZero() {
		t.Fatalf("post_commit_discard LastOperation = %#v", task.LastOperation)
	}
	if assessment == nil || assessment.Classification != domain.RecoveryCompletedAndRecorded ||
		assessment.Operation.OperationID != operationID || assessment.Operation.SourcePhase != source.Phase ||
		assessment.Operation.ExpectedRevision != source.Revision || assessment.Operation.ActionID != request.ActionID ||
		assessment.Operation.ActionKind != request.ActionKind ||
		assessment.OperationPayloadDigest != task.LastOperation.PayloadDigest ||
		assessment.LastOperationRelation != recovery.LastOperationExact ||
		assessment.RepositoryRelation != recovery.RepositoryExact || assessment.ActionRetrySafe ||
		assessment.CurrentActionID == nil || *assessment.CurrentActionID != task.CurrentAction.ActionID ||
		assessment.CommittedProof == nil || assessment.CommittedProof.OperationID != operationID ||
		assessment.CommittedProof.ActionID != request.ActionID ||
		assessment.CommittedProof.FromRevision != source.Revision ||
		assessment.CommittedProof.ToRevision != source.Revision+1 ||
		assessment.CommittedProof.PayloadDigest != task.LastOperation.PayloadDigest ||
		!assessment.CommittedProof.CommittedAt.Equal(task.LastOperation.CommittedAt) {
		t.Fatalf("close/reopen exact recovery assessment = %#v", assessment)
	}
	if len(task.Evidence) != 1 || task.Repository.BindingDigest != source.Repository.BindingDigest {
		t.Fatalf("post_commit_discard evidence/binding = %d/%s, want 1/%s",
			len(task.Evidence), task.Repository.BindingDigest, source.Repository.BindingDigest)
	}

	facts := readRecoveryJourneyDatabaseFacts(t, databasePath, source.TaskID, operationID)
	if facts.phase != domain.PhaseAssess || facts.revision != source.Revision+1 ||
		facts.eventCount != 2 || facts.matchingEventCount != 1 || facts.claimCount != 1 ||
		facts.claimIdentity != string(source.Repository.RepositoryIdentity) {
		t.Fatalf("post_commit_discard persisted cardinality = %#v", facts)
	}
	requireRecoveryRepositoryUnchanged(t, repositoryBefore, repositoryPath)
}
