package store

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestOpenReadOnlySeesLiveWALAndRefusesWrites(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "taskbelay.db")
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

func TestReadOnlyPreflightRejectsLiveWALWithoutPersistentWrites(t *testing.T) {
	for _, change := range []struct {
		name      string
		statement string
		want      error
	}{
		{"snapshot", `UPDATE tasks SET snapshot=X'7B7D'`, ErrStorageUnavailable},
		{"schema", `CREATE TABLE unsupported_schema(marker TEXT)`, ErrSchemaUnsupported},
	} {
		t.Run(change.name, func(t *testing.T) {
			ctx := context.Background()
			path := dbPath(t)
			writer, err := Open(ctx, path)
			if err != nil {
				t.Fatal(err)
			}
			defer writer.Close()
			if _, err := writer.db.ExecContext(ctx, "PRAGMA journal_mode=WAL"); err != nil {
				t.Fatal(err)
			}
			if err := writer.CommitTask(ctx, testMutation(t, testGraphTask(t))); err != nil {
				t.Fatal(err)
			}
			if _, err := writer.db.ExecContext(ctx, change.statement); err != nil {
				t.Fatal(err)
			}
			files := func() map[string]manifestFile {
				result := map[string]manifestFile{}
				for _, suffix := range []string{"", "-wal", "-shm", "-journal"} {
					info, err := os.Stat(path + suffix)
					if errors.Is(err, os.ErrNotExist) {
						continue
					} else if err != nil {
						t.Fatal(err)
					}
					result[suffix] = manifestFile{Name: suffix, Size: info.Size(), SHA256: fileDigest(t, path+suffix)}
				}
				return result
			}
			before := files()
			if err := preflightExisting(ctx, path); !errors.Is(err, change.want) {
				t.Fatalf("live WAL error=%v want=%v", err, change.want)
			}
			after := files()
			if initial, exists := before["-shm"]; exists {
				if current, stillExists := after["-shm"]; stillExists {
					t.Logf("SQLite WAL read-lock bookkeeping changed: %v", initial.SHA256 != current.SHA256)
					initial.SHA256, current.SHA256 = "", ""
					before["-shm"], after["-shm"] = initial, current
				}
			}
			if !reflect.DeepEqual(before, after) {
				t.Fatalf("read-only rejection changed persistent data or sidecar layout: before=%v after=%v", before, after)
			}
		})
	}
}
