package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"math"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
	_ "modernc.org/sqlite"
)

// SQLite is the Schema 1 implementation of Store.
type SQLite struct {
	db *sql.DB
}

// Open opens or creates one SQLite task store and verifies its schema before
// returning it to the caller.
func Open(ctx context.Context, path string) (*SQLite, error) {
	dsn, err := sqliteDataSourceName(path)
	if err != nil {
		return nil, ErrInvalidArgument
	}

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, ErrStorageUnavailable
	}
	db.SetMaxOpenConns(1)

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, ErrStorageUnavailable
	}
	if err := migrate(ctx, db, time.Now()); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &SQLite{db: db}, nil
}

func sqliteDataSourceName(path string) (string, error) {
	if path == "" {
		return "", ErrInvalidArgument
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	u := &url.URL{Scheme: "file", Path: filepath.Clean(absolute)}
	query := u.Query()
	query.Set("_foreign_keys", "on")
	query.Set("_busy_timeout", strconv.FormatInt(domain.SQLiteBusyTimeout.Milliseconds(), 10))
	u.RawQuery = query.Encode()
	return u.String(), nil
}

// Close releases the database handle. It does not remove persisted data.
func (s *SQLite) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	if err := s.db.Close(); err != nil {
		return ErrStorageUnavailable
	}
	return nil
}

// LoadTask reads the authoritative typed snapshot for taskID in a read-only
// transaction.
func (s *SQLite) LoadTask(ctx context.Context, taskID domain.ID) (domain.Task, error) {
	if s == nil || s.db == nil || !validIdentifier(string(taskID)) {
		return domain.Task{}, ErrInvalidArgument
	}
	return s.loadTask(
		ctx,
		`SELECT task_id, origin_host, phase, revision, repository_identity,
		        snapshot, created_at, updated_at
		   FROM tasks
		  WHERE task_id = ?`,
		string(taskID),
	)
}

// LoadActiveTask resolves the unique active task through its repository claim.
func (s *SQLite) LoadActiveTask(
	ctx context.Context,
	repositoryIdentity domain.Digest,
) (domain.Task, error) {
	if s == nil || s.db == nil || !validSHA256(string(repositoryIdentity)) {
		return domain.Task{}, ErrInvalidArgument
	}
	return s.loadTask(
		ctx,
		`SELECT t.task_id, t.origin_host, t.phase, t.revision, t.repository_identity,
		        t.snapshot, t.created_at, t.updated_at
		   FROM repository_claims AS c
		   JOIN tasks AS t ON t.task_id = c.task_id
		  WHERE c.repository_identity = ?`,
		string(repositoryIdentity),
	)
}

func (s *SQLite) loadTask(
	ctx context.Context,
	query string,
	argument string,
) (task domain.Task, err error) {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{
		Isolation: sql.LevelSerializable,
		ReadOnly:  true,
	})
	if err != nil {
		return domain.Task{}, ErrStorageUnavailable
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var (
		taskID, originHost, phase, repositoryIdentity string
		revision                                      int64
		snapshot                                      []byte
		createdAt, updatedAt                          string
	)
	err = tx.QueryRowContext(ctx, query, argument).Scan(
		&taskID,
		&originHost,
		&phase,
		&revision,
		&repositoryIdentity,
		&snapshot,
		&createdAt,
		&updatedAt,
	)
	if err == sql.ErrNoRows {
		return domain.Task{}, ErrTaskNotFound
	}
	if err != nil {
		return domain.Task{}, ErrStorageUnavailable
	}

	task, err = decodeTask(snapshot)
	if err != nil {
		return domain.Task{}, err
	}
	if !taskMatchesColumns(
		task,
		taskID,
		originHost,
		phase,
		revision,
		repositoryIdentity,
		createdAt,
		updatedAt,
	) {
		return domain.Task{}, ErrStorageUnavailable
	}
	if err := tx.Commit(); err != nil {
		return domain.Task{}, ErrStorageUnavailable
	}
	return task, nil
}

