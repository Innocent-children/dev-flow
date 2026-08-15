package store

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestSchemaCompatibilitySafeStop(t *testing.T) {
	t.Run("unsupported newer schema", func(t *testing.T) {
		ctx := context.Background()
		root := t.TempDir()
		path := filepath.Join(root, "private-future.db")
		taskStore, task := createSchemaCompatibilityTask(t, ctx, path, root, "future")
		before := readPersistedRowState(t, ctx, taskStore, task)

		const futureAppliedAt = "2030-01-02T03:04:05Z"
		const futureDigest = "future-schema-digest"
		if _, err := taskStore.db.ExecContext(
			ctx,
			`INSERT INTO schema_migrations (version, applied_at, digest) VALUES (?, ?, ?)`,
			SchemaVersion+1,
			futureAppliedAt,
			futureDigest,
		); err != nil {
			t.Fatalf("install future migration marker: %v", err)
		}
		if err := taskStore.Close(); err != nil {
			t.Fatalf("close future-schema store: %v", err)
		}

		_, openErr := Open(ctx, path)
		requireSafeStoreError(t, openErr, ErrSchemaUnsupported, path, task.Contract.Goal(), futureDigest)

		raw := openRawDatabase(t, path)
		defer raw.Close()
		var count int
		var appliedAt, gotDigest string
		if err := raw.QueryRowContext(
			ctx,
			`SELECT COUNT(*), MAX(applied_at), MAX(digest)
			   FROM schema_migrations
			  WHERE version = ?`,
			SchemaVersion+1,
		).Scan(&count, &appliedAt, &gotDigest); err != nil {
			t.Fatalf("read future migration after refusal: %v", err)
		}
		if count != 1 || appliedAt != futureAppliedAt || gotDigest != futureDigest {
			t.Fatal("future migration marker changed during compatibility refusal")
		}
		after := readPersistedRowStateFromDatabase(t, ctx, raw, task)
		requirePersistedRowStateEqual(t, after, before)
	})

	t.Run("migration digest mismatch", func(t *testing.T) {
		ctx := context.Background()
		root := t.TempDir()
		path := filepath.Join(root, "private-digest.db")
		taskStore, task := createSchemaCompatibilityTask(t, ctx, path, root, "digest")
		before := readPersistedRowState(t, ctx, taskStore, task)

		const changedDigest = "changed-digest"
		if _, err := taskStore.db.ExecContext(
			ctx,
			`UPDATE schema_migrations SET digest = ? WHERE version = ?`,
			changedDigest,
			SchemaVersion,
		); err != nil {
			t.Fatalf("change migration digest: %v", err)
		}
		if err := taskStore.Close(); err != nil {
			t.Fatalf("close digest-mismatch store: %v", err)
		}

		_, openErr := Open(ctx, path)
		requireSafeStoreError(t, openErr, ErrSchemaUnsupported, path, task.Contract.Goal(), changedDigest)

		raw := openRawDatabase(t, path)
		defer raw.Close()
		var migrationCount int
		var gotDigest string
		if err := raw.QueryRowContext(
			ctx,
			`SELECT COUNT(*), MIN(digest) FROM schema_migrations`,
		).Scan(&migrationCount, &gotDigest); err != nil {
			t.Fatalf("read migrations after digest refusal: %v", err)
		}
		if migrationCount != SchemaVersion || gotDigest != changedDigest {
			t.Fatal("digest refusal rewrote migration history or created another schema")
		}
		after := readPersistedRowStateFromDatabase(t, ctx, raw, task)
		requirePersistedRowStateEqual(t, after, before)
	})

	t.Run("malformed persisted task row", func(t *testing.T) {
		ctx := context.Background()
		root := t.TempDir()
		path := filepath.Join(root, "private-malformed.db")
		taskStore, task := createSchemaCompatibilityTask(t, ctx, path, root, "malformed")

		const environmentMarker = "private-environment-marker"
		const sourceMarker = "package private_source; func secret()"
		t.Setenv("DEV_FLOW_TEST_PRIVATE_VALUE", environmentMarker)
		malformedSnapshot := []byte(`{"task_content":"private-task-marker","source":"` + sourceMarker + `"`)
		if _, err := taskStore.db.ExecContext(
			ctx,
			`UPDATE tasks SET snapshot = ? WHERE task_id = ?`,
			malformedSnapshot,
			string(task.TaskID),
		); err != nil {
			t.Fatalf("corrupt persisted snapshot: %v", err)
		}
		before := readPersistedRowState(t, ctx, taskStore, task)
		if !bytes.Equal(before.snapshot, malformedSnapshot) {
			t.Fatal("malformed snapshot setup was not persisted")
		}
		if err := taskStore.Close(); err != nil {
			t.Fatalf("close malformed-row store: %v", err)
		}

		reopened, err := Open(ctx, path)
		if err != nil {
			t.Fatalf("schema-compatible database did not reopen: %v", err)
		}
		defer reopened.Close()
		got, loadErr := reopened.LoadTask(ctx, task.TaskID)
		requireSafeStoreError(
			t,
			loadErr,
			ErrStorageUnavailable,
			path,
			root,
			task.Repository.CanonicalRoot,
			task.Contract.Goal(),
			string(malformedSnapshot),
			environmentMarker,
			sourceMarker,
		)
		if !reflect.DeepEqual(got, domain.Task{}) {
			t.Fatal("malformed row returned a partially decoded or substitute task")
		}
		after := readPersistedRowState(t, ctx, reopened, task)
		requirePersistedRowStateEqual(t, after, before)
	})
}

