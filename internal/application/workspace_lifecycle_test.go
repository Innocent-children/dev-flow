package application

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
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
