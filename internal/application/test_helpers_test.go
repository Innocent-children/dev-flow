package application

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type recordingStore struct {
	loadTaskFn       func(context.Context, domain.ID) (domain.Task, error)
	loadActiveTaskFn func(context.Context, domain.Digest) (domain.Task, error)
	commitTaskFn     func(context.Context, store.TaskMutation) error

	loadTaskCalls       int
	loadActiveTaskCalls int
	commitTaskCalls     int
	loadedTaskIDs       []domain.ID
	loadedRepositories  []domain.Digest
	commits             []store.TaskMutation
}

func (s *recordingStore) LoadTask(ctx context.Context, taskID domain.ID) (domain.Task, error) {
	s.loadTaskCalls++
	s.loadedTaskIDs = append(s.loadedTaskIDs, taskID)
	if s.loadTaskFn == nil {
		return domain.Task{}, store.ErrTaskNotFound
	}
	return s.loadTaskFn(ctx, taskID)
}

func (s *recordingStore) LoadActiveTask(
	ctx context.Context,
	repositoryIdentity domain.Digest,
) (domain.Task, error) {
	s.loadActiveTaskCalls++
	s.loadedRepositories = append(s.loadedRepositories, repositoryIdentity)
	if s.loadActiveTaskFn == nil {
		return domain.Task{}, store.ErrTaskNotFound
	}
	return s.loadActiveTaskFn(ctx, repositoryIdentity)
}

func (s *recordingStore) CommitTask(ctx context.Context, mutation store.TaskMutation) error {
	s.commitTaskCalls++
	s.commits = append(s.commits, cloneMutation(mutation))
	if s.commitTaskFn == nil {
		return nil
	}
	return s.commitTaskFn(ctx, mutation)
}

func cloneMutation(mutation store.TaskMutation) store.TaskMutation {
	mutation.Task = mutation.Task.Clone()
	if mutation.Event.ActionID != nil {
		actionID := *mutation.Event.ActionID
		mutation.Event.ActionID = &actionID
	}
	return mutation
}

type fixedRepositoryObserver struct {
	binding domain.RepositoryBinding
	err     error
	calls   int
	paths   []string
}

func (o *fixedRepositoryObserver) Observe(
	_ context.Context,
	repositoryPath string,
) (domain.RepositoryBinding, error) {
	o.calls++
	o.paths = append(o.paths, repositoryPath)
	return o.binding.Clone(), o.err
}

func deterministicIDGenerator(ids ...domain.ID) idGenerator {
	index := 0
	return func(prefix string) (domain.ID, error) {
		if index >= len(ids) {
			return "", errors.New("unexpected ID request for " + prefix)
		}
		id := ids[index]
		index++
		return id, nil
	}
}

func newTestService(
	t *testing.T,
	taskStore store.Store,
	observer repository.RepositoryObserver,
	now time.Time,
	ids ...domain.ID,
) *Service {
	t.Helper()
	service, err := newService(taskStore, observer, func() time.Time { return now }, deterministicIDGenerator(ids...))
	if err != nil {
		t.Fatalf("newService() error = %v", err)
	}
	return service
}

func testTime() time.Time {
	return time.Date(2026, time.August, 15, 8, 30, 0, 123456789, time.UTC)
}

func testBinding() domain.RepositoryBinding {
	branch := "main"
	head := strings.Repeat("e", 40)
	return domain.RepositoryBinding{
		CanonicalRoot:       "/workspace/example",
		GitCommonDirDigest:  domain.Digest(strings.Repeat("a", 64)),
		RepositoryIdentity:  domain.Digest(strings.Repeat("b", 64)),
		Branch:              &branch,
		Head:                &head,
		WorktreeFingerprint: domain.Digest(strings.Repeat("c", 64)),
		ObservedAt:          testTime(),
		BindingDigest:       domain.Digest(strings.Repeat("d", 64)),
	}
}

