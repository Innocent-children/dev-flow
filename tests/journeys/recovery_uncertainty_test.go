package journeys

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestBlockedRecoveryRestartRequiresExactIssuanceRestoration(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	databasePath := filepath.Join(root, "blocked-recovery-restart.db")
	repositoryPath := filepath.Join(root, "repository")
	initializeRestartRepository(t, repositoryPath)
	cleanRepository := captureRecoveryRepositorySnapshot(t, repositoryPath)
	first := openRecoveryJourneyCore(t, ctx, databasePath)
	task := openRecoveryJourneyTask(t, ctx, first, repositoryPath)
	apply := func(before domain.Task, operationID domain.ID, payload workflow.ActionPayload) domain.Task {
		t.Helper()
		result, err := first.service.ApplyAction(
			ctx,
			recoveryJourneyApplyRequest(t, before, operationID, payload),
		)
		if err != nil {
			t.Fatalf("prepare blocked restart task: %v", err)
		}
		return result.Task
	}
	task = apply(task, "operation-blocked-restart-assess", recoveryJourneyAssessPayload())
	source := apply(task, "operation-blocked-restart-plan", workflow.PlanChangePayload{
		Result: domain.ActionResultSucceeded, Summary: "blocked restart plan",
		Steps:                []string{"recover the representative partial implementation"},
		ExpectedChangedPaths: []string{"README.md"},
		VerificationSteps:    []string{"restart and resolve the blocker"},
	})
	if source.Phase != domain.PhasePlan || source.CurrentAction == nil ||
		source.CurrentAction.Kind != domain.ActionImplementChange {
		t.Fatalf("blocked restart source = %#v", source)
	}
	if err := os.WriteFile(filepath.Join(repositoryPath, "README.md"), []byte("partial blocked work\n"), 0o644); err != nil {
		t.Fatalf("construct partial blocked worktree: %v", err)
	}
	const blockerOperationID = domain.ID("operation-blocked-restart-partial")
	partialRequest := recoveryJourneyApplyRequest(t, source, blockerOperationID, nil)
	partialProbe := recoveryJourneyProbe(t, partialRequest, source.Phase)
	beforeRead := readRecoveryJourneyDatabaseFacts(t, databasePath, source.TaskID, blockerOperationID)
	read, err := first.service.GetTask(ctx, application.GetTaskRequest{
		Host: source.OriginHost, TaskID: source.TaskID, OperationProbe: partialProbe,
	})
	if err != nil || read.RecoveryAssessment == nil ||
		read.RecoveryAssessment.Classification != domain.RecoveryPartiallyCompleted ||
		!reflect.DeepEqual(read.Task, source) {
		t.Fatalf("partial blocker read = %#v, error %v", read, err)
	}
	if afterRead := readRecoveryJourneyDatabaseFacts(t, databasePath, source.TaskID, blockerOperationID); afterRead != beforeRead {
		t.Fatalf("partial blocker read wrote persistence: before=%#v after=%#v", beforeRead, afterRead)
	}
	partialRequest.RequestID = "request-blocked-restart-envelope"
	partialRequest.RecoveryApply = &application.RecoveryApplyInput{
		OperationID: blockerOperationID,
		SourcePhase: source.Phase,
	}
	blockedResult, err := first.service.ApplyAction(ctx, partialRequest)
	if err != nil {
		t.Fatalf("enter BLOCKED before restart: %v", err)
	}
	blocked := blockedResult.Task
	if blocked.Phase != domain.PhaseBlocked || blocked.Revision != source.Revision+1 ||
		blocked.Blocker == nil || blocked.ResumePhase == nil || *blocked.ResumePhase != source.Phase ||
		blocked.Blocker.Condition.Kind != domain.BlockerConditionRestoreIssuanceBinding ||
		blocked.Blocker.Condition.ExpectedBindingDigest != source.Repository.BindingDigest ||
		blocked.CurrentAction == nil || blocked.CurrentAction.Kind != domain.ActionResolveBlocker ||
		blocked.LastOperation == nil || blocked.LastOperation.OperationID != blockerOperationID ||
		blocked.Repository.BindingDigest != source.Repository.BindingDigest {
		t.Fatalf("blocked task before restart = %#v", blocked)
	}
	beforeRestartFacts := readRecoveryJourneyDatabaseFacts(t, databasePath, source.TaskID, blockerOperationID)
	if beforeRestartFacts.taskCount != 1 || beforeRestartFacts.eventCount != 4 ||
		beforeRestartFacts.matchingEventCount != 1 || beforeRestartFacts.claimCount != 1 {
		t.Fatalf("blocked persistence before restart = %#v", beforeRestartFacts)
	}
	firstStore := first.taskStore
	firstObserver := first.observer
	firstService := first.service
	first.close(t)

	reopened := openRecoveryJourneyCore(t, ctx, databasePath)
	if reopened.taskStore == firstStore || reopened.observer == firstObserver || reopened.service == firstService {
		t.Fatal("blocked restart reused Store, observer, or Application Service")
	}
	restarted, err := reopened.service.GetTask(ctx, application.GetTaskRequest{
		Host: blocked.OriginHost, TaskID: blocked.TaskID,
	})
	if err != nil || !reflect.DeepEqual(restarted.Task, blocked) || restarted.RecoveryAssessment != nil {
		t.Fatalf("blocked task after restart = %#v, error %v", restarted, err)
	}
	if afterRestartFacts := readRecoveryJourneyDatabaseFacts(t, databasePath, blocked.TaskID, blockerOperationID); afterRestartFacts != beforeRestartFacts {
		t.Fatalf("blocked restart changed persistence: before=%#v after=%#v", beforeRestartFacts, afterRestartFacts)
	}

	dirtyBeforeNegative := captureRecoveryRepositorySnapshot(t, repositoryPath)
	negativePayload := workflow.ResolveBlockerPayload{
		Result:    domain.ActionResultSucceeded,
		BlockerID: blocked.Blocker.BlockerID,
		Summary:   "repository is not yet restored",
		ResolutionEvidence: workflow.BlockerResolutionEvidence{
			Condition:             blocked.Blocker.Condition,
			ObservedBindingDigest: blocked.Blocker.ObservedBindingDigest,
		},
	}
	negativeRequest := recoveryJourneyApplyRequest(
		t,
		restarted.Task,
		"operation-blocked-restart-negative",
		negativePayload,
	)
	negativeResult, err := reopened.service.ApplyAction(ctx, negativeRequest)
	if !errors.Is(err, domain.ErrRepositoryDrift) ||
		!reflect.DeepEqual(negativeResult, application.ApplyActionResult{}) {
		t.Fatalf("non-exact blocker resolution = %#v, error %v", negativeResult, err)
	}
	if afterNegative := readRecoveryJourneyDatabaseFacts(t, databasePath, blocked.TaskID, blockerOperationID); afterNegative != beforeRestartFacts {
		t.Fatalf("non-exact resolution changed persistence: before=%#v after=%#v", beforeRestartFacts, afterNegative)
	}
	requireRecoveryRepositoryUnchanged(t, dirtyBeforeNegative, repositoryPath)
	afterNegative, err := reopened.service.GetTask(ctx, application.GetTaskRequest{
		Host: blocked.OriginHost, TaskID: blocked.TaskID,
	})
	if err != nil || !reflect.DeepEqual(afterNegative.Task, blocked) {
		t.Fatalf("non-exact resolution changed blocker: %#v, error %v", afterNegative, err)
	}

	if err := os.WriteFile(filepath.Join(repositoryPath, "README.md"), []byte("restart journey\n"), 0o644); err != nil {
		t.Fatalf("restore issuance worktree: %v", err)
	}
	exactPayload := workflow.ResolveBlockerPayload{
		Result:    domain.ActionResultSucceeded,
		BlockerID: blocked.Blocker.BlockerID,
		Summary:   "issuance binding restored after restart",
		ResolutionEvidence: workflow.BlockerResolutionEvidence{
			Condition:             blocked.Blocker.Condition,
			ObservedBindingDigest: blocked.Repository.BindingDigest,
		},
	}
	const resolutionOperationID = domain.ID("operation-blocked-restart-resolve")
	resolvedResult, err := reopened.service.ApplyAction(
		ctx,
		recoveryJourneyApplyRequest(t, afterNegative.Task, resolutionOperationID, exactPayload),
	)
	if err != nil {
		t.Fatalf("resolve exact issuance binding after restart: %v", err)
	}
	resolved := resolvedResult.Task
	if resolved.TaskID != blocked.TaskID || resolved.Revision != blocked.Revision+1 ||
		resolved.Phase != source.Phase || resolved.Blocker != nil || resolved.ResumePhase != nil ||
		resolved.CurrentAction == nil || resolved.CurrentAction.Kind != domain.ActionImplementChange ||
		resolved.Repository.BindingDigest != source.Repository.BindingDigest ||
		resolved.Repository.RepositoryIdentity != source.Repository.RepositoryIdentity ||
		resolved.LastOperation == nil || resolved.LastOperation.OperationID != resolutionOperationID ||
		len(resolved.Evidence) != len(blocked.Evidence)+1 {
		t.Fatalf("resolved task after restart = %#v", resolved)
	}
	resolvedFacts := readRecoveryJourneyDatabaseFacts(t, databasePath, blocked.TaskID, resolutionOperationID)
	if resolvedFacts.taskCount != 1 || resolvedFacts.revision != blocked.Revision+1 ||
		resolvedFacts.eventCount != beforeRestartFacts.eventCount+1 ||
		resolvedFacts.matchingEventCount != 1 || resolvedFacts.claimCount != 1 ||
		resolvedFacts.claimIdentity != string(source.Repository.RepositoryIdentity) {
		t.Fatalf("resolved persistence after restart = %#v", resolvedFacts)
	}
	requireRecoveryRepositoryUnchanged(t, cleanRepository, repositoryPath)
}

