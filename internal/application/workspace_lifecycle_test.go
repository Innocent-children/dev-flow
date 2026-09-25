package application

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/Innocent-children/taskbelay/internal/domain"
	"github.com/Innocent-children/taskbelay/internal/recovery"
	"github.com/Innocent-children/taskbelay/internal/store"
)

func TestGetNextActionCreatesObservedFileScopeBlockerOnce(t *testing.T) {
	service, memory, observer := phase5Service(t)
	task := phase5TaskAtImplement(t, service)
	observer.binding = phase5BindingWithSurface(observer.binding, []string{"internal/extra.go"}, "c")
	before := memory.commits

	result, err := service.GetNextAction(context.Background(), GetNextActionRequest{Host: domain.HostCodex, TaskID: task.TaskID})
	if err != nil || result.CurrentNode != domain.NodeBlocked || result.Blocker == nil || result.Blocker.Cause != domain.BlockerCauseFileScopeDecision {
		t.Fatalf("next=%+v err=%v", result, err)
	}
	if memory.commits != before+1 || len(memory.task.FileScopeRecords) != 1 || !memory.task.FileScopeRecords[0].Observed {
		t.Fatalf("commits=%d records=%+v", memory.commits-before, memory.task.FileScopeRecords)
	}
	revision := result.Revision
	result, err = service.GetNextAction(context.Background(), GetNextActionRequest{Host: domain.HostCodex, TaskID: task.TaskID})
	if err != nil || result.Revision != revision || memory.commits != before+1 {
		t.Fatalf("repeated next=%+v err=%v commits=%d", result, err, memory.commits-before)
	}
}

func TestWorkspaceHistoryBlockerAcceptsReviewedCurrentHistory(t *testing.T) {
	service, memory, observer := phase5Service(t)
	task := openPhase5Task(t, service)
	changed := observer.binding.Clone()
	changed.HistoryRelation = domain.RepositoryHistoryBranchChanged
	changed.HistoryDigest = digestOf("c")
	changed.BindingDigest = digestOf("c")
	observer.binding = changed
	before := memory.commits

	blocked, err := service.GetNextAction(context.Background(), GetNextActionRequest{Host: domain.HostCodex, TaskID: task.TaskID})
	if err != nil || blocked.CurrentNode != domain.NodeBlocked || blocked.Blocker == nil || blocked.Blocker.Cause != domain.BlockerCauseWorkspaceHistoryConflict || memory.commits != before+1 {
		t.Fatalf("blocked=%+v err=%v commits=%d", blocked, err, memory.commits-before)
	}
	resolved, err := service.ResolveBlockerAction(context.Background(), RecoverActionRequest{
		Host: domain.HostCodex, TaskID: task.TaskID, ActionID: blocked.Action.ActionID,
		HistoryResolution: &domain.WorkspaceHistoryResolutionInput{Choice: "accept_current_history", Reason: "Reviewed the current linear task-branch history."},
	}, "resolve-history")
	if err != nil || resolved.Task.CurrentNode != domain.NodeRequirements || resolved.Task.Blocker != nil || resolved.Task.Repository.HistoryDigest != changed.HistoryDigest {
		t.Fatalf("resolved=%+v err=%v", resolved.Task, err)
	}
	if memory.commits != before+2 || memory.lastMutation.Claim != store.ClaimRetain || resolved.Task.CurrentAction.IssuanceHistoryDigest == task.CurrentAction.IssuanceHistoryDigest {
		t.Fatalf("commits=%d mutation=%+v", memory.commits-before, memory.lastMutation)
	}
}

