package application

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Innocent-children/taskbelay/internal/domain"
	"github.com/Innocent-children/taskbelay/internal/repository"
	"github.com/Innocent-children/taskbelay/internal/store"
)

func TestCRLFStagingAndCommitPreserveImplementation(t *testing.T) {
	t.Setenv("GIT_CONFIG_NOSYSTEM", "1")
	t.Setenv("GIT_CONFIG_GLOBAL", os.DevNull)
	for _, autocrlf := range []string{"false", "true"} {
		t.Run(autocrlf, func(t *testing.T) {
			ctx := context.Background()
			root, err := filepath.EvalSymlinks(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			git := func(args ...string) string {
				t.Helper()
				command := exec.Command("git", append([]string{"-C", root}, args...)...)
				command.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_CONFIG_GLOBAL="+os.DevNull,
					"GIT_AUTHOR_NAME=Test", "GIT_AUTHOR_EMAIL=test@example.invalid",
					"GIT_COMMITTER_NAME=Test", "GIT_COMMITTER_EMAIL=test@example.invalid")
				output, err := command.CombinedOutput()
				if err != nil {
					t.Fatalf("git %v: %v\n%s", args, err, output)
				}
				return strings.TrimSpace(string(output))
			}
			git("init", "-b", "main")
			git("config", "core.autocrlf", autocrlf)
			if err := os.Mkdir(filepath.Join(root, "internal"), 0o755); err != nil {
				t.Fatal(err)
			}
			path := filepath.Join(root, "internal", "file.go")
			write := func(content []byte) {
				t.Helper()
				if err := os.WriteFile(path, content, 0o644); err != nil {
					t.Fatal(err)
				}
			}
			write([]byte("initial\r\n"))
			git("add", ".")
			git("commit", "-m", "Initial content")
			database, err := store.Open(ctx, filepath.Join(t.TempDir(), "taskbelay.db"))
			if err != nil {
				t.Fatal(err)
			}
			defer database.Close()
			service, err := NewService(database, repository.NewGitObserver())
			if err != nil {
				t.Fatal(err)
			}
			opened, err := service.OpenTask(ctx, OpenTaskRequest{
				RequestID: "open-content-test", Host: domain.HostCodex, RepositoryPath: root,
				WorkspaceOrigin: &WorkspaceOriginInput{Mode: domain.WorkspaceModeCurrentBranch, SourceType: "local",
					BaseBranch: "main", BaseCommit: git("rev-parse", "HEAD"), TaskBranch: "main", ProvisioningReceiptID: "content-test"},
				NewTask: &NewTaskInput{Request: "Preserve verified file content across staging.", MethodProfile: domain.MethodPlain},
			})
			if err != nil {
				t.Fatal(err)
			}
			task := opened.Task
			submit := func(transition string, result map[string]any) {
				t.Helper()
				task, err = submitNodeResult(t, service, task, domain.ID(fmt.Sprintf("content-%d", task.Revision)), transition, result)
				if err != nil {
					t.Fatalf("submit %s: %v", transition, err)
				}
			}
			submit("requirements_ready", requirementsNodeResult("Preserve content", []string{"Staging retains the implementation record"}))
			submit("design_ready", designResultWithoutRevision("Observe effective Git content"))
			submit("tasks_plan_saved", tasksResultWithoutRevision([]map[string]any{workItem("work-a", []uint32{0}, nil)}))
			submit("tasks_ready", confirmedPlanResult(task))
			content := []byte("verified content\r\n")
			write(content)
			submit("implementation_ready_for_test", implementationResultWithoutRevision([]string{"work-a"}, false, nil))
			verifiedDigest := task.Implementation.ContentDigest
			for _, operation := range [][]string{{"add", "internal/file.go"}, {"commit", "-m", "Record verified content"}} {
				git(operation...)
				actual, err := os.ReadFile(path)
				if err != nil || !bytes.Equal(content, actual) {
					t.Fatalf("%s changed worktree bytes: %v", operation[0], err)
				}
				next, err := service.GetNextAction(ctx, GetNextActionRequest{Host: domain.HostCodex, TaskID: task.TaskID})
				if err != nil || next.CurrentNode != domain.NodeTest {
					t.Fatalf("after %s: node=%s err=%v", operation[0], next.CurrentNode, err)
				}
				stored, err := database.LoadTask(ctx, task.TaskID)
				if err != nil || stored.Implementation == nil || stored.Implementation.ContentDigest != verifiedDigest {
					t.Fatalf("after %s: implementation=%+v err=%v", operation[0], stored.Implementation, err)
				}
			}
			write([]byte("changed after verification\r\n"))
			next, err := service.GetNextAction(ctx, GetNextActionRequest{Host: domain.HostCodex, TaskID: task.TaskID})
			if err != nil || next.CurrentNode != domain.NodeImplement {
				t.Fatalf("real edit: node=%s err=%v", next.CurrentNode, err)
			}
			stored, err := database.LoadTask(ctx, task.TaskID)
			if err != nil || stored.Implementation != nil {
				t.Fatalf("real edit retained implementation=%+v err=%v", stored.Implementation, err)
			}
		})
	}
}
