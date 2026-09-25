package recovery

import (
	"errors"
	"testing"

	"github.com/Innocent-children/taskbelay/internal/domain"
)

func TestBlockerResolutionRequiresExactSavedDecisionAndReviewedPaths(t *testing.T) {
	resume := domain.NodeImplement
	base := recoveryBinding('a')
	observed := base.Clone()
	observed.TaskSurface = []domain.RepositoryChangedEntry{recoveryEntry("extra.go", 'b')}
	observed.BindingDigest = recoveryDigest('b')
	task := domain.ProcessTask{
		CurrentNode: domain.NodeBlocked, ResumeNode: &resume, Repository: base,
		Blocker:          &domain.ProcessBlocker{BlockerID: "blocker", Cause: domain.BlockerCauseFileScopeDecision, Condition: domain.BlockerCondition{Kind: domain.BlockerConditionResolveFileScope, ScopeRequestID: "scope"}},
		FileScopeRecords: []domain.FileScopeRecord{{RequestID: "scope", Decision: domain.FileScopePending, Paths: []string{"extra.go"}}},
	}
	comparison := RepositoryScopeComparison{Relation: RepositoryWorktreeOnlyChanged, ObservedDigest: observed.BindingDigest}
	payload := domain.BlockerResolutionPayload{BlockerID: "blocker", Condition: task.Blocker.Condition, ObservedBindingDigest: observed.BindingDigest, FileScopeDecision: &domain.FileScopeDecisionInput{Choice: domain.FileScopeAllowOnce, Reason: "Accept the reviewed path."}}
	if err := ValidateBlockerResolution(task, RepositoryScopeObservation{Primary: observed}, comparison, payload); err != nil {
		t.Fatal(err)
	}
	payload.FileScopeDecision.Choice = domain.FileScopeReject
	if err := ValidateBlockerResolution(task, RepositoryScopeObservation{Primary: observed}, comparison, payload); !errors.Is(err, domain.ErrRepositoryDrift) {
		t.Fatalf("reject before restoration=%v", err)
	}
	comparison.Relation, comparison.ObservedDigest = RepositoryExact, base.BindingDigest
	payload.ObservedBindingDigest = base.BindingDigest
	if err := ValidateBlockerResolution(task, RepositoryScopeObservation{Primary: base}, comparison, payload); err != nil {
		t.Fatalf("reject after restoration=%v", err)
	}
	payload.FileScopeDecision.Choice = domain.FileScopeAllowOnce
	comparison.Relation, comparison.ObservedDigest = RepositoryWorktreeOnlyChanged, observed.BindingDigest
	payload.ObservedBindingDigest = observed.BindingDigest
	observed.TaskSurface = append(observed.TaskSurface, recoveryEntry("unreviewed.go", 'c'))
	if err := ValidateBlockerResolution(task, RepositoryScopeObservation{Primary: observed}, comparison, payload); !errors.Is(err, domain.ErrRepositoryDrift) {
		t.Fatalf("unreviewed path=%v", err)
	}
	observed.TaskSurface = observed.TaskSurface[:1]
	payload.ObservedBindingDigest = recoveryDigest('d')
	if err := ValidateBlockerResolution(task, RepositoryScopeObservation{Primary: observed}, comparison, payload); !errors.Is(err, domain.ErrInvalidArgument) {
		t.Fatalf("changed saved observation=%v", err)
	}
}

func TestBlockerHistoryDecisionRejectsReplacementOrWrongBranch(t *testing.T) {
	resume := domain.NodeRequirements
	base := recoveryBinding('a')
	observed := base.Clone()
	observed.HistoryRelation = domain.RepositoryHistoryRewrite
	observed.BindingDigest = recoveryDigest('b')
	task := domain.ProcessTask{CurrentNode: domain.NodeBlocked, ResumeNode: &resume, Repository: base, WorkspaceOrigin: recoveryOrigin('a'),
		Blocker: &domain.ProcessBlocker{BlockerID: "history", Cause: domain.BlockerCauseWorkspaceHistoryConflict, ObservedBindingDigest: observed.BindingDigest, Condition: domain.BlockerCondition{Kind: domain.BlockerConditionResolveHistory}},
	}
	comparison := RepositoryScopeComparison{Relation: RepositoryForbiddenChange, ObservedDigest: observed.BindingDigest, Repositories: []RepositoryFact{{Reason: RepositoryReasonHistory}}}
	payload := domain.BlockerResolutionPayload{BlockerID: "history", Condition: task.Blocker.Condition, ObservedBindingDigest: observed.BindingDigest, HistoryResolution: &domain.WorkspaceHistoryResolutionInput{Choice: "accept_current_history", Reason: "Reviewed the history."}}
	if err := ValidateBlockerResolution(task, RepositoryScopeObservation{Primary: observed}, comparison, payload); err != nil {
		t.Fatalf("reviewed rewrite=%v", err)
	}
	comparison.Repositories[0].Reason = RepositoryReasonWorktreeInstance
	if err := ValidateBlockerResolution(task, RepositoryScopeObservation{Primary: observed}, comparison, payload); !errors.Is(err, domain.ErrWorkspaceHistoryConflict) {
		t.Fatalf("replaced instance=%v", err)
	}
	comparison.Repositories[0].Reason = RepositoryReasonHistory
	branch := "other"
	observed.CurrentBranch = &branch
	if err := ValidateBlockerResolution(task, RepositoryScopeObservation{Primary: observed}, comparison, payload); !errors.Is(err, domain.ErrWorkspaceHistoryConflict) {
		t.Fatalf("wrong branch=%v", err)
	}
	observed.CurrentBranch = base.CurrentBranch
	observed.BaseCommitAncestor = false
	if err := ValidateBlockerResolution(task, RepositoryScopeObservation{Primary: observed}, comparison, payload); !errors.Is(err, domain.ErrWorkspaceHistoryConflict) {
		t.Fatalf("missing base ancestor=%v", err)
	}
}
