package application

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Innocent-children/taskbelay/internal/domain"
	"github.com/Innocent-children/taskbelay/internal/repository"
	"github.com/Innocent-children/taskbelay/internal/store"
)

func TestPrepareFileChangeChecksNewDirectories(t *testing.T) {
	service, database, task, root := fileScopeGitTask(t)
	ctx := context.Background()
	request := PrepareFileChangeRequest{Host: domain.HostDeepSeek, RepositoryPath: root, ToolName: "write", IntentDigest: testDigest('a'), PathParseComplete: true}
	request.Paths = []string{filepath.Join(root, "src", "new", "file.go")}
	allowed, err := service.PrepareFileChange(ctx, request)
	if err != nil || allowed.Decision != FileChangeAllow || allowed.TaskID != task.TaskID {
		t.Fatalf("planned new directory: result=%#v err=%v", allowed, err)
	}
	stored, err := database.LoadTask(ctx, task.TaskID)
	if err != nil || stored.Revision != task.Revision {
		t.Fatalf("planned path changed Task: revision=%d err=%v", stored.Revision, err)
	}
	request.Paths = []string{filepath.Join(root, "config", "new", "settings.yml")}
	denied, err := service.PrepareFileChange(ctx, request)
	if err != nil || denied.Decision != FileChangeDeny || denied.ScopeRequestID == "" || denied.TaskID != task.TaskID {
		t.Fatalf("unplanned new directory: result=%#v err=%v", denied, err)
	}
	stored, err = database.LoadTask(ctx, task.TaskID)
	if err != nil || stored.CurrentNode != domain.NodeBlocked || len(stored.FileScopeRecords) != 1 ||
		len(stored.FileScopeRecords[0].Paths) != 1 || stored.FileScopeRecords[0].Paths[0] != "config/new/settings.yml" {
		t.Fatalf("file scope blocker not persisted: task=%#v err=%v", stored, err)
	}
	for _, directory := range []string{"src", "config"} {
		if _, err := os.Stat(filepath.Join(root, directory)); !errors.Is(err, os.ErrNotExist) {
			t.Fatalf("write check created directory %s: %v", directory, err)
		}
	}
}

func TestPrepareFileChangeAllowsUnmanagedDirectories(t *testing.T) {
	database := fileScopeDatabase(t)
	service, err := NewService(database, repository.NewGitObserver())
	if err != nil {
		t.Fatal(err)
	}
	for name, root := range map[string]string{"ordinary directory": t.TempDir(), "Git repository without Task": fileScopeGitRepository(t)} {
		t.Run(name, func(t *testing.T) {
			result, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostDeepSeek, RepositoryPath: root, ToolName: "write", Paths: []string{filepath.Join(root, "new", "file.txt")}, IntentDigest: testDigest('a'), PathParseComplete: true})
			if err != nil || result.Decision != FileChangeAllow || result.TaskID != "" {
				t.Fatalf("unmanaged directory: result=%#v err=%v", result, err)
			}
		})
	}
}

func TestPrepareFileChangeRejectsUnavailableClaimedRoot(t *testing.T) {
	service, database, task, root := fileScopeGitTask(t)
	if err := os.Rename(filepath.Join(root, ".git"), filepath.Join(root, "git-unavailable")); err != nil {
		t.Fatal(err)
	}
	result, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostDeepSeek, RepositoryPath: root, ToolName: "write", Paths: []string{filepath.Join(root, "new", "file.txt")}, IntentDigest: testDigest('a'), PathParseComplete: true})
	if !errors.Is(err, domain.ErrWorkspaceUnavailable) || result.Decision == FileChangeAllow {
		t.Fatalf("claimed root with unavailable Git: result=%#v err=%v", result, err)
	}
	stored, err := database.LoadTask(context.Background(), task.TaskID)
	if err != nil || stored.Revision != task.Revision {
		t.Fatalf("unavailable check changed Task: revision=%d err=%v", stored.Revision, err)
	}
}

