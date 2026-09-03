package application

import (
	"strings"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func applicationWorkspaceFixture(now time.Time, root string, marker byte) (domain.WorkspaceOrigin, domain.RepositoryBinding, WorkspaceOriginInput) {
	digest := domain.Digest(strings.Repeat(string(marker), 64))
	head := strings.Repeat(string(marker), 40)
	branch := "feature/" + string(marker)
	origin := domain.WorkspaceOrigin{
		Mode: domain.WorkspaceModeDedicatedWorktree, RemoteName: "origin", BaseBranch: "main", BaseCommit: head,
		TaskBranch: branch, SourceRepositoryGroupDigest: digest, CanonicalWorktreeRoot: root,
		WorktreeGitDirDigest: digest, ProvisioningReceiptID: domain.ID("receipt-" + string(marker)),
	}
	binding := domain.RepositoryBinding{
		WorktreeInstanceDigest: digest, IdentityDigest: digest, HistoryDigest: digest, ContentDigest: digest,
		CurrentBranch: &branch, CurrentHead: head, HeadTree: head, HistoryRelation: domain.RepositoryHistoryExact,
		BaseCommitAncestor: true, ObservedAt: now, BindingDigest: digest,
	}
	input := WorkspaceOriginInput{
		Mode: origin.Mode, RemoteName: origin.RemoteName, BaseBranch: origin.BaseBranch, BaseCommit: origin.BaseCommit,
		TaskBranch: origin.TaskBranch, ProvisioningReceiptID: origin.ProvisioningReceiptID,
	}
	return origin, binding, input
}

func currentActionApplyRequest(task domain.ProcessTask, requestID domain.ID, payload []byte) ApplyActionRequest {
	action := task.CurrentAction
	return ApplyActionRequest{
		RequestID: requestID, Host: task.OriginHost, TaskID: task.TaskID, ExpectedRevision: task.Revision,
		ActionID: action.ActionID, ActionKind: action.Kind, ProcessID: action.Process.ID,
		ProcessDefinitionDigest: action.Process.DefinitionDigest, SourceCursor: action.NodeID,
		RepositoryBindingDigest: action.RepositoryBindingDigest, IssuanceIdentityDigest: action.IssuanceIdentityDigest,
		IssuanceHistoryDigest: action.IssuanceHistoryDigest, IssuanceContentDigest: action.IssuanceContentDigest,
		Payload: payload,
	}
}
