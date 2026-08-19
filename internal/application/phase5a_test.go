package application

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestRequirementsBaselineRevisionDigestHistoryAndInvalidation(t *testing.T) {
	s, _, _ := phase5Service(t)
	task := openPhase5Task(t, s)
	requirements := requirementsNodeResult("Goal", []string{"criterion-a", "criterion-b"})
	task = applyPhase5(t, s, task, "requirements_ready", "", requirements)
	firstDigest := task.Requirements.Digest
	task = applyPhase5(t, s, task, "design_ready", "", designNodeResult(1, "Direct design"))
	task = applyPhase5(t, s, task, "tasks_ready", "", tasksNodeResult(1, []map[string]any{workItem("work-a", []uint32{0, 1}, nil)}))

	task = applyPhase5(t, s, task, "implementation_requires_requirements", "Acceptance changed.", implementationNodeResult(1, nil, true, []string{"Requirement gap"}))
	if task.CurrentNode != domain.NodeRequirements || task.Design != nil || task.TaskPlan != nil || task.Implementation != nil || task.Test != nil || task.Comprehension != nil {
		t.Fatal("requirements return retained downstream authority")
	}
	task = applyPhase5(t, s, task, "requirements_ready", "", requirements)
	if task.Requirements.Revision != 2 || task.Requirements.Digest != firstDigest {
		t.Fatalf("revision=%d digest stable=%v", task.Requirements.Revision, task.Requirements.Digest == firstDigest)
	}
	if !hasHistory(task, domain.BaselineRequirements, 1) || !hasHistory(task, domain.BaselineDesign, 1) || !hasHistory(task, domain.BaselineTaskPlan, 1) {
		t.Fatal("superseded baselines missing from history")
	}

	different := requirementsNodeResult("Different goal", []string{"criterion-a", "criterion-b"})
	left, _ := requirementsDigest(workflowRequirements(t, requirements), nil)
	right, _ := requirementsDigest(workflowRequirements(t, different), nil)
	if left == right {
		t.Fatal("different normalized requirements produced the same digest")
	}
}

func TestDesignAndTaskPlanRevisionBindingValidationAndInvalidation(t *testing.T) {
	s, ms, _ := phase5Service(t)
	task := openPhase5Task(t, s)
	task = applyPhase5(t, s, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"a", "b"}))
	before := ms.commits
	assertApplyFails(t, s, task, "design_ready", "", designNodeResult(99, "Stale"), domain.ErrInvalidArgument)
	if ms.commits != before {
		t.Fatal("stale requirements revision wrote state")
	}
	task = applyPhase5(t, s, task, "design_ready", "", designNodeResult(1, "Design one"))
	if task.Design.Revision != 1 || task.Design.RequirementsRevision != 1 {
		t.Fatal("first design revision/binding invalid")
	}

	invalidPlans := []struct {
		name  string
		items []map[string]any
	}{
		{"missing dependency", []map[string]any{workItem("work-a", []uint32{0, 1}, []string{"missing"})}},
		{"self dependency", []map[string]any{workItem("work-a", []uint32{0, 1}, []string{"work-a"})}},
		{"cycle", []map[string]any{workItem("work-a", []uint32{0}, []string{"work-b"}), workItem("work-b", []uint32{1}, []string{"work-a"})}},
		{"acceptance out of range", []map[string]any{workItem("work-a", []uint32{0, 2}, nil)}},
		{"acceptance uncovered", []map[string]any{workItem("work-a", []uint32{0}, nil)}},
	}
	for _, tc := range invalidPlans {
		t.Run(tc.name, func(t *testing.T) {
			before := ms.commits
			assertApplyFails(t, s, task, "tasks_ready", "", tasksNodeResult(1, tc.items), domain.ErrInvalidArgument)
			if ms.commits != before {
				t.Fatal("invalid task plan wrote state")
			}
		})
	}
	assertApplyFails(t, s, task, "tasks_ready", "", tasksNodeResult(99, []map[string]any{workItem("work-a", []uint32{0, 1}, nil)}), domain.ErrInvalidArgument)
	task = applyPhase5(t, s, task, "tasks_ready", "", tasksNodeResult(1, []map[string]any{workItem("work-a", []uint32{0, 1}, nil)}))
	if task.TaskPlan.Revision != 1 || task.TaskPlan.DesignRevision != 1 {
		t.Fatal("first task plan revision/binding invalid")
	}
	task = applyPhase5(t, s, task, "implementation_requires_design", "Design gap.", implementationNodeResult(1, nil, true, []string{"Design gap"}))
	if task.TaskPlan != nil || task.Implementation != nil || task.Test != nil || task.Comprehension != nil {
		t.Fatal("design return retained downstream authority")
	}
	task = applyPhase5(t, s, task, "design_ready", "", designNodeResult(1, "Design two"))
	if task.Design.Revision != 2 || !hasHistory(task, domain.BaselineDesign, 1) {
		t.Fatal("design revision/history did not advance")
	}
	task = applyPhase5(t, s, task, "tasks_ready", "", tasksNodeResult(2, []map[string]any{workItem("work-b", []uint32{0, 1}, nil)}))
	if task.TaskPlan.Revision != 2 || !hasHistory(task, domain.BaselineTaskPlan, 1) {
		t.Fatal("task plan revision/history did not advance")
	}
}

