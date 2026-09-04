package application

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type phase5DNoIOStore struct {
	loads   int
	commits int
}

func (s *phase5DNoIOStore) LoadTask(context.Context, domain.ID) (domain.ProcessTask, error) {
	s.loads++
	return domain.ProcessTask{}, store.ErrTaskNotFound
}
func (s *phase5DNoIOStore) LoadActiveTask(context.Context, domain.Digest) (domain.ProcessTask, error) {
	s.loads++
	return domain.ProcessTask{}, store.ErrTaskNotFound
}
func (s *phase5DNoIOStore) CommitTask(context.Context, store.TaskMutation) error {
	s.commits++
	return nil
}

type phase5DNoIOObserver struct{ calls int }

func (o *phase5DNoIOObserver) Observe(context.Context, string) (domain.RepositoryBinding, error) {
	o.calls++
	return domain.RepositoryBinding{}, domain.ErrInternal
}

func TestMalformedGraphRecoveryInputStopsBeforeObservationWrite(t *testing.T) {
	storage := &phase5DNoIOStore{}
	observer := &phase5DNoIOObserver{}
	service, err := newService(storage, observer, time.Now, func(prefix string) (domain.ID, error) { return domain.ID(prefix + "-id"), nil })
	if err != nil {
		t.Fatal(err)
	}
	process := workflow.StandardProcess().Reference
	badProbe := &OperationProbe{OperationID: "original-operation", ProcessID: process.ID, ProcessDefinitionDigest: process.DefinitionDigest, SourceCursor: domain.NodeRequirements, ExpectedRevision: 1, ActionID: "action", ActionKind: domain.ActionCompleteRequirements, RepositoryBindingDigest: digestOf("a")}
	if _, err := service.GetTask(context.Background(), GetTaskRequest{Host: domain.HostCodex, TaskID: "task", OperationProbe: badProbe}); err != domain.ErrInvalidArgument {
		t.Fatalf("malformed probe error=%v", err)
	}
	request := ApplyActionRequest{RequestID: "original-operation", Host: domain.HostCodex, TaskID: "task", ExpectedRevision: 1, ActionID: "action", ActionKind: domain.ActionCompleteRequirements, ProcessID: process.ID, ProcessDefinitionDigest: process.DefinitionDigest, SourceCursor: domain.NodeRequirements, RepositoryBindingDigest: digestOf("a"), Payload: json.RawMessage("null"), RecoveryApply: &RecoveryApplyInput{SourceCursor: domain.NodeRequirements}}
	if _, err := service.ApplyAction(context.Background(), request); err != domain.ErrInvalidArgument {
		t.Fatalf("malformed recovery apply error=%v", err)
	}
	if storage.loads != 0 || storage.commits != 0 || observer.calls != 0 {
		t.Fatal("malformed recovery input reached I/O")
	}
}

func TestManualHandoffBudgetDoesNotBlockComprehensionConfirmation(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := openPhase5Task(t, service)
	task = applyPhase5(t, service, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"criterion"}))
	task = applyPhase5(t, service, task, "design_ready", "", designNodeResult(1, "Design"))
	task = applyPhase5(t, service, task, "tasks_ready", "", tasksNodeResult(1, []map[string]any{workItem("work-a", []uint32{0}, nil)}))
	task.TaskPlan.VerificationPlan.InitialBudget.AllowManualHandoff = false
	memory.task = &task
	task = applyPhase5(t, service, task, "implementation_ready_for_test", "", implementationNodeResult(1, []string{"work-a"}, true, nil))

	before := memory.commits
	assertApplyFails(t, service, task, "tests_passed", "", testNodeResult([]map[string]any{evidenceCheck("user", "passed", "manual-test", 0, false)}, nil, nil, nil), domain.ErrVerificationBudgetExceeded)
	if memory.commits != before {
		t.Fatal("forbidden TEST user evidence wrote state")
	}
	task = applyPhase5(t, service, task, "tests_passed", "", testNodeResult([]map[string]any{evidenceCheck("automated", "passed", "targeted", 1, false)}, nil, nil, nil))
	task = applyPhase5(t, service, task, "comprehension_passed", "", comprehensionNodeResult([]string{"component"}, nil, nil, "user", "passed", nil))
	task = applyPhase5(t, service, task, "delivery_complete", "", deliveryCompleteNodeResult(task))
	if task.CurrentNode != domain.NodeDone || task.Outcome == nil {
		t.Fatal("comprehension confirmation was blocked by TEST manual-handoff budget")
	}
}

