package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	corerecovery "github.com/Innocent-children/dev-flow/internal/recovery"
)

func TestGitObserverBindingComponentsChangeIndependently(t *testing.T) {
	t.Run("branch at same commit", func(t *testing.T) {
		repositoryPath := newCommittedRepository(t, "branch-component")
		observer := NewGitObserver()
		before := observeRepository(t, observer, repositoryPath)
		runTestGit(t, repositoryPath, "checkout", "-b", "feature/component")
		after := observeRepository(t, observer, repositoryPath)
		if equalOptionalString(before.Branch, after.Branch) || before.Detached || after.Detached ||
			!equalOptionalString(before.Head, after.Head) ||
			before.WorktreeFingerprint != after.WorktreeFingerprint {
			t.Fatalf("branch component facts: before=%#v after=%#v", before, after)
		}
		assertStableRepositoryLocation(t, before, after)
		requireRepositoryRelation(t, before, after, corerecovery.RepositoryForbiddenChange)
	})

	t.Run("detached at same commit", func(t *testing.T) {
		repositoryPath := newCommittedRepository(t, "detached-component")
		observer := NewGitObserver()
		before := observeRepository(t, observer, repositoryPath)
		runTestGit(t, repositoryPath, "checkout", "--detach", "HEAD")
		after := observeRepository(t, observer, repositoryPath)
		if before.Detached || !after.Detached || before.Branch == nil || after.Branch != nil ||
			!equalOptionalString(before.Head, after.Head) ||
			before.WorktreeFingerprint != after.WorktreeFingerprint {
			t.Fatalf("detached component facts: before=%#v after=%#v", before, after)
		}
		assertStableRepositoryLocation(t, before, after)
		requireRepositoryRelation(t, before, after, corerecovery.RepositoryForbiddenChange)
	})

	t.Run("HEAD commit on same branch", func(t *testing.T) {
		repositoryPath := newCommittedRepository(t, "head-component")
		observer := NewGitObserver()
		before := observeRepository(t, observer, repositoryPath)
		writeTestFile(t, filepath.Join(repositoryPath, "tracked.txt"), "new committed content\n")
		runTestGit(t, repositoryPath, "add", "tracked.txt")
		runTestGit(t, repositoryPath, "commit", "-m", "advance HEAD")
		after := observeRepository(t, observer, repositoryPath)
		if !equalOptionalString(before.Branch, after.Branch) ||
			equalOptionalString(before.Head, after.Head) ||
			before.WorktreeFingerprint != after.WorktreeFingerprint {
			t.Fatalf("HEAD component facts: before=%#v after=%#v", before, after)
		}
		assertStableRepositoryLocation(t, before, after)
		requireRepositoryRelation(t, before, after, corerecovery.RepositoryForbiddenChange)
	})

	t.Run("unborn to born", func(t *testing.T) {
		repositoryPath := newUnbornRepository(t, "unborn-component")
		observer := NewGitObserver()
		unborn := observeRepository(t, observer, repositoryPath)
		if unborn.Head != nil || !unborn.Unborn || unborn.Detached || unborn.Branch == nil {
			t.Fatalf("unborn component = %#v", unborn)
		}
		writeTestFile(t, filepath.Join(repositoryPath, "tracked.txt"), "first commit\n")
		runTestGit(t, repositoryPath, "add", "tracked.txt")
		runTestGit(t, repositoryPath, "commit", "-m", "create born repository")
		born := observeRepository(t, observer, repositoryPath)
		if born.Head == nil || born.Unborn || born.Detached ||
			!equalOptionalString(unborn.Branch, born.Branch) ||
			unborn.WorktreeFingerprint != born.WorktreeFingerprint {
			t.Fatalf("born component = %#v, unborn=%#v", born, unborn)
		}
		assertStableRepositoryLocation(t, unborn, born)
		requireRepositoryRelation(t, unborn, born, corerecovery.RepositoryForbiddenChange)
	})
}

