package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func TestLocalWorkspaceClaimCreationResumeAndCancellation(t *testing.T) {
	for _, mode := range []domain.WorkspaceMode{domain.WorkspaceModeNewBranch, domain.WorkspaceModeCurrentBranch} {
		t.Run(string(mode), func(t *testing.T) {
			root, err := filepath.EvalSymlinks(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			data := t.TempDir()
			git := func(args ...string) string {
				t.Helper()
				cmd := exec.Command("git", append([]string{"-C", root, "-c", "commit.gpgsign=false"}, args...)...)
				out, err := cmd.CombinedOutput()
				if err != nil {
					t.Fatalf("git %v: %v: %s", args, err, out)
				}
				return strings.TrimSpace(string(out))
			}
			git("init", "-b", "main")
			git("config", "user.name", "Workspace Test")
			git("config", "user.email", "workspace@example.invalid")
			if err := os.WriteFile(filepath.Join(root, "file.txt"), []byte("base\n"), 0o600); err != nil {
				t.Fatal(err)
			}
			git("add", "file.txt")
			git("commit", "-m", "base")
			base := git("rev-parse", "HEAD")
			check := func() application.WorkspaceAvailability {
				t.Helper()
				input, _ := json.Marshal(map[string]string{"repository_path": root})
				var out, stderr bytes.Buffer
				code := run([]string{"host-check", "workspace-available"}, bytes.NewReader(input), &out, &stderr, func(key string) string {
					if key == dataDirectoryEnvironment {
						return data
					}
					return ""
				}, unexpectedServe(t))
				var result application.WorkspaceAvailability
				if code != 0 || json.Unmarshal(out.Bytes(), &result) != nil {
					t.Fatalf("availability: code=%d out=%s error=%s", code, out.String(), stderr.String())
				}
				return result
			}
			if result := check(); !result.Available || result.RepositoryPath != root {
				t.Fatalf("unused directory: %+v", result)
			}
			if _, err := os.Stat(filepath.Join(data, databaseFileName)); !errors.Is(err, os.ErrNotExist) {
				t.Fatalf("read created storage: %v", err)
			}
			branch := "main"
			if mode == domain.WorkspaceModeNewBranch {
				branch = "feature/local"
				git("switch", "-c", branch)
			}
			if err := os.WriteFile(filepath.Join(root, "file.txt"), []byte("initial work\n"), 0o600); err != nil {
				t.Fatal(err)
			}
			ctx := context.Background()
			tasks, err := store.Open(ctx, filepath.Join(data, databaseFileName))
			if err != nil {
				t.Fatal(err)
			}
			defer tasks.Close()
			service, err := application.NewService(tasks, repository.NewGitObserver())
			if err != nil {
				t.Fatal(err)
			}
			request := application.OpenTaskRequest{RequestID: "open-local", Host: domain.HostCodex, RepositoryPath: root,
				WorkspaceOrigin: &application.WorkspaceOriginInput{Mode: mode, SourceType: "local", BaseBranch: "main", BaseCommit: base, TaskBranch: branch, ProvisioningReceiptID: "local-receipt"},
				NewTask:         &application.NewTaskInput{Request: "Work in the local directory", InitialScope: []string{"file.txt"}, KnownAcceptanceCriteria: []string{"Preserve initial work"}, MethodProfile: "plain"},
			}
			if _, err := service.OpenTask(ctx, request); !errors.Is(err, domain.ErrWorktreeProvisioningRequired) {
				t.Fatalf("unaccepted initial work: %v", err)
			}
			request.WorkspaceOrigin.CarryChanges = true
			opened, err := service.OpenTask(ctx, request)
			if err != nil {
				t.Fatal(err)
			}
			if !opened.Created || opened.Task.WorkspaceOrigin.Mode != mode || len(opened.Task.CurrentChangedPaths) != 1 {
				t.Fatalf("opened: %+v", opened)
			}
			if result := check(); result.Available || result.TaskID != opened.Task.TaskID {
				t.Fatalf("active claim: %+v", result)
			}
			if _, err := service.OpenTask(ctx, request); !errors.Is(err, domain.ErrActiveTaskConflict) {
				t.Fatalf("duplicate Task: %v", err)
			}
			if _, err := service.PrepareTaskRelocation(ctx, application.PrepareTaskRelocationRequest{RequestID: "move-local", Host: domain.HostCodex, TaskID: opened.Task.TaskID, ExpectedRevision: opened.Task.Revision}); !errors.Is(err, domain.ErrInvalidArgument) {
				t.Fatalf("local relocation: %v", err)
			}
			git("add", "file.txt")
			git("commit", "-m", "initial work")
			resumed, err := service.OpenTask(ctx, application.OpenTaskRequest{RequestID: "resume-local", Host: domain.HostCodex, RepositoryPath: root})
			if err != nil {
				t.Fatal(err)
			}
			if resumed.Task.TaskID != opened.Task.TaskID || resumed.Task.Repository.ContentDigest != opened.Task.Repository.ContentDigest {
				t.Fatal("linear commit lost Task or content identity")
			}
			git("switch", "-c", "other")
			blocked, err := service.OpenTask(ctx, application.OpenTaskRequest{RequestID: "resume-switched", Host: domain.HostCodex, RepositoryPath: root})
			if err != nil {
				t.Fatal(err)
			}
			if blocked.Task.Blocker == nil || blocked.Task.Blocker.Cause != domain.BlockerCauseWorkspaceHistoryConflict {
				t.Fatal("branch switch did not block")
			}
			git("switch", branch)
			_, err = service.CancelTask(ctx, application.CancelTaskRequest{RequestID: "cancel-local", Host: domain.HostCodex, TaskID: opened.Task.TaskID, ExpectedRevision: blocked.Task.Revision, Reason: "End the local test"})
			if err != nil {
				t.Fatal(err)
			}
			if !check().Available {
				t.Fatal("cancellation retained claim")
			}
			if git("branch", "--show-current") != branch {
				t.Fatal("cancellation changed branch")
			}
			content, _ := os.ReadFile(filepath.Join(root, "file.txt"))
			if string(content) != "initial work\n" {
				t.Fatal("cancellation changed local content")
			}
		})
	}
}
