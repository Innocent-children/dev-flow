package journeys

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

const (
	restartHelperModeEnv       = "DEV_FLOW_TEST_RESTART_HELPER_MODE"
	restartDatabasePathEnv     = "DEV_FLOW_TEST_RESTART_DATABASE"
	restartRepositoryPathEnv   = "DEV_FLOW_TEST_RESTART_REPOSITORY"
	restartProjectionPathEnv   = "DEV_FLOW_TEST_RESTART_PROJECTION"
	restartCompletionPathEnv   = "DEV_FLOW_TEST_RESTART_COMPLETION"
	maxRestartResultBytes      = 64 * 1024
	maxRestartHelperOutputByte = 16 * 1024
)

func TestCoreRestartJourney(t *testing.T) {
	switch mode := os.Getenv(restartHelperModeEnv); mode {
	case "first":
		runFirstRestartHelper(t, restartHelperPathsFromEnvironment(t))
		return
	case "second":
		runSecondRestartHelper(t, restartHelperPathsFromEnvironment(t))
		return
	case "":
		// Parent process continues below.
	default:
		t.Fatal("invalid restart helper mode")
	}

	root := t.TempDir()
	paths := restartHelperPaths{
		database:   filepath.Join(root, "restart.db"),
		repository: filepath.Join(root, "repository"),
		projection: filepath.Join(root, "restart-projection.json"),
		completion: filepath.Join(root, "restart-completion.json"),
	}
	initializeRestartRepository(t, paths.repository)

	firstPID := runRestartSubprocess(t, "first", paths)
	projection := readBoundedRestartJSON[restartProjection](t, paths.projection)
	if projection.FirstProcessPID != firstPID || firstPID == os.Getpid() {
		t.Fatal("first helper did not record its independent process identity")
	}
	if projection.Phase != domain.PhasePlan || projection.Revision != 3 ||
		projection.ActionKind != domain.ActionImplementChange || projection.EventCount != 3 {
		t.Fatal("first helper did not persist the selected PLAN checkpoint")
	}

	secondPID := runRestartSubprocess(t, "second", paths)
	completion := readBoundedRestartJSON[restartCompletion](t, paths.completion)
	if completion.FirstProcessPID != firstPID || completion.SecondProcessPID != secondPID ||
		firstPID == secondPID || secondPID == os.Getpid() {
		t.Fatal("restart journey did not cross two independent helper processes")
	}
	if completion.TaskID != projection.TaskID || completion.Phase != domain.PhaseDone ||
		completion.Revision != 8 || completion.EventCount != 8 {
		t.Fatal("second helper did not complete the resumed task")
	}

	finalFacts := readRestartDatabaseFacts(t, paths.database, projection.TaskID)
	if finalFacts.taskCount != 1 || finalFacts.phase != domain.PhaseDone ||
		finalFacts.taskRevision != 8 || finalFacts.eventCount != 8 ||
		finalFacts.latestEventRevision != 8 || finalFacts.claimCount != 0 {
		t.Fatal("persisted terminal task, event history, or released claim is inconsistent")
	}
}

type restartHelperPaths struct {
	database   string
	repository string
	projection string
	completion string
}

type restartProjection struct {
	TaskID                  domain.ID                 `json:"task_id"`
	OriginHost              domain.Host               `json:"origin_host"`
	Revision                uint64                    `json:"revision"`
	Phase                   domain.Phase              `json:"phase"`
	ActionID                domain.ID                 `json:"action_id"`
	ActionKind              domain.ActionKind         `json:"action_kind"`
	ActionRevision          uint64                    `json:"action_revision"`
	ActionRepositoryBinding domain.Digest             `json:"action_repository_binding"`
	ActionIssuedAt          time.Time                 `json:"action_issued_at"`
	ContractDigest          string                    `json:"contract_digest"`
	VerificationBudget      domain.VerificationBudget `json:"verification_budget"`
	Repository              domain.RepositoryBinding  `json:"repository"`
	EvidenceDigest          string                    `json:"evidence_digest"`
	LastOperationDigest     string                    `json:"last_operation_digest"`
	EventCount              int                       `json:"event_count"`
	FirstProcessPID         int                       `json:"first_process_pid"`
}

