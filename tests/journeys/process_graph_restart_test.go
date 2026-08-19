package journeys

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

const phase7BWorkerMode = "DEV_FLOW_PHASE7B_SUBPROCESS_MODE"

func TestProcessGraphRestartJourney(t *testing.T) {
	root := t.TempDir()
	repoPath := filepath.Join(root, "repository")
	dbPath := filepath.Join(root, "dev-flow.db")
	firstProof := filepath.Join(root, "comprehension.json")
	terminalProof := filepath.Join(root, "terminal.json")
	runPhase7BWorker(t, "prepare", repoPath, dbPath, "", firstProof)
	runPhase7BWorker(t, "resume", repoPath, dbPath, firstProof, terminalProof)
	runPhase7BWorker(t, "terminal", repoPath, dbPath, terminalProof, "")
}

func TestPhase7BSubprocessWorker(t *testing.T) {
	mode := os.Getenv(phase7BWorkerMode)
	if mode == "" {
		return
	}
	repoPath := os.Getenv("DEV_FLOW_PHASE7B_REPOSITORY")
	dbPath := os.Getenv("DEV_FLOW_PHASE7B_DATABASE")
	inputProof := os.Getenv("DEV_FLOW_PHASE7B_INPUT_PROOF")
	outputProof := os.Getenv("DEV_FLOW_PHASE7B_OUTPUT_PROOF")
	switch mode {
	case "prepare":
		j := openJourneyAtPaths(t, repoPath, dbPath, domain.MethodSpecKit, true)
		j.toComprehension()
		if j.task.CurrentNode != domain.NodeComprehensionReview || j.task.Test == nil || j.task.CurrentAction == nil || j.task.Intent.MethodProfile != domain.MethodSpecKit {
			t.Fatal("first process did not reach COMPREHENSION_REVIEW")
		}
		proof := restartProof{Task: j.task, EventCount: j.eventCount(), ClaimCount: j.claimCount()}
		j.close()
		writeRestartProof(t, outputProof, proof)
	case "resume":
		before := readRestartProof(t, inputProof)
		j := openJourneyAtPaths(t, repoPath, dbPath, domain.MethodSpecKit, false)
		if !reflect.DeepEqual(j.task, before.Task) || j.eventCount() != before.EventCount || j.claimCount() != before.ClaimCount || j.task.CurrentAction.ActionID != before.Task.CurrentAction.ActionID || j.task.Test.RecordID != before.Task.Test.RecordID || len(j.task.Evidence) != len(before.Task.Evidence) {
			t.Fatal("second process resume changed persisted authority")
		}
		resumedRevision := j.task.Revision
		j.apply("comprehension_passed", "", comprehensionJourneyResult([]string{"request path", "verification authority"}, nil, nil, "user", "passed", nil))
		j.apply("delivery_complete", "", deliveryJourneyResult(j.task))
		if j.task.CurrentNode != domain.NodeDone || j.task.CurrentAction != nil || j.task.Outcome == nil || j.task.Revision != resumedRevision+2 || j.eventCount() != before.EventCount+2 || j.claimCount() != 0 || j.task.Comprehension == nil || j.task.Outcome.TestRecordID != j.task.Test.RecordID || j.task.Outcome.ComprehensionRecordID != j.task.Comprehension.RecordID {
			t.Fatal("second process did not continue to a consistent DONE outcome")
		}
		terminal := restartProof{Task: j.task, EventCount: j.eventCount(), ClaimCount: j.claimCount()}
		j.close()
		writeRestartProof(t, outputProof, terminal)
	case "terminal":
		before := readRestartProof(t, inputProof)
		sqliteStore, err := store.Open(context.Background(), dbPath)
		if err != nil {
			t.Fatal(err)
		}
		defer sqliteStore.Close()
		loaded, err := sqliteStore.LoadTask(context.Background(), before.Task.TaskID)
		if err != nil || !reflect.DeepEqual(loaded, before.Task) {
			t.Fatalf("terminal load err=%v", err)
		}
		if got := databaseCount(t, dbPath, `SELECT COUNT(*) FROM task_events WHERE task_id=?`, loaded.TaskID); got != before.EventCount {
			t.Fatalf("events=%d", got)
		}
		if got := databaseCount(t, dbPath, `SELECT COUNT(*) FROM repository_claims WHERE task_id=?`, loaded.TaskID); got != 0 {
			t.Fatalf("claims=%d", got)
		}
		service, err := application.NewService(sqliteStore, repository.NewGitObserver())
		if err != nil {
			t.Fatal(err)
		}
		payload := journeyPayload(t, loaded, "delivery_complete", "", deliveryJourneyResult(loaded))
		_, err = service.ApplyAction(context.Background(), application.ApplyActionRequest{RequestID: "terminal-reopen-apply", Host: domain.HostCodex, TaskID: loaded.TaskID, ExpectedRevision: loaded.Revision, ActionID: "terminal-action", ActionKind: domain.ActionCompleteDelivery, ProcessID: loaded.Process.ID, ProcessVersion: loaded.Process.Version, ProcessDefinitionDigest: loaded.Process.DefinitionDigest, SourceCursor: loaded.CurrentNode, RepositoryBindingDigest: loaded.Repository.BindingDigest, Payload: payload})
		if !errors.Is(err, domain.ErrTaskTerminal) {
			t.Fatalf("terminal apply err=%v", err)
		}
		if got := databaseCount(t, dbPath, `SELECT COUNT(*) FROM task_events WHERE task_id=?`, loaded.TaskID); got != before.EventCount {
			t.Fatalf("terminal apply events=%d", got)
		}
	default:
		t.Fatalf("unknown subprocess mode %q", mode)
	}
}

func runPhase7BWorker(t *testing.T, mode, repoPath, dbPath, inputProof, outputProof string) {
	t.Helper()
	cmd := exec.Command(os.Args[0], "-test.run=^TestPhase7BSubprocessWorker$", "-test.v")
	cmd.Env = append(os.Environ(),
		phase7BWorkerMode+"="+mode,
		"DEV_FLOW_PHASE7B_REPOSITORY="+repoPath,
		"DEV_FLOW_PHASE7B_DATABASE="+dbPath,
		"DEV_FLOW_PHASE7B_INPUT_PROOF="+inputProof,
		"DEV_FLOW_PHASE7B_OUTPUT_PROOF="+outputProof,
	)
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("subprocess %s: %v\n%s", mode, err, output)
	}
}