func TestTwoIndependentCoreHandlesCommitSameActionAtMostOnce(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), domain.SQLiteBusyTimeout+2*time.Second)
	defer cancel()
	root := t.TempDir()
	databasePath := filepath.Join(root, "two-handle-apply.db")
	repositoryPath := filepath.Join(root, "repository")
	initializeRestartRepository(t, repositoryPath)
	repositoryBefore := captureRecoveryRepositorySnapshot(t, repositoryPath)
	first := openRecoveryJourneyCore(t, ctx, databasePath)
	source := openRecoveryJourneyTask(t, ctx, first, repositoryPath)
	second := openRecoveryJourneyCore(t, ctx, databasePath)
	if first == second || first.taskStore == second.taskStore || first.service == second.service ||
		first.observer == second.observer {
		t.Fatal("two-handle race reused a Store, Application Service, or Repository Observer")
	}
	payload := recoveryJourneyAssessPayload()
	firstRequest := recoveryJourneyApplyRequest(t, source, "operation-two-handle-first", payload)
	secondRequest := recoveryJourneyApplyRequest(t, source, "operation-two-handle-second", payload)
	if firstRequest.ActionID != secondRequest.ActionID ||
		firstRequest.ExpectedRevision != secondRequest.ExpectedRevision ||
		firstRequest.RepositoryBindingDigest != secondRequest.RepositoryBindingDigest ||
		!reflect.DeepEqual(firstRequest.Payload, secondRequest.Payload) {
		t.Fatal("two-handle Application requests do not share current action facts")
	}

	type applyResult struct {
		operationID domain.ID
		result      application.ApplyActionResult
		err         error
	}
	ready := make(chan struct{}, 2)
	start := make(chan struct{})
	results := make(chan applyResult, 2)
	var workers sync.WaitGroup
	run := func(service *application.Service, request application.ApplyActionRequest) {
		defer workers.Done()
		ready <- struct{}{}
		select {
		case <-start:
		case <-ctx.Done():
			results <- applyResult{operationID: request.RequestID, err: ctx.Err()}
			return
		}
		result, err := service.ApplyAction(ctx, request)
		results <- applyResult{operationID: request.RequestID, result: result, err: err}
	}
	workers.Add(2)
	go run(first.service, firstRequest)
	go run(second.service, secondRequest)
	for range 2 {
		select {
		case <-ready:
		case <-ctx.Done():
			t.Fatalf("two-handle workers did not reach the start barrier: %v", ctx.Err())
		}
	}
	close(start)
	var observed [2]applyResult
	for index := range observed {
		select {
		case observed[index] = <-results:
		case <-ctx.Done():
			t.Fatalf("two-handle apply did not finish: %v", ctx.Err())
		}
	}
	workers.Wait()
	var winner, loser applyResult
	switch {
	case observed[0].err == nil &&
		(errors.Is(observed[1].err, domain.ErrRevisionConflict) || errors.Is(observed[1].err, domain.ErrActionStale)):
		winner, loser = observed[0], observed[1]
	case observed[1].err == nil &&
		(errors.Is(observed[0].err, domain.ErrRevisionConflict) || errors.Is(observed[0].err, domain.ErrActionStale)):
		winner, loser = observed[1], observed[0]
	default:
		t.Fatalf("two-handle results = (%s, %v), (%s, %v)",
			observed[0].operationID, observed[0].err, observed[1].operationID, observed[1].err)
	}
	if winner.result.Task.Revision != source.Revision+1 || winner.result.Task.Phase != domain.PhaseAssess ||
		winner.result.Task.LastOperation == nil ||
		winner.result.Task.LastOperation.OperationID != winner.operationID {
		t.Fatalf("two-handle winner = %#v", winner)
	}

	first.close(t)
	second.close(t)
	authoritativeCore := openRecoveryJourneyCore(t, ctx, databasePath)
	authoritative, err := authoritativeCore.service.GetTask(ctx, application.GetTaskRequest{
		Host: source.OriginHost, TaskID: source.TaskID,
	})
	if err != nil {
		t.Fatalf("read two-handle winner: %v", err)
	}
	finalTask := authoritative.Task
	if finalTask.Revision != source.Revision+1 || finalTask.Phase != domain.PhaseAssess ||
		finalTask.CurrentAction == nil || finalTask.CurrentAction.Kind != domain.ActionPlanChange ||
		finalTask.LastOperation == nil || finalTask.LastOperation.OperationID != winner.operationID ||
		finalTask.LastOperation.ActionID == nil || *finalTask.LastOperation.ActionID != source.CurrentAction.ActionID ||
		len(finalTask.Evidence) != len(source.Evidence)+1 ||
		finalTask.Repository.BindingDigest != source.Repository.BindingDigest {
		t.Fatalf("two-handle authoritative task = %#v", finalTask)
	}
	winnerRequest := firstRequest
	loserRequest := secondRequest
	if winner.operationID == secondRequest.RequestID {
		winnerRequest, loserRequest = secondRequest, firstRequest
	}
	winnerRead, err := authoritativeCore.service.GetTask(ctx, application.GetTaskRequest{
		Host: source.OriginHost, TaskID: source.TaskID,
		OperationProbe: recoveryJourneyProbe(t, winnerRequest, source.Phase),
	})
	if err != nil || winnerRead.RecoveryAssessment == nil ||
		winnerRead.RecoveryAssessment.Classification != domain.RecoveryCompletedAndRecorded {
		t.Fatalf("winner authoritative probe = %#v, error %v", winnerRead, err)
	}
	loserRead, err := authoritativeCore.service.GetTask(ctx, application.GetTaskRequest{
		Host: source.OriginHost, TaskID: source.TaskID,
		OperationProbe: recoveryJourneyProbe(t, loserRequest, source.Phase),
	})
	if err != nil || loserRead.RecoveryAssessment == nil ||
		loserRead.RecoveryAssessment.Classification != domain.RecoveryConflicting ||
		loserRead.RecoveryAssessment.LastOperationRelation != recovery.LastOperationContradictory ||
		loserRead.RecoveryAssessment.ActionRetrySafe {
		t.Fatalf("loser authoritative probe = %#v, error %v", loserRead, err)
	}
	winnerFacts := readRecoveryJourneyDatabaseFacts(t, databasePath, source.TaskID, winner.operationID)
	loserFacts := readRecoveryJourneyDatabaseFacts(t, databasePath, source.TaskID, loser.operationID)
	if winnerFacts.revision != source.Revision+1 || winnerFacts.eventCount != 2 ||
		winnerFacts.matchingEventCount != 1 || winnerFacts.claimCount != 1 ||
		loserFacts.matchingEventCount != 0 || loserFacts.eventCount != winnerFacts.eventCount ||
		winnerFacts.claimIdentity != string(source.Repository.RepositoryIdentity) {
		t.Fatalf("two-handle persistence: winner=%#v loser=%#v", winnerFacts, loserFacts)
	}
	requireRecoveryRepositoryUnchanged(t, repositoryBefore, repositoryPath)
}

