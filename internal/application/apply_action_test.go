package application

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestApplyActionPreCommitFailureIsZeroWriteAndReadsNotStarted(t *testing.T) {
	ctx := context.Background()
	repositoryRoot := newCommittedApplicationRepository(t)
	databasePath := filepath.Join(t.TempDir(), "pre-commit-failure.db")
	taskStore, err := store.Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("open pre_commit store: %v", err)
	}
	closed := false
	t.Cleanup(func() {
		if !closed {
			_ = taskStore.Close()
		}
	})
	clock := &deterministicApplicationClock{next: time.Date(2026, time.August, 17, 10, 0, 0, 0, time.UTC)}
	service, err := newService(taskStore, repository.NewGitObserver(), clock.Now, sequentialApplicationIDs())
	if err != nil {
		t.Fatalf("construct pre_commit setup service: %v", err)
	}
	opened, err := service.OpenTask(ctx, OpenTaskRequest{
		RequestID:      "request-pre-commit-open",
		Host:           domain.HostCodex,
		RepositoryPath: repositoryRoot,
		NewTask: &NewTaskInput{
			Goal:               "prove pre-commit failure is zero write",
			Scope:              []string{"application transaction boundary"},
			OutOfScope:         []string{"automatic retry"},
			AcceptanceCriteria: []string{"exact read reports not_started without persistence changes"},
			VerificationBudget: testBudget(),
		},
	})
	if err != nil {
		t.Fatalf("open pre_commit task: %v", err)
	}
	source := opened.Task
	beforeCounts := readApplicationPersistenceCounts(t, databasePath, source.TaskID)
	payload := workflow.AssessTaskPayload{
		Result:                         domain.ActionResultSucceeded,
		Summary:                        "this result must not commit",
		VerificationBudgetAcknowledged: true,
	}
	request := applyRequestForTask(source, "operation-pre-commit-failure", payload)
	failingStore := &preCommitFailingStore{delegate: taskStore, failure: store.ErrStorageUnavailable}
	failingService, err := newService(
		failingStore,
		repository.NewGitObserver(),
		clock.Now,
		sequentialApplicationIDs(),
	)
	if err != nil {
		t.Fatalf("construct pre_commit failing service: %v", err)
	}
	result, err := failingService.ApplyAction(ctx, request)
	requireError(t, err, domain.ErrStorageUnavailable)
	if !reflect.DeepEqual(result, ApplyActionResult{}) || failingStore.commitAttempts != 1 {
		t.Fatalf("pre_commit result/attempts = %#v/%d", result, failingStore.commitAttempts)
	}
	if err := taskStore.Close(); err != nil {
		t.Fatalf("close pre_commit source store: %v", err)
	}
	closed = true

	reopenedStore, err := store.Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("reopen pre_commit store: %v", err)
	}
	t.Cleanup(func() { _ = reopenedStore.Close() })
	reopenedService, err := NewService(reopenedStore, repository.NewGitObserver())
	if err != nil {
		t.Fatalf("recreate pre_commit service: %v", err)
	}
	probe := &OperationProbe{
		OperationID:             request.RequestID,
		SourcePhase:             source.Phase,
		ExpectedRevision:        request.ExpectedRevision,
		ActionID:                request.ActionID,
		ActionKind:              request.ActionKind,
		RepositoryBindingDigest: request.RepositoryBindingDigest,
		Payload:                 nil,
	}
	read, err := reopenedService.GetTask(ctx, GetTaskRequest{
		Host: source.OriginHost, TaskID: source.TaskID, OperationProbe: probe,
	})
	if err != nil {
		t.Fatalf("read pre_commit recovery authority: %v", err)
	}
	if !reflect.DeepEqual(read.Task, source) || read.RecoveryAssessment == nil ||
		read.RecoveryAssessment.Classification != domain.RecoveryNotStarted ||
		!read.RecoveryAssessment.ActionRetrySafe ||
		read.RecoveryAssessment.NextAdvice != recovery.AdviceRetryCurrentAction {
		t.Fatalf("pre_commit read-back = %#v", read)
	}
	afterCounts := readApplicationPersistenceCounts(t, databasePath, source.TaskID)
	if afterCounts != beforeCounts || afterCounts.Revision != source.Revision ||
		afterCounts.Events != 1 || afterCounts.Claims != 1 {
		t.Fatalf("pre_commit persistence changed: before=%#v after=%#v", beforeCounts, afterCounts)
	}
}

func TestDuplicateCommittedRecoverySubmissionPreservesCardinality(t *testing.T) {
	fixture := newReopenedCommittedOperationFixture(t, "operation-duplicate-recovery")
	beforeCounts := readApplicationPersistenceCounts(t, fixture.databasePath, fixture.source.TaskID)
	beforeTask := fixture.committed.Clone()
	request := fixture.request
	request.RequestID = "request-duplicate-recovery-read-back"
	request.RecoveryApply = &RecoveryApplyInput{
		OperationID: fixture.request.RequestID,
		SourcePhase: fixture.source.Phase,
	}

	result, err := fixture.service.ApplyAction(context.Background(), request)
	if err != nil {
		t.Fatalf("duplicate committed recovery submission: %v", err)
	}
	if !reflect.DeepEqual(result.Task, beforeTask) || result.Task.Revision != fixture.source.Revision+1 ||
		result.Task.LastOperation == nil || result.Task.LastOperation.OperationID != fixture.request.RequestID ||
		len(result.Task.Evidence) != len(beforeTask.Evidence) ||
		!reflect.DeepEqual(result.Task.Repository, beforeTask.Repository) {
		t.Fatalf("duplicate committed recovery read-back = %#v, want %#v", result.Task, beforeTask)
	}
	afterCounts := readApplicationPersistenceCounts(t, fixture.databasePath, fixture.source.TaskID)
	if afterCounts != beforeCounts || afterCounts.Revision != fixture.source.Revision+1 ||
		afterCounts.Events != 2 || afterCounts.Claims != 1 {
		t.Fatalf("duplicate committed recovery changed cardinality: before=%#v after=%#v", beforeCounts, afterCounts)
	}
}

