package application

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func TestRepositoryBindingMutationRequirementsRestartAndDirtyBaseline(t *testing.T) {
	t.Run("restart retains the original Action for authorized requirements edits", func(t *testing.T) {
		repo := newMutationRepository(t)
		databasePath := filepath.Join(t.TempDir(), "tasks.db")
		database, service := newMutationService(t, databasePath)
		task := openMutationTask(t, service, repo, nil)
		action := *task.CurrentAction

		paths := writeRequirementsArtifacts(t, repo, "specs/011-binding")
		payload := requirementsMutationPayload(t, task, paths, []string{"specs/011-binding/spec.md"})
		if err := database.Close(); err != nil {
			t.Fatal(err)
		}

		database, service = newMutationService(t, databasePath)
		defer database.Close()
		resumed, err := service.OpenTask(context.Background(), OpenTaskRequest{RequestID: "resume-requirements", Host: domain.HostCodex, RepositoryPath: repo})
		if err != nil {
			t.Fatal(err)
		}
		if resumed.Task.CurrentAction == nil || !reflect.DeepEqual(*resumed.Task.CurrentAction, action) {
			t.Fatal("restart changed the persisted Action")
		}
		result, err := service.ApplyAction(context.Background(), mutationApplyRequest(t, resumed.Task, payload, "apply-requirements-restart"))
		if err != nil {
			t.Fatal(err)
		}
		if result.Task.CurrentNode != domain.NodeDesign || result.Task.Repository.BindingDigest == task.Repository.BindingDigest {
			t.Fatal("authorized requirements edit did not advance and rebind")
		}
	})

	t.Run("pre-existing modified and untracked files remain baseline facts", func(t *testing.T) {
		repo := newMutationRepository(t)
		writeMutationFile(t, repo, "seed.txt", "dirty baseline\n")
		writeMutationFile(t, repo, "notes/untracked.txt", "user work\n")
		database, service := newMutationService(t, filepath.Join(t.TempDir(), "tasks.db"))
		defer database.Close()
		task := openMutationTask(t, service, repo, nil)
		paths := writeRequirementsArtifacts(t, repo, "specs/011-binding")
		result, err := service.ApplyAction(context.Background(), mutationApplyRequest(t, task, requirementsMutationPayload(t, task, paths, nil), "apply-dirty-baseline"))
		if err != nil {
			t.Fatal(err)
		}
		if result.Task.CurrentNode != domain.NodeDesign {
			t.Fatalf("node=%s", result.Task.CurrentNode)
		}
	})
}

func TestRepositoryBindingMutationDesignAndTasksUseOriginalActions(t *testing.T) {
	service, _, observer := phase5Service(t)
	task := openPhase5Task(t, service)

	requirements := requirementsNodeResult("Goal", []string{"Accepted"})
	requirements["changed_paths"] = []string{"specs/feature/spec.md"}
	requirements["no_file_changes"] = false
	observer.binding = graphChangedBinding(task.Repository, []string{"specs/feature/spec.md"}, "c")
	task = applyPhase5(t, service, task, "requirements_ready", "", requirements)

	design := designNodeResult(task.Requirements.Revision, "Direct design")
	design["changed_paths"] = []string{"specs/feature/plan.md"}
	design["no_file_changes"] = false
	observer.binding = graphChangedBinding(task.Repository, []string{"specs/feature/plan.md", "specs/feature/spec.md"}, "d")
	task = applyPhase5(t, service, task, "design_ready", "", design)

	tasks := tasksNodeResult(task.Design.Revision, []map[string]any{workItem("work-a", []uint32{0}, nil)})
	tasks["changed_paths"] = []string{"specs/feature/tasks.md"}
	tasks["no_file_changes"] = false
	observer.binding = graphChangedBinding(task.Repository, []string{"specs/feature/plan.md", "specs/feature/spec.md", "specs/feature/tasks.md"}, "e")
	task = applyPhase5(t, service, task, "tasks_ready", "", tasks)

	if task.CurrentNode != domain.NodeImplement || task.Repository.BindingDigest != observer.binding.BindingDigest {
		t.Fatal("DESIGN or TASKS did not adopt its declared process-artifact effect")
	}
}

