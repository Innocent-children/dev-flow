package recovery

import (
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestReconcileRepositoryBindingMatrix(t *testing.T) {
	issued := recoveryBinding()

	t.Run("structured relation", func(t *testing.T) {
		tests := []struct {
			name     string
			mutate   func(*domain.RepositoryBinding)
			relation RepositoryRelation
		}{
			{name: "exact", mutate: func(*domain.RepositoryBinding) {}, relation: RepositoryExact},
			{name: "observed_at excluded", mutate: func(value *domain.RepositoryBinding) { value.ObservedAt = value.ObservedAt.Add(time.Minute) }, relation: RepositoryExact},
			{name: "tracked worktree only", mutate: func(value *domain.RepositoryBinding) {
				value.WorktreeFingerprint = recoveryDigest("3")
				value.BindingDigest = recoveryDigest("4")
			}, relation: RepositoryWorktreeOnlyChanged},
			{name: "untracked worktree only", mutate: func(value *domain.RepositoryBinding) {
				value.WorktreeFingerprint = recoveryDigest("5")
				value.BindingDigest = recoveryDigest("6")
			}, relation: RepositoryWorktreeOnlyChanged},
			{name: "worktree changed but final digest did not", mutate: func(value *domain.RepositoryBinding) { value.WorktreeFingerprint = recoveryDigest("7") }, relation: RepositoryForbiddenChange},
			{name: "final digest changed but worktree did not", mutate: func(value *domain.RepositoryBinding) { value.BindingDigest = recoveryDigest("8") }, relation: RepositoryForbiddenChange},
			{name: "canonical root", mutate: func(value *domain.RepositoryBinding) {
				value.CanonicalRoot = "/public/other"
				value.RepositoryIdentity = recoveryDigest("9")
				value.BindingDigest = recoveryDigest("a")
			}, relation: RepositoryForbiddenChange},
			{name: "repository identity", mutate: func(value *domain.RepositoryBinding) {
				value.RepositoryIdentity = recoveryDigest("b")
				value.BindingDigest = recoveryDigest("c")
			}, relation: RepositoryForbiddenChange},
			{name: "Git common-directory digest", mutate: func(value *domain.RepositoryBinding) {
				value.GitCommonDirDigest = recoveryDigest("d")
				value.RepositoryIdentity = recoveryDigest("e")
				value.BindingDigest = recoveryDigest("f")
			}, relation: RepositoryForbiddenChange},
			{name: "branch", mutate: func(value *domain.RepositoryBinding) {
				branch := "feature"
				value.Branch = &branch
				value.BindingDigest = recoveryDigest("3")
			}, relation: RepositoryForbiddenChange},
			{name: "detached", mutate: func(value *domain.RepositoryBinding) {
				value.Branch = nil
				value.Detached = true
				value.BindingDigest = recoveryDigest("4")
			}, relation: RepositoryForbiddenChange},
			{name: "HEAD", mutate: func(value *domain.RepositoryBinding) {
				head := strings.Repeat("2", 40)
				value.Head = &head
				value.BindingDigest = recoveryDigest("5")
			}, relation: RepositoryForbiddenChange},
			{name: "unborn", mutate: func(value *domain.RepositoryBinding) {
				value.Head = nil
				value.Unborn = true
				value.BindingDigest = recoveryDigest("6")
			}, relation: RepositoryForbiddenChange},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				fresh := issued.Clone()
				tt.mutate(&fresh)
				if err := fresh.Validate(); err != nil {
					t.Fatalf("fresh binding shape is invalid: %v", err)
				}
				relation, err := CompareRepositoryBindings(issued, fresh)
				if err != nil {
					t.Fatalf("CompareRepositoryBindings() error = %v", err)
				}
				if relation != tt.relation {
					t.Fatalf("relation = %q, want %q", relation, tt.relation)
				}
			})
		}
	})

	t.Run("normal action acceptance has one authority", func(t *testing.T) {
		tests := []struct {
			action   domain.ActionKind
			relation RepositoryRelation
			accepted bool
		}{
			{action: domain.ActionImplementChange, relation: RepositoryExact, accepted: true},
			{action: domain.ActionImplementChange, relation: RepositoryWorktreeOnlyChanged, accepted: true},
			{action: domain.ActionImplementChange, relation: RepositoryForbiddenChange, accepted: false},
			{action: domain.ActionAssessTask, relation: RepositoryExact, accepted: true},
			{action: domain.ActionPlanChange, relation: RepositoryWorktreeOnlyChanged, accepted: false},
			{action: domain.ActionVerifyChange, relation: RepositoryForbiddenChange, accepted: false},
			{action: domain.ActionResolveBlocker, relation: RepositoryExact, accepted: true},
			{action: domain.ActionResolveBlocker, relation: RepositoryWorktreeOnlyChanged, accepted: false},
		}
		for _, tt := range tests {
			accepted, err := BindingAcceptedForAction(tt.action, tt.relation)
			if err != nil {
				t.Fatalf("BindingAcceptedForAction(%q, %q) error = %v", tt.action, tt.relation, err)
			}
			if accepted != tt.accepted {
				t.Fatalf("BindingAcceptedForAction(%q, %q) = %t, want %t", tt.action, tt.relation, accepted, tt.accepted)
			}
		}
	})

	t.Run("restore_issuance_binding condition is exact", func(t *testing.T) {
		condition, err := DeriveRestoreIssuanceCondition(issued)
		if err != nil {
			t.Fatalf("DeriveRestoreIssuanceCondition() error = %v", err)
		}
		if condition.Kind != domain.BlockerConditionRestoreIssuanceBinding ||
			condition.ExpectedBindingDigest != issued.BindingDigest {
			t.Fatalf("condition = %#v", condition)
		}
		fresh := issued.Clone()
		fresh.ObservedAt = fresh.ObservedAt.Add(time.Minute)
		satisfied, err := RestoreIssuanceBindingSatisfied(condition, issued, fresh)
		if err != nil || !satisfied {
			t.Fatalf("exact restoration = %t, error = %v", satisfied, err)
		}

		fresh.WorktreeFingerprint = recoveryDigest("3")
		fresh.BindingDigest = recoveryDigest("4")
		satisfied, err = RestoreIssuanceBindingSatisfied(condition, issued, fresh)
		if err != nil || satisfied {
			t.Fatalf("worktree-only restoration = %t, error = %v", satisfied, err)
		}

		stale := condition
		stale.ExpectedBindingDigest = recoveryDigest("5")
		satisfied, err = RestoreIssuanceBindingSatisfied(stale, issued, issued)
		if err != nil || satisfied {
			t.Fatalf("stale condition = %t, error = %v", satisfied, err)
		}
	})

	t.Run("operation relation is derived from the latest LastOperation only", func(t *testing.T) {
		task := reconciliationTask(t)
		operation := OperationReference{
			OperationID:      "request-original",
			SourcePhase:      domain.PhasePlan,
			ExpectedRevision: task.Revision,
			ActionID:         task.CurrentAction.ActionID,
			ActionKind:       task.CurrentAction.Kind,
		}
		input := ReconcileInput{
			Task:                   task,
			Operation:              operation,
			IssuanceBindingDigest:  task.Repository.BindingDigest,
			OperationPayloadDigest: recoveryDigest("8"),
			FreshBinding:           task.Repository,
		}
		decision, err := Reconcile(input)
		if err != nil {
			t.Fatalf("unrelated Reconcile() error = %v", err)
		}
		if decision.Assessment.LastOperationRelation != LastOperationUnrelated ||
			decision.Assessment.Classification != domain.RecoveryNotStarted {
			t.Fatalf("unrelated decision = %#v", decision)
		}

		contradictory := task.Clone()
		contradictory.LastOperation.OperationID = operation.OperationID
		input.Task = contradictory
		decision, err = Reconcile(input)
		if err != nil {
			t.Fatalf("contradictory Reconcile() error = %v", err)
		}
		if decision.Assessment.LastOperationRelation != LastOperationContradictory ||
			decision.Assessment.Classification != domain.RecoveryConflicting {
			t.Fatalf("contradictory decision = %#v", decision)
		}

		committed := task.Clone()
		committed.Revision++
		committed.Phase = domain.PhaseImplement
		committed.UpdatedAt = committed.UpdatedAt.Add(time.Minute)
		next, err := workflow.BuildNextAction(
			committed.Phase,
			committed.TaskID,
			committed.Revision,
			committed.Repository.BindingDigest,
			"action-next",
			committed.UpdatedAt,
		)
		if err != nil {
			t.Fatal(err)
		}
		committed.CurrentAction = &next
		actionID := operation.ActionID
		committed.LastOperation = &domain.LastOperation{
			OperationID:   operation.OperationID,
			Kind:          domain.OperationApplyAction,
			ActionID:      &actionID,
			FromRevision:  operation.ExpectedRevision,
			ToRevision:    committed.Revision,
			PayloadDigest: input.OperationPayloadDigest,
			CommittedAt:   committed.UpdatedAt,
		}
		input.Task = committed
		decision, err = Reconcile(input)
		if err != nil {
			t.Fatalf("exact Reconcile() error = %v", err)
		}
		if decision.Assessment.LastOperationRelation != LastOperationExact ||
			decision.Assessment.Classification != domain.RecoveryCompletedAndRecorded ||
			decision.Assessment.CommittedProof == nil {
			t.Fatalf("exact decision = %#v", decision)
		}
	})

	t.Run("validated payload effect is reconciled without parsing payload JSON", func(t *testing.T) {
		task := reconciliationTask(t)
		payload, err := workflow.ValidatePayload(
			domain.PhasePlan,
			domain.ActionImplementChange,
			workflow.ImplementChangePayload{
				Result:         domain.ActionResultSucceeded,
				Summary:        "implemented change",
				ChangedPaths:   []string{"internal/example.go"},
				NoFileChanges:  false,
				Deviations:     []string{},
				ScopeConfirmed: true,
			},
		)
		if err != nil {
			t.Fatal(err)
		}
		fresh := task.Repository.Clone()
		fresh.WorktreeFingerprint = recoveryDigest("3")
		fresh.BindingDigest = recoveryDigest("4")
		decision, err := Reconcile(ReconcileInput{
			Task: task,
			Operation: OperationReference{
				OperationID:      "request-original",
				SourcePhase:      task.Phase,
				ExpectedRevision: task.Revision,
				ActionID:         task.CurrentAction.ActionID,
				ActionKind:       task.CurrentAction.Kind,
			},
			IssuanceBindingDigest:  task.Repository.BindingDigest,
			OperationPayloadDigest: recoveryDigest("8"),
			Payload:                &payload,
			FreshBinding:           fresh,
		})
		if err != nil {
			t.Fatalf("Reconcile() error = %v", err)
		}
		if decision.Assessment.OperationEvidence != OperationEvidenceComplete ||
			decision.Assessment.Classification != domain.RecoveryCompletedButUnrecorded {
			t.Fatalf("decision = %#v", decision)
		}
	})

	if _, err := CompareRepositoryBindings(domain.RepositoryBinding{}, issued); err == nil {
		t.Fatal("invalid binding facts produced a relation")
	}
	if _, err := BindingAcceptedForAction("unknown", RepositoryExact); err == nil {
		t.Fatal("invalid action facts produced an acceptance decision")
	}
}