type restartCompletion struct {
	TaskID           domain.ID    `json:"task_id"`
	Phase            domain.Phase `json:"phase"`
	Revision         uint64       `json:"revision"`
	EventCount       int          `json:"event_count"`
	FirstProcessPID  int          `json:"first_process_pid"`
	SecondProcessPID int          `json:"second_process_pid"`
}

func runFirstRestartHelper(t *testing.T, paths restartHelperPaths) {
	t.Helper()
	ctx := context.Background()
	taskStore, err := store.Open(ctx, paths.database)
	if err != nil {
		t.Fatalf("first helper could not open store: %v", err)
	}
	closed := false
	defer func() {
		if !closed {
			_ = taskStore.Close()
		}
	}()
	service, err := application.NewService(taskStore, repository.NewGitObserver())
	if err != nil {
		t.Fatalf("first helper could not construct service: %v", err)
	}

	opened, err := service.OpenTask(ctx, application.OpenTaskRequest{
		RequestID:      "request-restart-open",
		Host:           domain.HostCodex,
		RepositoryPath: paths.repository,
		NewTask: &application.NewTaskInput{
			Goal:               "prove exact subprocess restart continuity",
			Scope:              []string{"core persistence and application resume"},
			OutOfScope:         []string{"recovery classification and host adapters"},
			AcceptanceCriteria: []string{"the exact persisted action resumes and reaches DONE"},
			VerificationBudget: domain.VerificationBudget{
				Level:                domain.VerificationTargeted,
				MaxAutomaticCommands: 2,
				AllowManualHandoff:   true,
			},
		},
	})
	if err != nil || !opened.Created {
		t.Fatalf("first helper could not create task: %v", err)
	}
	task := opened.Task
	task = applyRestartJourneyAction(t, ctx, service, task, "request-restart-assess", workflow.AssessTaskPayload{
		Result:                         domain.ActionResultSucceeded,
		Summary:                        "restart task and acceptance assessed",
		Constraints:                    []string{"single repository"},
		Risks:                          []string{},
		IntendedChangedSurface:         []string{"test-only restart journey"},
		VerificationBudgetAcknowledged: true,
	})
	task = applyRestartJourneyAction(t, ctx, service, task, "request-restart-plan", workflow.PlanChangePayload{
		Result:               domain.ActionResultSucceeded,
		Summary:              "bounded restart implementation plan",
		Steps:                []string{"resume the persisted IMPLEMENT_CHANGE action"},
		ExpectedChangedPaths: []string{},
		NonGoals:             []string{"recovery classification"},
		VerificationSteps:    []string{"run the process restart journey"},
		UnresolvedQuestions:  []string{},
	})
	if task.Phase != domain.PhasePlan || task.Revision != 3 || task.CurrentAction == nil ||
		task.CurrentAction.Kind != domain.ActionImplementChange {
		t.Fatal("first helper did not reach the selected nonterminal checkpoint")
	}

	factsBeforeRead := readRestartDatabaseFacts(t, paths.database, task.TaskID)
	next, err := service.GetNextAction(ctx, application.GetNextActionRequest{Host: domain.HostCodex, TaskID: task.TaskID})
	if err != nil || next.Action == nil || next.Action.ActionID != task.CurrentAction.ActionID ||
		next.Revision != task.Revision || next.Phase != task.Phase {
		t.Fatalf("first helper next-action read changed identity: %v", err)
	}
	if factsAfterRead := readRestartDatabaseFacts(t, paths.database, task.TaskID); factsAfterRead != factsBeforeRead {
		t.Fatal("first helper next-action read changed persisted state")
	}

	projection := restartProjection{
		TaskID:                  task.TaskID,
		OriginHost:              task.OriginHost,
		Revision:                task.Revision,
		Phase:                   task.Phase,
		ActionID:                task.CurrentAction.ActionID,
		ActionKind:              task.CurrentAction.Kind,
		ActionRevision:          task.CurrentAction.Revision,
		ActionRepositoryBinding: task.CurrentAction.RepositoryBindingDigest,
		ActionIssuedAt:          task.CurrentAction.IssuedAt,
		ContractDigest:          digestRestartContract(t, task.Contract),
		VerificationBudget:      task.Contract.VerificationBudget(),
		Repository:              task.Repository.Clone(),
		EvidenceDigest:          digestRestartValue(t, task.Evidence),
		LastOperationDigest:     digestRestartValue(t, task.LastOperation),
		EventCount:              factsBeforeRead.eventCount,
		FirstProcessPID:         os.Getpid(),
	}
	writeBoundedRestartJSON(t, paths.projection, projection)
	if err := taskStore.Close(); err != nil {
		t.Fatalf("first helper could not close store: %v", err)
	}
	closed = true
}

