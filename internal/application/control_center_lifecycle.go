package application

import (
	"context"
	"errors"
	"strings"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func (c *ControlCenter) OpenOrResumeTask(ctx context.Context, request OpenTaskRequest) (ControlCenterMutationResult, error) {
	if !c.valid() || ctx == nil {
		return ControlCenterMutationResult{}, domain.ErrInvalidArgument
	}
	result, err := c.core.OpenTask(ctx, request)
	if err != nil {
		return ControlCenterMutationResult{}, err
	}
	task := result.Task
	return ControlCenterMutationResult{Task: &task}, nil
}

func (c *ControlCenter) PrepareTaskRelocation(ctx context.Context, request PrepareTaskRelocationRequest) (PrepareTaskRelocationResult, error) {
	if !c.valid() || ctx == nil {
		return PrepareTaskRelocationResult{}, domain.ErrInvalidArgument
	}
	return c.core.PrepareTaskRelocation(ctx, request)
}

func (c *ControlCenter) AbandonTask(ctx context.Context, request AbandonTaskRequest) (AbandonTaskResult, error) {
	if !c.valid() || ctx == nil {
		return AbandonTaskResult{}, domain.ErrInvalidArgument
	}
	return c.core.AbandonTask(ctx, request)
}

func (c *ControlCenter) CancelLifecycleTask(ctx context.Context, request CancelControlCenterTaskRequest) (ControlCenterMutationResult, error) {
	if !c.valid() || ctx == nil || !request.RequestID.IsValid() || !request.TaskID.IsValid() || request.ExpectedRevision == 0 || !request.Confirmed || request.Reason == "" || request.Reason != strings.TrimSpace(request.Reason) || len(request.Reason) > domain.MaxReasonBytes {
		return ControlCenterMutationResult{}, domain.ErrInvalidArgument
	}
	current, err := c.tasks.LoadTask(ctx, request.TaskID)
	if err != nil {
		return ControlCenterMutationResult{}, mapStoreError(err)
	}
	result, err := c.core.CancelTask(ctx, CancelTaskRequest{RequestID: request.RequestID, Host: current.OriginHost, TaskID: request.TaskID, ExpectedRevision: request.ExpectedRevision, Reason: request.Reason})
	if err != nil {
		if errors.Is(err, domain.ErrTaskTerminal) {
			latest, loadErr := c.tasks.LoadTask(ctx, request.TaskID)
			if loadErr == nil && latest.Revision != request.ExpectedRevision {
				return ControlCenterMutationResult{}, domain.ErrRevisionConflict
			}
		}
		return ControlCenterMutationResult{}, err
	}
	task := result.Task
	return ControlCenterMutationResult{Task: &task}, nil
}

func (c *ControlCenter) SetTaskArchive(ctx context.Context, request SetTaskArchiveRequest) (ControlCenterMutationResult, error) {
	if !c.valid() || ctx == nil || !request.RequestID.IsValid() || !request.TaskID.IsValid() || request.ExpectedRevision == 0 {
		return ControlCenterMutationResult{}, domain.ErrInvalidArgument
	}
	archivedAt, err := c.tasks.SetTaskArchived(ctx, store.ArchiveTaskMutation{TaskID: request.TaskID, ExpectedRevision: request.ExpectedRevision, Archived: request.Archived, ArchivedAt: c.core.now().UTC()})
	if err != nil {
		return ControlCenterMutationResult{}, mapStoreError(err)
	}
	archived := archivedAt != nil
	return ControlCenterMutationResult{Archived: &archived}, nil
}

func (c *ControlCenter) PurgeLifecycleTask(ctx context.Context, request PurgeControlCenterTaskRequest) (ControlCenterMutationResult, error) {
	if !c.valid() || ctx == nil || !request.RequestID.IsValid() || !request.TaskID.IsValid() || request.ExpectedRevision == 0 {
		return ControlCenterMutationResult{}, domain.ErrInvalidArgument
	}
	err := c.tasks.PurgeTask(ctx, store.PurgeTaskMutation{TaskID: request.TaskID, ExpectedRevision: request.ExpectedRevision, TypedTaskID: request.TypedTaskID, Reason: request.Reason, Irreversible: request.Irreversible})
	if err != nil {
		return ControlCenterMutationResult{}, mapStoreError(err)
	}
	return ControlCenterMutationResult{Purged: true}, nil
}
