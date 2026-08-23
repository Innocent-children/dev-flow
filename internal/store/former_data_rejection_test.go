package store

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestSchemaVersionZeroPointOneIsRejectedBeforeDecodeWithZeroWrites(t *testing.T) {
	path := dbPath(t)
	db := openRaw(t, path)
	for index, statement := range currentSchemaStatements {
		if index == 7 {
			continue
		}
		if index == 6 {
			statement = strings.Replace(statement, "task_id TEXT NOT NULL", "task_id TEXT NOT NULL UNIQUE", 1)
		}
		if _, err := db.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(`INSERT INTO schema_metadata(version) VALUES ('0.1.0')`); err != nil {
		t.Fatal(err)
	}
	db.Close()
	before := databaseManifest(t, path)
	_, err := Open(context.Background(), path)
	if !errors.Is(err, ErrSchemaUnsupported) {
		t.Fatalf("error=%v", err)
	}
	assertDatabaseManifestUnchanged(t, path, before)
	db = openRaw(t, path)
	defer db.Close()
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM schema_metadata WHERE version='0.1.0'`).Scan(&count); err != nil || count != 1 {
		t.Fatal("former schema identity changed")
	}
}