func TestPrepareFileChangeDoesNotAllowObservationErrors(t *testing.T) {
	for name, failure := range map[string]error{"Git failure": repository.ErrGitObservation, "Git timeout": repository.ErrGitCommandTimeout, "Git output limit": repository.ErrGitOutputLimit} {
		t.Run(name, func(t *testing.T) {
			service, err := NewService(&memoryStore{}, fileScopeFailedIdentifier{failure: failure})
			if err != nil {
				t.Fatal(err)
			}
			result, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostDeepSeek, RepositoryPath: testPath("repo"), ToolName: "write", Paths: []string{testPath("repo", "new.txt")}, IntentDigest: testDigest('a'), PathParseComplete: true})
			if !errors.Is(err, domain.ErrWorkspaceUnavailable) || result.Decision == FileChangeAllow {
				t.Fatalf("observation failure: result=%#v err=%v", result, err)
			}
		})
	}
}

type fileScopeFailedIdentifier struct {
	observer
	failure error
}

func (o fileScopeFailedIdentifier) IdentifyWorkspace(context.Context, string) (string, domain.Digest, error) {
	return "", "", o.failure
}

func fileScopeGitTask(t *testing.T) (*Service, *store.SQLite, domain.ProcessTask, string) {
	t.Helper()
	root := fileScopeGitRepository(t)
	database := fileScopeDatabase(t)
	service, err := NewService(database, repository.NewGitObserver())
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.OpenTask(context.Background(), OpenTaskRequest{RequestID: "scope-open", Host: domain.HostDeepSeek, RepositoryPath: root, WorkspaceOrigin: &WorkspaceOriginInput{Mode: domain.WorkspaceModeCurrentBranch, SourceType: "local", BaseBranch: "main", BaseCommit: fileScopeRunGit(t, root, "rev-parse", "HEAD"), TaskBranch: "main", ProvisioningReceiptID: "scope-receipt"}, NewTask: &NewTaskInput{Request: "Check new file scope before writing", MethodProfile: domain.MethodPlain}})
	if err != nil {
		t.Fatal(err)
	}
	task := opened.Task
	submit := func(transition string, nodeResult map[string]any) {
		nodeResult["problem_class"] = "none"
		request := actionSubmission(t, task, domain.ID(transition), domain.TransitionID(transition), nodeResult)
		request.Host = domain.HostDeepSeek
		result, err := service.SubmitAction(context.Background(), request)
		if err != nil {
			t.Fatalf("%s: %v", transition, err)
		}
		task = result.Task
	}
	submit("requirements_ready", requirementsNodeResult("Check structured writes", []string{"New files respect the approved plan"}))
	submit("design_ready", designResultWithoutRevision("Use the existing file-scope gate"))
	work := workItem("work-scope", []uint32{0}, nil)
	work["expected_paths"] = []string{"src/**"}
	submit("tasks_plan_saved", tasksResultWithoutRevision([]map[string]any{work}))
	submit("tasks_ready", confirmedPlanResult(task))
	return service, database, task, root
}

func fileScopeDatabase(t *testing.T) *store.SQLite {
	t.Helper()
	database, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "file-scope.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })
	return database
}

func fileScopeGitRepository(t *testing.T) string {
	t.Helper()
	root, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	fileScopeRunGit(t, root, "init", "-b", "main")
	fileScopeRunGit(t, root, "commit", "--allow-empty", "-m", "Initial repository")
	return root
}

func fileScopeRunGit(t *testing.T, root string, arguments ...string) string {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", root}, arguments...)...)
	command.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_CONFIG_GLOBAL="+os.DevNull, "GIT_AUTHOR_NAME=File scope test", "GIT_AUTHOR_EMAIL=scope@example.invalid", "GIT_COMMITTER_NAME=File scope test", "GIT_COMMITTER_EMAIL=scope@example.invalid")
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v: %s", arguments, err, output)
	}
	return strings.TrimSpace(string(output))
}
