package repository

import "github.com/Innocent-children/taskbelay/internal/domain"

/**
 * WorkspaceOriginViolations explains the same source and branch rules used by
 * workspace observation, before a Host starts a Task with that origin.
 */
func WorkspaceOriginViolations(path string, value WorkspaceOriginSelection) []domain.ContractViolation {
	var out []domain.ContractViolation
	add := func(member string, rule domain.ViolationRule, message string) {
		out = append(out, domain.ExplainedViolation(path+"."+member, rule, message))
	}
	if !value.Mode.IsValid() {
		add("mode", domain.RuleEnumValueInvalid, "mode must be new_branch, current_branch or dedicated_worktree")
	}
	if value.SourceType != "local" && value.SourceType != "remote" {
		add("source_type", domain.RuleEnumValueInvalid, "source_type must be local or remote")
	} else if value.Mode.IsValid() && value.Mode != domain.WorkspaceModeDedicatedWorktree && value.SourceType != "local" {
		add("source_type", domain.RuleMemberDependency, "new_branch and current_branch require a local source")
	}
	if !domain.ValidWorkspaceSource(value.SourceType, value.RemoteName, value.CarryChanges) {
		if value.SourceType == "remote" && value.CarryChanges {
			add("carry_changes", domain.RuleMemberDependency, "a remote source cannot carry local changes")
		}
		if value.SourceType == "local" && value.RemoteName != "" {
			add("remote_name", domain.RuleMemberDependency, "remote_name must be empty for a local source")
		} else if value.SourceType == "remote" && !validRemoteRefName(value.RemoteName) {
			add("remote_name", domain.RuleValueFormat, "a remote source requires a remote name of at most 128 letters, digits, dots, underscores or hyphens, excluding . and ..")
		}
	}
	if !validBranchRefName(value.BaseBranch) {
		add("base_branch", domain.RuleValueFormat, "base_branch must be a valid Git branch name of at most 4096 bytes, without whitespace, empty or dot-prefixed components, .lock suffixes or Git ref metacharacters")
	}
	if !validBranchRefName(value.TaskBranch) {
		add("task_branch", domain.RuleValueFormat, "task_branch must be a valid Git branch name of at most 4096 bytes, without whitespace, empty or dot-prefixed components, .lock suffixes or Git ref metacharacters")
	} else if value.Mode == domain.WorkspaceModeCurrentBranch && value.BaseBranch != value.TaskBranch {
		add("task_branch", domain.RuleMemberDependency, "current_branch requires task_branch to equal base_branch")
	} else if value.Mode == domain.WorkspaceModeNewBranch && value.BaseBranch == value.TaskBranch {
		add("task_branch", domain.RuleMemberDependency, "new_branch requires task_branch to differ from base_branch")
	}
	if !validGitObjectID(value.BaseCommit) {
		add("base_commit", domain.RuleValueFormat, "base_commit must contain exactly 40 or 64 lowercase hexadecimal characters")
	}
	if !value.ProvisioningReceiptID.IsValid() {
		add("provisioning_receipt_id", domain.RuleIdentifierInvalid, domain.RuleIdentifierInvalid.Message())
	}
	return out
}