func TestUserEvidenceAfterExhaustedAutomaticBudgetReachesComprehension(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := phase5TaskAtTest(t, service)
	task.TaskPlan.VerificationPlan.InitialBudget.MaxAutomaticCommands = 4
	task.TaskPlan.VerificationPlan.InitialBudget.AllowManualHandoff = true
	memory.task = &task
	checks := []map[string]any{
		evidenceCheck("automated", "passed", "automatic-budget", 4, false),
		evidenceCheck("user", "passed", "developer-manager-v1", 0, false),
	}
	passed := applyPhase5(t, service, task, "tests_passed", "", testNodeResult(checks, nil, nil, nil))
	if passed.CurrentNode != domain.NodeComprehensionReview || passed.Test == nil {
		t.Fatal("user evidence after exhausted automatic budget did not pass TEST")
	}
	if passed.TaskID == "task-9eebc6f870a76062558f54b649d120f6" || len(passed.Evidence) != 2 {
		t.Fatal("corrective journey reused the cancelled task or lost evidence")
	}
	if passed.Evidence[0].Source != domain.EvidenceSourceAutomated || passed.Evidence[0].CommandCount != 4 ||
		passed.Evidence[1].Source != domain.EvidenceSourceUser || passed.Evidence[1].CommandCount != 0 {
		t.Fatalf("evidence=%#v", passed.Evidence)
	}

	service, memory, _ = phase5Service(t)
	task = phase5TaskAtTest(t, service)
	task.TaskPlan.VerificationPlan.InitialBudget.MaxAutomaticCommands = 4
	task.TaskPlan.VerificationPlan.InitialBudget.AllowManualHandoff = true
	memory.task = &task
	before := memory.commits
	invalid := []map[string]any{
		evidenceCheck("automated", "passed", "automatic-budget", 4, false),
		evidenceCheck("user", "passed", "developer-manager-v1", 1, false),
	}
	assertApplyFails(t, service, task, "tests_passed", "", testNodeResult(invalid, nil, nil, nil), domain.ErrInvalidArgument)
	if memory.commits != before {
		t.Fatal("invalid user evidence wrote Task state")
	}
}

func TestProblemClassMismatchIsTransitionNotAllowedAndZeroWrite(t *testing.T) {
	tests := []struct {
		name       string
		prepare    func(*testing.T, *Service) domain.ProcessTask
		transition domain.TransitionID
		result     map[string]any
	}{
		{
			name: "implementation failure cannot choose design issue", prepare: phase5TaskAtTest,
			transition: "tests_expose_design_issue",
			result:     map[string]any{"problem_class": "implementation_failure", "checks": []map[string]any{evidenceCheck("automated", "failed", "test", 1, false)}, "failed_items": []string{"failure"}, "unverified_items": []string{}, "manual_handoff_items": []string{}, "findings": []string{"Implementation failure"}, "budget_adjustment": nil},
		},
		{
			name: "code complexity cannot choose design complexity", prepare: phase5TaskAtComprehension,
			transition: "design_too_complex",
			result:     map[string]any{"problem_class": "code_complexity", "explained_components": []string{}, "unresolved_questions": []string{}, "unnecessary_abstractions": []string{"factory"}, "maintenance_risks": []string{}, "user_confirmation": nil, "findings": []string{"Code complexity"}},
		},
		{
			name: "delivery test gap cannot choose requirements", prepare: phase5TaskAtDelivery,
			transition: "delivery_needs_requirements",
			result:     map[string]any{"problem_class": "test_gap", "acceptance": []any{}, "automated_evidence_ids": []string{}, "manual_evidence_ids": []string{}, "test_record_id": "", "comprehension_record_id": "", "unverified_items": []string{}, "risks": []string{}, "findings": []string{"Test gap"}},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			service, memory, _ := phase5Service(t)
			task := tc.prepare(t, service)
			raw, err := json.Marshal(map[string]any{"transition_id": tc.transition, "summary": "Mismatch.", "reason": "Remediation is required.", "artifacts": []any{}, "method_evidence": methodEvidenceForCurrentAction(task, domain.MethodStepPlainFallback, ""), "node_result": tc.result})
			if err != nil {
				t.Fatal(err)
			}
			before := memory.commits
			_, err = service.ApplyAction(context.Background(), currentActionApplyRequest(task, "problem-class-mismatch", raw))
			if !errors.Is(err, domain.ErrTransitionNotAllowed) || memory.commits != before {
				t.Fatalf("error=%v writes=%d", err, memory.commits-before)
			}
		})
	}
}

