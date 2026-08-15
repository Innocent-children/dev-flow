package application

import (
	"context"
	"errors"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func TestCancelTaskCreatesTerminalOutcomeAndReleasesClaim(t *testing.T) {
	ctx := context.Background()
	repositoryRoot := newCommittedApplicationRepository(t)
	databasePath := filepath.Join(t.TempDir(), "cancel.db")
	taskStore, err := store.Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("store.Open() error = %v", err)
	}
	t.Cleanup(func() { _ = taskStore.Close() })

	clock := &deterministicApplicationClock{next: time.Date(2026, time.August, 15, 12, 0, 0, 0, time.UTC)}
	service, err := newService(taskStore, repository.NewGitObserver(), clock.Now, sequentialApplicationIDs())
	if err != nil {
		t.Fatalf("newService() error = %v", err)
	}
	opened, err := service.OpenTask(ctx, OpenTaskRequest{
		RequestID:      "request-open-cancel",
		Host:           domain.HostCodex,
		RepositoryPath: repositoryRoot,
		NewTask: &NewTaskInput{
			Goal:               "cancel a governed task",
			AcceptanceCriteria: []string{"first criterion", "second criterion"},
			VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 2, AllowManualHandoff: true},
		},
	})
	if err != nil {
		t.Fatalf("OpenTask() error = %v", err)
	}
	before := opened.Task
	result, err := service.CancelTask(ctx, CancelTaskRequest{
		RequestID:        "request-cancel",
		Host:             domain.HostCodex,
		TaskID:           before.TaskID,
		ExpectedRevision: before.Revision,
		Reason:           "  user cancelled this bounded task  ",
	})
	if err != nil {
		t.Fatalf("CancelTask() error = %v", err)
	}
	task := result.Task
	if task.Phase != domain.PhaseCancelled || task.Revision != before.Revision+1 ||
		task.CurrentAction != nil || task.Blocker != nil || task.ResumePhase != nil ||
		task.CompletedAt == nil || task.Outcome == nil {
		t.Fatalf("cancelled task = %#v", task)
	}
	if task.Outcome.Status != domain.TerminalCancelled || task.Outcome.Summary != "user cancelled this bounded task" ||
		!reflect.DeepEqual(task.Outcome.UnverifiedItems, before.Contract.AcceptanceCriteria()) ||
		!reflect.DeepEqual(task.Outcome.Risks, []string{"user cancelled this bounded task"}) ||
		task.Outcome.FinalRepositoryBindingDigest != before.Repository.BindingDigest {
		t.Fatalf("cancelled outcome = %#v", task.Outcome)
	}
	if len(task.Outcome.Acceptance) != len(before.Contract.AcceptanceCriteria()) {
		t.Fatalf("cancelled acceptance = %#v", task.Outcome.Acceptance)
	}
	for i, criterion := range task.Outcome.Acceptance {
		if criterion.Criterion != before.Contract.AcceptanceCriteria()[i] || criterion.Status != domain.CriterionUnverified {
			t.Fatalf("cancelled criterion = %#v", criterion)
		}
	}
	if !reflect.DeepEqual(task.Evidence, before.Evidence) || task.Repository.BindingDigest != before.Repository.BindingDigest {
		t.Fatal("cancellation changed retained evidence or repository binding")
	}
	if _, err := taskStore.LoadActiveTask(ctx, before.Repository.RepositoryIdentity); !errors.Is(err, store.ErrTaskNotFound) {
		t.Fatalf("cancelled repository claim remains: %v", err)
	}
	persisted, err := taskStore.LoadTask(ctx, before.TaskID)
	if err != nil || persisted.Phase != domain.PhaseCancelled || persisted.Revision != task.Revision {
		t.Fatalf("cancelled task history was not retained: %#v, %v", persisted, err)
	}
	requireJourneyCommittedFact(t, databasePath, task)
}

