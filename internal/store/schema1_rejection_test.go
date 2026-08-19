package store

import (
	"context"
	"errors"
	"testing"
)

func TestSchema1IsRejectedBeforeDecodeWithZeroWrites(t *testing.T) {
	path := dbPath(t)
	db := openRaw(t, path)
	_, err := db.Exec(`CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL,digest TEXT NOT NULL);INSERT INTO schema_migrations VALUES(1,'old','old');CREATE TABLE tasks(task_id TEXT PRIMARY KEY,snapshot BLOB);INSERT INTO tasks VALUES('old-task',X'7B227068617365223A22494E54414B45227D');CREATE TABLE task_events(event_id TEXT PRIMARY KEY,task_id TEXT);INSERT INTO task_events VALUES('old-event','old-task');CREATE TABLE repository_claims(repository_identity TEXT PRIMARY KEY,task_id TEXT);INSERT INTO repository_claims VALUES('old-repository','old-task')`)
	if err != nil {
		t.Fatal(err)
	}
	db.Close()
	before := fileDigest(t, path)
	_, err = Open(context.Background(), path)
	if !errors.Is(err, ErrSchemaUnsupported) {
		t.Fatalf("error=%v", err)
	}
	after := fileDigest(t, path)
	if before != after {
		t.Fatal("Schema 1 file changed")
	}
	db = openRaw(t, path)
	defer db.Close()
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM schema_migrations`).Scan(&count); err != nil || count != 1 {
		t.Fatal("history changed")
	}
}
