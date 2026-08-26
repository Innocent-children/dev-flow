package application

import (
	"context"
	"strings"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

const (
	controlCenterListPageSize = 50
	dashboardReadPageSize     = 100
)

func (c *ControlCenter) ListTasks(ctx context.Context, request ListControlCenterTasksRequest) (ControlCenterTaskList, error) {
	if !c.valid() || ctx == nil || !validControlCenterFilter(request.Filter) {
		return ControlCenterTaskList{}, domain.ErrInvalidArgument
	}
	page := request.Filter.Page
	if page == 0 {
		page = 1
	}
	stored, err := c.tasks.ListControlCenterTasks(ctx, store.TaskListQuery{
		Text: request.Filter.Text, Host: request.Filter.Host, Repository: request.Filter.Repository,
		Node: request.Filter.Node, Lifecycle: request.Filter.Lifecycle, UpdatedFrom: request.Filter.UpdatedFrom,
		UpdatedTo: request.Filter.UpdatedTo, Page: page, PageSize: controlCenterListPageSize,
	})
	if err != nil {
		return ControlCenterTaskList{}, mapStoreError(err)
	}
	return ControlCenterTaskList{Page: stored.Page, HasNext: stored.HasNext, Items: summarizeTasks(stored.Items)}, nil
}

func (c *ControlCenter) Dashboard(ctx context.Context) (ControlCenterDashboard, error) {
	if !c.valid() || ctx == nil {
		return ControlCenterDashboard{}, domain.ErrInvalidArgument
	}
	result := ControlCenterDashboard{Counts: map[string]int{"active": 0, "blocked": 0, "done": 0, "cancelled": 0}, Recent: []ControlCenterTaskSummary{}}
	for page := 1; ; page++ {
		stored, err := c.tasks.ListControlCenterTasks(ctx, store.TaskListQuery{Page: page, PageSize: dashboardReadPageSize})
		if err != nil {
			return ControlCenterDashboard{}, mapStoreError(err)
		}
		summaries := summarizeTasks(stored.Items)
		if page == 1 {
			limit := len(summaries)
			if limit > 20 {
				limit = 20
			}
			result.Recent = append(result.Recent, summaries[:limit]...)
		}
		for _, summary := range summaries {
			result.Counts[summary.Lifecycle]++
		}
		if !stored.HasNext {
			break
		}
	}
	return result, nil
}

func (c *ControlCenter) GetTaskDetail(ctx context.Context, request GetControlCenterTaskRequest) (ControlCenterTaskDetail, error) {
	if !c.valid() || ctx == nil || !request.TaskID.IsValid() {
		return ControlCenterTaskDetail{}, domain.ErrInvalidArgument
	}
	stored, err := c.tasks.LoadControlCenterTask(ctx, request.TaskID)
	if err != nil {
		return ControlCenterTaskDetail{}, mapStoreError(err)
	}
	traversals := make([]workflow.CommittedTraversal, len(stored.Events))
	for index, event := range stored.Events {
		traversals[index] = workflow.CommittedTraversal{Revision: event.Revision, Kind: event.Kind, Source: event.SourceNode, Destination: event.DestinationNode, TransitionID: event.TransitionID, Reason: event.TransitionReason, CreatedAt: event.CreatedAt}
	}
	graph := workflow.ProjectControlCenterGraph(stored.Task, traversals)
	return ControlCenterTaskDetail{Task: stored.Task, Archived: stored.ArchivedAt != nil, Events: stored.Events, Graph: graph, ReadOnly: !graph.Safe}, nil
}

func validControlCenterFilter(filter TaskListFilter) bool {
	if filter.Page < 0 || !utf8.ValidString(filter.Text) || len(filter.Text) > 512 || !utf8.ValidString(filter.Repository) || len(filter.Repository) > domain.MaxRepositoryPathBytes {
		return false
	}
	if filter.Host != "" && !filter.Host.IsValid() || filter.Node != "" && !filter.Node.IsValid() {
		return false
	}
	if filter.Lifecycle != "" && filter.Lifecycle != "active" && filter.Lifecycle != "blocked" && filter.Lifecycle != "done" && filter.Lifecycle != "cancelled" {
		return false
	}
	return filter.UpdatedFrom == nil || filter.UpdatedTo == nil || !filter.UpdatedFrom.After(*filter.UpdatedTo)
}

func summarizeTasks(items []store.ControlCenterTask) []ControlCenterTaskSummary {
	result := make([]ControlCenterTaskSummary, len(items))
	for index, item := range items {
		task := item.Task
		keys := make([]domain.RepositoryKey, 0, len(task.AdditionalRepositories)+1)
		keys = append(keys, task.EffectivePrimaryRepositoryKey())
		for _, repository := range task.AdditionalRepositories {
			keys = append(keys, repository.Key)
		}
		var blocker, outcome *string
		if task.Blocker != nil {
			value := task.Blocker.Message
			blocker = &value
		}
		if task.Outcome != nil {
			value := task.Outcome.Summary
			outcome = &value
		}
		result[index] = ControlCenterTaskSummary{
			TaskID: task.TaskID, RequestSummary: truncateSummary(task.Intent.Request), OriginHost: task.OriginHost,
			ExecutionHost: task.OriginHost, CurrentNode: task.CurrentNode, Lifecycle: lifecycleForNode(task.CurrentNode),
			Revision: task.Revision, UpdatedAt: task.UpdatedAt, Archived: item.ArchivedAt != nil,
			RepositoryKeys: keys, Blocker: blocker, Outcome: outcome,
		}
	}
	return result
}

func lifecycleForNode(node domain.NodeID) string {
	switch node {
	case domain.NodeBlocked:
		return "blocked"
	case domain.NodeDone:
		return "done"
	case domain.NodeCancelled:
		return "cancelled"
	default:
		return "active"
	}
}

func truncateSummary(value string) string {
	value = strings.TrimSpace(value)
	runes := []rune(value)
	if len(runes) <= 512 {
		return value
	}
	return string(runes[:511]) + "…"
}
