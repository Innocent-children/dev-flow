package repository

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestWorkspaceObserverTracksIndexWorktreeAndCommitInvariant(t *testing.T) {
	source, worktree, selection := provisionObserverWorktree(t)
	observer := NewGitObserver()
	origin, initial, err := observer.ObserveWorkspace(context.Background(), worktree, selection, nil)
	if err != nil {
		t.Fatal(err)
	}
	if initial.ContentDigest == "" || len(initial.TaskSurface) != 0 || initial.HistoryRelation != "exact" {
		t.Fatalf("initial=%+v", initial)
	}

	file := filepath.Join(worktree, "tracked.txt")
	if err := os.WriteFile(file, []byte("task content\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runObserverGit(t, worktree, "add", "tracked.txt")
	_, staged, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &initial)
	if err != nil || len(staged.TaskSurface) != 1 {
		t.Fatalf("staged=%+v err=%v", staged, err)
	}
	if staged.TaskSurface[0].IndexContentDigest != staged.TaskSurface[0].WorktreeContentDigest {
		t.Fatal("equal index and worktree content produced different layer digests")
	}

	if err := os.WriteFile(file, []byte("initial\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, split, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &initial)
	if err != nil || len(split.TaskSurface) != 1 || split.ContentDigest == initial.ContentDigest {
		t.Fatalf("split layers disappeared: %+v err=%v", split, err)
	}
	if split.TaskSurface[0].IndexContentDigest == split.TaskSurface[0].WorktreeContentDigest {
		t.Fatal("staged and restored worktree layers collapsed")
	}

	if err := os.WriteFile(file, []byte("task content\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, beforeCommit, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &initial)
	if err != nil {
		t.Fatal(err)
	}
	runObserverGit(t, worktree, "commit", "-m", "task content")
	_, afterCommit, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &beforeCommit)
	if err != nil {
		t.Fatal(err)
	}
	if afterCommit.HistoryRelation != "linear_advance" || beforeCommit.ContentDigest != afterCommit.ContentDigest || len(afterCommit.TaskSurface) != 1 {
		t.Fatalf("commit invariant before=%+v after=%+v", beforeCommit, afterCommit)
	}
	if origin.BaseCommit != selection.BaseCommit || afterCommit.CurrentHead == selection.BaseCommit {
		t.Fatal("base was not frozen across commit")
	}

	if err := os.WriteFile(filepath.Join(source, "remote.txt"), []byte("remote\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runObserverGit(t, source, "add", "remote.txt")
	runObserverGit(t, source, "commit", "-m", "advance remote")
	runObserverGit(t, source, "push", "origin", "main")
	runObserverGit(t, worktree, "fetch", "origin", "refs/heads/main:refs/remotes/origin/main")
	if _, _, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &afterCommit); err != nil {
		t.Fatalf("advanced remote invalidated frozen base: %v", err)
	}
}

func TestWorkspaceObserverUnstagedContentSurvivesAddAndCommit(t *testing.T) {
	_, worktree, selection := provisionObserverWorktree(t)
	observer := NewGitObserver()
	_, initial, err := observer.ObserveWorkspace(context.Background(), worktree, selection, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(worktree, "tracked.txt"), []byte("tested content\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, tested, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &initial)
	if err != nil {
		t.Fatal(err)
	}
	runObserverGit(t, worktree, "add", "tracked.txt")
	runObserverGit(t, worktree, "commit", "-m", "tested content")
	_, committed, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &tested)
	if err != nil {
		t.Fatal(err)
	}
	if tested.ContentDigest != committed.ContentDigest {
		t.Fatalf("content digest changed only because content was staged and committed: %s != %s", tested.ContentDigest, committed.ContentDigest)
	}
}

func TestWorkspaceObserverRejectsUnsafeOriginAndClassifiesBranchChange(t *testing.T) {
	_, worktree, selection := provisionObserverWorktree(t)
	observer := NewGitObserver()
	_, initial, err := observer.ObserveWorkspace(context.Background(), worktree, selection, nil)
	if err != nil {
		t.Fatal(err)
	}
	unsafe := selection
	unsafe.BaseBranch = "main^{tree}"
	if _, _, err := observer.ObserveWorkspace(context.Background(), worktree, unsafe, nil); !errors.Is(err, ErrProvisioningRequired) {
		t.Fatalf("unsafe ref error=%v", err)
	}
	runObserverGit(t, worktree, "switch", "-c", "other")
	_, changed, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &initial)
	if err != nil || changed.HistoryRelation != "branch_changed" {
		t.Fatalf("branch relation=%s err=%v", changed.HistoryRelation, err)
	}
}

func TestWorkspaceObserverGitlinkDigestTracksStagedObjectID(t *testing.T) {
	_, worktree, selection := provisionObserverWorktree(t)
	root := t.TempDir()
	remote := filepath.Join(root, "module.git")
	source := filepath.Join(root, "module-source")
	runObserverGit(t, "", "init", "--bare", remote)
	runObserverGit(t, "", "clone", remote, source)
	runObserverGit(t, source, "switch", "-c", "main")
	if err := os.WriteFile(filepath.Join(source, "module.txt"), []byte("one\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runObserverGit(t, source, "add", "module.txt")
	runObserverGit(t, source, "commit", "-m", "module one")
	runObserverGit(t, source, "push", "-u", "origin", "main")
	runObserverGit(t, worktree, "-c", "protocol.file.allow=always", "submodule", "add", remote, "module")
	observer := NewGitObserver()
	_, _, err := observer.ObserveWorkspace(context.Background(), worktree, selection, nil)
	if err == nil {
		t.Fatal("initial provisioning accepted a staged submodule addition")
	}
	// Establish the staged addition as the Task's first observed content by using
	// a clean initial observation followed by the submodule work below.
	runObserverGit(t, worktree, "commit", "-m", "add module")
	if _, _, err := observer.ObserveWorkspace(context.Background(), worktree, selection, nil); err == nil {
		t.Fatal("initial provisioning accepted HEAD beyond the frozen base")
	}
	// The fixed base deliberately predates the submodule, so reopening is not a
	// provisioning operation; observe it relative to a retained binding.
	selection.BaseCommit = runObserverGit(t, worktree, "rev-parse", "HEAD")
	runObserverGit(t, worktree, "update-ref", "refs/remotes/origin/main", selection.BaseCommit)
	_, baseline, err := observer.ObserveWorkspace(context.Background(), worktree, selection, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(source, "module.txt"), []byte("two\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runObserverGit(t, source, "add", "module.txt")
	runObserverGit(t, source, "commit", "-m", "module two")
	runObserverGit(t, source, "push", "origin", "main")
	runObserverGit(t, filepath.Join(worktree, "module"), "fetch", remote, "main")
	runObserverGit(t, filepath.Join(worktree, "module"), "checkout", "FETCH_HEAD")
	runObserverGit(t, worktree, "add", "module")
	_, changed, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &baseline)
	if err != nil {
		t.Fatal(err)
	}
	var gitlink *domain.RepositoryChangedEntry
	for i := range changed.TaskSurface {
		if changed.TaskSurface[i].Path == "module" {
			gitlink = &changed.TaskSurface[i]
		}
	}
	if gitlink == nil || !gitlink.Gitlink || gitlink.FileMode != "160000" || changed.ContentDigest == baseline.ContentDigest {
		t.Fatalf("gitlink=%+v", gitlink)
	}
}

func TestWorkspaceObserverCurrentSurfaceDropsRestoredPathsAndNormalizesRename(t *testing.T) {
	_, worktree, selection := provisionObserverWorktree(t)
	observer := NewGitObserver()
	_, initial, err := observer.ObserveWorkspace(context.Background(), worktree, selection, nil)
	if err != nil {
		t.Fatal(err)
	}
	untracked := filepath.Join(worktree, "new.txt")
	if err := os.WriteFile(untracked, []byte("new\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, added, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &initial)
	if err != nil || len(added.TaskSurface) != 1 || added.TaskSurface[0].ChangeType != domain.RepositoryChangeAdded {
		t.Fatalf("added=%+v err=%v", added.TaskSurface, err)
	}
	if err := os.Remove(untracked); err != nil {
		t.Fatal(err)
	}
	_, restored, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &initial)
	if err != nil || len(restored.TaskSurface) != 0 || restored.ContentDigest != initial.ContentDigest {
		t.Fatalf("restored=%+v err=%v", restored.TaskSurface, err)
	}

	oldPath := filepath.Join(worktree, "tracked.txt")
	newPath := filepath.Join(worktree, "renamed.txt")
	if err := os.Rename(oldPath, newPath); err != nil {
		t.Fatal(err)
	}
	_, renamed, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &initial)
	if err != nil || len(renamed.TaskSurface) != 2 {
		t.Fatalf("rename=%+v err=%v", renamed.TaskSurface, err)
	}
	if renamed.TaskSurface[0].Path != "renamed.txt" || renamed.TaskSurface[0].ChangeType != domain.RepositoryChangeAdded || renamed.TaskSurface[1].Path != "tracked.txt" || renamed.TaskSurface[1].ChangeType != domain.RepositoryChangeDeleted {
		t.Fatalf("rename was not delete+add: %+v", renamed.TaskSurface)
	}
	if err := os.Rename(newPath, oldPath); err != nil {
		t.Fatal(err)
	}
	_, restored, err = observer.ObserveWorkspace(context.Background(), worktree, selection, &initial)
	if err != nil || len(restored.TaskSurface) != 0 {
		t.Fatalf("rename restore=%+v err=%v", restored.TaskSurface, err)
	}
}

func TestWorkspaceObserverClassifiesLinearRewindRewriteAndDetached(t *testing.T) {
	_, worktree, selection := provisionObserverWorktree(t)
	observer := NewGitObserver()
	_, initial, err := observer.ObserveWorkspace(context.Background(), worktree, selection, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(worktree, "one.txt"), []byte("one\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runObserverGit(t, worktree, "add", "one.txt")
	runObserverGit(t, worktree, "commit", "-m", "one")
	_, linear, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &initial)
	if err != nil || linear.HistoryRelation != domain.RepositoryHistoryLinearAdvance {
		t.Fatalf("linear=%s err=%v", linear.HistoryRelation, err)
	}
	runObserverGit(t, worktree, "reset", "--hard", selection.BaseCommit)
	_, rewind, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &linear)
	if err != nil || rewind.HistoryRelation != domain.RepositoryHistoryRewind {
		t.Fatalf("rewind=%s err=%v", rewind.HistoryRelation, err)
	}
	if err := os.WriteFile(filepath.Join(worktree, "two.txt"), []byte("two\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runObserverGit(t, worktree, "add", "two.txt")
	runObserverGit(t, worktree, "commit", "-m", "two")
	_, rewrite, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &linear)
	if err != nil || rewrite.HistoryRelation != domain.RepositoryHistoryRewrite {
		t.Fatalf("rewrite=%s err=%v", rewrite.HistoryRelation, err)
	}
	runObserverGit(t, worktree, "checkout", "--detach", "HEAD")
	_, detached, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &rewrite)
	if err != nil || detached.HistoryRelation != domain.RepositoryHistoryDetached {
		t.Fatalf("detached=%s err=%v", detached.HistoryRelation, err)
	}
}

func TestWorkspaceObserverSamePathReplacementChangesInstance(t *testing.T) {
	source, worktree, selection := provisionObserverWorktree(t)
	observer := NewGitObserver()
	_, initial, err := observer.ObserveWorkspace(context.Background(), worktree, selection, nil)
	if err != nil {
		t.Fatal(err)
	}
	runObserverGit(t, source, "worktree", "remove", "--force", worktree)
	runObserverGit(t, source, "worktree", "add", worktree, selection.TaskBranch)
	_, replacement, err := observer.ObserveWorkspace(context.Background(), worktree, selection, &initial)
	if err != nil {
		t.Fatal(err)
	}
	if replacement.WorktreeInstanceDigest == initial.WorktreeInstanceDigest {
		t.Fatal("same-path replacement preserved worktree instance identity")
	}
}

func TestWorkspaceObserverRejectsDirtySubmoduleAndUnstableSecondPass(t *testing.T) {
	first, err := parsePorcelainV2([]byte("? one.txt\x00"))
	if err != nil {
		t.Fatal(err)
	}
	second, err := parsePorcelainV2([]byte("? two.txt\x00"))
	if err != nil {
		t.Fatal(err)
	}
	if !errors.Is(ensureStatusUnchanged(first, second), ErrInconsistentWorktree) {
		t.Fatal("two-pass status mismatch was accepted")
	}

	_, worktree, selection := provisionObserverWorktree(t)
	root := t.TempDir()
	remote := filepath.Join(root, "dirty.git")
	source := filepath.Join(root, "dirty-source")
	runObserverGit(t, "", "init", "--bare", remote)
	runObserverGit(t, "", "clone", remote, source)
	runObserverGit(t, source, "switch", "-c", "main")
	if err := os.WriteFile(filepath.Join(source, "file.txt"), []byte("base\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runObserverGit(t, source, "add", "file.txt")
	runObserverGit(t, source, "commit", "-m", "base")
	runObserverGit(t, source, "push", "-u", "origin", "main")
	runObserverGit(t, worktree, "-c", "protocol.file.allow=always", "submodule", "add", remote, "dirty-module")
	runObserverGit(t, worktree, "commit", "-m", "add dirty module")
	selection.BaseCommit = runObserverGit(t, worktree, "rev-parse", "HEAD")
	runObserverGit(t, worktree, "update-ref", "refs/remotes/origin/main", selection.BaseCommit)
	_, clean, err := NewGitObserver().ObserveWorkspace(context.Background(), worktree, selection, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(worktree, "dirty-module", "file.txt"), []byte("dirty\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, _, err := NewGitObserver().ObserveWorkspace(context.Background(), worktree, selection, &clean); !errors.Is(err, ErrDirtySubmodule) && !errors.Is(err, ErrGitObservation) {
		t.Fatalf("dirty submodule error=%v", err)
	}
}

func provisionObserverWorktree(t *testing.T) (string, string, WorkspaceOriginSelection) {
	t.Helper()
	root := t.TempDir()
	remote := filepath.Join(root, "remote.git")
	source := filepath.Join(root, "source")
	worktree := filepath.Join(root, "task")
	runObserverGit(t, "", "init", "--bare", remote)
	runObserverGit(t, "", "clone", remote, source)
	runObserverGit(t, source, "switch", "-c", "main")
	if err := os.WriteFile(filepath.Join(source, "tracked.txt"), []byte("initial\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runObserverGit(t, source, "add", "tracked.txt")
	runObserverGit(t, source, "commit", "-m", "initial")
	runObserverGit(t, source, "push", "-u", "origin", "main")
	base := runObserverGit(t, source, "rev-parse", "HEAD")
	runObserverGit(t, source, "worktree", "add", "-b", "feature/task", worktree, base)
	return source, worktree, WorkspaceOriginSelection{Mode: "dedicated_worktree", RemoteName: "origin", BaseBranch: "main", BaseCommit: base, TaskBranch: "feature/task", ProvisioningReceiptID: "receipt-test"}
}

func runObserverGit(t *testing.T, directory string, args ...string) string {
	t.Helper()
	command := []string{"-c", "user.name=Dev Flow Test", "-c", "user.email=dev-flow@example.invalid", "-c", "commit.gpgSign=false"}
	if directory != "" {
		command = append(command, "-C", directory)
	}
	command = append(command, args...)
	output, err := exec.Command(gitExecutable, command...).CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v: %s", args, err, output)
	}
	return string(bytesTrimSpace(output))
}

func bytesTrimSpace(value []byte) []byte {
	start, end := 0, len(value)
	for start < end && (value[start] == '\n' || value[start] == '\r' || value[start] == ' ' || value[start] == '\t') {
		start++
	}
	for end > start && (value[end-1] == '\n' || value[end-1] == '\r' || value[end-1] == ' ' || value[end-1] == '\t') {
		end--
	}
	return value[start:end]
}
