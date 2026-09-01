package domain

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

func TestProcessTaskRepositoryScopeBoundariesAndDigest(t *testing.T) {
	now := time.Date(2026, 8, 19, 1, 0, 0, 0, time.UTC)
	mainDigest := Digest(strings.Repeat("a", 64))
	single := validProcessTaskForDomainTest(now, mainDigest)
	if single.EffectivePrimaryRepositoryKey() != DefaultPrimaryRepositoryKey {
		t.Fatalf("default primary key = %q", single.EffectivePrimaryRepositoryKey())
	}
	singleDigest, err := single.EffectiveRepositoryBindingDigest()
	if err != nil || singleDigest != single.Repository.BindingDigest {
		t.Fatalf("single digest = %q, err = %v", singleDigest, err)
	}

	input := []RepositoryScopeEntry{
		repositoryScopeEntryForTest(now, "zeta", 2),
		repositoryScopeEntryForTest(now, "alpha", 1),
	}
	primaryKey, normalized, err := NormalizeRepositoryScope("core", single.Repository, input)
	if err != nil {
		t.Fatalf("normalize scope: %v", err)
	}
	if primaryKey != "core" || normalized[0].Key != "alpha" || normalized[1].Key != "zeta" {
		t.Fatalf("normalized scope = %q/%#v", primaryKey, normalized)
	}
	multi := single
	multi.PrimaryRepositoryKey = primaryKey
	multi.AdditionalRepositories = normalized
	multiDigest, err := multi.EffectiveRepositoryBindingDigest()
	if err != nil || multiDigest == singleDigest {
		t.Fatalf("multi digest = %q, err = %v", multiDigest, err)
	}
	multi.CurrentAction.RepositoryBindingDigest = multiDigest
	if err := multi.Validate(); err != nil {
		t.Fatalf("valid multi-repository task: %v", err)
	}

	reversedKey, reversed, err := NormalizeRepositoryScope("core", single.Repository, []RepositoryScopeEntry{input[1], input[0]})
	if err != nil {
		t.Fatalf("normalize reversed scope: %v", err)
	}
	reordered := single
	reordered.PrimaryRepositoryKey = reversedKey
	reordered.AdditionalRepositories = reversed
	reorderedDigest, err := reordered.EffectiveRepositoryBindingDigest()
	if err != nil || reorderedDigest != multiDigest {
		t.Fatalf("reordered digest = %q, want %q, err = %v", reorderedDigest, multiDigest, err)
	}
	reordered.AdditionalRepositories[0].Binding.ObservedAt = now.Add(time.Hour)
	observedAtDigest, err := reordered.EffectiveRepositoryBindingDigest()
	if err != nil || observedAtDigest != multiDigest {
		t.Fatalf("observed-at digest = %q, want %q, err = %v", observedAtDigest, multiDigest, err)
	}

	maximum := single
	maximum.PrimaryRepositoryKey, maximum.AdditionalRepositories, err = NormalizeRepositoryScope("core", single.Repository, repositoryScopeEntriesForTest(now, MaxAdditionalRepositories))
	if err != nil {
		t.Fatalf("normalize maximum scope: %v", err)
	}
	maximumDigest, err := maximum.EffectiveRepositoryBindingDigest()
	if err != nil {
		t.Fatalf("maximum scope digest: %v", err)
	}
	maximum.CurrentAction.RepositoryBindingDigest = maximumDigest
	if err := maximum.Validate(); err != nil {
		t.Fatalf("eight-repository task: %v", err)
	}

	tooMany := single
	tooMany.PrimaryRepositoryKey = "core"
	tooMany.AdditionalRepositories = repositoryScopeEntriesForTest(now, MaxAdditionalRepositories+1)
	if _, err := tooMany.EffectiveRepositoryBindingDigest(); err == nil {
		t.Fatal("nine-repository scope was accepted")
	}

	duplicateKey := []RepositoryScopeEntry{repositoryScopeEntryForTest(now, "docs", 1), repositoryScopeEntryForTest(now, "docs", 2)}
	if _, _, err := NormalizeRepositoryScope("core", single.Repository, duplicateKey); err == nil {
		t.Fatal("duplicate repository key was accepted")
	}
	duplicateIdentity := []RepositoryScopeEntry{repositoryScopeEntryForTest(now, "docs", 1), repositoryScopeEntryForTest(now, "web", 1)}
	if _, _, err := NormalizeRepositoryScope("core", single.Repository, duplicateIdentity); err == nil {
		t.Fatal("duplicate repository identity was accepted")
	}

	unsorted := multi
	unsorted.AdditionalRepositories = []RepositoryScopeEntry{normalized[1], normalized[0]}
	if _, err := unsorted.EffectiveRepositoryBindingDigest(); err == nil {
		t.Fatal("non-canonical repository order was accepted")
	}
	refreshed := multi
	refreshed.AdditionalRepositories = make([]RepositoryScopeEntry, len(multi.AdditionalRepositories))
	for i := range multi.AdditionalRepositories {
		refreshed.AdditionalRepositories[i] = multi.AdditionalRepositories[i].Clone()
	}
	branch := "feature/refreshed"
	refreshed.AdditionalRepositories[0].Binding.Branch = &branch
	if !RepositoryScopeMembershipEqual(multi, refreshed) {
		t.Fatal("mutable repository observation changed Scope membership")
	}
	refreshed.AdditionalRepositories[0].Binding.CanonicalRoot = "/repo/replaced"
	if RepositoryScopeMembershipEqual(multi, refreshed) {
		t.Fatal("repository replacement preserved Scope membership")
	}
}