func TestImplementationTransitionsRecordsRepositoryEffectsAndZeroWrites(t *testing.T) {
	transitions := []struct {
		id          string
		destination domain.NodeID
		reason      string
	}{
		{"implementation_ready_for_test", domain.NodeTest, ""},
		{"implementation_requires_design", domain.NodeDesign, "Design gap."},
		{"implementation_requires_requirements", domain.NodeRequirements, "Requirement gap."},
		{"implementation_needs_refactor", domain.NodeRefactor, "Complexity found."},
	}
	for _, tc := range transitions {
		t.Run(tc.id, func(t *testing.T) {
			s, ms, _ := phase5Service(t)
			task := phase5TaskAtImplement(t, s)
			result := applyPhase5(t, s, task, tc.id, tc.reason, implementationNodeResult(1, []string{"work-a"}, true, problemFindings(tc.id)))
			if result.CurrentNode != tc.destination {
				t.Fatalf("destination=%s", result.CurrentNode)
			}
			if ms.lastMutation.Event.SourceNode != domain.NodeImplement || ms.lastMutation.Event.DestinationNode != tc.destination || ms.lastMutation.Event.TransitionReason != tc.reason {
				t.Fatal("task event lost transition authority")
			}
			if tc.destination == domain.NodeTest || tc.destination == domain.NodeRefactor {
				if result.Implementation == nil || result.Implementation.Revision != 1 {
					t.Fatal("implementation record missing")
				}
			}
		})
	}

	s, ms, observer := phase5Service(t)
	task := phase5TaskAtImplement(t, s)
	before := ms.commits
	assertApplyFails(t, s, task, "implementation_needs_refactor", "", implementationNodeResult(1, nil, true, []string{"Complexity"}), domain.ErrInvalidArgument)
	assertApplyFails(t, s, task, "implementation_ready_for_test", "", implementationNodeResult(99, nil, true, nil), domain.ErrInvalidArgument)
	assertApplyFails(t, s, task, "implementation_ready_for_test", "", implementationNodeResult(1, []string{"unknown"}, true, nil), domain.ErrInvalidArgument)
	if ms.commits != before {
		t.Fatal("invalid implementation wrote state")
	}

	changed := observer.binding.Clone()
	changed.WorktreeFingerprint = digestOf("c")
	changed.BindingDigest = digestOf("d")
	observer.binding = changed
	task = applyPhase5(t, s, task, "implementation_ready_for_test", "", implementationNodeResultWithPaths(1, []string{"work-a"}, []string{"internal/file.go"}, nil))
	if task.Repository.BindingDigest != changed.BindingDigest || task.Implementation.RepositoryBindingDigest != changed.BindingDigest {
		t.Fatal("worktree-only observation was not accepted as authority")
	}

	s, ms, observer = phase5Service(t)
	task = phase5TaskAtImplement(t, s)
	for name, mutate := range map[string]func(*domain.RepositoryBinding){
		"branch":           func(binding *domain.RepositoryBinding) { branch := "other"; binding.Branch = &branch },
		"head":             func(binding *domain.RepositoryBinding) { head := strings.Repeat("c", 40); binding.Head = &head },
		"identity":         func(binding *domain.RepositoryBinding) { binding.RepositoryIdentity = digestOf("f") },
		"common directory": func(binding *domain.RepositoryBinding) { binding.GitCommonDirDigest = digestOf("f") },
	} {
		t.Run(name+" drift", func(t *testing.T) {
			drift := observer.binding.Clone()
			mutate(&drift)
			drift.BindingDigest = digestOf("e")
			observer.binding = drift
			before := ms.commits
			assertApplyFails(t, s, task, "implementation_ready_for_test", "", implementationNodeResultWithPaths(1, []string{"work-a"}, []string{"internal/file.go"}, nil), domain.ErrRepositoryDrift)
			if ms.commits != before {
				t.Fatal("forbidden repository drift wrote state")
			}
			observer.binding = task.Repository
		})
	}
}

