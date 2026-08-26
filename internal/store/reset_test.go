package store

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestResetPlanBindsTargetsAndCreatesCurrentEmptyStore(t *testing.T) {
	directory := t.TempDir()
	databasePath := filepath.Join(directory, "dev-flow.db")
	taskStore, err := Open(context.Background(), databasePath)
	if err != nil {
		t.Fatal(err)
	}
	if err := taskStore.Close(); err != nil {
		t.Fatal(err)
	}
	unrelated := filepath.Join(directory, "keep.txt")
	if err := os.WriteFile(unrelated, []byte("keep"), 0o600); err != nil {
		t.Fatal(err)
	}
	plan, err := PlanReset(databasePath)
	if err != nil || len(plan.Targets) == 0 || len(plan.Token) != 64 {
		t.Fatalf("reset plan = %#v, err = %v", plan, err)
	}
	if err := ConfirmReset(context.Background(), databasePath, plan.Token); err != nil {
		t.Fatal(err)
	}
	if content, err := os.ReadFile(unrelated); err != nil || string(content) != "keep" {
		t.Fatalf("unrelated file = %q, err = %v", content, err)
	}
	reopened, err := Open(context.Background(), databasePath)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	items, err := reopened.ListControlCenterTasks(context.Background(), TaskListQuery{Page: 1, PageSize: 20})
	if err != nil || len(items.Items) != 0 {
		t.Fatalf("reset tasks = %#v, err = %v", items, err)
	}
}

func TestResetRejectsChangedTokenWithZeroDeletes(t *testing.T) {
	directory := t.TempDir()
	databasePath := filepath.Join(directory, "dev-flow.db")
	if err := os.WriteFile(databasePath, []byte("legacy"), 0o600); err != nil {
		t.Fatal(err)
	}
	plan, err := PlanReset(databasePath)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(databasePath, []byte("changed legacy"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := ConfirmReset(context.Background(), databasePath, plan.Token); !errors.Is(err, ErrRevisionConflict) {
		t.Fatalf("changed-target reset error = %v", err)
	}
	if content, err := os.ReadFile(databasePath); err != nil || string(content) != "changed legacy" {
		t.Fatalf("changed target was deleted: %q, %v", content, err)
	}
}

func TestResetRequiresExclusiveDatabaseAccessWithZeroDeletes(t *testing.T) {
	directory := t.TempDir()
	databasePath := filepath.Join(directory, "dev-flow.db")
	taskStore, err := Open(context.Background(), databasePath)
	if err != nil {
		t.Fatal(err)
	}
	if err := taskStore.Close(); err != nil {
		t.Fatal(err)
	}
	plan, err := PlanReset(databasePath)
	if err != nil {
		t.Fatal(err)
	}
	locker, err := sql.Open("sqlite", dataSource(databasePath, false))
	if err != nil {
		t.Fatal(err)
	}
	defer locker.Close()
	connection, err := locker.Conn(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	if _, err := connection.ExecContext(context.Background(), "BEGIN EXCLUSIVE"); err != nil {
		t.Fatal(err)
	}
	defer connection.ExecContext(context.Background(), "ROLLBACK")
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	if err := ConfirmReset(ctx, databasePath, plan.Token); !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("exclusive reset error = %v", err)
	}
	if _, err := os.Stat(databasePath); err != nil {
		t.Fatalf("database deleted without exclusive access: %v", err)
	}
}