func TestCancelTerminalAndReasonValidationZeroWrite(t *testing.T) {
	if mapped := mapStoreError(store.ErrInvalidArgument); mapped != domain.ErrInvalidArgument {
		t.Fatalf("store invalid argument mapped to %v", mapped)
	}
	service, memory, _ := phase5Service(t)
	task := openPhase5Task(t, service)
	base := CancelTaskRequest{RequestID: "cancel-base", Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision, Reason: "Cancel task."}
	if _, err := service.CancelTask(nil, base); err != domain.ErrInvalidArgument {
		t.Fatalf("nil context error=%v", err)
	}
	for name, mutate := range map[string]func(*CancelTaskRequest){
		"request id": func(r *CancelTaskRequest) { r.RequestID = "" },
		"host":       func(r *CancelTaskRequest) { r.Host = "future" },
		"task id":    func(r *CancelTaskRequest) { r.TaskID = "" },
	} {
		t.Run("identity "+name, func(t *testing.T) {
			request := base
			mutate(&request)
			before := memory.commits
			if _, err := service.CancelTask(context.Background(), request); err != domain.ErrInvalidArgument || memory.commits != before {
				t.Fatalf("error=%v writes=%d", err, memory.commits-before)
			}
		})
	}
	for name, reason := range map[string]string{
		"empty": "", "leading": " reason", "trailing": "reason ",
		"invalid utf8": string([]byte{0xff}), "oversized": strings.Repeat("r", domain.MaxReasonBytes+1),
	} {
		t.Run(name, func(t *testing.T) {
			before := memory.commits
			_, err := service.CancelTask(context.Background(), CancelTaskRequest{RequestID: "cancel-invalid", Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision, Reason: reason})
			if err != domain.ErrInvalidArgument || memory.commits != before {
				t.Fatalf("error=%v writes=%d", err, memory.commits-before)
			}
		})
	}
	if _, err := service.CancelTask(context.Background(), CancelTaskRequest{RequestID: "cancel-stale", Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision + 1, Reason: "Cancel task."}); err != domain.ErrRevisionConflict {
		t.Fatalf("stale cancel error=%v", err)
	}
	result, err := service.CancelTask(context.Background(), CancelTaskRequest{RequestID: "cancel-active", Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision, Reason: "Cancel task."})
	if err != nil || result.Task.CurrentNode != domain.NodeCancelled || memory.lastMutation.Claim != store.ClaimRelease {
		t.Fatalf("active cancel result=%v error=%v", result.Task.CurrentNode, err)
	}
	before := memory.commits
	if _, err := service.CancelTask(context.Background(), CancelTaskRequest{RequestID: "cancel-terminal", Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: result.Task.Revision, Reason: "Cancel again."}); err != domain.ErrTaskTerminal || memory.commits != before {
		t.Fatalf("terminal cancel error=%v writes=%d", err, memory.commits-before)
	}
	doneService, doneMemory, _ := phase5Service(t)
	done := phase5TaskAtDelivery(t, doneService)
	done = applyPhase5(t, doneService, done, "delivery_complete", "", deliveryCompleteNodeResult(done))
	before = doneMemory.commits
	if _, err := doneService.CancelTask(context.Background(), CancelTaskRequest{RequestID: "cancel-done", Host: domain.HostCodex, TaskID: done.TaskID, ExpectedRevision: done.Revision, Reason: "Cancel completed task."}); err != domain.ErrTaskTerminal || doneMemory.commits != before {
		t.Fatalf("DONE cancel error=%v writes=%d", err, doneMemory.commits-before)
	}

	blockedService, _, _ := phase5Service(t)
	blocked := openPhase5Task(t, blockedService)
	prepared, err := blockedService.PrepareTaskRelocation(context.Background(), PrepareTaskRelocationRequest{RequestID: "prepare-cancel-relocation", Host: domain.HostCodex, TaskID: blocked.TaskID, ExpectedRevision: blocked.Revision})
	if err != nil {
		t.Fatal(err)
	}
	blocked = prepared.Task
	blockedResult, err := blockedService.CancelTask(context.Background(), CancelTaskRequest{RequestID: "cancel-blocked", Host: domain.HostCodex, TaskID: blocked.TaskID, ExpectedRevision: blocked.Revision, Reason: "Cancel blocked task."})
	if err != nil || blockedResult.Task.CurrentNode != domain.NodeCancelled || blockedResult.Task.Blocker != nil || blockedResult.Task.ResumeNode != nil {
		t.Fatalf("blocked cancel error=%v task=%#v", err, blockedResult.Task)
	}
}

