package store

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestSchemaHistorySafeStopMatrix(t *testing.T) {
	cases := []struct {
		name   string
		mutate string
	}{
		{"pre-graph history 1", `UPDATE schema_migrations SET version=1`},
		{"mixed history 1 2", `INSERT INTO schema_migrations VALUES(1,'old','old')`},
		{"future history 3", `UPDATE schema_migrations SET version=3`},
		{"future history 2 3", `INSERT INTO schema_migrations VALUES(3,'future','future')`},
		{"gapped history 2 4", `INSERT INTO schema_migrations VALUES(4,'future','future')`},
		{"Schema 2 digest mismatch", `UPDATE schema_migrations SET digest='ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'`},
		{"missing Schema 2 history row", `DELETE FROM schema_migrations`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			path := exactSchema2Database(t)
			db := openRaw(t, path)
			if _, err := db.Exec(tc.mutate); err != nil {
				t.Fatal(err)
			}
			db.Close()
			assertSafeStop(t, path, ErrSchemaUnsupported)
		})
	}
}

func TestPartialSchema2SafeStopMatrix(t *testing.T) {
	cases := []struct {
		name   string
		change func([]string) []string
	}{
		{"missing tasks table", func(statements []string) []string { return withoutSchemaStatements(statements, 1, 2, 3, 4, 5) }},
		{"missing task_events table", func(statements []string) []string { return withoutSchemaStatements(statements, 6) }},
		{"missing repository_claims table", func(statements []string) []string { return withoutSchemaStatements(statements, 7) }},
		{"missing schema_migrations table", func(statements []string) []string { return withoutSchemaStatements(statements, 0) }},
		{"missing required column", func(statements []string) []string {
			statements[1] = strings.Replace(statements[1], `origin_host TEXT NOT NULL, `, ``, 1)
			return withoutSchemaStatements(statements, 3)
		}},
		{"wrong column type", replaceSchemaStatement(1, `origin_host TEXT NOT NULL`, `origin_host BLOB NOT NULL`)},
		{"missing required index", func(statements []string) []string { return withoutSchemaStatements(statements, 4) }},
		{"wrong snapshot constraint", replaceSchemaStatement(1, `CHECK (snapshot_version = 2)`, `CHECK (snapshot_version >= 1)`)},
		{"wrong process constraint", replaceSchemaStatement(1, `CHECK (process_version >= 1)`, `CHECK (process_version >= 0)`)},
		{"extra task column", replaceSchemaStatement(1, `updated_at TEXT NOT NULL)`, `updated_at TEXT NOT NULL, compatibility_state TEXT)`)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			path := dbPath(t)
			db := openRaw(t, path)
			statements := tc.change(append([]string(nil), schema2Statements...))
			for _, statement := range statements {
				if _, err := db.Exec(statement); err != nil {
					t.Fatal(err)
				}
			}
			var historyTable int
			if err := db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='schema_migrations'`).Scan(&historyTable); err != nil {
				t.Fatal(err)
			}
			if historyTable == 1 {
				if _, err := db.Exec(`INSERT INTO schema_migrations(version,applied_at,digest) VALUES(2,'2026-08-19T00:00:00Z',?)`, schema2Digest()); err != nil {
					t.Fatal(err)
				}
			}
			db.Close()
			assertSafeStop(t, path, ErrSchemaUnsupported)
		})
	}
}

func TestUnsupportedProcessAndDigestSafeStopMatrix(t *testing.T) {
	cases := []struct {
		name           string
		rowMutation    string
		snapshotMutate func(*domain.ProcessTask)
		want           error
	}{
		{"unknown process id", `UPDATE tasks SET process_id='future-process'`, nil, ErrProcessUnsupported},
		{"future process version", `UPDATE tasks SET process_version=2`, nil, ErrProcessUnsupported},
		{"definition digest mismatch", `UPDATE tasks SET process_definition_digest='ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'`, nil, ErrProcessUnsupported},
		{"row snapshot process disagreement", ``, func(task *domain.ProcessTask) { task.Process.ID = "future-process" }, ErrStorageUnavailable},
		{"row snapshot process version disagreement", ``, func(task *domain.ProcessTask) { task.Process.Version = 2 }, ErrStorageUnavailable},
		{"row snapshot digest disagreement", ``, func(task *domain.ProcessTask) { task.Process.DefinitionDigest = domain.Digest(strings.Repeat("f", 64)) }, ErrStorageUnavailable},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			task := testGraphTask(t)
			path := taskDatabase(t, task, mustJSONTask(t, task))
			db := openRaw(t, path)
			if tc.snapshotMutate != nil {
				tc.snapshotMutate(&task)
				if _, err := db.Exec(`UPDATE tasks SET snapshot=?`, mustJSONTask(t, task)); err != nil {
					t.Fatal(err)
				}
			}
			if tc.rowMutation != "" {
				if _, err := db.Exec(tc.rowMutation); err != nil {
					t.Fatal(err)
				}
			}
			db.Close()
			assertSafeStop(t, path, tc.want)
		})
	}
}

func TestCorruptSnapshotSafeStopMatrix(t *testing.T) {
	base := testGraphTask(t)
	valid, err := encodeTask(base)
	if err != nil {
		t.Fatal(err)
	}
	unknown := append(bytes.TrimSuffix(valid, []byte("}")), []byte(`,"unknown":true}`)...)
	duplicate := append([]byte(`{"task_id":"task",`), valid[1:]...)
	overLimit := base
	overLimit.Intent.Request = strings.Repeat("x", domain.MaxPersistedTaskSnapshotBytes)
	invalidNode := base
	invalidNode.CurrentNode = "FUTURE_NODE"
	downstream := base
	downstream.Design = &domain.DesignBaseline{Revision: 1, Digest: base.Repository.BindingDigest, RequirementsRevision: 1, Approach: "Impossible design", Decisions: []string{"Corrupt downstream authority"}, CreatedAt: base.CreatedAt}
	lastOperation := base
	lastOperation.LastOperation = &domain.LastOperation{OperationID: "operation", Kind: domain.OperationApplyAction, FromRevision: 1, ToRevision: 2, PayloadDigest: base.Repository.BindingDigest, CommittedAt: base.CreatedAt}

	cases := []struct {
		name string
		task domain.ProcessTask
		raw  []byte
	}{
		{"malformed JSON", base, []byte(`{"task_id":`)},
		{"duplicate JSON member", base, duplicate},
		{"unknown snapshot member", base, unknown},
		{"trailing JSON", base, append(append([]byte(nil), valid...), []byte(` {}`)...)},
		{"invalid UTF-8", base, []byte{0xff, 0xfe, 0xfd}},
		{"over-limit aggregate", overLimit, mustJSONTask(t, overLimit)},
		{"invalid current node", invalidNode, mustJSONTask(t, invalidNode)},
		{"downstream authority retained", downstream, mustJSONTask(t, downstream)},
		{"LastOperation revision contradiction", lastOperation, mustJSONTask(t, lastOperation)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			path := taskDatabase(t, tc.task, tc.raw)
			assertSafeStop(t, path, ErrStorageUnavailable)
		})
	}
}

func TestActionAuthorityAndAggregateCorruptionSafeStopMatrix(t *testing.T) {
	actionCases := []struct {
		name   string
		mutate func(*domain.ProcessTask)
	}{
		{"action task mismatch", func(task *domain.ProcessTask) { task.CurrentAction.TaskID = "other-task" }},
		{"action revision mismatch", func(task *domain.ProcessTask) { task.CurrentAction.Revision++ }},
		{"action process mismatch", func(task *domain.ProcessTask) { task.CurrentAction.Process.Version++ }},
		{"action node mismatch", func(task *domain.ProcessTask) { task.CurrentAction.NodeID = domain.NodeDesign }},
		{"action binding mismatch", func(task *domain.ProcessTask) {
			task.CurrentAction.RepositoryBindingDigest = domain.Digest(strings.Repeat("f", 64))
		}},
		{"invalid action blueprint", func(task *domain.ProcessTask) { task.CurrentAction.PayloadContract = "future-result@9" }},
	}
	for _, tc := range actionCases {
		t.Run(tc.name, func(t *testing.T) {
			task := testGraphTask(t)
			tc.mutate(&task)
			path := taskDatabase(t, task, mustJSONTask(t, task))
			assertSafeStop(t, path, ErrStorageUnavailable)
		})
	}

	t.Run("missing current node authority", func(t *testing.T) {
		task := testGraphTask(t)
		task.CurrentNode = domain.NodeDesign
		action, err := workflow.BuildProcessAction(workflow.StandardProcess(), task.CurrentNode, task.TaskID, task.Revision, task.Repository.BindingDigest, task.Intent.MethodProfile, "design-action", task.CreatedAt)
		if err != nil {
			t.Fatal(err)
		}
		task.CurrentAction = &action
		path := taskDatabase(t, task, mustJSONTask(t, task))
		assertSafeStop(t, path, ErrStorageUnavailable)
	})

	aggregateCases := []struct {
		name   string
		mutate func(*domain.ProcessTask)
	}{
		{"invalid baseline chain", func(task *domain.ProcessTask) { task.Design.RequirementsRevision++ }},
		{"invalid Test evidence reference", func(task *domain.ProcessTask) { task.Test.EvidenceIDs = []domain.ID{"missing-evidence"} }},
		{"invalid Comprehension authority", func(task *domain.ProcessTask) { task.Comprehension.TestRecordID = "other-test" }},
	}
	for _, tc := range aggregateCases {
		t.Run(tc.name, func(t *testing.T) {
			task := fullGraphTask(t)
			tc.mutate(&task)
			path := taskDatabase(t, task, mustJSONTask(t, task))
			assertSafeStop(t, path, ErrStorageUnavailable)
		})
	}

	t.Run("invalid completed Outcome", func(t *testing.T) {
		task := fullGraphTask(t)
		task.CurrentNode = domain.NodeDone
		task.CurrentAction = nil
		task.CompletedAt = &task.UpdatedAt
		task.Outcome = &domain.ProcessOutcome{
			Status: domain.TerminalCompleted, Summary: "Completed with corrupt evidence.", RequirementsRevision: task.Requirements.Revision,
			Acceptance:   []domain.OutcomeCriterion{{Criterion: task.Requirements.AcceptanceCriteria[0], Status: domain.CriterionSatisfied}},
			TestRecordID: task.Test.RecordID, ComprehensionRecordID: task.Comprehension.RecordID,
			AutomatedEvidenceIDs: []domain.ID{"automated"}, ManualEvidenceIDs: nil,
			FinalRepositoryDigest: task.Repository.BindingDigest, CompletedAt: task.UpdatedAt,
		}
		path := taskDatabase(t, task, mustJSONTask(t, task))
		assertSafeStop(t, path, ErrStorageUnavailable)
	})
}

func TestBlockerAndRecoveryCorruptionSafeStopMatrix(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*domain.ProcessTask)
	}{
		{"blocker resume node mismatch", func(task *domain.ProcessTask) { task.Blocker.ResumeNode = domain.NodeDesign }},
		{"BLOCKED without RESOLVE_BLOCKER action", func(task *domain.ProcessTask) { task.CurrentAction = nil }},
		{"recovery action process mismatch", func(task *domain.ProcessTask) { task.CurrentAction.Process.Version++ }},
		{"recovery action source mismatch", func(task *domain.ProcessTask) { task.CurrentAction.NodeID = domain.NodeRequirements }},
		{"recovery LastOperation revision mismatch", func(task *domain.ProcessTask) { task.LastOperation.ToRevision++ }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			task := blockedGraphTask(t)
			tc.mutate(&task)
			path := taskDatabase(t, task, mustJSONTask(t, task))
			assertSafeStop(t, path, ErrStorageUnavailable)
		})
	}
}

func exactSchema2Database(t *testing.T) string {
	t.Helper()
	path := dbPath(t)
	opened, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	if err := opened.Close(); err != nil {
		t.Fatal(err)
	}
	return path
}

func replaceSchemaStatement(index int, old, replacement string) func([]string) []string {
	return func(statements []string) []string {
		statements[index] = strings.Replace(statements[index], old, replacement, 1)
		return statements
	}
}

func withoutSchemaStatements(statements []string, indexes ...int) []string {
	skip := map[int]bool{}
	for _, index := range indexes {
		skip[index] = true
	}
	result := make([]string, 0, len(statements)-len(indexes))
	for index, statement := range statements {
		if !skip[index] {
			result = append(result, statement)
		}
	}
	return result
}

func taskDatabase(t *testing.T, task domain.ProcessTask, snapshot []byte) string {
	t.Helper()
	path := exactSchema2Database(t)
	db := openRaw(t, path)
	_, err := db.Exec(`INSERT INTO tasks(task_id,origin_host,process_id,process_version,process_definition_digest,snapshot_version,current_node,revision,repository_identity,snapshot,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
		task.TaskID, task.OriginHost, task.Process.ID, task.Process.Version, task.Process.DefinitionDigest, SnapshotVersion, task.CurrentNode, task.Revision, task.Repository.RepositoryIdentity, snapshot, formatTime(task.CreatedAt), formatTime(task.UpdatedAt))
	if err != nil {
		t.Fatal(err)
	}
	if !task.CurrentNode.Terminal() {
		if _, err := db.Exec(`INSERT INTO repository_claims(repository_identity,task_id,origin_host,claimed_at) VALUES(?,?,?,?)`, task.Repository.RepositoryIdentity, task.TaskID, task.OriginHost, formatTime(task.CreatedAt)); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	return path
}

func mustJSONTask(t *testing.T, task domain.ProcessTask) []byte {
	t.Helper()
	raw, err := json.Marshal(persistedTaskV2(task))
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func assertSafeStop(t *testing.T, path string, want error) {
	t.Helper()
	before := databaseManifest(t, path)
	opened, err := Open(context.Background(), path)
	if opened != nil {
		opened.Close()
	}
	if !errors.Is(err, want) {
		t.Fatalf("error=%v want=%v", err, want)
	}
	assertDatabaseManifestUnchanged(t, path, before)
}

func fullGraphTask(t *testing.T) domain.ProcessTask {
	t.Helper()
	task := testGraphTask(t)
	now := task.CreatedAt
	digest := task.Repository.BindingDigest
	task.Requirements = &domain.RequirementsBaseline{Revision: 1, Digest: digest, Goal: "Current goal", AcceptanceCriteria: []string{"Accepted behavior"}, CreatedAt: now}
	task.Design = &domain.DesignBaseline{Revision: 1, Digest: digest, RequirementsRevision: 1, Approach: "Direct design", Decisions: []string{"Reuse the current boundary"}, CreatedAt: now}
	task.TaskPlan = &domain.TaskPlanBaseline{Revision: 1, Digest: digest, DesignRevision: 1, WorkItems: []domain.WorkItem{{WorkItemID: "work", Summary: "Implement work", ExpectedPaths: []string{"internal/work.go"}, AcceptanceIndexes: []uint32{0}, VerificationSteps: []string{"Run targeted tests"}}}, CreatedAt: now}
	task.Implementation = &domain.ImplementationRecord{Revision: 1, TaskPlanRevision: 1, RepositoryBindingDigest: digest, CompletedWorkItemIDs: []domain.ID{"work"}, NoFileChanges: true, Summary: "Implemented work", CreatedAt: now}
	task.Evidence = []domain.EvidenceSummary{
		{EvidenceID: "automated", Source: domain.EvidenceSourceAutomated, Name: "targeted", Status: domain.EvidencePassed, Summary: "Targeted tests passed", Digest: digest, CommandCount: 1, RecordedAt: now},
		{EvidenceID: "user", Source: domain.EvidenceSourceUser, Name: "confirmation", Status: domain.EvidencePassed, Summary: "User confirmed understanding", Digest: digest, RecordedAt: now},
	}
	task.Test = &domain.TestRecord{RecordID: "test", RequirementsRevision: 1, DesignRevision: 1, TaskPlanRevision: 1, RepositoryBindingDigest: digest, EvidenceIDs: []domain.ID{"automated"}, PassedAt: now}
	task.Comprehension = &domain.ComprehensionAssessment{RecordID: "comprehension", TestRecordID: "test", RequirementsRevision: 1, DesignRevision: 1, TaskPlanRevision: 1, RepositoryBindingDigest: digest, ExplainedComponents: []string{"component"}, UserEvidenceID: "user", ConfirmedAt: now}
	task.CurrentNode = domain.NodeDelivery
	action, err := workflow.BuildProcessAction(workflow.StandardProcess(), task.CurrentNode, task.TaskID, task.Revision, digest, task.Intent.MethodProfile, "delivery-action", now)
	if err != nil {
		t.Fatal(err)
	}
	task.CurrentAction = &action
	if err := workflow.ValidateProcessTask(task); err != nil {
		t.Fatalf("full task fixture is invalid: %v", err)
	}
	return task
}

func blockedGraphTask(t *testing.T) domain.ProcessTask {
	t.Helper()
	task := testGraphTask(t)
	resume := task.CurrentNode
	originalActionID := task.CurrentAction.ActionID
	task.CurrentNode = domain.NodeBlocked
	task.ResumeNode = &resume
	task.Revision = 2
	task.UpdatedAt = task.CreatedAt.Add(1)
	task.Blocker = &domain.ProcessBlocker{
		BlockerID: "blocker", Code: domain.ErrorTaskBlocked, Cause: domain.RecoveryPartiallyCompleted,
		Message: "Restore the issuance binding before continuing.", ResumeNode: resume,
		ObservedBindingDigest: domain.Digest(strings.Repeat("d", 64)),
		Condition:             domain.BlockerCondition{Kind: domain.BlockerConditionRestoreIssuanceBinding, ExpectedBindingDigest: task.Repository.BindingDigest},
		RequiredResolution:    "Restore the exact issuance binding.", CreatedAt: task.UpdatedAt,
	}
	action, err := workflow.BuildProcessAction(workflow.StandardProcess(), task.CurrentNode, task.TaskID, task.Revision, task.Repository.BindingDigest, task.Intent.MethodProfile, "resolve-action", task.UpdatedAt)
	if err != nil {
		t.Fatal(err)
	}
	task.CurrentAction = &action
	payload := domain.Digest(strings.Repeat("e", 64))
	task.LastOperation = &domain.LastOperation{OperationID: "uncertain-operation", Kind: domain.OperationApplyAction, ActionID: &originalActionID, FromRevision: 1, ToRevision: 2, PayloadDigest: payload, CommittedAt: task.UpdatedAt}
	if err := workflow.ValidateProcessTask(task); err != nil {
		t.Fatalf("blocked task fixture is invalid: %v", err)
	}
	return task
}
