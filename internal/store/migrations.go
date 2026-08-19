package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"strconv"
	"strings"
	"time"
)

const SchemaVersion = 2
const SnapshotVersion = 2

var schema2Statements = []string{
	`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL, digest TEXT NOT NULL)`,
	`CREATE TABLE tasks (task_id TEXT PRIMARY KEY, origin_host TEXT NOT NULL, process_id TEXT NOT NULL, process_version INTEGER NOT NULL CHECK (process_version >= 1), process_definition_digest TEXT NOT NULL, snapshot_version INTEGER NOT NULL CHECK (snapshot_version = 2), current_node TEXT NOT NULL, revision INTEGER NOT NULL CHECK (revision >= 1), repository_identity TEXT NOT NULL, snapshot BLOB NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
	`CREATE INDEX tasks_node_idx ON tasks (current_node)`,
	`CREATE INDEX tasks_origin_host_idx ON tasks (origin_host)`,
	`CREATE INDEX tasks_updated_at_idx ON tasks (updated_at)`,
	`CREATE INDEX tasks_process_idx ON tasks (process_id, process_version, snapshot_version)`,
	`CREATE TABLE task_events (event_id TEXT PRIMARY KEY, task_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK (revision >= 1), event_type TEXT NOT NULL, source_node TEXT NOT NULL, destination_node TEXT NOT NULL, transition_id TEXT, transition_reason TEXT, action_id TEXT, request_id TEXT NOT NULL, payload_digest TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE (task_id, revision), FOREIGN KEY (task_id) REFERENCES tasks (task_id) ON DELETE RESTRICT)`,
	`CREATE TABLE repository_claims (repository_identity TEXT PRIMARY KEY, task_id TEXT NOT NULL UNIQUE, origin_host TEXT NOT NULL, claimed_at TEXT NOT NULL, FOREIGN KEY (task_id) REFERENCES tasks (task_id) ON DELETE RESTRICT)`,
}
var schema2Objects = []struct {
	name           string
	kind           string
	statementIndex int
}{
	{"schema_migrations", "table", 0},
	{"tasks", "table", 1},
	{"tasks_node_idx", "index", 2},
	{"tasks_origin_host_idx", "index", 3},
	{"tasks_updated_at_idx", "index", 4},
	{"tasks_process_idx", "index", 5},
	{"task_events", "table", 6},
	{"repository_claims", "table", 7},
}
var requiredTables = []string{"schema_migrations", "tasks", "task_events", "repository_claims"}
var requiredIndexes = []string{"tasks_node_idx", "tasks_origin_host_idx", "tasks_updated_at_idx", "tasks_process_idx"}
var requiredColumns = map[string][]string{"schema_migrations": {"version", "applied_at", "digest"}, "tasks": {"task_id", "origin_host", "process_id", "process_version", "process_definition_digest", "snapshot_version", "current_node", "revision", "repository_identity", "snapshot", "created_at", "updated_at"}, "task_events": {"event_id", "task_id", "revision", "event_type", "source_node", "destination_node", "transition_id", "transition_reason", "action_id", "request_id", "payload_digest", "created_at"}, "repository_claims": {"repository_identity", "task_id", "origin_host", "claimed_at"}}

func schema2Digest() string {
	h := sha256.New()
	h.Write([]byte(strconv.Itoa(SchemaVersion)))
	h.Write([]byte{0})
	for _, statement := range schema2Statements {
		h.Write([]byte(strings.TrimSpace(statement)))
		h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil))
}
func bootstrapSchema2(ctx context.Context, db *sql.DB, now time.Time) error {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return ErrStorageUnavailable
	}
	defer tx.Rollback()
	has, err := hasUserTables(ctx, tx)
	if err != nil {
		return ErrStorageUnavailable
	}
	if has {
		return verifySchema2(ctx, tx)
	}
	for _, statement := range schema2Statements {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			return ErrStorageUnavailable
		}
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations(version,applied_at,digest) VALUES(2,?,?)`, now.UTC().Format(time.RFC3339Nano), schema2Digest()); err != nil {
		return ErrStorageUnavailable
	}
	if err := verifySchema2(ctx, tx); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return ErrStorageUnavailable
	}
	return nil
}

type queryer interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func hasUserTables(ctx context.Context, q queryer) (bool, error) {
	var n int
	err := q.QueryRowContext(ctx, `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).Scan(&n)
	return n != 0, err
}
func verifySchema2(ctx context.Context, q queryer) error {
	var version int
	var digest string
	var count int
	if err := q.QueryRowContext(ctx, `SELECT COUNT(*),COALESCE(MIN(version),0),COALESCE(MIN(digest),'') FROM schema_migrations`).Scan(&count, &version, &digest); err != nil || count != 1 || version != 2 || digest != schema2Digest() {
		return ErrSchemaUnsupported
	}
	for _, name := range append(append([]string{}, requiredTables...), requiredIndexes...) {
		var found string
		if err := q.QueryRowContext(ctx, `SELECT name FROM sqlite_master WHERE name=?`, name).Scan(&found); err != nil || found != name {
			return ErrSchemaUnsupported
		}
	}
	for _, object := range schema2Objects {
		if object.statementIndex >= len(schema2Statements) {
			return ErrSchemaUnsupported
		}
		var actual string
		if err := q.QueryRowContext(ctx, `SELECT sql FROM sqlite_master WHERE type=? AND name=?`, object.kind, object.name).Scan(&actual); err != nil ||
			normalizeSchemaSQL(actual) != normalizeSchemaSQL(schema2Statements[object.statementIndex]) {
			return ErrSchemaUnsupported
		}
	}
	for table, columns := range requiredColumns {
		for _, column := range columns {
			var n int
			if err := q.QueryRowContext(ctx, `SELECT COUNT(*) FROM pragma_table_info(?) WHERE name=?`, table, column).Scan(&n); err != nil || n != 1 {
				return ErrSchemaUnsupported
			}
		}
	}
	return nil
}

func normalizeSchemaSQL(statement string) string {
	return strings.ToLower(strings.Join(strings.Fields(strings.TrimSpace(statement)), " "))
}