func TestGitObserverCleanRepositoryProducesStableBinding(t *testing.T) {
	repositoryPath := newCommittedRepository(t, "clean-repository")
	observer := NewGitObserver()

	first := observeRepository(t, observer, repositoryPath)
	second := observeRepository(t, observer, repositoryPath)

	wantRoot, err := filepath.EvalSymlinks(repositoryPath)
	if err != nil {
		t.Fatalf("resolve expected repository root: %v", err)
	}
	wantRoot, err = filepath.Abs(wantRoot)
	if err != nil {
		t.Fatalf("make expected repository root absolute: %v", err)
	}
	if first.CanonicalRoot != filepath.Clean(wantRoot) {
		t.Fatalf("canonical root = %q, want %q", first.CanonicalRoot, filepath.Clean(wantRoot))
	}
	if first.Branch == nil || *first.Branch != "main" || first.Detached {
		t.Fatalf("branch state = branch %v detached %t, want main/false", first.Branch, first.Detached)
	}
	if first.Head == nil || first.Unborn {
		t.Fatalf("HEAD state = head %v unborn %t, want committed HEAD", first.Head, first.Unborn)
	}
	if first.ObservedAt.IsZero() || first.ObservedAt.Location() != time.UTC {
		t.Fatalf("observed_at = %v, want non-zero UTC", first.ObservedAt)
	}
	if first.GitCommonDirDigest == "" || first.RepositoryIdentity == "" ||
		first.WorktreeFingerprint == "" || first.BindingDigest == "" {
		t.Fatalf("observation has an empty digest: %+v", first)
	}
	if first.BindingDigest != second.BindingDigest {
		t.Fatalf("stable observations have binding digests %q and %q", first.BindingDigest, second.BindingDigest)
	}
	if first.WorktreeFingerprint != second.WorktreeFingerprint {
		t.Fatalf("stable observations have worktree fingerprints %q and %q", first.WorktreeFingerprint, second.WorktreeFingerprint)
	}

	withDifferentObservationTime := first
	withDifferentObservationTime.ObservedAt = first.ObservedAt.Add(time.Hour)
	if got := digestRepositoryBinding(withDifferentObservationTime); got != first.BindingDigest {
		t.Fatalf("observed_at changed binding digest from %q to %q", first.BindingDigest, got)
	}
}

func TestGitObserverFingerprintsTrackedAndUntrackedChanges(t *testing.T) {
	repositoryPath := newCommittedRepository(t, "dirty-repository")
	observer := NewGitObserver()
	trackedPath := filepath.Join(repositoryPath, "tracked.txt")

	clean := observeRepository(t, observer, repositoryPath)
	writeTestFile(t, trackedPath, "changed tracked content\n")
	dirtyTracked := observeRepository(t, observer, repositoryPath)
	if dirtyTracked.WorktreeFingerprint == clean.WorktreeFingerprint ||
		dirtyTracked.BindingDigest == clean.BindingDigest ||
		!equalOptionalString(dirtyTracked.Head, clean.Head) ||
		!equalOptionalString(dirtyTracked.Branch, clean.Branch) {
		t.Fatal("tracked worktree change did not change the fingerprint")
	}
	assertStableRepositoryIdentity(t, clean, dirtyTracked)
	requireRepositoryRelation(t, clean, dirtyTracked, corerecovery.RepositoryWorktreeOnlyChanged)

	writeTestFile(t, trackedPath, "initial content\n")
	restored := observeRepository(t, observer, repositoryPath)
	if restored.WorktreeFingerprint != clean.WorktreeFingerprint || restored.BindingDigest != clean.BindingDigest {
		t.Fatalf("restored tracked binding = %#v, want %#v", restored, clean)
	}

	writeTestFile(t, filepath.Join(repositoryPath, "untracked.txt"), "untracked content\n")
	dirtyUntracked := observeRepository(t, observer, repositoryPath)
	if dirtyUntracked.WorktreeFingerprint == clean.WorktreeFingerprint {
		t.Fatal("untracked worktree change did not change the fingerprint")
	}
	if dirtyUntracked.BindingDigest == clean.BindingDigest ||
		!equalOptionalString(dirtyUntracked.Head, clean.Head) ||
		!equalOptionalString(dirtyUntracked.Branch, clean.Branch) {
		t.Fatal("untracked worktree change did not preserve visible HEAD/branch or change binding")
	}
	if dirtyUntracked.WorktreeFingerprint == dirtyTracked.WorktreeFingerprint {
		t.Fatal("tracked and untracked observations unexpectedly have the same fingerprint")
	}
	assertStableRepositoryIdentity(t, clean, dirtyUntracked)
	requireRepositoryRelation(t, clean, dirtyUntracked, corerecovery.RepositoryWorktreeOnlyChanged)
	if err := os.Remove(filepath.Join(repositoryPath, "untracked.txt")); err != nil {
		t.Fatalf("remove untracked fixture: %v", err)
	}
	restoredAgain := observeRepository(t, observer, repositoryPath)
	if restoredAgain.WorktreeFingerprint != clean.WorktreeFingerprint ||
		restoredAgain.BindingDigest != clean.BindingDigest {
		t.Fatalf("restored untracked binding = %#v, want %#v", restoredAgain, clean)
	}
}

