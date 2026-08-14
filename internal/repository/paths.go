package repository

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func validateRepositoryPath(path string) error {
	if path == "" || len(path) > domain.MaxRepositoryPathBytes || !utf8.ValidString(path) {
		return ErrInvalidRepositoryPath
	}
	return nil
}

// canonicalGitDirectory canonicalizes a directory path returned by Git. The
// input is deliberately Git output rather than the caller's spelling of the
// repository path, so aliases and subdirectories converge on the worktree Git
// actually observed.
func canonicalGitDirectory(output []byte) (string, error) {
	path, err := parseSingleLine(output)
	if err != nil {
		return "", fmt.Errorf("%w: malformed Git path", ErrGitObservation)
	}

	absolute, err := filepath.Abs(filepath.Clean(path))
	if err != nil {
		return "", fmt.Errorf("%w: canonicalize Git path", ErrGitObservation)
	}

	resolved, err := filepath.EvalSymlinks(absolute)
	if err != nil {
		return "", fmt.Errorf("%w: resolve Git path", ErrGitObservation)
	}
	resolved = filepath.Clean(resolved)
	if len(resolved) > domain.MaxRepositoryPathBytes || !utf8.ValidString(resolved) {
		return "", fmt.Errorf("%w: canonical Git path is not bounded", ErrGitObservation)
	}

	info, err := os.Stat(resolved)
	if err != nil || !info.IsDir() {
		return "", fmt.Errorf("%w: Git path is not an existing directory", ErrGitObservation)
	}
	return resolved, nil
}

func parseSingleLine(output []byte) (string, error) {
	if len(output) == 0 || bytes.IndexByte(output, 0) >= 0 {
		return "", ErrGitObservation
	}

	line := output
	if line[len(line)-1] == '\n' {
		line = line[:len(line)-1]
		if len(line) > 0 && line[len(line)-1] == '\r' {
			line = line[:len(line)-1]
		}
	}
	if len(line) == 0 || bytes.ContainsAny(line, "\r\n") || !utf8.Valid(line) {
		return "", ErrGitObservation
	}
	return string(line), nil
}
