package repository

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

const gitExecutable = "git"

type gitReadCommand uint8

const (
	gitShowWorktreeRoot gitReadCommand = iota + 1
	gitShowCommonDirectory
	gitShowBranch
	gitShowHead
	gitShowStatus
	gitHashObject
)

// GitObserver observes one Git worktree using only fixed, allowlisted,
// read-only Git command shapes.
type GitObserver struct {
	runner gitCommandRunner
}

// NewGitObserver returns an observer using the fixed Core output and timeout
// limits. The limits are private implementation details rather than a user
// configuration surface.
func NewGitObserver() *GitObserver {
	return &GitObserver{runner: gitCommandRunner{
		timeout:     domain.GitCommandTimeout,
		outputLimit: int64(domain.MaxGitCommandOutputBytes),
	}}
}

var _ RepositoryObserver = (*GitObserver)(nil)

// Observe returns a normalized repository binding. Raw Git status and command
// diagnostics are consumed only to calculate the binding and are never
// returned or persisted by this package.
func (o *GitObserver) Observe(ctx context.Context, repositoryPath string) (domain.RepositoryBinding, error) {
	if err := validateRepositoryPath(repositoryPath); err != nil {
		return domain.RepositoryBinding{}, err
	}
	if o == nil {
		return domain.RepositoryBinding{}, ErrGitObservation
	}

	rootResult, err := o.runner.run(ctx, gitShowWorktreeRoot, repositoryPath, "")
	if err != nil {
		return domain.RepositoryBinding{}, err
	}
	if rootResult.exitCode != 0 {
		return domain.RepositoryBinding{}, ErrNotGitRepository
	}
	canonicalRoot, err := canonicalGitDirectory(rootResult.stdout)
	if err != nil {
		return domain.RepositoryBinding{}, err
	}

	commonResult, err := o.runner.run(ctx, gitShowCommonDirectory, canonicalRoot, "")
	if err != nil {
		return domain.RepositoryBinding{}, err
	}
	if commonResult.exitCode != 0 {
		return domain.RepositoryBinding{}, fmt.Errorf("%w: common directory", ErrGitObservation)
	}
	canonicalCommonDirectory, err := canonicalGitDirectory(commonResult.stdout)
	if err != nil {
		return domain.RepositoryBinding{}, err
	}

	branchResult, err := o.runner.run(ctx, gitShowBranch, canonicalRoot, "")
	if err != nil {
		return domain.RepositoryBinding{}, err
	}
	branch, detached, err := observedBranch(branchResult)
	if err != nil {
		return domain.RepositoryBinding{}, err
	}

	headResult, err := o.runner.run(ctx, gitShowHead, canonicalRoot, "")
	if err != nil {
		return domain.RepositoryBinding{}, err
	}
	head, unborn, err := observedHead(headResult)
	if err != nil {
		return domain.RepositoryBinding{}, err
	}
	if detached && unborn {
		return domain.RepositoryBinding{}, fmt.Errorf("%w: detached unborn state", ErrGitObservation)
	}

	statusResult, err := o.runner.run(ctx, gitShowStatus, canonicalRoot, "")
	if err != nil {
		return domain.RepositoryBinding{}, err
	}
	if statusResult.exitCode != 0 {
		return domain.RepositoryBinding{}, fmt.Errorf("%w: worktree status", ErrGitObservation)
	}
	statusRecords, err := parsePorcelainV2(statusResult.stdout)
	if err != nil {
		return domain.RepositoryBinding{}, err
	}
	pathStates, err := prepareFingerprintPaths(canonicalRoot, statusRecords)
	if err != nil {
		return domain.RepositoryBinding{}, err
	}
	fingerprintRecords, err := o.contentFingerprintRecords(ctx, canonicalRoot, statusRecords, pathStates)
	if err != nil {
		return domain.RepositoryBinding{}, err
	}

	secondStatusResult, err := o.runner.run(ctx, gitShowStatus, canonicalRoot, "")
	if err != nil {
		return domain.RepositoryBinding{}, err
	}
	if secondStatusResult.exitCode != 0 {
		return domain.RepositoryBinding{}, fmt.Errorf("%w: second worktree status", ErrGitObservation)
	}
	secondStatusRecords, err := parsePorcelainV2(secondStatusResult.stdout)
	if err != nil {
		return domain.RepositoryBinding{}, err
	}
	if err := ensureNoDirtySubmodules(secondStatusRecords); err != nil {
		return domain.RepositoryBinding{}, err
	}
	if err := ensureStatusUnchanged(statusRecords, secondStatusRecords); err != nil {
		return domain.RepositoryBinding{}, err
	}
	if err := verifyFingerprintPaths(canonicalRoot, pathStates); err != nil {
		return domain.RepositoryBinding{}, err
	}

	commonDirectoryDigest := digestGitCommonDirectory(canonicalCommonDirectory)
	binding := domain.RepositoryBinding{
		CanonicalRoot:       canonicalRoot,
		GitCommonDirDigest:  commonDirectoryDigest,
		RepositoryIdentity:  digestRepositoryIdentity(canonicalRoot, commonDirectoryDigest),
		Branch:              branch,
		Detached:            detached,
		Head:                head,
		Unborn:              unborn,
		WorktreeFingerprint: fingerprintWorktree(fingerprintRecords),
		ChangedPaths:        observedChangedPaths(statusRecords),
		ObservedAt:          time.Now().UTC(),
	}
	binding.BindingDigest = digestRepositoryBinding(binding)
	if err := binding.Validate(); err != nil {
		return domain.RepositoryBinding{}, fmt.Errorf("%w: invalid repository binding: %v", ErrGitObservation, err)
	}
	return binding, nil
}