func TestCancelTaskRetainsEvidenceReferencesAndCommittedFact(t *testing.T) {
	automated := applicationEvidence("evidence-auto", domain.EvidenceSourceAutomated, 1)
	manual := applicationEvidence("evidence-user", domain.EvidenceSourceUser, 0)
	task := applicationTaskAtPhase(t, domain.PhaseVerify, 5, testContract(t), []domain.EvidenceSummary{automated, manual})
	taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }}
	observer := &fixedRepositoryObserver{binding: task.Repository}
	now := testTime().Add(time.Hour)
	service := newTestService(t, taskStore, observer, now, "event-cancel")

	result, err := service.CancelTask(context.Background(), CancelTaskRequest{
		RequestID: "request-cancel", Host: domain.HostCodex, TaskID: task.TaskID,
		ExpectedRevision: task.Revision, Reason: "stop requested",
	})
	if err != nil {
		t.Fatalf("CancelTask() error = %v", err)
	}
	cancelled := result.Task
	if !reflect.DeepEqual(cancelled.Evidence, task.Evidence) ||
		!reflect.DeepEqual(cancelled.Outcome.AutomatedEvidenceIDs, []domain.ID{automated.EvidenceID}) ||
		!reflect.DeepEqual(cancelled.Outcome.ManualEvidenceIDs, []domain.ID{manual.EvidenceID}) {
		t.Fatalf("retained evidence/outcome = %#v / %#v", cancelled.Evidence, cancelled.Outcome)
	}
	if taskStore.commitTaskCalls != 1 || observer.calls != 0 {
		t.Fatalf("cancel calls = commits %d observations %d", taskStore.commitTaskCalls, observer.calls)
	}
	mutation := taskStore.commits[0]
	if mutation.ExpectedRevision != task.Revision || mutation.Claim != store.ClaimRelease ||
		mutation.Event.Kind != domain.OperationCancelTask || mutation.Event.ActionID != nil ||
		mutation.Event.PhaseBefore != task.Phase || mutation.Event.PhaseAfter != domain.PhaseCancelled ||
		cancelled.LastOperation == nil || cancelled.LastOperation.Kind != domain.OperationCancelTask ||
		cancelled.LastOperation.ActionID != nil || mutation.Event.RequestID != cancelled.LastOperation.OperationID ||
		mutation.Event.PayloadDigest != cancelled.LastOperation.PayloadDigest ||
		!mutation.Event.CreatedAt.Equal(cancelled.LastOperation.CommittedAt) || cancelled.UpdatedAt != now {
		t.Fatalf("cancellation committed fact = %#v / %#v", mutation, cancelled.LastOperation)
	}
}

func TestCancelTaskAllowsBlockedTask(t *testing.T) {
	task := applicationBlockedTask(t)
	taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }}
	observer := &fixedRepositoryObserver{binding: task.Repository}
	service := newTestService(t, taskStore, observer, testTime().Add(time.Hour), "event-cancel-blocked")
	result, err := service.CancelTask(context.Background(), CancelTaskRequest{
		RequestID: "request-cancel-blocked", Host: task.OriginHost, TaskID: task.TaskID,
		ExpectedRevision: task.Revision, Reason: "cancel blocked task",
	})
	if err != nil {
		t.Fatalf("CancelTask() error = %v", err)
	}
	if result.Task.Phase != domain.PhaseCancelled || result.Task.Blocker != nil || result.Task.ResumePhase != nil || result.Task.CurrentAction != nil {
		t.Fatalf("cancelled blocked task = %#v", result.Task)
	}
}

func TestCancelTaskAllowsEveryNormalNonterminalPhase(t *testing.T) {
	phases := []domain.Phase{
		domain.PhaseIntake,
		domain.PhaseAssess,
		domain.PhasePlan,
		domain.PhaseImplement,
		domain.PhaseVerify,
		domain.PhaseReview,
		domain.PhaseHandoff,
	}
	for index, phase := range phases {
		t.Run(string(phase), func(t *testing.T) {
			task := applicationTaskAtPhase(t, phase, uint64(index+1), testContract(t), nil)
			taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }}
			observer := &fixedRepositoryObserver{binding: task.Repository}
			service := newTestService(t, taskStore, observer, testTime().Add(time.Hour), domain.ID("event-cancel-"+strings.ToLower(string(phase))))
			result, err := service.CancelTask(context.Background(), CancelTaskRequest{
				RequestID: domain.ID("request-cancel-" + strings.ToLower(string(phase))), Host: task.OriginHost,
				TaskID: task.TaskID, ExpectedRevision: task.Revision, Reason: "cancel normal phase",
			})
			if err != nil || result.Task.Phase != domain.PhaseCancelled || result.Task.Revision != task.Revision+1 {
				t.Fatalf("CancelTask(%s) = %#v, %v", phase, result, err)
			}
			if observer.calls != 0 || taskStore.commits[0].Claim != store.ClaimRelease {
				t.Fatalf("CancelTask(%s) observation/claim = %d/%s", phase, observer.calls, taskStore.commits[0].Claim)
			}
		})
	}
}

