package store

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

const actionOperationSelect = `SELECT task_id,operation_id,process_id,process_definition_digest,source_node,expected_revision,action_id,action_kind,repository_binding_digest,issuance_identity_digest,issuance_history_digest,issuance_content_digest,payload,payload_digest,prepared_at,applied_revision FROM action_operations WHERE task_id=?`

func (s *SQLite) LoadActionOperation(ctx context.Context, taskID domain.ID) (ActionOperation, bool, error) {
	if s == nil || s.db == nil || ctx == nil || !taskID.IsValid() {
		return ActionOperation{}, false, ErrInvalidArgument
	}
	operation, err := scanActionOperation(s.db.QueryRowContext(ctx, actionOperationSelect, taskID))
	if errors.Is(err, sql.ErrNoRows) {
		return ActionOperation{}, false, nil
	}
	if err != nil {
		return ActionOperation{}, false, ErrStorageUnavailable
	}
	return operation, true, nil
}

func (s *SQLite) StageActionOperation(ctx context.Context, task domain.ProcessTask, commit domain.ActionCommit) error {
	if s == nil || s.db == nil || ctx == nil || task.CurrentAction == nil ||
		workflow.ValidateProcessTask(task) != nil || workflow.ValidateActionCommit(task, commit) != nil ||
		!actionOperationMatchesCurrentTask(task, commit) {
		return ErrInvalidArgument
	}
	expectedSnapshot, err := encodeTask(task)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return ErrStorageUnavailable
	}
	defer tx.Rollback()
	current, err := scanStoredTask(tx.QueryRowContext(ctx, `SELECT task_id,origin_host,process_id,process_definition_digest,current_node,revision,worktree_instance_digest,snapshot,created_at,updated_at FROM tasks WHERE task_id=?`, task.TaskID))
	if errors.Is(err, sql.ErrNoRows) {
		return ErrTaskNotFound
	}
	if err != nil {
		return ErrStorageUnavailable
	}
	currentSnapshot, currentErr := encodeTask(current)
	if currentErr != nil || !bytes.Equal(currentSnapshot, expectedSnapshot) {
		return ErrRevisionConflict
	}
	existing, found, err := loadActionOperationTx(ctx, tx, task.TaskID)
	if err != nil {
		return err
	}
	if found {
		if existing.Commit.Operation.ActionID == commit.Operation.ActionID {
			if existing.Commit.Equal(commit) {
				return nil
			}
			return ErrInvalidArgument
		}
		if existing.AppliedRevision == nil || *existing.AppliedRevision > task.Revision {
			return ErrRevisionConflict
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM action_operations WHERE task_id=?`, task.TaskID); err != nil {
			return ErrStorageUnavailable
		}
	}
	operation := commit.Operation
	if _, err := tx.ExecContext(ctx, `INSERT INTO action_operations(task_id,operation_id,process_id,process_definition_digest,source_node,expected_revision,action_id,action_kind,repository_binding_digest,issuance_identity_digest,issuance_history_digest,issuance_content_digest,payload,payload_digest,prepared_at,applied_revision) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
		task.TaskID, operation.OperationID, operation.Process.ID, operation.Process.DefinitionDigest,
		operation.SourceCursor, operation.ExpectedRevision, operation.ActionID, operation.ActionKind,
		operation.RepositoryBindingDigest, operation.IssuanceIdentityDigest, operation.IssuanceHistoryDigest, operation.IssuanceContentDigest, []byte(commit.Payload), commit.PayloadDigest, formatTime(commit.PreparedAt)); err != nil {
		return ErrStorageUnavailable
	}
	if err := tx.Commit(); err != nil {
		return ErrStorageUnavailable
	}
	return nil
}

func (s *SQLite) CommitActionOperation(ctx context.Context, operationID domain.ID, mutation TaskMutation) error {
	if s == nil || s.db == nil || ctx == nil || !operationID.IsValid() || validateMutation(mutation) != nil {
		return ErrInvalidArgument
	}
	snapshot, err := encodeTask(mutation.Task)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return ErrStorageUnavailable
	}
	defer tx.Rollback()
	operation, found, err := loadActionOperationTx(ctx, tx, mutation.Task.TaskID)
	if err != nil {
		return err
	}
	if !found {
		return ErrStorageUnavailable
	}
	if operation.Commit.Operation.OperationID != operationID || operation.AppliedRevision != nil ||
		workflow.ValidateActionCommit(mutation.Task, operation.Commit) != nil ||
		!actionOperationMatchesMutation(operation.Commit, mutation) {
		return ErrInvalidArgument
	}
	if err := writeTaskMutation(ctx, tx, mutation, snapshot); err != nil {
		return err
	}
	result, err := tx.ExecContext(ctx, `UPDATE action_operations SET applied_revision=? WHERE task_id=? AND operation_id=? AND applied_revision IS NULL`, mutation.Task.Revision, mutation.Task.TaskID, operationID)
	if err != nil {
		return ErrStorageUnavailable
	}
	rows, _ := result.RowsAffected()
	if rows != 1 {
		return ErrRevisionConflict
	}
	if err := tx.Commit(); err != nil {
		return ErrStorageUnavailable
	}
	return nil
}

