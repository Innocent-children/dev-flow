package application

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	persistence "github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestMethodProfileEquivalentTransitionsAndImmutability(t *testing.T) {
	tests := []struct {
		name       string
		profile    domain.MethodProfile
		status     domain.MethodStepStatus
		capability string
	}{
		{"plain fallback", domain.MethodPlain, domain.MethodStepPlainFallback, ""},
		{"spec-kit completed", domain.MethodSpecKit, domain.MethodStepCompleted, "installed-capability"},
		{"openspec completed", domain.MethodOpenSpec, domain.MethodStepCompleted, "installed-capability"},
		{"spec-kit fallback", domain.MethodSpecKit, domain.MethodStepPlainFallback, ""},
		{"openspec fallback", domain.MethodOpenSpec, domain.MethodStepPlainFallback, ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			service, _, _ := phase5Service(t)
			task := openMethodProfileTask(t, service, tc.profile)
			result := applyMethodProfileRequirements(t, service, task, tc.status, tc.capability, "Completed the semantic step.")
			if result.CurrentNode != domain.NodeDesign || result.Intent.MethodProfile != tc.profile || result.CurrentAction.MethodProfile != tc.profile {
				t.Fatalf("profile-specific Core state: node=%s intent=%s action=%s", result.CurrentNode, result.Intent.MethodProfile, result.CurrentAction.MethodProfile)
			}
			read, err := service.GetTask(context.Background(), GetTaskRequest{Host: domain.HostCodex, TaskID: result.TaskID})
			if err != nil || read.Task.Intent.MethodProfile != tc.profile || !reflect.DeepEqual(read.Task.CurrentAction.SemanticMethodSteps, result.CurrentAction.SemanticMethodSteps) {
				t.Fatalf("read profile/steps drift: %v", err)
			}
			next, err := service.GetNextAction(context.Background(), GetNextActionRequest{Host: domain.HostCodex, TaskID: result.TaskID})
			if err != nil || next.MethodProfile != tc.profile || !reflect.DeepEqual(next.Action.SemanticMethodSteps, result.CurrentAction.SemanticMethodSteps) {
				t.Fatalf("next profile/steps drift: %v", err)
			}
		})
	}

	service, memory, _ := phase5Service(t)
	task := openMethodProfileTask(t, service, domain.MethodPlain)
	_, err := service.OpenTask(context.Background(), OpenTaskRequest{RequestID: "profile-conflict", Host: domain.HostCodex, RepositoryPath: testPath("repo"), NewTask: &NewTaskInput{Request: "Build feature", VerificationBudget: task.Intent.VerificationBudget, MethodProfile: domain.MethodSpecKit}})
	if err != domain.ErrActiveTaskConflict {
		t.Fatalf("profile conflict error=%v", err)
	}
	before := memory.commits
	nodeResult := requirementsNodeResult("Goal", []string{"Accepted"})
	nodeResult["method_profile"] = "openspec"
	raw := methodContractPayload(t, task, "requirements_ready", "", nodeResult, methodEvidenceForCurrentAction(task, domain.MethodStepPlainFallback, ""))
	if _, err := service.ApplyAction(context.Background(), methodApplyRequest(task, "profile-mutation", raw)); !errors.Is(err, domain.ErrInvalidArgument) || memory.commits != before {
		t.Fatalf("profile mutation error=%v writes=%d", err, memory.commits-before)
	}

	invalidService, _, _ := phase5Service(t)
	if _, err := invalidService.OpenTask(context.Background(), OpenTaskRequest{RequestID: "invalid-profile", Host: domain.HostCodex, RepositoryPath: testPath("repo"), NewTask: &NewTaskInput{Request: "Build feature", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 4}, MethodProfile: "future"}}); err != domain.ErrInvalidArgument {
		t.Fatalf("invalid profile error=%v", err)
	}
}