func TestCancelTaskRejectsInvalidOwnershipRevisionAndTerminalState(t *testing.T) {
	normal := applicationTaskAtPhase(t, domain.PhaseAssess, 2, testContract(t), nil)
	tests := []struct {
		name   string
		task   domain.Task
		mutate func(*CancelTaskRequest)
		target error
	}{
		{name: "wrong host", task: normal, mutate: func(r *CancelTaskRequest) { r.Host = domain.HostDeepSeek }, target: domain.ErrHostOwnershipConflict},
		{name: "stale revision", task: normal, mutate: func(r *CancelTaskRequest) { r.ExpectedRevision++ }, target: domain.ErrRevisionConflict},
		{name: "done", task: terminalTask(t, domain.PhaseDone), target: domain.ErrTaskTerminal},
		{name: "cancelled", task: terminalTask(t, domain.PhaseCancelled), target: domain.ErrTaskTerminal},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return tt.task.Clone(), nil }}
			observer := &fixedRepositoryObserver{binding: tt.task.Repository}
			service := newTestService(t, taskStore, observer, testTime())
			request := CancelTaskRequest{RequestID: "request-cancel", Host: domain.HostCodex, TaskID: tt.task.TaskID, ExpectedRevision: tt.task.Revision, Reason: "stop task"}
			if tt.mutate != nil {
				tt.mutate(&request)
			}
			result, err := service.CancelTask(context.Background(), request)
			requireError(t, err, tt.target)
			if !reflect.DeepEqual(result, CancelTaskResult{}) || taskStore.commitTaskCalls != 0 || observer.calls != 0 {
				t.Fatalf("failed cancellation side effects = %#v/%d/%d", result, taskStore.commitTaskCalls, observer.calls)
			}
		})
	}
}

func TestCancelTaskRejectsInvalidRequestBeforeStoreAccess(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*CancelTaskRequest)
	}{
		{name: "request ID", mutate: func(r *CancelTaskRequest) { r.RequestID = "bad request" }},
		{name: "host", mutate: func(r *CancelTaskRequest) { r.Host = "other" }},
		{name: "task ID", mutate: func(r *CancelTaskRequest) { r.TaskID = "bad task" }},
		{name: "revision", mutate: func(r *CancelTaskRequest) { r.ExpectedRevision = 0 }},
		{name: "empty reason", mutate: func(r *CancelTaskRequest) { r.Reason = " " }},
		{name: "long reason", mutate: func(r *CancelTaskRequest) { r.Reason = strings.Repeat("x", domain.MaxReasonBytes+1) }},
		{name: "invalid UTF-8", mutate: func(r *CancelTaskRequest) { r.Reason = string([]byte{0xff}) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taskStore := &recordingStore{}
			observer := &fixedRepositoryObserver{binding: testBinding()}
			service := newTestService(t, taskStore, observer, testTime())
			request := CancelTaskRequest{RequestID: "request", Host: domain.HostCodex, TaskID: "task", ExpectedRevision: 1, Reason: "stop task"}
			tt.mutate(&request)
			_, err := service.CancelTask(context.Background(), request)
			requireError(t, err, domain.ErrInvalidArgument)
			if taskStore.loadTaskCalls != 0 || taskStore.commitTaskCalls != 0 || observer.calls != 0 {
				t.Fatalf("invalid cancellation calls = %#v/%d", taskStore, observer.calls)
			}
		})
	}
}

