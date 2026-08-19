package store

import (
	"context"
	"database/sql"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
	_ "modernc.org/sqlite"
)

type SQLite struct{ db *sql.DB }

func Open(ctx context.Context, path string) (*SQLite, error) {
	if path == "" {
		return nil, ErrInvalidArgument
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, ErrInvalidArgument
	}
	if info, err := os.Stat(absolute); err == nil && info.Size() > 0 {
		if err := preflightExisting(ctx, absolute); err != nil {
			return nil, err
		}
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, ErrStorageUnavailable
	}
	dsn := dataSource(absolute, false)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, ErrStorageUnavailable
	}
	db.SetMaxOpenConns(1)
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, ErrStorageUnavailable
	}
	if err := bootstrapSchema2(ctx, db, time.Now()); err != nil {
		db.Close()
		return nil, err
	}
	if err := preflightRows(ctx, db); err != nil {
		db.Close()
		return nil, err
	}
	return &SQLite{db: db}, nil
}
func dataSource(path string, readOnly bool) string {
	u := &url.URL{Scheme: "file", Path: filepath.Clean(path)}
	q := u.Query()
	q.Set("_foreign_keys", "on")
	q.Set("_busy_timeout", strconv.FormatInt(domain.SQLiteBusyTimeout.Milliseconds(), 10))
	if readOnly {
		q.Set("mode", "ro")
		q.Set("immutable", "1")
	}
	u.RawQuery = q.Encode()
	return u.String()
}
func preflightExisting(ctx context.Context, path string) error {
	db, err := sql.Open("sqlite", dataSource(path, true))
	if err != nil {
		return ErrSchemaUnsupported
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if err := db.PingContext(ctx); err != nil {
		return ErrSchemaUnsupported
	}
	if err := verifySchema2(ctx, db); err != nil {
		return err
	}
	return preflightRows(ctx, db)
}
func preflightRows(ctx context.Context, db *sql.DB) error {
	rows, err := db.QueryContext(ctx, `SELECT task_id,origin_host,process_id,process_version,process_definition_digest,snapshot_version,current_node,revision,repository_identity,snapshot,created_at,updated_at FROM tasks`)
	if err != nil {
		return ErrSchemaUnsupported
	}
	defer rows.Close()
	standard := workflow.StandardProcess().Reference
	for rows.Next() {
		var taskID, originHost, processID, digest, node, repositoryIdentity, createdAt, updatedAt string
		var version, snapshotVersion int
		var revision int64
		var snapshot []byte
		if err := rows.Scan(&taskID, &originHost, &processID, &version, &digest, &snapshotVersion, &node, &revision, &repositoryIdentity, &snapshot, &createdAt, &updatedAt); err != nil {
			return ErrStorageUnavailable
		}
		if processID != string(standard.ID) || version != int(standard.Version) || digest != string(standard.DefinitionDigest) {
			return ErrProcessUnsupported
		}
		if snapshotVersion != SnapshotVersion {
			return ErrSchemaUnsupported
		}
		task, err := decodeTask(snapshot)
		if err != nil {
			return err
		}
		if string(task.TaskID) != taskID || string(task.OriginHost) != originHost || task.Process != standard || string(task.CurrentNode) != node || int64(task.Revision) != revision || string(task.Repository.RepositoryIdentity) != repositoryIdentity || formatTime(task.CreatedAt) != createdAt || formatTime(task.UpdatedAt) != updatedAt {
			return ErrStorageUnavailable
		}
	}
	if rows.Err() != nil {
		return ErrStorageUnavailable
	}
	return nil
}
func (s *SQLite) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	if err := s.db.Close(); err != nil {
		return ErrStorageUnavailable
	}
	return nil
}
func (s *SQLite) LoadTask(ctx context.Context, id domain.ID) (domain.ProcessTask, error) {
	return s.load(ctx, `SELECT task_id,origin_host,process_id,process_version,process_definition_digest,snapshot_version,current_node,revision,repository_identity,snapshot,created_at,updated_at FROM tasks WHERE task_id=?`, string(id))
}
func (s *SQLite) LoadActiveTask(ctx context.Context, identity domain.Digest) (domain.ProcessTask, error) {
	return s.load(ctx, `SELECT t.task_id,t.origin_host,t.process_id,t.process_version,t.process_definition_digest,t.snapshot_version,t.current_node,t.revision,t.repository_identity,t.snapshot,t.created_at,t.updated_at FROM repository_claims c JOIN tasks t ON t.task_id=c.task_id WHERE c.repository_identity=?`, string(identity))
}
func (s *SQLite) load(ctx context.Context, query, arg string) (domain.ProcessTask, error) {
	if s == nil || s.db == nil {
		return domain.ProcessTask{}, ErrStorageUnavailable
	}
	var taskID, host, processID, digest, node, identity, created, updated string
	var version, snapshotVersion int
	var revision int64
	var snapshot []byte
	err := s.db.QueryRowContext(ctx, query, arg).Scan(&taskID, &host, &processID, &version, &digest, &snapshotVersion, &node, &revision, &identity, &snapshot, &created, &updated)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ProcessTask{}, ErrTaskNotFound
	}
	if err != nil {
		return domain.ProcessTask{}, ErrStorageUnavailable
	}
	task, err := decodeTask(snapshot)
	if err != nil {
		return domain.ProcessTask{}, err
	}
	if taskID != string(task.TaskID) || host != string(task.OriginHost) || processID != string(task.Process.ID) || version != int(task.Process.Version) || digest != string(task.Process.DefinitionDigest) || snapshotVersion != 2 || node != string(task.CurrentNode) || revision != int64(task.Revision) || identity != string(task.Repository.RepositoryIdentity) || created != formatTime(task.CreatedAt) || updated != formatTime(task.UpdatedAt) {
		return domain.ProcessTask{}, ErrStorageUnavailable
	}
	return task, nil
}
func (s *SQLite) CommitTask(ctx context.Context, m TaskMutation) error {
	if s == nil || s.db == nil || validateMutation(m) != nil {
		return ErrInvalidArgument
	}
	snapshot, err := encodeTask(m.Task)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return ErrStorageUnavailable
	}
	defer tx.Rollback()
	if m.ExpectedRevision == 0 {
		_, err = tx.ExecContext(ctx, `INSERT INTO tasks(task_id,origin_host,process_id,process_version,process_definition_digest,snapshot_version,current_node,revision,repository_identity,snapshot,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, m.Task.TaskID, m.Task.OriginHost, m.Task.Process.ID, m.Task.Process.Version, m.Task.Process.DefinitionDigest, 2, m.Task.CurrentNode, m.Task.Revision, m.Task.Repository.RepositoryIdentity, snapshot, formatTime(m.Task.CreatedAt), formatTime(m.Task.UpdatedAt))
	} else {
		result, e := tx.ExecContext(ctx, `UPDATE tasks SET current_node=?,revision=?,snapshot=?,updated_at=? WHERE task_id=? AND revision=? AND process_id=? AND process_version=? AND process_definition_digest=? AND snapshot_version=2`, m.Task.CurrentNode, m.Task.Revision, snapshot, formatTime(m.Task.UpdatedAt), m.Task.TaskID, m.ExpectedRevision, m.Task.Process.ID, m.Task.Process.Version, m.Task.Process.DefinitionDigest)
		err = e
		if err == nil {
			n, _ := result.RowsAffected()
			if n != 1 {
				return ErrRevisionConflict
			}
		}
	}
	if err != nil {
		return ErrStorageUnavailable
	}
	if err := insertEvent(ctx, tx, m.Event); err != nil {
		return err
	}
	if err := applyClaim(ctx, tx, m); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return ErrStorageUnavailable
	}
	return nil
}
func insertEvent(ctx context.Context, tx *sql.Tx, e TaskEvent) error {
	var transition, reason, action any
	if e.TransitionID != nil {
		transition = string(*e.TransitionID)
	}
	if e.TransitionReason != "" {
		reason = e.TransitionReason
	}
	if e.ActionID != nil {
		action = string(*e.ActionID)
	}
	_, err := tx.ExecContext(ctx, `INSERT INTO task_events(event_id,task_id,revision,event_type,source_node,destination_node,transition_id,transition_reason,action_id,request_id,payload_digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, e.EventID, e.TaskID, e.Revision, e.Kind, e.SourceNode, e.DestinationNode, transition, reason, action, e.RequestID, e.PayloadDigest, formatTime(e.CreatedAt))
	if err != nil {
		return ErrStorageUnavailable
	}
	return nil
}
func applyClaim(ctx context.Context, tx *sql.Tx, m TaskMutation) error {
	switch m.Claim {
	case ClaimAcquire:
		_, err := tx.ExecContext(ctx, `INSERT INTO repository_claims(repository_identity,task_id,origin_host,claimed_at) VALUES(?,?,?,?)`, m.Task.Repository.RepositoryIdentity, m.Task.TaskID, m.Task.OriginHost, formatTime(m.Event.CreatedAt))
		if err != nil {
			return ErrActiveTaskConflict
		}
	case ClaimRetain:
		var n int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM repository_claims WHERE repository_identity=? AND task_id=?`, m.Task.Repository.RepositoryIdentity, m.Task.TaskID).Scan(&n); err != nil || n != 1 {
			return ErrStorageUnavailable
		}
	case ClaimRelease:
		result, err := tx.ExecContext(ctx, `DELETE FROM repository_claims WHERE repository_identity=? AND task_id=?`, m.Task.Repository.RepositoryIdentity, m.Task.TaskID)
		if err != nil {
			return ErrStorageUnavailable
		}
		n, _ := result.RowsAffected()
		if n != 1 {
			return ErrStorageUnavailable
		}
	default:
		return ErrInvalidArgument
	}
	return nil
}
func validateMutation(m TaskMutation) error {
	if workflow.ValidateProcessTask(m.Task) != nil || m.Task.Revision != m.ExpectedRevision+1 || m.Event.TaskID != m.Task.TaskID || m.Event.Revision != m.Task.Revision || m.Event.DestinationNode != m.Task.CurrentNode || !m.Event.SourceNode.IsValid() || !m.Event.DestinationNode.IsValid() || m.Event.EventID == "" || m.Event.RequestID == "" || !m.Event.PayloadDigest.IsValid() {
		return ErrInvalidArgument
	}
	op := m.Task.LastOperation
	if op == nil || op.Validate() != nil || op.OperationID != m.Event.RequestID || op.Kind != m.Event.Kind || op.FromRevision != m.ExpectedRevision || op.ToRevision != m.Task.Revision || op.PayloadDigest != m.Event.PayloadDigest || !op.CommittedAt.Equal(m.Event.CreatedAt) || !sameOptionalID(op.ActionID, m.Event.ActionID) {
		return ErrInvalidArgument
	}
	if m.Event.TransitionID != nil {
		definition := workflow.StandardProcess()
		transition, err := workflow.TransitionFor(definition, m.Event.SourceNode, *m.Event.TransitionID)
		if err != nil || transition.Destination != m.Event.DestinationNode || (transition.ReasonRequired != (m.Event.TransitionReason != "")) {
			return ErrInvalidArgument
		}
	}
	return nil
}
func sameOptionalID(a, b *domain.ID) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}
func formatTime(v time.Time) string { return v.UTC().Format(time.RFC3339Nano) }
