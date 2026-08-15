package application

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestOpenTaskCreatesInitialCommittedFact(t *testing.T) {
	taskStore := &recordingStore{
		loadActiveTaskFn: func(context.Context, domain.Digest) (domain.Task, error) {
			return domain.Task{}, store.ErrTaskNotFound
		},
	}
	observer := &fixedRepositoryObserver{binding: testBinding()}
	now := testTime()
	service := newTestService(
		t,
		taskStore,
		observer,
		now,
		"task-created",
		"action-created",
		"event-created",
	)
	input := testNewTaskInput()
	input.Goal = "  ship governed task  "
	input.Scope = []string{"  application core  "}
	input.OutOfScope = []string{" host products "}
	input.AcceptanceCriteria = []string{" task opens at INTAKE "}
	request := OpenTaskRequest{
		RequestID:      "request-open",
		Host:           domain.HostCodex,
		RepositoryPath: "/caller/path/that-is-not-persisted",
		NewTask:        &input,
	}

	result, err := service.OpenTask(context.Background(), request)
	if err != nil {
		t.Fatalf("OpenTask() error = %v", err)
	}
	if !result.Created {
		t.Fatal("OpenTask() Created = false, want true")
	}
	task := result.Task
	if task.TaskID != "task-created" || task.OriginHost != domain.HostCodex ||
		task.Phase != domain.PhaseIntake || task.Revision != 1 {
		t.Fatalf("created task identity/state = %#v", task)
	}
	if task.Contract.Goal() != "ship governed task" ||
		!reflect.DeepEqual(task.Contract.Scope(), []string{"application core"}) ||
		!reflect.DeepEqual(task.Contract.OutOfScope(), []string{"host products"}) ||
		!reflect.DeepEqual(task.Contract.AcceptanceCriteria(), []string{"task opens at INTAKE"}) {
		t.Fatalf("contract was not normalized: %#v", task.Contract)
	}
	if task.CurrentAction == nil || task.CurrentAction.ActionID != "action-created" ||
		task.CurrentAction.Kind != domain.ActionAssessTask {
		t.Fatalf("initial action = %#v", task.CurrentAction)
	}
	expectedAction, buildErr := workflow.BuildNextAction(
		domain.PhaseIntake,
		"task-created",
		1,
		task.Repository.BindingDigest,
		"action-created",
		now,
	)
	if buildErr != nil || !reflect.DeepEqual(*task.CurrentAction, expectedAction) {
		t.Fatalf("initial action differs from workflow authority: got %#v want %#v, error %v", *task.CurrentAction, expectedAction, buildErr)
	}
	if task.CreatedAt != now || task.UpdatedAt != now || task.CurrentAction.IssuedAt != now {
		t.Fatalf("task timestamps do not share one now: %#v", task)
	}
	if task.LastOperation == nil {
		t.Fatal("LastOperation = nil")
	}
	operation := *task.LastOperation
	if operation.OperationID != request.RequestID || operation.Kind != domain.OperationOpenTask ||
		operation.ActionID != nil || operation.FromRevision != 0 || operation.ToRevision != 1 ||
		operation.CommittedAt != now || !operation.PayloadDigest.IsValid() {
		t.Fatalf("LastOperation = %#v", operation)
	}
	if observer.calls != 1 || !reflect.DeepEqual(observer.paths, []string{request.RepositoryPath}) {
		t.Fatalf("observer calls/paths = %d/%#v", observer.calls, observer.paths)
	}
	if taskStore.loadActiveTaskCalls != 1 || taskStore.commitTaskCalls != 1 || len(taskStore.commits) != 1 {
		t.Fatalf("store calls = load active %d, commit %d", taskStore.loadActiveTaskCalls, taskStore.commitTaskCalls)
	}
	mutation := taskStore.commits[0]
	if mutation.ExpectedRevision != 0 || mutation.Claim != store.ClaimAcquire {
		t.Fatalf("mutation CAS/claim = %#v", mutation)
	}
	if mutation.Task.TaskID != task.TaskID || mutation.Task.CurrentAction == nil ||
		mutation.Task.CurrentAction.ActionID != task.CurrentAction.ActionID {
		t.Fatalf("committed task/action = %#v", mutation.Task)
	}
	event := mutation.Event
	if event.EventID != "event-created" || event.TaskID != task.TaskID || event.Revision != 1 ||
		event.Kind != domain.OperationOpenTask || event.PhaseBefore != domain.PhaseIntake ||
		event.PhaseAfter != domain.PhaseIntake || event.ActionID != nil ||
		event.RequestID != request.RequestID || event.PayloadDigest != operation.PayloadDigest ||
		event.CreatedAt != operation.CommittedAt {
		t.Fatalf("committed event = %#v", event)
	}
	expectedDigest, digestErr := digestOpenTaskPayload(
		request.Host,
		observer.binding.RepositoryIdentity,
		task.Contract,
	)
	if digestErr != nil || operation.PayloadDigest != expectedDigest {
		t.Fatalf("payload digest = %s, want %s, error %v", operation.PayloadDigest, expectedDigest, digestErr)
	}
	if strings.Contains(string(operation.PayloadDigest), request.RepositoryPath) {
		t.Fatal("payload digest exposed raw repository path")
	}
}