func runSecondRestartHelper(t *testing.T, paths restartHelperPaths) {
	t.Helper()
	ctx := context.Background()
	want := readBoundedRestartJSON[restartProjection](t, paths.projection)
	taskStore, err := store.Open(ctx, paths.database)
	if err != nil {
		t.Fatalf("second helper could not reopen store: %v", err)
	}
	closed := false
	defer func() {
		if !closed {
			_ = taskStore.Close()
		}
	}()
	service, err := application.NewService(taskStore, repository.NewGitObserver())
	if err != nil {
		t.Fatalf("second helper could not construct a fresh service: %v", err)
	}

	factsBeforeResume := readRestartDatabaseFacts(t, paths.database, want.TaskID)
	resumed, err := service.OpenTask(ctx, application.OpenTaskRequest{
		RequestID:      "request-restart-resume",
		Host:           domain.HostCodex,
		RepositoryPath: paths.repository,
		NewTask:        nil,
	})
	if err != nil || resumed.Created {
		t.Fatalf("second helper did not resume the active task: %v", err)
	}
	requireRestartProjection(t, resumed.Task, want)
	if factsAfterResume := readRestartDatabaseFacts(t, paths.database, want.TaskID); factsAfterResume != factsBeforeResume {
		t.Fatal("same-host resume changed persisted state")
	}

	next, err := service.GetNextAction(ctx, application.GetNextActionRequest{Host: domain.HostCodex, TaskID: want.TaskID})
	if err != nil || next.Action == nil || next.TaskID != want.TaskID ||
		next.Phase != want.Phase || next.Revision != want.Revision ||
		next.Action.ActionID != want.ActionID || next.Action.Kind != want.ActionKind ||
		next.Action.Revision != want.ActionRevision ||
		next.Action.RepositoryBindingDigest != want.ActionRepositoryBinding {
		t.Fatalf("second helper did not read the exact resumed action: %v", err)
	}
	if factsAfterNextAction := readRestartDatabaseFacts(t, paths.database, want.TaskID); factsAfterNextAction != factsBeforeResume {
		t.Fatal("resumed next-action read changed revision, event, or claim state")
	}

	task := resumed.Task
	task = applyRestartJourneyAction(t, ctx, service, task, "request-restart-implement", workflow.ImplementChangePayload{
		Result:         domain.ActionResultSucceeded,
		Summary:        "restart proof requires no production file change",
		ChangedPaths:   []string{},
		NoFileChanges:  true,
		Deviations:     []string{},
		ScopeConfirmed: true,
	})
	task = applyRestartJourneyAction(t, ctx, service, task, "request-restart-verify", workflow.VerifyChangePayload{
		Result:  domain.ActionResultReady,
		Summary: "targeted restart verification passed",
		Checks: []workflow.EvidenceInput{
			{
				Source:       domain.EvidenceSourceAutomated,
				Name:         "subprocess-restart",
				Status:       domain.EvidencePassed,
				Summary:      "fresh process resumed the exact action",
				CommandCount: 1,
			},
			{
				Source:  domain.EvidenceSourceUser,
				Name:    "checkpoint-scope",
				Status:  domain.EvidencePassed,
				Summary: "checkpoint remains limited to User Story 3",
			},
		},
		FailedItems:        []string{},
		UnverifiedItems:    []string{},
		ManualHandoffItems: []string{},
	})
	automatedID := findRestartEvidenceID(t, task.Evidence, domain.EvidenceSourceAutomated)
	manualID := findRestartEvidenceID(t, task.Evidence, domain.EvidenceSourceUser)
	task = applyRestartJourneyAction(t, ctx, service, task, "request-restart-review", workflow.ReviewChangePayload{
		Result:        domain.ActionResultPass,
		Summary:       "resumed task passes bounded review",
		Findings:      []string{},
		ResidualRisks: []string{},
	})
	delivery := workflow.DeliveryData{
		Acceptance: []domain.OutcomeCriterion{{
			Criterion: task.Contract.AcceptanceCriteria()[0],
			Status:    domain.CriterionSatisfied,
		}},
		AutomatedEvidenceIDs: []domain.ID{automatedID},
		ManualEvidenceIDs:    []domain.ID{manualID},
		UnverifiedItems:      []string{},
		Risks:                []string{},
	}
	task = applyRestartJourneyAction(t, ctx, service, task, "request-restart-handoff", workflow.ReviewHandoffPayload{
		Result:   domain.ActionResultReady,
		Summary:  "restart delivery data prepared",
		Delivery: &delivery,
	})
	task = applyRestartJourneyAction(t, ctx, service, task, "request-restart-complete", workflow.CompleteHandoffPayload{
		Result:   domain.ActionResultComplete,
		Summary:  "subprocess restart journey completed",
		Delivery: &delivery,
	})
	if task.Phase != domain.PhaseDone || task.Revision != 8 || task.CurrentAction != nil ||
		task.Outcome == nil || task.CompletedAt == nil {
		t.Fatal("resumed task did not reach a valid DONE snapshot")
	}

	terminal, err := service.GetTask(ctx, application.GetTaskRequest{Host: domain.HostCodex, TaskID: task.TaskID})
	if err != nil || terminal.Task.Phase != domain.PhaseDone || terminal.Task.Revision != task.Revision ||
		terminal.Task.Outcome == nil {
		t.Fatalf("terminal task was not readable after completion: %v", err)
	}
	terminalNext, err := service.GetNextAction(ctx, application.GetNextActionRequest{Host: domain.HostCodex, TaskID: task.TaskID})
	if err != nil || terminalNext.Action != nil || terminalNext.Outcome == nil ||
		terminalNext.Phase != domain.PhaseDone || terminalNext.Revision != task.Revision {
		t.Fatalf("terminal task produced an invalid next-action projection: %v", err)
	}
	finalFacts := readRestartDatabaseFacts(t, paths.database, task.TaskID)
	if finalFacts.taskCount != 1 || finalFacts.phase != domain.PhaseDone ||
		finalFacts.taskRevision != task.Revision || finalFacts.eventCount != 8 ||
		finalFacts.latestEventRevision != task.Revision || finalFacts.claimCount != 0 {
		t.Fatal("second helper observed inconsistent terminal persistence")
	}

	if err := taskStore.Close(); err != nil {
		t.Fatalf("second helper could not close store: %v", err)
	}
	closed = true
	writeBoundedRestartJSON(t, paths.completion, restartCompletion{
		TaskID:           task.TaskID,
		Phase:            task.Phase,
		Revision:         task.Revision,
		EventCount:       finalFacts.eventCount,
		FirstProcessPID:  want.FirstProcessPID,
		SecondProcessPID: os.Getpid(),
	})
}

