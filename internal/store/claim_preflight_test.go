package store

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestClaimPreflightAcceptsActiveAndTerminalCardinality(t *testing.T) {
	for _, terminal := range []bool{false, true} {
		t.Run(map[bool]string{false: "active", true: "terminal"}[terminal], func(t *testing.T) {
			path, _ := claimPreflightDatabase(t, terminal)
			opened, err := Open(context.Background(), path)
			if err != nil {
				t.Fatal(err)
			}
			opened.Close()
		})
	}
}

func TestClaimPreflightRejectsCorruptionWithZeroWriteManifest(t *testing.T) {
	tests := []struct {
		name     string
		terminal bool
		corrupt  func(*testing.T, string, domain.ProcessTask)
	}{
		{"active missing claim", false, func(t *testing.T, path string, _ domain.ProcessTask) {
			execClaimCorruption(t, path, `DELETE FROM repository_claims`)
		}},
		{"active repository mismatch", false, func(t *testing.T, path string, _ domain.ProcessTask) {
			execClaimCorruption(t, path, `UPDATE repository_claims SET repository_identity='ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'`)
		}},
		{"active host mismatch", false, func(t *testing.T, path string, _ domain.ProcessTask) {
			execClaimCorruption(t, path, `UPDATE repository_claims SET origin_host='deepseek'`)
		}},
		{"orphan claim", false, func(t *testing.T, path string, _ domain.ProcessTask) {
			execClaimCorruption(t, path, `PRAGMA foreign_keys=OFF; DELETE FROM tasks`)
		}},
		{"multiple claims", false, func(t *testing.T, path string, task domain.ProcessTask) {
			db := openRaw(t, path)
			defer db.Close()
			_, err := db.Exec(`PRAGMA foreign_keys=OFF; DROP TABLE repository_claims; CREATE TABLE repository_claims (repository_identity TEXT PRIMARY KEY, task_id TEXT NOT NULL, origin_host TEXT NOT NULL, claimed_at TEXT NOT NULL); INSERT INTO repository_claims VALUES(?,?,?,?),(?,?,?,?)`, task.Repository.RepositoryIdentity, task.TaskID, task.OriginHost, formatTime(task.CreatedAt), domain.Digest(strings.Repeat("f", 64)), task.TaskID, task.OriginHost, formatTime(task.CreatedAt))
			if err != nil {
				t.Fatal(err)
			}
		}},
		{"terminal retains claim", true, func(t *testing.T, path string, task domain.ProcessTask) {
			db := openRaw(t, path)
			defer db.Close()
			_, err := db.Exec(`INSERT INTO repository_claims(repository_identity,task_id,origin_host,claimed_at) VALUES(?,?,?,?)`, task.Repository.RepositoryIdentity, task.TaskID, task.OriginHost, formatTime(task.UpdatedAt))
			if err != nil {
				t.Fatal(err)
			}
		}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			path, task := claimPreflightDatabase(t, tc.terminal)
			tc.corrupt(t, path, task)
			before := fileDigest(t, path)
			opened, err := Open(context.Background(), path)
			if opened != nil {
				opened.Close()
			}
			if !errors.Is(err, ErrStorageUnavailable) {
				t.Fatalf("error=%v", err)
			}
			if after := fileDigest(t, path); after != before {
				t.Fatalf("database changed: %s != %s", after, before)
			}
		})
	}
}

func claimPreflightDatabase(t *testing.T, terminal bool) (string, domain.ProcessTask) {
	t.Helper()
	path := dbPath(t)
	opened, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	task := testGraphTask(t)
	mutation := testMutation(t, task)
	if err := opened.CommitTask(context.Background(), mutation); err != nil {
		t.Fatal(err)
	}
	task = mutation.Task
	if terminal {
		now := task.UpdatedAt.Add(time.Second)
		task.CurrentNode = domain.NodeCancelled
		task.CurrentAction = nil
		task.Revision++
		task.UpdatedAt = now
		task.CompletedAt = &now
		task.Outcome = &domain.ProcessOutcome{Status: domain.TerminalCancelled, Summary: "Task cancelled.", FinalRepositoryDigest: task.Repository.BindingDigest, CompletedAt: now}
		payload := domain.Digest(strings.Repeat("d", 64))
		task.LastOperation = &domain.LastOperation{OperationID: "cancel-request", Kind: domain.OperationCancelTask, FromRevision: 1, ToRevision: 2, PayloadDigest: payload, CommittedAt: now}
		event := TaskEvent{EventID: "cancel-event", TaskID: task.TaskID, Revision: 2, Kind: domain.OperationCancelTask, SourceNode: domain.NodeRequirements, DestinationNode: domain.NodeCancelled, RequestID: "cancel-request", PayloadDigest: payload, CreatedAt: now}
		if err := opened.CommitTask(context.Background(), TaskMutation{ExpectedRevision: 1, Task: task, Event: event, Claim: ClaimRelease}); err != nil {
			t.Fatal(err)
		}
	}
	if err := opened.Close(); err != nil {
		t.Fatal(err)
	}
	return path, task
}

func execClaimCorruption(t *testing.T, path, statement string) {
	t.Helper()
	db := openRaw(t, path)
	defer db.Close()
	if _, err := db.Exec(statement); err != nil {
		t.Fatal(err)
	}
}