func TestOpenTaskRejectsInvalidRequestBeforeObservation(t *testing.T) {
	aggregate := testNewTaskInput()
	aggregate.Goal = strings.Repeat("g", domain.MaxGoalBytes)
	aggregate.Scope = fixedWidthItems("scope", domain.MaxScopeItems, domain.MaxScopeItemBytes)
	aggregate.OutOfScope = fixedWidthItems("outside", domain.MaxOutOfScopeItems, domain.MaxOutOfScopeItemBytes)
	aggregate.AcceptanceCriteria = fixedWidthItems(
		"accept",
		domain.MaxAcceptanceCriteriaItems,
		domain.MaxAcceptanceCriterionBytes,
	)

	tests := []struct {
		name      string
		requestID domain.ID
		host      domain.Host
		input     NewTaskInput
	}{
		{name: "unknown host", requestID: "request", host: "other", input: testNewTaskInput()},
		{name: "invalid request ID", requestID: "bad request", host: domain.HostCodex, input: testNewTaskInput()},
		{name: "empty goal", requestID: "request", host: domain.HostCodex, input: func() NewTaskInput { input := testNewTaskInput(); input.Goal = "  "; return input }()},
		{name: "empty acceptance", requestID: "request", host: domain.HostCodex, input: func() NewTaskInput { input := testNewTaskInput(); input.AcceptanceCriteria = nil; return input }()},
		{name: "malformed budget", requestID: "request", host: domain.HostCodex, input: func() NewTaskInput {
			input := testNewTaskInput()
			input.VerificationBudget.Level = "unknown"
			return input
		}()},
		{name: "aggregate limit exceeded", requestID: "request", host: domain.HostCodex, input: aggregate},
		{name: "duplicate scope", requestID: "request", host: domain.HostCodex, input: func() NewTaskInput { input := testNewTaskInput(); input.Scope = []string{"one", " one "}; return input }()},
		{name: "duplicate acceptance", requestID: "request", host: domain.HostCodex, input: func() NewTaskInput {
			input := testNewTaskInput()
			input.AcceptanceCriteria = []string{"one", " one "}
			return input
		}()},
		{name: "invalid UTF-8", requestID: "request", host: domain.HostCodex, input: func() NewTaskInput { input := testNewTaskInput(); input.Goal = string([]byte{0xff}); return input }()},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taskStore := &recordingStore{}
			observer := &fixedRepositoryObserver{binding: testBinding()}
			service := newTestService(t, taskStore, observer, testTime())
			result, err := service.OpenTask(context.Background(), OpenTaskRequest{
				RequestID:      tt.requestID,
				Host:           tt.host,
				RepositoryPath: "/workspace/example",
				NewTask:        &tt.input,
			})
			requireError(t, err, domain.ErrInvalidArgument)
			requireZeroResult(t, result)
			if observer.calls != 0 || taskStore.loadTaskCalls != 0 ||
				taskStore.loadActiveTaskCalls != 0 || taskStore.commitTaskCalls != 0 {
				t.Fatalf("invalid request caused side effects: observer %d, store %#v", observer.calls, taskStore)
			}
		})
	}
}