func requireRestartProjection(t *testing.T, task domain.Task, want restartProjection) {
	t.Helper()
	if task.TaskID != want.TaskID || task.OriginHost != want.OriginHost ||
		task.Revision != want.Revision || task.Phase != want.Phase {
		t.Fatal("resume changed task identity, ownership, revision, or phase")
	}
	if task.CurrentAction == nil || task.CurrentAction.ActionID != want.ActionID ||
		task.CurrentAction.Kind != want.ActionKind || task.CurrentAction.Revision != want.ActionRevision ||
		task.CurrentAction.RepositoryBindingDigest != want.ActionRepositoryBinding ||
		!task.CurrentAction.IssuedAt.Equal(want.ActionIssuedAt) {
		t.Fatal("resume changed the persisted action identity")
	}
	if digestRestartContract(t, task.Contract) != want.ContractDigest ||
		task.Contract.VerificationBudget() != want.VerificationBudget {
		t.Fatal("resume changed the immutable contract or verification budget")
	}
	if !equalRestartRepositoryBinding(task.Repository, want.Repository) {
		t.Fatal("resume changed the persisted repository binding")
	}
	if digestRestartValue(t, task.Evidence) != want.EvidenceDigest ||
		digestRestartValue(t, task.LastOperation) != want.LastOperationDigest {
		t.Fatal("resume changed evidence or the last committed operation")
	}
}

