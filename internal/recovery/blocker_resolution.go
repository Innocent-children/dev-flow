package recovery

import "github.com/Innocent-children/dev-flow/internal/domain"

/**
 * Ordinary submission and recovery validate the same saved decision against
 * the same repository observation. Accepting history preserves its real relation.
 */
func ValidateBlockerResolution(task domain.ProcessTask, observed RepositoryScopeObservation, comparison RepositoryScopeComparison, payload domain.BlockerResolutionPayload) error {
	blocker := task.Blocker
	if blocker == nil || task.CurrentNode != domain.NodeBlocked || task.ResumeNode == nil ||
		blocker.Cause == domain.BlockerCauseTaskRelocationPending ||
		payload.RelocationID != "" || len(payload.RelocationDestinations) != 0 {
		return domain.ErrInvalidArgument
	}
	fileScope := blocker.Cause == domain.BlockerCauseFileScopeDecision
	history := blocker.Cause == domain.BlockerCauseWorkspaceHistoryConflict
	if fileScope != (payload.FileScopeDecision != nil) || history != (payload.HistoryResolution != nil) {
		return domain.ErrInvalidArgument
	}
	if fileScope {
		if payload.FileScopeDecision.Validate() != nil {
			return domain.ErrInvalidArgument
		}
		var pending *domain.FileScopeRecord
		for i := range task.FileScopeRecords {
			record := &task.FileScopeRecords[i]
			if record.RequestID == blocker.Condition.ScopeRequestID && record.Decision == domain.FileScopePending {
				pending = record
				break
			}
		}
		if pending == nil {
			return domain.ErrInvalidArgument
		}
		unexplained := task.UnexplainedChangedPaths(observed.Primary, observed.Additional)
		if comparison.Relation == RepositoryForbiddenChange || !containsEveryPath(pending.Paths, unexplained) ||
			payload.FileScopeDecision.Choice == domain.FileScopeReject && len(unexplained) != 0 {
			return domain.ErrRepositoryDrift
		}
	} else if history {
		if payload.HistoryResolution.Validate() != nil {
			return domain.ErrInvalidArgument
		}
		for _, fact := range comparison.Repositories {
			if fact.Reason == RepositoryReasonWorktreeInstance {
				return domain.ErrWorkspaceHistoryConflict
			}
		}
		if !scopeAtRetainedBranch(task, observed) ||
			comparison.ObservedDigest != blocker.ObservedBindingDigest &&
				comparison.ObservedDigest != blocker.Condition.ExpectedBindingDigest &&
				comparison.Relation == RepositoryForbiddenChange {
			return domain.ErrWorkspaceHistoryConflict
		}
	} else if comparison.Relation != RepositoryExact {
		return domain.ErrRepositoryDrift
	}
	if payload.BlockerID != blocker.BlockerID || payload.Condition != blocker.Condition ||
		payload.ObservedBindingDigest != comparison.ObservedDigest {
		return domain.ErrInvalidArgument
	}
	return nil
}

func scopeAtRetainedBranch(task domain.ProcessTask, observed RepositoryScopeObservation) bool {
	match := func(origin domain.WorkspaceOrigin, binding domain.RepositoryBinding) bool {
		return !binding.Detached && binding.CurrentBranch != nil && *binding.CurrentBranch == origin.TaskBranch && binding.BaseCommitAncestor
	}
	if !match(task.WorkspaceOrigin, observed.Primary) || len(task.AdditionalRepositories) != len(observed.Additional) {
		return false
	}
	for i, entry := range task.AdditionalRepositories {
		if !match(entry.Origin, observed.Additional[i].Binding) {
			return false
		}
	}
	return true
}
