package journeys

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

type countingRepositoryObserver struct {
	delegate repository.RepositoryObserver
	calls    int
}

func (o *countingRepositoryObserver) Observe(ctx context.Context, path string) (domain.RepositoryBinding, error) {
	o.calls++
	return o.delegate.Observe(ctx, path)
}

func (o *countingRepositoryObserver) ObserveWorkspace(ctx context.Context, path string, selection repository.WorkspaceOriginSelection, previous *domain.RepositoryBinding) (domain.WorkspaceOrigin, domain.RepositoryBinding, error) {
	o.calls++
	delegate, ok := o.delegate.(repository.WorkspaceRepositoryObserver)
	if !ok {
		return domain.WorkspaceOrigin{}, domain.RepositoryBinding{}, repository.ErrProvisioningRequired
	}
	return delegate.ObserveWorkspace(ctx, path, selection, previous)
}

type commitBarrierStore struct {
	store.Store
	arrived chan<- string
	release <-chan struct{}
	name    string
}

func (s *commitBarrierStore) CommitTask(ctx context.Context, mutation store.TaskMutation) error {
	s.arrived <- s.name
	<-s.release
	return s.Store.CommitTask(ctx, mutation)
}

type concurrentApplyResult struct {
	name   string
	result application.ApplyActionResult
	err    error
}

type restartProof struct {
	Task       domain.ProcessTask `json:"task"`
	EventCount int                `json:"event_count"`
	ClaimCount int                `json:"claim_count"`
}

func (j *iterationJourney) toRefactor() {
	j.toComprehension()
	j.apply("code_too_complex", "The current code path contains unnecessary indirection.", comprehensionJourneyResult(nil, nil, []string{"unnecessary factory"}, "", "", []string{"Code complexity"}))
	if j.task.CurrentNode != domain.NodeRefactor || j.task.Test != nil || j.task.Comprehension != nil {
		j.t.Fatal("journey did not reach a clean REFACTOR authority")
	}
}

func (j *iterationJourney) installCountingObserver() *countingRepositoryObserver {
	j.t.Helper()
	observer := &countingRepositoryObserver{delegate: repository.NewGitObserver()}
	service, err := application.NewService(j.store, observer)
	if err != nil {
		j.t.Fatal(err)
	}
	j.service = service
	return observer
}

func recoveryProbe(task domain.ProcessTask, operationID domain.ID, payload json.RawMessage) application.OperationProbe {
	action := task.CurrentAction
	return application.OperationProbe{OperationID: operationID, ProcessID: task.Process.ID, ProcessDefinitionDigest: task.Process.DefinitionDigest, SourceCursor: task.CurrentNode, ExpectedRevision: task.Revision, ActionID: action.ActionID, ActionKind: action.Kind, RepositoryBindingDigest: action.RepositoryBindingDigest, IssuanceIdentityDigest: action.IssuanceIdentityDigest, IssuanceHistoryDigest: action.IssuanceHistoryDigest, IssuanceContentDigest: action.IssuanceContentDigest, Payload: payload}
}

func recoveryApplyRequest(task domain.ProcessTask, operationID domain.ID, payload json.RawMessage) application.ApplyActionRequest {
	request := journeyApplyRequest(task, operationID, payload)
	request.RecoveryApply = &application.RecoveryApplyInput{OperationID: operationID, SourceCursor: task.CurrentNode}
	return request
}

func assertProbedReads(t *testing.T, j *iterationJourney, observer *countingRepositoryObserver, probe application.OperationProbe) *application.GetTaskResult {
	t.Helper()
	before := j.state()
	beforeCalls := observer.calls
	read, err := j.service.GetTask(context.Background(), application.GetTaskRequest{Host: domain.HostCodex, TaskID: j.task.TaskID, OperationProbe: &probe})
	if err != nil {
		t.Fatal(err)
	}
	if observer.calls != beforeCalls+1 {
		t.Fatalf("get_task observations=%d", observer.calls-beforeCalls)
	}
	j.assertStateUnchanged(before)
	if read.RecoveryAssessment == nil {
		t.Fatal("probed read omitted recovery assessment")
	}
	raw, err := json.Marshal(read.RecoveryAssessment)
	if err != nil {
		t.Fatal(err)
	}
	text := string(raw)
	for _, forbidden := range []string{j.repo, j.dbPath, "refactor_ready_for_test", "git status", "canonical_root"} {
		if forbidden != "" && strings.Contains(text, forbidden) {
			t.Fatalf("assessment leaked %q: %s", forbidden, text)
		}
	}
	if read.Task.Blocker != nil {
		t.Fatal("probed read created a blocker")
	}
	return &read
}