func TestOpenTaskMapsRepositoryObservationErrorsWithoutStoreMutation(t *testing.T) {
	tests := []struct {
		name   string
		cause  error
		target error
	}{
		{name: "invalid path", cause: repository.ErrInvalidRepositoryPath, target: domain.ErrInvalidArgument},
		{name: "not Git", cause: repository.ErrNotGitRepository, target: domain.ErrNotGitRepository},
		{name: "bounded observation", cause: repository.ErrDirtySubmodule, target: domain.ErrInternal},
		{name: "unexpected output remains private", cause: errors.New("Git failed at /private/caller/path with raw output"), target: domain.ErrInternal},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taskStore := &recordingStore{}
			observer := &fixedRepositoryObserver{err: tt.cause}
			service := newTestService(t, taskStore, observer, testTime())
			input := testNewTaskInput()
			result, err := service.OpenTask(context.Background(), OpenTaskRequest{
				RequestID:      "request-observe",
				Host:           domain.HostCodex,
				RepositoryPath: "/private/caller/path",
				NewTask:        &input,
			})
			requireError(t, err, tt.target)
			requireZeroResult(t, result)
			if taskStore.loadActiveTaskCalls != 0 || taskStore.commitTaskCalls != 0 {
				t.Fatalf("observation failure accessed store: %#v", taskStore)
			}
			if strings.Contains(err.Error(), "/private/caller/path") {
				t.Fatalf("error exposed repository path: %v", err)
			}
		})
	}
}

func TestOpenTaskMapsStoreReadFailuresToClosedErrors(t *testing.T) {
	tests := []struct {
		name   string
		cause  error
		target error
	}{
		{name: "storage unavailable", cause: store.ErrStorageUnavailable, target: domain.ErrStorageUnavailable},
		{name: "schema unsupported", cause: store.ErrSchemaUnsupported, target: domain.ErrSchemaUnsupported},
		{name: "unexpected storage detail", cause: errors.New("SELECT secret FROM /private/task.db"), target: domain.ErrInternal},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taskStore := &recordingStore{
				loadActiveTaskFn: func(context.Context, domain.Digest) (domain.Task, error) {
					return domain.Task{}, tt.cause
				},
			}
			observer := &fixedRepositoryObserver{binding: testBinding()}
			service := newTestService(t, taskStore, observer, testTime())
			input := testNewTaskInput()
			result, err := service.OpenTask(context.Background(), OpenTaskRequest{
				RequestID:      "request-store-error",
				Host:           domain.HostCodex,
				RepositoryPath: "/workspace/example",
				NewTask:        &input,
			})
			requireError(t, err, tt.target)
			requireZeroResult(t, result)
			if taskStore.commitTaskCalls != 0 {
				t.Fatalf("store read failure caused %d commits", taskStore.commitTaskCalls)
			}
			if strings.Contains(err.Error(), "SELECT") || strings.Contains(err.Error(), ".db") {
				t.Fatalf("mapped store error leaked detail: %v", err)
			}
		})
	}
}

func TestOpenTaskPreservesContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	observer := &fixedRepositoryObserver{err: context.Canceled}
	service := newTestService(t, &recordingStore{}, observer, testTime())
	input := testNewTaskInput()
	_, err := service.OpenTask(ctx, OpenTaskRequest{
		RequestID:      "request-cancelled",
		Host:           domain.HostCodex,
		RepositoryPath: "/workspace/example",
		NewTask:        &input,
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("OpenTask() error = %v, want context.Canceled", err)
	}
}

