package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
	_ "modernc.org/sqlite"
)

func testGraphTask(t *testing.T) domain.ProcessTask {
	t.Helper()
	now := time.Date(2026, 8, 19, 2, 0, 0, 0, time.UTC)
	digest := domain.Digest(strings.Repeat("a", 64))
	branch := "main"
	head := strings.Repeat("b", 40)
	process := workflow.StandardProcess()
	action, err := workflow.BuildProcessAction(process, domain.NodeRequirements, "task", 1, digest, domain.MethodPlain, "action", now)
	if err != nil {
		t.Fatal(err)
	}
	return domain.ProcessTask{TaskID: "task", OriginHost: domain.HostCodex, Intent: domain.TaskIntent{Request: "Build graph storage.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 2}, MethodProfile: domain.MethodPlain}, Process: process.Reference, CurrentNode: domain.NodeRequirements, CurrentAction: &action, Repository: domain.RepositoryBinding{CanonicalRoot: "/repo", GitCommonDirDigest: digest, RepositoryIdentity: digest, Branch: &branch, Head: &head, WorktreeFingerprint: digest, ObservedAt: now, BindingDigest: digest}, Revision: 1, CreatedAt: now, UpdatedAt: now}
}
func testMutation(t *testing.T, task domain.ProcessTask) TaskMutation {
	t.Helper()
	payload := domain.Digest(strings.Repeat("c", 64))
	task.LastOperation = &domain.LastOperation{OperationID: "request", Kind: domain.OperationOpenTask, FromRevision: 0, ToRevision: 1, PayloadDigest: payload, CommittedAt: task.CreatedAt}
	return TaskMutation{Task: task, Event: TaskEvent{EventID: "event", TaskID: task.TaskID, Revision: task.Revision, Kind: domain.OperationOpenTask, SourceNode: domain.NodeRequirements, DestinationNode: domain.NodeRequirements, RequestID: "request", PayloadDigest: payload, CreatedAt: task.CreatedAt}, Claim: ClaimAcquire}
}
func openRaw(t *testing.T, path string) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", dataSource(path, false))
	if err != nil {
		t.Fatal(err)
	}
	return db
}
func fileDigest(t *testing.T, path string) string {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}

type manifestFile struct {
	Name   string
	Size   int64
	SHA256 string
}

type manifestTable struct {
	Name    string
	Columns []string
	Rows    [][]string
}

type databaseStateManifest struct {
	Files  []manifestFile
	Schema []string
	Tables []manifestTable
}

func databaseManifest(t *testing.T, path string) databaseStateManifest {
	t.Helper()
	manifest := databaseStateManifest{}
	directory := filepath.Dir(path)
	entries, err := os.ReadDir(directory)
	if err != nil {
		t.Fatal(err)
	}
	base := filepath.Base(path)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasPrefix(entry.Name(), base) {
			continue
		}
		absolute := filepath.Join(directory, entry.Name())
		info, err := entry.Info()
		if err != nil {
			t.Fatal(err)
		}
		manifest.Files = append(manifest.Files, manifestFile{Name: entry.Name(), Size: info.Size(), SHA256: fileDigest(t, absolute)})
	}
	sort.Slice(manifest.Files, func(i, j int) bool { return manifest.Files[i].Name < manifest.Files[j].Name })

	db, err := sql.Open("sqlite", dataSource(path, true))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	objects, err := db.Query(`SELECT type,name,COALESCE(sql,'') FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY type,name`)
	if err != nil {
		t.Fatal(err)
	}
	for objects.Next() {
		var kind, name, statement string
		if err := objects.Scan(&kind, &name, &statement); err != nil {
			t.Fatal(err)
		}
		manifest.Schema = append(manifest.Schema, kind+"\x00"+name+"\x00"+statement)
	}
	if err := objects.Close(); err != nil {
		t.Fatal(err)
	}
	for _, table := range []string{"schema_metadata", "schema_migrations", "tasks", "action_operations", "task_events", "repository_claims"} {
		var exists int
		if err := db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?`, table).Scan(&exists); err != nil {
			t.Fatal(err)
		}
		if exists != 1 {
			continue
		}
		rows, err := db.Query(`SELECT * FROM "` + table + `" ORDER BY rowid`)
		if err != nil {
			t.Fatal(err)
		}
		columns, err := rows.Columns()
		if err != nil {
			t.Fatal(err)
		}
		entry := manifestTable{Name: table, Columns: columns}
		for rows.Next() {
			values := make([]any, len(columns))
			targets := make([]any, len(columns))
			for i := range values {
				targets[i] = &values[i]
			}
			if err := rows.Scan(targets...); err != nil {
				t.Fatal(err)
			}
			encoded := make([]string, len(values))
			for i, value := range values {
				switch typed := value.(type) {
				case nil:
					encoded[i] = "null"
				case []byte:
					encoded[i] = "blob:" + hex.EncodeToString(typed)
				default:
					encoded[i] = fmt.Sprintf("%T:%v", value, value)
				}
			}
			entry.Rows = append(entry.Rows, encoded)
		}
		if err := rows.Close(); err != nil {
			t.Fatal(err)
		}
		manifest.Tables = append(manifest.Tables, entry)
	}
	return manifest
}

func assertDatabaseManifestUnchanged(t *testing.T, path string, before databaseStateManifest) {
	t.Helper()
	after := databaseManifest(t, path)
	if !reflect.DeepEqual(after, before) {
		t.Fatalf("database manifest changed\nbefore=%#v\nafter=%#v", before, after)
	}
}
func dbPath(t *testing.T) string { return filepath.Join(t.TempDir(), "tasks.db") }

var _ = context.Background
