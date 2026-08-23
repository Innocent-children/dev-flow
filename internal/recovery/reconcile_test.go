package recovery

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestGraphRecoveryFiveClassOrdering(t *testing.T) {
	task, operation, payload := recoveryRefactorFixture(t)
	changed := changedBinding(task.Repository, []string{"internal/order.go"}, "c")
	unexpected := changedBinding(task.Repository, []string{"internal/other.go"}, "d")

	assertClass := func(name string, current domain.ProcessTask, observed domain.RepositoryBinding, retained json.RawMessage, want domain.RecoveryClassification, directive MutationDirective) RecoveryDecision {
		t.Helper()
		decision, err := Reconcile(ReconcileInput{Host: domain.HostCodex, Task: current, Operation: operation, Payload: retained, Observed: observed})
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if decision.Assessment.Classification != want || decision.Directive != directive {
			t.Fatalf("%s class=%s directive=%s", name, decision.Assessment.Classification, decision.Directive)
		}
		return decision
	}

	notStarted := assertClass("not started", task, task.Repository, payload, domain.RecoveryNotStarted, DirectiveNoWrite)
	if !notStarted.Assessment.ActionRetrySafe || notStarted.Assessment.NextAdvice != AdviceRetryCurrentAction || notStarted.Assessment.OperationEvidence != OperationEvidenceNone {
		t.Fatal("not-started advice/evidence mismatch")
	}

	unrecorded := assertClass("completed but unrecorded", task, changed, payload, domain.RecoveryCompletedButUnrecorded, DirectiveCommitRecoveredTransition)
	if unrecorded.Assessment.ActionRetrySafe || unrecorded.Assessment.OperationEvidence != OperationEvidenceComplete || unrecorded.Assessment.CommittedProof != nil {
		t.Fatal("unrecorded proof mismatch")
	}

	partial := assertClass("partial", task, changed, json.RawMessage("null"), domain.RecoveryPartiallyCompleted, DirectiveCreateBlocker)
	if partial.Assessment.OperationPayloadDigest != nil || partial.Assessment.UnblockCondition == nil || partial.Assessment.NextAdvice != AdviceSubmitRecoveryApply {
		t.Fatal("partial payload/blocker mismatch")
	}

	conflicting := assertClass("conflicting", task, unexpected, payload, domain.RecoveryConflicting, DirectiveCreateBlocker)
	if conflicting.Assessment.OperationEvidence != OperationEvidenceContradictory || conflicting.Assessment.ActionRetrySafe {
		t.Fatal("conflicting evidence mismatch")
	}

	committed := task
	committed.Repository = changed
	committed.Implementation.RepositoryBindingDigest = changed.BindingDigest
	committed.CurrentNode = domain.NodeTest
	committed.Revision++
	committed.UpdatedAt = changed.ObservedAt
	action, err := workflow.BuildProcessAction(workflow.StandardProcess(), domain.NodeTest, committed.TaskID, committed.Revision, committed.Repository.BindingDigest, committed.Intent.MethodProfile, "next-action", committed.UpdatedAt)
	if err != nil {
		t.Fatal(err)
	}
	committed.CurrentAction = &action
	canonical := unrecorded.CanonicalPayload
	digest, err := workflow.GraphOperationDigest(domain.HostCodex, committed.TaskID, operation, canonical)
	if err != nil {
		t.Fatal(err)
	}
	actionID := operation.ActionID
	committed.LastOperation = &domain.LastOperation{OperationID: operation.OperationID, Kind: domain.OperationApplyAction, ActionID: &actionID, FromRevision: operation.ExpectedRevision, ToRevision: committed.Revision, PayloadDigest: digest, CommittedAt: committed.UpdatedAt}
	completed := assertClass("completed and recorded", committed, changed, payload, domain.RecoveryCompletedAndRecorded, DirectiveNoWrite)
	if completed.Assessment.CommittedProof == nil || completed.Assessment.ActionRetrySafe || completed.Assessment.LastOperationRelation != LastOperationExact {
		t.Fatal("committed proof mismatch")
	}
}