func reconciliationTask(t *testing.T) domain.Task {
	t.Helper()
	contract, err := domain.NewContract(
		"recover uncertain operation",
		[]string{"core"},
		[]string{"hosts"},
		[]string{"classification is deterministic"},
		domain.VerificationBudget{
			Level:                domain.VerificationTargeted,
			MaxAutomaticCommands: 2,
			AllowManualHandoff:   true,
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, time.August, 15, 10, 0, 0, 0, time.UTC)
	binding := recoveryBinding()
	action, err := workflow.BuildNextAction(
		domain.PhasePlan,
		"task-recovery",
		3,
		binding.BindingDigest,
		"action-original",
		now,
	)
	if err != nil {
		t.Fatal(err)
	}
	previousActionID := domain.ID("action-previous")
	task := domain.Task{
		TaskID:        "task-recovery",
		OriginHost:    domain.HostCodex,
		Contract:      contract,
		Repository:    binding,
		Phase:         domain.PhasePlan,
		CurrentAction: &action,
		LastOperation: &domain.LastOperation{
			OperationID:   "request-previous",
			Kind:          domain.OperationApplyAction,
			ActionID:      &previousActionID,
			FromRevision:  2,
			ToRevision:    3,
			PayloadDigest: recoveryDigest("7"),
			CommittedAt:   now,
		},
		Evidence:  []domain.EvidenceSummary{},
		Revision:  3,
		CreatedAt: now.Add(-time.Hour),
		UpdatedAt: now,
	}
	if err := workflow.ValidateTask(task); err != nil {
		t.Fatalf("reconciliation task is invalid: %v", err)
	}
	return task
}

func recoveryBinding() domain.RepositoryBinding {
	branch := "main"
	head := strings.Repeat("1", 40)
	return domain.RepositoryBinding{
		CanonicalRoot:       "/public/example",
		GitCommonDirDigest:  recoveryDigest("a"),
		RepositoryIdentity:  recoveryDigest("b"),
		Branch:              &branch,
		Head:                &head,
		WorktreeFingerprint: recoveryDigest("c"),
		ObservedAt:          time.Date(2026, time.August, 15, 10, 0, 0, 0, time.UTC),
		BindingDigest:       recoveryDigest("d"),
	}
}