func TestGitObserverFingerprintChangesWhenDirtyTrackedContentChangesAgain(t *testing.T) {
	repositoryPath := newCommittedRepository(t, "tracked-content-sensitive")
	trackedPath := filepath.Join(repositoryPath, "tracked.txt")
	observer := NewGitObserver()

	writeTestFile(t, trackedPath, "first dirty value with stable status\n")
	first := observeRepository(t, observer, repositoryPath)
	writeTestFile(t, trackedPath, "second dirty value with stable status\n")
	second := observeRepository(t, observer, repositoryPath)

	if first.WorktreeFingerprint == second.WorktreeFingerprint {
		t.Fatal("a second tracked content change with the same path/status did not change the fingerprint")
	}
	assertStableRepositoryIdentity(t, first, second)
}

func TestGitObserverFingerprintChangesWhenUntrackedContentChangesAgain(t *testing.T) {
	repositoryPath := newCommittedRepository(t, "untracked-content-sensitive")
	untrackedPath := filepath.Join(repositoryPath, "untracked.txt")
	observer := NewGitObserver()

	writeTestFile(t, untrackedPath, "first untracked value with stable status\n")
	first := observeRepository(t, observer, repositoryPath)
	writeTestFile(t, untrackedPath, "second untracked value with stable status\n")
	second := observeRepository(t, observer, repositoryPath)

	if first.WorktreeFingerprint == second.WorktreeFingerprint {
		t.Fatal("a second untracked content change with the same path/status did not change the fingerprint")
	}
	assertStableRepositoryIdentity(t, first, second)
}

func TestGitObserverFingerprintsDeletedAndRestoredPaths(t *testing.T) {
	repositoryPath := newCommittedRepository(t, "deleted-and-restored")
	trackedPath := filepath.Join(repositoryPath, "tracked.txt")
	observer := NewGitObserver()
	clean := observeRepository(t, observer, repositoryPath)

	if err := os.Remove(trackedPath); err != nil {
		t.Fatalf("delete tracked path: %v", err)
	}
	deleted := observeRepository(t, observer, repositoryPath)
	deletedAgain := observeRepository(t, observer, repositoryPath)
	if deleted.WorktreeFingerprint == clean.WorktreeFingerprint {
		t.Fatal("deleted tracked path did not change the fingerprint")
	}
	if deleted.WorktreeFingerprint != deletedAgain.WorktreeFingerprint {
		t.Fatal("unchanged deleted path did not produce a stable missing sentinel")
	}

	writeTestFile(t, trackedPath, "initial content\n")
	restored := observeRepository(t, observer, repositoryPath)
	if restored.WorktreeFingerprint != clean.WorktreeFingerprint {
		t.Fatalf("restored path fingerprint = %q, want clean %q", restored.WorktreeFingerprint, clean.WorktreeFingerprint)
	}
}

func TestWorktreeFingerprintNormalizesPorcelainRecordOrder(t *testing.T) {
	leftStatus := []byte("? zeta.txt\x00? alpha.txt\x00")
	rightStatus := []byte("? alpha.txt\x00? zeta.txt\x00")
	leftRecords, err := parsePorcelainV2(leftStatus)
	if err != nil {
		t.Fatalf("parse left status: %v", err)
	}
	rightRecords, err := parsePorcelainV2(rightStatus)
	if err != nil {
		t.Fatalf("parse right status: %v", err)
	}

	content := map[string]string{
		"alpha.txt": strings.Repeat("a", 40),
		"zeta.txt":  strings.Repeat("b", 40),
	}
	left := make([]worktreeFingerprintRecord, 0, len(leftRecords))
	for _, record := range leftRecords {
		left = append(left, worktreeFingerprintRecord{status: record, contentIdentity: content[record.path]})
	}
	right := make([]worktreeFingerprintRecord, 0, len(rightRecords))
	for _, record := range rightRecords {
		right = append(right, worktreeFingerprintRecord{status: record, contentIdentity: content[record.path]})
	}

	if leftDigest, rightDigest := fingerprintWorktree(left), fingerprintWorktree(right); leftDigest != rightDigest {
		t.Fatalf("equivalent reordered status produced %q and %q", leftDigest, rightDigest)
	}
	if err := ensureStatusUnchanged(leftRecords, rightRecords); err != nil {
		t.Fatalf("equivalent reordered status was treated as inconsistent: %v", err)
	}
}

