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
		return domain.WithExplanation(domain.ErrInvalidArgument, "The Task has no resolvable ordinary blocker, or relocation input was supplied to the ordinary blocker path.")
	}
	fileScope := blocker.Cause == domain.BlockerCauseFileScopeDecision
	history := blocker.Cause == domain.BlockerCauseWorkspaceHistoryConflict
	if fileScope != (payload.FileScopeDecision != nil) || history != (payload.HistoryResolution != nil) {
		return domain.WithExplanation(domain.ErrInvalidArgument, "The supplied decision type does not match the current file-scope or history blocker.")
	}
	if fileScope {
		if payload.FileScopeDecision.Validate() != nil {
			return domain.WithExplanation(domain.ErrInvalidArgument, "The file-scope decision requires a supported choice and a normalized non-empty reason.")
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
			return domain.WithExplanation(domain.ErrInvalidArgument, "No pending file-scope record matches the blocker scope_request_id.")
		}
		unexplained := task.UnexplainedChangedPaths(observed.Primary, observed.Additional)
		if comparison.Relation == RepositoryForbiddenChange || !containsEveryPath(pending.Paths, unexplained) ||
			payload.FileScopeDecision.Choice == domain.FileScopeReject && len(unexplained) != 0 {
			return domain.WithExplanation(domain.ErrRepositoryDrift, "The repository changed outside the pending file-scope paths, or rejected paths are still changed.")
		}
	} else if history {
		if payload.HistoryResolution.Validate() != nil {
			return domain.WithExplanation(domain.ErrInvalidArgument, "The history decision requires accept_current_history and a normalized non-empty reason.")
		}
		for _, fact := range comparison.Repositories {
			if fact.Reason == RepositoryReasonWorktreeInstance {
				return domain.WithExplanation(domain.ErrWorkspaceHistoryConflict, "A history decision cannot accept a replacement worktree instance.")
			}
		}
		if !scopeAtRetainedBranch(task, observed) ||
			comparison.ObservedDigest != blocker.ObservedBindingDigest &&
				comparison.ObservedDigest != blocker.Condition.ExpectedBindingDigest &&
				comparison.Relation == RepositoryForbiddenChange {
			return domain.WithExplanation(domain.ErrWorkspaceHistoryConflict, "The observed history does not match the prepared history or an allowed restoration.")
		}
	} else if comparison.Relation != RepositoryExact {
		return domain.WithExplanation(domain.ErrRepositoryDrift, "The repository must be restored to the retained state before this blocker can be resolved.")
	}
	if payload.BlockerID != blocker.BlockerID || payload.Condition != blocker.Condition ||
		payload.ObservedBindingDigest != comparison.ObservedDigest {
		return domain.WithExplanation(domain.ErrInvalidArgument, "The submitted blocker identity, condition or observed binding digest differs from the current blocker and observation.")
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
