package repository

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
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

type fingerprintPathState struct {
	statusPath    string
	resolvedPath  string
	info          os.FileInfo
	symlinkTarget string
}

// prepareFingerprintPaths validates every status-identified path before the
// first content-hash subprocess is started. Deleted records need only a safe
// repository-relative path; records that require content must resolve to an
// ordinary file inside the canonical worktree.
func prepareFingerprintPaths(canonicalRoot string, records []porcelainRecord) (map[string]fingerprintPathState, error) {
	paths := make(map[string]fingerprintPathState)
	for _, record := range records {
		if record.dirtySubmodule() {
			return nil, ErrDirtySubmodule
		}
		if _, err := resolveStatusPath(canonicalRoot, record.path); err != nil {
			return nil, err
		}
		if record.contentMissing() || record.gitlink() {
			continue
		}
		if _, exists := paths[record.path]; exists {
			continue
		}

		state, err := inspectFingerprintPath(canonicalRoot, record.path)
		if err != nil {
			return nil, err
		}
		paths[record.path] = state
	}
	return paths, nil
}

func inspectFingerprintPath(canonicalRoot, statusPath string) (fingerprintPathState, error) {
	path, err := resolveStatusPath(canonicalRoot, statusPath)
	if err != nil {
		return fingerprintPathState{}, err
	}
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() && info.Mode()&os.ModeSymlink == 0 {
		return fingerprintPathState{}, ErrInconsistentWorktree
	}
	resolved := path
	symlinkTarget := ""
	if info.Mode()&os.ModeSymlink != 0 {
		symlinkTarget, err = os.Readlink(path)
		if err != nil {
			return fingerprintPathState{}, ErrInconsistentWorktree
		}
	} else {
		resolved, err = filepath.EvalSymlinks(path)
		if err != nil || !pathInsideRoot(canonicalRoot, resolved) {
			return fingerprintPathState{}, ErrInconsistentWorktree
		}
	}
	return fingerprintPathState{
		statusPath:    statusPath,
		resolvedPath:  filepath.Clean(resolved),
		info:          info,
		symlinkTarget: symlinkTarget,
	}, nil
}

func verifyFingerprintPath(canonicalRoot string, before fingerprintPathState) error {
	after, err := inspectFingerprintPath(canonicalRoot, before.statusPath)
	if err != nil {
		return err
	}
	if before.resolvedPath != after.resolvedPath || !os.SameFile(before.info, after.info) ||
		before.info.Mode() != after.info.Mode() || before.info.Size() != after.info.Size() ||
		!before.info.ModTime().Equal(after.info.ModTime()) || before.symlinkTarget != after.symlinkTarget {
		return ErrInconsistentWorktree
	}
	return nil
}

func verifyFingerprintPaths(canonicalRoot string, paths map[string]fingerprintPathState) error {
	for _, before := range paths {
		if err := verifyFingerprintPath(canonicalRoot, before); err != nil {
			return err
		}
	}
	return nil
}

func resolveStatusPath(canonicalRoot, statusPath string) (string, error) {
	if statusPath == "" || strings.IndexByte(statusPath, 0) >= 0 {
		return "", ErrInconsistentWorktree
	}
	localPath := filepath.FromSlash(statusPath)
	if filepath.IsAbs(localPath) || filepath.VolumeName(localPath) != "" {
		return "", ErrInconsistentWorktree
	}
	clean := filepath.Clean(localPath)
	if clean == "." || clean == ".." || clean != localPath || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return "", ErrInconsistentWorktree
	}
	path := filepath.Join(canonicalRoot, clean)
	if !pathInsideRoot(canonicalRoot, path) {
		return "", ErrInconsistentWorktree
	}
	return path, nil
}

func pathInsideRoot(canonicalRoot, path string) bool {
	relative, err := filepath.Rel(canonicalRoot, path)
	if err != nil {
		return false
	}
	return relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator)) && !filepath.IsAbs(relative)
}
