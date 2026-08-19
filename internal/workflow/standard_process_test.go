package workflow_test

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type standardProcessStore struct {
	task   domain.ProcessTask
	writes int
}

func (s *standardProcessStore) LoadTask(context.Context, domain.ID) (domain.ProcessTask, error) {
	return s.task, nil
}
func (s *standardProcessStore) LoadActiveTask(context.Context, domain.Digest) (domain.ProcessTask, error) {
	if s.task.TaskID == "" {
		return domain.ProcessTask{}, store.ErrTaskNotFound
	}
	return s.task, nil
}
func (s *standardProcessStore) CommitTask(_ context.Context, mutation store.TaskMutation) error {
	s.task = mutation.Task
	s.writes++
	return nil
}

type standardProcessObserver struct{ binding domain.RepositoryBinding }

func (o standardProcessObserver) Observe(context.Context, string) (domain.RepositoryBinding, error) {
	return o.binding, nil
}

type standardTransitionCase struct {
	declarationIndex     int
	sourceNode           domain.NodeID
	transitionID         domain.TransitionID
	destinationNode      domain.NodeID
	guardID              domain.TransitionGuardID
	reasonRequired       bool
	validPayloadFacts    string
	invalidPayloadFacts  string
	expectedInvalidation []string
}

func TestStandardProcessAllTransitionsAndGuards(t *testing.T) {
	definition := workflow.StandardProcess()
	cases := standardTransitionCases()
	if len(definition.Nodes) != 11 || len(definition.Transitions) != 29 || len(cases) != 29 {
		t.Fatalf("nodes=%d transitions=%d cases=%d", len(definition.Nodes), len(definition.Transitions), len(cases))
	}
	seen := map[domain.TransitionID]bool{}
	for i, tc := range cases {
		declared := definition.Transitions[i]
		if tc.declarationIndex != i+1 || declared.TransitionID != tc.transitionID || declared.Source != tc.sourceNode || declared.Destination != tc.destinationNode || declared.Guard != tc.guardID || declared.ReasonRequired != tc.reasonRequired {
			t.Fatalf("declaration %d does not match contract: %#v %#v", i+1, declared, tc)
		}
		if seen[tc.transitionID] {
			t.Fatalf("duplicate transition %s", tc.transitionID)
		}
		seen[tc.transitionID] = true
		node := processNode(t, definition, tc.sourceNode)
		count := 0
		for _, transition := range node.OutgoingTransitions {
			if transition.TransitionID == tc.transitionID {
				count++
			}
		}
		if count != 1 {
			t.Fatalf("%s appears %d times at %s", tc.transitionID, count, tc.sourceNode)
		}
		for _, other := range definition.Nodes {
			if other.NodeID == tc.sourceNode {
				continue
			}
			for _, transition := range other.OutgoingTransitions {
				if transition.TransitionID == tc.transitionID {
					t.Fatalf("%s also appears at %s", tc.transitionID, other.NodeID)
				}
			}
		}

		t.Run(fmt.Sprintf("%02d_%s", tc.declarationIndex, tc.transitionID), func(t *testing.T) {
			service, memory, snapshots := standardProcessFixture(t)
			memory.task = snapshots[tc.sourceNode]
			before := memory.writes
			result, err := applyStandard(t, service, memory.task, tc.transitionID, reasonFor(tc), validNodeResult(memory.task, tc.transitionID))
			if err != nil {
				t.Fatalf("valid facts %q rejected: %v", tc.validPayloadFacts, err)
			}
			if result.CurrentNode != tc.destinationNode || memory.writes != before+1 {
				t.Fatalf("destination=%s writes=%d", result.CurrentNode, memory.writes-before)
			}
			assertExpectedInvalidation(t, result, tc.expectedInvalidation)

			memory.task = snapshots[tc.sourceNode]
			before = memory.writes
			_, err = applyStandard(t, service, memory.task, tc.transitionID, reasonFor(tc), invalidNodeResult(memory.task, tc.transitionID))
			if err == nil || memory.writes != before {
				t.Fatalf("invalid facts %q error=%v writes=%d", tc.invalidPayloadFacts, err, memory.writes-before)
			}

			for _, wrongSource := range []domain.NodeID{domain.NodeRequirements, domain.NodeDesign, domain.NodeTasks, domain.NodeImplement, domain.NodeTest, domain.NodeComprehensionReview, domain.NodeRefactor, domain.NodeDelivery} {
				if wrongSource == tc.sourceNode {
					continue
				}
				memory.task = snapshots[wrongSource]
				before = memory.writes
				_, err = applyStandard(t, service, memory.task, tc.transitionID, reasonFor(tc), validNodeResult(memory.task, tc.transitionID))
				if err != domain.ErrTransitionNotAllowed || memory.writes != before {
					t.Fatalf("source %s error=%v writes=%d", wrongSource, err, memory.writes-before)
				}
			}
		})
	}
}