func TestRepositoryBindingMutationRejectsHeadBranchAndUndeclaredPathsZeroWrite(t *testing.T) {
	for _, tc := range []struct {
		name   string
		mutate func(*testing.T, string)
	}{
		{name: "head", mutate: func(t *testing.T, repo string) {
			writeMutationFile(t, repo, "head-change.txt", "head\n")
			runMutationGit(t, repo, "add", "head-change.txt")
			runMutationGit(t, repo, "commit", "-m", "head change")
		}},
		{name: "branch", mutate: func(t *testing.T, repo string) { runMutationGit(t, repo, "checkout", "-b", "other") }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := newMutationRepository(t)
			database, service := newMutationService(t, filepath.Join(t.TempDir(), "tasks.db"))
			defer database.Close()
			task := openMutationTask(t, service, repo, nil)
			tc.mutate(t, repo)
			payload := requirementsMutationPayload(t, task, nil, nil)
			_, err := service.ApplyAction(context.Background(), mutationApplyRequest(t, task, payload, domain.ID("apply-"+tc.name)))
			if err != domain.ErrRepositoryDrift {
				t.Fatalf("error=%v", err)
			}
			stored, loadErr := database.LoadTask(context.Background(), task.TaskID)
			if loadErr != nil || stored.Revision != task.Revision || stored.CurrentNode != task.CurrentNode {
				t.Fatal("forbidden drift wrote Task state")
			}
		})
	}

	t.Run("undeclared path", func(t *testing.T) {
		repo := newMutationRepository(t)
		database, service := newMutationService(t, filepath.Join(t.TempDir(), "tasks.db"))
		defer database.Close()
		task := openMutationTask(t, service, repo, nil)
		writeMutationFile(t, repo, "specs/011-binding/spec.md", "declared\n")
		writeMutationFile(t, repo, "internal/extra.go", "package extra\n")
		payload := requirementsMutationPayload(t, task, []string{"specs/011-binding/spec.md"}, nil)
		_, err := service.ApplyAction(context.Background(), mutationApplyRequest(t, task, payload, "apply-undeclared"))
		if err != domain.ErrRepositoryDrift {
			t.Fatalf("error=%v", err)
		}
		stored, loadErr := database.LoadTask(context.Background(), task.TaskID)
		if loadErr != nil || stored.Revision != task.Revision {
			t.Fatal("undeclared path wrote Task state")
		}
	})
}

func TestRepositoryBindingMutationMultiRepositoryAtomicity(t *testing.T) {
	primary := newMutationRepository(t)
	secondary := newMutationRepository(t)
	database, service := newMutationService(t, filepath.Join(t.TempDir(), "tasks.db"))
	defer database.Close()
	task := openMutationTask(t, service, primary, []AdditionalRepositoryInput{{Key: "docs", RepositoryPath: secondary}})
	writeMutationFile(t, primary, "specs/011-binding/spec.md", "requirements\n")
	writeMutationFile(t, secondary, "docs/binding.md", "design notes\n")
	paths := []string{"core::specs/011-binding/spec.md", "docs::docs/binding.md"}
	result, err := service.ApplyAction(context.Background(), mutationApplyRequest(t, task, requirementsMutationPayload(t, task, paths, nil), "apply-multi"))
	if err != nil {
		t.Fatal(err)
	}
	if result.Task.CurrentNode != domain.NodeDesign || len(result.Task.AdditionalRepositories) != 1 {
		t.Fatal("multi-repository mutation did not commit atomically")
	}

	primary = newMutationRepository(t)
	secondary = newMutationRepository(t)
	database2, service2 := newMutationService(t, filepath.Join(t.TempDir(), "tasks.db"))
	defer database2.Close()
	task = openMutationTask(t, service2, primary, []AdditionalRepositoryInput{{Key: "docs", RepositoryPath: secondary}})
	writeMutationFile(t, primary, "specs/011-binding/spec.md", "requirements\n")
	runMutationGit(t, secondary, "checkout", "-b", "other")
	_, err = service2.ApplyAction(context.Background(), mutationApplyRequest(t, task, requirementsMutationPayload(t, task, []string{"core::specs/011-binding/spec.md"}, nil), "apply-multi-drift"))
	if !errors.Is(err, domain.ErrRepositoryDrift) {
		t.Fatalf("error=%v", err)
	}
	stored, loadErr := database2.LoadTask(context.Background(), task.TaskID)
	if loadErr != nil || stored.Revision != task.Revision {
		t.Fatal("one forbidden repository wrote aggregate Task state")
	}
}

