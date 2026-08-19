package store

import (
	"context"
	"errors"
	"testing"
)

func TestFutureSchemaAndUnsupportedProcessSafeStop(t *testing.T) {
	t.Run("future schema", func(t *testing.T) {
		path := dbPath(t)
		db := openRaw(t, path)
		if _, err := db.Exec(`CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT,digest TEXT);INSERT INTO schema_migrations VALUES(3,'future','future')`); err != nil {
			t.Fatal(err)
		}
		db.Close()
		before := fileDigest(t, path)
		_, err := Open(context.Background(), path)
		if !errors.Is(err, ErrSchemaUnsupported) {
			t.Fatalf("error=%v", err)
		}
		if before != fileDigest(t, path) {
			t.Fatal("future schema changed")
		}
	})
	t.Run("unsupported process", func(t *testing.T) {
		path := dbPath(t)
		store, err := Open(context.Background(), path)
		if err != nil {
			t.Fatal(err)
		}
		task := testGraphTask(t)
		if err := store.CommitTask(context.Background(), testMutation(t, task)); err != nil {
			t.Fatal(err)
		}
		store.Close()
		db := openRaw(t, path)
		if _, err := db.Exec(`UPDATE tasks SET process_id='future-process'`); err != nil {
			t.Fatal(err)
		}
		db.Close()
		before := fileDigest(t, path)
		_, err = Open(context.Background(), path)
		if !errors.Is(err, ErrProcessUnsupported) {
			t.Fatalf("error=%v", err)
		}
		if before != fileDigest(t, path) {
			t.Fatal("unsupported process changed")
		}
	})
	t.Run("malformed snapshot", func(t *testing.T) {
		path := dbPath(t)
		store, err := Open(context.Background(), path)
		if err != nil {
			t.Fatal(err)
		}
		task := testGraphTask(t)
		if err := store.CommitTask(context.Background(), testMutation(t, task)); err != nil {
			t.Fatal(err)
		}
		store.Close()
		db := openRaw(t, path)
		if _, err := db.Exec(`UPDATE tasks SET snapshot=X'7B7D'`); err != nil {
			t.Fatal(err)
		}
		db.Close()
		before := fileDigest(t, path)
		_, err = Open(context.Background(), path)
		if !errors.Is(err, ErrStorageUnavailable) {
			t.Fatalf("error=%v", err)
		}
		if before != fileDigest(t, path) {
			t.Fatal("malformed row changed")
		}
	})
	t.Run("row snapshot mismatch", func(t *testing.T) {
		path := dbPath(t)
		store, err := Open(context.Background(), path)
		if err != nil {
			t.Fatal(err)
		}
		task := testGraphTask(t)
		if err := store.CommitTask(context.Background(), testMutation(t, task)); err != nil {
			t.Fatal(err)
		}
		store.Close()
		db := openRaw(t, path)
		if _, err := db.Exec(`UPDATE tasks SET current_node='DESIGN'`); err != nil {
			t.Fatal(err)
		}
		db.Close()
		before := fileDigest(t, path)
		_, err = Open(context.Background(), path)
		if !errors.Is(err, ErrStorageUnavailable) {
			t.Fatalf("error=%v", err)
		}
		if before != fileDigest(t, path) {
			t.Fatal("mismatched row changed")
		}
	})
	t.Run("future snapshot", func(t *testing.T) {
		path := dbPath(t)
		store, err := Open(context.Background(), path)
		if err != nil {
			t.Fatal(err)
		}
		task := testGraphTask(t)
		if err := store.CommitTask(context.Background(), testMutation(t, task)); err != nil {
			t.Fatal(err)
		}
		store.Close()
		db := openRaw(t, path)
		if _, err := db.Exec(`PRAGMA ignore_check_constraints=ON;UPDATE tasks SET snapshot_version=3`); err != nil {
			t.Fatal(err)
		}
		db.Close()
		before := fileDigest(t, path)
		_, err = Open(context.Background(), path)
		if !errors.Is(err, ErrSchemaUnsupported) {
			t.Fatalf("error=%v", err)
		}
		if before != fileDigest(t, path) {
			t.Fatal("future snapshot changed")
		}
	})
}
