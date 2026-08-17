package journeys

import (
	"context"
	"database/sql"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type recoveryJourneyCore struct {
	taskStore *store.SQLite
	observer  *repository.GitObserver
	service   *application.Service
}

func openRecoveryJourneyCore(
	t *testing.T,
	ctx context.Context,
	databasePath string,
) *recoveryJourneyCore {
	t.Helper()
	taskStore, err := store.Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("open recovery journey store: %v", err)
	}
	observer := repository.NewGitObserver()
	service, err := application.NewService(taskStore, observer)
	if err != nil {
		_ = taskStore.Close()
		t.Fatalf("construct recovery journey service: %v", err)
	}
	core := &recoveryJourneyCore{taskStore: taskStore, observer: observer, service: service}
	t.Cleanup(func() {
		if core.taskStore != nil {
			_ = core.taskStore.Close()
		}
	})
	return core
}

func (core *recoveryJourneyCore) close(t *testing.T) {
	t.Helper()
	if core == nil || core.taskStore == nil {
		return
	}
	if err := core.taskStore.Close(); err != nil {
		t.Fatalf("close recovery journey store: %v", err)
	}
	core.taskStore = nil
	core.observer = nil
	core.service = nil
}

func openRecoveryJourneyTask(
	t *testing.T,
	ctx context.Context,
	core *recoveryJourneyCore,
	repositoryPath string,
) domain.Task {
	t.Helper()
	result, err := core.service.OpenTask(ctx, application.OpenTaskRequest{
		RequestID:      "request-recovery-journey-open",
		Host:           domain.HostCodex,
		RepositoryPath: repositoryPath,
		NewTask: &application.NewTaskInput{
			Goal:               "prove one committed action after its result is discarded",
			Scope:              []string{"User Story 1 recovery boundary"},
			OutOfScope:         []string{"repository drift and host crash claims"},
			AcceptanceCriteria: []string{"exact read-back proves one committed operation"},
			VerificationBudget: domain.VerificationBudget{
				Level:                domain.VerificationTargeted,
				MaxAutomaticCommands: 2,
			},
		},
	})
	if err != nil || !result.Created {
		t.Fatalf("open recovery journey task: created=%t error=%v", result.Created, err)
	}
	return result.Task
}

func recoveryJourneyAssessPayload() workflow.AssessTaskPayload {
	return workflow.AssessTaskPayload{
		Result:                         domain.ActionResultSucceeded,
		Summary:                        "the bounded recovery journey was assessed",
		Constraints:                    []string{"retain exact operation identity"},
		Risks:                          []string{"caller may lose the committed result"},
		IntendedChangedSurface:         []string{"test-owned SQLite state only"},
		VerificationBudgetAcknowledged: true,
	}
}

func recoveryJourneyApplyRequest(
	t *testing.T,
	source domain.Task,
	operationID domain.ID,
	payload workflow.ActionPayload,
) application.ApplyActionRequest {
	t.Helper()
	if source.CurrentAction == nil {
		t.Fatal("recovery journey source has no current action")
	}
	return application.ApplyActionRequest{
		RequestID:               operationID,
		Host:                    source.OriginHost,
		TaskID:                  source.TaskID,
		ExpectedRevision:        source.Revision,
		ActionID:                source.CurrentAction.ActionID,
		ActionKind:              source.CurrentAction.Kind,
		RepositoryBindingDigest: source.CurrentAction.RepositoryBindingDigest,
		Payload:                 payload,
	}
}

func recoveryJourneyProbe(
	t *testing.T,
	request application.ApplyActionRequest,
	sourcePhase domain.Phase,
) *application.OperationProbe {
	t.Helper()
	return &application.OperationProbe{
		OperationID:             request.RequestID,
		SourcePhase:             sourcePhase,
		ExpectedRevision:        request.ExpectedRevision,
		ActionID:                request.ActionID,
		ActionKind:              request.ActionKind,
		RepositoryBindingDigest: request.RepositoryBindingDigest,
		Payload:                 request.Payload,
	}
}

type recoveryJourneyDatabaseFacts struct {
	taskCount          int
	phase              domain.Phase
	revision           uint64
	eventCount         int
	matchingEventCount int
	claimCount         int
	claimIdentity      string
}