func TestStandardProcessReasonMalformedTerminalAndExceptionalRejections(t *testing.T) {
	service, memory, snapshots := standardProcessFixture(t)
	for _, tc := range standardTransitionCases() {
		memory.task = snapshots[tc.sourceNode]
		before := memory.writes
		reason := "unexpected reason"
		if tc.reasonRequired {
			reason = ""
		}
		_, err := applyStandard(t, service, memory.task, tc.transitionID, reason, validNodeResult(memory.task, tc.transitionID))
		if err != domain.ErrInvalidArgument || memory.writes != before {
			t.Fatalf("%s reason rule error=%v writes=%d", tc.transitionID, err, memory.writes-before)
		}
		if tc.reasonRequired {
			for _, invalid := range []string{"   ", " reason", "reason ", strings.Repeat("r", domain.MaxReasonBytes+1)} {
				_, err = applyStandard(t, service, memory.task, tc.transitionID, invalid, validNodeResult(memory.task, tc.transitionID))
				if err != domain.ErrInvalidArgument || memory.writes != before {
					t.Fatalf("%s accepted invalid reason", tc.transitionID)
				}
			}
		}
	}

	memory.task = snapshots[domain.NodeTest]
	before := memory.writes
	a := memory.task.CurrentAction
	_, err := service.ApplyAction(context.Background(), application.ApplyActionRequest{RequestID: "malformed", Host: domain.HostCodex, TaskID: memory.task.TaskID, ExpectedRevision: memory.task.Revision, ActionID: a.ActionID, ActionKind: a.Kind, ProcessID: memory.task.Process.ID, ProcessVersion: memory.task.Process.Version, ProcessDefinitionDigest: memory.task.Process.DefinitionDigest, SourceCursor: memory.task.CurrentNode, RepositoryBindingDigest: memory.task.Repository.BindingDigest, Payload: json.RawMessage(`{"transition_id":`)})
	if err != domain.ErrInvalidArgument || memory.writes != before {
		t.Fatalf("malformed payload error=%v writes=%d", err, memory.writes-before)
	}
	forbiddenDestination := map[string]any{"transition_id": "tests_passed", "destination": "DONE", "summary": "Caller destination is forbidden.", "reason": "", "artifacts": []any{}, "method_evidence": []any{}, "node_result": validNodeResult(memory.task, "tests_passed")}
	rawDestination, marshalErr := json.Marshal(forbiddenDestination)
	if marshalErr != nil {
		t.Fatal(marshalErr)
	}
	_, err = service.ApplyAction(context.Background(), application.ApplyActionRequest{RequestID: "caller-destination", Host: domain.HostCodex, TaskID: memory.task.TaskID, ExpectedRevision: memory.task.Revision, ActionID: a.ActionID, ActionKind: a.Kind, ProcessID: memory.task.Process.ID, ProcessVersion: memory.task.Process.Version, ProcessDefinitionDigest: memory.task.Process.DefinitionDigest, SourceCursor: memory.task.CurrentNode, RepositoryBindingDigest: memory.task.Repository.BindingDigest, Payload: rawDestination})
	if err != domain.ErrInvalidArgument || memory.writes != before {
		t.Fatalf("caller destination error=%v writes=%d", err, memory.writes-before)
	}

	done := snapshots[domain.NodeDelivery]
	memory.task = done
	doneResult, err := applyStandard(t, service, done, "delivery_complete", "", validNodeResult(done, "delivery_complete"))
	if err != nil {
		t.Fatal(err)
	}
	for _, terminal := range []domain.ProcessTask{doneResult, cancelledTask(doneResult), blockedTask(t, snapshots[domain.NodeTest])} {
		memory.task = terminal
		before = memory.writes
		actionID, actionKind := domain.ID("terminal-action"), domain.ActionCompleteTest
		if terminal.CurrentAction != nil {
			actionID, actionKind = terminal.CurrentAction.ActionID, terminal.CurrentAction.Kind
		}
		_, err = service.ApplyAction(context.Background(), application.ApplyActionRequest{RequestID: "terminal-attempt", Host: domain.HostCodex, TaskID: terminal.TaskID, ExpectedRevision: terminal.Revision, ActionID: actionID, ActionKind: actionKind, ProcessID: terminal.Process.ID, ProcessVersion: terminal.Process.Version, ProcessDefinitionDigest: terminal.Process.DefinitionDigest, SourceCursor: terminal.CurrentNode, RepositoryBindingDigest: terminal.Repository.BindingDigest, Payload: standardPayload(t, "tests_passed", "", validNodeResult(snapshots[domain.NodeTest], "tests_passed"))})
		if terminal.CurrentNode == domain.NodeBlocked && err != domain.ErrTaskBlocked || terminal.CurrentNode.Terminal() && err != domain.ErrTaskTerminal || memory.writes != before {
			t.Fatalf("node=%s error=%v writes=%d", terminal.CurrentNode, err, memory.writes-before)
		}
	}
}

