package application

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

// submitNodeResult submits one node result through the submission path and
// returns the committed task, or the failure. It mirrors the Host payload
// assembly, including the problem class the transition reports.
func submitNodeResult(t *testing.T, s *Service, task domain.ProcessTask, requestID domain.ID, transition string, nodeResult map[string]any) (domain.ProcessTask, error) {
	t.Helper()
	methods := map[domain.MethodStepID]MethodResultSubmission{}
	for _, step := range task.CurrentAction.SemanticMethodSteps {
		methods[step.StepID] = MethodResultSubmission{Capability: "", Summary: "Completed the current semantic method step."}
	}
	nodeResult["problem_class"] = phase5ProblemClass(transition)
	raw, err := json.Marshal(nodeResult)
	if err != nil {
		t.Fatal(err)
	}
	result, err := s.SubmitAction(context.Background(), SubmitActionRequest{
		RequestID: requestID, Host: domain.HostCodex, TaskID: task.TaskID, ActionID: task.CurrentAction.ActionID,
		ExpectedActionKind: task.CurrentAction.Kind, TransitionID: domain.TransitionID(transition),
		Summary: "Result recorded.", Reason: "", MethodResults: methods, NodeResult: raw,
	})
	if err != nil {
		return domain.ProcessTask{}, err
	}
	return result.Task, nil
}

func designResultWithoutRevision(approach string) map[string]any {
	result := designNodeResult(1, approach)
	delete(result["baseline"].(map[string]any), "requirements_revision")
	return result
}

func tasksResultWithoutRevision(items []map[string]any) map[string]any {
	result := tasksNodeResult(1, items)
	delete(result["baseline"].(map[string]any), "design_revision")
	return result
}

func implementationResultWithoutRevision(completed []string, noChanges bool, findings []string) map[string]any {
	result := implementationNodeResult(1, completed, noChanges, findings)
	delete(result, "task_plan_revision")
	return result
}

// TestSubmitDesignFillsRequirementsRevisionFromCurrentTask proves a Design
// submission that omits requirements_revision commits with the revision of the
// same Task snapshot that answered the submission.
func TestSubmitDesignFillsRequirementsRevisionFromCurrentTask(t *testing.T) {
	service, _, _ := phase5Service(t)
	task := openPhase5Task(t, service)
	task = applyPhase5(t, service, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"criterion"}))
	next, err := submitNodeResult(t, service, task, "submit-design-no-revision", "design_ready", designResultWithoutRevision("Direct design"))
	if err != nil {
		t.Fatalf("the Design submission without requirements_revision was refused: %v", err)
	}
	if next.Design == nil || next.Design.RequirementsRevision != task.Requirements.Revision {
		t.Fatalf("design record=%#v want requirements revision %d", next.Design, task.Requirements.Revision)
	}
}

// TestSubmitTasksFillsDesignRevisionFromCurrentTask proves a Tasks submission
// that omits design_revision commits with the current Design revision.
func TestSubmitTasksFillsDesignRevisionFromCurrentTask(t *testing.T) {
	service, _, _ := phase5Service(t)
	task := openPhase5Task(t, service)
	task = applyPhase5(t, service, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"criterion"}))
	task = applyPhase5(t, service, task, "design_ready", "", designNodeResult(1, "Direct design"))
	next, err := submitNodeResult(t, service, task, "submit-tasks-no-revision", "tasks_ready", tasksResultWithoutRevision([]map[string]any{workItem("work-a", []uint32{0}, nil)}))
	if err != nil {
		t.Fatalf("the Tasks submission without design_revision was refused: %v", err)
	}
	if next.TaskPlan == nil || next.TaskPlan.DesignRevision != task.Design.Revision {
		t.Fatalf("task plan record=%#v want design revision %d", next.TaskPlan, task.Design.Revision)
	}
}