func applyRestartJourneyAction(
	t *testing.T,
	ctx context.Context,
	service *application.Service,
	task domain.Task,
	requestID domain.ID,
	payload workflow.ActionPayload,
) domain.Task {
	t.Helper()
	if task.CurrentAction == nil {
		t.Fatal("nonterminal journey task is missing its current action")
	}
	previousActionID := task.CurrentAction.ActionID
	result, err := service.ApplyAction(ctx, application.ApplyActionRequest{
		RequestID:               requestID,
		Host:                    task.OriginHost,
		TaskID:                  task.TaskID,
		ExpectedRevision:        task.Revision,
		ActionID:                task.CurrentAction.ActionID,
		ActionKind:              task.CurrentAction.Kind,
		RepositoryBindingDigest: task.CurrentAction.RepositoryBindingDigest,
		Payload:                 payload,
	})
	if err != nil {
		t.Fatalf("apply journey action failed: %v", err)
	}
	next := result.Task
	if next.Revision != task.Revision+1 || next.LastOperation == nil ||
		next.LastOperation.OperationID != requestID || next.LastOperation.ActionID == nil ||
		*next.LastOperation.ActionID != previousActionID {
		t.Fatal("journey action did not commit exactly one bound revision")
	}
	return next
}

func findRestartEvidenceID(
	t *testing.T,
	evidence []domain.EvidenceSummary,
	source domain.EvidenceSource,
) domain.ID {
	t.Helper()
	for _, item := range evidence {
		if item.Source == source {
			return item.EvidenceID
		}
	}
	t.Fatal("required journey evidence was not retained")
	return ""
}

type restartDatabaseFacts struct {
	phase               domain.Phase
	taskRevision        uint64
	eventCount          int
	latestEventRevision uint64
	claimCount          int
	taskCount           int
}

