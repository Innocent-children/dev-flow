package repository

import "errors"

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
)