// CommitTask atomically commits one authoritative snapshot, its same-revision
// audit event, and its repository-claim effect.
func (s *SQLite) CommitTask(ctx context.Context, mutation TaskMutation) (err error) {
	if s == nil || s.db == nil {
		return ErrStorageUnavailable
	}
	snapshot, err := encodeTask(mutation.Task)
	if err != nil {
		return err
	}
	if err := validateMutation(mutation); err != nil {
		return err
	}
	if mutation.ExpectedRevision != 0 {
		current, err := s.LoadTask(ctx, mutation.Task.TaskID)
		if err != nil {
			return err
		}
		if current.Revision != mutation.ExpectedRevision {
			return ErrRevisionConflict
		}
		if !current.Contract.Equal(mutation.Task.Contract) {
			return ErrInvalidArgument
		}
	}

	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return ErrStorageUnavailable
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if mutation.ExpectedRevision == 0 {
		if err := insertTask(ctx, tx, mutation.Task, snapshot); err != nil {
			return err
		}
	} else if err := compareAndSwapTask(ctx, tx, mutation, snapshot); err != nil {
		return err
	}
	if err := insertEvent(ctx, tx, mutation.Event); err != nil {
		return err
	}
	if err := applyClaim(ctx, tx, mutation); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return ErrStorageUnavailable
	}
	return nil
}

func insertTask(ctx context.Context, tx *sql.Tx, task domain.Task, snapshot []byte) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO tasks (
		     task_id, origin_host, phase, revision, repository_identity,
		     snapshot, created_at, updated_at
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		string(task.TaskID),
		string(task.OriginHost),
		string(task.Phase),
		int64(task.Revision),
		string(task.Repository.RepositoryIdentity),
		snapshot,
		formatTime(task.CreatedAt),
		formatTime(task.UpdatedAt),
	)
	if err != nil {
		return ErrStorageUnavailable
	}
	return nil
}

func compareAndSwapTask(
	ctx context.Context,
	tx *sql.Tx,
	mutation TaskMutation,
	snapshot []byte,
) error {
	task := mutation.Task
	result, err := tx.ExecContext(
		ctx,
		`UPDATE tasks
		    SET phase = ?, revision = ?, snapshot = ?, updated_at = ?
		  WHERE task_id = ?
		    AND revision = ?
		    AND origin_host = ?
		    AND repository_identity = ?
		    AND created_at = ?
		    AND phase = ?`,
		string(task.Phase),
		int64(task.Revision),
		snapshot,
		formatTime(task.UpdatedAt),
		string(task.TaskID),
		int64(mutation.ExpectedRevision),
		string(task.OriginHost),
		string(task.Repository.RepositoryIdentity),
		formatTime(task.CreatedAt),
		string(mutation.Event.PhaseBefore),
	)
	if err != nil {
		return ErrStorageUnavailable
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return ErrStorageUnavailable
	}
	if rows == 1 {
		return nil
	}

	var revision int64
	err = tx.QueryRowContext(
		ctx,
		`SELECT revision FROM tasks WHERE task_id = ?`,
		string(task.TaskID),
	).Scan(&revision)
	if err == sql.ErrNoRows {
		return ErrTaskNotFound
	}
	if err != nil {
		return ErrStorageUnavailable
	}
	if revision != int64(mutation.ExpectedRevision) {
		return ErrRevisionConflict
	}
	return ErrInvalidArgument
}

func insertEvent(ctx context.Context, tx *sql.Tx, event TaskEvent) error {
	var actionID any
	if event.ActionID != "" {
		actionID = string(event.ActionID)
	}
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO task_events (
		     event_id, task_id, revision, event_type, phase_before, phase_after,
		     action_id, request_id, payload_digest, created_at
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		string(event.EventID),
		string(event.TaskID),
		int64(event.Revision),
		event.EventType,
		string(event.PhaseBefore),
		string(event.PhaseAfter),
		actionID,
		string(event.RequestID),
		string(event.PayloadDigest),
		formatTime(event.CreatedAt),
	)
	if err != nil {
		return ErrStorageUnavailable
	}
	return nil
}

