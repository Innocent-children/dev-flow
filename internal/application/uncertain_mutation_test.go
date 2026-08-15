package application

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
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

func TestRecoveryReadsAreTransient(t *testing.T) {
	t.Run("no probe does not observe and returns no assessment", func(t *testing.T) {
		persisted := applicationTaskAtPhase(t, domain.PhasePlan, 3, testContract(t), nil)
		taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) {
			return persisted.Clone(), nil
		}}
		observer := &fixedRepositoryObserver{binding: persisted.Repository}
		service := newTestService(t, taskStore, observer, testTime())
		result, err := service.GetTask(context.Background(), GetTaskRequest{
			Host: domain.HostCodex, TaskID: persisted.TaskID,
		})
		if err != nil {
			t.Fatalf("GetTask() error = %v", err)
		}
		if !reflect.DeepEqual(result.Task, persisted) || result.RecoveryAssessment != nil {
			t.Fatalf("GetTask() = %#v", result)
		}
		if observer.calls != 0 || taskStore.commitTaskCalls != 0 {
			t.Fatalf("no-probe read observed/committed = %d/%d", observer.calls, taskStore.commitTaskCalls)
		}
	})

	t.Run("probe observes normal blocked and terminal tasks", func(t *testing.T) {
		cases := []struct {
			name string
			task func(*testing.T) domain.Task
		}{
			{name: "normal", task: func(t *testing.T) domain.Task {
				return applicationTaskAtPhase(t, domain.PhasePlan, 3, testContract(t), nil)
			}},
			{name: "blocked", task: func(t *testing.T) domain.Task { return applicationBlockedTask(t) }},
			{name: "done", task: func(t *testing.T) domain.Task { return terminalTask(t, domain.PhaseDone) }},
			{name: "cancelled", task: func(t *testing.T) domain.Task { return terminalTask(t, domain.PhaseCancelled) }},
		}
		for _, tt := range cases {
			t.Run(tt.name, func(t *testing.T) {
				persisted := tt.task(t)
				probe := probeForProjection(persisted)
				taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) {
					return persisted.Clone(), nil
				}}
				observer := &fixedRepositoryObserver{binding: persisted.Repository}
				service := newTestService(t, taskStore, observer, testTime())
				result, err := service.GetTask(context.Background(), GetTaskRequest{
					Host: domain.HostCodex, TaskID: persisted.TaskID, OperationProbe: probe,
				})
				if err != nil {
					t.Fatalf("GetTask() error = %v", err)
				}
				if result.RecoveryAssessment == nil || result.RecoveryAssessment.Validate() != nil {
					t.Fatalf("assessment = %#v", result.RecoveryAssessment)
				}
				if observer.calls != 1 || taskStore.commitTaskCalls != 0 || !reflect.DeepEqual(result.Task, persisted) {
					t.Fatalf("read facts = observations %d commits %d task %#v", observer.calls, taskStore.commitTaskCalls, result.Task)
				}
			})
		}
	})

	t.Run("repeated assessment is stable except observed_at", func(t *testing.T) {
		persisted := applicationTaskAtPhase(t, domain.PhasePlan, 3, testContract(t), nil)
		firstBinding := persisted.Repository.Clone()
		secondBinding := persisted.Repository.Clone()
		secondBinding.ObservedAt = secondBinding.ObservedAt.Add(time.Minute)
		taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) {
			return persisted.Clone(), nil
		}}
		observer := &fixedRepositoryObserver{bindings: []domain.RepositoryBinding{firstBinding, secondBinding}}
		service := newTestService(t, taskStore, observer, testTime())
		request := GetTaskRequest{Host: persisted.OriginHost, TaskID: persisted.TaskID, OperationProbe: probeForProjection(persisted)}
		first, err := service.GetTask(context.Background(), request)
		if err != nil {
			t.Fatal(err)
		}
		second, err := service.GetTask(context.Background(), request)
		if err != nil {
			t.Fatal(err)
		}
		firstTime := first.RecoveryAssessment.ObservedAt
		secondTime := second.RecoveryAssessment.ObservedAt
		first.RecoveryAssessment.ObservedAt = time.Time{}
		second.RecoveryAssessment.ObservedAt = time.Time{}
		if firstTime.Equal(secondTime) || !reflect.DeepEqual(first, second) {
			t.Fatalf("repeated results differ beyond observed_at:\nfirst=%#v\nsecond=%#v", first, second)
		}
		if taskStore.commitTaskCalls != 0 {
			t.Fatalf("repeated read committed %d mutations", taskStore.commitTaskCalls)
		}
	})

	t.Run("observer and digest verifier failures return zero result", func(t *testing.T) {
		persisted := applicationTaskAtPhase(t, domain.PhasePlan, 3, testContract(t), nil)
		cases := []struct {
			name     string
			task     domain.Task
			observer *fixedRepositoryObserver
			target   error
		}{
			{name: "observer error", task: persisted, observer: &fixedRepositoryObserver{err: repository.ErrGitObservation}, target: domain.ErrInternal},
			{name: "fresh verifier", task: persisted, observer: &fixedRepositoryObserver{binding: tamperApplicationBindingDigest(persisted.Repository)}, target: domain.ErrInternal},
			{name: "persisted verifier", task: tamperPersistedApplicationBinding(persisted), observer: &fixedRepositoryObserver{binding: persisted.Repository}, target: domain.ErrStorageUnavailable},
		}
		for _, tt := range cases {
			t.Run(tt.name, func(t *testing.T) {
				taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) {
					return tt.task.Clone(), nil
				}}
				service := newTestService(t, taskStore, tt.observer, testTime())
				result, err := service.GetTask(context.Background(), GetTaskRequest{
					Host: persisted.OriginHost, TaskID: persisted.TaskID, OperationProbe: probeForProjection(persisted),
				})
				requireError(t, err, tt.target)
				if !reflect.DeepEqual(result, GetTaskResult{}) || taskStore.commitTaskCalls != 0 {
					t.Fatalf("failed read result/commits = %#v/%d", result, taskStore.commitTaskCalls)
				}
			})
		}
	})

	t.Run("next-action projection keeps normal blocked terminal fields mutually exclusive", func(t *testing.T) {
		cases := []struct {
			name        string
			task        domain.Task
			wantAction  bool
			wantBlocker bool
			wantOutcome bool
		}{
			{name: "normal", task: applicationTaskAtPhase(t, domain.PhasePlan, 3, testContract(t), nil), wantAction: true},
			{name: "blocked", task: applicationBlockedTask(t), wantAction: true, wantBlocker: true},
			{name: "terminal", task: terminalTask(t, domain.PhaseDone), wantOutcome: true},
		}
		for _, tt := range cases {
			t.Run(tt.name, func(t *testing.T) {
				taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return tt.task.Clone(), nil }}
				observer := &fixedRepositoryObserver{binding: tt.task.Repository}
				service := newTestService(t, taskStore, observer, testTime())
				result, err := service.GetNextAction(context.Background(), GetNextActionRequest{
					Host: tt.task.OriginHost, TaskID: tt.task.TaskID,
				})
				if err != nil {
					t.Fatal(err)
				}
				if (result.Action != nil) != tt.wantAction || (result.Blocker != nil) != tt.wantBlocker ||
					(result.Outcome != nil) != tt.wantOutcome || result.RecoveryAssessment != nil {
					t.Fatalf("projection = %#v", result)
				}
			})
		}
	})
}

