package store

import (
	"context"
	"testing"
)

func TestFreshSchema2BootstrapIsDirectAndExact(t *testing.T) {
	path := dbPath(t)
	store, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	store.Close()
	db := openRaw(t, path)
	defer db.Close()
	var count, version int
	var digest string
	if err := db.QueryRow(`SELECT COUNT(*),MIN(version),MIN(digest) FROM schema_migrations`).Scan(&count, &version, &digest); err != nil {
		t.Fatal(err)
	}
	if count != 1 || version != 2 || digest != schema2Digest() {
		t.Fatalf("history=%d/%d/%s", count, version, digest)
	}
	for _, name := range append(requiredTables, requiredIndexes...) {
		var found string
		if err := db.QueryRow(`SELECT name FROM sqlite_master WHERE name=?`, name).Scan(&found); err != nil || found != name {
			t.Fatalf("missing %s", name)
		}
	}
}

func TestBootstrapFailureLeavesNoPartialSchema(t *testing.T) {
	path := dbPath(t)
	db := openRaw(t, path)
	original := schema2Statements
	schema2Statements = append(append([]string(nil), original...), `CREATE TABLE tasks (`)
	defer func() { schema2Statements = original }()
	if err := bootstrapSchema2(context.Background(), db, testGraphTask(t).CreatedAt); err == nil {
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
	before := fileDigest(t, path)
	if _, err := Open(context.Background(), path); err == nil {
		t.Fatal("partial schema accepted")
	}
	after := fileDigest(t, path)
	if before != after {
		t.Fatal("unsupported database changed")
	}
}