func TestCancelTaskMapsStoreConflictWithoutRepositoryObservation(t *testing.T) {
	task := applicationTaskAtPhase(t, domain.PhaseAssess, 2, testContract(t), nil)
	taskStore := &recordingStore{
		loadTaskFn:   func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil },
		commitTaskFn: func(context.Context, store.TaskMutation) error { return store.ErrRevisionConflict },
	}
	observer := &fixedRepositoryObserver{binding: task.Repository}
	service := newTestService(t, taskStore, observer, testTime().Add(time.Hour), "event-cancel")
	_, err := service.CancelTask(context.Background(), CancelTaskRequest{
		RequestID: "request", Host: task.OriginHost, TaskID: task.TaskID,
		ExpectedRevision: task.Revision, Reason: "stop task",
	})
	requireError(t, err, domain.ErrRevisionConflict)
	if observer.calls != 0 || taskStore.commitTaskCalls != 1 {
		t.Fatalf("store conflict calls = observation %d commit %d", observer.calls, taskStore.commitTaskCalls)
	}
}

func TestCancelTaskIDGenerationFailureNeverCommits(t *testing.T) {
	task := applicationTaskAtPhase(t, domain.PhaseAssess, 2, testContract(t), nil)
	taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }}
	observer := &fixedRepositoryObserver{binding: task.Repository}
	service, err := newService(
		taskStore,
		observer,
		func() time.Time { return testTime().Add(time.Hour) },
		func(string) (domain.ID, error) { return "", errors.New("entropy unavailable") },
	)
	if err != nil {
		t.Fatalf("newService() error = %v", err)
	}
	_, err = service.CancelTask(context.Background(), CancelTaskRequest{
		RequestID: "request", Host: task.OriginHost, TaskID: task.TaskID,
		ExpectedRevision: task.Revision, Reason: "stop task",
	})
	requireError(t, err, domain.ErrInternal)
	if taskStore.commitTaskCalls != 0 || observer.calls != 0 {
		t.Fatalf("ID failure caused commit/observation = %d/%d", taskStore.commitTaskCalls, observer.calls)
	}
}

func TestFailedCancellationLeavesRealClaimAndHistoryIntact(t *testing.T) {
	ctx := context.Background()
	repositoryRoot := newCommittedApplicationRepository(t)
	databasePath := filepath.Join(t.TempDir(), "failed-cancel.db")
	taskStore, err := store.Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("store.Open() error = %v", err)
	}
	t.Cleanup(func() { _ = taskStore.Close() })
	service, err := newService(taskStore, repository.NewGitObserver(), func() time.Time { return testTime() }, sequentialApplicationIDs())
	if err != nil {
		t.Fatalf("newService() error = %v", err)
	}
	opened, err := service.OpenTask(ctx, OpenTaskRequest{
		RequestID: "request-open", Host: domain.HostCodex, RepositoryPath: repositoryRoot,
		NewTask: &NewTaskInput{Goal: "goal", AcceptanceCriteria: []string{"criterion"}, VerificationBudget: testBudget()},
	})
	if err != nil {
		t.Fatalf("OpenTask() error = %v", err)
	}
	before := opened.Task
	_, err = service.CancelTask(ctx, CancelTaskRequest{
		RequestID: "request-stale-cancel", Host: before.OriginHost, TaskID: before.TaskID,
		ExpectedRevision: before.Revision + 1, Reason: "stale cancellation",
	})
	requireError(t, err, domain.ErrRevisionConflict)
	after, err := taskStore.LoadTask(ctx, before.TaskID)
	if err != nil || after.Revision != before.Revision || after.Phase != before.Phase ||
		after.Repository.BindingDigest != before.Repository.BindingDigest ||
		after.CurrentAction == nil || before.CurrentAction == nil ||
		after.CurrentAction.ActionID != before.CurrentAction.ActionID ||
		!after.Contract.Equal(before.Contract) || len(after.Evidence) != len(before.Evidence) ||
		after.Outcome != nil || after.CompletedAt != nil {
		t.Fatalf("failed cancellation changed task: %#v, error %v", after, err)
	}
	requireActiveClaim(t, ctx, taskStore, before)
	requireJourneyCommittedFact(t, databasePath, before)
}

func applicationEvidence(id domain.ID, source domain.EvidenceSource, commands int) domain.EvidenceSummary {
	return domain.EvidenceSummary{
		EvidenceID: id, Source: source, Name: string(id), Status: domain.EvidencePassed,
		Summary: "bounded evidence", Digest: domain.Digest(strings.Repeat("8", 64)),
		CommandCount: commands, RecordedAt: testTime(),
	}
}
