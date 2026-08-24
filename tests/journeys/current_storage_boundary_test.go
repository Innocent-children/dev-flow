package journeys

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

type databaseManifest struct {
	FileDigest string
	FileSize   int64
	Sidecars   []string
	Schema     []string
	Counts     map[string]int
	Rows       map[string][]string
}

func TestCurrentStorageBoundaryJourney(t *testing.T) {
	t.Run("fresh_current_format", func(t *testing.T) {
		root := t.TempDir()
		repoPath := filepath.Join(root, "repository")
		initializeJourneyRepository(t, repoPath)
		dbPath := filepath.Join(root, "data", "dev-flow.db")
		if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
			t.Fatal(err)
		}
		sqliteStore, err := store.Open(context.Background(), dbPath)
		if err != nil {
			t.Fatal(err)
		}
		assertFreshCurrentSchema(t, dbPath)
		service, err := application.NewService(sqliteStore, repository.NewGitObserver())
		if err != nil {
			t.Fatal(err)
		}
		opened, err := service.OpenTask(context.Background(), application.OpenTaskRequest{RequestID: "fresh-storage-open", Host: domain.HostCodex, RepositoryPath: repoPath, NewTask: &application.NewTaskInput{Request: "Prove the current storage format.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 4}, MethodProfile: domain.MethodPlain}})
		if err != nil {
			t.Fatal(err)
		}
		task := opened.Task
		applied, err := service.ApplyAction(context.Background(), journeyApplyRequest(task, "fresh-requirements", journeyPayload(t, task, "requirements_ready", "", requirementsJourneyResult("Fresh schema goal"))))
		if err != nil {
			t.Fatal(err)
		}
		task = applied.Task
		if task.CurrentNode != domain.NodeDesign || task.Revision != 2 {
			t.Fatal("fresh task did not advance to DESIGN")
		}
		var processID, definitionDigest string
		readOnly := openImmutableDatabase(t, dbPath)
		if err := readOnly.QueryRow(`SELECT process_id,process_definition_digest FROM tasks WHERE task_id=?`, task.TaskID).Scan(&processID, &definitionDigest); err != nil {
			t.Fatal(err)
		}
		readOnly.Close()
		if processID != "standard-development" || definitionDigest != string(task.Process.DefinitionDigest) {
			t.Fatal("fresh task metadata mismatch")
		}
		events := databaseCount(t, dbPath, `SELECT COUNT(*) FROM task_events WHERE task_id=?`, task.TaskID)
		claims := databaseCount(t, dbPath, `SELECT COUNT(*) FROM repository_claims WHERE task_id=?`, task.TaskID)
		if err := sqliteStore.Close(); err != nil {
			t.Fatal(err)
		}
		reopened, err := store.Open(context.Background(), dbPath)
		if err != nil {
			t.Fatal(err)
		}
		defer reopened.Close()
		loaded, err := reopened.LoadTask(context.Background(), task.TaskID)
		if err != nil || !reflect.DeepEqual(loaded, task) || databaseCount(t, dbPath, `SELECT COUNT(*) FROM task_events WHERE task_id=?`, task.TaskID) != events || databaseCount(t, dbPath, `SELECT COUNT(*) FROM repository_claims WHERE task_id=?`, task.TaskID) != claims {
			t.Fatalf("reopen err=%v loaded=%+v", err, loaded)
		}
	})

	t.Run("former_data_zero_write_and_explicit_new_directory", func(t *testing.T) {
		root := t.TempDir()
		repoPath := filepath.Join(root, "repository")
		initializeJourneyRepository(t, repoPath)
		legacyPath := filepath.Join(root, "legacy", "dev-flow.db")
		if err := os.MkdirAll(filepath.Dir(legacyPath), 0o755); err != nil {
			t.Fatal(err)
		}
		createRepresentativeFormerSchema(t, legacyPath)
		before := captureDatabaseManifest(t, legacyPath)
		opened, err := store.Open(context.Background(), legacyPath)
		if opened != nil {
			_ = opened.Close()
		}
		if !errors.Is(err, store.ErrSchemaUnsupported) {
			t.Fatalf("open err=%v", err)
		}
		after := captureDatabaseManifest(t, legacyPath)
		if !reflect.DeepEqual(after, before) {
			t.Fatalf("legacy database changed\nbefore=%+v\nafter=%+v", before, after)
		}
		if _, err := os.Stat(legacyPath); err != nil {
			t.Fatalf("legacy database was moved or deleted: %v", err)
		}

		freshPath := filepath.Join(root, "fresh", "dev-flow.db")
		if err := os.MkdirAll(filepath.Dir(freshPath), 0o755); err != nil {
			t.Fatal(err)
		}
		freshStore, err := store.Open(context.Background(), freshPath)
		if err != nil {
			t.Fatal(err)
		}
		service, err := application.NewService(freshStore, repository.NewGitObserver())
		if err != nil {
			t.Fatal(err)
		}
		created, err := service.OpenTask(context.Background(), application.OpenTaskRequest{RequestID: "explicit-fresh-open", Host: domain.HostCodex, RepositoryPath: repoPath, NewTask: &application.NewTaskInput{Request: "Create only a new graph task.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 2}, MethodProfile: domain.MethodPlain}})
		if err != nil {
			t.Fatal(err)
		}
		if !created.Created || created.Task.Process.ID != domain.ProcessStandardDevelopment || created.Task.CurrentNode != domain.NodeRequirements || created.Task.Revision != 1 {
			t.Fatalf("created=%+v", created)
		}
		if databaseCount(t, freshPath, `SELECT COUNT(*) FROM tasks`) != 1 || databaseCount(t, freshPath, `SELECT COUNT(*) FROM tasks WHERE task_id IN ('legacy-active','legacy-terminal')`) != 0 {
			t.Fatal("fresh directory imported legacy tasks")
		}
		if err := freshStore.Close(); err != nil {
			t.Fatal(err)
		}
		if finalLegacy := captureDatabaseManifest(t, legacyPath); !reflect.DeepEqual(finalLegacy, before) {
			t.Fatal("explicit fresh-directory switch changed legacy data")
		}
	})
}

func initializeJourneyRepository(t *testing.T, repoPath string) {
	t.Helper()
	if err := os.MkdirAll(repoPath, 0o755); err != nil {
		t.Fatal(err)
	}
	runJourneyGit(t, repoPath, "init", "-q")
	runJourneyGit(t, repoPath, "config", "user.email", "storage@example.invalid")
	runJourneyGit(t, repoPath, "config", "user.name", "Storage Journey")
	if err := os.WriteFile(filepath.Join(repoPath, "README.md"), []byte("initial\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runJourneyGit(t, repoPath, "add", "README.md")
	runJourneyGit(t, repoPath, "commit", "-q", "-m", "initial")
}

func assertFreshCurrentSchema(t *testing.T, dbPath string) {
	t.Helper()
	db := openImmutableDatabase(t, dbPath)
	defer db.Close()
	want := []string{"index:repository_claims_task_idx", "index:tasks_node_idx", "index:tasks_origin_host_idx", "index:tasks_updated_at_idx", "table:repository_claims", "table:schema_metadata", "table:task_events", "table:tasks"}
	rows, err := db.Query(`SELECT type||':'||name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name`)
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for rows.Next() {
		var value string
		if rows.Scan(&value) != nil {
			t.Fatal("schema scan")
		}
		got = append(got, value)
	}
	rows.Close()
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("schema=%v", got)
	}
	for table, columns := range map[string][]string{"schema_metadata": {"version"}, "tasks": {"task_id", "origin_host", "process_id", "process_definition_digest", "current_node", "revision", "repository_identity", "snapshot", "created_at", "updated_at"}, "task_events": {"event_id", "task_id", "revision", "event_type", "source_node", "destination_node", "transition_id", "transition_reason", "action_id", "request_id", "payload_digest", "created_at"}, "repository_claims": {"repository_identity", "task_id", "origin_host", "claimed_at"}} {
		columnRows, err := db.Query(`SELECT name FROM pragma_table_info(?) ORDER BY cid`, table)
		if err != nil {
			t.Fatal(err)
		}
		var actual []string
		for columnRows.Next() {
			var value string
			if columnRows.Scan(&value) != nil {
				t.Fatal("column scan")
			}
			actual = append(actual, value)
		}
		columnRows.Close()
		if !reflect.DeepEqual(actual, columns) {
			t.Fatalf("%s columns=%v", table, actual)
		}
	}
	var schemaVersion string
	if err := db.QueryRow(`SELECT version FROM schema_metadata`).Scan(&schemaVersion); err != nil || schemaVersion != store.DatabaseSchemaVersion {
		t.Fatalf("schema version=%q err=%v", schemaVersion, err)
	}
	var alterCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE UPPER(COALESCE(sql,'')) LIKE '%ALTER TABLE%'`).Scan(&alterCount); err != nil || alterCount != 0 {
		t.Fatalf("ALTER TABLE count=%d err=%v", alterCount, err)
	}
}

func createRepresentativeFormerSchema(t *testing.T, path string) {
	t.Helper()
	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	statements := []string{
		`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL, digest TEXT NOT NULL)`,
		`CREATE TABLE tasks (task_id TEXT PRIMARY KEY, origin_host TEXT NOT NULL, phase TEXT NOT NULL, revision INTEGER NOT NULL CHECK (revision >= 1), repository_identity TEXT NOT NULL, snapshot BLOB NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
		`CREATE INDEX tasks_phase_idx ON tasks (phase)`,
		`CREATE INDEX tasks_origin_host_idx ON tasks (origin_host)`,
		`CREATE INDEX tasks_updated_at_idx ON tasks (updated_at)`,
		`CREATE TABLE task_events (event_id TEXT PRIMARY KEY, task_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK (revision >= 1), event_type TEXT NOT NULL, phase_before TEXT NOT NULL, phase_after TEXT NOT NULL, action_id TEXT, request_id TEXT NOT NULL, payload_digest TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE (task_id, revision), FOREIGN KEY (task_id) REFERENCES tasks (task_id) ON DELETE RESTRICT)`,
		`CREATE TABLE repository_claims (repository_identity TEXT PRIMARY KEY, task_id TEXT NOT NULL UNIQUE, origin_host TEXT NOT NULL, claimed_at TEXT NOT NULL, FOREIGN KEY (task_id) REFERENCES tasks (task_id) ON DELETE RESTRICT)`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	now := time.Date(2026, 8, 19, 12, 0, 0, 0, time.UTC).Format(time.RFC3339Nano)
	if _, err := db.Exec(`INSERT INTO schema_migrations(version,applied_at,digest) VALUES(1,?,?)`, now, strings.Repeat("1", 64)); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO tasks(task_id,origin_host,phase,revision,repository_identity,snapshot,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?)`, "legacy-active", "codex", "IMPLEMENT", 3, strings.Repeat("a", 64), []byte(`{"legacy_marker":"must-not-decode-active"}`), now, now, "legacy-terminal", "codex", "DONE", 8, strings.Repeat("b", 64), []byte(`{"legacy_marker":"must-not-decode-terminal"}`), now, now); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO task_events(event_id,task_id,revision,event_type,phase_before,phase_after,action_id,request_id,payload_digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?,?,?)`, "legacy-event-active", "legacy-active", 3, "apply_action", "PLAN", "IMPLEMENT", "legacy-action", "legacy-request-active", strings.Repeat("c", 64), now, "legacy-event-terminal", "legacy-terminal", 8, "apply_action", "HANDOFF", "DONE", "legacy-terminal-action", "legacy-request-terminal", strings.Repeat("d", 64), now); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO repository_claims(repository_identity,task_id,origin_host,claimed_at) VALUES(?,?,?,?)`, strings.Repeat("a", 64), "legacy-active", "codex", now); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
}

func captureDatabaseManifest(t *testing.T, path string) databaseManifest {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	manifest := databaseManifest{FileDigest: digestFile(t, path), FileSize: info.Size(), Counts: map[string]int{}, Rows: map[string][]string{}}
	matches, err := filepath.Glob(path + "*")
	if err != nil {
		t.Fatal(err)
	}
	for _, match := range matches {
		entry, err := os.Stat(match)
		if err != nil {
			t.Fatal(err)
		}
		manifest.Sidecars = append(manifest.Sidecars, fmt.Sprintf("%s:%d:%s", filepath.Base(match), entry.Size(), digestFile(t, match)))
	}
	sort.Strings(manifest.Sidecars)
	db := openImmutableDatabase(t, path)
	defer db.Close()
	schemaRows, err := db.Query(`SELECT type||':'||name||':'||COALESCE(sql,'') FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name`)
	if err != nil {
		t.Fatal(err)
	}
	for schemaRows.Next() {
		var value string
		if schemaRows.Scan(&value) != nil {
			t.Fatal("schema scan")
		}
		manifest.Schema = append(manifest.Schema, value)
	}
	schemaRows.Close()
	for _, table := range []string{"schema_migrations", "tasks", "task_events", "repository_claims"} {
		manifest.Counts[table] = queryManifestCount(t, db, `SELECT COUNT(*) FROM `+table)
	}
	manifest.Rows["schema_migrations"] = queryManifestRows(t, db, `SELECT printf('%d|%s|%s',version,applied_at,digest) FROM schema_migrations ORDER BY version`)
	manifest.Rows["tasks"] = queryManifestRows(t, db, `SELECT task_id||'|'||origin_host||'|'||phase||'|'||revision||'|'||repository_identity||'|'||hex(snapshot) FROM tasks ORDER BY task_id`)
	manifest.Rows["task_events"] = queryManifestRows(t, db, `SELECT event_id||'|'||task_id||'|'||revision||'|'||event_type||'|'||phase_before||'|'||phase_after||'|'||COALESCE(action_id,'')||'|'||request_id||'|'||payload_digest FROM task_events ORDER BY event_id`)
	manifest.Rows["repository_claims"] = queryManifestRows(t, db, `SELECT repository_identity||'|'||task_id||'|'||origin_host||'|'||claimed_at FROM repository_claims ORDER BY repository_identity`)
	return manifest
}

func openImmutableDatabase(t *testing.T, path string) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file:"+filepath.Clean(path)+"?mode=ro&immutable=1")
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Ping(); err != nil {
		t.Fatal(err)
	}
	return db
}

func digestFile(t *testing.T, path string) string {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(raw)
	return hex.EncodeToString(digest[:])
}

func queryManifestCount(t *testing.T, db *sql.DB, query string) int {
	t.Helper()
	var count int
	if err := db.QueryRow(query).Scan(&count); err != nil {
		t.Fatal(err)
	}
	return count
}

func queryManifestRows(t *testing.T, db *sql.DB, query string) []string {
	t.Helper()
	rows, err := db.Query(query)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var values []string
	for rows.Next() {
		var value string
		if rows.Scan(&value) != nil {
			t.Fatal("manifest row scan")
		}
		values = append(values, value)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return values
}
