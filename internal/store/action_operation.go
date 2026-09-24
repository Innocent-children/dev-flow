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
		return ActionOperation{}, false, domain.WithExplanation(ErrInvalidArgument, "Reading an Action operation requires an open store, a context and a valid Task identifier.")
	}
	operation, err := scanActionOperation(s.db.QueryRowContext(ctx, actionOperationSelect, taskID))
	if errors.Is(err, sql.ErrNoRows) {
		return ActionOperation{}, false, nil
	}
	if err != nil {
		return ActionOperation{}, false, storageFailure(err, "The saved Action operation could not be read from action_operations.")
	}
	return operation, true, nil
}

func (s *SQLite) StageActionOperation(ctx context.Context, task domain.ProcessTask, commit domain.ActionCommit) error {
	if s == nil || s.db == nil || ctx == nil || task.CurrentAction == nil ||
		workflow.ValidateProcessTask(task) != nil || workflow.ValidateActionCommit(task, commit) != nil ||
		!actionOperationMatchesCurrentTask(task, commit) {
		return domain.WithExplanation(ErrInvalidArgument, "The Action operation cannot be staged because its Task, commit or current Action binding is invalid.")
	}
	expectedSnapshot, err := encodeTask(task)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return storageFailure(err, "The transaction to stage the Action operation could not be started.")
	}
	defer tx.Rollback()
	current, err := scanStoredTask(tx.QueryRowContext(ctx, `SELECT task_id,origin_host,process_id,process_definition_digest,current_node,revision,worktree_instance_digest,snapshot,created_at,updated_at FROM tasks WHERE task_id=?`, task.TaskID))
	if errors.Is(err, sql.ErrNoRows) {
		return domain.WithExplanation(ErrTaskNotFound, "The Task disappeared before its Action operation could be staged.")
	}
	if err != nil {
		return storageFailure(err, "The current Task could not be read while staging its Action operation.")
	}
	currentSnapshot, currentErr := encodeTask(current)
	if currentErr != nil || !bytes.Equal(currentSnapshot, expectedSnapshot) {
		return domain.WithExplanation(ErrRevisionConflict, "The saved Task snapshot changed before the Action operation was staged.")
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
			return domain.WithExplanation(ErrInvalidArgument, "An operation with this Action or operation identity is already retained with different content.")
		}
		if existing.AppliedRevision == nil || *existing.AppliedRevision > task.Revision {
			return domain.WithExplanation(ErrRevisionConflict, "The previously retained Action operation is still pending or belongs to a later Task revision.")
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM action_operations WHERE task_id=?`, task.TaskID); err != nil {
			return domain.WithExplanation(ErrStorageUnavailable, "The completed previous Action operation could not be removed before staging the next one.")
		}
	}
	operation := commit.Operation
	if _, err := tx.ExecContext(ctx, `INSERT INTO action_operations(task_id,operation_id,process_id,process_definition_digest,source_node,expected_revision,action_id,action_kind,repository_binding_digest,issuance_identity_digest,issuance_history_digest,issuance_content_digest,payload,payload_digest,prepared_at,applied_revision) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
		task.TaskID, operation.OperationID, operation.Process.ID, operation.Process.DefinitionDigest,
		operation.SourceCursor, operation.ExpectedRevision, operation.ActionID, operation.ActionKind,
		operation.RepositoryBindingDigest, operation.IssuanceIdentityDigest, operation.IssuanceHistoryDigest, operation.IssuanceContentDigest, []byte(commit.Payload), commit.PayloadDigest, formatTime(commit.PreparedAt)); err != nil {
		return domain.WithExplanation(ErrStorageUnavailable, "The prepared Action operation could not be inserted into action_operations.")
	}
	if err := tx.Commit(); err != nil {
		return storageFailure(err, "The transaction staging the Action operation could not be committed; read the saved operation before retrying.")
	}
	return nil
}

func (s *SQLite) CommitActionOperation(ctx context.Context, operationID domain.ID, mutation TaskMutation) error {
	if s == nil || s.db == nil || ctx == nil || !operationID.IsValid() || validateMutation(mutation) != nil {
		return domain.WithExplanation(ErrInvalidArgument, "Committing an Action operation requires an open store, a valid operation identity and a valid Task mutation.")
	}
	snapshot, err := encodeTask(mutation.Task)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return storageFailure(err, "The transaction to commit the Action operation could not be started.")
	}
	defer tx.Rollback()
	operation, found, err := loadActionOperationTx(ctx, tx, mutation.Task.TaskID)
	if err != nil {
		return err
	}
	if !found {
		return domain.WithExplanation(ErrStorageUnavailable, "The prepared Action operation is missing from action_operations.")
	}
	if operation.Commit.Operation.OperationID != operationID || operation.AppliedRevision != nil ||
		workflow.ValidateActionCommit(mutation.Task, operation.Commit) != nil ||
		!actionOperationMatchesMutation(operation.Commit, mutation) {
		return domain.WithExplanation(ErrInvalidArgument, "The Task mutation does not match the prepared Action operation or the operation was already applied.")
	}
	if err := writeTaskMutation(ctx, tx, mutation, snapshot); err != nil {
		return err
	}
	result, err := tx.ExecContext(ctx, `UPDATE action_operations SET applied_revision=? WHERE task_id=? AND operation_id=? AND applied_revision IS NULL`, mutation.Task.Revision, mutation.Task.TaskID, operationID)
	if err != nil {
		return storageFailure(err, "The applied revision could not be saved to action_operations.")
	}
	rows, _ := result.RowsAffected()
	if rows != 1 {
		return domain.WithExplanation(ErrRevisionConflict, "The pending Action operation changed before its applied revision was recorded.")
	}
	if err := tx.Commit(); err != nil {
		return storageFailure(err, "The Action transaction commit did not return success; read the saved operation before retrying.")
	}
	return nil
}

func loadActionOperationTx(ctx context.Context, tx *sql.Tx, taskID domain.ID) (ActionOperation, bool, error) {
	operation, err := scanActionOperation(tx.QueryRowContext(ctx, actionOperationSelect, taskID))
	if errors.Is(err, sql.ErrNoRows) {
		return ActionOperation{}, false, nil
	}
	if err != nil {
		return ActionOperation{}, false, storageFailure(err, "The Action operation could not be read inside the current transaction.")
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
		return ActionOperation{}, domain.WithExplanation(ErrStorageUnavailable, "The saved Action operation requires a UTC preparation time and a positive expected revision.")
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
		return ActionOperation{}, domain.WithExplanation(ErrStorageUnavailable, "The saved Action operation contains an invalid Task identity, operation reference, payload or digest.")
	}
	if appliedRevision.Valid {
		if appliedRevision.Int64 != expectedRevision+1 {
			return ActionOperation{}, domain.WithExplanation(ErrStorageUnavailable, "The saved applied revision must equal the expected revision plus one.")
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
