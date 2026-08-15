package repository

import (
	"context"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

// RepositoryObserver obtains a bounded, read-only observation of one Git
// worktree. Implementations must not mutate either the worktree or Git state.
type RepositoryObserver interface {
	Observe(ctx context.Context, repositoryPath string) (domain.RepositoryBinding, error)
}