func TestTaskRelocationMovesBindingAndClaimOnlyAfterDestinationMatches(t *testing.T) {
	service, memory, observer := phase5Service(t)
	task := openPhase5Task(t, service)
	prepared, err := service.PrepareTaskRelocation(context.Background(), PrepareTaskRelocationRequest{
		RequestID: "prepare-relocation", Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision,
	})
	if err != nil || prepared.Task.CurrentNode != domain.NodeBlocked || prepared.Task.Relocation == nil || prepared.Task.Blocker == nil || prepared.Task.Blocker.Cause != domain.BlockerCauseTaskRelocationPending {
		t.Fatalf("prepared=%+v err=%v", prepared, err)
	}
	commits := memory.commits
	duplicate, err := service.PrepareTaskRelocation(context.Background(), PrepareTaskRelocationRequest{
		RequestID: "prepare-relocation-again", Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision,
	})
	if err != nil || duplicate.RelocationID != prepared.RelocationID || memory.commits != commits {
		t.Fatalf("duplicate=%+v err=%v commits=%d", duplicate, err, memory.commits-commits)
	}

	destinationPath := testPath("relocated")
	destinationOrigin, destinationBinding := relocatedWorkspace(task, destinationPath, "c")
	mismatched := destinationBinding.Clone()
	mismatched.ContentDigest = digestOf("d")
	mismatched.BindingDigest = digestOf("d")
	observer.origin, observer.binding = destinationOrigin, mismatched
	request := RecoverActionRequest{
		Host: domain.HostCodex, TaskID: task.TaskID, ActionID: prepared.Task.CurrentAction.ActionID,
		RelocationID:           prepared.RelocationID,
		RelocationDestinations: []domain.RelocationDestination{{Key: domain.DefaultPrimaryRepositoryKey, RepositoryPath: destinationPath}},
	}
	if _, err := service.ResolveBlockerAction(context.Background(), request, "resolve-mismatched-relocation"); !errors.Is(err, domain.ErrWorkspaceHistoryConflict) || memory.commits != commits {
		t.Fatalf("mismatch err=%v commits=%d", err, memory.commits-commits)
	}
	if memory.task.Repository.WorktreeInstanceDigest != task.Repository.WorktreeInstanceDigest || memory.task.CurrentNode != domain.NodeBlocked {
		t.Fatalf("failed relocation changed source binding: %+v", memory.task)
	}

	observer.binding = destinationBinding
	resolved, err := service.ResolveBlockerAction(context.Background(), request, "resolve-relocation")
	if err != nil || resolved.Task.CurrentNode != domain.NodeRequirements || resolved.Task.Relocation != nil || resolved.Task.Blocker != nil || resolved.Task.WorkspaceOrigin.CanonicalWorktreeRoot != destinationPath || resolved.Task.Repository.WorktreeInstanceDigest != destinationBinding.WorktreeInstanceDigest {
		t.Fatalf("resolved=%+v err=%v", resolved.Task, err)
	}
	workspace, workspaceErr := resolved.Task.EffectiveWorkspaceDigests()
	if workspaceErr != nil || resolved.Task.CurrentAction.RepositoryBindingDigest != workspace.Binding || resolved.Task.CurrentAction.IssuanceIdentityDigest != workspace.Identity || resolved.Task.CurrentAction.IssuanceHistoryDigest != workspace.History || resolved.Task.CurrentAction.IssuanceContentDigest != workspace.Content {
		t.Fatalf("workspace=%+v err=%v action=%+v", workspace, workspaceErr, resolved.Task.CurrentAction)
	}
	if memory.lastMutation.Claim != store.ClaimReplace || len(memory.lastMutation.PreviousClaims) != 1 || memory.lastMutation.PreviousClaims[0] != task.Repository.WorktreeInstanceDigest {
		t.Fatalf("claim mutation=%+v", memory.lastMutation)
	}
}

func TestAbandonTaskRequiresUnavailableWorkspaceAndRetainsLastKnownBinding(t *testing.T) {
	service, memory, observer := phase5Service(t)
	task := openPhase5Task(t, service)
	request := AbandonTaskRequest{RequestID: "abandon-task", Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision, Reason: "The dedicated worktree no longer exists."}
	before := memory.commits
	if _, err := service.AbandonTask(context.Background(), request); !errors.Is(err, domain.ErrWorkspaceUnavailable) || memory.commits != before {
		t.Fatalf("available workspace err=%v commits=%d", err, memory.commits-before)
	}

	unavailable := observer.binding.Clone()
	unavailable.WorktreeInstanceDigest = digestOf("c")
	unavailable.IdentityDigest = digestOf("c")
	unavailable.BindingDigest = digestOf("c")
	observer.binding = unavailable
	result, err := service.AbandonTask(context.Background(), request)
	if err != nil || result.Task.CurrentNode != domain.NodeCancelled || result.Task.Outcome == nil || result.Task.Outcome.Status != domain.TerminalCancelled || !reflect.DeepEqual(result.Task.Repository, task.Repository) {
		t.Fatalf("abandoned=%+v err=%v", result.Task, err)
	}
	if memory.lastMutation.Claim != store.ClaimRelease || memory.lastMutation.Event.Kind != domain.OperationAbandonTask {
		t.Fatalf("mutation=%+v", memory.lastMutation)
	}
}

func relocatedWorkspace(task domain.ProcessTask, path, seed string) (domain.WorkspaceOrigin, domain.RepositoryBinding) {
	binding := task.Repository.Clone()
	binding.WorktreeInstanceDigest = digestOf(seed)
	binding.IdentityDigest = digestOf(seed)
	binding.BindingDigest = digestOf(seed)
	origin := task.WorkspaceOrigin
	origin.CanonicalWorktreeRoot = path
	origin.WorktreeGitDirDigest = digestOf(seed)
	return origin, binding
}