func TestMethodEvidenceFailurePathsAreZeroWrite(t *testing.T) {
	service, memory, observer := phase5Service(t)
	task := openMethodProfileTask(t, service, domain.MethodPlain)
	valid := methodEvidenceForCurrentAction(task, domain.MethodStepPlainFallback, "")
	tests := []struct {
		name   string
		want   error
		mutate func([]map[string]any) []map[string]any
	}{
		{"empty", domain.ErrTransitionNotAllowed, func([]map[string]any) []map[string]any { return []map[string]any{} }},
		{"missing required", domain.ErrTransitionNotAllowed, func(items []map[string]any) []map[string]any { return items[:2] }},
		{"unknown step", domain.ErrInvalidArgument, func(items []map[string]any) []map[string]any { items[0]["step_id"] = "other.step"; return items }},
		{"previous node step", domain.ErrInvalidArgument, func(items []map[string]any) []map[string]any {
			items[0]["step_id"] = "design.choose_approach"
			return items
		}},
		{"duplicate step", domain.ErrInvalidArgument, func(items []map[string]any) []map[string]any { items[1]["step_id"] = items[0]["step_id"]; return items }},
		{"unavailable required", domain.ErrTransitionNotAllowed, func(items []map[string]any) []map[string]any {
			for _, item := range items {
				item["status"], item["capability"] = "unavailable", "missing-capability"
			}
			return items
		}},
		{"not-run required", domain.ErrTransitionNotAllowed, func(items []map[string]any) []map[string]any {
			for _, item := range items {
				item["status"], item["capability"] = "not_run", ""
			}
			return items
		}},
		{"invalid status", domain.ErrInvalidArgument, func(items []map[string]any) []map[string]any { items[0]["status"] = "future"; return items }},
		{"invalid capability", domain.ErrInvalidArgument, func(items []map[string]any) []map[string]any { items[0]["capability"] = "bad capability"; return items }},
		{"empty summary", domain.ErrInvalidArgument, func(items []map[string]any) []map[string]any { items[0]["summary"] = ""; return items }},
		{"untrimmed summary", domain.ErrInvalidArgument, func(items []map[string]any) []map[string]any { items[0]["summary"] = " summary"; return items }},
		{"oversized summary", domain.ErrInvalidArgument, func(items []map[string]any) []map[string]any {
			items[0]["summary"] = strings.Repeat("s", domain.MaxEvidenceSummaryBytes+1)
			return items
		}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			items := cloneMethodEvidenceMaps(valid)
			raw := methodContractPayload(t, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"Accepted"}), tc.mutate(items))
			beforeWrites, beforeObservations, beforeEvidence := memory.commits, observer.calls, len(memory.task.Evidence)
			beforeMutation := memory.lastMutation
			_, err := service.ApplyAction(context.Background(), methodApplyRequest(task, "method-rejected", raw))
			if err != tc.want || memory.commits != beforeWrites || observer.calls != beforeObservations || len(memory.task.Evidence) != beforeEvidence || !reflect.DeepEqual(memory.lastMutation, beforeMutation) || memory.task.Revision != task.Revision || memory.task.CurrentAction.ActionID != task.CurrentAction.ActionID {
				t.Fatalf("error=%v writes=%d observations=%d", err, memory.commits-beforeWrites, observer.calls-beforeObservations)
			}
		})
	}
	invalidUTF8Evidence := cloneMethodEvidenceMaps(valid)
	invalidUTF8Evidence[0]["summary"] = "INVALID_UTF8_MARKER"
	invalidUTF8Payload := methodContractPayload(t, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"Accepted"}), invalidUTF8Evidence)
	invalidUTF8Payload = bytes.ReplaceAll(invalidUTF8Payload, []byte("INVALID_UTF8_MARKER"), []byte{0xff})
	beforeWrites, beforeObservations := memory.commits, observer.calls
	if _, err := service.ApplyAction(context.Background(), methodApplyRequest(task, "invalid-utf8-method", invalidUTF8Payload)); err != domain.ErrInvalidArgument || memory.commits != beforeWrites || observer.calls != beforeObservations {
		t.Fatalf("invalid UTF-8 error=%v", err)
	}

	complete := cloneMethodEvidenceMaps(valid)
	invalidNode := requirementsNodeResult("Goal", []string{"Accepted"})
	invalidNode["unresolved_questions"] = []string{"Question remains"}
	beforeWrites, beforeObservations = memory.commits, observer.calls
	if _, err := service.ApplyAction(context.Background(), methodApplyRequest(task, "invalid-node", methodContractPayload(t, task, "requirements_ready", "", invalidNode, complete))); !errors.Is(err, domain.ErrInvalidArgument) || memory.commits != beforeWrites || observer.calls != beforeObservations {
		t.Fatalf("invalid node result error=%v", err)
	}
	if _, err := service.ApplyAction(context.Background(), methodApplyRequest(task, "invalid-transition", methodContractPayload(t, task, "design_ready", "", requirementsNodeResult("Goal", []string{"Accepted"}), complete))); err != domain.ErrTransitionNotAllowed || memory.commits != beforeWrites || observer.calls != beforeObservations {
		t.Fatalf("invalid transition error=%v", err)
	}
}