func TestGitObserverHandlesCleanGitlinksAndRejectsDirtySubmodule(t *testing.T) {
	submoduleSource := newCommittedRepository(t, "submodule-source")
	repositoryPath := newCommittedRepository(t, "submodule-parent")
	observer := NewGitObserver()
	cleanBeforeAdd := observeRepository(t, observer, repositoryPath)
	runTestGit(t, repositoryPath,
		"-c", "protocol.file.allow=always",
		"submodule", "add", submoduleSource, "modules/child",
	)
	stagedAdd := observeRepository(t, observer, repositoryPath)
	if stagedAdd.WorktreeFingerprint == cleanBeforeAdd.WorktreeFingerprint {
		t.Fatal("clean staged gitlink add did not change the fingerprint")
	}

	runTestGit(t, repositoryPath, "add", ".gitmodules", "modules/child")
	runTestGit(t, repositoryPath, "commit", "-m", "add submodule")
	writeTestFile(t, filepath.Join(repositoryPath, "modules", "child", "tracked.txt"), "dirty submodule content\n")
	assertDirtySubmoduleObservation(t, repositoryPath, "dirty submodule worktree")

	runTestGit(t, filepath.Join(repositoryPath, "modules", "child"), "checkout", "--", "tracked.txt")
	cleanWithSubmodule := observeRepository(t, observer, repositoryPath)
	runTestGit(t, repositoryPath, "rm", "-f", "modules/child")
	stagedDelete := observeRepository(t, observer, repositoryPath)
	stagedDeleteAgain := observeRepository(t, observer, repositoryPath)
	if stagedDelete.WorktreeFingerprint == cleanWithSubmodule.WorktreeFingerprint {
		t.Fatal("staged gitlink delete did not change the fingerprint")
	}
	if stagedDelete.WorktreeFingerprint != stagedDeleteAgain.WorktreeFingerprint {
		t.Fatal("unchanged staged gitlink delete did not use a stable missing sentinel")
	}
}

func assertDirtySubmoduleObservation(t *testing.T, repositoryPath, state string) {
	t.Helper()
	_, err := NewGitObserver().Observe(context.Background(), repositoryPath)
	if !errors.Is(err, ErrDirtySubmodule) {
		t.Fatalf("%s error = %v, want ErrDirtySubmodule", state, err)
	}
	if !errors.Is(err, ErrGitObservation) {
		t.Fatalf("%s error = %v, want it also to match ErrGitObservation", state, err)
	}
}

func TestPorcelainPathLimitIsEnforcedBeforeContentHashing(t *testing.T) {
	var status bytes.Buffer
	for index := 0; index <= domain.MaxFingerprintPaths; index++ {
		_, _ = fmt.Fprintf(&status, "? path-%04d.txt%c", index, byte(0))
	}

	if _, err := parsePorcelainV2(status.Bytes()); !errors.Is(err, ErrFingerprintPathLimit) {
		t.Fatalf("path-limit error = %v, want ErrFingerprintPathLimit", err)
	}
}

func TestGitObserverBindingDoesNotExposeRawStatusOrContent(t *testing.T) {
	repositoryPath := newCommittedRepository(t, "no-raw-content")
	const rawContent = "private source bytes that must never leave the observer 7b58d79d"
	const rawPath = "private source 名称.txt"
	writeTestFile(t, filepath.Join(repositoryPath, rawPath), rawContent)

	binding := observeRepository(t, NewGitObserver(), repositoryPath)
	encoded, err := json.Marshal(binding)
	if err != nil {
		t.Fatalf("encode binding: %v", err)
	}
	if bytes.Contains(encoded, []byte(rawContent)) || bytes.Contains(encoded, []byte(rawPath)) ||
		bytes.Contains(encoded, []byte("? "+rawPath)) {
		t.Fatalf("binding exposed raw status, path, or content: %s", encoded)
	}
}

