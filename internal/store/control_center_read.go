package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

const maxControlCenterPageSize = 100

func (s *SQLite) ListControlCenterTasks(ctx context.Context, query TaskListQuery) (ControlCenterTaskPage, error) {
	if s == nil || s.db == nil || ctx == nil || !validTaskListQuery(query) {
		return ControlCenterTaskPage{}, ErrInvalidArgument
	}
	clauses := []string{"archived_at IS NULL"}
	args := make([]any, 0, 5)
	if query.Host != "" {
		clauses = append(clauses, "origin_host=?")
		args = append(args, query.Host)
	}
	if query.Node != "" {
		clauses = append(clauses, "current_node=?")
		args = append(args, query.Node)
	}
	switch query.Lifecycle {
	case "active":
		clauses = append(clauses, "current_node NOT IN ('BLOCKED','DONE','CANCELLED')")
	case "blocked":
		clauses = append(clauses, "current_node='BLOCKED'")
	case "done":
		clauses = append(clauses, "current_node='DONE'")
	case "cancelled":
		clauses = append(clauses, "current_node='CANCELLED'")
	}
	statement := `SELECT task_id,origin_host,process_id,process_definition_digest,current_node,revision,worktree_instance_digest,snapshot,created_at,updated_at,archived_at FROM tasks WHERE ` + strings.Join(clauses, " AND ") + ` ORDER BY updated_at DESC,task_id ASC`
	rows, err := s.db.QueryContext(ctx, statement, args...)
	if err != nil {
		return ControlCenterTaskPage{}, ErrStorageUnavailable
	}
	defer rows.Close()
	matched := make([]ControlCenterTask, 0)
	for rows.Next() {
		item, scanErr := scanControlCenterTask(rows)
		if scanErr != nil {
			return ControlCenterTaskPage{}, ErrStorageUnavailable
		}
		if matchesControlCenterTask(item.Task, query) {
			matched = append(matched, item)
		}
	}
	if rows.Err() != nil || rows.Close() != nil {
		return ControlCenterTaskPage{}, ErrStorageUnavailable
	}
	sort.SliceStable(matched, func(i, j int) bool {
		if !matched[i].Task.UpdatedAt.Equal(matched[j].Task.UpdatedAt) {
			return matched[i].Task.UpdatedAt.After(matched[j].Task.UpdatedAt)
		}
		return matched[i].Task.TaskID < matched[j].Task.TaskID
	})
	start := (query.Page - 1) * query.PageSize
	if start >= len(matched) {
		return ControlCenterTaskPage{Items: []ControlCenterTask{}, Page: query.Page}, nil
	}
	end := start + query.PageSize
	hasNext := end < len(matched)
	if end > len(matched) {
		end = len(matched)
	}
	return ControlCenterTaskPage{Items: matched[start:end], Page: query.Page, HasNext: hasNext}, nil
}