func TestRecoveryReadProvesCommitBeforeLostResponse(t *testing.T) {
	ctx := context.Background()
	repositoryRoot := newCommittedApplicationRepository(t)
	databasePath := filepath.Join(t.TempDir(), "lost-response.db")
	taskStore, err := store.Open(ctx, databasePath)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = taskStore.Close() })
	clock := &deterministicApplicationClock{next: time.Date(2026, time.August, 15, 11, 0, 0, 0, time.UTC)}
	service, err := newService(taskStore, repository.NewGitObserver(), clock.Now, sequentialApplicationIDs())
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.OpenTask(ctx, OpenTaskRequest{
		RequestID: "request-open-lost", Host: domain.HostCodex, RepositoryPath: repositoryRoot,
		NewTask: &NewTaskInput{
			Goal: "prove a committed response loss", Scope: []string{"core"}, OutOfScope: []string{"transport injection"},
			AcceptanceCriteria: []string{"one committed action is proven"}, VerificationBudget: testBudget(),
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	before := opened.Task
	payload := workflow.AssessTaskPayload{
		Result: domain.ActionResultSucceeded, Summary: "assessment committed before response loss",
		VerificationBudgetAcknowledged: true,
	}
	original := applyRequestForTask(before, "request-original-lost", payload)
	committed, err := service.ApplyAction(ctx, original)
	if err != nil {
		t.Fatal(err)
	}
	countsBefore := readApplicationPersistenceCounts(t, databasePath, before.TaskID)

	probe := &OperationProbe{
		OperationID: original.RequestID, SourcePhase: before.Phase, ExpectedRevision: before.Revision,
		ActionID: original.ActionID, ActionKind: original.ActionKind,
		RepositoryBindingDigest: original.RepositoryBindingDigest, Payload: payload,
	}
	read, err := service.GetTask(ctx, GetTaskRequest{Host: before.OriginHost, TaskID: before.TaskID, OperationProbe: probe})
	if err != nil {
		t.Fatal(err)
	}
	assessment := read.RecoveryAssessment
	if assessment == nil || assessment.Classification != domain.RecoveryCompletedAndRecorded ||
		assessment.LastOperationRelation != recovery.LastOperationExact || assessment.CommittedProof == nil ||
		assessment.CommittedProof.OperationID != original.RequestID || assessment.ActionRetrySafe ||
		assessment.OperationPayloadDigest != committed.Task.LastOperation.PayloadDigest {
		t.Fatalf("committed assessment = %#v", assessment)
	}
	if !reflect.DeepEqual(read.Task, committed.Task) || readApplicationPersistenceCounts(t, databasePath, before.TaskID) != countsBefore {
		t.Fatal("recovery read changed persisted state")
	}

	recoveryRequest := original
	recoveryRequest.RequestID = "request-read-back"
	recoveryRequest.RecoveryApply = &RecoveryApplyInput{OperationID: original.RequestID, SourcePhase: before.Phase}
	readBack, err := service.ApplyAction(ctx, recoveryRequest)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(readBack.Task, committed.Task) || readApplicationPersistenceCounts(t, databasePath, before.TaskID) != countsBefore {
		t.Fatal("explicit committed read-back duplicated persistence")
	}
}

func TestRecoveryApplyDecisionEffects(t *testing.T) {
	ctx := context.Background()
	assessPayload := workflow.AssessTaskPayload{
		Result: domain.ActionResultSucceeded, Summary: "assessment result retained by the caller",
		VerificationBudgetAcknowledged: true,
	}
	implementPayload := workflow.ImplementChangePayload{
		Result: domain.ActionResultSucceeded, Summary: "implementation result retained by the caller",
		ChangedPaths: []string{"file.go"}, ScopeConfirmed: true,
	}

	t.Run("not started is an unchanged zero-write result", func(t *testing.T) {
		before := applicationTaskAtPhase(t, domain.PhaseIntake, 1, testContract(t), nil)
		request := recoveryRequestForSource(before, "request-recover-not-started", "operation-not-started", nil)
		result, taskStore, observer, err := runRecoveryApply(t, before, before.Repository, request)
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(result.Task, before) || taskStore.commitTaskCalls != 0 || observer.calls != 1 {
			t.Fatalf("not-started effect = result %#v commits %d observations %d", result, taskStore.commitTaskCalls, observer.calls)
		}
	})

	t.Run("complete evidence reuses the normal transition path", func(t *testing.T) {
		cases := []struct {
			name    string
			phase   domain.Phase
			payload workflow.ActionPayload
			fresh   func(domain.RepositoryBinding) domain.RepositoryBinding
			want    domain.Phase
		}{
			{name: "non implementation exact", phase: domain.PhaseIntake, payload: assessPayload, fresh: func(binding domain.RepositoryBinding) domain.RepositoryBinding { return binding }, want: domain.PhaseAssess},
			{name: "implementation worktree only", phase: domain.PhasePlan, payload: implementPayload, fresh: changeApplicationWorktree, want: domain.PhaseImplement},
		}
		for _, tt := range cases {
			t.Run(tt.name, func(t *testing.T) {
				before := applicationTaskAtPhase(t, tt.phase, 3, testContract(t), nil)
				fresh := tt.fresh(before.Repository)
				request := recoveryRequestForSource(before, "request-recovery-envelope", "operation-original", tt.payload)
				result, taskStore, _, err := runRecoveryApply(t, before, fresh, request)
				if err != nil {
					t.Fatal(err)
				}
				after := result.Task
				if taskStore.commitTaskCalls != 1 || after.Phase != tt.want || after.Revision != before.Revision+1 ||
					after.LastOperation == nil || after.LastOperation.OperationID != request.RecoveryApply.OperationID ||
					len(after.Evidence) <= len(before.Evidence) || after.Blocker != nil || after.Repository.BindingDigest != fresh.BindingDigest {
					t.Fatalf("recovered transition = %#v, commits %d", after, taskStore.commitTaskCalls)
				}
				mutation := taskStore.commits[0]
				if mutation.Event.RequestID != request.RecoveryApply.OperationID || mutation.Claim != store.ClaimRetain {
					t.Fatalf("recovered mutation = %#v", mutation)
				}
			})
		}
	})

	t.Run("partial contradictory and forbidden facts create one blocker", func(t *testing.T) {
		cases := []struct {
			name    string
			phase   domain.Phase
			payload workflow.ActionPayload
			fresh   func(domain.RepositoryBinding) domain.RepositoryBinding
			cause   domain.RecoveryClassification
		}{
			{name: "partial implementation", phase: domain.PhasePlan, payload: nil, fresh: changeApplicationWorktree, cause: domain.RecoveryPartiallyCompleted},
			{name: "payload effect contradiction", phase: domain.PhaseIntake, payload: assessPayload, fresh: changeApplicationWorktree, cause: domain.RecoveryConflicting},
			{name: "identity drift", phase: domain.PhasePlan, payload: implementPayload, fresh: changeApplicationIdentity, cause: domain.RecoveryConflicting},
			{name: "branch drift", phase: domain.PhasePlan, payload: implementPayload, fresh: changeApplicationBranch, cause: domain.RecoveryConflicting},
			{name: "head drift", phase: domain.PhasePlan, payload: implementPayload, fresh: changeApplicationHead, cause: domain.RecoveryConflicting},
			{name: "common directory drift", phase: domain.PhasePlan, payload: implementPayload, fresh: changeApplicationCommonDirectory, cause: domain.RecoveryConflicting},
		}
		for _, tt := range cases {
			t.Run(tt.name, func(t *testing.T) {
				before := applicationTaskAtPhase(t, tt.phase, 3, testContract(t), nil)
				fresh := tt.fresh(before.Repository)
				request := recoveryRequestForSource(before, "request-recovery-envelope", "operation-blocked", tt.payload)
				result, taskStore, _, err := runRecoveryApply(t, before, fresh, request)
				if err != nil {
					t.Fatal(err)
				}
				after := result.Task
				if taskStore.commitTaskCalls != 1 || after.Phase != domain.PhaseBlocked || after.Revision != before.Revision+1 ||
					after.Blocker == nil || after.Blocker.Cause != tt.cause || after.ResumePhase == nil || *after.ResumePhase != before.Phase ||
					after.CurrentAction == nil || after.CurrentAction.Kind != domain.ActionResolveBlocker ||
					after.Repository.BindingDigest != before.Repository.BindingDigest || len(after.Evidence) != len(before.Evidence) ||
					after.LastOperation == nil || after.LastOperation.OperationID != request.RecoveryApply.OperationID ||
					after.Blocker.ObservedBindingDigest != fresh.BindingDigest ||
					after.Blocker.Condition.ExpectedBindingDigest != before.Repository.BindingDigest {
					t.Fatalf("blocked recovery = %#v", after)
				}
				if taskStore.commits[0].Claim != store.ClaimRetain || taskStore.commits[0].Event.RequestID != request.RecoveryApply.OperationID {
					t.Fatalf("blocked mutation = %#v", taskStore.commits[0])
				}
			})
		}
	})

	t.Run("normal apply rejects the same forbidden drift without a blocker", func(t *testing.T) {
		before := applicationTaskAtPhase(t, domain.PhasePlan, 3, testContract(t), nil)
		taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return before.Clone(), nil }}
		observer := &fixedRepositoryObserver{binding: changeApplicationBranch(before.Repository)}
		service := recoveryTestService(t, taskStore, observer)
		result, err := service.ApplyAction(ctx, applyRequestForTask(before, "request-normal-drift", implementPayload))
		requireError(t, err, domain.ErrRepositoryDrift)
		if !reflect.DeepEqual(result, ApplyActionResult{}) || taskStore.commitTaskCalls != 0 {
			t.Fatalf("normal drift effect = %#v/%d", result, taskStore.commitTaskCalls)
		}
	})

	t.Run("invalid normalized payload is rejected before recovery observation", func(t *testing.T) {
		before := applicationTaskAtPhase(t, domain.PhaseIntake, 1, testContract(t), nil)
		payload := assessPayload
		payload.Constraints = []string{"same", " same "}
		request := recoveryRequestForSource(before, "request-recovery-envelope", "operation-invalid-payload", payload)
		result, taskStore, observer, err := runRecoveryApply(t, before, before.Repository, request)
		requireError(t, err, domain.ErrInvalidArgument)
		if !reflect.DeepEqual(result, ApplyActionResult{}) || observer.calls != 0 || taskStore.commitTaskCalls != 0 {
			t.Fatalf("invalid recovery payload side effects = %#v/%d/%d", result, observer.calls, taskStore.commitTaskCalls)
		}
	})

	t.Run("contradictory latest operation creates a blocker", func(t *testing.T) {
		before := applicationTaskAtPhase(t, domain.PhaseIntake, 3, testContract(t), nil)
		actionID := before.CurrentAction.ActionID
		before.LastOperation = &domain.LastOperation{
			OperationID: "operation-contradictory", Kind: domain.OperationApplyAction, ActionID: &actionID,
			FromRevision: 2, ToRevision: 3, PayloadDigest: domain.Digest(strings.Repeat("9", 64)), CommittedAt: before.UpdatedAt,
		}
		if err := workflow.ValidateTask(before); err != nil {
			t.Fatal(err)
		}
		request := recoveryRequestForSource(before, "request-recovery-envelope", "operation-contradictory", assessPayload)
		result, taskStore, _, err := runRecoveryApply(t, before, before.Repository, request)
		if err != nil || taskStore.commitTaskCalls != 1 || result.Task.Blocker == nil ||
			result.Task.Blocker.Cause != domain.RecoveryConflicting {
			t.Fatalf("contradictory result = %#v, commits %d, error %v", result, taskStore.commitTaskCalls, err)
		}
	})

	t.Run("superseded source maps to stable stale errors", func(t *testing.T) {
		source := applicationTaskAtPhase(t, domain.PhaseIntake, 3, testContract(t), nil)
		request := recoveryRequestForSource(source, "request-recovery-envelope", "operation-superseded", assessPayload)
		cases := []struct {
			name   string
			stored func(domain.Task) domain.Task
			want   error
		}{
			{name: "revision", want: domain.ErrRevisionConflict, stored: func(task domain.Task) domain.Task {
				task.Revision++
				task.Phase = domain.PhaseAssess
				action, err := workflow.BuildNextAction(task.Phase, task.TaskID, task.Revision, task.Repository.BindingDigest, "action-superseded", task.UpdatedAt)
				if err != nil {
					t.Fatal(err)
				}
				task.CurrentAction = &action
				return task
			}},
			{name: "action", want: domain.ErrActionStale, stored: func(task domain.Task) domain.Task {
				action, err := workflow.BuildNextAction(task.Phase, task.TaskID, task.Revision, task.Repository.BindingDigest, "action-superseded", task.UpdatedAt)
				if err != nil {
					t.Fatal(err)
				}
				task.CurrentAction = &action
				return task
			}},
		}
		for _, tt := range cases {
			t.Run(tt.name, func(t *testing.T) {
				stored := tt.stored(source.Clone())
				if err := workflow.ValidateTask(stored); err != nil {
					t.Fatal(err)
				}
				result, taskStore, observer, err := runRecoveryApply(t, stored, stored.Repository, request)
				requireError(t, err, tt.want)
				if !reflect.DeepEqual(result, ApplyActionResult{}) || taskStore.commitTaskCalls != 0 || observer.calls != 1 {
					t.Fatalf("superseded side effects = %#v/%d/%d", result, taskStore.commitTaskCalls, observer.calls)
				}
			})
		}
	})

	t.Run("an already blocked task is returned without another blocker", func(t *testing.T) {
		blocked := applicationBlockedTask(t)
		source := applicationTaskAtPhase(t, *blocked.ResumePhase, blocked.Revision-1, blocked.Contract, nil)
		request := recoveryRequestForSource(source, "request-recovery-envelope", "operation-existing-blocker", assessPayload)
		result, taskStore, _, err := runRecoveryApply(t, blocked, blocked.Repository, request)
		if err != nil || !reflect.DeepEqual(result.Task, blocked) || taskStore.commitTaskCalls != 0 {
			t.Fatalf("existing blocker result = %#v, commits %d, error %v", result, taskStore.commitTaskCalls, err)
		}
	})

	t.Run("exact proof wins for advanced and terminal tasks", func(t *testing.T) {
		cases := []struct {
			name    string
			before  domain.Task
			payload workflow.ActionPayload
		}{
			{name: "advanced", before: applicationTaskAtPhase(t, domain.PhaseIntake, 1, testContract(t), nil), payload: assessPayload},
			{name: "terminal", before: applicationTaskAtPhase(t, domain.PhaseHandoff, 7, testContract(t), applicationDeliveryEvidence(t)), payload: applicationCompletePayload(t)},
		}
		for _, tt := range cases {
			t.Run(tt.name, func(t *testing.T) {
				normalStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return tt.before.Clone(), nil }}
				normal := recoveryTestService(t, normalStore, &fixedRepositoryObserver{binding: tt.before.Repository})
				original := applyRequestForTask(tt.before, "operation-exact-proof", tt.payload)
				committed, err := normal.ApplyAction(ctx, original)
				if err != nil {
					t.Fatal(err)
				}
				recoveryRequest := original
				recoveryRequest.RequestID = "request-recovery-envelope"
				recoveryRequest.RecoveryApply = &RecoveryApplyInput{OperationID: original.RequestID, SourcePhase: tt.before.Phase}
				result, recoveryStore, _, err := runRecoveryApply(t, committed.Task, committed.Task.Repository, recoveryRequest)
				if err != nil || !reflect.DeepEqual(result.Task, committed.Task) || recoveryStore.commitTaskCalls != 0 {
					t.Fatalf("exact proof result = %#v, commits %d, error %v", result, recoveryStore.commitTaskCalls, err)
				}
			})
		}
	})
}

