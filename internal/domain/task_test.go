package domain

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/testpath"
)

func TestProcessTaskRepositoryScopeDigestsAndCurrentPaths(t *testing.T) {
	now := time.Date(2026, 9, 3, 1, 0, 0, 0, time.UTC)
	task := validProcessTaskForDomainTest(now, matrixDigest('a'))
	single, err := task.EffectiveWorkspaceDigests()
	if err != nil || single.Binding != task.Repository.BindingDigest || single.Content != task.Repository.ContentDigest {
		t.Fatalf("single digests=%+v err=%v", single, err)
	}
	entry := repositoryScopeEntryForTest(now, "docs", 2)
	key, additional, err := NormalizeRepositoryScope("core", task.WorkspaceOrigin, task.Repository, []RepositoryScopeEntry{entry})
	if err != nil {
		t.Fatal(err)
	}
	task.PrimaryRepositoryKey, task.AdditionalRepositories = key, additional
	workspace, err := task.EffectiveWorkspaceDigests()
	if err != nil || workspace.Binding == single.Binding || workspace.Content == single.Content {
		t.Fatalf("multi digests=%+v err=%v", workspace, err)
	}
	task.CurrentAction.RepositoryBindingDigest = workspace.Binding
	task.CurrentAction.IssuanceIdentityDigest = workspace.Identity
	task.CurrentAction.IssuanceHistoryDigest = workspace.History
	task.CurrentAction.IssuanceContentDigest = workspace.Content
	task.Repository.TaskSurface = []RepositoryChangedEntry{repositorySurfaceEntryForTest("src/main.go", matrixDigest('c'))}
	task.AdditionalRepositories[0].Binding.TaskSurface = []RepositoryChangedEntry{repositorySurfaceEntryForTest("README.md", matrixDigest('d'))}
	task.CurrentChangedPaths = []string{"core::src/main.go", "docs::README.md"}
	if err := task.Validate(); err != nil {
		t.Fatalf("multi task: %v", err)
	}

	duplicate := repositoryScopeEntryForTest(now, "api", 2)
	if _, _, err := NormalizeRepositoryScope("core", task.WorkspaceOrigin, task.Repository, []RepositoryScopeEntry{entry, duplicate}); err == nil {
		t.Fatal("duplicate worktree instance accepted")
	}
}

func repositorySurfaceEntryForTest(path string, digest Digest) RepositoryChangedEntry {
	return RepositoryChangedEntry{
		Path:                  path,
		ChangeType:            RepositoryChangeModified,
		FileMode:              "100644",
		BaseMode:              "100644",
		BaseContentDigest:     digest,
		IndexMode:             "100644",
		IndexContentDigest:    digest,
		WorktreeMode:          "100644",
		WorktreeContentDigest: digest,
		ContentDigest:         digest,
	}
}

func TestProcessTaskWorkspaceEvidenceUsesContentDigest(t *testing.T) {
	now := time.Date(2026, 9, 3, 1, 0, 0, 0, time.UTC)
	task := validProcessTaskForDomainTest(now, matrixDigest('a'))
	task.Requirements = &RequirementsBaseline{Revision: 1, Digest: matrixDigest('1'), Goal: "Goal", AcceptanceCriteria: []string{"Accepted"}, CreatedAt: now}
	task.Design = &DesignBaseline{Revision: 1, Digest: matrixDigest('2'), RequirementsRevision: 1, Approach: "Direct", Decisions: []string{"Direct"}, CreatedAt: now}
	task.TaskPlan = &TaskPlanBaseline{Revision: 1, Digest: matrixDigest('3'), DesignRevision: 1, WorkItems: []WorkItem{{WorkItemID: "work", Summary: "Work", ExpectedPaths: []string{"src/main.go"}, AcceptanceIndexes: []uint32{0}, VerificationSteps: []string{"Test"}}}, CreatedAt: now}
	task.Implementation = &ImplementationRecord{Revision: 1, TaskPlanRevision: 1, ContentDigest: task.Repository.ContentDigest, CompletedWorkItemIDs: []ID{"work"}, ActionChangedPaths: []string{"src/main.go"}, Summary: "Implemented.", CreatedAt: now}
	task.Test = &TestRecord{RecordID: "test", RequirementsRevision: 1, DesignRevision: 1, TaskPlanRevision: 1, ContentDigest: task.Repository.ContentDigest, EvidenceIDs: []ID{"automated"}, PassedAt: now}
	task.Evidence = []EvidenceSummary{{EvidenceID: "automated", Source: EvidenceSourceAutomated, Name: "test", Status: EvidencePassed, Summary: "Passed.", Digest: matrixDigest('4'), CommandCount: 1, RecordedAt: now}}
	task.CurrentNode = NodeComprehensionReview
	task.Revision = 2
	task.CurrentAction.NodeID, task.CurrentAction.Kind, task.CurrentAction.Revision = NodeComprehensionReview, ActionCompleteComprehensionReview, 2
	if err := task.Validate(); err != nil {
		t.Fatalf("content-bound test invalid: %v", err)
	}
	task.Implementation.ContentDigest = matrixDigest('e')
	if err := task.Validate(); err == nil {
		t.Fatal("stale implementation content authority accepted")
	}
	task.Implementation.ContentDigest = task.Repository.ContentDigest
	task.Test.ContentDigest = matrixDigest('f')
	if err := task.Validate(); err == nil {
		t.Fatal("stale content-bound test accepted")
	}
}