func TestRepositoryDisappearanceDoesNotAuthorizeReplay(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	databasePath := filepath.Join(root, "repository-disappearance.db")
	repositoryPath := filepath.Join(root, "repository")
	initializeRestartRepository(t, repositoryPath)
	core := openRecoveryJourneyCore(t, ctx, databasePath)
	source := openRecoveryJourneyTask(t, ctx, core, repositoryPath)
	const operationID = domain.ID("operation-repository-disappearance")
	request := recoveryJourneyApplyRequest(t, source, operationID, nil)
	probe := recoveryJourneyProbe(t, request, source.Phase)
	beforeFacts := readRecoveryJourneyDatabaseFacts(t, databasePath, source.TaskID, operationID)

	movedPath := filepath.Join(root, "repository-moved")
	if err := os.Rename(repositoryPath, movedPath); err != nil {
		t.Fatalf("move disappearing repository fixture: %v", err)
	}
	result, err := core.service.GetTask(ctx, application.GetTaskRequest{
		Host: source.OriginHost, TaskID: source.TaskID, OperationProbe: probe,
	})
	if err == nil || !reflect.DeepEqual(result, application.GetTaskResult{}) {
		t.Fatalf("missing repository recovery read = %#v, error %v", result, err)
	}
	if _, statErr := os.Stat(repositoryPath); !errors.Is(statErr, os.ErrNotExist) {
		t.Fatalf("Core recreated the missing repository path: %v", statErr)
	}
	authoritative, err := core.service.GetTask(ctx, application.GetTaskRequest{
		Host: source.OriginHost, TaskID: source.TaskID,
	})
	if err != nil || !reflect.DeepEqual(authoritative.Task, source) || authoritative.RecoveryAssessment != nil {
		t.Fatalf("missing repository changed authoritative Task: %#v, error %v", authoritative, err)
	}
	afterFacts := readRecoveryJourneyDatabaseFacts(t, databasePath, source.TaskID, operationID)
	if afterFacts != beforeFacts || afterFacts.revision != source.Revision ||
		afterFacts.eventCount != 1 || afterFacts.matchingEventCount != 0 ||
		afterFacts.claimCount != 1 || afterFacts.claimIdentity != string(source.Repository.RepositoryIdentity) {
		t.Fatalf("missing repository changed persistence: before=%#v after=%#v", beforeFacts, afterFacts)
	}
}