func newMutationService(t *testing.T, databasePath string) (*store.SQLite, *Service) {
	t.Helper()
	database, err := store.Open(context.Background(), databasePath)
	if err != nil {
		t.Fatal(err)
	}
	service, err := NewService(database, repository.NewGitObserver())
	if err != nil {
		database.Close()
		t.Fatal(err)
	}
	return database, service
}

func openMutationTask(t *testing.T, service *Service, primary string, additional []AdditionalRepositoryInput) domain.ProcessTask {
	t.Helper()
	result, err := service.OpenTask(context.Background(), OpenTaskRequest{
		RequestID: "open-mutation-task", Host: domain.HostCodex, RepositoryPath: primary,
		PrimaryRepositoryKey: "core", AdditionalRepositories: additional,
		NewTask: &NewTaskInput{Request: "Update repository safely", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 6}, MethodProfile: domain.MethodPlain},
	})
	if err != nil {
		t.Fatal(err)
	}
	return result.Task
}

func mutationApplyRequest(t *testing.T, task domain.ProcessTask, payload json.RawMessage, requestID domain.ID) ApplyActionRequest {
	t.Helper()
	digest, err := task.EffectiveRepositoryBindingDigest()
	if err != nil {
		t.Fatal(err)
	}
	action := task.CurrentAction
	return ApplyActionRequest{RequestID: requestID, Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision, ActionID: action.ActionID, ActionKind: action.Kind, ProcessID: task.Process.ID, ProcessDefinitionDigest: task.Process.DefinitionDigest, SourceCursor: task.CurrentNode, RepositoryBindingDigest: digest, Payload: payload}
}

func requirementsMutationPayload(t *testing.T, task domain.ProcessTask, changedPaths, artifactPaths []string) json.RawMessage {
	t.Helper()
	if changedPaths == nil {
		changedPaths = []string{}
	}
	result := requirementsNodeResult("Safe repository mutation", []string{"Authorized changes apply"})
	result["changed_paths"] = changedPaths
	result["no_file_changes"] = len(changedPaths) == 0
	payload := phase5Payload(t, task, "requirements_ready", "", result)
	var document map[string]any
	if err := json.Unmarshal(payload, &document); err != nil {
		t.Fatal(err)
	}
	artifacts := make([]map[string]any, len(artifactPaths))
	for i, path := range artifactPaths {
		artifacts[i] = map[string]any{"role": "requirements", "path": path, "digest": digestOf("e"), "summary": "Requirements authority"}
	}
	document["artifacts"] = artifacts
	encoded, err := json.Marshal(document)
	if err != nil {
		t.Fatal(err)
	}
	return encoded
}

func writeRequirementsArtifacts(t *testing.T, repo, feature string) []string {
	t.Helper()
	paths := []string{".specify/feature.json", feature + "/README.md", feature + "/checklists/requirements.md", feature + "/spec.md"}
	for _, path := range paths {
		writeMutationFile(t, repo, path, path+"\n")
	}
	return paths
}

func newMutationRepository(t *testing.T) string {
	t.Helper()
	repo := t.TempDir()
	runMutationGit(t, repo, "init", "-b", "main")
	runMutationGit(t, repo, "config", "user.email", "dev-flow@example.invalid")
	runMutationGit(t, repo, "config", "user.name", "Dev Flow Test")
	writeMutationFile(t, repo, "seed.txt", "seed\n")
	runMutationGit(t, repo, "add", "seed.txt")
	runMutationGit(t, repo, "commit", "-m", "seed")
	return repo
}

func writeMutationFile(t *testing.T, repo, path, content string) {
	t.Helper()
	absolute := filepath.Join(repo, filepath.FromSlash(path))
	if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func runMutationGit(t *testing.T, repo string, arguments ...string) {
	t.Helper()
	command := exec.Command("git", arguments...)
	command.Dir = repo
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %v: %s", arguments, err, output)
	}
}