func TestResolveBlockerClosedContract(t *testing.T) {
	ctx := context.Background()
	blocked := applicationBlockedTask(t)
	history := domain.EvidenceSummary{
		EvidenceID: "evidence-history", Source: domain.EvidenceSourceHostObserved, Name: "assessment_summary",
		Status: domain.EvidenceObserved, Summary: "history remains retained", Digest: domain.Digest(strings.Repeat("7", 64)), RecordedAt: blocked.UpdatedAt,
	}
	blocked.Evidence = append(blocked.Evidence, history)
	if err := workflow.ValidateTask(blocked); err != nil {
		t.Fatal(err)
	}

	payload := validResolvePayload(blocked)
	t.Run("a satisfied condition still requires explicit apply", func(t *testing.T) {
		taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return blocked.Clone(), nil }}
		observer := &fixedRepositoryObserver{binding: blocked.Repository}
		service := recoveryTestService(t, taskStore, observer)
		read, err := service.GetTask(ctx, GetTaskRequest{Host: blocked.OriginHost, TaskID: blocked.TaskID})
		if err != nil || !reflect.DeepEqual(read.Task, blocked) || read.RecoveryAssessment != nil || observer.calls != 0 || taskStore.commitTaskCalls != 0 {
			t.Fatalf("blocked read = %#v, observations %d, commits %d, error %v", read, observer.calls, taskStore.commitTaskCalls, err)
		}
	})

	t.Run("exact restoration resolves through the one apply API", func(t *testing.T) {
		request := applyRequestForTask(blocked, "request-resolve", payload)
		result, taskStore, _, err := runRecoveryApply(t, blocked, blocked.Repository, request)
		if err != nil {
			t.Fatal(err)
		}
		after := result.Task
		if taskStore.commitTaskCalls != 1 || after.Phase != *blocked.ResumePhase || after.Revision != blocked.Revision+1 ||
			after.Blocker != nil || after.ResumePhase != nil || after.CurrentAction == nil ||
			after.CurrentAction.ActionID == blocked.CurrentAction.ActionID || after.CurrentAction.Kind == domain.ActionResolveBlocker ||
			len(after.Evidence) != len(blocked.Evidence)+1 || !reflect.DeepEqual(after.Evidence[:len(blocked.Evidence)], blocked.Evidence) ||
			after.Repository.BindingDigest != blocked.Repository.BindingDigest || after.LastOperation == nil ||
			after.LastOperation.OperationID != request.RequestID || taskStore.commits[0].Claim != store.ClaimRetain {
			t.Fatalf("resolved task = %#v, mutation %#v", after, taskStore.commits)
		}
		resolution := after.Evidence[len(after.Evidence)-1]
		validated, validateErr := workflow.ValidatePayload(domain.PhaseBlocked, domain.ActionResolveBlocker, payload)
		if validateErr != nil {
			t.Fatal(validateErr)
		}
		canonicalDigest := sha256.Sum256(validated.CanonicalBytes)
		wantResolutionDigest := domain.Digest(hex.EncodeToString(canonicalDigest[:]))
		if resolution.Name != "blocker_resolution" || resolution.Source != domain.EvidenceSourceHostObserved ||
			resolution.Status != domain.EvidenceObserved || resolution.Summary != "repository binding restored" ||
			resolution.CommandCount != 0 || resolution.FullSuite || resolution.Digest != wantResolutionDigest {
			t.Fatalf("resolution evidence = %#v", resolution)
		}
	})

	t.Run("closed validation and stale facts never write", func(t *testing.T) {
		var typedNil *workflow.ResolveBlockerPayload
		otherDigest := domain.Digest(strings.Repeat("8", 64))
		cases := []struct {
			name         string
			fresh        domain.RepositoryBinding
			observeFresh bool
			mutate       func(*ApplyActionRequest)
			want         error
		}{
			{name: "stale revision", fresh: blocked.Repository, want: domain.ErrRevisionConflict, mutate: func(r *ApplyActionRequest) { r.ExpectedRevision++ }},
			{name: "stale action", fresh: blocked.Repository, want: domain.ErrActionStale, mutate: func(r *ApplyActionRequest) { r.ActionID = "action-stale" }},
			{name: "stale blocker", fresh: blocked.Repository, want: domain.ErrActionStale, mutate: func(r *ApplyActionRequest) {
				p := r.Payload.(workflow.ResolveBlockerPayload)
				p.BlockerID = "blocker-stale"
				r.Payload = p
			}},
			{name: "stale condition", fresh: blocked.Repository, want: domain.ErrActionStale, mutate: func(r *ApplyActionRequest) {
				p := r.Payload.(workflow.ResolveBlockerPayload)
				p.ResolutionEvidence.Condition.ExpectedBindingDigest = otherDigest
				r.Payload = p
			}},
			{name: "stale caller observed digest", fresh: blocked.Repository, want: domain.ErrRepositoryDrift, mutate: func(r *ApplyActionRequest) {
				p := r.Payload.(workflow.ResolveBlockerPayload)
				p.ResolutionEvidence.ObservedBindingDigest = otherDigest
				r.Payload = p
			}},
			{name: "worktree not restored", fresh: changeApplicationWorktree(blocked.Repository), observeFresh: true, want: domain.ErrRepositoryDrift},
			{name: "identity changed", fresh: changeApplicationIdentity(blocked.Repository), observeFresh: true, want: domain.ErrRepositoryDrift},
			{name: "common directory changed", fresh: changeApplicationCommonDirectory(blocked.Repository), observeFresh: true, want: domain.ErrRepositoryDrift},
			{name: "branch changed", fresh: changeApplicationBranch(blocked.Repository), observeFresh: true, want: domain.ErrRepositoryDrift},
			{name: "head changed", fresh: changeApplicationHead(blocked.Repository), observeFresh: true, want: domain.ErrRepositoryDrift},
			{name: "nil payload", fresh: blocked.Repository, want: domain.ErrInvalidArgument, mutate: func(r *ApplyActionRequest) { r.Payload = nil }},
			{name: "typed nil payload", fresh: blocked.Repository, want: domain.ErrInvalidArgument, mutate: func(r *ApplyActionRequest) { r.Payload = typedNil }},
			{name: "wrong concrete payload", fresh: blocked.Repository, want: domain.ErrInvalidArgument, mutate: func(r *ApplyActionRequest) {
				r.Payload = workflow.AssessTaskPayload{Result: domain.ActionResultSucceeded, Summary: "wrong", VerificationBudgetAcknowledged: true}
			}},
			{name: "wrong result", fresh: blocked.Repository, want: domain.ErrInvalidArgument, mutate: func(r *ApplyActionRequest) {
				p := r.Payload.(workflow.ResolveBlockerPayload)
				p.Result = domain.ActionResultFailed
				r.Payload = p
			}},
			{name: "invalid summary", fresh: blocked.Repository, want: domain.ErrInvalidArgument, mutate: func(r *ApplyActionRequest) {
				p := r.Payload.(workflow.ResolveBlockerPayload)
				p.Summary = " "
				r.Payload = p
			}},
			{name: "invalid condition enum", fresh: blocked.Repository, want: domain.ErrInvalidArgument, mutate: func(r *ApplyActionRequest) {
				p := r.Payload.(workflow.ResolveBlockerPayload)
				p.ResolutionEvidence.Condition.Kind = "future"
				r.Payload = p
			}},
			{name: "invalid digest", fresh: blocked.Repository, want: domain.ErrInvalidArgument, mutate: func(r *ApplyActionRequest) {
				p := r.Payload.(workflow.ResolveBlockerPayload)
				p.ResolutionEvidence.ObservedBindingDigest = "bad"
				r.Payload = p
			}},
		}
		for _, tt := range cases {
			t.Run(tt.name, func(t *testing.T) {
				request := applyRequestForTask(blocked, "request-resolve-invalid", payload)
				if tt.observeFresh {
					value := request.Payload.(workflow.ResolveBlockerPayload)
					value.ResolutionEvidence.ObservedBindingDigest = tt.fresh.BindingDigest
					request.Payload = value
				}
				if tt.mutate != nil {
					tt.mutate(&request)
				}
				result, taskStore, _, err := runRecoveryApply(t, blocked, tt.fresh, request)
				requireError(t, err, tt.want)
				if !reflect.DeepEqual(result, ApplyActionResult{}) || taskStore.commitTaskCalls != 0 {
					t.Fatalf("failed resolution wrote = %#v/%d", result, taskStore.commitTaskCalls)
				}
			})
		}
	})

	t.Run("store CAS loser returns revision conflict without a result", func(t *testing.T) {
		taskStore := &recordingStore{
			loadTaskFn:   func(context.Context, domain.ID) (domain.Task, error) { return blocked.Clone(), nil },
			commitTaskFn: func(context.Context, store.TaskMutation) error { return store.ErrRevisionConflict },
		}
		observer := &fixedRepositoryObserver{binding: blocked.Repository}
		service := recoveryTestService(t, taskStore, observer)
		result, err := service.ApplyAction(ctx, applyRequestForTask(blocked, "request-resolve-cas", payload))
		requireError(t, err, domain.ErrRevisionConflict)
		if !reflect.DeepEqual(result, ApplyActionResult{}) || taskStore.commitTaskCalls != 1 || observer.calls != 1 {
			t.Fatalf("CAS loser result/attempts = %#v/%d/%d", result, taskStore.commitTaskCalls, observer.calls)
		}
	})
}