func TestOpenTaskRequiresContractWhenNoActiveTaskExists(t *testing.T) {
	taskStore := &recordingStore{}
	observer := &fixedRepositoryObserver{binding: testBinding()}
	service := newTestService(t, taskStore, observer, testTime())

	result, err := service.OpenTask(context.Background(), OpenTaskRequest{
		RequestID:      "request-resume-missing",
		Host:           domain.HostCodex,
		RepositoryPath: "/workspace/example",
	})
	requireError(t, err, domain.ErrInvalidArgument)
	requireZeroResult(t, result)
	if observer.calls != 1 || taskStore.loadActiveTaskCalls != 1 || taskStore.commitTaskCalls != 0 {
		t.Fatalf("calls = observer %d, load active %d, commit %d", observer.calls, taskStore.loadActiveTaskCalls, taskStore.commitTaskCalls)
	}
}

func TestOpenTaskResumesSameHostWithoutRegeneratingPersistedAction(t *testing.T) {
	contract := testContract(t)
	persisted := persistedTask(t, domain.HostCodex, contract)
	fresh := changeApplicationWorktree(testBinding())

	tests := []struct {
		name  string
		input *NewTaskInput
	}{
		{name: "contract omitted", input: nil},
		{name: "normalized equal contract", input: &NewTaskInput{
			Goal:               "  ship governed task ",
			Scope:              []string{" application core "},
			OutOfScope:         []string{" host products "},
			AcceptanceCriteria: []string{" task opens at INTAKE "},
			VerificationBudget: testBudget(),
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taskStore := &recordingStore{
				loadActiveTaskFn: func(context.Context, domain.Digest) (domain.Task, error) {
					return persisted, nil
				},
				commitTaskFn: func(context.Context, store.TaskMutation) error {
					t.Fatal("resume called CommitTask")
					return nil
				},
			}
			observer := &fixedRepositoryObserver{binding: fresh}
			service, err := newService(taskStore, observer, func() time.Time {
				t.Fatal("resume requested time")
				return testTime()
			}, func(string) (domain.ID, error) {
				t.Fatal("resume generated an ID")
				return "", nil
			})
			if err != nil {
				t.Fatalf("newService() error = %v", err)
			}
			result, openErr := service.OpenTask(context.Background(), OpenTaskRequest{
				RequestID:      "request-resume",
				Host:           domain.HostCodex,
				RepositoryPath: "/workspace/example",
				NewTask:        tt.input,
			})
			if openErr != nil {
				t.Fatalf("OpenTask() error = %v", openErr)
			}
			if result.Created || result.Task.TaskID != persisted.TaskID ||
				result.Task.Revision != persisted.Revision || result.Task.CurrentAction == nil ||
				result.Task.CurrentAction.ActionID != persisted.CurrentAction.ActionID ||
				result.Task.CurrentAction.IssuedAt != persisted.CurrentAction.IssuedAt ||
				result.Task.Repository.BindingDigest != persisted.Repository.BindingDigest {
				t.Fatalf("resumed task changed persisted state: %#v", result)
			}
			if result.Task.Repository.BindingDigest == fresh.BindingDigest {
				t.Fatal("resume replaced persisted binding with fresh observation")
			}
			if taskStore.commitTaskCalls != 0 {
				t.Fatalf("resume commit calls = %d", taskStore.commitTaskCalls)
			}
		})
	}
}