func TestProcessTaskRepositoryScopedPaths(t *testing.T) {
	now := time.Date(2026, 8, 19, 1, 0, 0, 0, time.UTC)
	digest := Digest(strings.Repeat("a", 64))
	single := validProcessTaskForDomainTest(now, digest)
	if err := single.ValidateRepositoryPath("internal/domain/task.go"); err != nil {
		t.Fatalf("single relative path: %v", err)
	}
	if err := single.ValidateRepositoryPath("primary::internal/domain/task.go"); err == nil {
		t.Fatal("single task accepted a scoped path")
	}

	multi := single
	multi.PrimaryRepositoryKey = "core"
	multi.AdditionalRepositories = []RepositoryScopeEntry{repositoryScopeEntryForTest(now, "docs", 1)}
	for _, path := range []string{"core::internal/domain/task.go", "docs::README.md"} {
		if err := multi.ValidateRepositoryPath(path); err != nil {
			t.Fatalf("multi path %q: %v", path, err)
		}
	}
	for _, path := range []string{"internal/domain/task.go", "unknown::README.md", "docs::../README.md"} {
		if err := multi.ValidateRepositoryPath(path); err == nil {
			t.Fatalf("invalid multi path %q was accepted", path)
		}
	}
}

func repositoryScopeEntriesForTest(now time.Time, count int) []RepositoryScopeEntry {
	entries := make([]RepositoryScopeEntry, count)
	for i := range entries {
		entries[i] = repositoryScopeEntryForTest(now, RepositoryKey(fmt.Sprintf("repo-%d", i+1)), i+1)
	}
	return entries
}

func repositoryScopeEntryForTest(now time.Time, key RepositoryKey, seed int) RepositoryScopeEntry {
	branch := "main"
	head := fmt.Sprintf("%040x", seed+1)
	digest := Digest(fmt.Sprintf("%064x", seed+1))
	return RepositoryScopeEntry{Key: key, Binding: RepositoryBinding{
		CanonicalRoot:       "/repo/" + string(key),
		GitCommonDirDigest:  digest,
		RepositoryIdentity:  digest,
		Branch:              &branch,
		Head:                &head,
		WorktreeFingerprint: digest,
		ObservedAt:          now,
		BindingDigest:       digest,
	}}
}

func TestProcessTaskBaselineMonotonicityAndInvalidation(t *testing.T) {
	now := time.Date(2026, 8, 19, 1, 0, 0, 0, time.UTC)
	digest := Digest(strings.Repeat("a", 64))
	requirements := &RequirementsBaseline{Revision: 1, Digest: digest, Goal: "Goal", AcceptanceCriteria: []string{"Accepted"}, CreatedAt: now}
	design := &DesignBaseline{Revision: 1, Digest: digest, RequirementsRevision: 2, Approach: "Direct approach", Decisions: []string{"Reuse boundary"}, CreatedAt: now}
	task := validProcessTaskForDomainTest(now, digest)
	task.Requirements = requirements
	task.Design = design
	if err := task.Validate(); err == nil {
		t.Fatal("design bound to wrong requirements revision accepted")
	}
	task.Design.RequirementsRevision = 1
	task.TaskPlan = &TaskPlanBaseline{Revision: 1, Digest: digest, DesignRevision: 1, WorkItems: []WorkItem{{WorkItemID: "work", Summary: "Work", VerificationSteps: []string{"Test"}}}, CreatedAt: now}
	task.Test = &TestRecord{RecordID: "test", RequirementsRevision: 1, DesignRevision: 1, TaskPlanRevision: 1, RepositoryBindingDigest: digest, PassedAt: now}
	task.Comprehension = &ComprehensionAssessment{RecordID: "review", TestRecordID: "test", RequirementsRevision: 1, DesignRevision: 1, TaskPlanRevision: 1, RepositoryBindingDigest: digest, ExplainedComponents: []string{"component"}, UserEvidenceID: "user", ConfirmedAt: now}
	task.InvalidateForDestination(NodeDesign)
	if task.TaskPlan != nil || task.Test != nil || task.Comprehension != nil {
		t.Fatal("design invalidation retained downstream authority")
	}
}