func repositoryScopeEntryForTest(now time.Time, key RepositoryKey, seed int) RepositoryScopeEntry {
	digest := Digest(fmt.Sprintf("%064x", seed+1))
	head := fmt.Sprintf("%040x", seed+1)
	branch := "feature/" + string(key)
	root := testpath.Absolute("repo", string(key))
	return RepositoryScopeEntry{
		Key:     key,
		Origin:  WorkspaceOrigin{Mode: WorkspaceModeDedicatedWorktree, RemoteName: "origin", BaseBranch: "main", BaseCommit: head, TaskBranch: branch, SourceRepositoryGroupDigest: digest, CanonicalWorktreeRoot: root, WorktreeGitDirDigest: digest, ProvisioningReceiptID: ID("receipt-" + string(key))},
		Binding: RepositoryBinding{WorktreeInstanceDigest: digest, IdentityDigest: digest, HistoryDigest: digest, ContentDigest: digest, CurrentBranch: &branch, CurrentHead: head, HeadTree: head, HistoryRelation: RepositoryHistoryExact, BaseCommitAncestor: true, ObservedAt: now, BindingDigest: digest},
	}
}

func validProcessTaskForDomainTest(now time.Time, digest Digest) ProcessTask {
	branch := "feature/task"
	head := strings.Repeat("b", 40)
	root := testpath.Absolute("repo")
	origin := WorkspaceOrigin{Mode: WorkspaceModeDedicatedWorktree, RemoteName: "origin", BaseBranch: "main", BaseCommit: head, TaskBranch: branch, SourceRepositoryGroupDigest: digest, CanonicalWorktreeRoot: root, WorktreeGitDirDigest: digest, ProvisioningReceiptID: "receipt-task"}
	repository := RepositoryBinding{WorktreeInstanceDigest: digest, IdentityDigest: digest, HistoryDigest: digest, ContentDigest: digest, CurrentBranch: &branch, CurrentHead: head, HeadTree: head, HistoryRelation: RepositoryHistoryExact, BaseCommitAncestor: true, ObservedAt: now, BindingDigest: digest}
	process := ProcessReference{ID: ProcessStandardDevelopment, DefinitionDigest: digest}
	action := &ProcessAction{ActionID: "action", Kind: ActionCompleteRequirements, TaskID: "task", Revision: 1, Process: process, NodeID: NodeRequirements, RepositoryBindingDigest: digest, IssuanceIdentityDigest: digest, IssuanceHistoryDigest: digest, IssuanceContentDigest: digest, AllowedEffects: []AllowedEffect{EffectReadRepository}, RequiredEvidence: []EvidenceRequirement{{Kind: RequirementRepositoryObservation, Required: true}}, PayloadContract: "requirements-result", NodeContract: NodeContractProjection{Purpose: "Capture requirements.", EntryConditions: []string{"intent"}, CompletionConditions: []string{"baseline"}}, MethodProfile: MethodPlain, SemanticMethodSteps: []SemanticMethodStep{{StepID: "requirements.capture", Purpose: "Capture requirements.", Required: true}}, Guidance: "Complete requirements.", IssuedAt: now}
	return ProcessTask{TaskID: "task", OriginHost: HostCodex, Intent: TaskIntent{Request: "Request", VerificationBudget: VerificationBudget{Level: VerificationTargeted, MaxAutomaticCommands: 1}, MethodProfile: MethodPlain}, Process: process, CurrentNode: NodeRequirements, CurrentAction: action, WorkspaceOrigin: origin, Repository: repository, Revision: 1, CreatedAt: now, UpdatedAt: now}
}