func TestOpenLocalTaskRetainsCarriedSurfaceAndRequirementsAction(t *testing.T) {
	service, memory, observer := phase5Service(t)
	observer.origin.SourceType, observer.origin.RemoteName, observer.origin.CarryChanges = "local", "", true
	observer.binding = phase5BindingWithSurface(observer.binding, []string{"src/carried.go"}, "c")
	task := openPhase5Task(t, service)
	if task.WorkspaceOrigin.SourceType != "local" || !task.WorkspaceOrigin.CarryChanges || len(task.Repository.TaskSurface) != 1 || task.CurrentNode != domain.NodeRequirements {
		t.Fatalf("carried task=%+v", task)
	}
	if memory.task == nil || !memory.task.WorkspaceOrigin.CarryChanges {
		t.Fatal("local selection was not persisted")
	}
	next, err := service.GetNextAction(context.Background(), GetNextActionRequest{Host: domain.HostCodex, TaskID: task.TaskID})
	if err != nil || next.CurrentNode != domain.NodeRequirements {
		t.Fatalf("next=%+v err=%v", next, err)
	}
}

func TestBlockerResolutionRecoversStoredDecisionAfterReopen(t *testing.T) {
	for _, repositories := range []int{1, 2} {
		for _, choice := range []string{"allow_once", "expand_scope", "accept_current_history"} {
			t.Run(fmt.Sprintf("%d_repositories/%s", repositories, choice), func(t *testing.T) {
				ctx := context.Background()
				path := filepath.Join(t.TempDir(), "recovery.db")
				database, err := store.Open(ctx, path)
				if err != nil {
					t.Fatal(err)
				}
				defer func() { database.Close() }()
				now := time.Date(2026, 9, 20, 3, 0, 0, 0, time.UTC)
				root := testPath("core")
				primary := multiRepositoryBinding(now, root, 'a')
				observer := &multiRepositoryObserver{bindings: map[string]domain.RepositoryBinding{root: primary}}
				request := multiRepositoryOpenRequest("open-blocker-recovery", root, primary)
				target := root
				if repositories == 2 {
					target = testPath("docs")
					additional := multiRepositoryBinding(now, target, 'b')
					observer.bindings[target] = additional
					request.AdditionalRepositories = []AdditionalRepositoryInput{additionalRepositoryInput("docs", target, additional)}
				}
				failing := &controlCenterCommitFailureStore{SQLite: database}
				ids := sequentialTestIDs()
				service, err := newService(failing, observer, func() time.Time { return now }, ids)
				if err != nil {
					t.Fatal(err)
				}
				opened, err := service.OpenTask(ctx, request)
				if err != nil {
					t.Fatal(err)
				}
				task := applyPhase5(t, service, opened.Task, "requirements_ready", "", requirementsNodeResult("Recovery goal", []string{"Recovery works"}))
				task = applyPhase5(t, service, task, "design_ready", "", designNodeResult(1, "Shared decision validation"))
				item := workItem("work-a", []uint32{0}, nil)
				if repositories == 2 {
					item["expected_paths"] = []string{"docs::internal/file.go"}
				}
				task = applyPhase5(t, service, task, "tasks_ready", "", tasksNodeResult(1, []map[string]any{item}))
				accepted := observer.bindings[target].Clone()
				if choice == "accept_current_history" {
					accepted.HistoryRelation = domain.RepositoryHistoryRewrite
					accepted.HistoryDigest, accepted.BindingDigest = digestOf("c"), digestOf("c")
				} else {
					accepted = phase5BindingWithSurface(accepted, []string{"internal/extra.go"}, "c")
				}
				observer.bindings[target] = accepted
				blocked, err := service.GetNextAction(ctx, GetNextActionRequest{Host: task.OriginHost, TaskID: task.TaskID})
				if err != nil || blocked.CurrentNode != domain.NodeBlocked {
					t.Fatalf("blocked=%+v err=%v", blocked, err)
				}
				resolve := RecoverActionRequest{Host: task.OriginHost, TaskID: task.TaskID, ActionID: blocked.Action.ActionID}
				if choice == "accept_current_history" {
					resolve.HistoryResolution = &domain.WorkspaceHistoryResolutionInput{Choice: choice, Reason: "Accept the reviewed task branch history."}
				} else {
					resolve.FileScopeDecision = &domain.FileScopeDecisionInput{Choice: domain.FileScopeDecision(choice), Reason: "The observed path is required by this task."}
				}
				failing.fail = true
				if _, err := service.ResolveBlockerAction(ctx, resolve, "saved-resolution"); !errors.Is(err, domain.ErrStorageUnavailable) {
					t.Fatalf("injected commit error=%v", err)
				}
				stored, found, err := database.LoadActionOperation(ctx, task.TaskID)
				if err != nil || !found || stored.AppliedRevision != nil {
					t.Fatalf("staged operation=%+v found=%v err=%v", stored, found, err)
				}
				before, err := database.LoadTask(ctx, task.TaskID)
				if err != nil || before.Revision != blocked.Revision {
					t.Fatalf("stage changed task revision: %d err=%v", before.Revision, err)
				}
				events, err := database.LoadTaskEvents(ctx, task.TaskID)
				if err != nil || len(events) != int(blocked.Revision) {
					t.Fatalf("stage changed events: %d err=%v", len(events), err)
				}
				if err := database.Close(); err != nil {
					t.Fatal(err)
				}
				database, err = store.Open(ctx, path)
				if err != nil {
					t.Fatal(err)
				}
				service, err = newService(database, observer, func() time.Time { return now }, ids)
				if err != nil {
					t.Fatal(err)
				}
				drifted := phase5BindingWithSurface(accepted, []string{"internal/extra.go", "unreviewed.go"}, "d")
				observer.bindings[target] = drifted
				read, err := service.GetTask(ctx, GetTaskRequest{Host: task.OriginHost, TaskID: task.TaskID})
				if err != nil || read.RecoveryAssessment == nil || read.RecoveryAssessment.Classification != domain.RecoveryConflicting || read.RecoveryAssessment.NextAdvice != recovery.AdviceStopForRepositoryDrift {
					t.Fatalf("drift assessment=%+v err=%v", read.RecoveryAssessment, err)
				}
				unchanged, err := service.RecoverAction(ctx, resolve)
				if err != nil || !reflect.DeepEqual(before, unchanged.Task) {
					t.Fatalf("conflicting recovery changed the existing blocker: err=%v", err)
				}
				observer.bindings[target] = accepted
				read, err = service.GetTask(ctx, GetTaskRequest{Host: task.OriginHost, TaskID: task.TaskID})
				if err != nil || read.RecoveryAssessment == nil || read.RecoveryAssessment.Classification != domain.RecoveryCompletedButUnrecorded {
					t.Fatalf("restored assessment=%+v err=%v", read.RecoveryAssessment, err)
				}
				if choice == "accept_current_history" && read.RecoveryAssessment.RepositoryRelation != recovery.RepositoryForbiddenChange {
					t.Fatal("accepted history lost its actual relation")
				}
				recovered, err := service.RecoverAction(ctx, resolve)
				want := domain.NodeImplement
				if choice == "expand_scope" {
					want = domain.NodeTasks
				}
				if err != nil || recovered.Task.CurrentNode != want || recovered.Task.Revision != blocked.Revision+1 || recovered.Task.Blocker != nil || recovered.Task.ResumeNode != nil {
					t.Fatalf("recovery node=%s revision=%d err=%v", recovered.Task.CurrentNode, recovered.Task.Revision, err)
				}
				if choice == "allow_once" && (len(recovered.Task.FileScopeRecords) != 1 || !recovered.Task.FileScopeRecords[0].Consumed || len(recovered.Task.FileScopeRecords[0].AcceptedPathStates) != 1) {
					t.Fatal("recovery did not retain the accepted file state")
				}
				if choice == "expand_scope" && recovered.Task.TaskPlan != nil {
					t.Fatal("scope expansion retained the old plan")
				}
				repeated, err := service.RecoverAction(ctx, resolve)
				if err != nil || !reflect.DeepEqual(repeated.Task, recovered.Task) {
					t.Fatalf("repeated recovery changed the task: %v", err)
				}
				applied, found, err := database.LoadActionOperation(ctx, task.TaskID)
				if err != nil || !found || !applied.Commit.Equal(stored.Commit) || !applied.RecordedBy(recovered.Task) {
					t.Fatalf("saved payload or identity changed: found=%v err=%v", found, err)
				}
				events, err = database.LoadTaskEvents(ctx, task.TaskID)
				if err != nil || len(events) != int(blocked.Revision+1) || events[len(events)-1].RequestID != stored.Commit.Operation.OperationID {
					t.Fatalf("events after recovery=%d err=%v", len(events), err)
				}
				for _, identity := range store.RepositoryClaimIdentities(recovered.Task) {
					claimed, err := database.LoadActiveTask(ctx, identity)
					if err != nil || claimed.TaskID != task.TaskID {
						t.Fatalf("claim changed: %v", err)
					}
				}
			})
		}
	}
}