func TestCompletedButUnrecordedRequiresExplicitRecoveryApply(t *testing.T) {
	ctx := context.Background()
	repositoryRoot := newCommittedApplicationRepository(t)
	databasePath := filepath.Join(t.TempDir(), "completed-but-unrecorded.db")
	taskStore, err := store.Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("open exact adoption store: %v", err)
	}
	t.Cleanup(func() { _ = taskStore.Close() })
	clock := &deterministicApplicationClock{next: time.Date(2026, time.August, 17, 13, 0, 0, 0, time.UTC)}
	service, err := newService(taskStore, repository.NewGitObserver(), clock.Now, sequentialApplicationIDs())
	if err != nil {
		t.Fatalf("construct exact adoption service: %v", err)
	}
	opened, err := service.OpenTask(ctx, OpenTaskRequest{
		RequestID:      "request-exact-adoption-open",
		Host:           domain.HostCodex,
		RepositoryPath: repositoryRoot,
		NewTask: &NewTaskInput{
			Goal:               "record exact unrecorded implementation work",
			Scope:              []string{"explicit recovery apply"},
			OutOfScope:         []string{"implicit adoption"},
			AcceptanceCriteria: []string{"exact work is recorded once"},
			VerificationBudget: testBudget(),
		},
	})
	if err != nil {
		t.Fatalf("open exact adoption task: %v", err)
	}
	task := applyJourneyAction(t, ctx, service, opened.Task, workflow.AssessTaskPayload{
		Result: domain.ActionResultSucceeded, Summary: "adoption task assessed",
		VerificationBudgetAcknowledged: true,
	}, "request-exact-adoption-assess")
	source := applyJourneyAction(t, ctx, service, task, workflow.PlanChangePayload{
		Result: domain.ActionResultSucceeded, Summary: "exact adoption planned",
		Steps:                []string{"record the retained implementation result"},
		ExpectedChangedPaths: []string{"README.md"}, VerificationSteps: []string{"read authoritative recovery"},
	}, "request-exact-adoption-plan")
	if source.Phase != domain.PhasePlan || source.CurrentAction == nil ||
		source.CurrentAction.Kind != domain.ActionImplementChange {
		t.Fatalf("exact adoption source = %#v", source)
	}
	if err := os.WriteFile(filepath.Join(repositoryRoot, "README.md"), []byte("exact unrecorded work\n"), 0o644); err != nil {
		t.Fatalf("create exact unrecorded work: %v", err)
	}
	payload := workflow.ImplementChangePayload{
		Result: domain.ActionResultSucceeded, Summary: "retained implementation result",
		ChangedPaths: []string{"README.md"}, ScopeConfirmed: true,
	}
	original := applyRequestForTask(source, "operation-exact-adoption", payload)
	probe := &OperationProbe{
		OperationID: original.RequestID, SourcePhase: source.Phase,
		ExpectedRevision: original.ExpectedRevision, ActionID: original.ActionID,
		ActionKind: original.ActionKind, RepositoryBindingDigest: original.RepositoryBindingDigest,
		Payload: payload,
	}
	beforeReadCounts := readApplicationPersistenceCounts(t, databasePath, source.TaskID)
	beforeReadSnapshot := readApplicationTaskSnapshot(t, databasePath, source.TaskID)
	read, err := service.GetTask(ctx, GetTaskRequest{
		Host: source.OriginHost, TaskID: source.TaskID, OperationProbe: probe,
	})
	if err != nil {
		t.Fatalf("read exact unrecorded work: %v", err)
	}
	assessment := read.RecoveryAssessment
	if !reflect.DeepEqual(read.Task, source) || assessment == nil ||
		assessment.Classification != domain.RecoveryCompletedButUnrecorded ||
		assessment.OperationEvidence != recovery.OperationEvidenceComplete ||
		assessment.RepositoryRelation != recovery.RepositoryWorktreeOnlyChanged ||
		assessment.NextAdvice != recovery.AdviceSubmitRecoveryApply || assessment.ActionRetrySafe {
		t.Fatalf("exact unrecorded read = %#v", read)
	}
	if afterReadCounts := readApplicationPersistenceCounts(t, databasePath, source.TaskID); afterReadCounts != beforeReadCounts {
		t.Fatalf("exact recovery read changed cardinality: before=%#v after=%#v", beforeReadCounts, afterReadCounts)
	}
	if afterReadSnapshot := readApplicationTaskSnapshot(t, databasePath, source.TaskID); !reflect.DeepEqual(afterReadSnapshot, beforeReadSnapshot) {
		t.Fatal("exact recovery read changed the SQLite snapshot")
	}

	recoveryRequest := original
	recoveryRequest.RequestID = "request-exact-adoption-envelope"
	recoveryRequest.RecoveryApply = &RecoveryApplyInput{
		OperationID: original.RequestID,
		SourcePhase: source.Phase,
	}
	result, err := service.ApplyAction(ctx, recoveryRequest)
	if err != nil {
		t.Fatalf("explicit exact recovery apply: %v", err)
	}
	adopted := result.Task
	if adopted.Revision != source.Revision+1 || adopted.Phase != domain.PhaseImplement ||
		adopted.CurrentAction == nil || adopted.CurrentAction.Kind != domain.ActionVerifyChange ||
		adopted.LastOperation == nil || adopted.LastOperation.OperationID != original.RequestID ||
		adopted.LastOperation.ActionID == nil || *adopted.LastOperation.ActionID != original.ActionID ||
		adopted.LastOperation.FromRevision != source.Revision ||
		adopted.LastOperation.ToRevision != source.Revision+1 ||
		adopted.LastOperation.PayloadDigest != assessment.OperationPayloadDigest ||
		len(adopted.Evidence) != len(source.Evidence)+1 || adopted.Blocker != nil ||
		adopted.Repository.BindingDigest != assessment.ObservedBindingDigest {
		t.Fatalf("explicit exact adoption = %#v", adopted)
	}
	afterAdoptionCounts := readApplicationPersistenceCounts(t, databasePath, source.TaskID)
	if afterAdoptionCounts.Revision != source.Revision+1 ||
		afterAdoptionCounts.Events != beforeReadCounts.Events+1 ||
		afterAdoptionCounts.Claims != 1 ||
		readApplicationMatchingEventCount(t, databasePath, source.TaskID, original.RequestID) != 1 {
		t.Fatalf("explicit exact adoption cardinality = %#v", afterAdoptionCounts)
	}
	requireActiveClaim(t, ctx, taskStore, adopted)
	requireJourneyCommittedFact(t, databasePath, adopted)

	duplicate, err := service.ApplyAction(ctx, recoveryRequest)
	if err != nil {
		t.Fatalf("duplicate exact recovery apply: %v", err)
	}
	if !reflect.DeepEqual(duplicate.Task, adopted) ||
		readApplicationPersistenceCounts(t, databasePath, source.TaskID) != afterAdoptionCounts ||
		readApplicationMatchingEventCount(t, databasePath, source.TaskID, original.RequestID) != 1 {
		t.Fatal("duplicate exact recovery apply produced another persistent write")
	}
}

func TestSupersededRecoverySourcesAreZeroWrite(t *testing.T) {
	base := applicationTaskAtPhase(t, domain.PhaseIntake, 3, testContract(t), nil)
	rebuildAction := func(task *domain.Task, phase domain.Phase, revision uint64, actionID domain.ID) {
		action, err := workflow.BuildNextAction(
			phase,
			task.TaskID,
			revision,
			task.Repository.BindingDigest,
			actionID,
			task.UpdatedAt,
		)
		if err != nil {
			t.Fatal(err)
		}
		task.Phase = phase
		task.Revision = revision
		task.CurrentAction = &action
		if err := workflow.ValidateTask(*task); err != nil {
			t.Fatalf("construct superseded task: %v", err)
		}
	}
	tests := []struct {
		name           string
		build          func() (domain.Task, domain.Task)
		want           error
		returnExisting bool
	}{
		{
			name: "stale expected revision",
			build: func() (domain.Task, domain.Task) {
				source := base.Clone()
				stored := source.Clone()
				rebuildAction(&stored, source.Phase, source.Revision+1, source.CurrentAction.ActionID)
				return source, stored
			},
			want: domain.ErrRevisionConflict,
		},
		{
			name: "stale action identity",
			build: func() (domain.Task, domain.Task) {
				source := base.Clone()
				stored := source.Clone()
				rebuildAction(&stored, source.Phase, source.Revision, "action-superseding")
				return source, stored
			},
			want: domain.ErrActionStale,
		},
		{
			name: "source phase advanced",
			build: func() (domain.Task, domain.Task) {
				source := base.Clone()
				stored := source.Clone()
				rebuildAction(&stored, domain.PhaseAssess, source.Revision, source.CurrentAction.ActionID)
				return source, stored
			},
			want: domain.ErrActionStale,
		},
		{
			name: "issuance binding superseded",
			build: func() (domain.Task, domain.Task) {
				source := base.Clone()
				stored := source.Clone()
				stored.Repository = changeApplicationWorktree(stored.Repository)
				rebuildAction(&stored, source.Phase, source.Revision, source.CurrentAction.ActionID)
				return source, stored
			},
			want: domain.ErrActionStale,
		},
		{
			name: "blocked task rejects old normal source",
			build: func() (domain.Task, domain.Task) {
				stored := applicationBlockedTask(t)
				source := applicationTaskAtPhase(t, *stored.ResumePhase, stored.Revision-1, stored.Contract, nil)
				return source, stored
			},
			returnExisting: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			source, stored := tt.build()
			before := stored.Clone()
			request := recoveryRequestForSource(
				source,
				"request-superseded-recovery",
				"operation-superseded-recovery",
				workflow.AssessTaskPayload{
					Result: domain.ActionResultSucceeded, Summary: "old expected evidence looks complete",
					VerificationBudgetAcknowledged: true,
				},
			)
			result, taskStore, observer, err := runRecoveryApply(t, stored, stored.Repository, request)
			if tt.want != nil {
				requireError(t, err, tt.want)
				if !reflect.DeepEqual(result, ApplyActionResult{}) {
					t.Fatalf("superseded source returned task authority: %#v", result)
				}
			} else if err != nil || !tt.returnExisting || !reflect.DeepEqual(result.Task, stored) {
				t.Fatalf("blocked superseded source = %#v, error %v", result, err)
			}
			if observer.calls != 1 || taskStore.commitTaskCalls != 0 || len(taskStore.commits) != 0 ||
				!reflect.DeepEqual(stored.Clone(), before) {
				t.Fatalf("superseded recovery changed state: observations=%d commits=%d task=%#v",
					observer.calls, taskStore.commitTaskCalls, stored)
			}
		})
	}
}

