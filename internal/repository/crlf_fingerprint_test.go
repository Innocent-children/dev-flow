package repository

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestWorkspaceObserverCRLFStagingPreservesContent(t *testing.T) {
	for _, setting := range []struct{ name, autocrlf, attributes string }{
		{"autocrlf", "true", ""},
		{"attributes-crlf", "false", "*.txt text eol=crlf\n"},
		{"attributes-lf", "false", "*.txt text eol=lf\n"},
	} {
		t.Run(setting.name, func(t *testing.T) {
			root, selection := crlfObserverRepository(t, setting.autocrlf, setting.attributes)
			observer := NewGitObserver()
			_, initial, err := observer.ObserveWorkspace(context.Background(), root, selection, nil)
			if err != nil {
				t.Fatal(err)
			}
			raw := []byte("tested\r\ncontent\r\n")
			for _, path := range []string{"tracked.txt", "new.txt"} {
				writeCRLFFile(t, root, path, raw)
			}
			tested := observeCRLFWorkspace(t, observer, root, selection, initial)
			runObserverGit(t, root, "add", "tracked.txt", "new.txt")
			indexPath := filepath.Join(root, ".git", "index")
			indexBefore, err := os.ReadFile(indexPath)
			if err != nil {
				t.Fatal(err)
			}
			staged := observeCRLFWorkspace(t, observer, root, selection, tested)
			indexAfter, err := os.ReadFile(indexPath)
			if err != nil || !bytes.Equal(indexBefore, indexAfter) {
				t.Fatalf("observation changed index: %v", err)
			}
			if tested.ContentDigest != staged.ContentDigest {
				t.Fatal("git add changed effective content without changing worktree bytes")
			}
			for _, entry := range staged.TaskSurface {
				if entry.IndexContentDigest == entry.WorktreeContentDigest || entry.ContentDigest != entry.WorktreeContentDigest {
					t.Fatalf("raw layers or normalized content lost for %s", entry.Path)
				}
			}
			runObserverGit(t, root, "commit", "-m", "tested CRLF content")
			committed := observeCRLFWorkspace(t, observer, root, selection, staged)
			if committed.ContentDigest != tested.ContentDigest || committed.HistoryRelation != domain.RepositoryHistoryLinearAdvance {
				t.Fatal("linear commit changed effective content")
			}
			for _, path := range []string{"tracked.txt", "new.txt"} {
				actual, err := os.ReadFile(filepath.Join(root, path))
				if err != nil || !bytes.Equal(actual, raw) {
					t.Fatalf("worktree bytes changed for %s: %v", path, err)
				}
			}
			writeCRLFFile(t, root, "tracked.txt", bytes.ReplaceAll(raw, []byte("\r\n"), []byte("\n")))
			lineEndingsChanged := observeCRLFWorkspace(t, observer, root, selection, committed)
			if lineEndingsChanged.ContentDigest == committed.ContentDigest {
				t.Fatal("actual worktree byte change was hidden by EOL normalization")
			}
			writeCRLFFile(t, root, "tracked.txt", []byte("different\r\ncontent\r\n"))
			changed := observeCRLFWorkspace(t, observer, root, selection, committed)
			if changed.ContentDigest == committed.ContentDigest {
				t.Fatal("real unstaged content change was hidden")
			}
			writeCRLFFile(t, root, "tracked.txt", []byte("other staged\r\ncontent\r\n"))
			runObserverGit(t, root, "add", "tracked.txt")
			writeCRLFFile(t, root, "tracked.txt", []byte("different\r\ncontent\r\n"))
			split := observeCRLFWorkspace(t, observer, root, selection, changed)
			if split.ContentDigest == changed.ContentDigest {
				t.Fatal("different staged content with identical worktree bytes was hidden")
			}
		})
	}
}

func TestWorkspaceObserverWithoutEOLConversionKeepsSplit(t *testing.T) {
	for _, attributes := range []string{"", "*.txt -text\n"} {
		t.Run(attributes, func(t *testing.T) {
			root, selection := crlfObserverRepository(t, "false", attributes)
			observer := NewGitObserver()
			_, initial, err := observer.ObserveWorkspace(context.Background(), root, selection, nil)
			if err != nil {
				t.Fatal(err)
			}
			writeCRLFFile(t, root, "tracked.txt", []byte("tested\r\ncontent\r\n"))
			tested := observeCRLFWorkspace(t, observer, root, selection, initial)
			writeCRLFFile(t, root, "tracked.txt", []byte("tested\ncontent\n"))
			runObserverGit(t, root, "add", "tracked.txt")
			writeCRLFFile(t, root, "tracked.txt", []byte("tested\r\ncontent\r\n"))
			split := observeCRLFWorkspace(t, observer, root, selection, tested)
			if split.ContentDigest == tested.ContentDigest || split.TaskSurface[0].ContentDigest == split.TaskSurface[0].WorktreeContentDigest {
				t.Fatal("LF index and CRLF worktree collapsed while conversion is disabled")
			}
		})
	}
}

