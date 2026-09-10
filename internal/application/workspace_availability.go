package application

import (
	"context"
	"errors"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

type WorkspaceAvailability struct {
	Available      bool      `json:"available"`
	RepositoryPath string    `json:"repository_path"`
	TaskID         domain.ID `json:"task_id,omitempty"`
}

// CheckWorkspaceAvailability checks the directory claim before a Host changes its branch.
// A nil lookup represents a data directory whose Task database has not been created.
func CheckWorkspaceAvailability(ctx context.Context, identifier repository.WorktreeIdentifier, lookup store.WorkspaceLookupStore, path string) (WorkspaceAvailability, error) {
	if ctx == nil || identifier == nil || !validRepositoryPathInput(path) {
		return WorkspaceAvailability{}, domain.ErrInvalidArgument
	}
	root, _, err := identifier.IdentifyWorkspace(ctx, path)
	if err != nil {
		return WorkspaceAvailability{}, mapWorkspaceOpenError(err)
	}
	result := WorkspaceAvailability{Available: true, RepositoryPath: root}
	if lookup == nil {
		return result, nil
	}
	task, err := lookup.LoadActiveTaskByCanonicalRoot(ctx, root)
	if errors.Is(err, store.ErrTaskNotFound) {
		return result, nil
	}
	if err != nil {
		return WorkspaceAvailability{}, mapStoreError(err)
	}
	result.Available, result.TaskID = false, task.TaskID
	return result, nil
}