func TestRecoveryBlockerLifecycleRetainsAndRestoresIssuanceBinding(t *testing.T) {
	ctx := context.Background()
	source := applicationTaskAtPhase(t, domain.PhasePlan, 3, testContract(t), nil)
	partialBinding := changeApplicationWorktree(source.Repository)
	current := source.Clone()
	taskStore := &recordingStore{
		loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) {
			return current.Clone(), nil
		},
		commitTaskFn: func(_ context.Context, mutation store.TaskMutation) error {
			current = mutation.Task.Clone()
			return nil
		},
	}
	observer := &fixedRepositoryObserver{bindings: []domain.RepositoryBinding{
		partialBinding,
		partialBinding,
		partialBinding,
		source.Repository,
	}}
	service := newTestService(
		t,
		taskStore,
		observer,
		testTime().Add(4*time.Hour),
		"blocker-us2",
		"action-blocked-us2",
		"event-blocked-us2",
		"event-resolved-us2",
		"evidence-resolved-us2",
		"action-resumed-us2",
	)
	const operationID = domain.ID("operation-blocker-lifecycle")
	probe := &OperationProbe{
		OperationID: operationID, SourcePhase: source.Phase, ExpectedRevision: source.Revision,
		ActionID: source.CurrentAction.ActionID, ActionKind: source.CurrentAction.Kind,
		RepositoryBindingDigest: source.CurrentAction.RepositoryBindingDigest,
	}
	read, err := service.GetTask(ctx, GetTaskRequest{
		Host: source.OriginHost, TaskID: source.TaskID, OperationProbe: probe,
	})
	if err != nil {
		t.Fatalf("read partial blocker source: %v", err)
	}
	if !reflect.DeepEqual(read.Task, source) || read.RecoveryAssessment == nil ||
		read.RecoveryAssessment.Classification != domain.RecoveryPartiallyCompleted ||
		read.RecoveryAssessment.UnblockCondition == nil || taskStore.commitTaskCalls != 0 {
		t.Fatalf("partial read created state or wrong assessment: %#v", read)
	}

	recoveryRequest := recoveryRequestForSource(
		source,
		"request-blocker-lifecycle-envelope",
		operationID,
		nil,
	)
	blockedResult, err := service.ApplyAction(ctx, recoveryRequest)
	if err != nil {
		t.Fatalf("create recovery blocker: %v", err)
	}
	blocked := blockedResult.Task
	if taskStore.commitTaskCalls != 1 || blocked.TaskID != source.TaskID ||
		blocked.Revision != source.Revision+1 || blocked.Phase != domain.PhaseBlocked ||
		blocked.Blocker == nil || blocked.Blocker.BlockerID != "blocker-us2" ||
		blocked.Blocker.Code != domain.ErrorTaskBlocked ||
		blocked.Blocker.Cause != domain.RecoveryPartiallyCompleted ||
		blocked.Blocker.ResumePhase != source.Phase || blocked.ResumePhase == nil ||
		*blocked.ResumePhase != source.Phase ||
		blocked.Blocker.ObservedBindingDigest != partialBinding.BindingDigest ||
		blocked.Blocker.Condition.Kind != domain.BlockerConditionRestoreIssuanceBinding ||
		blocked.Blocker.Condition.ExpectedBindingDigest != source.Repository.BindingDigest ||
		blocked.Blocker.RequiredResolution != recoveryBlockerResolution ||
		blocked.CurrentAction == nil || blocked.CurrentAction.Kind != domain.ActionResolveBlocker ||
		blocked.Repository.BindingDigest != source.Repository.BindingDigest ||
		len(blocked.Evidence) != len(source.Evidence) ||
		taskStore.commits[0].Event.PhaseBefore != source.Phase ||
		taskStore.commits[0].Event.PhaseAfter != domain.PhaseBlocked ||
		taskStore.commits[0].Claim != store.ClaimRetain {
		t.Fatalf("created recovery blocker = %#v, mutation=%#v", blocked, taskStore.commits[0])
	}
	blockerID := blocked.Blocker.BlockerID
	condition := blocked.Blocker.Condition
	resumePhase := *blocked.ResumePhase
	current.Blocker.RequiredResolution = "display-only wording is not recovery authority"
	if err := workflow.ValidateTask(current); err != nil {
		t.Fatalf("display-only blocker text invalidated task: %v", err)
	}

	repeated, err := service.ApplyAction(ctx, recoveryRequest)
	if err != nil {
		t.Fatalf("retain existing recovery blocker: %v", err)
	}
	if taskStore.commitTaskCalls != 1 || !reflect.DeepEqual(repeated.Task, current) ||
		repeated.Task.Blocker == nil || repeated.Task.Blocker.BlockerID != blockerID ||
		repeated.Task.Blocker.Condition != condition || repeated.Task.ResumePhase == nil ||
		*repeated.Task.ResumePhase != resumePhase {
		t.Fatalf("repeated recovery changed existing blocker: %#v", repeated.Task)
	}

	resolveRequest := applyRequestForTask(
		current,
		"request-resolve-blocker-lifecycle",
		validResolvePayload(current),
	)
	resolvedResult, err := service.ApplyAction(ctx, resolveRequest)
	if err != nil {
		t.Fatalf("resolve exact issuance binding: %v", err)
	}
	resolved := resolvedResult.Task
	if observer.calls != 4 || taskStore.commitTaskCalls != 2 ||
		resolved.TaskID != source.TaskID || resolved.Revision != blocked.Revision+1 ||
		resolved.Phase != source.Phase || resolved.Blocker != nil || resolved.ResumePhase != nil ||
		resolved.CurrentAction == nil || resolved.CurrentAction.Kind != source.CurrentAction.Kind ||
		resolved.Repository.BindingDigest != source.Repository.BindingDigest ||
		!sameApplicationBindingIdentity(resolved.Repository, source.Repository) ||
		len(resolved.Evidence) != len(source.Evidence)+1 ||
		taskStore.commits[1].Event.PhaseBefore != domain.PhaseBlocked ||
		taskStore.commits[1].Event.PhaseAfter != source.Phase ||
		taskStore.commits[1].Claim != store.ClaimRetain {
		t.Fatalf("resolved blocker = %#v, commits=%#v", resolved, taskStore.commits)
	}
}

func TestNonExactBlockerRestorationIsZeroWrite(t *testing.T) {
	blocked := applicationBlockedTask(t)
	otherDigest := domain.Digest(strings.Repeat("8", 64))
	tests := []struct {
		name   string
		fresh  domain.RepositoryBinding
		mutate func(*ApplyActionRequest)
		want   error
	}{
		{
			name:  "same visible HEAD with different worktree",
			fresh: changeApplicationWorktree(blocked.Repository),
			mutate: func(request *ApplyActionRequest) {
				payload := request.Payload.(workflow.ResolveBlockerPayload)
				payload.ResolutionEvidence.ObservedBindingDigest = changeApplicationWorktree(blocked.Repository).BindingDigest
				request.Payload = payload
			},
			want: domain.ErrRepositoryDrift,
		},
		{
			name:  "observed digest differs from condition",
			fresh: blocked.Repository,
			mutate: func(request *ApplyActionRequest) {
				payload := request.Payload.(workflow.ResolveBlockerPayload)
				payload.ResolutionEvidence.ObservedBindingDigest = otherDigest
				request.Payload = payload
			},
			want: domain.ErrRepositoryDrift,
		},
		{
			name:  "blocker identity differs",
			fresh: blocked.Repository,
			mutate: func(request *ApplyActionRequest) {
				payload := request.Payload.(workflow.ResolveBlockerPayload)
				payload.BlockerID = "blocker-stale"
				request.Payload = payload
			},
			want: domain.ErrActionStale,
		},
		{
			name:  "resolution revision is stale",
			fresh: blocked.Repository,
			mutate: func(request *ApplyActionRequest) {
				request.ExpectedRevision++
			},
			want: domain.ErrRevisionConflict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			before := blocked.Clone()
			request := applyRequestForTask(blocked, "request-non-exact-resolution", validResolvePayload(blocked))
			tt.mutate(&request)
			result, taskStore, _, err := runRecoveryApply(t, blocked, tt.fresh, request)
			requireError(t, err, tt.want)
			if !reflect.DeepEqual(result, ApplyActionResult{}) || taskStore.commitTaskCalls != 0 ||
				len(taskStore.commits) != 0 || !reflect.DeepEqual(blocked.Clone(), before) {
				t.Fatalf("non-exact blocker restoration wrote state: result=%#v commits=%d", result, taskStore.commitTaskCalls)
			}
		})
	}
}

func TestRecoveryApplyReobservesAfterCompletedButUnrecordedRead(t *testing.T) {
	ctx := context.Background()
	source := applicationTaskAtPhase(t, domain.PhasePlan, 3, testContract(t), nil)
	firstReadBinding := changeApplicationWorktree(source.Repository)
	latestApplyBinding := changeApplicationBranch(source.Repository)
	taskStore := &recordingStore{
		loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) {
			return source.Clone(), nil
		},
	}
	observer := &fixedRepositoryObserver{bindings: []domain.RepositoryBinding{
		firstReadBinding,
		latestApplyBinding,
	}}
	service := recoveryTestService(t, taskStore, observer)
	payload := workflow.ImplementChangePayload{
		Result: domain.ActionResultSucceeded, Summary: "retained completed implementation",
		ChangedPaths: []string{"README.md"}, ScopeConfirmed: true,
	}
	original := applyRequestForTask(source, "operation-fresh-recovery-observation", payload)
	probe := &OperationProbe{
		OperationID: original.RequestID, SourcePhase: source.Phase,
		ExpectedRevision: source.Revision, ActionID: source.CurrentAction.ActionID,
		ActionKind:              source.CurrentAction.Kind,
		RepositoryBindingDigest: source.CurrentAction.RepositoryBindingDigest,
		Payload:                 payload,
	}
	read, err := service.GetTask(ctx, GetTaskRequest{
		Host: source.OriginHost, TaskID: source.TaskID, OperationProbe: probe,
	})
	if err != nil {
		t.Fatalf("initial completed-but-unrecorded read: %v", err)
	}
	assessment := read.RecoveryAssessment
	if assessment == nil || assessment.Classification != domain.RecoveryCompletedButUnrecorded ||
		assessment.ObservedBindingDigest != firstReadBinding.BindingDigest ||
		assessment.RepositoryRelation != recovery.RepositoryWorktreeOnlyChanged ||
		taskStore.commitTaskCalls != 0 || observer.calls != 1 {
		t.Fatalf("initial recovery assessment = %#v", assessment)
	}

	recoveryRequest := original
	recoveryRequest.RequestID = "request-fresh-recovery-envelope"
	recoveryRequest.RecoveryApply = &RecoveryApplyInput{
		OperationID: original.RequestID,
		SourcePhase: source.Phase,
	}
	result, err := service.ApplyAction(ctx, recoveryRequest)
	if err != nil {
		t.Fatalf("fresh recovery apply: %v", err)
	}
	blocked := result.Task
	if observer.calls != 2 || taskStore.commitTaskCalls != 1 || len(taskStore.commits) != 1 ||
		blocked.Phase != domain.PhaseBlocked || blocked.Revision != source.Revision+1 ||
		blocked.Blocker == nil || blocked.Blocker.Cause != domain.RecoveryConflicting ||
		blocked.Blocker.ObservedBindingDigest != latestApplyBinding.BindingDigest ||
		blocked.Blocker.ObservedBindingDigest == assessment.ObservedBindingDigest ||
		blocked.Repository.BindingDigest != source.Repository.BindingDigest ||
		len(blocked.Evidence) != len(source.Evidence) ||
		taskStore.commits[0].Task.Repository.BindingDigest != source.Repository.BindingDigest ||
		taskStore.commits[0].Event.PhaseBefore != source.Phase ||
		taskStore.commits[0].Event.PhaseAfter != domain.PhaseBlocked ||
		taskStore.commits[0].Event.RequestID != original.RequestID {
		t.Fatalf("fresh apply-time reconciliation = %#v, commits=%#v", blocked, taskStore.commits)
	}
}