func readRecoveryJourneyDatabaseFacts(
	t *testing.T,
	databasePath string,
	taskID domain.ID,
	operationID domain.ID,
) recoveryJourneyDatabaseFacts {
	t.Helper()
	database, err := sql.Open("sqlite", databasePath)
	if err != nil {
		t.Fatalf("open recovery journey database facts: %v", err)
	}
	defer database.Close()

	var facts recoveryJourneyDatabaseFacts
	if err := database.QueryRow(`SELECT COUNT(*) FROM tasks`).Scan(&facts.taskCount); err != nil {
		t.Fatalf("read recovery journey task count: %v", err)
	}
	if err := database.QueryRow(
		`SELECT phase, revision FROM tasks WHERE task_id = ?`, string(taskID),
	).Scan(&facts.phase, &facts.revision); err != nil {
		t.Fatalf("read recovery journey task facts: %v", err)
	}
	if err := database.QueryRow(
		`SELECT COUNT(*) FROM task_events WHERE task_id = ?`, string(taskID),
	).Scan(&facts.eventCount); err != nil {
		t.Fatalf("read recovery journey event count: %v", err)
	}
	if err := database.QueryRow(
		`SELECT COUNT(*) FROM task_events WHERE task_id = ? AND request_id = ?`,
		string(taskID), string(operationID),
	).Scan(&facts.matchingEventCount); err != nil {
		t.Fatalf("read recovery journey matching event count: %v", err)
	}
	if err := database.QueryRow(
		`SELECT COUNT(*), COALESCE(MIN(repository_identity), '') FROM repository_claims WHERE task_id = ?`,
		string(taskID),
	).Scan(&facts.claimCount, &facts.claimIdentity); err != nil {
		t.Fatalf("read recovery journey claim facts: %v", err)
	}
	return facts
}

type recoveryRepositorySnapshot struct {
	head   string
	status string
}

func captureRecoveryRepositorySnapshot(t *testing.T, repositoryPath string) recoveryRepositorySnapshot {
	t.Helper()
	return recoveryRepositorySnapshot{
		head:   runRecoveryReadOnlyGit(t, repositoryPath, "rev-parse", "HEAD"),
		status: runRecoveryReadOnlyGit(t, repositoryPath, "status", "--porcelain=v2", "--branch", "-z"),
	}
}

func requireRecoveryRepositoryUnchanged(
	t *testing.T,
	before recoveryRepositorySnapshot,
	repositoryPath string,
) {
	t.Helper()
	after := captureRecoveryRepositorySnapshot(t, repositoryPath)
	if after != before {
		t.Fatalf("Core recovery journey mutated the temporary Git repository: before=%#v after=%#v", before, after)
	}
}

func runRecoveryReadOnlyGit(t *testing.T, repositoryPath string, arguments ...string) string {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", repositoryPath}, arguments...)...)
	var output boundedRestartOutput
	output.limit = maxRestartHelperOutputByte
	command.Stdout = &output
	command.Stderr = &output
	if err := command.Run(); err != nil {
		text := strings.ReplaceAll(output.String(), filepath.Clean(repositoryPath), "<temporary-repository>")
		t.Fatalf("read-only recovery Git observation failed: %v\n%s", err, text)
	}
	return output.String()
}

func initializeRecoveryReplacementRepository(
	t *testing.T,
	repositoryPath string,
	commonDirectory string,
) {
	t.Helper()
	command := exec.Command("git", "init", "--separate-git-dir", commonDirectory, repositoryPath)
	var output boundedRestartOutput
	output.limit = maxRestartHelperOutputByte
	command.Stdout = &output
	command.Stderr = &output
	if err := command.Run(); err != nil {
		t.Fatalf("initialize replacement repository: %v\n%s", err, output.String())
	}
	runRestartGit(t, repositoryPath, "config", "user.email", "replacement@example.invalid")
	runRestartGit(t, repositoryPath, "config", "user.name", "Replacement Journey")
	if err := os.WriteFile(filepath.Join(repositoryPath, "README.md"), []byte("replacement repository\n"), 0o644); err != nil {
		t.Fatalf("write replacement repository file: %v", err)
	}
	runRestartGit(t, repositoryPath, "add", "README.md")
	runRestartGit(t, repositoryPath, "commit", "-m", "replacement repository fixture")
}