// TestSubmitImplementationFillsTaskPlanRevisionFromCurrentTask proves an
// Implementation submission that omits task_plan_revision commits with the
// current TaskPlan revision.
func TestSubmitImplementationFillsTaskPlanRevisionFromCurrentTask(t *testing.T) {
	service, _, _ := phase5Service(t)
	task := phase5TaskAtImplement(t, service)
	next, err := submitNodeResult(t, service, task, "submit-implementation-no-revision", "implementation_ready_for_test", implementationResultWithoutRevision([]string{"work-a"}, true, nil))
	if err != nil {
		t.Fatalf("the Implementation submission without task_plan_revision was refused: %v", err)
	}
	if next.Implementation == nil || next.Implementation.TaskPlanRevision != task.TaskPlan.Revision {
		t.Fatalf("implementation record=%#v want task plan revision %d", next.Implementation, task.TaskPlan.Revision)
	}
}

// TestSubmitLegacyRevisionValuesStillAcceptedAndRefused proves the older-client
// path: the exact current value is accepted, and a different value is refused
// with the exact member before any write.
func TestSubmitLegacyRevisionValuesStillAcceptedAndRefused(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := openPhase5Task(t, service)
	task = applyPhase5(t, service, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"criterion"}))

	// A different value is a zero-write refusal with the exact member.
	before := memory.commits
	_, err := submitNodeResult(t, service, task, "submit-design-stale-revision", "design_ready", designNodeResult(task.Requirements.Revision+1, "Direct design"))
	typed := structuredFailure(t, err)
	if len(typed.Violations) != 1 || typed.Violations[0].Path != "payload.node_result.baseline.requirements_revision" || typed.Violations[0].Rule != domain.RuleCurrentValueRequired {
		t.Fatalf("violations=%#v", typed.Violations)
	}
	if !typed.ZeroWrite || memory.commits != before {
		t.Fatalf("zero write=%v commits=%d want=%d", typed.ZeroWrite, memory.commits, before)
	}
	current, loadErr := memory.LoadTask(context.Background(), task.TaskID)
	if loadErr != nil || current.Revision != task.Revision {
		t.Fatalf("a refused submission moved the Task: revision=%d want=%d err=%v", current.Revision, task.Revision, loadErr)
	}

	// The exact current value is still accepted.
	next, err := submitNodeResult(t, service, task, "submit-design-current-revision", "design_ready", designNodeResult(task.Requirements.Revision, "Direct design"))
	if err != nil {
		t.Fatalf("the current value was refused: %v", err)
	}
	if next.Design.RequirementsRevision != task.Requirements.Revision {
		t.Fatalf("design requirements revision=%d want=%d", next.Design.RequirementsRevision, task.Requirements.Revision)
	}
}

// TestSubmitStaleActionRefusedBeforeHydration proves a stale Action identity is
// refused before the system-state members are filled, so a stale result can
// never be bound to the current Task snapshot.
func TestSubmitStaleActionRefusedBeforeHydration(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := openPhase5Task(t, service)
	task = applyPhase5(t, service, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"criterion"}))
	before := memory.commits
	methods := map[domain.MethodStepID]MethodResultSubmission{}
	for _, step := range task.CurrentAction.SemanticMethodSteps {
		methods[step.StepID] = MethodResultSubmission{Capability: "", Summary: "Completed the current semantic method step."}
	}
	raw, marshalErr := json.Marshal(designResultWithoutRevision("Direct design"))
	if marshalErr != nil {
		t.Fatal(marshalErr)
	}
	_, err := service.SubmitAction(context.Background(), SubmitActionRequest{
		RequestID: "submit-design-stale-id", Host: domain.HostCodex, TaskID: task.TaskID, ActionID: domain.ID("action-stale"),
		ExpectedActionKind: task.CurrentAction.Kind, TransitionID: "design_ready",
		Summary: "Result recorded.", MethodResults: methods, NodeResult: raw,
	})
	if !errors.Is(err, domain.ErrActionStale) {
		t.Fatalf("error=%v want ACTION_STALE before hydration", err)
	}
	if memory.commits != before {
		t.Fatalf("commits=%d want=%d", memory.commits, before)
	}
}

