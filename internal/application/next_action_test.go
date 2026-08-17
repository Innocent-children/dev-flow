package application

import (
	"context"
	"reflect"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func TestGetNextActionExactOperationProbeAfterReopen(t *testing.T) {
	fixture := newReopenedCommittedOperationFixture(t, "operation-next-action-reopen")
	result, err := fixture.service.GetNextAction(context.Background(), GetNextActionRequest{
		Host: fixture.source.OriginHost, TaskID: fixture.source.TaskID, OperationProbe: fixture.probe,
	})
	if err != nil {
		t.Fatalf("GetNextAction exact probe after reopen: %v", err)
	}
	assessment := result.RecoveryAssessment
	last := fixture.committed.LastOperation
	if result.TaskID != fixture.source.TaskID || result.Revision != fixture.source.Revision+1 ||
		result.Phase != domain.PhaseAssess || result.Action == nil ||
		result.Action.Kind != domain.ActionPlanChange || result.Action.ActionID != fixture.committed.CurrentAction.ActionID ||
		result.Action.RepositoryBindingDigest != fixture.committed.Repository.BindingDigest || last == nil {
		t.Fatalf("GetNextAction reopened projection = %#v", result)
	}
	if last.OperationID != fixture.request.RequestID || last.ActionID == nil ||
		*last.ActionID != fixture.request.ActionID || last.FromRevision != fixture.source.Revision ||
		last.ToRevision != fixture.source.Revision+1 || last.PayloadDigest == "" || last.CommittedAt.IsZero() {
		t.Fatalf("GetNextAction committed LastOperation = %#v", last)
	}
	if assessment == nil || assessment.Classification != domain.RecoveryCompletedAndRecorded ||
		assessment.Operation.OperationID != fixture.request.RequestID ||
		assessment.Operation.SourcePhase != fixture.source.Phase ||
		assessment.Operation.ExpectedRevision != fixture.source.Revision ||
		assessment.Operation.ActionID != fixture.request.ActionID ||
		assessment.Operation.ActionKind != fixture.request.ActionKind ||
		assessment.TaskRevision != fixture.committed.Revision ||
		assessment.OperationPayloadDigest != last.PayloadDigest ||
		assessment.LastOperationRelation != recovery.LastOperationExact ||
		assessment.CurrentActionID == nil || *assessment.CurrentActionID != result.Action.ActionID ||
		assessment.CommittedProof == nil ||
		assessment.CommittedProof.OperationID != fixture.request.RequestID ||
		assessment.CommittedProof.ActionID != fixture.request.ActionID ||
		assessment.CommittedProof.FromRevision != fixture.source.Revision ||
		assessment.CommittedProof.ToRevision != fixture.source.Revision+1 ||
		assessment.CommittedProof.PayloadDigest != last.PayloadDigest ||
		!assessment.CommittedProof.CommittedAt.Equal(last.CommittedAt) {
		t.Fatalf("GetNextAction reopened recovery assessment = %#v", assessment)
	}
}

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