func TestWorkspaceObserverIgnoredIndexFlagsKeepSplit(t *testing.T) {
	for _, flag := range []string{"--assume-unchanged", "--skip-worktree"} {
		t.Run(flag, func(t *testing.T) {
			root, selection := crlfObserverRepository(t, "false", "")
			observer := NewGitObserver()
			_, initial, err := observer.ObserveWorkspace(context.Background(), root, selection, nil)
			if err != nil {
				t.Fatal(err)
			}
			writeCRLFFile(t, root, "tracked.txt", []byte("tested\n"))
			runObserverGit(t, root, "add", "tracked.txt")
			writeCRLFFile(t, root, "tracked.txt", []byte("tested\r\n"))
			checked := observeCRLFWorkspace(t, observer, root, selection, initial)
			runObserverGit(t, root, "update-index", flag, "tracked.txt")
			if result := runObserverGit(t, root, "diff", "--name-only"); result != "" {
				t.Fatalf("index flag did not suppress worktree diff: %s", result)
			}
			unchecked := observeCRLFWorkspace(t, observer, root, selection, checked)
			if checked.ContentDigest != unchecked.ContentDigest || unchecked.TaskSurface[0].ContentDigest == unchecked.TaskSurface[0].WorktreeContentDigest {
				t.Fatal("index flag falsely collapsed LF index / CRLF worktree split")
			}
		})
	}
}

func TestGitWorktreeBlobCRLFStreamBoundaries(t *testing.T) {
	raw := []byte(strings.Repeat("a", 64*1024-1) + "\r\n" + strings.Repeat("b", 64*1024) + "\r\n\r\r\nend\r")
	for _, width := range []int{40, 64} {
		file, err := os.CreateTemp(t.TempDir(), "crlf")
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = file.Close() })
		if _, err := file.Write(raw); err != nil {
			t.Fatal(err)
		}
		if _, err := file.Seek(0, io.SeekStart); err != nil {
			t.Fatal(err)
		}
		actualRaw, actualLF, err := gitWorktreeBlob(context.Background(), int64(len(raw)), file, width, true)
		if err != nil {
			t.Fatal(err)
		}
		lf := bytes.ReplaceAll(raw, []byte("\r\n"), []byte("\n"))
		expectedRaw, _ := gitBlob(context.Background(), int64(len(raw)), bytes.NewReader(raw), width)
		expectedLF, _ := gitBlob(context.Background(), int64(len(lf)), bytes.NewReader(lf), width)
		if actualRaw != expectedRaw || actualLF != expectedLF {
			t.Fatalf("stream hashes differ: raw=%s lf=%s", actualRaw, actualLF)
		}
	}
}

func TestWorkspaceObserverCRLFModeChangePreservesSplit(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Windows does not expose Unix executable bits")
	}
	root, selection := crlfObserverRepository(t, "true", "")
	observer := NewGitObserver()
	_, initial, err := observer.ObserveWorkspace(context.Background(), root, selection, nil)
	if err != nil {
		t.Fatal(err)
	}
	writeCRLFFile(t, root, "tracked.txt", []byte("tested\r\ncontent\r\n"))
	runObserverGit(t, root, "add", "tracked.txt")
	staged := observeCRLFWorkspace(t, observer, root, selection, initial)
	runObserverGit(t, root, "config", "core.filemode", "false")
	if err := os.Chmod(filepath.Join(root, "tracked.txt"), 0o755); err != nil {
		t.Fatal(err)
	}
	changed := observeCRLFWorkspace(t, observer, root, selection, staged)
	if changed.ContentDigest == staged.ContentDigest || changed.TaskSurface[0].ContentDigest == changed.TaskSurface[0].WorktreeContentDigest {
		t.Fatal("worktree executable mode change was collapsed with EOL conversion")
	}
}

func crlfObserverRepository(t *testing.T, autocrlf, attributes string) (string, WorkspaceOriginSelection) {
	t.Helper()
	root := t.TempDir()
	runObserverGit(t, root, "init", "--initial-branch=main")
	runObserverGit(t, root, "config", "core.autocrlf", autocrlf)
	runObserverGit(t, root, "config", "core.safecrlf", "false")
	writeCRLFFile(t, root, "tracked.txt", []byte("initial\n"))
	if attributes != "" {
		writeCRLFFile(t, root, ".gitattributes", []byte(attributes))
	}
	runObserverGit(t, root, "add", ".")
	runObserverGit(t, root, "commit", "-m", "initial")
	base := runObserverGit(t, root, "rev-parse", "HEAD")
	return root, WorkspaceOriginSelection{Mode: domain.WorkspaceModeCurrentBranch, SourceType: "local", BaseBranch: "main", BaseCommit: base, TaskBranch: "main", ProvisioningReceiptID: "crlf-test"}
}

func writeCRLFFile(t *testing.T, root, path string, contents []byte) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(root, path), contents, 0o644); err != nil {
		t.Fatal(err)
	}
}

func observeCRLFWorkspace(t *testing.T, observer *GitObserver, root string, selection WorkspaceOriginSelection, previous domain.RepositoryBinding) domain.RepositoryBinding {
	t.Helper()
	_, binding, err := observer.ObserveWorkspace(context.Background(), root, selection, &previous)
	if err != nil {
		t.Fatal(err)
	}
	return binding
}
