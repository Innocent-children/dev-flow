package store

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestSchema1MigrationIsTransactionalAndIdempotent(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "task store.db")

	first, err := Open(ctx, path)
	if err != nil {
		t.Fatalf("open new store: %v", err)
	}
	var firstAppliedAt, firstDigest string
	if err := first.db.QueryRowContext(
		ctx,
		`SELECT applied_at, digest FROM schema_migrations WHERE version = 1`,
	).Scan(&firstAppliedAt, &firstDigest); err != nil {
		t.Fatalf("read migration record: %v", err)
	}
	if firstDigest != migrationDigest(migrations[0]) {
		t.Fatalf("migration digest = %q, want %q", firstDigest, migrationDigest(migrations[0]))
	}
	for _, table := range requiredSchema1Tables {
		exists, err := tableExists(ctx, first.db, table)
		if err != nil {
			t.Fatalf("inspect table %q: %v", table, err)
		}
		if !exists {
			t.Errorf("schema table %q does not exist", table)
		}
	}
	if err := first.Close(); err != nil {
		t.Fatalf("close first store: %v", err)
	}

	second, err := Open(ctx, path)
	if err != nil {
		t.Fatalf("reopen migrated store: %v", err)
	}
	defer second.Close()
	var count int
	var secondAppliedAt, secondDigest string
	if err := second.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*), MIN(applied_at), MIN(digest) FROM schema_migrations`,
	).Scan(&count, &secondAppliedAt, &secondDigest); err != nil {
		t.Fatalf("read migration records after reopen: %v", err)
	}
	if count != 1 || secondAppliedAt != firstAppliedAt || secondDigest != firstDigest {
		t.Fatalf(
			"reopen changed migration record: count=%d applied_at=%q digest=%q",
			count,
			secondAppliedAt,
			secondDigest,
		)
	}
}

func TestSchema1MigrationRollsBackOnFailure(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "partial.db")
	raw := openRawDatabase(t, path)
	if _, err := raw.ExecContext(ctx, `CREATE TABLE tasks (wrong_column TEXT)`); err != nil {
		t.Fatalf("create incompatible partial table: %v", err)
	}
	if err := raw.Close(); err != nil {
		t.Fatalf("close partial database: %v", err)
	}

	if _, err := Open(ctx, path); !errors.Is(err, ErrSchemaUnsupported) {
		t.Fatalf("open partial database error = %v, want %v", err, ErrSchemaUnsupported)
	}

	raw = openRawDatabase(t, path)
	defer raw.Close()
	var migrationTableCount int
	if err := raw.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'`,
	).Scan(&migrationTableCount); err != nil {
		t.Fatalf("inspect rolled-back schema: %v", err)
	}
	if migrationTableCount != 0 {
		t.Fatalf("schema_migrations table count = %d, want 0 after rollback", migrationTableCount)
	}
	var partialTableCount int
	if err := raw.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'tasks'`,
	).Scan(&partialTableCount); err != nil {
		t.Fatalf("inspect pre-existing table: %v", err)
	}
	if partialTableCount != 1 {
		t.Fatalf("pre-existing tasks table count = %d, want 1", partialTableCount)
	}
}

func TestOpenRejectsFutureSchemaWithoutMutation(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "future.db")
	store, err := Open(ctx, path)
	if err != nil {
		t.Fatalf("open schema 1 store: %v", err)
	}
	if _, err := store.db.ExecContext(
		ctx,
		`INSERT INTO schema_migrations (version, applied_at, digest) VALUES (?, ?, ?)`,
		SchemaVersion+1,
		"2030-01-02T03:04:05Z",
		"future-schema-digest",
	); err != nil {
		t.Fatalf("install future migration marker: %v", err)
	}
	if err := store.Close(); err != nil {
		t.Fatalf("close future store: %v", err)
	}

	if _, err := Open(ctx, path); !errors.Is(err, ErrSchemaUnsupported) {
		t.Fatalf("open future schema error = %v, want %v", err, ErrSchemaUnsupported)
	}

	raw := openRawDatabase(t, path)
	defer raw.Close()
	var count int
	var appliedAt, digest string
	if err := raw.QueryRowContext(
		ctx,
		`SELECT COUNT(*), MAX(applied_at), MAX(digest) FROM schema_migrations WHERE version = ?`,
		SchemaVersion+1,
	).Scan(&count, &appliedAt, &digest); err != nil {
		t.Fatalf("read future migration after refusal: %v", err)
	}
	if count != 1 || appliedAt != "2030-01-02T03:04:05Z" || digest != "future-schema-digest" {
		t.Fatalf("future schema marker changed: count=%d applied_at=%q digest=%q", count, appliedAt, digest)
	}
}

func TestOpenRejectsChangedMigrationDigestWithoutRepair(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "digest.db")
	store, err := Open(ctx, path)
	if err != nil {
		t.Fatalf("open schema 1 store: %v", err)
	}
	const changedDigest = "changed-digest"
	if _, err := store.db.ExecContext(
		ctx,
		`UPDATE schema_migrations SET digest = ? WHERE version = 1`,
		changedDigest,
	); err != nil {
		t.Fatalf("change migration digest: %v", err)
	}
	if err := store.Close(); err != nil {
		t.Fatalf("close changed store: %v", err)
	}

	if _, err := Open(ctx, path); !errors.Is(err, ErrSchemaUnsupported) {
		t.Fatalf("open changed migration error = %v, want %v", err, ErrSchemaUnsupported)
	}

	raw := openRawDatabase(t, path)
	defer raw.Close()
	var got string
	if err := raw.QueryRowContext(
		ctx,
		`SELECT digest FROM schema_migrations WHERE version = 1`,
	).Scan(&got); err != nil {
		t.Fatalf("read changed digest after refusal: %v", err)
	}
	if got != changedDigest {
		t.Fatalf("digest after refusal = %q, want %q", got, changedDigest)
	}
}

func TestOpenSetsFixedConnectionPragmas(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(t.TempDir(), "pragmas.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer store.Close()

	var foreignKeys int
	if err := store.db.QueryRowContext(ctx, `PRAGMA foreign_keys`).Scan(&foreignKeys); err != nil {
		t.Fatalf("read foreign_keys pragma: %v", err)
	}
	if foreignKeys != 1 {
		t.Fatalf("foreign_keys = %d, want 1", foreignKeys)
	}
	var busyTimeout int64
	if err := store.db.QueryRowContext(ctx, `PRAGMA busy_timeout`).Scan(&busyTimeout); err != nil {
		t.Fatalf("read busy_timeout pragma: %v", err)
	}
	if want := domain.SQLiteBusyTimeout.Milliseconds(); busyTimeout != want {
		t.Fatalf("busy_timeout = %dms, want %dms", busyTimeout, want)
	}
}

func TestTaskCodecRoundTripsAndRejectsUnknownOrTrailingJSON(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 8, 14, 1, 2, 3, 4, time.UTC)
	task := validTask(t, "task-codec", digest("1"), t.TempDir(), now)
	encoded, err := encodeTask(task)
	if err != nil {
		t.Fatalf("encode valid task: %v", err)
	}
	decoded, err := decodeTask(encoded)
	if err != nil {
		t.Fatalf("decode valid task: %v", err)
	}
	if !reflect.DeepEqual(taskToDTO(decoded), taskToDTO(task)) {
		t.Fatalf("decoded task differs from encoded task\n got: %#v\nwant: %#v", decoded, task)
	}

	withWhitespace := append(append([]byte(nil), encoded...), '\n', '\t', ' ')
	if _, err := decodeTask(withWhitespace); err != nil {
		t.Fatalf("decode task with trailing whitespace: %v", err)
	}

	unknownTopLevel := append([]byte(nil), encoded[:len(encoded)-1]...)
	unknownTopLevel = append(unknownTopLevel, []byte(`,"unknown":true}`)...)
	if _, err := decodeTask(unknownTopLevel); !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("unknown top-level field error = %v, want %v", err, ErrStorageUnavailable)
	}

	unknownContract := bytes.Replace(
		encoded,
		[]byte(`"contract":{`),
		[]byte(`"contract":{"unknown":true,`),
		1,
	)
	if bytes.Equal(unknownContract, encoded) {
		t.Fatal("test fixture did not locate persisted contract")
	}
	if _, err := decodeTask(unknownContract); !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("unknown contract field error = %v, want %v", err, ErrStorageUnavailable)
	}

	trailingJSON := append(append([]byte(nil), encoded...), []byte(` {}`)...)
	if _, err := decodeTask(trailingJSON); !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("trailing JSON error = %v, want %v", err, ErrStorageUnavailable)
	}

	invalidAggregate := bytes.Replace(
		encoded,
		[]byte(`"revision":1,"created_at"`),
		[]byte(`"revision":2,"created_at"`),
		1,
	)
	if bytes.Equal(invalidAggregate, encoded) {
		t.Fatal("test fixture did not locate aggregate revision")
	}
	if _, err := decodeTask(invalidAggregate); !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("invalid aggregate error = %v, want %v", err, ErrStorageUnavailable)
	}

	for _, test := range []struct {
		name string
		from string
		to   string
	}{
		{name: "action kind", from: `"kind":"ASSESS_TASK"`, to: `"kind":"PLAN_CHANGE"`},
		{name: "payload contract", from: `"payload_contract":"INTAKE"`, to: `"payload_contract":"ASSESS"`},
		{name: "allowed effects", from: `"allowed_effects":["read_repository"]`, to: `"allowed_effects":["edit_repository_files"]`},
		{name: "required evidence", from: `"kind":"assessment_summary"`, to: `"kind":"delivery_summary"`},
	} {
		t.Run("noncanonical "+test.name, func(t *testing.T) {
			tampered := bytes.Replace(encoded, []byte(test.from), []byte(test.to), 1)
			if bytes.Equal(tampered, encoded) {
				t.Fatalf("test fixture did not locate %s", test.name)
			}
			if _, err := decodeTask(tampered); !errors.Is(err, ErrStorageUnavailable) {
				t.Fatalf("noncanonical %s error = %v, want %v", test.name, err, ErrStorageUnavailable)
			}
		})
	}

	oversized := make([]byte, domain.MaxPersistedTaskSnapshotBytes+1)
	if _, err := decodeTask(oversized); !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("oversized snapshot decode error = %v, want %v", err, ErrStorageUnavailable)
	}
}

func TestTaskCodecRejectsValidAggregateOverSnapshotLimit(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 8, 14, 2, 3, 4, 5, time.UTC)
	task := cancelledTask(t, validTask(t, "task-large", digest("2"), t.TempDir(), now), now.Add(time.Minute))

	task.Evidence = make([]domain.EvidenceSummary, domain.MaxRetainedEvidenceItems)
	for i := range task.Evidence {
		task.Evidence[i] = evidenceSummary(
			domain.ID(fmt.Sprintf("retained-%03d", i)),
			domain.EvidenceSourceStatic,
			now,
		)
	}
	task.Outcome.AutomatedChecks = make([]domain.EvidenceSummary, domain.MaxRetainedEvidenceItems)
	for i := range task.Outcome.AutomatedChecks {
		task.Outcome.AutomatedChecks[i] = evidenceSummary(
			domain.ID(fmt.Sprintf("automated-%03d", i)),
			domain.EvidenceSourceAutomated,
			now,
		)
	}
	task.Outcome.UnverifiedItems = maximalUniqueNarratives("unverified", "u")
	task.Outcome.Risks = maximalUniqueNarratives("risk", "r")
	if err := workflow.ValidateTask(task); err != nil {
		t.Fatalf("large aggregate must remain domain-valid: %v", err)
	}
	if _, err := encodeTask(task); !errors.Is(err, ErrInvalidArgument) {
		t.Fatalf("oversized valid task encode error = %v, want %v", err, ErrInvalidArgument)
	}
}

func TestCommitTaskUsesExactCASAndRollsBackFailedMutation(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	root := t.TempDir()
	store, err := Open(ctx, filepath.Join(root, "cas.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer store.Close()

	now := time.Date(2026, 8, 14, 3, 4, 5, 6, time.UTC)
	task := validTask(t, "task-cas", digest("3"), root, now)
	create := TaskMutation{
		Task:  task,
		Event: taskEvent("event-create", task, domain.PhaseIntake, now),
		Claim: ClaimAcquire,
	}
	if err := store.CommitTask(ctx, create); err != nil {
		t.Fatalf("create task: %v", err)
	}

	updated := advancedTask(t, task, domain.PhaseAssess, domain.ActionPlanChange, now.Add(time.Minute))
	update := TaskMutation{
		ExpectedRevision: 1,
		Task:             updated,
		Event:            taskEvent("event-update", updated, domain.PhaseIntake, now.Add(time.Minute)),
		Claim:            ClaimRetain,
	}
	if err := store.CommitTask(ctx, update); err != nil {
		t.Fatalf("update task with exact revision: %v", err)
	}
	assertPersistedRevisionParity(t, ctx, store.db, task.TaskID, 2, 2)

	loaded, err := store.LoadTask(ctx, task.TaskID)
	if err != nil {
		t.Fatalf("load updated task: %v", err)
	}
	if loaded.Revision != 2 || loaded.Phase != domain.PhaseAssess {
		t.Fatalf("loaded task revision/phase = %d/%s, want 2/%s", loaded.Revision, loaded.Phase, domain.PhaseAssess)
	}
	active, err := store.LoadActiveTask(ctx, task.Repository.RepositoryIdentity)
	if err != nil {
		t.Fatalf("load task through claim: %v", err)
	}
	if active.TaskID != task.TaskID {
		t.Fatalf("active task ID = %q, want %q", active.TaskID, task.TaskID)
	}

	stale := update
	stale.Event = taskEvent("event-stale", updated, domain.PhaseIntake, now.Add(2*time.Minute))
	if err := store.CommitTask(ctx, stale); !errors.Is(err, ErrRevisionConflict) {
		t.Fatalf("stale mutation error = %v, want %v", err, ErrRevisionConflict)
	}
	assertPersistedRevisionParity(t, ctx, store.db, task.TaskID, 2, 2)

	next := advancedTask(t, updated, domain.PhasePlan, domain.ActionImplementChange, now.Add(3*time.Minute))
	mismatchedEvent := taskEvent("event-mismatch", next, domain.PhaseAssess, now.Add(3*time.Minute))
	mismatchedEvent.Revision--
	if err := store.CommitTask(ctx, TaskMutation{
		ExpectedRevision: 2,
		Task:             next,
		Event:            mismatchedEvent,
		Claim:            ClaimRetain,
	}); !errors.Is(err, ErrInvalidArgument) {
		t.Fatalf("event revision mismatch error = %v, want %v", err, ErrInvalidArgument)
	}
	assertPersistedRevisionParity(t, ctx, store.db, task.TaskID, 2, 2)

	changedContract, err := domain.NewContract(
		"a changed immutable goal",
		nil,
		nil,
		[]string{"task is persisted"},
		next.Contract.VerificationBudget(),
	)
	if err != nil {
		t.Fatalf("construct changed contract: %v", err)
	}
	next.Contract = changedContract
	if err := store.CommitTask(ctx, TaskMutation{
		ExpectedRevision: 2,
		Task:             next,
		Event:            taskEvent("event-contract", next, domain.PhaseAssess, now.Add(3*time.Minute)),
		Claim:            ClaimRetain,
	}); !errors.Is(err, ErrInvalidArgument) {
		t.Fatalf("immutable contract mutation error = %v, want %v", err, ErrInvalidArgument)
	}
	assertPersistedRevisionParity(t, ctx, store.db, task.TaskID, 2, 2)

	next.Contract = updated.Contract
	duplicateEvent := taskEvent("event-update", next, domain.PhaseAssess, now.Add(3*time.Minute))
	if err := store.CommitTask(ctx, TaskMutation{
		ExpectedRevision: 2,
		Task:             next,
		Event:            duplicateEvent,
		Claim:            ClaimRetain,
	}); !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("duplicate event error = %v, want %v", err, ErrStorageUnavailable)
	}
	assertPersistedRevisionParity(t, ctx, store.db, task.TaskID, 2, 2)
}

func TestRepositoryClaimAcquireAndReleaseAreAtomic(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	root := t.TempDir()
	store, err := Open(ctx, filepath.Join(root, "claims.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer store.Close()

	now := time.Date(2026, 8, 14, 4, 5, 6, 7, time.UTC)
	repositoryIdentity := digest("4")
	first := validTask(t, "task-first", repositoryIdentity, root, now)
	if err := store.CommitTask(ctx, TaskMutation{
		Task:  first,
		Event: taskEvent("event-first", first, domain.PhaseIntake, now),
		Claim: ClaimAcquire,
	}); err != nil {
		t.Fatalf("create first claimed task: %v", err)
	}
	var claimedRepository, claimedTask, claimedHost string
	if err := store.db.QueryRowContext(
		ctx,
		`SELECT repository_identity, task_id, origin_host
		   FROM repository_claims
		  WHERE repository_identity = ?`,
		string(repositoryIdentity),
	).Scan(&claimedRepository, &claimedTask, &claimedHost); err != nil {
		t.Fatalf("read acquired claim: %v", err)
	}
	if claimedRepository != string(first.Repository.RepositoryIdentity) ||
		claimedTask != string(first.TaskID) || claimedHost != string(first.OriginHost) {
		t.Fatalf(
			"claim identity = %q/%q/%q, want %q/%q/%q",
			claimedRepository,
			claimedTask,
			claimedHost,
			first.Repository.RepositoryIdentity,
			first.TaskID,
			first.OriginHost,
		)
	}

	second := validTask(t, "task-second", repositoryIdentity, root, now.Add(time.Second))
	if err := store.CommitTask(ctx, TaskMutation{
		Task:  second,
		Event: taskEvent("event-second", second, domain.PhaseIntake, now.Add(time.Second)),
		Claim: ClaimAcquire,
	}); !errors.Is(err, ErrActiveTaskConflict) {
		t.Fatalf("duplicate claim error = %v, want %v", err, ErrActiveTaskConflict)
	}
	if _, err := store.LoadTask(ctx, second.TaskID); !errors.Is(err, ErrTaskNotFound) {
		t.Fatalf("rolled-back second task load error = %v, want %v", err, ErrTaskNotFound)
	}
	assertRowCount(t, ctx, store.db, `SELECT COUNT(*) FROM task_events WHERE task_id = ?`, string(second.TaskID), 0)
	assertRowCount(t, ctx, store.db, `SELECT COUNT(*) FROM repository_claims`, "", 1)

	cancelled := cancelledTask(t, first, now.Add(2*time.Minute))
	if err := store.CommitTask(ctx, TaskMutation{
		ExpectedRevision: 1,
		Task:             cancelled,
		Event:            taskEvent("event-first", cancelled, domain.PhaseIntake, now.Add(2*time.Minute)),
		Claim:            ClaimRelease,
	}); !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("failed release transaction error = %v, want %v", err, ErrStorageUnavailable)
	}
	assertPersistedRevisionParity(t, ctx, store.db, first.TaskID, 1, 1)
	if active, err := store.LoadActiveTask(ctx, repositoryIdentity); err != nil || active.TaskID != first.TaskID {
		t.Fatalf("claim changed after rolled-back release: task=%q error=%v", active.TaskID, err)
	}

	if err := store.CommitTask(ctx, TaskMutation{
		ExpectedRevision: 1,
		Task:             cancelled,
		Event:            taskEvent("event-cancel", cancelled, domain.PhaseIntake, now.Add(2*time.Minute)),
		Claim:            ClaimRelease,
	}); err != nil {
		t.Fatalf("cancel and release task: %v", err)
	}
	if _, err := store.LoadActiveTask(ctx, repositoryIdentity); !errors.Is(err, ErrTaskNotFound) {
		t.Fatalf("load released repository error = %v, want %v", err, ErrTaskNotFound)
	}
	loaded, err := store.LoadTask(ctx, first.TaskID)
	if err != nil {
		t.Fatalf("load cancelled task: %v", err)
	}
	if loaded.Phase != domain.PhaseCancelled || loaded.Revision != 2 {
		t.Fatalf("cancelled task revision/phase = %d/%s, want 2/%s", loaded.Revision, loaded.Phase, domain.PhaseCancelled)
	}
	assertPersistedRevisionParity(t, ctx, store.db, first.TaskID, 2, 2)
	assertRowCount(t, ctx, store.db, `SELECT COUNT(*) FROM repository_claims`, "", 0)
}

func TestStoreErrorsDoNotExposeDatabasePath(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "private-component", "store.db")
	_, err := Open(context.Background(), path)
	if !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("open unavailable path error = %v, want %v", err, ErrStorageUnavailable)
	}
	if strings.Contains(err.Error(), path) || strings.Contains(err.Error(), "private-component") {
		t.Fatalf("store error exposes database path: %q", err)
	}
}

func openRawDatabase(t *testing.T, path string) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatalf("open raw database: %v", err)
	}
	if err := db.Ping(); err != nil {
		_ = db.Close()
		t.Fatalf("ping raw database: %v", err)
	}
	return db
}

func validTask(
	t *testing.T,
	taskID string,
	repositoryIdentity domain.Digest,
	canonicalRoot string,
	now time.Time,
) domain.Task {
	t.Helper()
	contract, err := domain.NewContract(
		"persist one governed task",
		nil,
		nil,
		[]string{"task is persisted"},
		domain.VerificationBudget{
			Level:                domain.VerificationTargeted,
			MaxAutomaticCommands: 2,
			AllowManualHandoff:   true,
		},
	)
	if err != nil {
		t.Fatalf("construct contract: %v", err)
	}
	branch := "main"
	head := strings.Repeat("a", 40)
	binding := domain.RepositoryBinding{
		CanonicalRoot:       filepath.Clean(canonicalRoot),
		GitCommonDirDigest:  digest("a"),
		RepositoryIdentity:  repositoryIdentity,
		Branch:              &branch,
		Head:                &head,
		WorktreeFingerprint: digest("b"),
		ObservedAt:          now,
		BindingDigest:       digest("c"),
	}
	action, err := workflow.BuildNextAction(
		domain.PhaseIntake,
		domain.ID(taskID),
		1,
		binding.BindingDigest,
		domain.ID("action-"+taskID+"-1"),
		now,
	)
	if err != nil {
		t.Fatalf("construct initial action: %v", err)
	}
	task := domain.Task{
		TaskID:        domain.ID(taskID),
		OriginHost:    domain.HostCodex,
		Contract:      contract,
		Repository:    binding,
		Phase:         domain.PhaseIntake,
		CurrentAction: &action,
		Revision:      1,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := workflow.ValidateTask(task); err != nil {
		t.Fatalf("construct valid task: %v", err)
	}
	return task
}

func advancedTask(
	t *testing.T,
	task domain.Task,
	phase domain.Phase,
	actionKind domain.ActionKind,
	at time.Time,
) domain.Task {
	t.Helper()
	next := task.Clone()
	next.Revision++
	next.Phase = phase
	next.UpdatedAt = at
	action, err := workflow.BuildNextAction(
		phase,
		task.TaskID,
		next.Revision,
		task.Repository.BindingDigest,
		domain.ID(fmt.Sprintf("action-%s-%d", task.TaskID, next.Revision)),
		at,
	)
	if err != nil {
		t.Fatalf("construct advanced action: %v", err)
	}
	if action.Kind != actionKind {
		t.Fatalf("action kind for phase %s = %s, want %s", phase, action.Kind, actionKind)
	}
	next.CurrentAction = &action
	if err := workflow.ValidateTask(next); err != nil {
		t.Fatalf("construct advanced task: %v", err)
	}
	return next
}

func cancelledTask(t *testing.T, task domain.Task, at time.Time) domain.Task {
	t.Helper()
	next := task.Clone()
	next.Revision++
	next.Phase = domain.PhaseCancelled
	next.CurrentAction = nil
	next.UpdatedAt = at
	next.CompletedAt = &at
	next.Outcome = &domain.Outcome{
		Status: domain.TerminalCancelled,
		Acceptance: []domain.OutcomeCriterion{{
			Criterion: task.Contract.AcceptanceCriteria()[0],
			Status:    domain.CriterionUnverified,
		}},
		FinalRepositoryBindingDigest: task.Repository.BindingDigest,
		Summary:                      "Task cancelled by the caller.",
		CompletedAt:                  at,
	}
	if err := workflow.ValidateTask(next); err != nil {
		t.Fatalf("construct cancelled task: %v", err)
	}
	return next
}

func taskEvent(
	eventID string,
	task domain.Task,
	phaseBefore domain.Phase,
	at time.Time,
) TaskEvent {
	return TaskEvent{
		EventID:       domain.ID(eventID),
		TaskID:        task.TaskID,
		Revision:      task.Revision,
		EventType:     "task_mutated",
		PhaseBefore:   phaseBefore,
		PhaseAfter:    task.Phase,
		RequestID:     domain.ID("request-" + eventID),
		PayloadDigest: digest("d"),
		CreatedAt:     at,
	}
}

func digest(character string) domain.Digest {
	return domain.Digest(strings.Repeat(character, 64))
}

func evidenceSummary(id domain.ID, source domain.EvidenceSource, at time.Time) domain.EvidenceSummary {
	return domain.EvidenceSummary{
		EvidenceID: id,
		Source:     source,
		Name:       "bounded evidence",
		Status:     domain.EvidenceObserved,
		Summary:    strings.Repeat("s", domain.MaxEvidenceSummaryBytes),
		Digest:     digest("e"),
		RecordedAt: at,
	}
}

func maximalUniqueNarratives(prefix, fill string) []string {
	values := make([]string, domain.MaxBoundedStringListItems)
	for i := range values {
		leader := fmt.Sprintf("%s-%02d-", prefix, i)
		values[i] = leader + strings.Repeat(fill, domain.MaxReasonBytes-len(leader))
	}
	return values
}

func assertPersistedRevisionParity(
	t *testing.T,
	ctx context.Context,
	db *sql.DB,
	taskID domain.ID,
	wantTaskRevision uint64,
	wantEventCount int,
) {
	t.Helper()
	var taskRevision, eventRevision int64
	var eventCount int
	if err := db.QueryRowContext(
		ctx,
		`SELECT t.revision, COUNT(e.event_id), COALESCE(MAX(e.revision), 0)
		   FROM tasks AS t
		   LEFT JOIN task_events AS e ON e.task_id = t.task_id
		  WHERE t.task_id = ?
		  GROUP BY t.revision`,
		string(taskID),
	).Scan(&taskRevision, &eventCount, &eventRevision); err != nil {
		t.Fatalf("read persisted revision parity: %v", err)
	}
	if uint64(taskRevision) != wantTaskRevision ||
		eventCount != wantEventCount ||
		eventRevision != taskRevision {
		t.Fatalf(
			"task/event parity = task revision %d, event count %d, latest event %d; want %d/%d/%d",
			taskRevision,
			eventCount,
			eventRevision,
			wantTaskRevision,
			wantEventCount,
			wantTaskRevision,
		)
	}
}

func assertRowCount(
	t *testing.T,
	ctx context.Context,
	db *sql.DB,
	query string,
	argument string,
	want int,
) {
	t.Helper()
	var got int
	var err error
	if argument == "" {
		err = db.QueryRowContext(ctx, query).Scan(&got)
	} else {
		err = db.QueryRowContext(ctx, query, argument).Scan(&got)
	}
	if err != nil {
		t.Fatalf("read row count: %v", err)
	}
	if got != want {
		t.Fatalf("row count = %d, want %d", got, want)
	}
}