func recoveryTestService(t *testing.T, taskStore store.Store, observer repository.RepositoryObserver) *Service {
	t.Helper()
	service, err := newService(taskStore, observer, func() time.Time { return testTime().Add(2 * time.Hour) }, sequentialApplicationIDs())
	if err != nil {
		t.Fatal(err)
	}
	return service
}

func runRecoveryApply(
	t *testing.T,
	task domain.Task,
	fresh domain.RepositoryBinding,
	request ApplyActionRequest,
) (ApplyActionResult, *recordingStore, *fixedRepositoryObserver, error) {
	t.Helper()
	taskStore := &recordingStore{loadTaskFn: func(context.Context, domain.ID) (domain.Task, error) { return task.Clone(), nil }}
	observer := &fixedRepositoryObserver{binding: fresh}
	service := recoveryTestService(t, taskStore, observer)
	result, err := service.ApplyAction(context.Background(), request)
	return result, taskStore, observer, err
}

func recoveryRequestForSource(
	source domain.Task,
	requestID domain.ID,
	operationID domain.ID,
	payload workflow.ActionPayload,
) ApplyActionRequest {
	request := applyRequestForTask(source, requestID, payload)
	request.RecoveryApply = &RecoveryApplyInput{OperationID: operationID, SourcePhase: source.Phase}
	return request
}

