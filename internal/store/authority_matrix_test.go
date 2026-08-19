package store

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestAuthorityMatrixCorruptSnapshotSafeStopsDecodeLoadAndPreflight(t *testing.T) {
	corruptSnapshot := func(t *testing.T, task domain.ProcessTask) []byte {
		t.Helper()
		task.Design = &domain.DesignBaseline{Revision: 1, Digest: task.Process.DefinitionDigest, RequirementsRevision: 1, Approach: "Impossible downstream design.", Decisions: []string{"Corrupt authority."}, CreatedAt: task.CreatedAt}
		raw, err := json.Marshal(persistedTaskV2(task))
		if err != nil {
			t.Fatal(err)
		}
		return raw
	}

	task := testGraphTask(t)
	if _, err := decodeTask(corruptSnapshot(t, task)); !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("decode error=%v", err)
	}

	path, task := claimPreflightDatabase(t, false)
	opened, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	raw := openRaw(t, path)
	if _, err := raw.Exec(`UPDATE tasks SET snapshot=? WHERE task_id=?`, corruptSnapshot(t, task), task.TaskID); err != nil {
		t.Fatal(err)
	}
	raw.Close()
	if _, err := opened.LoadTask(context.Background(), task.TaskID); !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("load error=%v", err)
	}
	opened.Close()
	before := fileDigest(t, path)
	if reopened, err := Open(context.Background(), path); !errors.Is(err, ErrStorageUnavailable) {
		if reopened != nil {
			reopened.Close()
		}
		t.Fatalf("preflight error=%v", err)
	}
	if after := fileDigest(t, path); after != before {
		t.Fatalf("preflight changed corrupt database: %s != %s", after, before)
	}
}