func TestApplyActionCompletesRealInProcessJourney(t *testing.T) {
	ctx := context.Background()
	repositoryRoot := newCommittedApplicationRepository(t)
	databasePath := filepath.Join(t.TempDir(), "journey.db")
	taskStore, err := store.Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("store.Open() error = %v", err)
	}
	t.Cleanup(func() { _ = taskStore.Close() })

	clock := &deterministicApplicationClock{next: time.Date(2026, time.August, 15, 10, 0, 0, 0, time.UTC)}
	service, err := newService(taskStore, repository.NewGitObserver(), clock.Now, sequentialApplicationIDs())
	if err != nil {
		t.Fatalf("newService() error = %v", err)
	}
	opened, err := service.OpenTask(ctx, OpenTaskRequest{
		RequestID:      "request-open-journey",
		Host:           domain.HostCodex,
		RepositoryPath: repositoryRoot,
		NewTask: &NewTaskInput{
			Goal:               "complete the in-process workflow",
			Scope:              []string{"workflow application"},
			OutOfScope:         []string{"restart recovery"},
			AcceptanceCriteria: []string{"the task reaches DONE atomically"},
			VerificationBudget: domain.VerificationBudget{
				Level:                domain.VerificationTargeted,
				MaxAutomaticCommands: 2,
				AllowManualHandoff:   true,
			},
		},
	})
	if err != nil {
		t.Fatalf("OpenTask() error = %v", err)
	}
	task := opened.Task
	requireApplicationPhase(t, task, domain.PhaseIntake, 1, domain.ActionAssessTask)
	requireJourneyCommittedFact(t, databasePath, task)
	requireActiveClaim(t, ctx, taskStore, task)

	task = applyJourneyAction(t, ctx, service, task, workflow.AssessTaskPayload{
		Result:                         domain.ActionResultSucceeded,
		Summary:                        "task and acceptance assessed",
		Constraints:                    []string{"single repository"},
		Risks:                          []string{},
		IntendedChangedSurface:         []string{"internal application"},
		VerificationBudgetAcknowledged: true,
	}, "request-assess")
	requireApplicationPhase(t, task, domain.PhaseAssess, 2, domain.ActionPlanChange)
	requireJourneyCommittedFact(t, databasePath, task)
	requireActiveClaim(t, ctx, taskStore, task)

	task = applyJourneyAction(t, ctx, service, task, workflow.PlanChangePayload{
		Result:               domain.ActionResultSucceeded,
		Summary:              "bounded implementation plan",
		Steps:                []string{"edit one tracked file"},
		ExpectedChangedPaths: []string{"README.md"},
		NonGoals:             []string{"restart behavior"},
		VerificationSteps:    []string{"run a targeted check"},
		UnresolvedQuestions:  []string{},
	}, "request-plan")
	requireApplicationPhase(t, task, domain.PhasePlan, 3, domain.ActionImplementChange)
	requireJourneyCommittedFact(t, databasePath, task)
	requireActiveClaim(t, ctx, taskStore, task)

	issuanceBinding := task.Repository.Clone()
	if err := os.WriteFile(filepath.Join(repositoryRoot, "README.md"), []byte("changed by implementation\n"), 0o644); err != nil {
		t.Fatalf("write implementation file: %v", err)
	}
	task = applyJourneyAction(t, ctx, service, task, workflow.ImplementChangePayload{
		Result:         domain.ActionResultSucceeded,
		Summary:        "implemented the tracked-file change",
		ChangedPaths:   []string{"README.md"},
		Deviations:     []string{},
		ScopeConfirmed: true,
	}, "request-implement")
	requireApplicationPhase(t, task, domain.PhaseImplement, 4, domain.ActionVerifyChange)
	if task.Repository.WorktreeFingerprint == issuanceBinding.WorktreeFingerprint ||
		task.Repository.BindingDigest == issuanceBinding.BindingDigest {
		t.Fatal("implementation did not persist the accepted fresh worktree binding")
	}
	if !sameApplicationBindingIdentity(task.Repository, issuanceBinding) {
		t.Fatalf("implementation changed non-worktree binding fields: before %#v after %#v", issuanceBinding, task.Repository)
	}
	requireJourneyCommittedFact(t, databasePath, task)
	requireActiveClaim(t, ctx, taskStore, task)

	task = applyJourneyAction(t, ctx, service, task, workflow.VerifyChangePayload{
		Result:  domain.ActionResultReady,
		Summary: "targeted verification is ready",
		Checks: []workflow.EvidenceInput{
			{Source: domain.EvidenceSourceAutomated, Name: "targeted-unit", Status: domain.EvidencePassed, Summary: "targeted unit check passed", CommandCount: 1},
			{Source: domain.EvidenceSourceUser, Name: "user-review", Status: domain.EvidencePassed, Summary: "user evidence retained"},
		},
		FailedItems:        []string{},
		UnverifiedItems:    []string{},
		ManualHandoffItems: []string{},
	}, "request-verify")
	requireApplicationPhase(t, task, domain.PhaseVerify, 5, domain.ActionReviewChange)
	requireJourneyCommittedFact(t, databasePath, task)
	requireActiveClaim(t, ctx, taskStore, task)

	automatedID := findApplicationEvidenceID(t, task.Evidence, domain.EvidenceSourceAutomated)
	manualID := findApplicationEvidenceID(t, task.Evidence, domain.EvidenceSourceUser)
	task = applyJourneyAction(t, ctx, service, task, workflow.ReviewChangePayload{
		Result:        domain.ActionResultPass,
		Summary:       "change passes bounded review",
		Findings:      []string{},
		ResidualRisks: []string{"restart remains outside this checkpoint"},
	}, "request-review")
	requireApplicationPhase(t, task, domain.PhaseReview, 6, domain.ActionPrepareHandoff)
	requireJourneyCommittedFact(t, databasePath, task)
	requireActiveClaim(t, ctx, taskStore, task)

	delivery := workflow.DeliveryData{
		Acceptance: []domain.OutcomeCriterion{{
			Criterion: task.Contract.AcceptanceCriteria()[0],
			Status:    domain.CriterionSatisfied,
		}},
		AutomatedEvidenceIDs: []domain.ID{automatedID},
		ManualEvidenceIDs:    []domain.ID{manualID},
		UnverifiedItems:      []string{},
		Risks:                []string{"restart remains outside this checkpoint"},
	}
	task = applyJourneyAction(t, ctx, service, task, workflow.ReviewHandoffPayload{
		Result:   domain.ActionResultReady,
		Summary:  "delivery data prepared",
		Delivery: &delivery,
	}, "request-prepare-handoff")
	requireApplicationPhase(t, task, domain.PhaseHandoff, 7, domain.ActionPrepareHandoff)
	requireJourneyCommittedFact(t, databasePath, task)
	requireActiveClaim(t, ctx, taskStore, task)

	task = applyJourneyAction(t, ctx, service, task, workflow.CompleteHandoffPayload{
		Result:   domain.ActionResultComplete,
		Summary:  "in-process workflow completed",
		Delivery: &delivery,
	}, "request-complete")
	if task.Phase != domain.PhaseDone || task.Revision != 8 || task.CurrentAction != nil ||
		task.Outcome == nil || task.CompletedAt == nil {
		t.Fatalf("terminal task = %#v", task)
	}
	if task.Outcome.Status != domain.TerminalCompleted ||
		!reflect.DeepEqual(task.Outcome.Acceptance, delivery.Acceptance) ||
		!reflect.DeepEqual(task.Outcome.AutomatedEvidenceIDs, delivery.AutomatedEvidenceIDs) ||
		!reflect.DeepEqual(task.Outcome.ManualEvidenceIDs, delivery.ManualEvidenceIDs) ||
		task.Outcome.FinalRepositoryBindingDigest != task.Repository.BindingDigest ||
		task.Outcome.Summary != "in-process workflow completed" {
		t.Fatalf("DONE outcome = %#v", task.Outcome)
	}
	if len(task.Evidence) > domain.MaxRetainedEvidenceItems || clock.calls != 8 {
		t.Fatalf("journey evidence/clock = %d/%d", len(task.Evidence), clock.calls)
	}
	requireJourneyCommittedFact(t, databasePath, task)
	if _, err := taskStore.LoadActiveTask(ctx, task.Repository.RepositoryIdentity); !errors.Is(err, store.ErrTaskNotFound) {
		t.Fatalf("DONE repository claim still active: %v", err)
	}
}