func observedChangedPaths(records []porcelainRecord) []string {
	paths := make([]string, 0, len(records))
	seen := map[string]bool{}
	for _, record := range records {
		if record.path == "" || seen[record.path] {
			continue
		}
		seen[record.path] = true
		paths = append(paths, record.path)
	}
	sort.Strings(paths)
	return paths
}

func (o *GitObserver) contentFingerprintRecords(
	ctx context.Context,
	canonicalRoot string,
	statusRecords []porcelainRecord,
	pathStates map[string]fingerprintPathState,
) ([]worktreeFingerprintRecord, error) {
	normalized := normalizedPorcelainRecords(statusRecords)
	contentByPath := make(map[string]string, len(pathStates))
	fingerprintRecords := make([]worktreeFingerprintRecord, 0, len(normalized))
	for _, record := range normalized {
		contentIdentity := missingContentIdentity
		switch {
		case record.contentMissing():
		case record.gitlink():
			objectID, ok := record.cleanGitlinkObjectID()
			if !ok {
				return nil, ErrInconsistentWorktree
			}
			contentIdentity = gitlinkContentPrefix + objectID
		default:
			var exists bool
			contentIdentity, exists = contentByPath[record.path]
			if !exists {
				state, found := pathStates[record.path]
				if !found {
					return nil, ErrInconsistentWorktree
				}
				objectID, err := o.hashObject(ctx, canonicalRoot, record.path, state)
				if err != nil {
					return nil, err
				}
				contentIdentity = gitObjectContentPrefix + objectID
				contentByPath[record.path] = contentIdentity
			}
		}
		fingerprintRecords = append(fingerprintRecords, worktreeFingerprintRecord{
			status:          record,
			contentIdentity: contentIdentity,
		})
	}
	return fingerprintRecords, nil
}

func (o *GitObserver) hashObject(
	ctx context.Context,
	canonicalRoot string,
	statusPath string,
	state fingerprintPathState,
) (string, error) {
	result, err := o.runner.run(ctx, gitHashObject, canonicalRoot, statusPath)
	if err != nil {
		return "", err
	}
	if result.exitCode != 0 {
		return "", ErrInconsistentWorktree
	}
	objectID, err := parseSingleLine(result.stdout)
	if err != nil || !validGitObjectID(objectID) {
		return "", ErrInconsistentWorktree
	}
	if err := verifyFingerprintPath(canonicalRoot, state); err != nil {
		return "", err
	}
	return objectID, nil
}

func observedBranch(result gitCommandResult) (*string, bool, error) {
	switch result.exitCode {
	case 0:
		branch, err := parseSingleLine(result.stdout)
		if err != nil {
			return nil, false, fmt.Errorf("%w: branch", ErrGitObservation)
		}
		return &branch, false, nil
	case 1:
		return nil, true, nil
	default:
		return nil, false, fmt.Errorf("%w: branch", ErrGitObservation)
	}
}

func observedHead(result gitCommandResult) (*string, bool, error) {
	switch result.exitCode {
	case 0:
		head, err := parseSingleLine(result.stdout)
		if err != nil {
			return nil, false, fmt.Errorf("%w: HEAD", ErrGitObservation)
		}
		return &head, false, nil
	case 1:
		return nil, true, nil
	default:
		return nil, false, fmt.Errorf("%w: HEAD", ErrGitObservation)
	}
}

type gitCommandRunner struct {
	timeout     time.Duration
	outputLimit int64
}

type gitCommandResult struct {
	stdout   []byte
	exitCode int
}

