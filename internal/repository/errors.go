package repository

import (
	"errors"
	"fmt"
)

var (
	// ErrInvalidRepositoryPath identifies a path that cannot safely name a
	// bounded existing Git worktree.
	ErrInvalidRepositoryPath = errors.New("invalid repository path")

	// ErrNotGitRepository identifies a path for which Git cannot return a
	// worktree root.
	ErrNotGitRepository = errors.New("not a Git repository")

	// ErrGitOutputLimit identifies a Git command whose combined standard output
	// and standard error exceeded the Core limit.
	ErrGitOutputLimit = errors.New("Git command output limit exceeded")

	// ErrGitCommandTimeout identifies a Git observation command that exceeded
	// the Core deadline.
	ErrGitCommandTimeout = errors.New("Git command timed out")

	// ErrGitObservation identifies any other bounded Git observation failure.
	ErrGitObservation = errors.New("Git observation failed")

	// ErrDirtySubmodule identifies a status observation whose submodule state
	// cannot be reduced to an ordinary-file content fingerprint. It is also a
	// Git observation failure for callers that do not need the narrower reason.
	ErrDirtySubmodule = fmt.Errorf("%w: dirty submodule", ErrGitObservation)

	// ErrFingerprintPathLimit identifies an observation whose complete set of
	// affected paths exceeds Core Limits 0.1.
	ErrFingerprintPathLimit = fmt.Errorf("%w: fingerprint path limit exceeded", ErrGitObservation)

	// ErrInconsistentWorktree identifies a path or second status observation
	// that no longer agrees with the bounded initial status. The observer never
	// retries or returns the path that caused the failure.
	ErrInconsistentWorktree = fmt.Errorf("%w: inconsistent worktree observation", ErrGitObservation)
)