func loadActionOperationTx(ctx context.Context, tx *sql.Tx, taskID domain.ID) (ActionOperation, bool, error) {
	operation, err := scanActionOperation(tx.QueryRowContext(ctx, actionOperationSelect, taskID))
	if errors.Is(err, sql.ErrNoRows) {
		return ActionOperation{}, false, nil
	}
	if err != nil {
		return ActionOperation{}, false, ErrStorageUnavailable
	}
	return operation, true, nil
}

func scanActionOperation(row rowScanner) (ActionOperation, error) {
	var taskID, operationID, processID, processDigest, sourceNode, actionID, actionKind, repositoryDigest, identityDigest, historyDigest, contentDigest, payloadDigest, preparedAt string
	var expectedRevision int64
	var payload []byte
	var appliedRevision sql.NullInt64
	if err := row.Scan(&taskID, &operationID, &processID, &processDigest, &sourceNode, &expectedRevision, &actionID, &actionKind, &repositoryDigest, &identityDigest, &historyDigest, &contentDigest, &payload, &payloadDigest, &preparedAt, &appliedRevision); err != nil {
		return ActionOperation{}, err
	}
	prepared, err := time.Parse(time.RFC3339Nano, preparedAt)
	if err != nil || prepared.Location() != time.UTC || expectedRevision < 1 {
		return ActionOperation{}, ErrStorageUnavailable
	}
	commit := domain.ActionCommit{
		Operation: domain.OperationReference{
			OperationID:  domain.ID(operationID),
			Process:      domain.ProcessReference{ID: domain.ProcessID(processID), DefinitionDigest: domain.Digest(processDigest)},
			SourceCursor: domain.NodeID(sourceNode), ExpectedRevision: uint64(expectedRevision),
			ActionID: domain.ID(actionID), ActionKind: domain.ActionKind(actionKind),
			RepositoryBindingDigest: domain.Digest(repositoryDigest), IssuanceIdentityDigest: domain.Digest(identityDigest), IssuanceHistoryDigest: domain.Digest(historyDigest), IssuanceContentDigest: domain.Digest(contentDigest),
		},
		Payload: append([]byte(nil), payload...), PayloadDigest: domain.Digest(payloadDigest), PreparedAt: prepared.UTC(),
	}
	operation := ActionOperation{TaskID: domain.ID(taskID), Commit: commit}
	if !operation.TaskID.IsValid() || commit.Validate() != nil {
		return ActionOperation{}, ErrStorageUnavailable
	}
	if appliedRevision.Valid {
		if appliedRevision.Int64 != expectedRevision+1 {
			return ActionOperation{}, ErrStorageUnavailable
		}
		revision := uint64(appliedRevision.Int64)
		operation.AppliedRevision = &revision
	}
	return operation, nil
}

func actionOperationMatchesCurrentTask(task domain.ProcessTask, commit domain.ActionCommit) bool {
	action := task.CurrentAction
	operation := commit.Operation
	return action != nil && task.Revision == operation.ExpectedRevision && task.CurrentNode == operation.SourceCursor &&
		action.ActionID == operation.ActionID && action.Kind == operation.ActionKind &&
		action.RepositoryBindingDigest == operation.RepositoryBindingDigest && action.IssuanceIdentityDigest == operation.IssuanceIdentityDigest && action.IssuanceHistoryDigest == operation.IssuanceHistoryDigest && action.IssuanceContentDigest == operation.IssuanceContentDigest
}

func actionOperationMatchesMutation(commit domain.ActionCommit, mutation TaskMutation) bool {
	operation := commit.Operation
	last := mutation.Task.LastOperation
	return mutation.ExpectedRevision == operation.ExpectedRevision && last != nil && last.Kind == domain.OperationApplyAction &&
		last.ActionID != nil && last.OperationID == operation.OperationID && *last.ActionID == operation.ActionID &&
		last.FromRevision == operation.ExpectedRevision && last.ToRevision == mutation.Task.Revision &&
		last.PayloadDigest == commit.PayloadDigest && mutation.Event.RequestID == operation.OperationID &&
		mutation.Event.ActionID != nil && *mutation.Event.ActionID == operation.ActionID &&
		mutation.Event.SourceNode == operation.SourceCursor && mutation.Event.PayloadDigest == commit.PayloadDigest
}

func (operation ActionOperation) RecordedBy(task domain.ProcessTask) bool {
	if operation.AppliedRevision == nil || *operation.AppliedRevision != task.Revision {
		return false
	}
	last := task.LastOperation
	commit := operation.Commit
	return last != nil && last.Kind == domain.OperationApplyAction && last.ActionID != nil &&
		last.OperationID == commit.Operation.OperationID && *last.ActionID == commit.Operation.ActionID &&
		last.FromRevision == commit.Operation.ExpectedRevision && last.ToRevision == task.Revision &&
		last.PayloadDigest == commit.PayloadDigest
}