func TestSamePathReplacementDoesNotRebindTask(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	databasePath := filepath.Join(root, "repository-replacement.db")
	repositoryPath := filepath.Join(root, "repository")
	initializeRestartRepository(t, repositoryPath)
	core := openRecoveryJourneyCore(t, ctx, databasePath)
	source := openRecoveryJourneyTask(t, ctx, core, repositoryPath)
	const operationID = domain.ID("operation-repository-replacement")
	request := recoveryJourneyApplyRequest(t, source, operationID, nil)
	probe := recoveryJourneyProbe(t, request, source.Phase)
	beforeFacts := readRecoveryJourneyDatabaseFacts(t, databasePath, source.TaskID, operationID)

	if err := os.Rename(repositoryPath, filepath.Join(root, "repository-a-moved")); err != nil {
		t.Fatalf("move repository A fixture: %v", err)
	}
	initializeRecoveryReplacementRepository(
		t,
		repositoryPath,
		filepath.Join(root, "repository-b.git"),
	)
	replacement, err := repository.NewGitObserver().Observe(ctx, repositoryPath)
	if err != nil {
		t.Fatalf("observe replacement repository B: %v", err)
	}
	if replacement.CanonicalRoot != source.Repository.CanonicalRoot ||
		replacement.GitCommonDirDigest == source.Repository.GitCommonDirDigest ||
		replacement.RepositoryIdentity == source.Repository.RepositoryIdentity {
		t.Fatalf("replacement repository identity = %#v, original=%#v", replacement, source.Repository)
	}
	replacementBefore := captureRecoveryRepositorySnapshot(t, repositoryPath)
	read, err := core.service.GetTask(ctx, application.GetTaskRequest{
		Host: source.OriginHost, TaskID: source.TaskID, OperationProbe: probe,
	})
	if err != nil {
		t.Fatalf("same-path replacement recovery read: %v", err)
	}
	if !reflect.DeepEqual(read.Task, source) || read.RecoveryAssessment == nil ||
		read.RecoveryAssessment.Classification != domain.RecoveryConflicting ||
		read.RecoveryAssessment.RepositoryRelation != recovery.RepositoryForbiddenChange ||
		read.RecoveryAssessment.ActionRetrySafe ||
		read.RecoveryAssessment.AuthoritativeBindingDigest != source.Repository.BindingDigest ||
		read.RecoveryAssessment.ObservedBindingDigest != replacement.BindingDigest {
		t.Fatalf("same-path replacement assessment = %#v", read)
	}
	afterFacts := readRecoveryJourneyDatabaseFacts(t, databasePath, source.TaskID, operationID)
	if afterFacts != beforeFacts || afterFacts.revision != source.Revision ||
		afterFacts.eventCount != 1 || afterFacts.matchingEventCount != 0 ||
		afterFacts.claimCount != 1 || afterFacts.claimIdentity != string(source.Repository.RepositoryIdentity) {
		t.Fatalf("replacement repository changed persistence: before=%#v after=%#v", beforeFacts, afterFacts)
	}
	requireRecoveryRepositoryUnchanged(t, replacementBefore, repositoryPath)
}

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