func TestProcessTaskTerminalAndBlockedShapes(t *testing.T) {
	now := time.Date(2026, 8, 19, 1, 0, 0, 0, time.UTC)
	digest := Digest(strings.Repeat("a", 64))
	task := validProcessTaskForDomainTest(now, digest)
	task.CurrentNode = NodeBlocked
	resume := NodeRequirements
	task.ResumeNode = &resume
	task.Blocker = &ProcessBlocker{BlockerID: "blocker", Code: ErrorTaskBlocked, Cause: BlockerCauseRecoveryConflicting, ResumeNode: resume, Message: "Restore binding", ObservedBindingDigest: task.Repository.BindingDigest, Condition: BlockerCondition{Kind: BlockerConditionRestoreIssuanceBinding, ExpectedBindingDigest: task.Repository.BindingDigest}, RequiredResolution: "Restore the issuance binding.", CreatedAt: task.UpdatedAt}
	task.CurrentAction.Kind = ActionResolveBlocker
	task.CurrentAction.NodeID = NodeBlocked
	if err := task.Validate(); err != nil {
		t.Fatalf("blocked task: %v", err)
	}
	task.ResumeNode = nil
	if err := task.Validate(); err == nil {
		t.Fatal("blocked task without resume accepted")
	}
}

func TestProcessBlockerStrictGraphAuthority(t *testing.T) {
	now := time.Date(2026, 8, 19, 1, 0, 0, 0, time.UTC)
	digest := Digest(strings.Repeat("a", 64))
	base := ProcessBlocker{BlockerID: "blocker", Code: ErrorTaskBlocked, Cause: BlockerCauseRecoveryPartiallyCompleted, Message: "Restore the issuance binding.", ResumeNode: NodeRefactor, ObservedBindingDigest: digest, Condition: BlockerCondition{Kind: BlockerConditionRestoreIssuanceBinding, ExpectedBindingDigest: digest}, RequiredResolution: "Restore the exact issuance binding.", CreatedAt: now}
	if err := base.Validate(); err != nil {
		t.Fatal(err)
	}
	automatic := base
	automatic.Cause = BlockerCauseRepeatedVerificationFailure
	automatic.Condition.Kind = BlockerConditionAllowVerificationRetry
	if err := automatic.Validate(); err != nil {
		t.Fatalf("automatic brake blocker: %v", err)
	}
	for name, mutate := range map[string]func(*ProcessBlocker){
		"missing code":               func(v *ProcessBlocker) { v.Code = "" },
		"invalid cause":              func(v *ProcessBlocker) { v.Cause = BlockerCause(RecoveryNotStarted) },
		"terminal resume":            func(v *ProcessBlocker) { v.ResumeNode = NodeDone },
		"invalid condition":          func(v *ProcessBlocker) { v.Condition.Kind = "future" },
		"mismatched brake condition": func(v *ProcessBlocker) { v.Cause = BlockerCauseRepeatedVerificationFailure },
		"missing observed binding":   func(v *ProcessBlocker) { v.ObservedBindingDigest = "" },
	} {
		t.Run(name, func(t *testing.T) {
			candidate := base
			mutate(&candidate)
			if candidate.Validate() == nil {
				t.Fatal("invalid blocker accepted")
			}
		})
	}
}

func validProcessTaskForDomainTest(now time.Time, digest Digest) ProcessTask {
	branch := "main"
	head := strings.Repeat("b", 40)
	repository := RepositoryBinding{CanonicalRoot: "/repo", GitCommonDirDigest: digest, RepositoryIdentity: digest, Branch: &branch, Head: &head, WorktreeFingerprint: digest, ObservedAt: now, BindingDigest: digest}
	process := ProcessReference{ID: ProcessStandardDevelopment, DefinitionDigest: digest}
	action := &ProcessAction{ActionID: "action", Kind: ActionCompleteRequirements, TaskID: "task", Revision: 1, Process: process, NodeID: NodeRequirements, RepositoryBindingDigest: digest, AllowedEffects: []AllowedEffect{EffectReadRepository}, RequiredEvidence: []EvidenceRequirement{{Kind: RequirementRepositoryObservation, Required: true}}, PayloadContract: "requirements-result", NodeContract: NodeContractProjection{Purpose: "Capture requirements.", EntryConditions: []string{"intent"}, CompletionConditions: []string{"baseline"}}, MethodProfile: MethodPlain, SemanticMethodSteps: []SemanticMethodStep{{StepID: "requirements.capture", Purpose: "Capture requirements.", Required: true}}, Guidance: "Complete requirements.", IssuedAt: now}
	return ProcessTask{TaskID: "task", OriginHost: HostCodex, Intent: TaskIntent{Request: "Request", VerificationBudget: VerificationBudget{Level: VerificationTargeted, MaxAutomaticCommands: 1}, MethodProfile: MethodPlain}, Process: process, CurrentNode: NodeRequirements, CurrentAction: action, Repository: repository, Revision: 1, CreatedAt: now, UpdatedAt: now}
}
