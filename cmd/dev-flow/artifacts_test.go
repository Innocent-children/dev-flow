package main

import (
	"bytes"
	"context"
	"encoding/json"
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

func TestArtifactCommandsCollectRealGitFilesAndPrepareWithoutWrites(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	source, worktree := filepath.Join(root, "source"), filepath.Join(root, "task")
	git := func(directory string, args ...string) string {
		t.Helper()
		argv := []string{"-c", "user.name=Dev Flow Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgSign=false"}
		if directory != "" {
			argv = append(argv, "-C", directory)
		}
		out, err := exec.Command("git", append(argv, args...)...).CombinedOutput()
		if err != nil {
			t.Fatalf("git %v: %v %s", args, err, out)
		}
		return strings.TrimSpace(string(out))
	}
	git("", "init", "-b", "main", source)
	write := func(path, value string) {
		t.Helper()
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(value), 0644); err != nil {
			t.Fatal(err)
		}
	}
	write(filepath.Join(source, "tracked.txt"), "initial\n")
	git(source, "add", "tracked.txt")
	git(source, "commit", "-m", "initial")
	base := git(source, "rev-parse", "HEAD")
	git(source, "update-ref", "refs/remotes/origin/main", base)
	git(source, "worktree", "add", "-b", "codex/artifacts", worktree, base)
	dbPath := filepath.Join(root, databaseFileName)
	db, err := store.Open(ctx, dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	service, err := application.NewService(db, repository.NewGitObserver())
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.OpenTask(ctx, application.OpenTaskRequest{RequestID: "open-artifacts", Host: domain.HostCodex, RepositoryPath: worktree,
		WorkspaceOrigin: &application.WorkspaceOriginInput{Mode: domain.WorkspaceModeDedicatedWorktree, SourceType: "remote", RemoteName: "origin", BaseBranch: "main", BaseCommit: base, TaskBranch: "codex/artifacts", ProvisioningReceiptID: "receipt-artifacts"},
		NewTask:         &application.NewTaskInput{Request: "Collect OpenSpec files", MethodProfile: domain.MethodOpenSpec}})
	if err != nil {
		t.Fatal(err)
	}
	files := []string{"openspec/config.yaml", "openspec/changes/example/.openspec.yaml", "openspec/changes/example/README.md", "openspec/changes/example/proposal.md", "openspec/changes/example/specs/中文 文档/spec.md"}
	for _, path := range files {
		write(filepath.Join(worktree, path), "content\n")
	}
	// Leave a mix of committed, staged and untracked changes in this Action.
	git(worktree, "add", files[0])
	git(worktree, "commit", "-m", "configuration")
	git(worktree, "add", files[1])
	beforeDB, err := os.ReadFile(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	beforeHead, beforeStatus := git(worktree, "rev-parse", "HEAD"), git(worktree, "status", "--porcelain=v1", "--untracked-files=all")
	invoke := func(operation string, input any) (int, json.RawMessage) {
		t.Helper()
		raw, err := json.Marshal(input)
		if err != nil {
			t.Fatal(err)
		}
		var stdout, stderr bytes.Buffer
		code := run([]string{"artifacts", operation}, bytes.NewReader(raw), &stdout, &stderr, func(key string) string {
			if key == dataDirectoryEnvironment {
				return root
			}
			return ""
		}, unexpectedServe(t))
		var output struct {
			OK     bool            `json:"ok"`
			Result json.RawMessage `json:"result"`
			Error  json.RawMessage `json:"error"`
		}
		if json.Unmarshal(stdout.Bytes(), &output) != nil {
			t.Fatalf("stdout=%s stderr=%s", stdout.String(), stderr.String())
		}
		if code != 0 {
			return code, output.Error
		}
		return code, output.Result
	}
	r := application.CollectArtifactsRequest{Host: domain.HostCodex, TaskID: opened.Task.TaskID, ActionID: opened.Task.CurrentAction.ActionID}
	code, raw := invoke("collect", r)
	var collection application.ArtifactCollection
	if code != 0 || json.Unmarshal(raw, &collection) != nil || len(collection.Files) != 5 {
		t.Fatalf("collection=%s code=%d", raw, code)
	}
	for i := range collection.Files {
		collection.Files[i].Slot, collection.Files[i].Summary = "other_process", "Generated support file."
		if strings.HasSuffix(collection.Files[i].Path, "proposal.md") || strings.HasSuffix(collection.Files[i].Path, "spec.md") {
			collection.Files[i].Slot = "current"
		}
	}
	code, raw = invoke("prepare", application.PrepareArtifactsRequest{Host: domain.HostCodex, Collection: collection})
	var prepared application.PreparedArtifacts
	if code != 0 || json.Unmarshal(raw, &prepared) != nil || prepared.Current == nil || len(*prepared.Current) != 2 || len(prepared.OtherProcess) != 3 {
		t.Fatalf("prepared=%s code=%d", raw, code)
	}
	afterDB, _ := os.ReadFile(dbPath)
	if !bytes.Equal(beforeDB, afterDB) || beforeHead != git(worktree, "rev-parse", "HEAD") || beforeStatus != git(worktree, "status", "--porcelain=v1", "--untracked-files=all") {
		t.Fatal("read-only commands modified database or Git")
	}
	// Content changing after collection invalidates preparation, including same-path edits.
	write(filepath.Join(worktree, files[2]), "changed\n")
	code, raw = invoke("prepare", application.PrepareArtifactsRequest{Host: domain.HostCodex, Collection: collection})
	if code == 0 || !bytes.Contains(raw, []byte("WORKSPACE_OBSERVATION_UNSTABLE")) {
		t.Fatalf("stale collection=%s", raw)
	}
	git(worktree, "switch", "-c", "other-branch")
	code, raw = invoke("collect", r)
	if code == 0 || !bytes.Contains(raw, []byte("WORKSPACE_HISTORY_CONFLICT")) {
		t.Fatalf("history=%s", raw)
	}
}

func TestArtifactCommandRejectsMalformedInputWithoutCreatingDatabase(t *testing.T) {
	root := t.TempDir()
	for _, input := range []string{`null`, `{"host":"codex","host":"deepseek"}`, `{"unknown":true}`, `{} {}`, `{"host":"codex","collection":{"files":[{"slot":"current","slot":"product"}]}}`} {
		var stdout, stderr bytes.Buffer
		if code := run([]string{"artifacts", "collect"}, strings.NewReader(input), &stdout, &stderr, func(string) string { return root }, unexpectedServe(t)); code == 0 {
			t.Fatalf("accepted %s", input)
		}
	}
	if _, err := os.Stat(filepath.Join(root, databaseFileName)); !os.IsNotExist(err) {
		t.Fatal("command created database")
	}
}