func TestApplyActionPersistsVerificationFailureReasonAndIssuesNewAction(t *testing.T) {
	task := applicationTaskAtPhase(t, domain.PhaseImplement, 4, testContract(t), nil)
	taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }}
	observer := &fixedRepositoryObserver{binding: task.Repository}
	service := newTestService(t, taskStore, observer, testTime().Add(time.Hour), "event-rework", "evidence-summary", "evidence-reason", "action-rework")

	payload := workflow.VerifyChangePayload{
		Result:      domain.ActionResultFailed,
		Summary:     "  targeted verification failed  ",
		FailedItems: []string{"unit test failed"},
		Reason:      "  implementation must be corrected  ",
	}
	request := applyRequestForTask(task, "request-rework", payload)
	result, err := service.ApplyAction(context.Background(), request)
	if err != nil {
		t.Fatalf("ApplyAction() error = %v", err)
	}
	committed := result.Task
	requireApplicationPhase(t, committed, domain.PhaseImplement, 5, domain.ActionVerifyChange)
	if committed.CurrentAction.ActionID == task.CurrentAction.ActionID {
		t.Fatal("failed action identity remained valid")
	}
	reason := findApplicationEvidence(t, committed.Evidence, "transition_reason")
	if reason.Source != domain.EvidenceSourceHostObserved || reason.Status != domain.EvidenceObserved ||
		reason.Summary != "implementation must be corrected" {
		t.Fatalf("transition reason evidence = %#v", reason)
	}
	validated, validateErr := workflow.ValidatePayload(task.Phase, task.CurrentAction.Kind, payload)
	wantPayloadDigest, digestErr := digestApplyActionPayload(request, task.Phase, validated.CanonicalBytes)
	if validateErr != nil || digestErr != nil || committed.LastOperation.PayloadDigest != wantPayloadDigest {
		t.Fatalf("normalized payload digest = %s, want %s, errors %v/%v", committed.LastOperation.PayloadDigest, wantPayloadDigest, validateErr, digestErr)
	}
	wantReasonDigest, digestErr := digestCanonical(workflow.NormalizedEvidenceInput{
		Source: domain.EvidenceSourceHostObserved, Name: "transition_reason", Status: domain.EvidenceObserved,
		Summary: "implementation must be corrected",
	})
	if digestErr != nil || reason.Digest != wantReasonDigest {
		t.Fatalf("reason digest = %s, want %s, error %v", reason.Digest, wantReasonDigest, digestErr)
	}
	requireApplicationMutationFact(t, taskStore.commits[0], task, committed, store.ClaimRetain)
}

func TestApplyActionSupportsReviewReworkAndReplan(t *testing.T) {
	tests := []struct {
		name   string
		result domain.ActionResult
		want   domain.Phase
	}{
		{name: "implementation rework", result: domain.ActionResultReworkImplementation, want: domain.PhaseImplement},
		{name: "replan", result: domain.ActionResultReplan, want: domain.PhasePlan},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			task := applicationTaskAtPhase(t, domain.PhaseVerify, 5, testContract(t), nil)
			taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }}
			observer := &fixedRepositoryObserver{binding: task.Repository}
			service := newTestService(t, taskStore, observer, testTime().Add(time.Hour), "event-review", "evidence-review", "evidence-reason", "action-next")
			payload := workflow.ReviewChangePayload{
				Result:        tt.result,
				Summary:       "review requires another bounded pass",
				Findings:      []string{"one finding"},
				ResidualRisks: []string{},
				Reason:        "review decision requires another pass",
			}
			result, err := service.ApplyAction(context.Background(), applyRequestForTask(task, "request-review-decision", payload))
			if err != nil {
				t.Fatalf("ApplyAction() error = %v", err)
			}
			if result.Task.Phase != tt.want || result.Task.Revision != task.Revision+1 || result.Task.CurrentAction == nil {
				t.Fatalf("result task = %#v", result.Task)
			}
			wantAction, _ := workflow.ActionForPhase(tt.want)
			if result.Task.CurrentAction.Kind != wantAction || result.Task.CurrentAction.ActionID == task.CurrentAction.ActionID {
				t.Fatalf("next action = %#v", result.Task.CurrentAction)
			}
		})
	}
}

func TestApplyActionRejectsExactIdentityMismatchesBeforeObservation(t *testing.T) {
	task := applicationTaskAtPhase(t, domain.PhaseIntake, 1, testContract(t), nil)
	tests := []struct {
		name   string
		mutate func(*ApplyActionRequest)
		target error
	}{
		{name: "stale revision", mutate: func(r *ApplyActionRequest) { r.ExpectedRevision++ }, target: domain.ErrRevisionConflict},
		{name: "wrong action ID", mutate: func(r *ApplyActionRequest) { r.ActionID = "action-other" }, target: domain.ErrActionStale},
		{name: "wrong action kind", mutate: func(r *ApplyActionRequest) { r.ActionKind = domain.ActionPlanChange }, target: domain.ErrActionStale},
		{name: "valid old binding", mutate: func(r *ApplyActionRequest) { r.RepositoryBindingDigest = domain.Digest(strings.Repeat("9", 64)) }, target: domain.ErrActionStale},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }}
			observer := &fixedRepositoryObserver{binding: task.Repository}
			service := newTestService(t, taskStore, observer, testTime())
			request := applyRequestForTask(task, "request-mismatch", workflow.AssessTaskPayload{
				Result: domain.ActionResultSucceeded, Summary: "assessment", VerificationBudgetAcknowledged: true,
			})
			tt.mutate(&request)
			result, err := service.ApplyAction(context.Background(), request)
			requireError(t, err, tt.target)
			if !reflect.DeepEqual(result, ApplyActionResult{}) || observer.calls != 0 || taskStore.commitTaskCalls != 0 {
				t.Fatalf("mismatch caused side effects: result %#v observer %d commits %d", result, observer.calls, taskStore.commitTaskCalls)
			}
		})
	}
}

func TestApplyActionRejectsInvalidRequestsAndPayloadsBeforeObservation(t *testing.T) {
	task := applicationTaskAtPhase(t, domain.PhaseIntake, 1, testContract(t), nil)
	var typedNil *workflow.AssessTaskPayload
	tests := []struct {
		name          string
		mutate        func(*ApplyActionRequest)
		wantLoadCalls int
	}{
		{name: "invalid request ID", mutate: func(r *ApplyActionRequest) { r.RequestID = "bad request" }},
		{name: "invalid host", mutate: func(r *ApplyActionRequest) { r.Host = "other" }},
		{name: "invalid task ID", mutate: func(r *ApplyActionRequest) { r.TaskID = "bad task" }},
		{name: "zero revision", mutate: func(r *ApplyActionRequest) { r.ExpectedRevision = 0 }},
		{name: "invalid action ID", mutate: func(r *ApplyActionRequest) { r.ActionID = "bad action" }},
		{name: "unknown action kind", mutate: func(r *ApplyActionRequest) { r.ActionKind = "UNKNOWN" }},
		{name: "invalid binding", mutate: func(r *ApplyActionRequest) { r.RepositoryBindingDigest = "digest" }},
		{name: "nil payload", mutate: func(r *ApplyActionRequest) { r.Payload = nil }},
		{name: "typed nil payload", mutate: func(r *ApplyActionRequest) { r.Payload = typedNil }},
		{name: "wrong payload type", mutate: func(r *ApplyActionRequest) {
			r.Payload = workflow.PlanChangePayload{Result: domain.ActionResultSucceeded, Summary: "plan", Steps: []string{"step"}, VerificationSteps: []string{"check"}}
		}, wantLoadCalls: 1},
		{name: "invalid payload field", mutate: func(r *ApplyActionRequest) {
			r.Payload = workflow.AssessTaskPayload{Result: domain.ActionResultSucceeded, Summary: " ", VerificationBudgetAcknowledged: true}
		}, wantLoadCalls: 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }}
			observer := &fixedRepositoryObserver{binding: task.Repository}
			service := newTestService(t, taskStore, observer, testTime())
			request := applyRequestForTask(task, "request-invalid", workflow.AssessTaskPayload{
				Result: domain.ActionResultSucceeded, Summary: "assessment", VerificationBudgetAcknowledged: true,
			})
			tt.mutate(&request)
			_, err := service.ApplyAction(context.Background(), request)
			requireError(t, err, domain.ErrInvalidArgument)
			if taskStore.loadTaskCalls != tt.wantLoadCalls || observer.calls != 0 || taskStore.commitTaskCalls != 0 {
				t.Fatalf("invalid request calls = load %d observer %d commit %d", taskStore.loadTaskCalls, observer.calls, taskStore.commitTaskCalls)
			}
		})
	}
}

func TestApplyActionRejectsBudgetBeforeObservation(t *testing.T) {
	contract, err := domain.NewContract("goal", nil, nil, []string{"criterion"}, domain.VerificationBudget{
		Level: domain.VerificationTargeted, MaxAutomaticCommands: 0,
	})
	if err != nil {
		t.Fatalf("NewContract() error = %v", err)
	}
	task := applicationTaskAtPhase(t, domain.PhaseImplement, 4, contract, nil)
	taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }}
	observer := &fixedRepositoryObserver{binding: task.Repository}
	service := newTestService(t, taskStore, observer, testTime())
	payload := workflow.VerifyChangePayload{
		Result:  domain.ActionResultReady,
		Summary: "verification summary",
		Checks: []workflow.EvidenceInput{{
			Source: domain.EvidenceSourceAutomated, Name: "unit", Status: domain.EvidencePassed, Summary: "passed", CommandCount: 1,
		}},
	}
	_, err = service.ApplyAction(context.Background(), applyRequestForTask(task, "request-budget", payload))
	requireError(t, err, domain.ErrVerificationBudgetExceeded)
	if observer.calls != 0 || taskStore.commitTaskCalls != 0 {
		t.Fatalf("budget failure caused observation/commit: %d/%d", observer.calls, taskStore.commitTaskCalls)
	}
}