// TestSubmitOmittedRevisionKeepsDuplicateMemberRejection proves hydration does
// not normalize an ambiguous submission into a valid canonical payload. The
// duplicate member is rejected before map decoding, and no operation is staged.
func TestSubmitOmittedRevisionKeepsDuplicateMemberRejection(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := openPhase5Task(t, service)
	task = applyPhase5(t, service, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"criterion"}))
	methods := map[domain.MethodStepID]MethodResultSubmission{}
	for _, step := range task.CurrentAction.SemanticMethodSteps {
		methods[step.StepID] = MethodResultSubmission{Capability: "", Summary: "Completed the current semantic method step."}
	}
	raw := json.RawMessage(`{
		"problem_class":"none",
		"baseline":{
			"approach":"Direct design",
			"approach":"Ambiguous design",
			"components":[],
			"decisions":[],
			"rejected_alternatives":[],
			"complexity_justification":[],
			"risks":[]
		},
		"findings":[],
		"changed_paths":[],
		"no_file_changes":true
	}`)
	beforeCommits, beforeStages := memory.commits, memory.stages
	_, err := service.SubmitAction(context.Background(), SubmitActionRequest{
		RequestID: "submit-design-duplicate-member", Host: domain.HostCodex, TaskID: task.TaskID,
		ActionID: task.CurrentAction.ActionID, ExpectedActionKind: task.CurrentAction.Kind, TransitionID: "design_ready",
		Summary: "Result recorded.", MethodResults: methods, NodeResult: raw,
	})
	if !errors.Is(err, domain.ErrInvalidArgument) {
		t.Fatalf("error=%v want INVALID_ARGUMENT", err)
	}
	if memory.commits != beforeCommits || memory.stages != beforeStages {
		t.Fatalf("duplicate submission wrote state: commits=%d/%d stages=%d/%d", memory.commits, beforeCommits, memory.stages, beforeStages)
	}
	if _, found, loadErr := memory.LoadActionOperation(context.Background(), task.TaskID); loadErr != nil || found {
		t.Fatalf("duplicate submission left an Action operation: found=%v err=%v", found, loadErr)
	}
}

// TestSubmitStructuralFailureIsZeroWriteThenCorrectableOnce proves a first
// structural refusal changes no Task, Event, Evidence or operation state, and
// the same Action commits after the listed member is corrected.
func TestSubmitStructuralFailureIsZeroWriteThenCorrectableOnce(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := openPhase5Task(t, service)
	task = applyPhase5(t, service, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"criterion"}))
	beforeCommits, beforeStages := memory.commits, memory.stages
	missingApproach := designResultWithoutRevision("Direct design")
	delete(missingApproach["baseline"].(map[string]any), "approach")
	_, err := submitNodeResult(t, service, task, "submit-design-missing-approach", "design_ready", missingApproach)
	typed := structuredFailure(t, err)
	if len(typed.Violations) != 1 || typed.Violations[0].Path != "payload.node_result.baseline.approach" || typed.Violations[0].Rule != domain.RuleRequiredMemberMissing {
		t.Fatalf("violations=%#v", typed.Violations)
	}
	if !typed.ZeroWrite || memory.commits != beforeCommits || memory.stages != beforeStages {
		t.Fatalf("zero write=%v commits=%d/%d stages=%d/%d", typed.ZeroWrite, memory.commits, beforeCommits, memory.stages, beforeStages)
	}
	if _, found, operationErr := memory.LoadActionOperation(context.Background(), task.TaskID); operationErr != nil || found {
		t.Fatalf("a refused submission left an Action operation: found=%v err=%v", found, operationErr)
	}
	current, loadErr := memory.LoadTask(context.Background(), task.TaskID)
	if loadErr != nil || current.Revision != task.Revision || *current.LastOperation != *task.LastOperation || len(current.Evidence) != len(task.Evidence) {
		t.Fatalf("a refused submission changed Task state: revision=%d last operation=%#v evidence=%d",
			current.Revision, current.LastOperation, len(current.Evidence))
	}
	next, err := submitNodeResult(t, service, task, "submit-design-corrected", "design_ready", designResultWithoutRevision("Direct design"))
	if err != nil {
		t.Fatalf("the corrected submission of the same Action was refused: %v", err)
	}
	if next.CurrentNode != domain.NodeTasks {
		t.Fatalf("current node=%s", next.CurrentNode)
	}
}