func readRestartDatabaseFacts(
	t *testing.T,
	databasePath string,
	taskID domain.ID,
) restartDatabaseFacts {
	t.Helper()
	db, err := sql.Open("sqlite", databasePath)
	if err != nil {
		t.Fatalf("open journey database for bounded assertion: %v", err)
	}
	defer db.Close()
	var (
		facts                  restartDatabaseFacts
		phase                  string
		taskRevision, eventMax int64
	)
	if err := db.QueryRow(
		`SELECT t.phase, t.revision, COUNT(e.event_id), COALESCE(MAX(e.revision), 0)
		   FROM tasks AS t
		   LEFT JOIN task_events AS e ON e.task_id = t.task_id
		  WHERE t.task_id = ?
		  GROUP BY t.phase, t.revision`,
		string(taskID),
	).Scan(&phase, &taskRevision, &facts.eventCount, &eventMax); err != nil {
		t.Fatalf("read journey task/event facts: %v", err)
	}
	if taskRevision < 1 || eventMax < 0 {
		t.Fatal("journey database contains an invalid revision")
	}
	facts.phase = domain.Phase(phase)
	facts.taskRevision = uint64(taskRevision)
	facts.latestEventRevision = uint64(eventMax)
	if err := db.QueryRow(`SELECT COUNT(*) FROM repository_claims WHERE task_id = ?`, string(taskID)).Scan(&facts.claimCount); err != nil {
		t.Fatalf("read journey repository claim: %v", err)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM tasks WHERE task_id = ?`, string(taskID)).Scan(&facts.taskCount); err != nil {
		t.Fatalf("read journey task count: %v", err)
	}
	return facts
}

func digestRestartContract(t *testing.T, contract domain.Contract) string {
	t.Helper()
	return digestRestartValue(t, struct {
		Goal               string                    `json:"goal"`
		Scope              []string                  `json:"scope"`
		OutOfScope         []string                  `json:"out_of_scope"`
		AcceptanceCriteria []string                  `json:"acceptance_criteria"`
		VerificationBudget domain.VerificationBudget `json:"verification_budget"`
	}{
		Goal:               contract.Goal(),
		Scope:              contract.Scope(),
		OutOfScope:         contract.OutOfScope(),
		AcceptanceCriteria: contract.AcceptanceCriteria(),
		VerificationBudget: contract.VerificationBudget(),
	})
}

func digestRestartValue(t *testing.T, value any) string {
	t.Helper()
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("encode bounded restart projection: %v", err)
	}
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:])
}

func equalRestartRepositoryBinding(left, right domain.RepositoryBinding) bool {
	return left.CanonicalRoot == right.CanonicalRoot &&
		left.GitCommonDirDigest == right.GitCommonDirDigest &&
		left.RepositoryIdentity == right.RepositoryIdentity &&
		equalOptionalRestartString(left.Branch, right.Branch) &&
		left.Detached == right.Detached &&
		equalOptionalRestartString(left.Head, right.Head) &&
		left.Unborn == right.Unborn &&
		left.WorktreeFingerprint == right.WorktreeFingerprint &&
		left.ObservedAt.Equal(right.ObservedAt) &&
		left.BindingDigest == right.BindingDigest
}

func equalOptionalRestartString(left, right *string) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func restartHelperPathsFromEnvironment(t *testing.T) restartHelperPaths {
	t.Helper()
	paths := restartHelperPaths{
		database:   os.Getenv(restartDatabasePathEnv),
		repository: os.Getenv(restartRepositoryPathEnv),
		projection: os.Getenv(restartProjectionPathEnv),
		completion: os.Getenv(restartCompletionPathEnv),
	}
	if paths.database == "" || paths.repository == "" || paths.projection == "" || paths.completion == "" {
		t.Fatal("restart helper paths are incomplete")
	}
	return paths
}

func runRestartSubprocess(t *testing.T, mode string, paths restartHelperPaths) int {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	command := exec.CommandContext(
		ctx,
		os.Args[0],
		"-test.run=^TestCoreRestartJourney$",
		"-test.count=1",
	)
	command.Env = restartHelperEnvironment(mode, paths)
	var output boundedRestartOutput
	output.limit = maxRestartHelperOutputByte
	command.Stdout = &output
	command.Stderr = &output
	if err := command.Run(); err != nil {
		text := output.String()
		for _, sensitivePath := range []string{paths.database, paths.repository, paths.projection, paths.completion} {
			text = strings.ReplaceAll(text, sensitivePath, "<temporary-path>")
		}
		t.Fatalf("restart helper %s failed: %v\n%s", mode, err, text)
	}
	if command.Process == nil {
		t.Fatal("restart helper did not create a process")
	}
	return command.Process.Pid
}

func restartHelperEnvironment(mode string, paths restartHelperPaths) []string {
	keys := []string{
		restartHelperModeEnv,
		restartDatabasePathEnv,
		restartRepositoryPathEnv,
		restartProjectionPathEnv,
		restartCompletionPathEnv,
	}
	environment := make([]string, 0, len(os.Environ())+len(keys))
	for _, item := range os.Environ() {
		keep := true
		for _, key := range keys {
			if strings.HasPrefix(item, key+"=") {
				keep = false
				break
			}
		}
		if keep {
			environment = append(environment, item)
		}
	}
	return append(
		environment,
		restartHelperModeEnv+"="+mode,
		restartDatabasePathEnv+"="+paths.database,
		restartRepositoryPathEnv+"="+paths.repository,
		restartProjectionPathEnv+"="+paths.projection,
		restartCompletionPathEnv+"="+paths.completion,
	)
}

type boundedRestartOutput struct {
	mu        sync.Mutex
	buffer    bytes.Buffer
	limit     int
	truncated bool
}

func (w *boundedRestartOutput) Write(data []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	originalLength := len(data)
	remaining := w.limit - w.buffer.Len()
	if remaining > 0 {
		if len(data) > remaining {
			data = data[:remaining]
			w.truncated = true
		}
		_, _ = w.buffer.Write(data)
	} else if len(data) > 0 {
		w.truncated = true
	}
	return originalLength, nil
}

func (w *boundedRestartOutput) String() string {
	w.mu.Lock()
	defer w.mu.Unlock()
	result := w.buffer.String()
	if w.truncated {
		result += "\n<helper-output-truncated>"
	}
	return result
}

func initializeRestartRepository(t *testing.T, repositoryPath string) {
	t.Helper()
	if err := os.MkdirAll(repositoryPath, 0o755); err != nil {
		t.Fatalf("create temporary repository directory: %v", err)
	}
	runRestartGit(t, repositoryPath, "init", "--initial-branch=main")
	runRestartGit(t, repositoryPath, "config", "user.email", "restart@example.invalid")
	runRestartGit(t, repositoryPath, "config", "user.name", "Restart Journey")
	if err := os.WriteFile(filepath.Join(repositoryPath, "README.md"), []byte("restart journey\n"), 0o644); err != nil {
		t.Fatalf("write temporary repository file: %v", err)
	}
	runRestartGit(t, repositoryPath, "add", "README.md")
	runRestartGit(t, repositoryPath, "commit", "-m", "initial restart fixture")
}

func runRestartGit(t *testing.T, repositoryPath string, arguments ...string) {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", repositoryPath}, arguments...)...)
	var output boundedRestartOutput
	output.limit = maxRestartHelperOutputByte
	command.Stdout = &output
	command.Stderr = &output
	if err := command.Run(); err != nil {
		text := strings.ReplaceAll(output.String(), repositoryPath, "<temporary-repository>")
		t.Fatalf("temporary Git setup failed: %v\n%s", err, text)
	}
}

func writeBoundedRestartJSON(t *testing.T, path string, value any) {
	t.Helper()
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("encode restart helper result: %v", err)
	}
	if len(encoded) == 0 || len(encoded) > maxRestartResultBytes {
		t.Fatal("restart helper result exceeded its fixed bound")
	}
	if err := os.WriteFile(path, encoded, 0o600); err != nil {
		t.Fatalf("write restart helper result: %v", err)
	}
}

func readBoundedRestartJSON[T any](t *testing.T, path string) T {
	t.Helper()
	var result T
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat restart helper result: %v", err)
	}
	if info.Size() <= 0 || info.Size() > maxRestartResultBytes {
		t.Fatal("restart helper result has an invalid size")
	}
	encoded, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read restart helper result: %v", err)
	}
	decoder := json.NewDecoder(bytes.NewReader(encoded))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&result); err != nil {
		t.Fatalf("decode restart helper result: %v", err)
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		t.Fatal("restart helper result contains trailing JSON")
	}
	return result
}