func TestApplyActionEnforcesActionSpecificRepositoryBinding(t *testing.T) {
	tests := []struct {
		name       string
		phase      domain.Phase
		fresh      func(domain.RepositoryBinding) domain.RepositoryBinding
		payload    workflow.ActionPayload
		wantErr    error
		wantCommit bool
	}{
		{name: "non-implement worktree drift", phase: domain.PhaseIntake, fresh: changeApplicationWorktree, payload: workflow.AssessTaskPayload{Result: domain.ActionResultSucceeded, Summary: "assessment", VerificationBudgetAcknowledged: true}, wantErr: domain.ErrRepositoryDrift},
		{name: "implement worktree drift", phase: domain.PhasePlan, fresh: changeApplicationWorktree, payload: workflow.ImplementChangePayload{Result: domain.ActionResultSucceeded, Summary: "implementation", ChangedPaths: []string{"file.go"}, ScopeConfirmed: true}, wantCommit: true},
		{name: "implement branch drift", phase: domain.PhasePlan, fresh: changeApplicationBranch, payload: workflow.ImplementChangePayload{Result: domain.ActionResultSucceeded, Summary: "implementation", ChangedPaths: []string{"file.go"}, ScopeConfirmed: true}, wantErr: domain.ErrRepositoryDrift},
		{name: "implement HEAD drift", phase: domain.PhasePlan, fresh: changeApplicationHead, payload: workflow.ImplementChangePayload{Result: domain.ActionResultSucceeded, Summary: "implementation", ChangedPaths: []string{"file.go"}, ScopeConfirmed: true}, wantErr: domain.ErrRepositoryDrift},
		{name: "implement repository identity drift", phase: domain.PhasePlan, fresh: changeApplicationIdentity, payload: workflow.ImplementChangePayload{Result: domain.ActionResultSucceeded, Summary: "implementation", ChangedPaths: []string{"file.go"}, ScopeConfirmed: true}, wantErr: domain.ErrRepositoryDrift},
		{name: "implement common directory drift", phase: domain.PhasePlan, fresh: changeApplicationCommonDirectory, payload: workflow.ImplementChangePayload{Result: domain.ActionResultSucceeded, Summary: "implementation", ChangedPaths: []string{"file.go"}, ScopeConfirmed: true}, wantErr: domain.ErrRepositoryDrift},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			task := applicationTaskAtPhase(t, tt.phase, 3, testContract(t), nil)
			before := task.Clone()
			taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }}
			fresh := tt.fresh(task.Repository)
			observer := &fixedRepositoryObserver{binding: fresh}
			service := newTestService(t, taskStore, observer, testTime().Add(time.Hour), "event-binding", "evidence-binding", "action-binding")
			result, err := service.ApplyAction(context.Background(), applyRequestForTask(task, "request-binding", tt.payload))
			if tt.wantErr != nil {
				requireError(t, err, tt.wantErr)
				if !reflect.DeepEqual(result, ApplyActionResult{}) || taskStore.commitTaskCalls != 0 || !reflect.DeepEqual(task, before) {
					t.Fatalf("drift changed state: result %#v commits %d task %#v", result, taskStore.commitTaskCalls, task)
				}
				return
			}
			if err != nil || !tt.wantCommit || taskStore.commitTaskCalls != 1 {
				t.Fatalf("ApplyAction() error/commits = %v/%d", err, taskStore.commitTaskCalls)
			}
			if result.Task.Repository.BindingDigest != fresh.BindingDigest || result.Task.Repository.WorktreeFingerprint != fresh.WorktreeFingerprint {
				t.Fatalf("accepted fresh binding was not persisted: %#v", result.Task.Repository)
			}
		})
	}
}

func TestRepositoryDriftLeavesRealTaskEventEvidenceAndClaimUnchanged(t *testing.T) {
	ctx := context.Background()
	repositoryRoot := newCommittedApplicationRepository(t)
	databasePath := filepath.Join(t.TempDir(), "drift.db")
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
		RequestID: "request-open-drift", Host: domain.HostCodex, RepositoryPath: repositoryRoot,
		NewTask: &NewTaskInput{Goal: "detect drift", AcceptanceCriteria: []string{"drift is rejected"}, VerificationBudget: testBudget()},
	})
	if err != nil {
		t.Fatalf("OpenTask() error = %v", err)
	}
	before := opened.Task
	if err := os.WriteFile(filepath.Join(repositoryRoot, "README.md"), []byte("unauthorized intake edit\n"), 0o644); err != nil {
		t.Fatalf("write drift file: %v", err)
	}
	_, err = service.ApplyAction(ctx, applyRequestForTask(before, "request-drift", workflow.AssessTaskPayload{
		Result: domain.ActionResultSucceeded, Summary: "assessment", VerificationBudgetAcknowledged: true,
	}))
	requireError(t, err, domain.ErrRepositoryDrift)
	after, err := taskStore.LoadTask(ctx, before.TaskID)
	if err != nil || after.Revision != before.Revision || after.Phase != before.Phase ||
		after.Repository.BindingDigest != before.Repository.BindingDigest || len(after.Evidence) != len(before.Evidence) ||
		after.CurrentAction == nil || after.CurrentAction.ActionID != before.CurrentAction.ActionID ||
		after.LastOperation == nil || before.LastOperation == nil ||
		after.LastOperation.OperationID != before.LastOperation.OperationID {
		t.Fatalf("drift changed authoritative task: %#v, error %v", after, err)
	}
	requireActiveClaim(t, ctx, taskStore, before)
	requireJourneyCommittedFact(t, databasePath, before)
}

func TestApplyActionMapsStoreCASConflictAndDuplicateSubmission(t *testing.T) {
	t.Run("store conflict", func(t *testing.T) {
		task := applicationTaskAtPhase(t, domain.PhaseIntake, 1, testContract(t), nil)
		taskStore := &recordingStore{
			loadTaskFn:   func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil },
			commitTaskFn: func(context.Context, store.TaskMutation) error { return store.ErrRevisionConflict },
		}
		observer := &fixedRepositoryObserver{binding: task.Repository}
		service := newTestService(t, taskStore, observer, testTime().Add(time.Hour), "event", "evidence", "action")
		_, err := service.ApplyAction(context.Background(), applyRequestForTask(task, "request", workflow.AssessTaskPayload{
			Result: domain.ActionResultSucceeded, Summary: "assessment", VerificationBudgetAcknowledged: true,
		}))
		requireError(t, err, domain.ErrRevisionConflict)
	})

	t.Run("duplicate", func(t *testing.T) {
		current := applicationTaskAtPhase(t, domain.PhaseIntake, 1, testContract(t), nil)
		taskStore := &recordingStore{}
		taskStore.loadTaskFn = func(context.Context, domain.ID) (domain.Task, error) { return current.Clone(), nil }
		taskStore.commitTaskFn = func(_ context.Context, mutation store.TaskMutation) error {
			current = mutation.Task.Clone()
			return nil
		}
		observer := &fixedRepositoryObserver{binding: current.Repository}
		service := newTestService(t, taskStore, observer, testTime().Add(time.Hour), "event", "evidence", "action")
		request := applyRequestForTask(current, "request", workflow.AssessTaskPayload{
			Result: domain.ActionResultSucceeded, Summary: "assessment", VerificationBudgetAcknowledged: true,
		})
		if _, err := service.ApplyAction(context.Background(), request); err != nil {
			t.Fatalf("first ApplyAction() error = %v", err)
		}
		observations := observer.calls
		_, err := service.ApplyAction(context.Background(), request)
		requireError(t, err, domain.ErrRevisionConflict)
		if observer.calls != observations || taskStore.commitTaskCalls != 1 {
			t.Fatalf("duplicate caused observation/commit = %d/%d", observer.calls, taskStore.commitTaskCalls)
		}
	})
}

func TestApplyActionAcceptsExplicitNoFileChangeWithStableImplementationBinding(t *testing.T) {
	task := applicationTaskAtPhase(t, domain.PhasePlan, 3, testContract(t), nil)
	taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }}
	observer := &fixedRepositoryObserver{binding: task.Repository}
	service := newTestService(t, taskStore, observer, testTime().Add(time.Hour), "event", "evidence", "action")
	result, err := service.ApplyAction(context.Background(), applyRequestForTask(task, "request-no-files", workflow.ImplementChangePayload{
		Result: domain.ActionResultSucceeded, Summary: "no file change required", NoFileChanges: true, ScopeConfirmed: true,
	}))
	if err != nil {
		t.Fatalf("ApplyAction() error = %v", err)
	}
	if result.Task.Phase != domain.PhaseImplement || result.Task.Repository.BindingDigest != task.Repository.BindingDigest {
		t.Fatalf("no-file-change result = %#v", result.Task)
	}
}

