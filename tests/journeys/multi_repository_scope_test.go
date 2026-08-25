package journeys

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func TestMultiRepositoryScopeJourney(t *testing.T) {
	root := t.TempDir()
	primaryPath := filepath.Join(root, "core")
	additionalPath := filepath.Join(root, "docs")
	initializeJourneyRepository(t, primaryPath)
	initializeJourneyRepository(t, additionalPath)
	databasePath := filepath.Join(root, "dev-flow.db")
	sqliteStore, err := store.Open(context.Background(), databasePath)
	if err != nil {
		t.Fatal(err)
	}
	defer sqliteStore.Close()
	service, err := application.NewService(sqliteStore, repository.NewGitObserver())
	if err != nil {
		t.Fatal(err)
	}

	occupied, err := service.OpenTask(context.Background(), application.OpenTaskRequest{
		RequestID: "occupy-additional", Host: domain.HostCodex, RepositoryPath: additionalPath,
		NewTask: &application.NewTaskInput{Request: "Temporarily occupy the additional repository.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 2}, MethodProfile: domain.MethodPlain},
	})
	if err != nil {
		t.Fatal(err)
	}
	beforeConflict := multiRepositoryDatabaseCounts(t, databasePath)
	_, err = service.OpenTask(context.Background(), application.OpenTaskRequest{
		RequestID: "conflicting-multi-open", Host: domain.HostCodex, RepositoryPath: primaryPath, PrimaryRepositoryKey: "core",
		AdditionalRepositories: []application.AdditionalRepositoryInput{{Key: "docs", RepositoryPath: additionalPath}},
		NewTask:                &application.NewTaskInput{Request: "Create a conflicting two-repository task.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 2}, MethodProfile: domain.MethodPlain},
	})
	if !errors.Is(err, domain.ErrActiveTaskConflict) {
		t.Fatalf("additional claim conflict error=%v", err)
	}
	if afterConflict := multiRepositoryDatabaseCounts(t, databasePath); afterConflict != beforeConflict {
		t.Fatalf("claim conflict left residual rows: before=%+v after=%+v", beforeConflict, afterConflict)
	}
	if _, err := service.CancelTask(context.Background(), application.CancelTaskRequest{RequestID: "release-additional", Host: domain.HostCodex, TaskID: occupied.Task.TaskID, ExpectedRevision: occupied.Task.Revision, Reason: "Release the temporary claim."}); err != nil {
		t.Fatal(err)
	}

	opened, err := service.OpenTask(context.Background(), application.OpenTaskRequest{
		RequestID: "open-multi-repository", Host: domain.HostCodex, RepositoryPath: primaryPath, PrimaryRepositoryKey: "core",
		AdditionalRepositories: []application.AdditionalRepositoryInput{{Key: "docs", RepositoryPath: additionalPath}},
		NewTask:                &application.NewTaskInput{Request: "Record one scoped requirements mutation.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 4}, MethodProfile: domain.MethodPlain},
	})
	if err != nil {
		t.Fatal(err)
	}
	if claims := multiRepositoryTaskClaimCount(t, databasePath, opened.Task.TaskID); claims != 2 {
		t.Fatalf("acquired claims=%d", claims)
	}
	resumed, err := service.OpenTask(context.Background(), application.OpenTaskRequest{RequestID: "resume-from-additional", Host: domain.HostCodex, RepositoryPath: additionalPath})
	if err != nil {
		t.Fatal(err)
	}
	if resumed.Task.TaskID != opened.Task.TaskID || resumed.Task.Revision != opened.Task.Revision || resumed.Task.CurrentAction.ActionID != opened.Task.CurrentAction.ActionID {
		t.Fatalf("additional resume returned another task: opened=%+v resumed=%+v", opened.Task, resumed.Task)
	}

	artifactPath := filepath.Join(primaryPath, "requirements.md")
	artifactContent := []byte("bounded multi-repository requirements\n")
	if err := os.WriteFile(artifactPath, artifactContent, 0o644); err != nil {
		t.Fatal(err)
	}
	payload := multiRepositoryRequirementsPayload(t, opened.Task, artifactContent)
	digest, err := opened.Task.EffectiveRepositoryBindingDigest()
	if err != nil {
		t.Fatal(err)
	}
	action := opened.Task.CurrentAction
	applied, err := service.ApplyAction(context.Background(), application.ApplyActionRequest{RequestID: "apply-scoped-requirements", Host: domain.HostCodex, TaskID: opened.Task.TaskID, ExpectedRevision: opened.Task.Revision, ActionID: action.ActionID, ActionKind: action.Kind, ProcessID: opened.Task.Process.ID, ProcessDefinitionDigest: opened.Task.Process.DefinitionDigest, SourceCursor: opened.Task.CurrentNode, RepositoryBindingDigest: digest, Payload: payload})
	if err != nil {
		t.Fatal(err)
	}
	if applied.Task.CurrentNode != domain.NodeDesign || applied.Task.Revision != opened.Task.Revision+1 || len(applied.Task.AdditionalRepositories) != 1 || multiRepositoryTaskClaimCount(t, databasePath, applied.Task.TaskID) != 2 {
		t.Fatalf("scoped mutation result=%+v", applied.Task)
	}
	if _, err := service.CancelTask(context.Background(), application.CancelTaskRequest{RequestID: "cancel-multi-repository", Host: domain.HostCodex, TaskID: applied.Task.TaskID, ExpectedRevision: applied.Task.Revision, Reason: "Complete the bounded journey through cancellation."}); err != nil {
		t.Fatal(err)
	}
	if claims := multiRepositoryTaskClaimCount(t, databasePath, applied.Task.TaskID); claims != 0 {
		t.Fatalf("terminal claims=%d", claims)
	}
}

type multiRepositoryRowCounts struct {
	Tasks  int
	Events int
	Claims int
}

func multiRepositoryDatabaseCounts(t *testing.T, path string) multiRepositoryRowCounts {
	t.Helper()
	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	counts := multiRepositoryRowCounts{}
	for query, destination := range map[string]*int{
		`SELECT COUNT(*) FROM tasks`:             &counts.Tasks,
		`SELECT COUNT(*) FROM task_events`:       &counts.Events,
		`SELECT COUNT(*) FROM repository_claims`: &counts.Claims,
	} {
		if err := db.QueryRow(query).Scan(destination); err != nil {
			t.Fatal(err)
		}
	}
	return counts
}

func multiRepositoryTaskClaimCount(t *testing.T, path string, taskID domain.ID) int {
	t.Helper()
	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM repository_claims WHERE task_id=?`, taskID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	return count
}

func multiRepositoryRequirementsPayload(t *testing.T, task domain.ProcessTask, artifact []byte) json.RawMessage {
	t.Helper()
	value := map[string]any{}
	if err := json.Unmarshal(journeyPayload(t, task, "requirements_ready", "", requirementsJourneyResult("Scoped requirements")), &value); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(artifact)
	value["artifacts"] = []map[string]any{{"role": "requirements", "path": "core::requirements.md", "digest": hex.EncodeToString(sum[:]), "summary": "Scoped requirements artifact"}}
	nodeResult := value["node_result"].(map[string]any)
	nodeResult["changed_paths"] = []string{"core::requirements.md"}
	nodeResult["no_file_changes"] = false
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}