func validResolvePayload(task domain.Task) workflow.ResolveBlockerPayload {
	return workflow.ResolveBlockerPayload{
		Result:    domain.ActionResultSucceeded,
		BlockerID: task.Blocker.BlockerID,
		Summary:   "  repository binding restored  ",
		ResolutionEvidence: workflow.BlockerResolutionEvidence{
			Condition:             task.Blocker.Condition,
			ObservedBindingDigest: task.Repository.BindingDigest,
		},
	}
}

func probeForProjection(task domain.Task) *OperationProbe {
	probe := &OperationProbe{
		OperationID: "operation-projection", SourcePhase: domain.PhaseIntake, ExpectedRevision: 1,
		ActionID: "action-projection", ActionKind: domain.ActionAssessTask,
		RepositoryBindingDigest: task.Repository.BindingDigest,
	}
	if task.Phase.NormalNonTerminal() && task.CurrentAction != nil {
		probe.SourcePhase = task.Phase
		probe.ExpectedRevision = task.Revision
		probe.ActionID = task.CurrentAction.ActionID
		probe.ActionKind = task.CurrentAction.Kind
		probe.RepositoryBindingDigest = task.CurrentAction.RepositoryBindingDigest
	}
	return probe
}

func tamperApplicationBindingDigest(binding domain.RepositoryBinding) domain.RepositoryBinding {
	binding = binding.Clone()
	binding.BindingDigest = domain.Digest(strings.Repeat("6", 64))
	return binding
}

