package domain

import (
	"strings"
	"testing"
	"time"
)

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
	task.Blocker = &ProcessBlocker{BlockerID: "blocker", ResumeNode: resume, Message: "Restore binding"}
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

func validProcessTaskForDomainTest(now time.Time, digest Digest) ProcessTask {
	branch := "main"
	head := strings.Repeat("b", 40)
	repository := RepositoryBinding{CanonicalRoot: "/repo", GitCommonDirDigest: digest, RepositoryIdentity: digest, Branch: &branch, Head: &head, WorktreeFingerprint: digest, ObservedAt: now, BindingDigest: digest}
	process := ProcessReference{ID: ProcessStandardDevelopment, Version: 1, DefinitionDigest: digest}
	action := &ProcessActionV2{ActionID: "action", Kind: ActionCompleteRequirements, TaskID: "task", Revision: 1, Process: process, NodeID: NodeRequirements, RepositoryBindingDigest: digest, AllowedEffects: []AllowedEffect{EffectReadRepository}, RequiredEvidence: []EvidenceRequirement{{Kind: RequirementRepositoryObservation, Required: true}}, PayloadContract: "requirements-result@1", NodeContract: NodeContractProjection{Purpose: "Capture requirements.", EntryConditions: []string{"intent"}, CompletionConditions: []string{"baseline"}}, MethodProfile: MethodPlain, SemanticMethodSteps: []SemanticMethodStep{{StepID: "requirements.capture", Purpose: "Capture requirements.", Required: true}}, Guidance: "Complete requirements.", IssuedAt: now}
	return ProcessTask{TaskID: "task", OriginHost: HostCodex, Intent: TaskIntent{Request: "Request", VerificationBudget: VerificationBudget{Level: VerificationTargeted, MaxAutomaticCommands: 1}, MethodProfile: MethodPlain}, Process: process, CurrentNode: NodeRequirements, CurrentAction: action, Repository: repository, Revision: 1, CreatedAt: now, UpdatedAt: now}
}
