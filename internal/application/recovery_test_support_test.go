package application

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type preCommitFailingStore struct {
	delegate       store.Store
	failure        error
	commitAttempts int
}

func (s *preCommitFailingStore) LoadTask(ctx context.Context, taskID domain.ID) (domain.Task, error) {
	return s.delegate.LoadTask(ctx, taskID)
}

func (s *preCommitFailingStore) LoadActiveTask(
	ctx context.Context,
	repositoryIdentity domain.Digest,
) (domain.Task, error) {
	return s.delegate.LoadActiveTask(ctx, repositoryIdentity)
}

func (s *preCommitFailingStore) CommitTask(context.Context, store.TaskMutation) error {
	s.commitAttempts++
	return s.failure
}

type reopenedCommittedOperationFixture struct {
	service      *Service
	databasePath string
	source       domain.Task
	committed    domain.Task
	request      ApplyActionRequest
	probe        *OperationProbe
}

func newReopenedCommittedOperationFixture(
	t *testing.T,
	operationID domain.ID,
) reopenedCommittedOperationFixture {
	t.Helper()
	ctx := context.Background()
	repositoryPath := newCommittedApplicationRepository(t)
	databasePath := filepath.Join(t.TempDir(), "exact-operation-probe.db")
	firstStore, err := store.Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("open exact-probe store: %v", err)
	}
	clock := &deterministicApplicationClock{
		next: time.Date(2026, time.August, 17, 9, 0, 0, 0, time.UTC),
	}
	firstService, err := newService(firstStore, repository.NewGitObserver(), clock.Now, sequentialApplicationIDs())
	if err != nil {
		_ = firstStore.Close()
		t.Fatalf("construct exact-probe service: %v", err)
	}
	opened, err := firstService.OpenTask(ctx, OpenTaskRequest{
		RequestID:      "request-exact-probe-open",
		Host:           domain.HostCodex,
		RepositoryPath: repositoryPath,
		NewTask: &NewTaskInput{
			Goal:               "prove exact committed operation read-back",
			Scope:              []string{"application reads"},
			OutOfScope:         []string{"host behavior"},
			AcceptanceCriteria: []string{"reopened reads project the exact committed operation"},
			VerificationBudget: testBudget(),
		},
	})
	if err != nil {
		_ = firstStore.Close()
		t.Fatalf("open exact-probe task: %v", err)
	}
	source := opened.Task
	payload := workflow.AssessTaskPayload{
		Result:                         domain.ActionResultSucceeded,
		Summary:                        "exact operation probe source committed",
		VerificationBudgetAcknowledged: true,
	}
	request := applyRequestForTask(source, operationID, payload)
	committed, err := firstService.ApplyAction(ctx, request)
	if err != nil {
		_ = firstStore.Close()
		t.Fatalf("commit exact-probe operation: %v", err)
	}
	if err := firstStore.Close(); err != nil {
		t.Fatalf("close exact-probe source store: %v", err)
	}

	reopenedStore, err := store.Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("reopen exact-probe store: %v", err)
	}
	t.Cleanup(func() { _ = reopenedStore.Close() })
	reopenedService, err := NewService(reopenedStore, repository.NewGitObserver())
	if err != nil {
		t.Fatalf("recreate exact-probe service: %v", err)
	}
	probe := &OperationProbe{
		OperationID:             request.RequestID,
		SourcePhase:             source.Phase,
		ExpectedRevision:        source.Revision,
		ActionID:                request.ActionID,
		ActionKind:              request.ActionKind,
		RepositoryBindingDigest: request.RepositoryBindingDigest,
		Payload:                 payload,
	}
	return reopenedCommittedOperationFixture{
		service: reopenedService, databasePath: databasePath, source: source,
		committed: committed.Task, request: request, probe: probe,
	}
}