func assertExpectedInvalidation(t *testing.T, task domain.ProcessTask, expected []string) {
	t.Helper()
	for _, authority := range expected {
		present := false
		switch authority {
		case "design":
			present = task.Design != nil
		case "task_plan":
			present = task.TaskPlan != nil
		case "implementation":
			present = task.Implementation != nil
		case "test":
			present = task.Test != nil
		case "comprehension":
			present = task.Comprehension != nil
		}
		if present {
			t.Fatalf("expected %s invalidation for node %s", authority, task.CurrentNode)
		}
	}
}

func standardTransitionCases() []standardTransitionCase {
	r := func(i int, source domain.NodeID, id, destination, guard string, reason bool, valid, invalid string, clears ...string) standardTransitionCase {
		return standardTransitionCase{i, source, domain.TransitionID(id), domain.NodeID(destination), domain.TransitionGuardID(guard), reason, valid, invalid, clears}
	}
	return []standardTransitionCase{
		r(1, domain.NodeRequirements, "requirements_ready", "DESIGN", "requirements_baseline_complete", false, "complete baseline", "unresolved question", "design", "task_plan", "implementation", "test", "comprehension"),
		r(2, domain.NodeDesign, "design_ready", "TASKS", "design_baseline_complete", false, "current requirements revision", "missing baseline", "task_plan", "implementation", "test", "comprehension"),
		r(3, domain.NodeDesign, "design_requires_requirements", "REQUIREMENTS", "material_requirement_gap", true, "requirement finding", "empty findings", "design", "task_plan", "implementation", "test", "comprehension"),
		r(4, domain.NodeTasks, "tasks_ready", "IMPLEMENT", "task_plan_baseline_complete", false, "covered acceptance", "missing baseline", "implementation", "test", "comprehension"),
		r(5, domain.NodeTasks, "tasks_require_design", "DESIGN", "design_not_decomposable", true, "design finding", "empty findings", "task_plan", "implementation", "test", "comprehension"),
		r(6, domain.NodeTasks, "tasks_require_requirements", "REQUIREMENTS", "material_requirement_gap", true, "requirement finding", "empty findings", "design", "task_plan", "implementation", "test", "comprehension"),
		r(7, domain.NodeImplement, "implementation_ready_for_test", "TEST", "implementation_report_complete", false, "current plan and exact binding", "unexpected finding", "test", "comprehension"),
		r(8, domain.NodeImplement, "implementation_requires_design", "DESIGN", "implementation_exposes_design_gap", true, "design finding", "empty findings", "task_plan", "implementation", "test", "comprehension"),
		r(9, domain.NodeImplement, "implementation_requires_requirements", "REQUIREMENTS", "material_requirement_gap", true, "requirement finding", "empty findings", "design", "task_plan", "implementation", "test", "comprehension"),
		r(10, domain.NodeImplement, "implementation_needs_refactor", "REFACTOR", "implementation_complexity_identified", true, "complexity finding", "empty findings", "test", "comprehension"),
		r(11, domain.NodeTest, "tests_passed", "COMPREHENSION_REVIEW", "current_tests_pass", false, "passing current check", "failed check", "comprehension"),
		r(12, domain.NodeTest, "tests_failed_implementation", "IMPLEMENT", "implementation_failure_identified", true, "failed implementation check", "no failure facts", "test", "comprehension"),
		r(13, domain.NodeTest, "tests_expose_design_issue", "DESIGN", "test_design_failure_identified", true, "design failure", "no failure facts", "task_plan", "implementation", "test", "comprehension"),
		r(14, domain.NodeTest, "tests_expose_requirement_issue", "REQUIREMENTS", "test_requirement_gap_identified", true, "requirement failure", "no failure facts", "design", "task_plan", "implementation", "test", "comprehension"),
		r(15, domain.NodeComprehensionReview, "comprehension_passed", "DELIVERY", "current_user_comprehension_confirmed", false, "user passed", "missing user confirmation"),
		r(16, domain.NodeComprehensionReview, "implementation_defect", "IMPLEMENT", "implementation_defect_identified", true, "implementation finding", "empty findings", "test", "comprehension"),
		r(17, domain.NodeComprehensionReview, "code_too_complex", "REFACTOR", "code_complexity_identified", true, "unnecessary abstraction", "no complexity facts", "test", "comprehension"),
		r(18, domain.NodeComprehensionReview, "design_too_complex", "DESIGN", "design_complexity_identified", true, "unnecessary abstraction", "no complexity facts", "task_plan", "implementation", "test", "comprehension"),
		r(19, domain.NodeComprehensionReview, "evidence_insufficient", "TEST", "verification_gap_identified", true, "unresolved verification question", "no verification facts", "test", "comprehension"),
		r(20, domain.NodeComprehensionReview, "requirement_unclear", "REQUIREMENTS", "comprehension_requirement_gap_identified", true, "unresolved requirement", "no requirement facts", "design", "task_plan", "implementation", "test", "comprehension"),
		r(21, domain.NodeRefactor, "refactor_ready_for_test", "TEST", "refactor_report_complete", false, "simplification without behavior change", "missing simplification", "test", "comprehension"),
		r(22, domain.NodeRefactor, "refactor_requires_design", "DESIGN", "refactor_design_change_required", true, "design finding", "empty findings", "task_plan", "implementation", "test", "comprehension"),
		r(23, domain.NodeRefactor, "refactor_requires_requirements", "REQUIREMENTS", "refactor_requirement_change_required", true, "requirement finding", "empty findings", "design", "task_plan", "implementation", "test", "comprehension"),
		r(24, domain.NodeDelivery, "delivery_complete", "DONE", "delivery_current_and_complete", false, "current records and evidence", "unverified item"),
		r(25, domain.NodeDelivery, "delivery_needs_implementation", "IMPLEMENT", "delivery_implementation_gap_identified", true, "implementation finding", "empty findings", "test", "comprehension"),
		r(26, domain.NodeDelivery, "delivery_needs_test", "TEST", "delivery_test_gap_identified", true, "test finding", "empty findings", "test", "comprehension"),
		r(27, domain.NodeDelivery, "delivery_needs_comprehension", "COMPREHENSION_REVIEW", "delivery_comprehension_gap_identified", true, "comprehension finding", "empty findings", "comprehension"),
		r(28, domain.NodeDelivery, "delivery_needs_design", "DESIGN", "delivery_design_gap_identified", true, "design finding", "empty findings", "task_plan", "implementation", "test", "comprehension"),
		r(29, domain.NodeDelivery, "delivery_needs_requirements", "REQUIREMENTS", "delivery_requirement_gap_identified", true, "requirement finding", "empty findings", "design", "task_plan", "implementation", "test", "comprehension"),
	}
}

