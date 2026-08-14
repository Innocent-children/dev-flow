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

// SchemaVersion is the newest database schema this build understands.
const SchemaVersion = 1

var schema1Statements = []string{
	`CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL,
    digest TEXT NOT NULL
)`,
	`CREATE TABLE tasks (
    task_id TEXT PRIMARY KEY,
    origin_host TEXT NOT NULL,
    phase TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    repository_identity TEXT NOT NULL,
    snapshot BLOB NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)`,
	`CREATE INDEX tasks_phase_idx ON tasks (phase)`,
	`CREATE INDEX tasks_origin_host_idx ON tasks (origin_host)`,
	`CREATE INDEX tasks_updated_at_idx ON tasks (updated_at)`,
	`CREATE TABLE task_events (
    event_id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    event_type TEXT NOT NULL,
    phase_before TEXT NOT NULL,
    phase_after TEXT NOT NULL,
    action_id TEXT,
    request_id TEXT NOT NULL,
    payload_digest TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (task_id, revision),
    FOREIGN KEY (task_id) REFERENCES tasks (task_id) ON DELETE RESTRICT
)`,
	`CREATE TABLE repository_claims (
    repository_identity TEXT PRIMARY KEY,
    task_id TEXT NOT NULL UNIQUE,
    origin_host TEXT NOT NULL,
    claimed_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks (task_id) ON DELETE RESTRICT
)`,
}

var requiredSchema1Tables = [...]string{
	"schema_migrations",
	"tasks",
	"task_events",
	"repository_claims",
}

type migration struct {
	version    int
	statements []string
}

var migrations = [...]migration{
	{version: 1, statements: schema1Statements},
}

func migrationDigest(m migration) string {
	hash := sha256.New()
	hash.Write([]byte(strconv.Itoa(m.version)))
	hash.Write([]byte{0})
	for _, statement := range m.statements {
		hash.Write([]byte(strings.TrimSpace(statement)))
		hash.Write([]byte{0})
	}
	return hex.EncodeToString(hash.Sum(nil))
}

func migrate(ctx context.Context, db *sql.DB, now time.Time) (err error) {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return ErrStorageUnavailable
	}
	defer func() {
		_ = tx.Rollback()
	}()

	exists, err := tableExists(ctx, tx, "schema_migrations")
	if err != nil {
		return ErrStorageUnavailable
	}
	if !exists {
		hasTables, err := hasUserTables(ctx, tx)
		if err != nil {
			return ErrStorageUnavailable
		}
		if hasTables {
			return ErrSchemaUnsupported
		}
		if err := applyMigration(ctx, tx, migrations[0], now); err != nil {
			return err
		}
	} else if err := verifyAppliedMigrations(ctx, tx); err != nil {
		return err
	}

	if err := verifySchema1Tables(ctx, tx); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return ErrStorageUnavailable
	}
	return nil
}

func applyMigration(ctx context.Context, tx *sql.Tx, m migration, now time.Time) error {
	for _, statement := range m.statements {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			return ErrStorageUnavailable
		}
	}
	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO schema_migrations (version, applied_at, digest) VALUES (?, ?, ?)`,
		m.version,
		now.UTC().Format(time.RFC3339Nano),
		migrationDigest(m),
	); err != nil {
		return ErrStorageUnavailable
	}
	return nil
}

func verifyAppliedMigrations(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(
		ctx,
		`SELECT version, digest FROM schema_migrations ORDER BY version`,
	)
	if err != nil {
		return ErrSchemaUnsupported
	}
	defer rows.Close()

	nextVersion := 1
	for rows.Next() {
		var version int
		var digest string
		if err := rows.Scan(&version, &digest); err != nil {
			return ErrSchemaUnsupported
		}
		if version > SchemaVersion || version != nextVersion {
			return ErrSchemaUnsupported
		}
		m := migrations[version-1]
		if digest != migrationDigest(m) {
			return ErrSchemaUnsupported
		}
		nextVersion++
	}
	if err := rows.Err(); err != nil {
		return ErrSchemaUnsupported
	}
	if nextVersion != SchemaVersion+1 {
		return ErrSchemaUnsupported
	}
	return nil
}

func verifySchema1Tables(ctx context.Context, tx *sql.Tx) error {
	for _, table := range requiredSchema1Tables {
		exists, err := tableExists(ctx, tx, table)
		if err != nil || !exists {
			return ErrSchemaUnsupported
		}
	}
	return nil
}

type rowQueryer interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func tableExists(ctx context.Context, queryer rowQueryer, name string) (bool, error) {
	var found string
	err := queryer.QueryRowContext(
		ctx,
		`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
		name,
	).Scan(&found)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return found == name, nil
}

func hasUserTables(ctx context.Context, queryer rowQueryer) (bool, error) {
	var count int
	err := queryer.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
	).Scan(&count)
	return count != 0, err
}