func TestFingerprintPathValidationFailsClosed(t *testing.T) {
	repositoryPath := newCommittedRepository(t, "path-validation")
	canonicalRoot, err := filepath.EvalSymlinks(repositoryPath)
	if err != nil {
		t.Fatalf("resolve repository root: %v", err)
	}

	t.Run("missing after status", func(t *testing.T) {
		records, err := parsePorcelainV2([]byte("? disappeared.txt\x00"))
		if err != nil {
			t.Fatalf("parse status: %v", err)
		}
		if _, err := prepareFingerprintPaths(canonicalRoot, records); !errors.Is(err, ErrInconsistentWorktree) {
			t.Fatalf("missing path error = %v, want ErrInconsistentWorktree", err)
		}
	})

	t.Run("non-ordinary path", func(t *testing.T) {
		if runtime.GOOS == "windows" {
			t.Skip("symlink creation is not reliably available without elevated privileges")
		}
		if err := os.Symlink("tracked.txt", filepath.Join(repositoryPath, "linked.txt")); err != nil {
			t.Fatalf("create symlink: %v", err)
		}
		records, err := parsePorcelainV2([]byte("? linked.txt\x00"))
		if err != nil {
			t.Fatalf("parse status: %v", err)
		}
		if _, err := prepareFingerprintPaths(canonicalRoot, records); !errors.Is(err, ErrInconsistentWorktree) {
			t.Fatalf("non-ordinary path error = %v, want ErrInconsistentWorktree", err)
		}
	})

	t.Run("outside repository", func(t *testing.T) {
		records, err := parsePorcelainV2([]byte("? ../outside.txt\x00"))
		if err != nil {
			t.Fatalf("parse status: %v", err)
		}
		if _, err := prepareFingerprintPaths(canonicalRoot, records); !errors.Is(err, ErrInconsistentWorktree) {
			t.Fatalf("outside path error = %v, want ErrInconsistentWorktree", err)
		}
	})

	t.Run("changed after initial validation", func(t *testing.T) {
		path := filepath.Join(repositoryPath, "late-change.txt")
		writeTestFile(t, path, "before\n")
		records, err := parsePorcelainV2([]byte("? late-change.txt\x00"))
		if err != nil {
			t.Fatalf("parse status: %v", err)
		}
		states, err := prepareFingerprintPaths(canonicalRoot, records)
		if err != nil {
			t.Fatalf("prepare fingerprint path: %v", err)
		}
		writeTestFile(t, path, "different size after validation\n")
		if err := verifyFingerprintPaths(canonicalRoot, states); !errors.Is(err, ErrInconsistentWorktree) {
			t.Fatalf("late path change error = %v, want ErrInconsistentWorktree", err)
		}
	})
}

func TestSecondStatusMismatchFailsWithoutRetry(t *testing.T) {
	first, err := parsePorcelainV2([]byte("? path.txt\x00"))
	if err != nil {
		t.Fatalf("parse first status: %v", err)
	}
	second, err := parsePorcelainV2([]byte("? other.txt\x00"))
	if err != nil {
		t.Fatalf("parse second status: %v", err)
	}
	if err := ensureStatusUnchanged(first, second); !errors.Is(err, ErrInconsistentWorktree) {
		t.Fatalf("status mismatch error = %v, want ErrInconsistentWorktree", err)
	}
}

func TestGitObserverDetachedHead(t *testing.T) {
	repositoryPath := newCommittedRepository(t, "detached-repository")
	runTestGit(t, repositoryPath, "checkout", "--detach", "HEAD")

	binding := observeRepository(t, NewGitObserver(), repositoryPath)
	if !binding.Detached || binding.Branch != nil {
		t.Fatalf("branch state = branch %v detached %t, want nil/true", binding.Branch, binding.Detached)
	}
	if binding.Head == nil || binding.Unborn {
		t.Fatalf("HEAD state = head %v unborn %t, want detached committed HEAD", binding.Head, binding.Unborn)
	}
}