func tamperPersistedApplicationBinding(task domain.Task) domain.Task {
	task = task.Clone()
	task.Repository.BindingDigest = domain.Digest(strings.Repeat("6", 64))
	if task.CurrentAction != nil {
		task.CurrentAction.RepositoryBindingDigest = task.Repository.BindingDigest
	}
	if task.Outcome != nil {
		task.Outcome.FinalRepositoryBindingDigest = task.Repository.BindingDigest
	}
	return task
}

type applicationPersistenceCounts struct {
	Revision uint64
	Events   int
	Claims   int
}

func readApplicationPersistenceCounts(t *testing.T, databasePath string, taskID domain.ID) applicationPersistenceCounts {
	t.Helper()
	database, err := sql.Open("sqlite", databasePath)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	var result applicationPersistenceCounts
	if err := database.QueryRow(`SELECT revision FROM tasks WHERE task_id = ?`, string(taskID)).Scan(&result.Revision); err != nil {
		t.Fatal(err)
	}
	if err := database.QueryRow(`SELECT COUNT(*) FROM task_events WHERE task_id = ?`, string(taskID)).Scan(&result.Events); err != nil {
		t.Fatal(err)
	}
	if err := database.QueryRow(`SELECT COUNT(*) FROM repository_claims WHERE task_id = ?`, string(taskID)).Scan(&result.Claims); err != nil {
		t.Fatal(err)
	}
	return result
}