func TestOpenTaskRejectsActiveContractAndHostConflictsWithoutWrites(t *testing.T) {
	contract := testContract(t)
	different := testNewTaskInput()
	different.Goal = "different goal"
	orderedInput := testNewTaskInput()
	orderedInput.Scope = []string{"first", "second"}
	orderedContract, err := domain.NewContract(
		orderedInput.Goal,
		orderedInput.Scope,
		orderedInput.OutOfScope,
		orderedInput.AcceptanceCriteria,
		orderedInput.VerificationBudget,
	)
	if err != nil {
		t.Fatalf("NewContract(ordered) error = %v", err)
	}
	reversedInput := orderedInput
	reversedInput.Scope = []string{"second", "first"}
	tests := []struct {
		name      string
		persisted domain.Task
		host      domain.Host
		input     *NewTaskInput
		target    error
	}{
		{name: "different contract", persisted: persistedTask(t, domain.HostCodex, contract), host: domain.HostCodex, input: &different, target: domain.ErrActiveTaskConflict},
		{name: "different list order", persisted: persistedTask(t, domain.HostCodex, orderedContract), host: domain.HostCodex, input: &reversedInput, target: domain.ErrActiveTaskConflict},
		{name: "different host", persisted: persistedTask(t, domain.HostDeepSeek, contract), host: domain.HostCodex, input: nil, target: domain.ErrHostOwnershipConflict},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taskStore := &recordingStore{
				loadActiveTaskFn: func(context.Context, domain.Digest) (domain.Task, error) { return tt.persisted, nil },
			}
			observer := &fixedRepositoryObserver{binding: testBinding()}
			service := newTestService(t, taskStore, observer, testTime())
			result, err := service.OpenTask(context.Background(), OpenTaskRequest{
				RequestID:      "request-conflict",
				Host:           tt.host,
				RepositoryPath: "/workspace/secret-contract",
				NewTask:        tt.input,
			})
			requireError(t, err, tt.target)
			requireZeroResult(t, result)
			if taskStore.commitTaskCalls != 0 {
				t.Fatalf("conflict commit calls = %d", taskStore.commitTaskCalls)
			}
			if strings.Contains(err.Error(), "different goal") || strings.Contains(err.Error(), "/workspace/secret-contract") {
				t.Fatalf("conflict error exposed task content: %v", err)
			}
		})
	}
}

func TestOpenTaskCreationRaceReconcilesSingleWinner(t *testing.T) {
	contract := testContract(t)
	sameWinner := persistedTask(t, domain.HostCodex, contract)
	differentInput := testNewTaskInput()
	differentInput.Goal = "different winner contract"
	differentContract, err := domain.NewContract(
		differentInput.Goal,
		differentInput.Scope,
		differentInput.OutOfScope,
		differentInput.AcceptanceCriteria,
		differentInput.VerificationBudget,
	)
	if err != nil {
		t.Fatalf("NewContract(different) error = %v", err)
	}

	tests := []struct {
		name   string
		winner domain.Task
		target error
	}{
		{name: "same host and contract resumes winner", winner: sameWinner},
		{name: "different contract conflicts", winner: persistedTask(t, domain.HostCodex, differentContract), target: domain.ErrActiveTaskConflict},
		{name: "different host conflicts", winner: persistedTask(t, domain.HostDeepSeek, contract), target: domain.ErrHostOwnershipConflict},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			loads := 0
			taskStore := &recordingStore{
				loadActiveTaskFn: func(context.Context, domain.Digest) (domain.Task, error) {
					loads++
					if loads == 1 {
						return domain.Task{}, store.ErrTaskNotFound
					}
					return tt.winner, nil
				},
				commitTaskFn: func(context.Context, store.TaskMutation) error {
					return store.ErrActiveTaskConflict
				},
			}
			observer := &fixedRepositoryObserver{binding: testBinding()}
			service := newTestService(
				t,
				taskStore,
				observer,
				testTime(),
				"task-loser",
				"action-loser",
				"event-loser",
			)
			input := testNewTaskInput()
			result, openErr := service.OpenTask(context.Background(), OpenTaskRequest{
				RequestID:      "request-race",
				Host:           domain.HostCodex,
				RepositoryPath: "/workspace/example",
				NewTask:        &input,
			})
			if tt.target == nil {
				if openErr != nil {
					t.Fatalf("OpenTask() error = %v", openErr)
				}
				if result.Created || result.Task.TaskID != tt.winner.TaskID || result.Task.CurrentAction == nil ||
					result.Task.CurrentAction.ActionID != tt.winner.CurrentAction.ActionID {
					t.Fatalf("race result = %#v", result)
				}
			} else {
				requireError(t, openErr, tt.target)
				requireZeroResult(t, result)
			}
			if taskStore.commitTaskCalls != 1 || taskStore.loadActiveTaskCalls != 2 {
				t.Fatalf("race calls = commit %d, loads %d", taskStore.commitTaskCalls, taskStore.loadActiveTaskCalls)
			}
		})
	}
}