func TestMethodEvidenceChangesCanonicalOperationDigest(t *testing.T) {
	leftService, _, _ := phase5Service(t)
	rightService, _, _ := phase5Service(t)
	left := openMethodProfileTask(t, leftService, domain.MethodSpecKit)
	right := openMethodProfileTask(t, rightService, domain.MethodSpecKit)
	left = applyMethodProfileRequirements(t, leftService, left, domain.MethodStepCompleted, "installed-capability", "First method summary.")
	right = applyMethodProfileRequirements(t, rightService, right, domain.MethodStepCompleted, "installed-capability", "Different method summary.")
	if left.LastOperation == nil || right.LastOperation == nil || left.LastOperation.PayloadDigest == right.LastOperation.PayloadDigest {
		t.Fatal("MethodEvidence semantic change did not change operation digest")
	}
}

func TestMethodProfileAndProcessActionRestartStability(t *testing.T) {
	now := time.Date(2026, 8, 19, 16, 0, 0, 0, time.UTC)
	binding := phase5Binding(now)
	path := filepath.Join(t.TempDir(), "tasks.db")
	database, err := persistence.Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	observer := &mutableObserver{binding: binding}
	n := 0
	service, err := newService(database, observer, func() time.Time { return now }, func(prefix string) (domain.ID, error) {
		n++
		return domain.ID(prefix + "-restart-" + string(rune('a'+n))), nil
	})
	if err != nil {
		t.Fatal(err)
	}
	task := openMethodProfileTask(t, service, domain.MethodOpenSpec)
	wantAction := *task.CurrentAction
	if err := database.Close(); err != nil {
		t.Fatal(err)
	}
	database, err = persistence.Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	resumedService, err := NewService(database, observer)
	if err != nil {
		t.Fatal(err)
	}
	resumed, err := resumedService.OpenTask(context.Background(), OpenTaskRequest{RequestID: "resume-method-task", Host: domain.HostCodex, RepositoryPath: testPath("repo")})
	if err != nil {
		t.Fatal(err)
	}
	if resumed.Task.Intent.MethodProfile != domain.MethodOpenSpec || resumed.Task.CurrentAction.ActionID != wantAction.ActionID || !reflect.DeepEqual(*resumed.Task.CurrentAction, wantAction) {
		t.Fatal("restart changed profile, steps, ordering, or Action identity")
	}
	first, err := resumedService.GetNextAction(context.Background(), GetNextActionRequest{Host: domain.HostCodex, TaskID: task.TaskID})
	second, secondErr := resumedService.GetNextAction(context.Background(), GetNextActionRequest{Host: domain.HostCodex, TaskID: task.TaskID})
	if err != nil || secondErr != nil || first.MethodProfile != domain.MethodOpenSpec || !reflect.DeepEqual(first, second) {
		t.Fatalf("repeated next-action read drift: %v %v", err, secondErr)
	}
}