func (s *SQLite) LoadControlCenterTask(ctx context.Context, id domain.ID) (ControlCenterTask, error) {
	if s == nil || s.db == nil || ctx == nil || !id.IsValid() {
		return ControlCenterTask{}, ErrInvalidArgument
	}
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return ControlCenterTask{}, ErrStorageUnavailable
	}
	defer tx.Rollback()
	item, err := scanControlCenterTask(tx.QueryRowContext(ctx, `SELECT task_id,origin_host,process_id,process_definition_digest,current_node,revision,worktree_instance_digest,snapshot,created_at,updated_at,archived_at FROM tasks WHERE task_id=?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return ControlCenterTask{}, ErrTaskNotFound
	}
	if err != nil {
		return ControlCenterTask{}, ErrStorageUnavailable
	}
	events, err := loadTaskEvents(ctx, tx, id)
	if err != nil {
		return ControlCenterTask{}, err
	}
	item.Events = events
	return item, nil
}

func scanControlCenterTask(row rowScanner) (ControlCenterTask, error) {
	var taskID, host, processID, digest, node, identity, created, updated string
	var revision int64
	var snapshot []byte
	var archived sql.NullString
	if err := row.Scan(&taskID, &host, &processID, &digest, &node, &revision, &identity, &snapshot, &created, &updated, &archived); err != nil {
		return ControlCenterTask{}, err
	}
	task, err := decodeTask(snapshot)
	if err != nil {
		return ControlCenterTask{}, err
	}
	if taskID != string(task.TaskID) || host != string(task.OriginHost) || processID != string(task.Process.ID) || digest != string(task.Process.DefinitionDigest) || node != string(task.CurrentNode) || revision != int64(task.Revision) || identity != string(task.Repository.WorktreeInstanceDigest) || created != formatTime(task.CreatedAt) || updated != formatTime(task.UpdatedAt) {
		return ControlCenterTask{}, ErrStorageUnavailable
	}
	archive, err := decodeArchiveTime(nullableString(archived))
	if err != nil || archive != nil && !task.CurrentNode.Terminal() {
		return ControlCenterTask{}, ErrStorageUnavailable
	}
	return ControlCenterTask{Task: task, ArchivedAt: archive}, nil
}

func (s *SQLite) LoadTaskEvents(ctx context.Context, id domain.ID) ([]TaskEvent, error) {
	if s == nil || s.db == nil || ctx == nil || !id.IsValid() {
		return nil, ErrInvalidArgument
	}
	return loadTaskEvents(ctx, s.db, id)
}

func loadTaskEvents(ctx context.Context, queryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}, id domain.ID) ([]TaskEvent, error) {
	rows, err := queryer.QueryContext(ctx, `SELECT event_id,task_id,revision,event_type,source_node,destination_node,transition_id,transition_reason,action_id,observed_binding_digest,repository_delta_paths,request_id,payload_digest,created_at FROM task_events WHERE task_id=? ORDER BY revision ASC`, id)
	if err != nil {
		return nil, ErrStorageUnavailable
	}
	defer rows.Close()
	events := make([]TaskEvent, 0)
	for rows.Next() {
		var eventID, taskID, kind, source, destination, requestID, payloadDigest, created string
		var revision int64
		var encodedPaths []byte
		var transition, reason, action, observedBinding sql.NullString
		if rows.Scan(&eventID, &taskID, &revision, &kind, &source, &destination, &transition, &reason, &action, &observedBinding, &encodedPaths, &requestID, &payloadDigest, &created) != nil || revision <= 0 {
			return nil, ErrStorageUnavailable
		}
		var paths []string
		if json.Unmarshal(encodedPaths, &paths) != nil || paths == nil || len(paths) > domain.MaxRepositoryDeltaPaths {
			return nil, ErrStorageUnavailable
		}
		for index, path := range paths {
			if domain.ValidateRepositoryContractPath(path) != nil || index > 0 && paths[index-1] >= path {
				return nil, ErrStorageUnavailable
			}
		}
		createdAt, parseErr := time.Parse(time.RFC3339Nano, created)
		if parseErr != nil || createdAt.Location() != time.UTC {
			return nil, ErrStorageUnavailable
		}
		event := TaskEvent{EventID: domain.ID(eventID), TaskID: domain.ID(taskID), Revision: uint64(revision), Kind: domain.OperationKind(kind), SourceNode: domain.NodeID(source), DestinationNode: domain.NodeID(destination), TransitionReason: reason.String, RepositoryDeltaPaths: paths, RequestID: domain.ID(requestID), PayloadDigest: domain.Digest(payloadDigest), CreatedAt: createdAt.UTC()}
		if transition.Valid {
			value := domain.TransitionID(transition.String)
			event.TransitionID = &value
		}
		if action.Valid {
			value := domain.ID(action.String)
			event.ActionID = &value
		}
		if observedBinding.Valid {
			value := domain.Digest(observedBinding.String)
			event.ObservedBindingDigest = &value
		}
		events = append(events, event)
	}
	if rows.Err() != nil || rows.Close() != nil {
		return nil, ErrStorageUnavailable
	}
	return events, nil
}

func validTaskListQuery(query TaskListQuery) bool {
	if query.Page < 1 || query.PageSize < 1 || query.PageSize > maxControlCenterPageSize || !utf8.ValidString(query.Text) || len(query.Text) > 512 || !utf8.ValidString(query.Repository) || len(query.Repository) > domain.MaxRepositoryPathBytes {
		return false
	}
	if query.Host != "" && !query.Host.IsValid() || query.Node != "" && !query.Node.IsValid() {
		return false
	}
	if query.Lifecycle != "" && query.Lifecycle != "active" && query.Lifecycle != "blocked" && query.Lifecycle != "done" && query.Lifecycle != "cancelled" {
		return false
	}
	if query.UpdatedFrom != nil && query.UpdatedTo != nil && query.UpdatedFrom.After(*query.UpdatedTo) {
		return false
	}
	return true
}

func matchesControlCenterTask(task domain.ProcessTask, query TaskListQuery) bool {
	if query.UpdatedFrom != nil && task.UpdatedAt.Before(*query.UpdatedFrom) || query.UpdatedTo != nil && task.UpdatedAt.After(*query.UpdatedTo) {
		return false
	}
	if text := strings.ToLower(strings.TrimSpace(query.Text)); text != "" {
		values := []string{string(task.TaskID), task.Intent.Request, string(task.CurrentNode)}
		values = append(values, task.Intent.KnownAcceptanceCriteria...)
		if task.Blocker != nil {
			values = append(values, task.Blocker.Message, task.Blocker.RequiredResolution)
		}
		if task.Outcome != nil {
			values = append(values, task.Outcome.Summary)
		}
		matched := false
		for _, value := range values {
			if strings.Contains(strings.ToLower(value), text) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}
	if repository := strings.ToLower(strings.TrimSpace(query.Repository)); repository != "" {
		values := []string{string(task.EffectivePrimaryRepositoryKey()), task.WorkspaceOrigin.CanonicalWorktreeRoot}
		for _, entry := range task.AdditionalRepositories {
			values = append(values, string(entry.Key), entry.Origin.CanonicalWorktreeRoot)
		}
		matched := false
		for _, value := range values {
			if strings.Contains(strings.ToLower(value), repository) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}
	return true
}

var _ ControlCenterStore = (*SQLite)(nil)