func TestGitObserverUnbornRepository(t *testing.T) {
	repositoryPath := newUnbornRepository(t, "unborn-repository")

	binding := observeRepository(t, NewGitObserver(), repositoryPath)
	wantBranch := strings.TrimSpace(runTestGit(t, repositoryPath, "symbolic-ref", "--short", "HEAD"))
	if binding.Branch == nil || *binding.Branch != wantBranch || binding.Detached {
		t.Fatalf("branch state = branch %v detached %t, want Git-reported %q/false", binding.Branch, binding.Detached, wantBranch)
	}
	if binding.Head != nil || !binding.Unborn {
		t.Fatalf("HEAD state = head %v unborn %t, want nil/true", binding.Head, binding.Unborn)
	}
	if binding.WorktreeFingerprint == "" || binding.BindingDigest == "" {
		t.Fatal("unborn repository did not receive stable digests")
	}
}

func TestGitObserverCanonicalizesSpacedAndUnicodePaths(t *testing.T) {
	tests := []struct {
		name       string
		directory  string
		useSubpath bool
	}{
		{name: "spaces", directory: "repository with spaces", useSubpath: true},
		{name: "Unicode", directory: "仓库-Δ"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repositoryPath := newCommittedRepository(t, test.directory)
			observationPath := repositoryPath
			if test.useSubpath {
				observationPath = filepath.Join(repositoryPath, "nested directory")
				if err := os.Mkdir(observationPath, 0o755); err != nil {
					t.Fatalf("create nested observation directory: %v", err)
				}
			}

			binding := observeRepository(t, NewGitObserver(), observationPath)
			wantRoot, err := filepath.EvalSymlinks(repositoryPath)
			if err != nil {
				t.Fatalf("resolve expected root: %v", err)
			}
			wantRoot, err = filepath.Abs(wantRoot)
			if err != nil {
				t.Fatalf("make expected root absolute: %v", err)
			}
			if binding.CanonicalRoot != filepath.Clean(wantRoot) {
				t.Fatalf("canonical root = %q, want %q", binding.CanonicalRoot, filepath.Clean(wantRoot))
			}
		})
	}
}

func TestGitObserverResolvesSymlinkedRepositoryPath(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink creation is not reliably available without elevated privileges")
	}

	repositoryPath := newCommittedRepository(t, "symlink-target")
	linkPath := filepath.Join(t.TempDir(), "repository-link")
	if err := os.Symlink(repositoryPath, linkPath); err != nil {
		t.Fatalf("create repository symlink: %v", err)
	}

	direct := observeRepository(t, NewGitObserver(), repositoryPath)
	linked := observeRepository(t, NewGitObserver(), linkPath)
	if linked.CanonicalRoot != direct.CanonicalRoot {
		t.Fatalf("symlink root = %q, direct root = %q", linked.CanonicalRoot, direct.CanonicalRoot)
	}
	if linked.RepositoryIdentity != direct.RepositoryIdentity || linked.BindingDigest != direct.BindingDigest {
		t.Fatalf("symlink observation did not converge on direct identity: linked=%+v direct=%+v", linked, direct)
	}
}

func TestGitObserverDisappearanceAndSamePathReplacement(t *testing.T) {
	root := t.TempDir()
	repositoryPath := filepath.Join(root, "repository")
	runTestGit(t, "", "init", repositoryPath)
	writeTestFile(t, filepath.Join(repositoryPath, "tracked.txt"), "repository A\n")
	runTestGit(t, repositoryPath, "add", "tracked.txt")
	runTestGit(t, repositoryPath, "commit", "-m", "repository A")
	observer := NewGitObserver()
	original := observeRepository(t, observer, repositoryPath)

	movedPath := filepath.Join(root, "repository-a-moved")
	if err := os.Rename(repositoryPath, movedPath); err != nil {
		t.Fatalf("move repository A fixture: %v", err)
	}
	if _, err := observer.Observe(context.Background(), repositoryPath); err == nil {
		t.Fatal("missing repository path produced an observation")
	}
	if _, err := os.Stat(repositoryPath); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("Core observation recreated the missing path: %v", err)
	}

	replacementCommonDirectory := filepath.Join(root, "repository-b.git")
	runTestGit(t, "", "init", "--separate-git-dir", replacementCommonDirectory, repositoryPath)
	writeTestFile(t, filepath.Join(repositoryPath, "tracked.txt"), "repository B\n")
	runTestGit(t, repositoryPath, "add", "tracked.txt")
	runTestGit(t, repositoryPath, "commit", "-m", "repository B")
	replacement := observeRepository(t, observer, repositoryPath)
	if replacement.CanonicalRoot != original.CanonicalRoot ||
		replacement.GitCommonDirDigest == original.GitCommonDirDigest ||
		replacement.RepositoryIdentity == original.RepositoryIdentity ||
		replacement.BindingDigest == original.BindingDigest {
		t.Fatalf("same-path replacement was not distinguished: original=%#v replacement=%#v", original, replacement)
	}
}

