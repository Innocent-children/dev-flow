package application

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
)

func TestGraphRecoveryProbedReadsAndRecoveredTransition(t *testing.T) {
	service, memory, observer := phase5Service(t)
	task := phase5TaskAtRefactor(t, service)
	payload := phase5Payload(t, task, "refactor_ready_for_test", "", refactorNodeResult([]string{"internal/order.go"}, false, []string{"Removed indirection"}, false, nil))
	probe := graphProbe(task, "uncertain-refactor", payload)
	commits := memory.commits
	observations := observer.calls

	read, err := service.GetTask(context.Background(), GetTaskRequest{Host: domain.HostCodex, TaskID: task.TaskID, OperationProbe: &probe})
	if err != nil {
		t.Fatal(err)
	}
	if read.RecoveryAssessment == nil || read.RecoveryAssessment.Classification != domain.RecoveryNotStarted || memory.commits != commits || observer.calls != observations+1 {
		t.Fatalf("read=%+v commits=%d observations=%d", read.RecoveryAssessment, memory.commits-commits, observer.calls-observations)
	}
	next, err := service.GetNextAction(context.Background(), GetNextActionRequest{Host: domain.HostCodex, TaskID: task.TaskID, OperationProbe: &probe})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(read.RecoveryAssessment, next.RecoveryAssessment) || next.Action.ActionID != task.CurrentAction.ActionID || memory.commits != commits {
		t.Fatal("get_task/get_next_action recovery assessments diverged or wrote")
	}

	dirty := graphChangedBinding(task.Repository, []string{"internal/order.go"}, "c")
	observer.binding = dirty
	read, err = service.GetTask(context.Background(), GetTaskRequest{Host: domain.HostCodex, TaskID: task.TaskID, OperationProbe: &probe})
	if err != nil {
		t.Fatal(err)
	}
	if read.RecoveryAssessment.Classification != domain.RecoveryCompletedButUnrecorded || read.RecoveryAssessment.NextAdvice != recovery.AdviceSubmitRecoveryApply || memory.commits != commits {
		t.Fatalf("assessment=%+v", read.RecoveryAssessment)
	}

	request := graphRecoveryApply(task, probe.OperationID, payload)
	recovered, err := service.ApplyAction(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if recovered.Task.CurrentNode != domain.NodeTest || recovered.Task.Revision != task.Revision+1 || memory.commits != commits+1 || recovered.Task.LastOperation.OperationID != probe.OperationID {
		t.Fatalf("recovered task=%+v commits=%d", recovered.Task, memory.commits-commits)
	}
	commits = memory.commits
	duplicate, err := service.ApplyAction(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if duplicate.Task.Revision != recovered.Task.Revision || memory.commits != commits {
		t.Fatal("duplicate recovered transition wrote again")
	}
	read, err = service.GetTask(context.Background(), GetTaskRequest{Host: domain.HostCodex, TaskID: task.TaskID, OperationProbe: &probe})
	if err != nil {
		t.Fatal(err)
	}
	if read.RecoveryAssessment.Classification != domain.RecoveryCompletedAndRecorded || read.RecoveryAssessment.CommittedProof == nil {
		t.Fatalf("committed assessment=%+v", read.RecoveryAssessment)
	}
}

func TestGraphRecoveryPartialCreatesOneBlockerAndResolvesExactResume(t *testing.T) {
	service, memory, observer := phase5Service(t)
	task := phase5TaskAtRefactor(t, service)
	observer.binding = graphChangedBinding(task.Repository, []string{"internal/order.go"}, "d")
	probe := graphProbe(task, "partial-refactor", json.RawMessage("null"))
	read, err := service.GetTask(context.Background(), GetTaskRequest{Host: domain.HostCodex, TaskID: task.TaskID, OperationProbe: &probe})
	if err != nil {
		t.Fatal(err)
	}
	if read.RecoveryAssessment.Classification != domain.RecoveryPartiallyCompleted || read.RecoveryAssessment.UnblockCondition == nil {
		t.Fatalf("assessment=%+v", read.RecoveryAssessment)
	}
	commits := memory.commits
	blocked, err := service.ApplyAction(context.Background(), graphRecoveryApply(task, probe.OperationID, json.RawMessage("null")))
	if err != nil {
		t.Fatal(err)
	}
	if blocked.Task.CurrentNode != domain.NodeBlocked || blocked.Task.ResumeNode == nil || *blocked.Task.ResumeNode != domain.NodeRefactor || blocked.Task.Blocker == nil || blocked.Task.Blocker.ObservedBindingDigest != observer.binding.BindingDigest || blocked.Task.Repository.BindingDigest != task.Repository.BindingDigest || memory.commits != commits+1 {
		t.Fatalf("blocked task=%+v", blocked.Task)
	}
	blockerID, actionID, revision := blocked.Task.Blocker.BlockerID, blocked.Task.CurrentAction.ActionID, blocked.Task.Revision
	commits = memory.commits
	duplicate, err := service.ApplyAction(context.Background(), graphRecoveryApply(task, probe.OperationID, json.RawMessage("null")))
	if err != nil {
		t.Fatal(err)
	}
	if duplicate.Task.Blocker.BlockerID != blockerID || duplicate.Task.CurrentAction.ActionID != actionID || duplicate.Task.Revision != revision || memory.commits != commits {
		t.Fatal("duplicate blocker apply changed authority")
	}

	badPayload, _ := json.Marshal(map[string]any{"blocker_id": "wrong-blocker", "condition": blocked.Task.Blocker.Condition, "observed_binding_digest": observer.binding.BindingDigest})
	badResolve := ApplyActionRequest{RequestID: "bad-resolve", Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: blocked.Task.Revision, ActionID: blocked.Task.CurrentAction.ActionID, ActionKind: domain.ActionResolveBlocker, ProcessID: blocked.Task.Process.ID, ProcessDefinitionDigest: blocked.Task.Process.DefinitionDigest, SourceCursor: domain.NodeBlocked, RepositoryBindingDigest: blocked.Task.Repository.BindingDigest, Payload: badPayload}
	commits = memory.commits
	if _, err := service.ApplyAction(context.Background(), badResolve); err != domain.ErrRepositoryDrift || memory.commits != commits {
		t.Fatalf("unrestored repository err=%v commits=%d", err, memory.commits-commits)
	}

	observer.binding = task.Repository
	resolutionPayload, err := json.Marshal(map[string]any{"blocker_id": blockerID, "condition": blocked.Task.Blocker.Condition, "observed_binding_digest": task.Repository.BindingDigest})
	if err != nil {
		t.Fatal(err)
	}
	resolve := ApplyActionRequest{RequestID: "resolve-operation", Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: blocked.Task.Revision, ActionID: blocked.Task.CurrentAction.ActionID, ActionKind: domain.ActionResolveBlocker, ProcessID: blocked.Task.Process.ID, ProcessDefinitionDigest: blocked.Task.Process.DefinitionDigest, SourceCursor: domain.NodeBlocked, RepositoryBindingDigest: blocked.Task.Repository.BindingDigest, Payload: resolutionPayload}
	badResolve = resolve
	badResolve.RequestID = "wrong-blocker-resolve"
	badResolve.Payload, _ = json.Marshal(map[string]any{"blocker_id": "wrong-blocker", "condition": blocked.Task.Blocker.Condition, "observed_binding_digest": task.Repository.BindingDigest})
	if _, err := service.ApplyAction(context.Background(), badResolve); err != domain.ErrInvalidArgument || memory.commits != commits {
		t.Fatalf("wrong blocker err=%v commits=%d", err, memory.commits-commits)
	}
	resolved, err := service.ApplyAction(context.Background(), resolve)
	if err != nil {
		t.Fatal(err)
	}
	if resolved.Task.CurrentNode != domain.NodeRefactor || resolved.Task.Blocker != nil || resolved.Task.ResumeNode != nil || resolved.Task.Revision != revision+1 || resolved.Task.CurrentAction.ActionID == actionID {
		t.Fatalf("resolved task=%+v", resolved.Task)
	}
	commits = memory.commits
	if _, err := service.ApplyAction(context.Background(), resolve); err != domain.ErrRevisionConflict || memory.commits != commits {
		t.Fatalf("duplicate resolution err=%v commits=%d", err, memory.commits-commits)
	}
}

func TestGraphRecoveryTerminalAssessmentAndHostConflict(t *testing.T) {
	service, memory, observer := phase5Service(t)
	task := phase5TaskAtDelivery(t, service)
	payload := phase5Payload(t, task, "delivery_complete", "", deliveryCompleteNodeResult(task))
	request := graphRecoveryApply(task, "terminal-operation", payload)
	request.RecoveryApply = nil
	completed, err := service.ApplyAction(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if completed.Task.CurrentNode != domain.NodeDone {
		t.Fatal("delivery did not complete")
	}
	probe := graphProbe(task, "terminal-operation", payload)
	commits, observations := memory.commits, observer.calls
	read, err := service.GetTask(context.Background(), GetTaskRequest{Host: domain.HostCodex, TaskID: task.TaskID, OperationProbe: &probe})
	if err != nil {
		t.Fatal(err)
	}
	if read.RecoveryAssessment.Classification != domain.RecoveryCompletedAndRecorded || read.Task.CurrentAction != nil || memory.commits != commits || observer.calls != observations+1 {
		t.Fatalf("terminal assessment=%+v", read.RecoveryAssessment)
	}
	observations = observer.calls
	if _, err := service.GetTask(context.Background(), GetTaskRequest{Host: domain.HostDeepSeek, TaskID: task.TaskID, OperationProbe: &probe}); err != domain.ErrHostOwnershipConflict || observer.calls != observations {
		t.Fatalf("ownership err=%v observations=%d", err, observer.calls-observations)
	}
}

func TestGraphRecoveryAdoptsDeclaredProcessArtifactOnlyEffect(t *testing.T) {
	service, memory, observer := phase5Service(t)
	task := openPhase5Task(t, service)
	payload := phase5Payload(t, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"Works"}))
	var document map[string]any
	if err := json.Unmarshal(payload, &document); err != nil {
		t.Fatal(err)
	}
	document["artifacts"] = []map[string]any{{"role": "requirements", "path": "artifacts/requirements.json", "digest": digestOf("e"), "summary": "Requirements artifact"}}
	nodeResult := document["node_result"].(map[string]any)
	nodeResult["changed_paths"] = []string{"artifacts/requirements.json"}
	nodeResult["no_file_changes"] = false
	payload, _ = json.Marshal(document)
	observer.binding = graphChangedBinding(task.Repository, []string{"artifacts/requirements.json"}, "f")
	probe := graphProbe(task, "artifact-operation", payload)
	read, err := service.GetTask(context.Background(), GetTaskRequest{Host: domain.HostCodex, TaskID: task.TaskID, OperationProbe: &probe})
	if err != nil {
		t.Fatal(err)
	}
	if read.RecoveryAssessment.Classification != domain.RecoveryCompletedButUnrecorded {
		t.Fatalf("assessment=%+v", read.RecoveryAssessment)
	}
	commits := memory.commits
	recovered, err := service.ApplyAction(context.Background(), graphRecoveryApply(task, probe.OperationID, payload))
	if err != nil {
		t.Fatal(err)
	}
	if recovered.Task.CurrentNode != domain.NodeDesign || recovered.Task.Repository.BindingDigest != observer.binding.BindingDigest || memory.commits != commits+1 {
		t.Fatalf("task=%+v", recovered.Task)
	}
}

func TestMultiRepositoryRecoveryRejectsUndeclaredAdditionalDriftWithoutWrite(t *testing.T) {
	now := time.Date(2026, 8, 23, 7, 0, 0, 0, time.UTC)
	corePath, docsPath := testPath("core"), testPath("docs")
	primary := multiRepositoryBinding(now, corePath, 'a')
	docs := multiRepositoryBinding(now, docsPath, 'b')
	service, taskStore, observer := multiRepositoryService(t, now, map[string]domain.RepositoryBinding{corePath: primary, docsPath: docs})
	request := multiRepositoryOpenRequest("open-recovery-multi", corePath)
	request.PrimaryRepositoryKey = "core"
	request.AdditionalRepositories = []AdditionalRepositoryInput{{Key: "docs", RepositoryPath: docsPath}}
	opened, err := service.OpenTask(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	payload := phase5Payload(t, opened.Task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"Works"}))
	docsChanged := graphChangedBinding(docs, []string{"docs/unexpected.md"}, "c")
	observer.bindings[docsPath] = docsChanged
	apply := graphRecoveryApply(opened.Task, "multi-drift-apply", payload)
	apply.RecoveryApply = nil
	commits := taskStore.commits
	if _, err := service.ApplyAction(context.Background(), apply); !errors.Is(err, domain.ErrRepositoryDrift) {
		t.Fatalf("error=%v", err)
	}
	if taskStore.commits != commits || taskStore.task.Revision != opened.Task.Revision {
		t.Fatalf("drift wrote task: commits=%d revision=%d", taskStore.commits-commits, taskStore.task.Revision)
	}
	probe := graphProbe(opened.Task, "multi-drift-probe", payload)
	read, err := service.GetTask(context.Background(), GetTaskRequest{Host: domain.HostCodex, TaskID: opened.Task.TaskID, OperationProbe: &probe})
	if err != nil {
		t.Fatal(err)
	}
	if read.RecoveryAssessment.Classification != domain.RecoveryConflicting || len(read.RecoveryAssessment.Repositories) != 2 || read.RecoveryAssessment.Repositories[1].RepositoryKey != "docs" {
		t.Fatalf("assessment=%+v", read.RecoveryAssessment)
	}
}