func TestImplementationRevisionAndCurrentEvidenceInvalidation(t *testing.T) {
	s, ms, _ := phase5Service(t)
	task := phase5TaskAtImplement(t, s)
	task = applyPhase5(t, s, task, "implementation_needs_refactor", "Complexity found.", implementationNodeResult(1, []string{"work-a"}, true, []string{"Complexity"}))
	if task.Test != nil || task.Comprehension != nil || task.Implementation == nil || task.Implementation.Revision != 1 {
		t.Fatal("implementation did not invalidate current evidence")
	}

	// Simulate the contract-defined tested rework return without implementing the later TEST mutation slice.
	task.CurrentNode = domain.NodeImplement
	action, err := workflow.BuildProcessAction(workflow.StandardProcess(), domain.NodeImplement, task.TaskID, task.Revision, task.Repository.BindingDigest, task.Intent.MethodProfile, "action-rework", task.UpdatedAt)
	if err != nil {
		t.Fatal(err)
	}
	task.CurrentAction = &action
	ms.task = &task
	task = applyPhase5(t, s, task, "implementation_ready_for_test", "", implementationNodeResult(1, []string{"work-a"}, true, nil))
	if task.Implementation.Revision != 2 {
		t.Fatalf("implementation revision=%d", task.Implementation.Revision)
	}
}

func TestBaselineHistoryLimitIsEnforced(t *testing.T) {
	now := time.Date(2026, 8, 19, 8, 0, 0, 0, time.UTC)
	task := domain.ProcessTask{}
	for i := 1; i <= domain.MaxRetainedBaselineReferences; i++ {
		task.BaselineHistory = append(task.BaselineHistory, domain.BaselineReference{Kind: domain.BaselineRequirements, Revision: uint32(i), Digest: digestOf("a"), Summary: fmt.Sprintf("revision %d", i), CreatedAt: now})
	}
	err := appendBaselineHistory(&task, domain.BaselineReference{Kind: domain.BaselineRequirements, Revision: 33, Digest: digestOf("b"), Summary: "revision 33", CreatedAt: now})
	if err != domain.ErrInvalidArgument || len(task.BaselineHistory) != domain.MaxRetainedBaselineReferences {
		t.Fatal("baseline history limit was not enforced")
	}
}

func phase5Service(t *testing.T) (*Service, *memoryStore, *mutableObserver) {
	t.Helper()
	now := time.Date(2026, 8, 19, 8, 0, 0, 0, time.UTC)
	d := digestOf("a")
	branch := "main"
	head := strings.Repeat("b", 40)
	binding := domain.RepositoryBinding{CanonicalRoot: "/repo", GitCommonDirDigest: d, RepositoryIdentity: d, Branch: &branch, Head: &head, WorktreeFingerprint: d, ObservedAt: now, BindingDigest: d}
	ms := &memoryStore{}
	observer := &mutableObserver{binding: binding}
	n := 0
	s, err := newService(ms, observer, func() time.Time { return now }, func(prefix string) (domain.ID, error) { n++; return domain.ID(fmt.Sprintf("%s-%d", prefix, n)), nil })
	if err != nil {
		t.Fatal(err)
	}
	return s, ms, observer
}