func (r gitCommandRunner) run(
	ctx context.Context,
	command gitReadCommand,
	repositoryPath string,
	statusPath string,
) (gitCommandResult, error) {
	args, ok := command.arguments(repositoryPath, statusPath)
	if !ok {
		return gitCommandResult{}, ErrGitObservation
	}

	timeoutContext, timeoutCancel := context.WithTimeout(ctx, r.timeout)
	commandContext, commandCancel := context.WithCancel(timeoutContext)
	defer timeoutCancel()
	defer commandCancel()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	capture := boundedCommandCapture{
		remaining: r.outputLimit,
		cancel:    commandCancel,
	}

	cmd := exec.CommandContext(commandContext, gitExecutable, args...)
	cmd.Env = gitEnvironment(os.Environ())
	cmd.Stdout = capture.writer(&stdout)
	cmd.Stderr = capture.writer(&stderr)
	runErr := cmd.Run()

	if capture.limitExceeded() {
		return gitCommandResult{}, ErrGitOutputLimit
	}
	if err := ctx.Err(); err != nil {
		return gitCommandResult{}, err
	}
	if errors.Is(timeoutContext.Err(), context.DeadlineExceeded) {
		return gitCommandResult{}, ErrGitCommandTimeout
	}

	result := gitCommandResult{stdout: append([]byte(nil), stdout.Bytes()...)}
	if runErr == nil {
		return result, nil
	}
	var exitError *exec.ExitError
	if errors.As(runErr, &exitError) {
		result.exitCode = exitError.ExitCode()
		return result, nil
	}
	return gitCommandResult{}, fmt.Errorf("%w: start Git", ErrGitObservation)
}

func (command gitReadCommand) arguments(repositoryPath, statusPath string) ([]string, bool) {
	// Explicitly disable optional index writes and configured file-system
	// monitors. The remaining suffixes are a closed read-only allowlist.
	args := []string{
		"--no-optional-locks",
		"-c", "core.fsmonitor=false",
		"-c", "core.untrackedCache=false",
		"-C", repositoryPath,
	}

	switch command {
	case gitShowWorktreeRoot:
		if statusPath != "" {
			return nil, false
		}
		return append(args, "rev-parse", "--path-format=absolute", "--show-toplevel"), true
	case gitShowCommonDirectory:
		if statusPath != "" {
			return nil, false
		}
		return append(args, "rev-parse", "--path-format=absolute", "--git-common-dir"), true
	case gitShowBranch:
		if statusPath != "" {
			return nil, false
		}
		return append(args, "symbolic-ref", "--quiet", "--short", "HEAD"), true
	case gitShowHead:
		if statusPath != "" {
			return nil, false
		}
		return append(args, "rev-parse", "--verify", "--quiet", "HEAD"), true
	case gitShowStatus:
		if statusPath != "" {
			return nil, false
		}
		return append(args,
			"status", "--porcelain=v2", "--untracked-files=all", "--ignore-submodules=none", "--no-renames", "-z",
		), true
	case gitHashObject:
		if statusPath == "" {
			return nil, false
		}
		return append(args, "hash-object", "--no-filters", "--", statusPath), true
	default:
		return nil, false
	}
}

func gitEnvironment(environment []string) []string {
	clean := make([]string, 0, len(environment)+3)
	for _, entry := range environment {
		key, _, found := strings.Cut(entry, "=")
		if !found || strings.HasPrefix(key, "GIT_") || key == "LC_ALL" || key == "LANG" {
			continue
		}
		clean = append(clean, entry)
	}
	return append(clean, "GIT_OPTIONAL_LOCKS=0", "LC_ALL=C", "LANG=C")
}

type boundedCommandCapture struct {
	mu        sync.Mutex
	remaining int64
	exceeded  bool
	cancel    context.CancelFunc
}

func (capture *boundedCommandCapture) writer(destination *bytes.Buffer) *boundedCommandWriter {
	return &boundedCommandWriter{capture: capture, destination: destination}
}

func (capture *boundedCommandCapture) limitExceeded() bool {
	capture.mu.Lock()
	defer capture.mu.Unlock()
	return capture.exceeded
}

type boundedCommandWriter struct {
	capture     *boundedCommandCapture
	destination *bytes.Buffer
}

func (writer *boundedCommandWriter) Write(value []byte) (int, error) {
	writer.capture.mu.Lock()
	defer writer.capture.mu.Unlock()

	if writer.capture.exceeded {
		return len(value), nil
	}
	if int64(len(value)) <= writer.capture.remaining {
		_, _ = writer.destination.Write(value)
		writer.capture.remaining -= int64(len(value))
		return len(value), nil
	}

	if writer.capture.remaining > 0 {
		_, _ = writer.destination.Write(value[:writer.capture.remaining])
		writer.capture.remaining = 0
	}
	writer.capture.exceeded = true
	writer.capture.cancel()
	return len(value), nil
}