func TestApplyActionRejectsOwnershipMissingTaskAndCorruptTaskIdentity(t *testing.T) {
	task := applicationTaskAtPhase(t, domain.PhaseIntake, 1, testContract(t), nil)
	tests := []struct {
		name   string
		load   func(context.Context, domain.ID) (domain.Task, error)
		host   domain.Host
		target error
	}{
		{name: "missing", load: func(context.Context, domain.ID) (domain.Task, error) { return domain.Task{}, store.ErrTaskNotFound }, host: domain.HostCodex, target: domain.ErrTaskNotFound},
		{name: "ownership", load: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }, host: domain.HostDeepSeek, target: domain.ErrHostOwnershipConflict},
		{name: "corrupt task identity", load: func(context.Context, domain.ID) (domain.Task, error) {
			other := task.Clone()
			other.TaskID = "task-other"
			return other, nil
		}, host: domain.HostCodex, target: domain.ErrInternal},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taskStore := &recordingStore{loadTaskFn: tt.load}
			observer := &fixedRepositoryObserver{binding: task.Repository}
			service := newTestService(t, taskStore, observer, testTime())
			request := applyRequestForTask(task, "request", workflow.AssessTaskPayload{
				Result: domain.ActionResultSucceeded, Summary: "assessment", VerificationBudgetAcknowledged: true,
			})
			request.Host = tt.host
			_, err := service.ApplyAction(context.Background(), request)
			requireError(t, err, tt.target)
			if observer.calls != 0 || taskStore.commitTaskCalls != 0 {
				t.Fatalf("load/ownership failure reached observation or commit")
			}
		})
	}
}

func TestApplyActionIDGenerationFailureNeverCommits(t *testing.T) {
	task := applicationTaskAtPhase(t, domain.PhaseIntake, 1, testContract(t), nil)
	tests := []struct {
		name      string
		generator idGenerator
	}{
		{name: "event ID", generator: func(string) (domain.ID, error) { return "", errors.New("entropy unavailable") }},
		{name: "evidence ID", generator: func() idGenerator {
			calls := 0
			return func(prefix string) (domain.ID, error) {
				calls++
				if calls == 1 {
					return "event-valid", nil
				}
				return "", errors.New("entropy unavailable")
			}
		}()},
		{name: "next action ID", generator: func() idGenerator {
			ids := []domain.ID{"event-valid", "evidence-valid"}
			index := 0
			return func(prefix string) (domain.ID, error) {
				if index < len(ids) {
					id := ids[index]
					index++
					return id, nil
				}
				return "", errors.New("entropy unavailable")
			}
		}()},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }}
			observer := &fixedRepositoryObserver{binding: task.Repository}
			service, err := newService(taskStore, observer, func() time.Time { return testTime().Add(time.Hour) }, tt.generator)
			if err != nil {
				t.Fatalf("newService() error = %v", err)
			}
			_, err = service.ApplyAction(context.Background(), applyRequestForTask(task, "request", workflow.AssessTaskPayload{
				Result: domain.ActionResultSucceeded, Summary: "assessment", VerificationBudgetAcknowledged: true,
			}))
			requireError(t, err, domain.ErrInternal)
			if taskStore.commitTaskCalls != 0 {
				t.Fatalf("ID failure committed %d mutations", taskStore.commitTaskCalls)
			}
		})
	}
}

func TestApplyActionRejectsTerminalBlockedAndCorruptCurrentAction(t *testing.T) {
	t.Run("terminal", func(t *testing.T) {
		task := terminalTask(t, domain.PhaseDone)
		request := ApplyActionRequest{RequestID: "request", Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision, ActionID: "action", ActionKind: domain.ActionAssessTask, RepositoryBindingDigest: task.Repository.BindingDigest, Payload: workflow.AssessTaskPayload{Result: domain.ActionResultSucceeded, Summary: "assessment", VerificationBudgetAcknowledged: true}}
		requireApplyLoadFailure(t, task, request, domain.ErrTaskTerminal)
	})

	t.Run("blocked", func(t *testing.T) {
		task := applicationBlockedTask(t)
		request := applyRequestForTask(task, "request", workflow.AssessTaskPayload{Result: domain.ActionResultSucceeded, Summary: "assessment", VerificationBudgetAcknowledged: true})
		requireApplyLoadFailure(t, task, request, domain.ErrInvalidArgument)
	})

	t.Run("corrupt action blueprint", func(t *testing.T) {
		task := applicationTaskAtPhase(t, domain.PhaseIntake, 1, testContract(t), nil)
		task.CurrentAction.Guidance = "corrupt guidance"
		taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }}
		observer := &fixedRepositoryObserver{binding: task.Repository}
		service := newTestService(t, taskStore, observer, testTime())
		request := applyRequestForTask(task, "request", workflow.AssessTaskPayload{Result: domain.ActionResultSucceeded, Summary: "assessment", VerificationBudgetAcknowledged: true})
		_, err := service.ApplyAction(context.Background(), request)
		requireError(t, err, domain.ErrInternal)
		if observer.calls != 0 || taskStore.commitTaskCalls != 0 {
			t.Fatal("corrupt action reached observation or commit")
		}
	})
}

func applyJourneyAction(
	t *testing.T,
	ctx context.Context,
	service *Service,
	before domain.Task,
	payload workflow.ActionPayload,
	requestID domain.ID,
) domain.Task {
	t.Helper()
	oldActionID := before.CurrentAction.ActionID
	result, err := service.ApplyAction(ctx, applyRequestForTask(before, requestID, payload))
	if err != nil {
		t.Fatalf("ApplyAction(%s) error = %v", before.Phase, err)
	}
	after := result.Task
	if after.Revision != before.Revision+1 || after.LastOperation == nil ||
		after.LastOperation.OperationID != requestID || after.LastOperation.Kind != domain.OperationApplyAction ||
		after.LastOperation.ActionID == nil || *after.LastOperation.ActionID != oldActionID ||
		after.LastOperation.FromRevision != before.Revision || after.LastOperation.ToRevision != after.Revision {
		t.Fatalf("committed apply fact = %#v", after.LastOperation)
	}
	if !after.Contract.Equal(before.Contract) || len(after.Evidence) <= len(before.Evidence) {
		t.Fatalf("contract/evidence after apply = equal %v evidence %d -> %d", after.Contract.Equal(before.Contract), len(before.Evidence), len(after.Evidence))
	}
	if !after.Phase.Terminal() && (after.CurrentAction == nil || after.CurrentAction.ActionID == oldActionID ||
		after.CurrentAction.Revision != after.Revision || after.CurrentAction.RepositoryBindingDigest != after.Repository.BindingDigest) {
		t.Fatalf("new current action = %#v", after.CurrentAction)
	}
	return after
}

func applyRequestForTask(task domain.Task, requestID domain.ID, payload workflow.ActionPayload) ApplyActionRequest {
	return ApplyActionRequest{
		RequestID:               requestID,
		Host:                    task.OriginHost,
		TaskID:                  task.TaskID,
		ExpectedRevision:        task.Revision,
		ActionID:                task.CurrentAction.ActionID,
		ActionKind:              task.CurrentAction.Kind,
		RepositoryBindingDigest: task.CurrentAction.RepositoryBindingDigest,
		Payload:                 payload,
	}
}

func applicationTaskAtPhase(
	t *testing.T,
	phase domain.Phase,
	revision uint64,
	contract domain.Contract,
	evidence []domain.EvidenceSummary,
) domain.Task {
	t.Helper()
	now := testTime()
	binding := testBinding()
	action, err := workflow.BuildNextAction(phase, "task-application", revision, binding.BindingDigest, "action-current", now)
	if err != nil {
		t.Fatalf("BuildNextAction() error = %v", err)
	}
	task := domain.Task{
		TaskID:        "task-application",
		OriginHost:    domain.HostCodex,
		Contract:      contract,
		Repository:    binding,
		Phase:         phase,
		CurrentAction: &action,
		Evidence:      append([]domain.EvidenceSummary(nil), evidence...),
		Revision:      revision,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := workflow.ValidateTask(task); err != nil {
		t.Fatalf("application task invalid: %v", err)
	}
	return task
}

func applicationBlockedTask(t *testing.T) domain.Task {
	t.Helper()
	task := applicationTaskAtPhase(t, domain.PhaseIntake, 2, testContract(t), nil)
	resume := domain.PhaseIntake
	blocker := domain.Blocker{
		BlockerID:             "blocker-current",
		Code:                  domain.ErrorTaskBlocked,
		Cause:                 domain.RecoveryConflicting,
		Message:               "repository reality is conflicting",
		ResumePhase:           resume,
		ObservedBindingDigest: task.Repository.BindingDigest,
		Condition: domain.BlockerCondition{
			Kind:                  domain.BlockerConditionRestoreIssuanceBinding,
			ExpectedBindingDigest: task.Repository.BindingDigest,
		},
		RequiredResolution: "restore the issued binding",
		CreatedAt:          task.UpdatedAt,
	}
	action, err := workflow.BuildNextAction(domain.PhaseBlocked, task.TaskID, task.Revision, task.Repository.BindingDigest, "action-blocked", task.UpdatedAt)
	if err != nil {
		t.Fatalf("BuildNextAction(BLOCKED) error = %v", err)
	}
	task.Phase = domain.PhaseBlocked
	task.ResumePhase = &resume
	task.Blocker = &blocker
	task.CurrentAction = &action
	if err := workflow.ValidateTask(task); err != nil {
		t.Fatalf("blocked task invalid: %v", err)
	}
	return task
}

func requireApplyLoadFailure(t *testing.T, task domain.Task, request ApplyActionRequest, target error) {
	t.Helper()
	taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }}
	observer := &fixedRepositoryObserver{binding: task.Repository}
	service := newTestService(t, taskStore, observer, testTime())
	_, err := service.ApplyAction(context.Background(), request)
	requireError(t, err, target)
	if observer.calls != 0 || taskStore.commitTaskCalls != 0 {
		t.Fatalf("load failure caused observation/commit = %d/%d", observer.calls, taskStore.commitTaskCalls)
	}
}