func TestExactBindingRecoveryEffectAndNullPayloadConservatism(t *testing.T) {
	task, operation, _ := recoveryRequirementsFixture(t)
	payload := requirementsPayload(t, task.CurrentAction.SemanticMethodSteps)
	decision, err := Reconcile(ReconcileInput{Host: domain.HostCodex, Task: task, Operation: operation, Payload: payload, Observed: task.Repository})
	if err != nil {
		t.Fatal(err)
	}
	if decision.Assessment.Classification != domain.RecoveryCompletedButUnrecorded || decision.Assessment.OperationEvidence != OperationEvidenceComplete {
		t.Fatalf("assessment=%+v", decision.Assessment)
	}
	nullDecision, err := Reconcile(ReconcileInput{Host: domain.HostCodex, Task: task, Operation: operation, Payload: json.RawMessage("null"), Observed: task.Repository})
	if err != nil {
		t.Fatal(err)
	}
	if nullDecision.Assessment.Classification != domain.RecoveryNotStarted || nullDecision.Assessment.ActionRetrySafe || nullDecision.Assessment.OperationPayloadDigest != nil {
		t.Fatalf("null assessment=%+v", nullDecision.Assessment)
	}
}

func TestMultiRepositoryRecoveryAggregatesPartialAndConflictingFacts(t *testing.T) {
	task, operation, payload := multiRepositoryRecoveryFixture(t)
	primaryChanged := changedBinding(task.Repository, []string{"internal/order.go"}, "c")
	partialObservation := RepositoryScopeObservation{Primary: primaryChanged, Additional: []domain.RepositoryScopeEntry{{Key: "docs", Binding: task.AdditionalRepositories[0].Binding}}}
	partial, err := Reconcile(ReconcileInput{Host: domain.HostCodex, Task: task, Operation: operation, Payload: payload, ObservedScope: &partialObservation})
	if err != nil {
		t.Fatal(err)
	}
	if partial.Assessment.Classification != domain.RecoveryPartiallyCompleted || partial.Assessment.OperationEvidence != OperationEvidencePartial || partial.Directive != DirectiveCreateBlocker {
		t.Fatalf("partial decision=%+v", partial)
	}
	if len(partial.Assessment.Repositories) != 2 || partial.Assessment.Repositories[0].RepositoryKey != "core" || partial.Assessment.Repositories[1].RepositoryKey != "docs" {
		t.Fatalf("repository facts=%+v", partial.Assessment.Repositories)
	}

	forbiddenDocs := task.AdditionalRepositories[0].Binding.Clone()
	forbiddenHead := strings.Repeat("9", 40)
	forbiddenDocs.Head = &forbiddenHead
	forbiddenDocs.ObservedAt = forbiddenDocs.ObservedAt.Add(time.Second)
	conflictingObservation := RepositoryScopeObservation{Primary: task.Repository, Additional: []domain.RepositoryScopeEntry{{Key: "docs", Binding: forbiddenDocs}}}
	conflicting, err := Reconcile(ReconcileInput{Host: domain.HostCodex, Task: task, Operation: operation, Payload: payload, ObservedScope: &conflictingObservation})
	if err != nil {
		t.Fatal(err)
	}
	if conflicting.Assessment.Classification != domain.RecoveryConflicting || conflicting.Assessment.RepositoryRelation != RepositoryForbiddenChange || conflicting.Assessment.Repositories[1].Reason != RepositoryReasonHead {
		t.Fatalf("conflicting decision=%+v", conflicting)
	}

	undeclaredDocs := changedBinding(task.AdditionalRepositories[0].Binding, []string{"docs/unexpected.md"}, "8")
	undeclaredObservation := RepositoryScopeObservation{Primary: task.Repository, Additional: []domain.RepositoryScopeEntry{{Key: "docs", Binding: undeclaredDocs}}}
	undeclared, err := Reconcile(ReconcileInput{Host: domain.HostCodex, Task: task, Operation: operation, Payload: payload, ObservedScope: &undeclaredObservation})
	if err != nil {
		t.Fatal(err)
	}
	if undeclared.Assessment.Classification != domain.RecoveryConflicting || undeclared.Assessment.OperationEvidence != OperationEvidenceContradictory {
		t.Fatalf("undeclared decision=%+v", undeclared)
	}
}

