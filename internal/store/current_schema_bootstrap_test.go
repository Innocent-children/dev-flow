package store

import (
	"context"
	"testing"
)

func TestFreshCurrentSchemaBootstrapIsDirectAndExact(t *testing.T) {
	path := dbPath(t)
	store, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	store.Close()
	db := openRaw(t, path)
	defer db.Close()
	if err := verifyCurrentSchema(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	var version string
	if err := db.QueryRow(`SELECT version FROM schema_metadata`).Scan(&version); err != nil {
		t.Fatal(err)
	}
	if version != DatabaseSchemaVersion {
		t.Fatalf("database version=%q", version)
	}
}

func TestBootstrapFailureLeavesNoPartialSchema(t *testing.T) {
	path := dbPath(t)
	db := openRaw(t, path)
	original := currentSchemaStatements
	currentSchemaStatements = append(append([]string(nil), original...), `CREATE TABLE tasks (`)
	defer func() { currentSchemaStatements = original }()
	if err := bootstrapCurrentSchema(context.Background(), db); err == nil {
		t.Fatal("invalid bootstrap succeeded")
	}
	defer db.Close()
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("partial tables=%d", count)
	}
}
func TestPartialSchemaIsRejectedWithoutCompletion(t *testing.T) {
	path := dbPath(t)
	db := openRaw(t, path)
	if _, err := db.Exec(`CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT,digest TEXT);INSERT INTO schema_migrations VALUES(2,'x','bad')`); err != nil {
		t.Fatal(err)
	}
	db.Close()
	before := databaseManifest(t, path)
	if _, err := Open(context.Background(), path); err == nil {
		t.Fatal("partial schema accepted")
	}
	assertDatabaseManifestUnchanged(t, path, before)
}
