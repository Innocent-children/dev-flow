package application

import (
	"context"
	"reflect"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func TestGetTaskReturnsAuthoritativeCloneWithoutWritesOrObservation(t *testing.T) {
	persisted := persistedTask(t, domain.HostCodex, testContract(t))
	taskStore := &recordingStore{
		loadTaskFn: func(_ context.Context, taskID domain.ID) (domain.Task, error) {
			if taskID != persisted.TaskID {
				t.Fatalf("LoadTask() task ID = %q, want %q", taskID, persisted.TaskID)
			}
			return persisted, nil
		},
		commitTaskFn: func(context.Context, store.TaskMutation) error {
			t.Fatal("GetTask called CommitTask")
			return nil
		},
	}
	observer := &fixedRepositoryObserver{binding: testBinding()}
	service := newTestService(t, taskStore, observer, testTime())

	request := GetTaskRequest{Host: domain.HostCodex, TaskID: persisted.TaskID}
	first, err := service.GetTask(context.Background(), request)
	if err != nil {
		t.Fatalf("GetTask() error = %v", err)
	}
	if !reflect.DeepEqual(first.Task, persisted) || first.RecoveryAssessment != nil {
		t.Fatalf("GetTask() = %#v, want persisted %#v", first, persisted)
	}
	first.Task.Repository.Branch = nil
	first.Task.CurrentAction.AllowedEffects[0] = domain.EffectEditRepositoryFiles
	first.Task.CurrentAction.RequiredEvidence[0].Required = false
	first.Task.Evidence = append(first.Task.Evidence, domain.EvidenceSummary{EvidenceID: "mutated"})
	first.Task.LastOperation.OperationID = "mutated"

	second, err := service.GetTask(context.Background(), request)
	if err != nil {
		t.Fatalf("second GetTask() error = %v", err)
	}
	if !reflect.DeepEqual(second.Task, persisted) || second.RecoveryAssessment != nil {
		t.Fatalf("second GetTask() observed returned-object mutations: %#v", second)
	}
	if second.Task.Revision != persisted.Revision || second.Task.Phase != persisted.Phase ||
		second.Task.Repository.BindingDigest != persisted.Repository.BindingDigest ||
		second.Task.CurrentAction.ActionID != persisted.CurrentAction.ActionID ||
		!reflect.DeepEqual(second.Task.Blocker, persisted.Blocker) {
		t.Fatalf("read changed authoritative fields: %#v", second)
	}
	if taskStore.loadTaskCalls != 2 || taskStore.commitTaskCalls != 0 || observer.calls != 0 {
		t.Fatalf("read side effects = loads %d, commits %d, observations %d", taskStore.loadTaskCalls, taskStore.commitTaskCalls, observer.calls)
	}
}

func TestGetTaskRejectsDifferentHostAndMissingTask(t *testing.T) {
	persisted := persistedTask(t, domain.HostDeepSeek, testContract(t))
	tests := []struct {
		name   string
		load   func(context.Context, domain.ID) (domain.Task, error)
		target error
	}{
		{name: "different host", load: func(context.Context, domain.ID) (domain.Task, error) { return persisted, nil }, target: domain.ErrHostOwnershipConflict},
		{name: "missing task", load: func(context.Context, domain.ID) (domain.Task, error) { return domain.Task{}, store.ErrTaskNotFound }, target: domain.ErrTaskNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taskStore := &recordingStore{loadTaskFn: tt.load}
			observer := &fixedRepositoryObserver{binding: testBinding()}
			service := newTestService(t, taskStore, observer, testTime())
			task, err := service.GetTask(context.Background(), GetTaskRequest{Host: domain.HostCodex, TaskID: "task-persisted"})
			requireError(t, err, tt.target)
			if !reflect.DeepEqual(task, GetTaskResult{}) {
				t.Fatalf("GetTask() leaked task = %#v", task)
			}
			if taskStore.commitTaskCalls != 0 || observer.calls != 0 {
				t.Fatalf("failed read caused side effects: commits %d, observations %d", taskStore.commitTaskCalls, observer.calls)
			}
		})
	}
}

func TestGetTaskValidatesRequestBeforeStoreAccess(t *testing.T) {
	tests := []struct {
		name   string
		ctx    context.Context
		host   domain.Host
		taskID domain.ID
	}{
		{name: "nil context", host: domain.HostCodex, taskID: "task", ctx: nil},
		{name: "unknown host", host: "unknown", taskID: "task", ctx: context.Background()},
		{name: "invalid task ID", host: domain.HostCodex, taskID: "bad task", ctx: context.Background()},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taskStore := &recordingStore{}
			observer := &fixedRepositoryObserver{binding: testBinding()}
			service := newTestService(t, taskStore, observer, testTime())
			_, err := service.GetTask(tt.ctx, GetTaskRequest{Host: tt.host, TaskID: tt.taskID})
			requireError(t, err, domain.ErrInvalidArgument)
			if taskStore.loadTaskCalls != 0 || observer.calls != 0 {
				t.Fatalf("invalid read accessed dependencies: %#v / %d", taskStore, observer.calls)
			}
		})
	}
}
