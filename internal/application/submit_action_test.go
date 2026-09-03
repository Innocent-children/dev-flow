package application

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestSubmitActionBuildsAndRetainsCanonicalOperation(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := openPhase5Task(t, service)
	request := requirementsSubmission(t, task, "submit-requirements")
	result, err := service.SubmitAction(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if memory.stages != 1 || memory.commits != 2 {
		t.Fatalf("stages=%d commits=%d", memory.stages, memory.commits)
	}
	if result.Task.CurrentNode != domain.NodeDesign {
		t.Fatalf("task node=%s", result.Task.CurrentNode)
	}
	operation, found, err := memory.LoadActionOperation(context.Background(), task.TaskID)
	if err != nil || !found || operation.AppliedRevision == nil || *operation.AppliedRevision != result.Task.Revision {
		t.Fatalf("operation=%#v found=%v err=%v", operation, found, err)
	}
	commit := &operation.Commit
	if commit.Operation.ActionID != task.CurrentAction.ActionID || commit.Operation.ActionKind != task.CurrentAction.Kind ||
		commit.Operation.ExpectedRevision != task.Revision || commit.Operation.SourceCursor != task.CurrentNode ||
		commit.Operation.RepositoryBindingDigest != task.CurrentAction.RepositoryBindingDigest {
		t.Fatalf("operation=%#v", commit.Operation)
	}
	envelope, _, err := workflow.DecodeStandardPayload(domain.NodeRequirements, commit.Payload)
	if err != nil {
		t.Fatal(err)
	}
	if len(envelope.MethodEvidence) != len(task.CurrentAction.SemanticMethodSteps) {
		t.Fatalf("method evidence=%#v", envelope.MethodEvidence)
	}
	for index, step := range task.CurrentAction.SemanticMethodSteps {
		if envelope.MethodEvidence[index].StepID != step.StepID || envelope.MethodEvidence[index].Status != domain.MethodStepPlainFallback {
			t.Fatalf("method evidence[%d]=%#v", index, envelope.MethodEvidence[index])
		}
	}
	read, err := service.GetTask(context.Background(), GetTaskRequest{Host: domain.HostCodex, TaskID: task.TaskID})
	if err != nil {
		t.Fatal(err)
	}
	if read.RecoveryAssessment == nil || read.RecoveryAssessment.Classification != domain.RecoveryCompletedAndRecorded {
		t.Fatalf("assessment=%#v", read.RecoveryAssessment)
	}
}

func TestRecoverActionUsesCoreRetainedPayload(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := openPhase5Task(t, service)
	memory.commitErr = store.ErrStorageUnavailable
	request := requirementsSubmission(t, task, "submit-uncertain")
	request.Summary = "Use config set <key> <true|false> & recover."
	for stepID, result := range request.MethodResults {
		result.Summary = "Retain <key> & payload bytes for recovery."
		request.MethodResults[stepID] = result
	}
	if _, err := service.SubmitAction(context.Background(), request); !errors.Is(err, domain.ErrStorageUnavailable) {
		t.Fatalf("submit error=%v", err)
	}
	retained, err := memory.LoadTask(context.Background(), task.TaskID)
	operation, found, operationErr := memory.LoadActionOperation(context.Background(), task.TaskID)
	if err != nil || operationErr != nil || !found || operation.AppliedRevision != nil || retained.Revision != task.Revision {
		t.Fatalf("retained operation=%#v found=%v task_revision=%d err=%v operation_err=%v", operation, found, retained.Revision, err, operationErr)
	}
	read, err := service.GetTask(context.Background(), GetTaskRequest{Host: domain.HostCodex, TaskID: task.TaskID})
	if err != nil {
		t.Fatal(err)
	}
	if read.RecoveryAssessment == nil || read.RecoveryAssessment.Classification != domain.RecoveryCompletedButUnrecorded || read.RecoveryAssessment.NextAdvice != recovery.AdviceSubmitRecoveryApply {
		t.Fatalf("assessment=%#v", read.RecoveryAssessment)
	}
	memory.commitErr = nil
	recovered, err := service.RecoverAction(context.Background(), RecoverActionRequest{Host: domain.HostCodex, TaskID: task.TaskID, ActionID: task.CurrentAction.ActionID})
	if err != nil {
		t.Fatal(err)
	}
	if recovered.Task.CurrentNode != domain.NodeDesign || recovered.Task.LastOperation == nil || recovered.Task.LastOperation.OperationID != "submit-uncertain" {
		t.Fatalf("recovered task=%#v", recovered.Task)
	}
}

func TestSubmitActionPersistsCanonicalOperationOutsideTaskSnapshot(t *testing.T) {
	ctx := context.Background()
	databasePath := filepath.Join(t.TempDir(), "dev-flow.db")
	database, err := store.Open(ctx, databasePath)
	if err != nil {
		t.Fatal(err)
	}
	_, _, repositoryObserver := phase5Service(t)
	service, err := NewService(database, repositoryObserver)
	if err != nil {
		t.Fatal(err)
	}
	task := openPhase5Task(t, service)
	request := requirementsSubmission(t, task, "submit-html-sensitive-requirements")
	request.Summary = "Support config set <key> <true|false> & config show."
	for stepID, result := range request.MethodResults {
		result.Summary = "Use config set <key> <true|false> & verify the result."
		request.MethodResults[stepID] = result
	}
	applied, err := service.SubmitAction(ctx, request)
	if err != nil {
		t.Fatal(err)
	}
	if applied.Task.CurrentNode != domain.NodeDesign || applied.Task.Revision != 2 {
		t.Fatalf("task node=%s revision=%d", applied.Task.CurrentNode, applied.Task.Revision)
	}
	operation, found, err := database.LoadActionOperation(ctx, task.TaskID)
	if err != nil || !found || operation.AppliedRevision == nil || *operation.AppliedRevision != 2 ||
		!bytes.Contains(operation.Commit.Payload, []byte("<key>")) {
		t.Fatalf("operation=%#v found=%v err=%v", operation, found, err)
	}
	if err := database.Close(); err != nil {
		t.Fatal(err)
	}
	database, err = store.Open(ctx, databasePath)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	service, err = NewService(database, repositoryObserver)
	if err != nil {
		t.Fatal(err)
	}
	read, err := service.GetTask(ctx, GetTaskRequest{Host: domain.HostCodex, TaskID: task.TaskID})
	if err != nil {
		t.Fatal(err)
	}
	if read.RecoveryAssessment == nil || read.RecoveryAssessment.Classification != domain.RecoveryCompletedAndRecorded {
		t.Fatalf("assessment=%#v", read.RecoveryAssessment)
	}
}

func TestSubmitActionHydratesDeliveryAuthorityFromCurrentTask(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := phase5TaskAtTest(t, service)
	task = applyPhase5(t, service, task, "tests_passed", "", testNodeResult(
		[]map[string]any{evidenceCheck("automated", "passed", "historical-build", 1, false)}, nil, nil, nil,
	))
	historicalAutomatedID := task.Test.EvidenceIDs[0]
	task = applyPhase5(t, service, task, "implementation_defect", "Implementation changed after the build.", comprehensionNodeResult(
		nil, nil, nil, "", "", []string{"Implementation changed after the build"},
	))
	task = applyPhase5(t, service, task, "implementation_ready_for_test", "", implementationNodeResult(1, []string{"work-a"}, true, nil))
	task = applyPhase5(t, service, task, "tests_passed", "", testNodeResult(
		[]map[string]any{evidenceCheck("static", "passed", "current-static-check", 0, false)}, nil, nil, nil,
	))
	task = applyPhase5(t, service, task, "comprehension_passed", "", comprehensionNodeResult(
		[]string{"component"}, nil, nil, "user", "passed", nil,
	))

	request := actionSubmission(t, task, "submit-core-hydrated-delivery", "delivery_complete", deliverySubmissionResult())
	applied, err := service.SubmitAction(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	outcome := applied.Task.Outcome
	if applied.Task.CurrentNode != domain.NodeDone || outcome == nil || len(outcome.AutomatedEvidenceIDs) != 0 ||
		len(outcome.ManualEvidenceIDs) != 1 || outcome.ManualEvidenceIDs[0] != task.Comprehension.UserEvidenceID ||
		outcome.TestRecordID != task.Test.RecordID || outcome.ComprehensionRecordID != task.Comprehension.RecordID {
		t.Fatalf("outcome=%#v", outcome)
	}
	if evidenceByID(applied.Task, historicalAutomatedID) == nil {
		t.Fatal("historical evidence was not retained")
	}

	operation, found, operationErr := memory.LoadActionOperation(context.Background(), task.TaskID)
	if operationErr != nil || !found {
		t.Fatalf("operation found=%v err=%v", found, operationErr)
	}
	_, decoded, decodeErr := workflow.DecodeStandardPayload(domain.NodeDelivery, operation.Commit.Payload)
	delivery, ok := decoded.(*workflow.DeliveryResult)
	if decodeErr != nil || !ok || len(delivery.AutomatedEvidenceIDs) != 0 || len(delivery.ManualEvidenceIDs) != 1 ||
		delivery.ManualEvidenceIDs[0] != task.Comprehension.UserEvidenceID || delivery.TestRecordID != task.Test.RecordID ||
		delivery.ComprehensionRecordID != task.Comprehension.RecordID || len(delivery.Acceptance) != len(task.Requirements.AcceptanceCriteria) {
		t.Fatalf("canonical delivery=%#v decode_err=%v", delivery, decodeErr)
	}
}

func TestSubmitActionRejectsDeliveryAuthorityMembersWithoutCompatibility(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := phase5TaskAtDelivery(t, service)
	result := deliverySubmissionResult()
	result["automated_evidence_ids"] = []string{string(task.Test.EvidenceIDs[0])}
	request := actionSubmission(t, task, "submit-core-owned-delivery-member", "delivery_complete", result)
	stages := memory.stages
	_, err := service.SubmitAction(context.Background(), request)
	var typed *domain.Error
	if !errors.As(err, &typed) || typed.Code != domain.ErrorInvalidArgument || !typed.ZeroWrite || len(typed.Violations) != 1 ||
		typed.Violations[0].Path != "payload.node_result.automated_evidence_ids" || typed.Violations[0].Rule != domain.RuleUnknownMember {
		t.Fatalf("error=%#v", err)
	}
	if memory.stages != stages {
		t.Fatalf("stages=%d want=%d", memory.stages, stages)
	}
}

func TestSubmitActionHydratedDeliveryStillRejectsOutstandingTestWork(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := phase5TaskAtTest(t, service)
	task = applyPhase5(t, service, task, "tests_passed", "", testNodeResult(
		[]map[string]any{evidenceCheck("automated", "passed", "targeted-test", 1, false)}, nil,
		[]string{"Browser verification remains"}, nil,
	))
	task = applyPhase5(t, service, task, "comprehension_passed", "", comprehensionNodeResult(
		[]string{"component"}, nil, nil, "user", "passed", nil,
	))
	request := actionSubmission(t, task, "submit-delivery-with-outstanding-test", "delivery_complete", deliverySubmissionResult())
	stages := memory.stages
	if _, err := service.SubmitAction(context.Background(), request); !errors.Is(err, domain.ErrTransitionNotAllowed) {
		t.Fatalf("error=%v", err)
	}
	if memory.stages != stages {
		t.Fatalf("stages=%d want=%d", memory.stages, stages)
	}
}

func TestSubmitActionHydratesDeliveryRemediationAuthorityAsEmpty(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := phase5TaskAtDelivery(t, service)
	result := deliverySubmissionResult()
	result["problem_class"] = "test_gap"
	result["findings"] = []string{"Current verification is insufficient"}
	request := actionSubmission(t, task, "submit-hydrated-delivery-remediation", "delivery_needs_test", result)
	request.Reason = "Current verification must be repeated."
	applied, err := service.SubmitAction(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if applied.Task.CurrentNode != domain.NodeTest || applied.Task.Outcome != nil {
		t.Fatalf("task node=%s outcome=%#v", applied.Task.CurrentNode, applied.Task.Outcome)
	}
	operation, found, operationErr := memory.LoadActionOperation(context.Background(), task.TaskID)
	if operationErr != nil || !found {
		t.Fatalf("operation found=%v err=%v", found, operationErr)
	}
	_, decoded, decodeErr := workflow.DecodeStandardPayload(domain.NodeDelivery, operation.Commit.Payload)
	delivery, ok := decoded.(*workflow.DeliveryResult)
	if decodeErr != nil || !ok || len(delivery.Acceptance) != 0 || len(delivery.AutomatedEvidenceIDs) != 0 ||
		len(delivery.ManualEvidenceIDs) != 0 || delivery.TestRecordID != "" || delivery.ComprehensionRecordID != "" {
		t.Fatalf("canonical remediation=%#v decode_err=%v", delivery, decodeErr)
	}
}

func TestArtifactRoleFailureIsNotRepositoryDrift(t *testing.T) {
	service, _, _ := phase5Service(t)
	task := openPhase5Task(t, service)
	raw := phase5Payload(t, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"criterion"}))
	var document map[string]any
	if json.Unmarshal(raw, &document) != nil {
		t.Fatal("invalid payload fixture")
	}
	document["artifacts"] = []map[string]any{{"role": "implementation", "path": "internal/file.go", "digest": digestOf("e"), "summary": "Wrong role"}}
	raw, _ = json.Marshal(document)
	_, err := service.ApplyAction(context.Background(), currentActionApplyRequest(task, "invalid-artifact-role", raw))
	if !errors.Is(err, domain.ErrInvalidArgument) || errors.Is(err, domain.ErrRepositoryDrift) {
		t.Fatalf("error=%v", err)
	}
	var typed *domain.Error
	if !errors.As(err, &typed) || len(typed.Violations) != 1 || typed.Violations[0].Rule != domain.RuleArtifactRoleNotAllowed {
		t.Fatalf("details=%#v", typed)
	}
}

func TestResolveBlockerActionBuildsItsPayloadInCore(t *testing.T) {
	service, memory, observer := phase5Service(t)
	task := phase5TaskAtRefactor(t, service)
	observer.binding = graphChangedBinding(task.Repository, []string{"internal/file.go"}, "c")
	blocked, err := service.ApplyAction(context.Background(), graphRecoveryApply(task, "partial-submit-blocker", json.RawMessage("null")))
	if err != nil {
		t.Fatal(err)
	}
	observer.binding = task.Repository
	result, err := service.ResolveBlockerAction(context.Background(), RecoverActionRequest{Host: domain.HostCodex, TaskID: task.TaskID, ActionID: blocked.Task.CurrentAction.ActionID}, "resolve-blocker-submit")
	if err != nil {
		t.Fatal(err)
	}
	operation, found, operationErr := memory.LoadActionOperation(context.Background(), task.TaskID)
	if result.Task.CurrentNode != domain.NodeRefactor || result.Task.Blocker != nil || operationErr != nil || !found || operation.Commit.Operation.SourceCursor != domain.NodeBlocked {
		t.Fatalf("resolved task=%#v", result.Task)
	}
}

func requirementsSubmission(t *testing.T, task domain.ProcessTask, requestID domain.ID) SubmitActionRequest {
	t.Helper()
	nodeResult := requirementsNodeResult("Goal", []string{"criterion"})
	nodeResult["problem_class"] = "none"
	result, err := json.Marshal(nodeResult)
	if err != nil {
		t.Fatal(err)
	}
	methods := make(map[domain.MethodStepID]MethodResultSubmission, len(task.CurrentAction.SemanticMethodSteps))
	for _, step := range task.CurrentAction.SemanticMethodSteps {
		methods[step.StepID] = MethodResultSubmission{Summary: "Completed the current semantic method step."}
	}
	return SubmitActionRequest{
		RequestID: requestID, Host: domain.HostCodex, TaskID: task.TaskID, ActionID: task.CurrentAction.ActionID,
		ExpectedActionKind: task.CurrentAction.Kind, TransitionID: "requirements_ready", Summary: "Requirements completed.",
		Reason: "", CurrentArtifacts: []ArtifactSubmission{}, OtherProcessArtifacts: []ArtifactSubmission{},
		MethodResults: methods, NodeResult: result,
	}
}

func actionSubmission(t *testing.T, task domain.ProcessTask, requestID domain.ID, transition domain.TransitionID, nodeResult any) SubmitActionRequest {
	t.Helper()
	raw, err := json.Marshal(nodeResult)
	if err != nil {
		t.Fatal(err)
	}
	methods := make(map[domain.MethodStepID]MethodResultSubmission, len(task.CurrentAction.SemanticMethodSteps))
	for _, step := range task.CurrentAction.SemanticMethodSteps {
		methods[step.StepID] = MethodResultSubmission{Summary: "Completed the current semantic method step."}
	}
	return SubmitActionRequest{
		RequestID: requestID, Host: domain.HostCodex, TaskID: task.TaskID, ActionID: task.CurrentAction.ActionID,
		ExpectedActionKind: task.CurrentAction.Kind, TransitionID: transition, Summary: "Current Action completed.",
		Reason: "", CurrentArtifacts: []ArtifactSubmission{}, OtherProcessArtifacts: []ArtifactSubmission{},
		MethodResults: methods, NodeResult: raw,
	}
}

func deliverySubmissionResult() map[string]any {
	return map[string]any{
		"problem_class": "none", "unverified_items": []string{}, "risks": []string{}, "findings": []string{},
	}
}
