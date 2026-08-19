package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"os"
	"path/filepath"
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
func dbPath(t *testing.T) string { return filepath.Join(t.TempDir(), "tasks.db") }

var _ = context.Background