func openPhase5Task(t *testing.T, s *Service) domain.ProcessTask {
	t.Helper()
	result, err := s.OpenTask(context.Background(), OpenTaskRequest{RequestID: "open-request", Host: domain.HostCodex, RepositoryPath: "/repo", NewTask: &NewTaskInput{Request: "Build feature", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 4, AllowManualHandoff: true}, MethodProfile: domain.MethodPlain}})
	if err != nil {
		t.Fatal(err)
	}
	return result.Task
}
func phase5TaskAtImplement(t *testing.T, s *Service) domain.ProcessTask {
	task := openPhase5Task(t, s)
	task = applyPhase5(t, s, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"criterion"}))
	task = applyPhase5(t, s, task, "design_ready", "", designNodeResult(1, "Design"))
	return applyPhase5(t, s, task, "tasks_ready", "", tasksNodeResult(1, []map[string]any{workItem("work-a", []uint32{0}, nil)}))
}
func applyPhase5(t *testing.T, s *Service, task domain.ProcessTask, transition, reason string, nodeResult any) domain.ProcessTask {
	t.Helper()
	raw := phase5Payload(t, task, transition, reason, nodeResult)
	a := task.CurrentAction
	result, err := s.ApplyAction(context.Background(), ApplyActionRequest{RequestID: domain.ID(fmt.Sprintf("apply-%d", task.Revision)), Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision, ActionID: a.ActionID, ActionKind: a.Kind, ProcessID: task.Process.ID, ProcessVersion: task.Process.Version, ProcessDefinitionDigest: task.Process.DefinitionDigest, SourceCursor: task.CurrentNode, RepositoryBindingDigest: task.Repository.BindingDigest, Payload: raw})
	if err != nil {
		t.Fatalf("apply %s: %v", transition, err)
	}
	return result.Task
}
func assertApplyFails(t *testing.T, s *Service, task domain.ProcessTask, transition, reason string, nodeResult any, want error) {
	t.Helper()
	raw := phase5Payload(t, task, transition, reason, nodeResult)
	a := task.CurrentAction
	_, err := s.ApplyAction(context.Background(), ApplyActionRequest{RequestID: "apply-invalid", Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision, ActionID: a.ActionID, ActionKind: a.Kind, ProcessID: task.Process.ID, ProcessVersion: task.Process.Version, ProcessDefinitionDigest: task.Process.DefinitionDigest, SourceCursor: task.CurrentNode, RepositoryBindingDigest: task.Repository.BindingDigest, Payload: raw})
	if err != want {
		t.Fatalf("error=%v want=%v", err, want)
	}
}
func phase5Payload(t *testing.T, task domain.ProcessTask, transition, reason string, nodeResult any) json.RawMessage {
	t.Helper()
	if fields, ok := nodeResult.(map[string]any); ok {
		fields["problem_class"] = phase5ProblemClass(transition)
	}
	raw, err := json.Marshal(map[string]any{"transition_id": transition, "summary": "Result recorded.", "reason": reason, "artifacts": []any{}, "method_evidence": methodEvidenceForCurrentAction(task, domain.MethodStepPlainFallback, ""), "node_result": nodeResult})
	if err != nil {
		t.Fatal(err)
	}
	return raw
}
func methodEvidenceForCurrentAction(task domain.ProcessTask, status domain.MethodStepStatus, capability string) []map[string]any {
	if task.CurrentAction == nil {
		return nil
	}
	return methodEvidenceForSteps(task.CurrentAction.SemanticMethodSteps, status, capability)
}
func methodEvidenceForSteps(steps []domain.SemanticMethodStep, status domain.MethodStepStatus, capability string) []map[string]any {
	items := make([]map[string]any, len(steps))
	for i, step := range steps {
		items[i] = map[string]any{"step_id": step.StepID, "status": status, "capability": capability, "summary": "Completed the current semantic method step."}
	}
	return items
}
func phase5ProblemClass(transition string) string {
	classes := map[string]string{
		"requirements_ready": "none",
		"design_ready":       "none", "design_requires_requirements": "requirement_gap",
		"tasks_ready": "none", "tasks_require_design": "design_gap", "tasks_require_requirements": "requirement_gap",
		"implementation_ready_for_test": "none", "implementation_requires_design": "design_gap", "implementation_requires_requirements": "requirement_gap", "implementation_needs_refactor": "code_complexity",
		"tests_passed": "none", "tests_failed_implementation": "implementation_failure", "tests_expose_design_issue": "design_failure", "tests_expose_requirement_issue": "requirement_gap",
		"comprehension_passed": "none", "implementation_defect": "implementation_defect", "code_too_complex": "code_complexity", "design_too_complex": "design_complexity", "evidence_insufficient": "verification_gap", "requirement_unclear": "requirement_gap",
		"refactor_ready_for_test": "none", "refactor_requires_design": "design_change", "refactor_requires_requirements": "requirement_change",
		"delivery_complete": "none", "delivery_needs_implementation": "implementation_gap", "delivery_needs_test": "test_gap", "delivery_needs_comprehension": "comprehension_gap", "delivery_needs_design": "design_gap", "delivery_needs_requirements": "requirement_gap",
	}
	return classes[transition]
}
func requirementsNodeResult(goal string, acceptance []string) map[string]any {
	return map[string]any{"baseline": map[string]any{"goal": goal, "scope": []string{}, "out_of_scope": []string{}, "acceptance_criteria": acceptance, "constraints": []string{}, "assumptions": []string{}}, "unresolved_questions": []string{}}
}
func designNodeResult(revision uint32, approach string) map[string]any {
	return map[string]any{"baseline": map[string]any{"requirements_revision": revision, "approach": approach, "components": []string{"component"}, "decisions": []string{"Reuse boundary"}, "rejected_alternatives": []string{}, "complexity_justification": []string{}, "risks": []string{}}, "findings": []string{}}
}
func workItem(id string, acceptance []uint32, dependencies []string) map[string]any {
	if dependencies == nil {
		dependencies = []string{}
	}
	return map[string]any{"work_item_id": id, "summary": "Implement work", "expected_paths": []string{"internal/file.go"}, "acceptance_indexes": acceptance, "verification_steps": []string{"Run targeted test"}, "dependencies": dependencies}
}
func tasksNodeResult(revision uint32, items []map[string]any) map[string]any {
	return map[string]any{"baseline": map[string]any{"design_revision": revision, "work_items": items}, "findings": []string{}}
}
func implementationNodeResult(revision uint32, completed []string, noChanges bool, findings []string) map[string]any {
	if completed == nil {
		completed = []string{}
	}
	if findings == nil {
		findings = []string{}
	}
	return map[string]any{"task_plan_revision": revision, "completed_work_item_ids": completed, "changed_paths": []string{}, "no_file_changes": noChanges, "deviations": []string{}, "findings": findings}
}
func implementationNodeResultWithPaths(revision uint32, completed, paths, findings []string) map[string]any {
	if findings == nil {
		findings = []string{}
	}
	return map[string]any{"task_plan_revision": revision, "completed_work_item_ids": completed, "changed_paths": paths, "no_file_changes": false, "deviations": []string{}, "findings": findings}
}
func problemFindings(transition string) []string {
	if transition == "implementation_ready_for_test" {
		return []string{}
	}
	return []string{"Problem identified"}
}
func hasHistory(task domain.ProcessTask, kind domain.BaselineKind, revision uint32) bool {
	for _, ref := range task.BaselineHistory {
		if ref.Kind == kind && ref.Revision == revision && ref.Digest.IsValid() && ref.Summary != "" && !ref.CreatedAt.IsZero() {
			return true
		}
	}
	return false
}
func digestOf(char string) domain.Digest { return domain.Digest(strings.Repeat(char, 64)) }
func phase5UserEvidence(now time.Time, id domain.ID) domain.EvidenceSummary {
	return domain.EvidenceSummary{EvidenceID: id, Source: domain.EvidenceSourceUser, Name: "confirmation", Status: domain.EvidencePassed, Summary: "User confirmed.", Digest: digestOf("a"), RecordedAt: now}
}

func workflowRequirements(t *testing.T, value map[string]any) workflow.RequirementsBaselineInput {
	t.Helper()
	raw, _ := json.Marshal(value["baseline"])
	var result workflow.RequirementsBaselineInput
	if err := json.Unmarshal(raw, &result); err != nil {
		t.Fatal(err)
	}
	return result
}
