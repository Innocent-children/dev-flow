package store

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"sort"
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
	if info, err := os.Stat(absolute); err == nil {
		if !info.Mode().IsRegular() {
			return nil, ErrStorageUnavailable
		}
		if info.Size() > 0 {
			if err := preflightExisting(ctx, absolute); err != nil {
				return nil, err
			}
		} else if found, err := hasSQLiteSidecar(absolute); err != nil {
			return nil, ErrStorageUnavailable
		} else if found {
			return nil, ErrSchemaUnsupported
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
	if err := bootstrapCurrentSchema(ctx, db); err != nil {
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

func hasSQLiteSidecar(path string) (bool, error) {
	for _, suffix := range []string{"-journal", "-shm", "-wal"} {
		info, err := os.Lstat(path + suffix)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return false, err
		}
		if !info.Mode().IsRegular() || info.Size() > 0 {
			return true, nil
		}
	}
	return false, nil
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
	if err := verifyCurrentSchema(ctx, db); err != nil {
		return err
	}
	return preflightRows(ctx, db)
}
func preflightRows(ctx context.Context, db *sql.DB) error {
	rows, err := db.QueryContext(ctx, `SELECT task_id,origin_host,process_id,process_definition_digest,current_node,revision,repository_identity,snapshot,created_at,updated_at,archived_at FROM tasks`)
	if err != nil {
		return ErrSchemaUnsupported
	}
	defer rows.Close()
	standard := workflow.StandardProcess().Reference
	tasks := map[string]preflightTask{}
	for rows.Next() {
		var taskID, originHost, processID, digest, node, repositoryIdentity, createdAt, updatedAt string
		var archivedAt sql.NullString
		var revision int64
		var snapshot []byte
		if err := rows.Scan(&taskID, &originHost, &processID, &digest, &node, &revision, &repositoryIdentity, &snapshot, &createdAt, &updatedAt, &archivedAt); err != nil {
			return ErrStorageUnavailable
		}
		if processID != string(standard.ID) || digest != string(standard.DefinitionDigest) {
			return ErrProcessUnsupported
		}
		task, err := decodeTask(snapshot)
		if err != nil {
			return err
		}
		if string(task.TaskID) != taskID || string(task.OriginHost) != originHost || task.Process != standard || string(task.CurrentNode) != node || int64(task.Revision) != revision || string(task.Repository.RepositoryIdentity) != repositoryIdentity || formatTime(task.CreatedAt) != createdAt || formatTime(task.UpdatedAt) != updatedAt {
			return ErrStorageUnavailable
		}
		archive, err := decodeArchiveTime(nullableString(archivedAt))
		if err != nil || archive != nil && !task.CurrentNode.Terminal() {
			return ErrStorageUnavailable
		}
		if _, exists := tasks[taskID]; exists {
			return ErrStorageUnavailable
		}
		expectedClaims := map[string]bool{}
		for _, identity := range repositoryClaimIdentities(task) {
			expectedClaims[string(identity)] = true
		}
		tasks[taskID] = preflightTask{task: task, originHost: originHost, terminal: task.CurrentNode.Terminal(), expectedClaims: expectedClaims}
	}
	if rows.Err() != nil || rows.Close() != nil {
		return ErrStorageUnavailable
	}
	claims, err := db.QueryContext(ctx, `SELECT repository_identity,task_id,origin_host FROM repository_claims`)
	if err != nil {
		return ErrSchemaUnsupported
	}
	defer claims.Close()
	claimCount := map[string]int{}
	for claims.Next() {
		var repositoryIdentity, taskID, originHost string
		if err := claims.Scan(&repositoryIdentity, &taskID, &originHost); err != nil {
			claims.Close()
			return ErrStorageUnavailable
		}
		task, exists := tasks[taskID]
		if !exists || task.terminal || !task.expectedClaims[repositoryIdentity] || task.originHost != originHost {
			claims.Close()
			return ErrStorageUnavailable
		}
		claimCount[taskID]++
		if claimCount[taskID] > len(task.expectedClaims) {
			claims.Close()
			return ErrStorageUnavailable
		}
	}
	if claims.Err() != nil || claims.Close() != nil {
		return ErrStorageUnavailable
	}
	for taskID, task := range tasks {
		if task.terminal && claimCount[taskID] != 0 || !task.terminal && claimCount[taskID] != len(task.expectedClaims) {
			return ErrStorageUnavailable
		}
		events, err := loadTaskEvents(ctx, db, domain.ID(taskID))
		if err != nil {
			return ErrStorageUnavailable
		}
		traversals := make([]workflow.CommittedTraversal, len(events))
		for index, event := range events {
			traversals[index] = workflow.CommittedTraversal{Revision: event.Revision, Kind: event.Kind, Source: event.SourceNode, Destination: event.DestinationNode, TransitionID: event.TransitionID, Reason: event.TransitionReason, CreatedAt: event.CreatedAt}
		}
		if !workflow.ProjectControlCenterGraph(task.task, traversals).Safe {
			return ErrStorageUnavailable
		}
	}
	return nil
}

type preflightTask struct {
	task           domain.ProcessTask
	originHost     string
	terminal       bool
	expectedClaims map[string]bool
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
	return s.load(ctx, `SELECT task_id,origin_host,process_id,process_definition_digest,current_node,revision,repository_identity,snapshot,created_at,updated_at FROM tasks WHERE task_id=?`, string(id))
}
func (s *SQLite) LoadActiveTask(ctx context.Context, identity domain.Digest) (domain.ProcessTask, error) {
	return s.load(ctx, `SELECT t.task_id,t.origin_host,t.process_id,t.process_definition_digest,t.current_node,t.revision,t.repository_identity,t.snapshot,t.created_at,t.updated_at FROM repository_claims c JOIN tasks t ON t.task_id=c.task_id WHERE c.repository_identity=?`, string(identity))
}
func (s *SQLite) load(ctx context.Context, query, arg string) (domain.ProcessTask, error) {
	if s == nil || s.db == nil {
		return domain.ProcessTask{}, ErrStorageUnavailable
	}
	task, err := scanStoredTask(s.db.QueryRowContext(ctx, query, arg))
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ProcessTask{}, ErrTaskNotFound
	}
	if err != nil {
		return domain.ProcessTask{}, ErrStorageUnavailable
	}
	return task, nil
}

type rowScanner interface {
	Scan(...any) error
}

func scanStoredTask(row rowScanner) (domain.ProcessTask, error) {
	var taskID, host, processID, digest, node, identity, created, updated string
	var revision int64
	var snapshot []byte
	err := row.Scan(&taskID, &host, &processID, &digest, &node, &revision, &identity, &snapshot, &created, &updated)
	if err != nil {
		return domain.ProcessTask{}, err
	}
	task, err := decodeTask(snapshot)
	if err != nil {
		return domain.ProcessTask{}, err
	}
	if taskID != string(task.TaskID) || host != string(task.OriginHost) || processID != string(task.Process.ID) || digest != string(task.Process.DefinitionDigest) || node != string(task.CurrentNode) || revision != int64(task.Revision) || identity != string(task.Repository.RepositoryIdentity) || created != formatTime(task.CreatedAt) || updated != formatTime(task.UpdatedAt) {
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
		_, err = tx.ExecContext(ctx, `INSERT INTO tasks(task_id,origin_host,process_id,process_definition_digest,current_node,revision,repository_identity,snapshot,created_at,updated_at,archived_at) VALUES(?,?,?,?,?,?,?,?,?,?,NULL)`, m.Task.TaskID, m.Task.OriginHost, m.Task.Process.ID, m.Task.Process.DefinitionDigest, m.Task.CurrentNode, m.Task.Revision, m.Task.Repository.RepositoryIdentity, snapshot, formatTime(m.Task.CreatedAt), formatTime(m.Task.UpdatedAt))
	} else {
		result, e := tx.ExecContext(ctx, `UPDATE tasks SET current_node=?,revision=?,snapshot=?,updated_at=? WHERE task_id=? AND revision=? AND process_id=? AND process_definition_digest=?`, m.Task.CurrentNode, m.Task.Revision, snapshot, formatTime(m.Task.UpdatedAt), m.Task.TaskID, m.ExpectedRevision, m.Task.Process.ID, m.Task.Process.DefinitionDigest)
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

func (s *SQLite) StageActionCommit(ctx context.Context, task domain.ProcessTask) error {
	commit := task.ActionCommit
	if s == nil || s.db == nil || commit == nil || task.CurrentAction == nil ||
		commit.Operation.ExpectedRevision != task.Revision || commit.Operation.SourceCursor != task.CurrentNode ||
		commit.Operation.ActionID != task.CurrentAction.ActionID || commit.Operation.ActionKind != task.CurrentAction.Kind ||
		workflow.ValidateProcessTask(task) != nil {
		return ErrInvalidArgument
	}
	snapshot, err := encodeTask(task)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return ErrStorageUnavailable
	}
	defer tx.Rollback()
	current, err := scanStoredTask(tx.QueryRowContext(ctx, `SELECT task_id,origin_host,process_id,process_definition_digest,current_node,revision,repository_identity,snapshot,created_at,updated_at FROM tasks WHERE task_id=?`, task.TaskID))
	if errors.Is(err, sql.ErrNoRows) {
		return ErrTaskNotFound
	}
	if err != nil {
		return ErrStorageUnavailable
	}
	if current.Revision != task.Revision || current.CurrentAction == nil || current.CurrentAction.ActionID != task.CurrentAction.ActionID {
		return ErrRevisionConflict
	}
	if current.ActionCommit != nil && current.ActionCommit.Operation.ActionID == commit.Operation.ActionID {
		if current.ActionCommit.Equal(*commit) {
			return nil
		}
		return ErrInvalidArgument
	}
	comparable := task
	comparable.ActionCommit = current.ActionCommit
	currentSnapshot, currentErr := encodeTask(current)
	comparableSnapshot, comparableErr := encodeTask(comparable)
	if currentErr != nil || comparableErr != nil || !bytes.Equal(currentSnapshot, comparableSnapshot) {
		return ErrInvalidArgument
	}
	result, err := tx.ExecContext(ctx, `UPDATE tasks SET snapshot=? WHERE task_id=? AND revision=?`, snapshot, task.TaskID, task.Revision)
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
	identities := repositoryClaimIdentities(m.Task)
	switch m.Claim {
	case ClaimAcquire:
		for _, identity := range identities {
			if _, err := tx.ExecContext(ctx, `INSERT INTO repository_claims(repository_identity,task_id,origin_host,claimed_at) VALUES(?,?,?,?)`, identity, m.Task.TaskID, m.Task.OriginHost, formatTime(m.Event.CreatedAt)); err != nil {
				return ErrActiveTaskConflict
			}
		}
	case ClaimRetain:
		if err := validateClaimSet(ctx, tx, m.Task, identities); err != nil {
			return ErrStorageUnavailable
		}
	case ClaimRelease:
		if err := validateClaimSet(ctx, tx, m.Task, identities); err != nil {
			return ErrStorageUnavailable
		}
		result, err := tx.ExecContext(ctx, `DELETE FROM repository_claims WHERE task_id=?`, m.Task.TaskID)
		if err != nil {
			return ErrStorageUnavailable
		}
		n, _ := result.RowsAffected()
		if n != int64(len(identities)) {
			return ErrStorageUnavailable
		}
	default:
		return ErrInvalidArgument
	}
	return nil
}

func validateClaimSet(ctx context.Context, tx *sql.Tx, task domain.ProcessTask, expected []domain.Digest) error {
	rows, err := tx.QueryContext(ctx, `SELECT repository_identity,origin_host FROM repository_claims WHERE task_id=? ORDER BY repository_identity`, task.TaskID)
	if err != nil {
		return ErrStorageUnavailable
	}
	defer rows.Close()
	actual := make([]string, 0, len(expected))
	for rows.Next() {
		var identity, host string
		if rows.Scan(&identity, &host) != nil || host != string(task.OriginHost) {
			return ErrStorageUnavailable
		}
		actual = append(actual, identity)
	}
	if rows.Err() != nil || rows.Close() != nil || len(actual) != len(expected) {
		return ErrStorageUnavailable
	}
	want := make([]string, len(expected))
	for i, identity := range expected {
		want[i] = string(identity)
	}
	sort.Strings(want)
	for i := range want {
		if want[i] != actual[i] {
			return ErrStorageUnavailable
		}
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

func nullableString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	copy := value.String
	return &copy
}