func applyClaim(ctx context.Context, tx *sql.Tx, mutation TaskMutation) error {
	task := mutation.Task
	switch mutation.Claim {
	case ClaimAcquire:
		_, err := tx.ExecContext(
			ctx,
			`INSERT INTO repository_claims (
			     repository_identity, task_id, origin_host, claimed_at
			 ) VALUES (?, ?, ?, ?)`,
			string(task.Repository.RepositoryIdentity),
			string(task.TaskID),
			string(task.OriginHost),
			formatTime(mutation.Event.CreatedAt),
		)
		if err != nil {
			if ctx.Err() != nil {
				return ErrStorageUnavailable
			}
			return ErrActiveTaskConflict
		}
		return nil
	case ClaimRetain:
		var repositoryIdentity, originHost string
		err := tx.QueryRowContext(
			ctx,
			`SELECT repository_identity, origin_host
			   FROM repository_claims
			  WHERE task_id = ?`,
			string(task.TaskID),
		).Scan(&repositoryIdentity, &originHost)
		if err != nil ||
			repositoryIdentity != string(task.Repository.RepositoryIdentity) ||
			originHost != string(task.OriginHost) {
			return ErrStorageUnavailable
		}
		return nil
	case ClaimRelease:
		result, err := tx.ExecContext(
			ctx,
			`DELETE FROM repository_claims
			  WHERE repository_identity = ? AND task_id = ? AND origin_host = ?`,
			string(task.Repository.RepositoryIdentity),
			string(task.TaskID),
			string(task.OriginHost),
		)
		if err != nil {
			return ErrStorageUnavailable
		}
		rows, err := result.RowsAffected()
		if err != nil || rows != 1 {
			return ErrStorageUnavailable
		}
		return nil
	default:
		return ErrInvalidArgument
	}
}

func validateMutation(mutation TaskMutation) error {
	task := mutation.Task
	if mutation.ExpectedRevision > math.MaxInt64 ||
		task.Revision > math.MaxInt64 ||
		mutation.ExpectedRevision == math.MaxUint64 ||
		task.Revision != mutation.ExpectedRevision+1 {
		return ErrInvalidArgument
	}
	if !validIdentifier(string(task.TaskID)) ||
		mutation.Event.TaskID != task.TaskID ||
		mutation.Event.Revision != task.Revision ||
		mutation.Event.PhaseAfter != task.Phase ||
		!validTaskEvent(mutation.Event) {
		return ErrInvalidArgument
	}
	terminal := task.Phase.Terminal()
	switch {
	case mutation.ExpectedRevision == 0:
		if mutation.Claim != ClaimAcquire || terminal || mutation.Event.PhaseBefore != task.Phase {
			return ErrInvalidArgument
		}
	case terminal:
		if mutation.Claim != ClaimRelease {
			return ErrInvalidArgument
		}
	default:
		if mutation.Claim != ClaimRetain {
			return ErrInvalidArgument
		}
	}
	return nil
}

func validTaskEvent(event TaskEvent) bool {
	return validIdentifier(string(event.EventID)) &&
		validIdentifier(string(event.TaskID)) &&
		validIdentifier(event.EventType) &&
		(event.ActionID == "" || validIdentifier(string(event.ActionID))) &&
		validIdentifier(string(event.RequestID)) &&
		validSHA256(string(event.PayloadDigest)) &&
		event.PhaseBefore.IsValid() &&
		event.PhaseAfter.IsValid() &&
		!event.CreatedAt.IsZero() &&
		isUTC(event.CreatedAt)
}

func validIdentifier(value string) bool {
	return utf8.ValidString(value) &&
		value != "" &&
		len(value) <= domain.MaxIdentifierBytes &&
		strings.TrimSpace(value) == value &&
		strings.IndexFunc(value, unicode.IsSpace) < 0
}

func validSHA256(value string) bool {
	if len(value) != sha256.Size*2 || strings.ToLower(value) != value {
		return false
	}
	_, err := hex.DecodeString(value)
	return err == nil
}

func isUTC(value time.Time) bool {
	_, offset := value.Zone()
	return offset == 0
}

func formatTime(value time.Time) string {
	return value.UTC().Format(time.RFC3339Nano)
}

func taskMatchesColumns(
	task domain.Task,
	taskID string,
	originHost string,
	phase string,
	revision int64,
	repositoryIdentity string,
	createdAt string,
	updatedAt string,
) bool {
	return revision >= 0 &&
		string(task.TaskID) == taskID &&
		string(task.OriginHost) == originHost &&
		string(task.Phase) == phase &&
		task.Revision == uint64(revision) &&
		string(task.Repository.RepositoryIdentity) == repositoryIdentity &&
		formatTime(task.CreatedAt) == createdAt &&
		formatTime(task.UpdatedAt) == updatedAt
}