func TestRepositoryEffectDerivationRejectsUndeclaredAndArtifactProductMismatch(t *testing.T) {
	base := testBinding(time.Date(2026, 8, 19, 11, 0, 0, 0, time.UTC), "a")
	base.ChangedPaths = []string{"sql/existing.sql"}
	artifact := domain.ArtifactReference{Role: domain.ArtifactRequirements, Path: "artifacts/requirements.json", Digest: digest("b"), Summary: "Requirements artifact"}
	effect, err := DeriveRepositoryEffect(domain.NodeRequirements, workflow.StandardPayload{Artifacts: []domain.ArtifactReference{artifact}}, &workflow.RequirementsResult{})
	if err != nil || effect.Kind != EffectProcessArtifactOnly {
		t.Fatalf("effect=%+v err=%v", effect, err)
	}
	observed := changedBinding(base, []string{"artifacts/requirements.json", "sql/existing.sql"}, "c")
	if !RepositoryEffectMatches(effect, RepositoryWorktreeOnlyChanged, base, observed) {
		t.Fatal("declared artifact path did not match")
	}
	observed.ChangedPaths = []string{"artifacts/requirements.json", "internal/extra.go", "sql/existing.sql"}
	if RepositoryEffectMatches(effect, RepositoryWorktreeOnlyChanged, base, observed) {
		t.Fatal("undeclared product path matched process artifact effect")
	}
	productEffect := RepositoryEffect{Kind: EffectProductFileChange, ChangedPaths: []string{"internal/product.go"}}
	observed.ChangedPaths = []string{"internal/product.go", "sql/existing.sql"}
	if !RepositoryEffectMatches(productEffect, RepositoryWorktreeOnlyChanged, base, observed) {
		t.Fatal("declared product path did not match dirty baseline")
	}
	overlapEffect := RepositoryEffect{Kind: EffectProductFileChange, ChangedPaths: []string{"sql/existing.sql"}}
	observed.ChangedPaths = []string{"sql/existing.sql"}
	if !RepositoryEffectMatches(overlapEffect, RepositoryWorktreeOnlyChanged, base, observed) {
		t.Fatal("declared change overlapping the dirty baseline did not match")
	}
	if RepositoryEffectMatches(productEffect, RepositoryForbiddenChange, base, observed) {
		t.Fatal("forbidden repository identity change matched")
	}
	artifact.Role = domain.ArtifactImplementation
	if _, err := DeriveRepositoryEffect(domain.NodeRequirements, workflow.StandardPayload{Artifacts: []domain.ArtifactReference{artifact}}, &workflow.RequirementsResult{}); err == nil {
		t.Fatal("artifact/product role mismatch accepted")
	}
	if !RepositoryEffectMatches(RepositoryEffect{Kind: EffectExactBlockerRestoration, NoFileChanges: true}, RepositoryExact, base, base) {
		t.Fatal("exact blocker restoration rejected")
	}
}

func TestGraphRecoveryProductionHasNoLinearClassifier(t *testing.T) {
	for _, path := range []string{"types.go", "classify.go", "reconcile.go"} {
		raw, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		text := string(raw)
		for _, forbidden := range []string{"domain.Phase", "SourcePhase", "CurrentTaskPhase", "ActionImplementChange"} {
			if strings.Contains(text, forbidden) {
				t.Fatalf("%s contains %s", path, forbidden)
			}
		}
	}
}

