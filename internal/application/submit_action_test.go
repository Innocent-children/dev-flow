package application

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestSubmitActionBuildsAndRetainsCanonicalCommit(t *testing.T) {
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
	if result.Task.CurrentNode != domain.NodeDesign || result.Task.ActionCommit == nil {
		t.Fatalf("task node=%s commit=%#v", result.Task.CurrentNode, result.Task.ActionCommit)
	}
	commit := result.Task.ActionCommit
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
	if _, err := service.SubmitAction(context.Background(), request); !errors.Is(err, domain.ErrStorageUnavailable) {
		t.Fatalf("submit error=%v", err)
	}
	retained, err := memory.LoadTask(context.Background(), task.TaskID)
	if err != nil || retained.ActionCommit == nil || retained.Revision != task.Revision {
		t.Fatalf("retained=%#v err=%v", retained.ActionCommit, err)
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

func TestSubmitActionRejectsCorrectableDeliveryBeforeStagingCommit(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := phase5TaskAtDelivery(t, service)
	result := deliveryCompleteNodeResult(task)
	result["problem_class"] = "none"
	result["manual_evidence_ids"] = []string{}
	request := actionSubmission(t, task, "submit-delivery-missing-evidence", "delivery_complete", result)
	stages := memory.stages
	if _, err := service.SubmitAction(context.Background(), request); !errors.Is(err, domain.ErrTransitionNotAllowed) {
		t.Fatalf("error=%v", err)
	} else {
		var typed *domain.Error
		if !errors.As(err, &typed) || !typed.ZeroWrite || typed.Guard == nil || len(typed.Guard.Failures) != 1 || typed.Guard.Failures[0].Path != "payload.node_result.manual_evidence_ids" {
			t.Fatalf("structured error=%#v", typed)
		}
	}
	if memory.stages != stages {
		t.Fatalf("stages=%d want=%d", memory.stages, stages)
	}
	retained, err := memory.LoadTask(context.Background(), task.TaskID)
	if err != nil || retained.ActionCommit != nil {
		t.Fatalf("action commit=%#v err=%v", retained.ActionCommit, err)
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
	action := task.CurrentAction
	_, err := service.ApplyAction(context.Background(), ApplyActionRequest{RequestID: "invalid-artifact-role", Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision, ActionID: action.ActionID, ActionKind: action.Kind, ProcessID: task.Process.ID, ProcessDefinitionDigest: task.Process.DefinitionDigest, SourceCursor: task.CurrentNode, RepositoryBindingDigest: action.RepositoryBindingDigest, Payload: raw})
	if !errors.Is(err, domain.ErrInvalidArgument) || errors.Is(err, domain.ErrRepositoryDrift) {
		t.Fatalf("error=%v", err)
	}
	var typed *domain.Error
	if !errors.As(err, &typed) || len(typed.Violations) != 1 || typed.Violations[0].Rule != domain.RuleArtifactRoleNotAllowed {
		t.Fatalf("details=%#v", typed)
	}
}

func TestResolveBlockerActionBuildsItsPayloadInCore(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := openPhase5Task(t, service)
	resume := task.CurrentNode
	action, err := workflow.BuildProcessAction(workflow.StandardProcess(), domain.NodeBlocked, task.TaskID, task.Revision, task.Repository.BindingDigest, task.Intent.MethodProfile, "blocked-submit-action", task.UpdatedAt)
	if err != nil {
		t.Fatal(err)
	}
	task.CurrentNode = domain.NodeBlocked
	task.ResumeNode = &resume
	task.Blocker = &domain.ProcessBlocker{
		BlockerID: "blocker", Code: domain.ErrorTaskBlocked, Cause: domain.RecoveryConflicting,
		ResumeNode: resume, Message: "Restore repository binding.", ObservedBindingDigest: task.Repository.BindingDigest,
		Condition:          domain.BlockerCondition{Kind: domain.BlockerConditionRestoreIssuanceBinding, ExpectedBindingDigest: task.Repository.BindingDigest},
		RequiredResolution: "Restore the issuance binding.", CreatedAt: task.UpdatedAt,
	}
	task.CurrentAction = &action
	memory.task = &task
	result, err := service.ResolveBlockerAction(context.Background(), RecoverActionRequest{Host: domain.HostCodex, TaskID: task.TaskID, ActionID: action.ActionID}, "resolve-blocker-submit")
	if err != nil {
		t.Fatal(err)
	}
	if result.Task.CurrentNode != domain.NodeRequirements || result.Task.Blocker != nil || result.Task.ActionCommit == nil || result.Task.ActionCommit.Operation.SourceCursor != domain.NodeBlocked {
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