func TestMethodProfileGetNextActionActiveBlockedAndTerminal(t *testing.T) {
	service, memory, _ := phase5Service(t)
	active := openMethodProfileTask(t, service, domain.MethodSpecKit)
	result, err := service.GetNextAction(context.Background(), GetNextActionRequest{Host: domain.HostCodex, TaskID: active.TaskID})
	if err != nil || result.MethodProfile != domain.MethodSpecKit {
		t.Fatalf("active profile=%s error=%v", result.MethodProfile, err)
	}
	blocked := active
	resume := active.CurrentNode
	action, err := workflow.BuildProcessAction(workflow.StandardProcess(), domain.NodeBlocked, blocked.TaskID, blocked.Revision, blocked.Repository.BindingDigest, blocked.Intent.MethodProfile, "blocked-method-action", blocked.UpdatedAt)
	if err != nil {
		t.Fatal(err)
	}
	blocked.CurrentNode, blocked.ResumeNode, blocked.Blocker, blocked.CurrentAction = domain.NodeBlocked, &resume, &domain.ProcessBlocker{BlockerID: "blocker", Code: domain.ErrorTaskBlocked, Cause: domain.BlockerCauseRecoveryConflicting, ResumeNode: resume, Message: "Restore repository binding.", ObservedBindingDigest: blocked.Repository.BindingDigest, Condition: domain.BlockerCondition{Kind: domain.BlockerConditionRestoreIssuanceBinding, ExpectedBindingDigest: blocked.Repository.BindingDigest}, RequiredResolution: "Restore the issuance binding.", CreatedAt: blocked.UpdatedAt}, &action
	memory.task = &blocked
	result, err = service.GetNextAction(context.Background(), GetNextActionRequest{Host: domain.HostCodex, TaskID: blocked.TaskID})
	if err != nil || result.MethodProfile != domain.MethodSpecKit || result.Action == nil {
		t.Fatalf("blocked profile=%s error=%v", result.MethodProfile, err)
	}
	memory.task = &active
	terminal, err := service.CancelTask(context.Background(), CancelTaskRequest{RequestID: "cancel-method-task", Host: domain.HostCodex, TaskID: active.TaskID, ExpectedRevision: active.Revision, Reason: "Cancel method task."})
	if err != nil {
		t.Fatal(err)
	}
	result, err = service.GetNextAction(context.Background(), GetNextActionRequest{Host: domain.HostCodex, TaskID: terminal.Task.TaskID})
	if err != nil || result.MethodProfile != domain.MethodSpecKit || result.Action != nil {
		t.Fatalf("terminal profile=%s error=%v", result.MethodProfile, err)
	}
}

func openMethodProfileTask(t *testing.T, service *Service, profile domain.MethodProfile) domain.ProcessTask {
	t.Helper()
	result, err := service.OpenTask(context.Background(), OpenTaskRequest{RequestID: "open-method-task", Host: domain.HostCodex, RepositoryPath: testPath("repo"), NewTask: &NewTaskInput{Request: "Build feature", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 4}, MethodProfile: profile}})
	if err != nil {
		t.Fatal(err)
	}
	return result.Task
}

func applyMethodProfileRequirements(t *testing.T, service *Service, task domain.ProcessTask, status domain.MethodStepStatus, capability, summary string) domain.ProcessTask {
	t.Helper()
	evidence := methodEvidenceForCurrentAction(task, status, capability)
	for _, item := range evidence {
		item["summary"] = summary
	}
	raw := methodContractPayload(t, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"Accepted"}), evidence)
	result, err := service.ApplyAction(context.Background(), methodApplyRequest(task, "apply-method-task", raw))
	if err != nil {
		t.Fatal(err)
	}
	return result.Task
}

func methodContractPayload(t *testing.T, task domain.ProcessTask, transition, reason string, nodeResult map[string]any, methodEvidence []map[string]any) json.RawMessage {
	t.Helper()
	nodeResult["problem_class"] = phase5ProblemClass(transition)
	raw, err := json.Marshal(map[string]any{"transition_id": transition, "summary": "Method result recorded.", "reason": reason, "artifacts": []any{}, "method_evidence": methodEvidence, "node_result": nodeResult})
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func methodApplyRequest(task domain.ProcessTask, requestID domain.ID, payload json.RawMessage) ApplyActionRequest {
	action := task.CurrentAction
	return ApplyActionRequest{RequestID: requestID, Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision, ActionID: action.ActionID, ActionKind: action.Kind, ProcessID: task.Process.ID, ProcessDefinitionDigest: task.Process.DefinitionDigest, SourceCursor: task.CurrentNode, RepositoryBindingDigest: task.Repository.BindingDigest, Payload: payload}
}

func cloneMethodEvidenceMaps(items []map[string]any) []map[string]any {
	clone := make([]map[string]any, len(items))
	for i, item := range items {
		clone[i] = make(map[string]any, len(item))
		for key, value := range item {
			clone[i][key] = value
		}
	}
	return clone
}

func phase5Binding(now time.Time) domain.RepositoryBinding {
	digest := digestOf("a")
	branch := "main"
	head := strings.Repeat("b", 40)
	return domain.RepositoryBinding{CanonicalRoot: testPath("repo"), GitCommonDirDigest: digest, RepositoryIdentity: digest, Branch: &branch, Head: &head, WorktreeFingerprint: digest, ObservedAt: now, BindingDigest: digest}
}