func testBudget() domain.VerificationBudget {
	return domain.VerificationBudget{
		Level:                domain.VerificationTargeted,
		MaxAutomaticCommands: 3,
		AllowFullSuite:       false,
		AllowManualHandoff:   true,
	}
}

func testNewTaskInput() NewTaskInput {
	return NewTaskInput{
		Goal:               "ship governed task",
		Scope:              []string{"application core"},
		OutOfScope:         []string{"host products"},
		AcceptanceCriteria: []string{"task opens at INTAKE"},
		VerificationBudget: testBudget(),
	}
}

func testContract(t *testing.T) domain.Contract {
	t.Helper()
	input := testNewTaskInput()
	contract, err := domain.NewContract(
		input.Goal,
		input.Scope,
		input.OutOfScope,
		input.AcceptanceCriteria,
		input.VerificationBudget,
	)
	if err != nil {
		t.Fatalf("NewContract() error = %v", err)
	}
	return contract
}

func persistedTask(t *testing.T, host domain.Host, contract domain.Contract) domain.Task {
	t.Helper()
	now := testTime()
	binding := testBinding()
	action, err := workflow.BuildNextAction(
		domain.PhaseIntake,
		"task-persisted",
		1,
		binding.BindingDigest,
		"action-persisted",
		now,
	)
	if err != nil {
		t.Fatalf("BuildNextAction() error = %v", err)
	}
	operation := domain.LastOperation{
		OperationID:   "request-persisted",
		Kind:          domain.OperationOpenTask,
		FromRevision:  0,
		ToRevision:    1,
		PayloadDigest: domain.Digest(strings.Repeat("f", 64)),
		CommittedAt:   now,
	}
	task := domain.Task{
		TaskID:        "task-persisted",
		OriginHost:    host,
		Contract:      contract,
		Repository:    binding,
		Phase:         domain.PhaseIntake,
		CurrentAction: &action,
		LastOperation: &operation,
		Evidence:      nil,
		Revision:      1,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := workflow.ValidateTask(task); err != nil {
		t.Fatalf("persisted task is invalid: %v", err)
	}
	return task
}

func terminalTask(t *testing.T, phase domain.Phase) domain.Task {
	t.Helper()
	contract := testContract(t)
	task := persistedTask(t, domain.HostCodex, contract)
	status := domain.TerminalCompleted
	if phase == domain.PhaseCancelled {
		status = domain.TerminalCancelled
	}
	completedAt := task.UpdatedAt
	task.Phase = phase
	task.CurrentAction = nil
	task.LastOperation = nil
	task.CompletedAt = &completedAt
	task.Outcome = &domain.Outcome{
		Status: status,
		Acceptance: []domain.OutcomeCriterion{{
			Criterion: contract.AcceptanceCriteria()[0],
			Status:    domain.CriterionSatisfied,
		}},
		AutomatedEvidenceIDs:         nil,
		ManualEvidenceIDs:            nil,
		UnverifiedItems:              nil,
		Risks:                        []string{"bounded example risk"},
		FinalRepositoryBindingDigest: task.Repository.BindingDigest,
		Summary:                      "terminal result",
		CompletedAt:                  completedAt,
	}
	if err := workflow.ValidateTask(task); err != nil {
		t.Fatalf("terminal task is invalid: %v", err)
	}
	return task
}

func requireError(t *testing.T, err error, target error) {
	t.Helper()
	if !errors.Is(err, target) {
		t.Fatalf("error = %v, want %v", err, target)
	}
}

func requireZeroResult(t *testing.T, result OpenTaskResult) {
	t.Helper()
	if !reflect.DeepEqual(result, OpenTaskResult{}) {
		t.Fatalf("result = %#v, want zero result", result)
	}
}

func fixedWidthItems(prefix string, count, width int) []string {
	items := make([]string, count)
	for i := range items {
		leader := fmt.Sprintf("%s-%02d-", prefix, i)
		items[i] = leader + strings.Repeat("x", width-len(leader))
	}
	return items
}
