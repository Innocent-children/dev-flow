package store

import (
	"context"
	"database/sql"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/taskbelay/internal/domain"
)

type preflightQueryGate struct {
	queryer
	reached chan struct{}
	resume  chan struct{}
}

func (q preflightQueryGate) QueryContext(ctx context.Context, statement string, args ...any) (*sql.Rows, error) {
	if strings.Contains(statement, " FROM action_operations") {
		close(q.reached)
		select {
		case <-q.resume:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return q.queryer.QueryContext(ctx, statement, args...)
}

func TestPreflightUsesOneSnapshotAcrossConcurrentCommit(t *testing.T) {
	for _, release := range []bool{false, true} {
		name := "action_commit"
		if release {
			name = "claim_release"
		}
		t.Run(name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			path := dbPath(t)
			writer, err := Open(ctx, path)
			if err != nil {
				t.Fatal(err)
			}
			defer writer.Close()
			if _, err := writer.db.ExecContext(ctx, "PRAGMA journal_mode=WAL"); err != nil {
				t.Fatal(err)
			}
			task := testMutation(t, testGraphTask(t)).Task
			if err := writer.CommitTask(ctx, testMutation(t, task)); err != nil {
				t.Fatal(err)
			}
			commit := storeTestActionCommit(t, task)
			if err := writer.StageActionOperation(ctx, task, commit); err != nil {
				t.Fatal(err)
			}
			reader, err := sql.Open("sqlite", dataSource(path, true))
			if err != nil {
				t.Fatal(err)
			}
			defer reader.Close()
			tx, err := reader.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
			if err != nil {
				t.Fatal(err)
			}
			defer tx.Rollback()
			gate := preflightQueryGate{queryer: tx, reached: make(chan struct{}), resume: make(chan struct{})}
			checked := make(chan error, 1)
			go func() { checked <- preflightSnapshot(ctx, gate) }()
			select {
			case <-gate.reached:
			case err := <-checked:
				t.Fatalf("preflight stopped before the commit window: %v", err)
			case <-ctx.Done():
				t.Fatal(ctx.Err())
			}
			if release {
				err = writer.CommitTask(ctx, terminalMutation(t, task))
			} else {
				mutation := retainMutation(t, task)
				mutation.Task.LastOperation.OperationID = commit.Operation.OperationID
				mutation.Task.LastOperation.PayloadDigest = commit.PayloadDigest
				mutation.Event.RequestID = commit.Operation.OperationID
				mutation.Event.PayloadDigest = commit.PayloadDigest
				err = writer.CommitActionOperation(ctx, commit.Operation.OperationID, mutation)
			}
			close(gate.resume)
			if err != nil {
				t.Fatal(err)
			}
			if err := <-checked; err != nil {
				t.Fatalf("preflight mixed committed versions: %v", err)
			}
			var revision, claims int
			if err := tx.QueryRowContext(ctx, "SELECT revision FROM tasks WHERE task_id=?", task.TaskID).Scan(&revision); err != nil || revision != 1 {
				t.Fatalf("snapshot revision=%d err=%v", revision, err)
			}
			if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM repository_claims WHERE task_id=?", task.TaskID).Scan(&claims); err != nil || claims != 1 {
				t.Fatalf("snapshot claims=%d err=%v", claims, err)
			}
			if err := tx.Rollback(); err != nil {
				t.Fatal(err)
			}
			if err := preflightExisting(ctx, path); err != nil {
				t.Fatalf("new preflight did not see complete WAL commit: %v", err)
			}
			current, err := writer.LoadTask(ctx, task.TaskID)
			if err != nil || current.Revision != 2 || release && current.CurrentNode != domain.NodeCancelled {
				t.Fatalf("current revision=%d node=%s err=%v", current.Revision, current.CurrentNode, err)
			}
			if err := writer.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM repository_claims WHERE task_id=?", task.TaskID).Scan(&claims); err != nil || release && claims != 0 || !release && claims != 1 {
				t.Fatalf("current claims=%d err=%v", claims, err)
			}
		})
	}
}