func applicationDeliveryEvidence(t *testing.T) []domain.EvidenceSummary {
	t.Helper()
	now := testTime()
	return []domain.EvidenceSummary{
		{EvidenceID: "evidence-automated", Source: domain.EvidenceSourceAutomated, Name: "targeted", Status: domain.EvidencePassed, Summary: "targeted check passed", Digest: domain.Digest(strings.Repeat("3", 64)), CommandCount: 1, RecordedAt: now},
		{EvidenceID: "evidence-manual", Source: domain.EvidenceSourceUser, Name: "review", Status: domain.EvidencePassed, Summary: "manual review passed", Digest: domain.Digest(strings.Repeat("4", 64)), RecordedAt: now},
	}
}

func applicationCompletePayload(t *testing.T) workflow.CompleteHandoffPayload {
	t.Helper()
	contract := testContract(t)
	return workflow.CompleteHandoffPayload{
		Result: domain.ActionResultComplete, Summary: "delivery completed",
		Delivery: &workflow.DeliveryData{
			Acceptance:           []domain.OutcomeCriterion{{Criterion: contract.AcceptanceCriteria()[0], Status: domain.CriterionSatisfied}},
			AutomatedEvidenceIDs: []domain.ID{"evidence-automated"}, ManualEvidenceIDs: []domain.ID{"evidence-manual"},
		},
	}
}
