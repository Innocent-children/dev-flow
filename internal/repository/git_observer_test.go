package repository

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

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
	if dirtyTracked.WorktreeFingerprint == clean.WorktreeFingerprint {
		t.Fatal("tracked worktree change did not change the fingerprint")
	}
	if dirtyTracked.BindingDigest == clean.BindingDigest {
		t.Fatal("tracked worktree change did not change the binding digest")
	}
	assertStableRepositoryIdentity(t, clean, dirtyTracked)

	writeTestFile(t, trackedPath, "initial content\n")
	restored := observeRepository(t, observer, repositoryPath)
	if restored.WorktreeFingerprint != clean.WorktreeFingerprint {
		t.Fatalf("restored worktree fingerprint = %q, want %q", restored.WorktreeFingerprint, clean.WorktreeFingerprint)
	}

	writeTestFile(t, filepath.Join(repositoryPath, "untracked.txt"), "untracked content\n")
	dirtyUntracked := observeRepository(t, observer, repositoryPath)
	if dirtyUntracked.WorktreeFingerprint == clean.WorktreeFingerprint {
		t.Fatal("untracked worktree change did not change the fingerprint")
	}
	if dirtyUntracked.WorktreeFingerprint == dirtyTracked.WorktreeFingerprint {
		t.Fatal("tracked and untracked observations unexpectedly have the same fingerprint")
	}
	assertStableRepositoryIdentity(t, clean, dirtyUntracked)
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
	if binding.Branch == nil || *binding.Branch != "main" || binding.Detached {
		t.Fatalf("branch state = branch %v detached %t, want main/false", binding.Branch, binding.Detached)
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
	}
	for command, want := range wantSubcommand {
		args, ok := command.arguments("/fixed/repository")
		if !ok {
			t.Fatalf("allowlisted command %d was rejected", command)
		}
		if len(args) < 8 || args[7] != want {
			t.Fatalf("command %d arguments = %q, want subcommand %q", command, args, want)
		}
	}
	if _, ok := gitReadCommand(255).arguments("/fixed/repository"); ok {
		t.Fatal("unknown Git command was accepted by the allowlist")
	}
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
