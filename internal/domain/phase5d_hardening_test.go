package domain

import (
	"testing"
	"time"
)

func TestProcessTaskAuthorityMatrixAcceptsEveryNodeShape(t *testing.T) {
	for _, node := range []NodeID{NodeRequirements, NodeDesign, NodeTasks, NodeImplement, NodeTest, NodeComprehensionReview, NodeRefactor, NodeDelivery, NodeDone, NodeBlocked, NodeCancelled} {
		t.Run(string(node), func(t *testing.T) {
			task := authorityMatrixTask(t, node)
			if err := task.Validate(); err != nil {
				t.Fatalf("valid %s task: %v", node, err)
			}
		})
	}
}

func TestProcessTaskAuthorityMatrixRejectsForbiddenDownstreamState(t *testing.T) {
	full := invalidationMatrixTask(t)
	tests := []struct {
		node   NodeID
		mutate func(*ProcessTask)
	}{
		{NodeRequirements, func(task *ProcessTask) { task.Design = full.Design }},
		{NodeDesign, func(task *ProcessTask) { task.TaskPlan = full.TaskPlan }},
		{NodeTasks, func(task *ProcessTask) { task.TaskPlan = full.TaskPlan }},
		{NodeImplement, func(task *ProcessTask) { task.Test = full.Test }},
		{NodeTest, func(task *ProcessTask) { task.Test = full.Test }},
		{NodeComprehensionReview, func(task *ProcessTask) { task.Comprehension = full.Comprehension }},
		{NodeRefactor, func(task *ProcessTask) { task.Test = full.Test }},
		{NodeDelivery, func(task *ProcessTask) {
			now := task.UpdatedAt
			task.Outcome = completedMatrixOutcome(*task, now)
		}},
	}
	for _, tc := range tests {
		t.Run(string(tc.node), func(t *testing.T) {
			task := authorityMatrixTask(t, tc.node)
			tc.mutate(&task)
			if err := task.Validate(); err == nil {
				t.Fatal("forbidden downstream authority accepted")
			}
		})
	}
}

func TestProcessTaskAuthorityMatrixRejectsCrossRecordCorruption(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*ProcessTask)
	}{
		{"acceptance index", func(task *ProcessTask) { task.TaskPlan.WorkItems[0].AcceptanceIndexes = []uint32{1} }},
		{"implementation work item", func(task *ProcessTask) { task.Implementation.CompletedWorkItemIDs = []ID{"unknown"} }},
		{"test evidence missing", func(task *ProcessTask) { task.Test.EvidenceIDs = []ID{"missing"} }},
		{"test evidence failed", func(task *ProcessTask) { task.Evidence[0].Status = EvidenceFailed }},
		{"comprehension test authority", func(task *ProcessTask) { task.Comprehension.TestRecordID = "other-test" }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			task := authorityMatrixTask(t, NodeDelivery)
			tc.mutate(&task)
			if err := task.Validate(); err == nil {
				t.Fatal("cross-record corruption accepted")
			}
		})
	}

	done := authorityMatrixTask(t, NodeDone)
	done.Outcome.AutomatedEvidenceIDs = nil
	if err := done.Validate(); err == nil {
		t.Fatal("completed outcome without exact current automated evidence accepted")
	}
}

func authorityMatrixTask(t *testing.T, node NodeID) ProcessTask {
	t.Helper()
	base := invalidationMatrixTask(t)
	base.Blocker, base.ResumeNode, base.Outcome, base.CompletedAt = nil, nil, nil, nil
	switch node {
	case NodeRequirements:
		base.Design, base.TaskPlan, base.Implementation, base.Test, base.Comprehension = nil, nil, nil, nil, nil
	case NodeDesign:
		base.TaskPlan, base.Implementation, base.Test, base.Comprehension = nil, nil, nil, nil
	case NodeTasks:
		base.TaskPlan, base.Implementation, base.Test, base.Comprehension = nil, nil, nil, nil
	case NodeImplement:
		base.Test, base.Comprehension = nil, nil
	case NodeTest:
		base.Test, base.Comprehension = nil, nil
	case NodeComprehensionReview:
		base.Comprehension = nil
	case NodeRefactor:
		base.Test, base.Comprehension = nil, nil
	case NodeDelivery:
	case NodeDone:
		now := base.UpdatedAt
		base.Outcome = completedMatrixOutcome(base, now)
		base.CompletedAt = &now
		base.CurrentAction = nil
	case NodeBlocked:
		resume := NodeTest
		base.Test, base.Comprehension = nil, nil
		base.ResumeNode = &resume
		base.Blocker = &ProcessBlocker{BlockerID: "blocker", ResumeNode: resume, Message: "Restore repository binding."}
	case NodeCancelled:
		now := base.UpdatedAt
		base.Design, base.TaskPlan, base.Implementation, base.Test, base.Comprehension = nil, nil, nil, nil, nil
		base.Outcome = &ProcessOutcome{Status: TerminalCancelled, Summary: "Task cancelled.", RequirementsRevision: base.Requirements.Revision, FinalRepositoryDigest: base.Repository.BindingDigest, CompletedAt: now}
		base.CompletedAt = &now
		base.CurrentAction = nil
	}
	base.CurrentNode = node
	if !node.Terminal() {
		setAuthorityMatrixAction(&base, node)
	}
	return base
}

func setAuthorityMatrixAction(task *ProcessTask, node NodeID) {
	kinds := map[NodeID]ActionKind{
		NodeRequirements: ActionCompleteRequirements, NodeDesign: ActionCompleteDesign, NodeTasks: ActionCompleteTasks,
		NodeImplement: ActionCompleteImplementation, NodeTest: ActionCompleteTest, NodeComprehensionReview: ActionCompleteComprehensionReview,
		NodeRefactor: ActionCompleteRefactor, NodeDelivery: ActionCompleteDelivery, NodeBlocked: ActionResolveBlocker,
	}
	payloads := map[NodeID]string{
		NodeRequirements: "requirements-result@1", NodeDesign: "design-result@1", NodeTasks: "tasks-result@1",
		NodeImplement: "implementation-result@1", NodeTest: "test-result@1", NodeComprehensionReview: "comprehension-result@1",
		NodeRefactor: "refactor-result@1", NodeDelivery: "delivery-result@1", NodeBlocked: "blocker-resolution@1",
	}
	action := *task.CurrentAction
	action.Kind, action.NodeID, action.PayloadContract = kinds[node], node, payloads[node]
	action.NodeContract = NodeContractProjection{Purpose: "Perform current node work.", EntryConditions: []string{"authority available"}, CompletionConditions: []string{"work complete"}}
	action.SemanticMethodSteps = []SemanticMethodStep{{StepID: MethodStepID("node.perform"), Purpose: "Perform node work.", Required: true}}
	action.AvailableTransitions = nil
	action.Guidance = "Complete the current node."
	task.CurrentAction = &action
}

func completedMatrixOutcome(task ProcessTask, now time.Time) *ProcessOutcome {
	return &ProcessOutcome{
		Status: TerminalCompleted, Summary: "Task completed.", RequirementsRevision: task.Requirements.Revision,
		Acceptance:   []OutcomeCriterion{{Criterion: task.Requirements.AcceptanceCriteria[0], Status: CriterionSatisfied}},
		TestRecordID: task.Test.RecordID, ComprehensionRecordID: task.Comprehension.RecordID,
		AutomatedEvidenceIDs: []ID{"automated"}, ManualEvidenceIDs: []ID{"user"},
		FinalRepositoryDigest: task.Repository.BindingDigest, CompletedAt: now,
	}
}
