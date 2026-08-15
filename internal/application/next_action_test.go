package application

import (
	"context"
	"reflect"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func TestGetNextActionReturnsStablePersistedCloneWithoutSideEffects(t *testing.T) {
	persisted := persistedTask(t, domain.HostCodex, testContract(t))
	taskStore := &recordingStore{
		loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return persisted, nil },
		commitTaskFn: func(context.Context, store.TaskMutation) error {
			t.Fatal("GetNextAction called CommitTask")
			return nil
		},
	}
	observer := &fixedRepositoryObserver{binding: testBinding()}
	service := newTestService(t, taskStore, observer, testTime())

	request := GetNextActionRequest{Host: domain.HostCodex, TaskID: persisted.TaskID}
	first, err := service.GetNextAction(context.Background(), request)
	if err != nil {
		t.Fatalf("GetNextAction() error = %v", err)
	}
	if first.Action == nil || first.Outcome != nil || first.TaskID != persisted.TaskID ||
		first.Phase != persisted.Phase || first.Revision != persisted.Revision {
		t.Fatalf("GetNextAction() = %#v", first)
	}
	if !reflect.DeepEqual(*first.Action, *persisted.CurrentAction) {
		t.Fatalf("GetNextAction() action = %#v, want persisted %#v", *first.Action, *persisted.CurrentAction)
	}
	first.Action.ActionID = "mutated-action"
	first.Action.AllowedEffects[0] = domain.EffectEditRepositoryFiles
	first.Action.RequiredEvidence[0].Required = false

	second, err := service.GetNextAction(context.Background(), request)
	if err != nil {
		t.Fatalf("second GetNextAction() error = %v", err)
	}
	if second.Action == nil || second.Outcome != nil ||
		second.Action.ActionID != persisted.CurrentAction.ActionID ||
		second.Action.Kind != persisted.CurrentAction.Kind ||
		second.Action.IssuedAt != persisted.CurrentAction.IssuedAt ||
		second.Action.RepositoryBindingDigest != persisted.Repository.BindingDigest ||
		second.Revision != persisted.Revision || second.Phase != persisted.Phase ||
		!reflect.DeepEqual(*second.Action, *persisted.CurrentAction) {
		t.Fatalf("repeated action read was not stable: %#v", second)
	}
	if taskStore.loadTaskCalls != 2 || taskStore.commitTaskCalls != 0 || observer.calls != 0 {
		t.Fatalf("next-action side effects = loads %d, commits %d, observations %d", taskStore.loadTaskCalls, taskStore.commitTaskCalls, observer.calls)
	}
}

func TestGetNextActionRejectsDifferentHostAndMissingTask(t *testing.T) {
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
			result, err := service.GetNextAction(context.Background(), GetNextActionRequest{Host: domain.HostCodex, TaskID: "task-persisted"})
			requireError(t, err, tt.target)
			if !reflect.DeepEqual(result, NextActionResult{}) {
				t.Fatalf("GetNextAction() leaked result = %#v", result)
			}
			if taskStore.commitTaskCalls != 0 || observer.calls != 0 {
				t.Fatalf("failed next-action read caused side effects: commits %d, observations %d", taskStore.commitTaskCalls, observer.calls)
			}
		})
	}
}

func TestGetNextActionReturnsPersistedTerminalOutcome(t *testing.T) {
	for _, phase := range []domain.Phase{domain.PhaseDone, domain.PhaseCancelled} {
		t.Run(string(phase), func(t *testing.T) {
			persisted := terminalTask(t, phase)
			taskStore := &recordingStore{
				loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return persisted, nil },
			}
			observer := &fixedRepositoryObserver{binding: testBinding()}
			service := newTestService(t, taskStore, observer, testTime())

			request := GetNextActionRequest{Host: domain.HostCodex, TaskID: persisted.TaskID}
			first, err := service.GetNextAction(context.Background(), request)
			if err != nil {
				t.Fatalf("GetNextAction() error = %v", err)
			}
			if first.Action != nil || first.Outcome == nil || first.Phase != phase ||
				!reflect.DeepEqual(*first.Outcome, *persisted.Outcome) {
				t.Fatalf("terminal result = %#v", first)
			}
			first.Outcome.Summary = "mutated"
			first.Outcome.Risks[0] = "mutated"
			first.Outcome.Acceptance[0].Criterion = "mutated"

			second, err := service.GetNextAction(context.Background(), request)
			if err != nil {
				t.Fatalf("second GetNextAction() error = %v", err)
			}
			if second.Action != nil || second.Outcome == nil ||
				!reflect.DeepEqual(*second.Outcome, *persisted.Outcome) {
				t.Fatalf("terminal outcome retained mutable alias: %#v", second)
			}
			if taskStore.commitTaskCalls != 0 || observer.calls != 0 {
				t.Fatalf("terminal read side effects = commits %d, observations %d", taskStore.commitTaskCalls, observer.calls)
			}
		})
	}
}

func TestGetNextActionValidatesRequestBeforeStoreAccess(t *testing.T) {
	taskStore := &recordingStore{}
	observer := &fixedRepositoryObserver{binding: testBinding()}
	service := newTestService(t, taskStore, observer, testTime())
	_, err := service.GetNextAction(context.Background(), GetNextActionRequest{Host: "unknown", TaskID: "task"})
	requireError(t, err, domain.ErrInvalidArgument)
	if taskStore.loadTaskCalls != 0 || observer.calls != 0 {
		t.Fatalf("invalid next-action request accessed dependencies: %#v / %d", taskStore, observer.calls)
	}
}