func recoveryRefactorFixture(t *testing.T) (domain.ProcessTask, domain.OperationReference, json.RawMessage) {
	t.Helper()
	now := time.Date(2026, 8, 19, 9, 0, 0, 0, time.UTC)
	repository := testBinding(now, "a")
	process := workflow.StandardProcess()
	action, err := workflow.BuildProcessAction(process, domain.NodeRefactor, "task", 5, repository.BindingDigest, domain.MethodPlain, "refactor-action", now)
	if err != nil {
		t.Fatal(err)
	}
	task := domain.ProcessTask{TaskID: "task", OriginHost: domain.HostCodex, Intent: domain.TaskIntent{Request: "Simplify code.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 4}, MethodProfile: domain.MethodPlain}, Process: process.Reference, CurrentNode: domain.NodeRefactor, CurrentAction: &action, Repository: repository, Requirements: &domain.RequirementsBaseline{Revision: 1, Digest: digest("1"), Goal: "Goal", AcceptanceCriteria: []string{"Works"}, CreatedAt: now}, Design: &domain.DesignBaseline{Revision: 1, Digest: digest("2"), RequirementsRevision: 1, Approach: "Direct", Decisions: []string{"Keep direct"}, CreatedAt: now}, TaskPlan: &domain.TaskPlanBaseline{Revision: 1, Digest: digest("3"), DesignRevision: 1, WorkItems: []domain.WorkItem{{WorkItemID: "work", Summary: "Simplify", ExpectedPaths: []string{"internal/order.go"}, AcceptanceIndexes: []uint32{0}, VerificationSteps: []string{"Test"}}}, CreatedAt: now}, Implementation: &domain.ImplementationRecord{Revision: 1, TaskPlanRevision: 1, RepositoryBindingDigest: repository.BindingDigest, CompletedWorkItemIDs: []domain.ID{"work"}, NoFileChanges: true, Summary: "Current implementation", CreatedAt: now}, Revision: 5, CreatedAt: now, UpdatedAt: now}
	if workflow.ValidateProcessTask(task) != nil {
		t.Fatal("invalid fixture")
	}
	operation := domain.OperationReference{OperationID: "uncertain-refactor", Process: process.Reference, SourceCursor: domain.NodeRefactor, ExpectedRevision: 5, ActionID: action.ActionID, ActionKind: action.Kind, RepositoryBindingDigest: repository.BindingDigest}
	payload := refactorPayload(t, action.SemanticMethodSteps)
	return task, operation, payload
}

func recoveryRequirementsFixture(t *testing.T) (domain.ProcessTask, domain.OperationReference, json.RawMessage) {
	t.Helper()
	now := time.Date(2026, 8, 19, 9, 0, 0, 0, time.UTC)
	repository := testBinding(now, "a")
	process := workflow.StandardProcess()
	action, err := workflow.BuildProcessAction(process, domain.NodeRequirements, "task", 1, repository.BindingDigest, domain.MethodPlain, "requirements-action", now)
	if err != nil {
		t.Fatal(err)
	}
	task := domain.ProcessTask{TaskID: "task", OriginHost: domain.HostCodex, Intent: domain.TaskIntent{Request: "Define work.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 4}, MethodProfile: domain.MethodPlain}, Process: process.Reference, CurrentNode: domain.NodeRequirements, CurrentAction: &action, Repository: repository, Revision: 1, CreatedAt: now, UpdatedAt: now}
	operation := domain.OperationReference{OperationID: "uncertain-requirements", Process: process.Reference, SourceCursor: domain.NodeRequirements, ExpectedRevision: 1, ActionID: action.ActionID, ActionKind: action.Kind, RepositoryBindingDigest: repository.BindingDigest}
	return task, operation, nil
}

func multiRepositoryRecoveryFixture(t *testing.T) (domain.ProcessTask, domain.OperationReference, json.RawMessage) {
	t.Helper()
	task, _, _ := recoveryRefactorFixture(t)
	docs := testBinding(task.CreatedAt, "d")
	docs.CanonicalRoot = "/docs"
	docs.GitCommonDirDigest = digest("e")
	docs.RepositoryIdentity = digest("f")
	docs.WorktreeFingerprint = digest("7")
	docs.BindingDigest = digest("7")
	task.PrimaryRepositoryKey = "core"
	task.AdditionalRepositories = []domain.RepositoryScopeEntry{{Key: "docs", Binding: docs}}
	task.TaskPlan.WorkItems[0].ExpectedPaths = []string{"core::internal/order.go", "docs::docs/guide.md"}
	effectiveDigest, err := task.EffectiveRepositoryBindingDigest()
	if err != nil {
		t.Fatal(err)
	}
	task.CurrentAction.RepositoryBindingDigest = effectiveDigest
	task.Implementation.RepositoryBindingDigest = effectiveDigest
	operation := domain.OperationReference{OperationID: "multi-repository-recovery", Process: task.Process, SourceCursor: task.CurrentNode, ExpectedRevision: task.Revision, ActionID: task.CurrentAction.ActionID, ActionKind: task.CurrentAction.Kind, RepositoryBindingDigest: effectiveDigest}
	payload := refactorPayloadPaths(t, task.CurrentAction.SemanticMethodSteps, []string{"core::internal/order.go", "docs::docs/guide.md"})
	if workflow.ValidateProcessTask(task) != nil {
		t.Fatal("invalid multi-repository recovery fixture")
	}
	return task, operation, payload
}

func refactorPayload(t *testing.T, steps []domain.SemanticMethodStep) json.RawMessage {
	return refactorPayloadPaths(t, steps, []string{"internal/order.go"})
}

func refactorPayloadPaths(t *testing.T, steps []domain.SemanticMethodStep, paths []string) json.RawMessage {
	return payloadFor(t, steps, "refactor_ready_for_test", map[string]any{"problem_class": "none", "changed_paths": paths, "no_file_changes": false, "simplifications": []string{"Removed indirection"}, "behavior_change_intended": false, "findings": []string{}})
}

func requirementsPayload(t *testing.T, steps []domain.SemanticMethodStep) json.RawMessage {
	return payloadFor(t, steps, "requirements_ready", map[string]any{"problem_class": "none", "baseline": map[string]any{"goal": "Goal", "scope": []string{}, "out_of_scope": []string{}, "acceptance_criteria": []string{"Works"}, "constraints": []string{}, "assumptions": []string{}}, "unresolved_questions": []string{}})
}

func payloadFor(t *testing.T, steps []domain.SemanticMethodStep, transition string, result any) json.RawMessage {
	t.Helper()
	evidence := make([]map[string]any, len(steps))
	for i, step := range steps {
		evidence[i] = map[string]any{"step_id": step.StepID, "status": "plain_fallback", "capability": "", "summary": "Completed the semantic step."}
	}
	raw, err := json.Marshal(map[string]any{"transition_id": transition, "summary": "Completed current work.", "reason": "", "artifacts": []any{}, "method_evidence": evidence, "node_result": result})
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func testBinding(now time.Time, seed string) domain.RepositoryBinding {
	branch, head := "main", strings.Repeat("b", 40)
	d := digest(seed)
	return domain.RepositoryBinding{CanonicalRoot: "/repo", GitCommonDirDigest: d, RepositoryIdentity: d, Branch: &branch, Head: &head, WorktreeFingerprint: d, ObservedAt: now, BindingDigest: d}
}

func changedBinding(base domain.RepositoryBinding, paths []string, seed string) domain.RepositoryBinding {
	changed := base.Clone()
	changed.WorktreeFingerprint, changed.BindingDigest, changed.ChangedPaths = digest(seed), digest(seed), append([]string(nil), paths...)
	changed.ObservedAt = base.ObservedAt.Add(time.Second)
	return changed
}

func digest(seed string) domain.Digest { return domain.Digest(strings.Repeat(seed, 64)) }