func TestDeliveryEvidenceRequiresExactCurrentSets(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := phase5TaskAtTest(t, service)
	checks := []map[string]any{
		evidenceCheck("automated", "passed", "automated", 1, false),
		evidenceCheck("user", "passed", "user-test", 0, false),
		evidenceCheck("static", "passed", "static", 0, false),
		evidenceCheck("host_observed", "passed", "host", 0, false),
	}
	task = applyPhase5(t, service, task, "tests_passed", "", testNodeResult(checks, nil, nil, nil))
	task = applyPhase5(t, service, task, "comprehension_passed", "", comprehensionNodeResult([]string{"component"}, nil, nil, "user", "passed", nil))
	exact := func() map[string]any {
		return map[string]any{
			"acceptance":             []map[string]any{{"criterion": task.Requirements.AcceptanceCriteria[0], "status": "satisfied"}},
			"automated_evidence_ids": []string{string(task.Test.EvidenceIDs[0])},
			"manual_evidence_ids":    []string{string(task.Test.EvidenceIDs[1]), string(task.Comprehension.UserEvidenceID)},
			"test_record_id":         task.Test.RecordID, "comprehension_record_id": task.Comprehension.RecordID,
			"unverified_items": []string{}, "risks": []string{}, "findings": []string{},
		}
	}
	tests := map[string]func(map[string]any){
		"empty automated":       func(v map[string]any) { v["automated_evidence_ids"] = []string{} },
		"missing user test":     func(v map[string]any) { v["manual_evidence_ids"] = []string{string(task.Comprehension.UserEvidenceID)} },
		"missing comprehension": func(v map[string]any) { v["manual_evidence_ids"] = []string{string(task.Test.EvidenceIDs[1])} },
		"static in automated":   func(v map[string]any) { v["automated_evidence_ids"] = []string{string(task.Test.EvidenceIDs[2])} },
		"host in manual": func(v map[string]any) {
			v["manual_evidence_ids"] = []string{string(task.Test.EvidenceIDs[3]), string(task.Comprehension.UserEvidenceID)}
		},
		"manual order": func(v map[string]any) {
			v["manual_evidence_ids"] = []string{string(task.Comprehension.UserEvidenceID), string(task.Test.EvidenceIDs[1])}
		},
	}
	for name, mutate := range tests {
		t.Run(name, func(t *testing.T) {
			value := exact()
			mutate(value)
			before := memory.commits
			assertApplyFails(t, service, task, "delivery_complete", "", value, domain.ErrTransitionNotAllowed)
			if memory.commits != before {
				t.Fatal("rejected evidence set wrote state")
			}
		})
	}
	result := applyPhase5(t, service, task, "delivery_complete", "", exact())
	if result.CurrentNode != domain.NodeDone || result.Outcome == nil || len(result.Outcome.AutomatedEvidenceIDs) != 1 || len(result.Outcome.ManualEvidenceIDs) != 2 {
		t.Fatal("exact current evidence set did not complete delivery")
	}
}