type persistedRowState struct {
	taskID, originHost, phase, repositoryIdentity string
	revision                                      int64
	snapshot                                      []byte
	createdAt, updatedAt                          string
	eventCount, claimCount                        int
	claimedTaskID, claimedHost                    string
}

func createSchemaCompatibilityTask(
	t *testing.T,
	ctx context.Context,
	path string,
	root string,
	suffix string,
) (*SQLite, domain.Task) {
	t.Helper()
	taskStore, err := Open(ctx, path)
	if err != nil {
		t.Fatalf("open schema compatibility store: %v", err)
	}
	at := time.Date(2026, time.August, 15, 9, 30, 0, 0, time.UTC)
	task := validTask(t, "task-schema-"+suffix, digest("6"), filepath.Join(root, "repository"), at)
	event := taskEvent("event-schema-"+suffix, &task, domain.PhaseIntake, at)
	if err := taskStore.CommitTask(ctx, TaskMutation{Task: task, Event: event, Claim: ClaimAcquire}); err != nil {
		_ = taskStore.Close()
		t.Fatalf("persist schema compatibility task: %v", err)
	}
	return taskStore, task
}

func readPersistedRowState(
	t *testing.T,
	ctx context.Context,
	taskStore *SQLite,
	task domain.Task,
) persistedRowState {
	t.Helper()
	return readPersistedRowStateFromDatabase(t, ctx, taskStore.db, task)
}

func readPersistedRowStateFromDatabase(
	t *testing.T,
	ctx context.Context,
	db *sql.DB,
	task domain.Task,
) persistedRowState {
	t.Helper()
	var state persistedRowState
	if err := db.QueryRowContext(
		ctx,
		`SELECT task_id, origin_host, phase, revision, repository_identity,
		        snapshot, created_at, updated_at
		   FROM tasks
		  WHERE task_id = ?`,
		string(task.TaskID),
	).Scan(
		&state.taskID,
		&state.originHost,
		&state.phase,
		&state.revision,
		&state.repositoryIdentity,
		&state.snapshot,
		&state.createdAt,
		&state.updatedAt,
	); err != nil {
		t.Fatalf("read persisted task row: %v", err)
	}
	if err := db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM task_events WHERE task_id = ?`,
		string(task.TaskID),
	).Scan(&state.eventCount); err != nil {
		t.Fatalf("read persisted event count: %v", err)
	}
	if err := db.QueryRowContext(
		ctx,
		`SELECT COUNT(*), COALESCE(MIN(task_id), ''), COALESCE(MIN(origin_host), '')
		   FROM repository_claims
		  WHERE repository_identity = ?`,
		string(task.Repository.RepositoryIdentity),
	).Scan(&state.claimCount, &state.claimedTaskID, &state.claimedHost); err != nil {
		t.Fatalf("read persisted repository claim: %v", err)
	}
	return state
}

func requirePersistedRowStateEqual(t *testing.T, got, want persistedRowState) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Fatal("compatibility refusal or malformed-row read changed persisted task, event, or claim data")
	}
}

func requireSafeStoreError(t *testing.T, got, want error, sensitive ...string) {
	t.Helper()
	if !errors.Is(got, want) || got == nil || got.Error() != want.Error() {
		t.Fatalf("store error = %v, want stable %v", got, want)
	}
	for _, value := range sensitive {
		if value != "" && strings.Contains(got.Error(), value) {
			t.Fatal("stable store error exposed sensitive input")
		}
	}
}
