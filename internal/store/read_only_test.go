package store

import (
	"context"
	"path/filepath"
	"testing"
)

func TestOpenReadOnlySeesLiveWALAndRefusesWrites(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "dev-flow.db")
	writer, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer writer.Close()
	if _, err := writer.db.ExecContext(ctx, "PRAGMA journal_mode=WAL"); err != nil {
		t.Fatal(err)
	}
	// Put schema data in the WAL without changing the supported schema.
	if _, err := writer.db.ExecContext(ctx, "UPDATE schema_metadata SET version=version"); err != nil {
		t.Fatal(err)
	}
	reader, err := OpenReadOnly(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	var version string
	if err := reader.db.QueryRowContext(ctx, "SELECT version FROM schema_metadata").Scan(&version); err != nil || version != DatabaseSchemaVersion {
		t.Fatalf("version=%s err=%v", version, err)
	}
	if _, err := reader.db.ExecContext(ctx, "UPDATE schema_metadata SET version=version"); err == nil {
		t.Fatal("read-only connection accepted a write")
	}
}