func TestGitObserverRejectsNonRepositoryAndOversizedPath(t *testing.T) {
	observer := NewGitObserver()

	if _, err := observer.Observe(context.Background(), t.TempDir()); !errors.Is(err, ErrNotGitRepository) {
		t.Fatalf("non-repository error = %v, want ErrNotGitRepository", err)
	}
	oversizedPath := strings.Repeat("x", int(domain.MaxRepositoryPathBytes)+1)
	if _, err := observer.Observe(context.Background(), oversizedPath); !errors.Is(err, ErrInvalidRepositoryPath) {
		t.Fatalf("oversized path error = %v, want ErrInvalidRepositoryPath", err)
	}
}

func TestGitObserverBoundedOutputFailureWithoutStress(t *testing.T) {
	repositoryPath := newCommittedRepository(t, "bounded-output")
	observer := &GitObserver{runner: gitCommandRunner{
		timeout:     domain.GitCommandTimeout,
		outputLimit: 1,
	}}

	if _, err := observer.Observe(context.Background(), repositoryPath); !errors.Is(err, ErrGitOutputLimit) {
		t.Fatalf("bounded-output error = %v, want ErrGitOutputLimit", err)
	}
}

func TestGitObserverTimeoutAndCancellationFailures(t *testing.T) {
	repositoryPath := newCommittedRepository(t, "command-context")

	t.Run("Core timeout", func(t *testing.T) {
		observer := &GitObserver{runner: gitCommandRunner{
			timeout:     0,
			outputLimit: int64(domain.MaxGitCommandOutputBytes),
		}}
		if _, err := observer.Observe(context.Background(), repositoryPath); !errors.Is(err, ErrGitCommandTimeout) {
			t.Fatalf("timeout error = %v, want ErrGitCommandTimeout", err)
		}
	})

	t.Run("caller cancellation", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		if _, err := NewGitObserver().Observe(ctx, repositoryPath); !errors.Is(err, context.Canceled) {
			t.Fatalf("cancellation error = %v, want context.Canceled", err)
		}
	})
}

func TestGitObserverUsesCoreLimitsAndReadOnlyAllowlist(t *testing.T) {
	observer := NewGitObserver()
	if observer.runner.timeout != domain.GitCommandTimeout {
		t.Fatalf("timeout = %v, want Core limit %v", observer.runner.timeout, domain.GitCommandTimeout)
	}
	if observer.runner.outputLimit != int64(domain.MaxGitCommandOutputBytes) {
		t.Fatalf("output limit = %d, want Core limit %d", observer.runner.outputLimit, domain.MaxGitCommandOutputBytes)
	}

	wantSubcommand := map[gitReadCommand]string{
		gitShowWorktreeRoot:    "rev-parse",
		gitShowCommonDirectory: "rev-parse",
		gitShowBranch:          "symbolic-ref",
		gitShowHead:            "rev-parse",
		gitShowStatus:          "status",
		gitHashObject:          "hash-object",
	}
	for command, want := range wantSubcommand {
		path := ""
		if command == gitHashObject {
			path = "path beginning - safely.txt"
		}
		args, ok := command.arguments("/fixed/repository", path)
		if !ok {
			t.Fatalf("allowlisted command %d was rejected", command)
		}
		if len(args) < 8 || args[7] != want {
			t.Fatalf("command %d arguments = %q, want subcommand %q", command, args, want)
		}
		for _, argument := range args {
			if argument == "-w" || argument == "diff" {
				t.Fatalf("read-only command %d contains forbidden argument %q: %q", command, argument, args)
			}
		}
		if command == gitHashObject {
			wantSuffix := []string{"hash-object", "--no-filters", "--", path}
			if got := args[len(args)-len(wantSuffix):]; !equalStrings(got, wantSuffix) {
				t.Fatalf("hash-object suffix = %q, want %q", got, wantSuffix)
			}
		}
	}
	statusArgs, _ := gitShowStatus.arguments("/fixed/repository", "")
	if !containsString(statusArgs, "--ignore-submodules=none") {
		t.Fatalf("status arguments do not force dirty-submodule observation: %q", statusArgs)
	}
	if _, ok := gitReadCommand(255).arguments("/fixed/repository", ""); ok {
		t.Fatal("unknown Git command was accepted by the allowlist")
	}
}