func requireApplicationPhase(t *testing.T, task domain.Task, phase domain.Phase, revision uint64, action domain.ActionKind) {
	t.Helper()
	if task.Phase != phase || task.Revision != revision || task.CurrentAction == nil || task.CurrentAction.Kind != action ||
		task.CurrentAction.Revision != revision || task.CurrentAction.TaskID != task.TaskID ||
		task.CurrentAction.RepositoryBindingDigest != task.Repository.BindingDigest {
		t.Fatalf("task phase/action = %#v", task)
	}
}

func requireApplicationMutationFact(t *testing.T, mutation store.TaskMutation, before, after domain.Task, claim store.ClaimOperation) {
	t.Helper()
	if mutation.ExpectedRevision != before.Revision || mutation.Claim != claim ||
		mutation.Event.TaskID != after.TaskID || mutation.Event.Revision != after.Revision ||
		mutation.Event.Kind != domain.OperationApplyAction || mutation.Event.PhaseBefore != before.Phase ||
		mutation.Event.PhaseAfter != after.Phase || mutation.Event.ActionID == nil ||
		*mutation.Event.ActionID != before.CurrentAction.ActionID || after.LastOperation == nil ||
		mutation.Event.RequestID != after.LastOperation.OperationID ||
		mutation.Event.PayloadDigest != after.LastOperation.PayloadDigest ||
		!mutation.Event.CreatedAt.Equal(after.LastOperation.CommittedAt) {
		t.Fatalf("mutation committed fact = %#v / %#v", mutation, after.LastOperation)
	}
}

func requireJourneyCommittedFact(t *testing.T, databasePath string, task domain.Task) {
	t.Helper()
	database, err := sql.Open("sqlite", databasePath)
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	defer database.Close()
	var (
		revision                         uint64
		kind, before, after, requestID   string
		actionID, payloadDigest, created string
	)
	err = database.QueryRow(
		`SELECT revision, event_type, phase_before, phase_after,
		        COALESCE(action_id, ''), request_id, payload_digest, created_at
		   FROM task_events
		  WHERE task_id = ?
		  ORDER BY revision DESC LIMIT 1`,
		string(task.TaskID),
	).Scan(&revision, &kind, &before, &after, &actionID, &requestID, &payloadDigest, &created)
	if err != nil {
		t.Fatalf("read latest event: %v", err)
	}
	operation := task.LastOperation
	if operation == nil || revision != task.Revision || kind != string(operation.Kind) || after != string(task.Phase) ||
		requestID != string(operation.OperationID) || payloadDigest != string(operation.PayloadDigest) ||
		created != operation.CommittedAt.Format(time.RFC3339Nano) {
		t.Fatalf("event/operation mismatch: event %d %s %s->%s %s %s %s, operation %#v", revision, kind, before, after, requestID, payloadDigest, created, operation)
	}
	wantAction := ""
	if operation.ActionID != nil {
		wantAction = string(*operation.ActionID)
	}
	if actionID != wantAction {
		t.Fatalf("event action = %q, want %q", actionID, wantAction)
	}
}

func requireActiveClaim(t *testing.T, ctx context.Context, taskStore store.Store, task domain.Task) {
	t.Helper()
	claimed, err := taskStore.LoadActiveTask(ctx, task.Repository.RepositoryIdentity)
	if err != nil || claimed.TaskID != task.TaskID || claimed.Revision != task.Revision {
		t.Fatalf("active claim task = %#v, error %v", claimed, err)
	}
}

func findApplicationEvidence(t *testing.T, evidence []domain.EvidenceSummary, name string) domain.EvidenceSummary {
	t.Helper()
	for _, item := range evidence {
		if item.Name == name {
			return item
		}
	}
	t.Fatalf("evidence %q not found in %#v", name, evidence)
	return domain.EvidenceSummary{}
}

func findApplicationEvidenceID(t *testing.T, evidence []domain.EvidenceSummary, source domain.EvidenceSource) domain.ID {
	t.Helper()
	for _, item := range evidence {
		if item.Source == source {
			return item.EvidenceID
		}
	}
	t.Fatalf("evidence source %q not found", source)
	return ""
}

func sameApplicationBindingIdentity(left, right domain.RepositoryBinding) bool {
	return left.CanonicalRoot == right.CanonicalRoot &&
		left.GitCommonDirDigest == right.GitCommonDirDigest &&
		left.RepositoryIdentity == right.RepositoryIdentity &&
		sameOptionalApplicationString(left.Branch, right.Branch) &&
		left.Detached == right.Detached &&
		sameOptionalApplicationString(left.Head, right.Head) && left.Unborn == right.Unborn
}

func sameOptionalApplicationString(left, right *string) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func changeApplicationWorktree(binding domain.RepositoryBinding) domain.RepositoryBinding {
	binding = binding.Clone()
	binding.WorktreeFingerprint = domain.Digest(strings.Repeat("1", 64))
	binding.BindingDigest = "bb7d0b8cb08ef8258c34a7231164f557750cf653a2d1d82d7c2042c74e20e1f7"
	binding.ObservedAt = binding.ObservedAt.Add(time.Minute)
	return binding
}

func changeApplicationBranch(binding domain.RepositoryBinding) domain.RepositoryBinding {
	binding = changeApplicationWorktree(binding)
	branch := "feature"
	binding.Branch = &branch
	binding.BindingDigest = "8a66a6ea9ad1515c5acbc020a646afb8a5cf1ae26c9f9f61185a9d574bfc9f61"
	return binding
}

func changeApplicationHead(binding domain.RepositoryBinding) domain.RepositoryBinding {
	binding = changeApplicationWorktree(binding)
	head := strings.Repeat("2", 40)
	binding.Head = &head
	binding.BindingDigest = "9c7401e667a547c8f72ddc14417efc1aab6d92736090e12967a97b032d3e195d"
	return binding
}

func changeApplicationIdentity(binding domain.RepositoryBinding) domain.RepositoryBinding {
	binding = changeApplicationWorktree(binding)
	binding.CanonicalRoot = "/public/other"
	binding.RepositoryIdentity = "99a740761b2b95c52f7e24744172dc1c42bf5c58275869a7086c7c99910c6fd3"
	binding.BindingDigest = "a3343cedebdc18ba93db49a41a015d071d4ec353d6950b1a09d38fb8a414b815"
	return binding
}

func changeApplicationCommonDirectory(binding domain.RepositoryBinding) domain.RepositoryBinding {
	binding = changeApplicationWorktree(binding)
	binding.GitCommonDirDigest = "19946b33409c7491dd9b386791cfb17687bf77e2e7ad86f57f334c84b0065927"
	binding.RepositoryIdentity = "4bdfcaf8b1c0d32c56d17a5825fd0af3f966161134b129e1fe30d4e8a55e3870"
	binding.BindingDigest = "cb6d4f3b7311145fb69d77b455f2ed3130205f5ec2f4ce1ab8a831002496e8e9"
	return binding
}

type deterministicApplicationClock struct {
	next  time.Time
	calls int
}

func (clock *deterministicApplicationClock) Now() time.Time {
	value := clock.next.Add(time.Duration(clock.calls) * time.Minute)
	clock.calls++
	return value
}

func sequentialApplicationIDs() idGenerator {
	counts := make(map[string]int)
	return func(prefix string) (domain.ID, error) {
		counts[prefix]++
		return domain.ID(fmt.Sprintf("%s-%04d", prefix, counts[prefix])), nil
	}
}

func newCommittedApplicationRepository(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	runApplicationGit(t, root, "init", "-b", "main")
	runApplicationGit(t, root, "config", "user.name", "Dev Flow Test")
	runApplicationGit(t, root, "config", "user.email", "dev-flow@example.invalid")
	if err := os.WriteFile(filepath.Join(root, "README.md"), []byte("initial\n"), 0o644); err != nil {
		t.Fatalf("write initial file: %v", err)
	}
	runApplicationGit(t, root, "add", "README.md")
	runApplicationGit(t, root, "commit", "-m", "initial")
	return root
}

func runApplicationGit(t *testing.T, root string, arguments ...string) {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", root}, arguments...)...)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %v: %s", arguments, err, output)
	}
}

func readApplicationTaskSnapshot(t *testing.T, databasePath string, taskID domain.ID) []byte {
	t.Helper()
	database, err := sql.Open("sqlite", databasePath)
	if err != nil {
		t.Fatalf("open application snapshot database: %v", err)
	}
	defer database.Close()
	var snapshot []byte
	if err := database.QueryRow(
		`SELECT snapshot FROM tasks WHERE task_id = ?`, string(taskID),
	).Scan(&snapshot); err != nil {
		t.Fatalf("read application task snapshot: %v", err)
	}
	return append([]byte(nil), snapshot...)
}

func readApplicationMatchingEventCount(
	t *testing.T,
	databasePath string,
	taskID domain.ID,
	requestID domain.ID,
) int {
	t.Helper()
	database, err := sql.Open("sqlite", databasePath)
	if err != nil {
		t.Fatalf("open application event database: %v", err)
	}
	defer database.Close()
	var count int
	if err := database.QueryRow(
		`SELECT COUNT(*) FROM task_events WHERE task_id = ? AND request_id = ?`,
		string(taskID), string(requestID),
	).Scan(&count); err != nil {
		t.Fatalf("read matching application event count: %v", err)
	}
	return count
}