func graphProbe(task domain.ProcessTask, operationID domain.ID, payload json.RawMessage) OperationProbe {
	action := task.CurrentAction
	digest, _ := task.EffectiveRepositoryBindingDigest()
	return OperationProbe{OperationID: operationID, ProcessID: task.Process.ID, ProcessDefinitionDigest: task.Process.DefinitionDigest, SourceCursor: task.CurrentNode, ExpectedRevision: task.Revision, ActionID: action.ActionID, ActionKind: action.Kind, RepositoryBindingDigest: digest, Payload: payload}
}

func graphRecoveryApply(task domain.ProcessTask, operationID domain.ID, payload json.RawMessage) ApplyActionRequest {
	action := task.CurrentAction
	digest, _ := task.EffectiveRepositoryBindingDigest()
	return ApplyActionRequest{RequestID: operationID, Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision, ActionID: action.ActionID, ActionKind: action.Kind, ProcessID: task.Process.ID, ProcessDefinitionDigest: task.Process.DefinitionDigest, SourceCursor: task.CurrentNode, RepositoryBindingDigest: digest, Payload: payload, RecoveryApply: &RecoveryApplyInput{OperationID: operationID, SourceCursor: task.CurrentNode}}
}

func graphChangedBinding(base domain.RepositoryBinding, paths []string, seed string) domain.RepositoryBinding {
	changed := base.Clone()
	changed.WorktreeFingerprint = digestOf(seed)
	changed.BindingDigest = digestOf(seed)
	changed.ChangedPaths = append([]string(nil), paths...)
	changed.ObservedAt = base.ObservedAt.Add(1)
	return changed
}