func standardProcessFixture(t *testing.T) (*application.Service, *standardProcessStore, map[domain.NodeID]domain.ProcessTask) {
	t.Helper()
	now := time.Date(2026, 8, 19, 12, 0, 0, 0, time.UTC)
	digest := domain.Digest(strings.Repeat("a", 64))
	branch, head := "main", strings.Repeat("b", 40)
	binding := domain.RepositoryBinding{CanonicalRoot: "/repo", GitCommonDirDigest: digest, RepositoryIdentity: digest, Branch: &branch, Head: &head, WorktreeFingerprint: digest, ObservedAt: now, BindingDigest: digest}
	memory := &standardProcessStore{}
	service, err := application.NewService(memory, standardProcessObserver{binding})
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.OpenTask(context.Background(), application.OpenTaskRequest{RequestID: "open-standard", Host: domain.HostCodex, RepositoryPath: "/repo", NewTask: &application.NewTaskInput{Request: "Prove the process.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 16, AllowManualHandoff: true}, MethodProfile: domain.MethodPlain}})
	if err != nil {
		t.Fatal(err)
	}
	snapshots := map[domain.NodeID]domain.ProcessTask{domain.NodeRequirements: opened.Task}
	task := mustApplyStandard(t, service, opened.Task, "requirements_ready", "", validNodeResult(opened.Task, "requirements_ready"))
	snapshots[domain.NodeDesign] = task
	task = mustApplyStandard(t, service, task, "design_ready", "", validNodeResult(task, "design_ready"))
	snapshots[domain.NodeTasks] = task
	task = mustApplyStandard(t, service, task, "tasks_ready", "", validNodeResult(task, "tasks_ready"))
	snapshots[domain.NodeImplement] = task
	task = mustApplyStandard(t, service, task, "implementation_ready_for_test", "", validNodeResult(task, "implementation_ready_for_test"))
	snapshots[domain.NodeTest] = task
	task = mustApplyStandard(t, service, task, "tests_passed", "", validNodeResult(task, "tests_passed"))
	snapshots[domain.NodeComprehensionReview] = task
	refactor := mustApplyStandard(t, service, task, "code_too_complex", "Complexity requires simplification.", validNodeResult(task, "code_too_complex"))
	snapshots[domain.NodeRefactor] = refactor
	memory.task = task
	task = mustApplyStandard(t, service, task, "comprehension_passed", "", validNodeResult(task, "comprehension_passed"))
	snapshots[domain.NodeDelivery] = task
	return service, memory, snapshots
}

func processNode(t *testing.T, definition domain.ProcessDefinition, id domain.NodeID) domain.NodeDefinition {
	t.Helper()
	for _, node := range definition.Nodes {
		if node.NodeID == id {
			return node
		}
	}
	t.Fatalf("missing node %s", id)
	return domain.NodeDefinition{}
}

func reasonFor(tc standardTransitionCase) string {
	if tc.reasonRequired {
		return "The current authority requires bounded remediation."
	}
	return ""
}

func standardPayload(t *testing.T, transition domain.TransitionID, reason string, node any) json.RawMessage {
	t.Helper()
	raw, err := json.Marshal(map[string]any{"transition_id": transition, "summary": "The node result is recorded.", "reason": reason, "artifacts": []any{}, "method_evidence": []any{}, "node_result": node})
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func applyStandard(t *testing.T, service *application.Service, task domain.ProcessTask, transition domain.TransitionID, reason string, node any) (domain.ProcessTask, error) {
	t.Helper()
	a := task.CurrentAction
	result, err := service.ApplyAction(context.Background(), application.ApplyActionRequest{RequestID: domain.ID(fmt.Sprintf("request-%s-%d", transition, task.Revision)), Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision, ActionID: a.ActionID, ActionKind: a.Kind, ProcessID: task.Process.ID, ProcessVersion: task.Process.Version, ProcessDefinitionDigest: task.Process.DefinitionDigest, SourceCursor: task.CurrentNode, RepositoryBindingDigest: task.Repository.BindingDigest, Payload: standardPayload(t, transition, reason, node)})
	return result.Task, err
}

func mustApplyStandard(t *testing.T, service *application.Service, task domain.ProcessTask, transition domain.TransitionID, reason string, node any) domain.ProcessTask {
	t.Helper()
	result, err := applyStandard(t, service, task, transition, reason, node)
	if err != nil {
		t.Fatalf("apply %s: %v", transition, err)
	}
	return result
}

func validNodeResult(task domain.ProcessTask, transition domain.TransitionID) any {
	switch task.CurrentNode {
	case domain.NodeRequirements:
		return map[string]any{"baseline": map[string]any{"goal": "Prove the process.", "scope": []string{"process"}, "out_of_scope": []string{}, "acceptance_criteria": []string{"the process is proven"}, "constraints": []string{}, "assumptions": []string{}}, "unresolved_questions": []string{}}
	case domain.NodeDesign:
		if transition != "design_ready" {
			return map[string]any{"baseline": nil, "findings": []string{"A material requirement gap exists."}}
		}
		return map[string]any{"baseline": map[string]any{"requirements_revision": task.Requirements.Revision, "approach": "Use the direct process.", "components": []string{"process"}, "decisions": []string{"Keep one definition."}, "rejected_alternatives": []string{}, "complexity_justification": []string{}, "risks": []string{}}, "findings": []string{}}
	case domain.NodeTasks:
		if transition != "tasks_ready" {
			return map[string]any{"baseline": nil, "findings": []string{"Upstream correction is required."}}
		}
		return map[string]any{"baseline": map[string]any{"design_revision": task.Design.Revision, "work_items": []map[string]any{{"work_item_id": "work", "summary": "Implement the process.", "expected_paths": []string{"internal/process.go"}, "acceptance_indexes": []uint32{0}, "verification_steps": []string{"Run the process test."}, "dependencies": []string{}}}}, "findings": []string{}}
	case domain.NodeImplement:
		findings := []string{}
		if transition != "implementation_ready_for_test" {
			findings = []string{"The selected problem class is present."}
		}
		return map[string]any{"task_plan_revision": task.TaskPlan.Revision, "completed_work_item_ids": []string{"work"}, "changed_paths": []string{}, "no_file_changes": true, "deviations": []string{}, "findings": findings}
	case domain.NodeTest:
		if transition == "tests_passed" {
			return map[string]any{"checks": []map[string]any{{"source": "automated", "name": "targeted-process-test", "status": "passed", "summary": "The process passed.", "command_count": 1, "full_suite": false}}, "failed_items": []string{}, "unverified_items": []string{}, "manual_handoff_items": []string{}, "findings": []string{}}
		}
		return map[string]any{"checks": []map[string]any{{"source": "automated", "name": "targeted-process-test", "status": "failed", "summary": "The classified failure occurred.", "command_count": 1, "full_suite": false}}, "failed_items": []string{"classified failure"}, "unverified_items": []string{}, "manual_handoff_items": []string{}, "findings": []string{"The selected problem class is present."}}
	case domain.NodeComprehensionReview:
		if transition == "comprehension_passed" {
			return map[string]any{"explained_components": []string{"process"}, "unresolved_questions": []string{}, "unnecessary_abstractions": []string{}, "maintenance_risks": []string{}, "user_confirmation": map[string]any{"source": "user", "status": "passed", "summary": "The developer confirmed understanding."}, "findings": []string{}}
		}
		result := map[string]any{"explained_components": []string{}, "unresolved_questions": []string{}, "unnecessary_abstractions": []string{}, "maintenance_risks": []string{}, "user_confirmation": nil, "findings": []string{}}
		switch transition {
		case "code_too_complex", "design_too_complex":
			result["unnecessary_abstractions"] = []string{"unnecessary layer"}
		case "evidence_insufficient", "requirement_unclear":
			result["unresolved_questions"] = []string{"current question"}
		default:
			result["findings"] = []string{"implementation defect"}
		}
		return result
	case domain.NodeRefactor:
		if transition == "refactor_ready_for_test" {
			return map[string]any{"changed_paths": []string{}, "no_file_changes": true, "simplifications": []string{"Removed one layer."}, "behavior_change_intended": false, "findings": []string{}}
		}
		return map[string]any{"changed_paths": []string{}, "no_file_changes": true, "simplifications": []string{}, "behavior_change_intended": true, "findings": []string{"Upstream correction is required."}}
	case domain.NodeDelivery:
		if transition == "delivery_complete" {
			return map[string]any{"acceptance": []map[string]any{{"criterion": task.Requirements.AcceptanceCriteria[0], "status": "satisfied"}}, "automated_evidence_ids": []string{string(task.Test.EvidenceIDs[0])}, "manual_evidence_ids": []string{string(task.Comprehension.UserEvidenceID)}, "test_record_id": task.Test.RecordID, "comprehension_record_id": task.Comprehension.RecordID, "unverified_items": []string{}, "risks": []string{}, "findings": []string{}}
		}
		return map[string]any{"acceptance": []any{}, "automated_evidence_ids": []string{}, "manual_evidence_ids": []string{}, "test_record_id": "", "comprehension_record_id": "", "unverified_items": []string{}, "risks": []string{}, "findings": []string{"Delivery remediation is required."}}
	}
	return map[string]any{}
}

func invalidNodeResult(task domain.ProcessTask, transition domain.TransitionID) any {
	result := validNodeResult(task, transition)
	m, ok := result.(map[string]any)
	if !ok {
		return result
	}
	switch task.CurrentNode {
	case domain.NodeRequirements:
		m["unresolved_questions"] = []string{"material question"}
	case domain.NodeDesign, domain.NodeTasks:
		if strings.HasSuffix(string(transition), "ready") {
			m["baseline"] = nil
		} else {
			m["findings"] = []string{}
		}
	case domain.NodeImplement:
		if transition == "implementation_ready_for_test" {
			m["findings"] = []string{"unexpected finding"}
		} else {
			m["findings"] = []string{}
		}
	case domain.NodeTest:
		if transition == "tests_passed" {
			m["failed_items"] = []string{"failed"}
		} else {
			m["checks"], m["failed_items"], m["findings"] = []any{}, []string{}, []string{}
		}
	case domain.NodeComprehensionReview:
		m["user_confirmation"], m["unresolved_questions"], m["unnecessary_abstractions"], m["maintenance_risks"], m["findings"] = nil, []string{}, []string{}, []string{}, []string{}
	case domain.NodeRefactor:
		m["simplifications"], m["findings"] = []string{}, []string{}
	case domain.NodeDelivery:
		if transition == "delivery_complete" {
			m["unverified_items"] = []string{"remaining"}
		} else {
			m["findings"] = []string{}
		}
	}
	return m
}

func cancelledTask(source domain.ProcessTask) domain.ProcessTask {
	now := source.UpdatedAt
	source.CurrentNode, source.CurrentAction = domain.NodeCancelled, nil
	source.Outcome = &domain.ProcessOutcome{Status: domain.TerminalCancelled, Summary: "The task was cancelled.", FinalRepositoryDigest: source.Repository.BindingDigest, CompletedAt: now}
	source.CompletedAt = &now
	return source
}

func blockedTask(t *testing.T, source domain.ProcessTask) domain.ProcessTask {
	t.Helper()
	resume := source.CurrentNode
	source.CurrentNode = domain.NodeBlocked
	source.ResumeNode = &resume
	source.Blocker = &domain.ProcessBlocker{BlockerID: "blocker", ResumeNode: resume, Message: "Restore the repository binding."}
	action, err := workflow.BuildProcessAction(workflow.StandardProcess(), domain.NodeBlocked, source.TaskID, source.Revision, source.Repository.BindingDigest, source.Intent.MethodProfile, "blocked-action", source.UpdatedAt)
	if err != nil {
		t.Fatal(err)
	}
	source.CurrentAction = &action
	return source
}
