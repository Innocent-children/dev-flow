package repository

import (
	"context"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

// RepositoryObserver obtains a bounded, read-only observation of a Git
// worktree. Observe is used only to identify an already claimed worktree.
type RepositoryObserver interface {
	Observe(ctx context.Context, repositoryPath string) (domain.RepositoryBinding, error)
}

// WorkspaceOriginSelection is the exact Host-owned portion of WorkspaceOrigin.
type WorkspaceOriginSelection struct {
	Mode                  domain.WorkspaceMode
	RemoteName            string
	BaseBranch            string
	BaseCommit            string
	TaskBranch            string
	ProvisioningReceiptID domain.ID
}

// WorkspaceRepositoryObserver observes a Task worktree relative to its fixed
// base and prior authoritative observation.
type WorkspaceRepositoryObserver interface {
	RepositoryObserver
	ObserveWorkspace(context.Context, string, WorkspaceOriginSelection, *domain.RepositoryBinding) (domain.WorkspaceOrigin, domain.RepositoryBinding, error)
}

type WorktreeIdentifier interface {
	IdentifyWorkspace(context.Context, string) (string, domain.Digest, error)
}