func writeFeatureFile(t *testing.T, repo, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(repo, "feature.txt"), []byte(content+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
}

func refactorRecoveryPayload(t *testing.T, task domain.ProcessTask) json.RawMessage {
	return journeyPayload(t, task, "refactor_ready_for_test", "", refactorJourneyResult([]string{"feature.txt"}, []string{"Removed the unnecessary indirection"}, false, nil))
}

func openJourneyAtPaths(t *testing.T, repoPath, dbPath string, profile domain.MethodProfile, create bool) *iterationJourney {
	t.Helper()
	var workspaceOrigin *application.WorkspaceOriginInput
	if create {
		origin := initializeDedicatedJourneyWorktree(t, repoPath, "task/phase7b", "receipt-phase7b")
		workspaceOrigin = &origin
	}
	sqliteStore, err := store.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatal(err)
	}
	service, err := application.NewService(sqliteStore, repository.NewGitObserver())
	if err != nil {
		_ = sqliteStore.Close()
		t.Fatal(err)
	}
	var task domain.ProcessTask
	if create {
		opened, err := service.OpenTask(context.Background(), application.OpenTaskRequest{RequestID: "phase7b-open", Host: domain.HostCodex, RepositoryPath: repoPath, WorkspaceOrigin: workspaceOrigin, NewTask: &application.NewTaskInput{Request: "Prove Phase 7B graph recovery and restart journeys.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 16, AllowManualHandoff: true}, MethodProfile: profile}})
		if err != nil {
			_ = sqliteStore.Close()
			t.Fatal(err)
		}
		task = opened.Task
	} else {
		resumed, err := service.OpenTask(context.Background(), application.OpenTaskRequest{RequestID: "phase7b-resume", Host: domain.HostCodex, RepositoryPath: repoPath})
		if err != nil {
			_ = sqliteStore.Close()
			t.Fatal(err)
		}
		task = resumed.Task
	}
	return &iterationJourney{t: t, service: service, store: sqliteStore, dbPath: dbPath, repo: repoPath, task: task}
}

func initializeDedicatedJourneyWorktree(t *testing.T, worktreePath, taskBranch string, receiptID domain.ID) application.WorkspaceOriginInput {
	t.Helper()
	sourcePath := worktreePath + "-source"
	remotePath := worktreePath + "-remote.git"
	if err := os.MkdirAll(filepath.Dir(worktreePath), 0o755); err != nil {
		t.Fatal(err)
	}
	runJourneyGit(t, filepath.Dir(worktreePath), "init", "--bare", "-q", "--initial-branch=main", remotePath)
	if err := os.MkdirAll(sourcePath, 0o755); err != nil {
		t.Fatal(err)
	}
	runJourneyGit(t, sourcePath, "init", "-q", "--initial-branch=main")
	runJourneyGit(t, sourcePath, "config", "user.email", "journey@example.invalid")
	runJourneyGit(t, sourcePath, "config", "user.name", "Journey Test")
	if err := os.WriteFile(filepath.Join(sourcePath, "README.md"), []byte("initial\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runJourneyGit(t, sourcePath, "add", "README.md")
	runJourneyGit(t, sourcePath, "commit", "-q", "-m", "initial")
	runJourneyGit(t, sourcePath, "remote", "add", "origin", remotePath)
	runJourneyGit(t, sourcePath, "push", "-q", "-u", "origin", "main")
	runJourneyGit(t, sourcePath, "worktree", "add", "-q", "-b", taskBranch, worktreePath, "refs/remotes/origin/main")
	return journeyWorkspaceOriginInput(t, worktreePath, receiptID)
}

func journeyWorkspaceOriginInput(t *testing.T, worktreePath string, receiptID domain.ID) application.WorkspaceOriginInput {
	t.Helper()
	return application.WorkspaceOriginInput{
		Mode: domain.WorkspaceModeDedicatedWorktree, RemoteName: "origin", BaseBranch: "main",
		BaseCommit: journeyGitOutput(t, worktreePath, "rev-parse", "refs/remotes/origin/main"),
		TaskBranch: journeyGitOutput(t, worktreePath, "branch", "--show-current"), ProvisioningReceiptID: receiptID,
	}
}

func databaseCount(t *testing.T, dbPath, query string, args ...any) int {
	t.Helper()
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var count int
	if err := db.QueryRow(query, args...).Scan(&count); err != nil {
		t.Fatal(err)
	}
	return count
}

func writeRestartProof(t *testing.T, path string, proof restartProof) {
	t.Helper()
	raw, err := json.Marshal(proof)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		t.Fatal(err)
	}
}

func readRestartProof(t *testing.T, path string) restartProof {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var proof restartProof
	if err := json.Unmarshal(raw, &proof); err != nil {
		t.Fatal(err)
	}
	return proof
}

type uncertainShape struct {
	name      string
	result    []byte
	err       error
	cancelled bool
}

func (s uncertainShape) isUncertain() bool {
	if s.cancelled || s.err != nil || len(s.result) == 0 {
		return true
	}
	var envelope struct {
		OK bool `json:"ok"`
	}
	return json.Unmarshal(s.result, &envelope) != nil
}

func completeDomainErrorIsUncertain(raw []byte) bool {
	var envelope struct {
		OK    bool            `json:"ok"`
		Error json.RawMessage `json:"error"`
	}
	return json.Unmarshal(raw, &envelope) != nil || envelope.OK || len(envelope.Error) == 0
}

func waitForBarrierArrivals(t *testing.T, arrived <-chan string, count int) []string {
	t.Helper()
	names := make([]string, 0, count)
	for len(names) < count {
		select {
		case name := <-arrived:
			names = append(names, name)
		case <-time.After(10 * time.Second):
			t.Fatalf("commit barrier arrivals=%v", names)
		}
	}
	return names
}

func requireOneWinnerOneLoser(t *testing.T, results []concurrentApplyResult) (application.ApplyActionResult, concurrentApplyResult) {
	t.Helper()
	var winner application.ApplyActionResult
	var loser concurrentApplyResult
	winners := 0
	for _, result := range results {
		if result.err == nil {
			winner = result.result
			winners++
		} else {
			loser = result
		}
	}
	if winners != 1 || !errors.Is(loser.err, domain.ErrRevisionConflict) {
		t.Fatalf("results=%+v", results)
	}
	return winner, loser
}