func equalStrings(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func assertStableRepositoryIdentity(t *testing.T, before, after domain.RepositoryBinding) {
	t.Helper()
	if before.CanonicalRoot != after.CanonicalRoot ||
		before.GitCommonDirDigest != after.GitCommonDirDigest ||
		before.RepositoryIdentity != after.RepositoryIdentity ||
		before.Detached != after.Detached || before.Unborn != after.Unborn ||
		!equalOptionalString(before.Branch, after.Branch) || !equalOptionalString(before.Head, after.Head) {
		t.Fatalf("worktree-only change altered repository identity/state: before=%+v after=%+v", before, after)
	}
}

func assertStableRepositoryLocation(t *testing.T, before, after domain.RepositoryBinding) {
	t.Helper()
	if before.CanonicalRoot != after.CanonicalRoot ||
		before.GitCommonDirDigest != after.GitCommonDirDigest ||
		before.RepositoryIdentity != after.RepositoryIdentity {
		t.Fatalf("repository location identity changed: before=%#v after=%#v", before, after)
	}
}

func requireRepositoryRelation(
	t *testing.T,
	before domain.RepositoryBinding,
	after domain.RepositoryBinding,
	want corerecovery.RepositoryRelation,
) {
	t.Helper()
	relation, err := corerecovery.CompareRepositoryBindings(before, after)
	if err != nil || relation != want || before.BindingDigest == after.BindingDigest {
		t.Fatalf("repository relation = %q/%v, want %q; before=%#v after=%#v", relation, err, want, before, after)
	}
}

func equalOptionalString(left, right *string) bool {
	if left == nil || right == nil {
		return left == right
	}
	return *left == *right
}

func observeRepository(t *testing.T, observer RepositoryObserver, repositoryPath string) domain.RepositoryBinding {
	t.Helper()
	binding, err := observer.Observe(context.Background(), repositoryPath)
	if err != nil {
		t.Fatalf("observe repository %q: %v", repositoryPath, err)
	}
	if err := binding.Validate(); err != nil {
		t.Fatalf("validate repository binding: %v", err)
	}
	return binding
}

func newCommittedRepository(t *testing.T, directory string) string {
	t.Helper()
	repositoryPath := newUnbornRepository(t, directory)
	writeTestFile(t, filepath.Join(repositoryPath, "tracked.txt"), "initial content\n")
	runTestGit(t, repositoryPath, "add", "tracked.txt")
	runTestGit(t, repositoryPath, "commit", "-m", "initial commit")
	return repositoryPath
}

func newUnbornRepository(t *testing.T, directory string) string {
	t.Helper()
	if _, err := exec.LookPath(gitExecutable); err != nil {
		t.Skip("git executable is unavailable")
	}
	repositoryPath := filepath.Join(t.TempDir(), directory)
	runTestGit(t, "", "init", repositoryPath)
	return repositoryPath
}

func runTestGit(t *testing.T, repositoryPath string, arguments ...string) string {
	t.Helper()
	args := []string{
		"-c", "user.name=Dev Flow Test",
		"-c", "user.email=dev-flow@example.invalid",
		"-c", "commit.gpgSign=false",
		"-c", "init.defaultBranch=main",
		"-c", "init.templateDir=",
	}
	if repositoryPath != "" {
		args = append(args, "-C", repositoryPath)
	}
	args = append(args, arguments...)
	cmd := exec.Command(gitExecutable, args...)
	cmd.Env = gitEnvironment(os.Environ())
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %q failed: %v\n%s", arguments, err, output)
	}
	return string(output)
}

func writeTestFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write test file %q: %v", path, err)
	}
}
